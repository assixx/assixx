/**
 * Machine Maintenance Service
 *
 * Sub-service handling maintenance history, statistics, and categories.
 * Operates on machine_maintenance_history and machine_categories tables.
 *
 * Called exclusively through the MachinesService facade.
 * Caller is responsible for validating machine existence before calling.
 */
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import {
  buildMaintenanceInsertParams,
  hasContent,
  mapDbMachineToApi,
  mapMaintenanceToApi,
  parseIntOrZero,
} from './machines.helpers.js';
import type {
  DbCategoryRow,
  DbMachineRow,
  DbMaintenanceRow,
  DbStatisticsRow,
  MachineCategory,
  MachineResponse,
  MachineStatistics,
  MachineStatus,
  MaintenanceHistoryResponse,
  MaintenanceRecordRequest,
  StatusAfter,
} from './machines.types.js';

@Injectable()
export class MachineMaintenanceService {
  private readonly logger = new Logger(MachineMaintenanceService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Get maintenance history for a machine
   */
  async getMaintenanceHistory(
    machineId: number,
    tenantId: number,
  ): Promise<MaintenanceHistoryResponse[]> {
    this.logger.debug(`Getting maintenance history for machine ${machineId}`);

    const rows = await this.db.query<DbMaintenanceRow>(
      `
      SELECT mh.*,
             u1.username as performed_by_name,
             u2.username as created_by_name
      FROM machine_maintenance_history mh
      LEFT JOIN users u1 ON mh.performed_by = u1.id
      LEFT JOIN users u2 ON mh.created_by = u2.id
      WHERE mh.machine_id = $1 AND mh.tenant_id = $2
      ORDER BY mh.performed_date DESC
      `,
      [machineId, tenantId],
    );

    return rows.map((row: DbMaintenanceRow) => mapMaintenanceToApi(row));
  }

  /**
   * Update machine status and dates after maintenance record is added
   */
  private async updateMachineAfterMaintenance(
    machineId: number,
    tenantId: number,
    performedDate: string,
    nextMaintenanceDate: string | undefined,
    statusAfter: StatusAfter,
  ): Promise<void> {
    const machineStatus: MachineStatus =
      statusAfter === 'needs_repair' ? 'repair' : 'operational';
    const nextDate =
      hasContent(nextMaintenanceDate) ? new Date(nextMaintenanceDate) : null;

    await this.db.query(
      `UPDATE machines SET last_maintenance = $1, next_maintenance = $2, status = $3,
       updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND tenant_id = $5`,
      [new Date(performedDate), nextDate, machineStatus, machineId, tenantId],
    );
  }

  /**
   * Add maintenance record and update machine status
   */
  async addMaintenanceRecord(
    data: MaintenanceRecordRequest,
    tenantId: number,
    userId: number,
  ): Promise<MaintenanceHistoryResponse> {
    this.logger.log(`Adding maintenance record for machine ${data.machineId}`);

    const rows = await this.db.query<{ id: number }>(
      `INSERT INTO machine_maintenance_history (
        tenant_id, machine_id, maintenance_type, performed_date, performed_by,
        external_company, description, parts_replaced, cost, duration_hours,
        status_after, next_maintenance_date, report_url, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
      buildMaintenanceInsertParams(data, tenantId, userId),
    );

    if (rows.length === 0 || rows[0] === undefined) {
      throw new InternalServerErrorException(
        'Failed to add maintenance record',
      );
    }

    const recordId = rows[0].id;
    const statusAfter = data.statusAfter ?? 'operational';
    await this.updateMachineAfterMaintenance(
      data.machineId,
      tenantId,
      data.performedDate,
      data.nextMaintenanceDate,
      statusAfter,
    );

    const history = await this.getMaintenanceHistory(data.machineId, tenantId);
    const record = history.find(
      (h: MaintenanceHistoryResponse) => h.id === recordId,
    );
    if (record === undefined) {
      throw new NotFoundException('Maintenance record not found');
    }
    return record;
  }

  /**
   * Get machines with upcoming maintenance within given days
   */
  async getUpcomingMaintenance(
    tenantId: number,
    days: number = 30,
  ): Promise<MachineResponse[]> {
    this.logger.debug(`Getting upcoming maintenance for tenant ${tenantId}`);

    const rows = await this.db.query<DbMachineRow>(
      `
      SELECT m.*, d.name as department_name
      FROM machines m
      LEFT JOIN departments d ON m.department_id = d.id AND d.tenant_id = m.tenant_id
      WHERE m.tenant_id = $1
        AND m.is_active = 1
        AND m.next_maintenance <= CURRENT_DATE + ($2 * INTERVAL '1 day')
        AND m.status != 'decommissioned'
      ORDER BY m.next_maintenance ASC
      `,
      [tenantId, days],
    );

    return rows.map((row: DbMachineRow) => mapDbMachineToApi(row));
  }

  /**
   * Get machine statistics (counts by status)
   */
  async getStatistics(tenantId: number): Promise<MachineStatistics> {
    this.logger.debug(`Getting machine statistics for tenant ${tenantId}`);

    const row = await this.db.queryOne<DbStatisticsRow>(
      `
      SELECT
        COUNT(*) as total_machines,
        SUM(CASE WHEN status = 'operational' THEN 1 ELSE 0 END) as operational,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as in_maintenance,
        SUM(CASE WHEN status = 'repair' THEN 1 ELSE 0 END) as in_repair,
        SUM(CASE WHEN status = 'standby' THEN 1 ELSE 0 END) as standby,
        SUM(CASE WHEN status = 'decommissioned' THEN 1 ELSE 0 END) as decommissioned,
        SUM(CASE WHEN next_maintenance <= CURRENT_DATE + INTERVAL '30 days' AND status != 'decommissioned' THEN 1 ELSE 0 END) as needs_maintenance_soon
      FROM machines
      WHERE tenant_id = $1 AND is_active = 1
      `,
      [tenantId],
    );

    if (row === null) {
      return {
        totalMachines: 0,
        operational: 0,
        inMaintenance: 0,
        inRepair: 0,
        standby: 0,
        decommissioned: 0,
        needsMaintenanceSoon: 0,
      };
    }

    return {
      totalMachines: parseIntOrZero(row.total_machines),
      operational: parseIntOrZero(row.operational),
      inMaintenance: parseIntOrZero(row.in_maintenance),
      inRepair: parseIntOrZero(row.in_repair),
      standby: parseIntOrZero(row.standby),
      decommissioned: parseIntOrZero(row.decommissioned),
      needsMaintenanceSoon: parseIntOrZero(row.needs_maintenance_soon),
    };
  }

  /**
   * Get machine categories
   */
  async getCategories(): Promise<MachineCategory[]> {
    this.logger.debug('Getting machine categories');

    const rows = await this.db.query<DbCategoryRow>(
      `
      SELECT * FROM machine_categories
      WHERE is_active = 1
      ORDER BY sort_order ASC, name ASC
      `,
    );

    return rows.map((row: DbCategoryRow) => {
      const category: MachineCategory = {
        id: row.id,
        name: row.name,
        sortOrder: row.sort_order,
        isActive: Boolean(row.is_active),
      };

      if (row.description !== null) category.description = row.description;
      if (row.icon !== null) category.icon = row.icon;

      return category;
    });
  }
}
