/**
 * Machines Service — Facade
 *
 * Orchestrates machine CRUD operations and delegates to sub-services:
 * - MachineMaintenanceService — maintenance history, statistics, categories
 * - MachineTeamService — machine-team associations
 *
 * Pure helper functions are in machines.helpers.ts
 * Types are in machines.types.ts
 */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { MachineMaintenanceService } from './machine-maintenance.service.js';
import { MachineTeamService } from './machine-team.service.js';
import {
  buildMachineFilterClauses,
  buildMachineInsertParams,
  buildMachineUpdateFields,
  hasContent,
  mapDbMachineToApi,
} from './machines.helpers.js';
import type {
  DbMachineRow,
  MachineCategory,
  MachineCreateRequest,
  MachineFilters,
  MachineResponse,
  MachineStatistics,
  MachineTeamResponse,
  MachineUpdateRequest,
  MaintenanceHistoryResponse,
  MaintenanceRecordRequest,
} from './machines.types.js';

@Injectable()
export class MachinesService {
  private readonly logger = new Logger(MachinesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
    private readonly maintenance: MachineMaintenanceService,
    private readonly teams: MachineTeamService,
  ) {}

  // ============================================================================
  // MACHINE CRUD
  // ============================================================================

  /**
   * List all machines with filters
   * Excludes soft-deleted machines (is_active = 4) by default
   */
  async listMachines(
    tenantId: number,
    filters: MachineFilters = {},
  ): Promise<MachineResponse[]> {
    this.logger.debug(`Listing machines for tenant ${tenantId}`);

    const baseSql = `
      SELECT m.*,
             d.name as department_name,
             a.name as area_name,
             u1.username as created_by_name,
             u2.username as updated_by_name,
             COALESCE(
               (SELECT json_agg(json_build_object('id', t.id, 'name', t.name))
                FROM machine_teams mt
                JOIN teams t ON mt.team_id = t.id
                WHERE mt.machine_id = m.id),
               '[]'
             ) as teams
      FROM machines m
      LEFT JOIN departments d ON m.department_id = d.id AND d.tenant_id = m.tenant_id
      LEFT JOIN areas a ON m.area_id = a.id AND a.tenant_id = m.tenant_id
      LEFT JOIN users u1 ON m.created_by = u1.id
      LEFT JOIN users u2 ON m.updated_by = u2.id
      WHERE m.tenant_id = $1 AND m.is_active != 4`;

    const { clauses, params } = buildMachineFilterClauses(filters, 2);
    const sql = `${baseSql} ${clauses} ORDER BY m.name ASC`;

    const rows = await this.db.query<DbMachineRow>(sql, [tenantId, ...params]);
    return rows.map((row: DbMachineRow) => mapDbMachineToApi(row));
  }

  /**
   * Get machine by ID
   */
  async getMachineById(id: number, tenantId: number): Promise<MachineResponse> {
    this.logger.debug(`Getting machine ${id}`);

    const row = await this.db.queryOne<DbMachineRow>(
      `
      SELECT m.*,
             d.name as department_name
      FROM machines m
      LEFT JOIN departments d ON m.department_id = d.id AND d.tenant_id = m.tenant_id
      WHERE m.id = $1 AND m.tenant_id = $2
      `,
      [id, tenantId],
    );

    if (row === null) {
      throw new NotFoundException('Machine not found');
    }

    return mapDbMachineToApi(row);
  }

  /**
   * Validate serial number uniqueness within tenant
   */
  private async validateSerialNumberUnique(
    serialNumber: string | undefined,
    tenantId: number,
    excludeId?: number,
  ): Promise<void> {
    if (!hasContent(serialNumber)) return;

    let sql = `SELECT id FROM machines WHERE tenant_id = $1 AND serial_number = $2`;
    const params: unknown[] = [tenantId, serialNumber];

    if (excludeId !== undefined) {
      sql += ' AND id != $3';
      params.push(excludeId);
    }

    const existing = await this.db.queryOne<{ id: number }>(sql, params);
    if (existing !== null) {
      throw new BadRequestException('Serial number already exists');
    }
  }

  /**
   * Create new machine
   */
  async createMachine(
    data: MachineCreateRequest,
    tenantId: number,
    userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<MachineResponse> {
    this.logger.log(`Creating machine: ${data.name}`);
    await this.validateSerialNumberUnique(data.serialNumber, tenantId);

    const machineUuid = uuidv7();
    const params = buildMachineInsertParams(
      data,
      tenantId,
      userId,
      machineUuid,
    );
    const rows = await this.db.query<{ id: number }>(
      `INSERT INTO machines (
        tenant_id, name, model, manufacturer, serial_number, asset_number,
        department_id, area_id, location, machine_type, status,
        purchase_date, installation_date, warranty_until,
        last_maintenance, next_maintenance, operating_hours,
        production_capacity, energy_consumption, manual_url,
        qr_code, notes, created_by, updated_by, uuid, uuid_created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NOW())
      RETURNING id`,
      params,
    );

    if (rows.length === 0 || rows[0] === undefined) {
      throw new InternalServerErrorException('Failed to create machine');
    }

    await this.activityLogger.logCreate(
      tenantId,
      userId,
      'machine',
      rows[0].id,
      `Maschine erstellt: ${data.name}`,
      {
        name: data.name,
        serialNumber: data.serialNumber,
        status: data.status ?? 'operational',
      },
    );

    return await this.getMachineById(rows[0].id, tenantId);
  }

  /**
   * Update machine
   */
  async updateMachine(
    id: number,
    data: MachineUpdateRequest,
    tenantId: number,
    userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<MachineResponse> {
    this.logger.log(`Updating machine ${id}`);

    const existing = await this.getMachineById(id, tenantId);
    if (
      hasContent(data.serialNumber) &&
      data.serialNumber !== existing.serialNumber
    ) {
      await this.validateSerialNumberUnique(data.serialNumber, tenantId, id);
    }

    const { fields, params, paramIndex } = buildMachineUpdateFields(
      data,
      userId,
    );
    params.push(id, tenantId);

    const sql = `
      UPDATE machines
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
    `;

    await this.db.query(sql, params);

    await this.activityLogger.logUpdate(
      tenantId,
      userId,
      'machine',
      id,
      `Maschine aktualisiert: ${existing.name}`,
      {
        name: existing.name,
        status: existing.status,
        serialNumber: existing.serialNumber,
      },
      {
        name: data.name ?? existing.name,
        status: data.status ?? existing.status,
        serialNumber: data.serialNumber ?? existing.serialNumber,
      },
    );

    return await this.getMachineById(id, tenantId);
  }

  /**
   * Delete machine
   */
  async deleteMachine(
    id: number,
    tenantId: number,
    userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<void> {
    this.logger.log(`Deleting machine ${id}`);

    const existing = await this.getMachineById(id, tenantId);

    await this.db.query(
      'DELETE FROM machines WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );

    await this.activityLogger.logDelete(
      tenantId,
      userId,
      'machine',
      id,
      `Maschine gelöscht: ${existing.name}`,
      {
        name: existing.name,
        serialNumber: existing.serialNumber,
        status: existing.status,
      },
    );
  }

  /**
   * Deactivate machine
   */
  async deactivateMachine(
    id: number,
    tenantId: number,
    _userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<void> {
    this.logger.log(`Deactivating machine ${id}`);
    await this.getMachineById(id, tenantId);
    await this.db.query(
      'UPDATE machines SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
  }

  /**
   * Activate machine
   */
  async activateMachine(
    id: number,
    tenantId: number,
    _userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<void> {
    this.logger.log(`Activating machine ${id}`);
    await this.getMachineById(id, tenantId);
    await this.db.query(
      'UPDATE machines SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
  }

  // ============================================================================
  // MAINTENANCE DELEGATION
  // ============================================================================

  /** Get maintenance history for a machine */
  async getMaintenanceHistory(
    machineId: number,
    tenantId: number,
  ): Promise<MaintenanceHistoryResponse[]> {
    await this.getMachineById(machineId, tenantId);
    return await this.maintenance.getMaintenanceHistory(machineId, tenantId);
  }

  /** Add maintenance record */
  async addMaintenanceRecord(
    data: MaintenanceRecordRequest,
    tenantId: number,
    userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<MaintenanceHistoryResponse> {
    await this.getMachineById(data.machineId, tenantId);
    return await this.maintenance.addMaintenanceRecord(data, tenantId, userId);
  }

  /** Get upcoming maintenance */
  async getUpcomingMaintenance(
    tenantId: number,
    days?: number,
  ): Promise<MachineResponse[]> {
    return await this.maintenance.getUpcomingMaintenance(tenantId, days);
  }

  /** Get machine statistics */
  async getStatistics(tenantId: number): Promise<MachineStatistics> {
    return await this.maintenance.getStatistics(tenantId);
  }

  /** Get machine categories */
  async getCategories(): Promise<MachineCategory[]> {
    return await this.maintenance.getCategories();
  }

  // ============================================================================
  // TEAM DELEGATION
  // ============================================================================

  /** Get teams assigned to a machine */
  async getMachineTeams(
    machineId: number,
    tenantId: number,
  ): Promise<MachineTeamResponse[]> {
    await this.getMachineById(machineId, tenantId);
    return await this.teams.getMachineTeams(machineId, tenantId);
  }

  /** Set teams for a machine */
  async setMachineTeams(
    machineId: number,
    teamIds: number[],
    tenantId: number,
    userId: number,
  ): Promise<MachineTeamResponse[]> {
    await this.getMachineById(machineId, tenantId);
    return await this.teams.setMachineTeams(
      machineId,
      teamIds,
      tenantId,
      userId,
    );
  }

  // ============================================================================
  // UUID-BASED METHODS (P1 Migration)
  // ============================================================================

  /**
   * Resolve machine UUID to internal ID
   */
  private async resolveMachineIdByUuid(
    uuid: string,
    tenantId: number,
  ): Promise<number> {
    const result = await this.db.query<{ id: number }>(
      `SELECT id FROM machines WHERE uuid = $1 AND tenant_id = $2`,
      [uuid, tenantId],
    );
    if (result[0] === undefined) {
      throw new NotFoundException(`Machine with UUID ${uuid} not found`);
    }
    return result[0].id;
  }

  /** Get machine by UUID */
  async getMachineByUuid(
    uuid: string,
    tenantId: number,
  ): Promise<MachineResponse> {
    const machineId = await this.resolveMachineIdByUuid(uuid, tenantId);
    return await this.getMachineById(machineId, tenantId);
  }

  /** Update machine by UUID */
  async updateMachineByUuid(
    uuid: string,
    data: MachineUpdateRequest,
    tenantId: number,
    userId: number,
  ): Promise<MachineResponse> {
    const machineId = await this.resolveMachineIdByUuid(uuid, tenantId);
    return await this.updateMachine(machineId, data, tenantId, userId);
  }

  /** Delete machine by UUID */
  async deleteMachineByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
  ): Promise<void> {
    const machineId = await this.resolveMachineIdByUuid(uuid, tenantId);
    await this.deleteMachine(machineId, tenantId, userId);
  }

  /** Deactivate machine by UUID */
  async deactivateMachineByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
  ): Promise<void> {
    const machineId = await this.resolveMachineIdByUuid(uuid, tenantId);
    await this.deactivateMachine(machineId, tenantId, userId);
  }

  /** Activate machine by UUID */
  async activateMachineByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
  ): Promise<void> {
    const machineId = await this.resolveMachineIdByUuid(uuid, tenantId);
    await this.activateMachine(machineId, tenantId, userId);
  }
}
