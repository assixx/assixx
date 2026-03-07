/**
 * Asset Maintenance Service
 *
 * Sub-service handling maintenance history, statistics, and categories.
 * Operates on asset_maintenance_history and asset_categories tables.
 *
 * Called exclusively through the AssetsService facade.
 * Caller is responsible for validating asset existence before calling.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import {
  buildMaintenanceInsertParams,
  hasContent,
  mapDbAssetToApi,
  mapMaintenanceToApi,
  parseIntOrZero,
} from './assets.helpers.js';
import type {
  AssetCategory,
  AssetResponse,
  AssetStatistics,
  AssetStatus,
  DbAssetRow,
  DbCategoryRow,
  DbMaintenanceRow,
  DbStatisticsRow,
  MaintenanceHistoryResponse,
  MaintenanceRecordRequest,
  StatusAfter,
} from './assets.types.js';

@Injectable()
export class AssetMaintenanceService {
  private readonly logger = new Logger(AssetMaintenanceService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  /**
   * Get maintenance history for a asset
   */
  async getMaintenanceHistory(
    assetId: number,
    tenantId: number,
  ): Promise<MaintenanceHistoryResponse[]> {
    this.logger.debug(`Getting maintenance history for asset ${assetId}`);

    const rows = await this.db.query<DbMaintenanceRow>(
      `
      SELECT mh.*,
             u1.username as performed_by_name,
             u2.username as created_by_name
      FROM asset_maintenance_history mh
      LEFT JOIN users u1 ON mh.performed_by = u1.id
      LEFT JOIN users u2 ON mh.created_by = u2.id
      WHERE mh.asset_id = $1 AND mh.tenant_id = $2
      ORDER BY mh.performed_date DESC
      `,
      [assetId, tenantId],
    );

    return rows.map((row: DbMaintenanceRow) => mapMaintenanceToApi(row));
  }

  /**
   * Update asset status and dates after maintenance record is added
   */
  private async updateAssetAfterMaintenance(
    assetId: number,
    tenantId: number,
    performedDate: string,
    nextMaintenanceDate: string | undefined,
    statusAfter: StatusAfter,
  ): Promise<void> {
    const assetStatus: AssetStatus =
      statusAfter === 'needs_repair' ? 'repair' : 'operational';
    const nextDate =
      hasContent(nextMaintenanceDate) ? new Date(nextMaintenanceDate) : null;

    await this.db.query(
      `UPDATE assets SET last_maintenance = $1, next_maintenance = $2, status = $3,
       updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND tenant_id = $5`,
      [new Date(performedDate), nextDate, assetStatus, assetId, tenantId],
    );
  }

  /**
   * Add maintenance record and update asset status
   */
  async addMaintenanceRecord(
    data: MaintenanceRecordRequest,
    tenantId: number,
    userId: number,
  ): Promise<MaintenanceHistoryResponse> {
    this.logger.log(`Adding maintenance record for asset ${data.assetId}`);

    const rows = await this.db.query<{ id: number }>(
      `INSERT INTO asset_maintenance_history (
        tenant_id, asset_id, maintenance_type, performed_date, performed_by,
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
    await this.updateAssetAfterMaintenance(
      data.assetId,
      tenantId,
      data.performedDate,
      data.nextMaintenanceDate,
      statusAfter,
    );

    void this.activityLogger.logCreate(
      tenantId,
      userId,
      'asset_maintenance',
      data.assetId,
      `Wartungseintrag erstellt: Anlage ${String(data.assetId)}, Typ ${data.maintenanceType}`,
      {
        assetId: data.assetId,
        maintenanceType: data.maintenanceType,
        recordId,
      },
    );

    const history = await this.getMaintenanceHistory(data.assetId, tenantId);
    const record = history.find(
      (h: MaintenanceHistoryResponse) => h.id === recordId,
    );
    if (record === undefined) {
      throw new NotFoundException('Maintenance record not found');
    }
    return record;
  }

  /**
   * Get assets with upcoming maintenance within given days
   */
  async getUpcomingMaintenance(
    tenantId: number,
    days: number = 30,
  ): Promise<AssetResponse[]> {
    this.logger.debug(`Getting upcoming maintenance for tenant ${tenantId}`);

    const rows = await this.db.query<DbAssetRow>(
      `
      SELECT m.*, d.name as department_name
      FROM assets m
      LEFT JOIN departments d ON m.department_id = d.id AND d.tenant_id = m.tenant_id
      WHERE m.tenant_id = $1
        AND m.is_active = ${IS_ACTIVE.ACTIVE}
        AND m.next_maintenance <= CURRENT_DATE + ($2 * INTERVAL '1 day')
        AND m.status != 'decommissioned'
      ORDER BY m.next_maintenance ASC
      `,
      [tenantId, days],
    );

    return rows.map((row: DbAssetRow) => mapDbAssetToApi(row));
  }

  /**
   * Get asset statistics (counts by status)
   */
  async getStatistics(tenantId: number): Promise<AssetStatistics> {
    this.logger.debug(`Getting asset statistics for tenant ${tenantId}`);

    const row = await this.db.queryOne<DbStatisticsRow>(
      `
      SELECT
        COUNT(*) as total_assets,
        SUM(CASE WHEN status = 'operational' THEN 1 ELSE 0 END) as operational,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as in_maintenance,
        SUM(CASE WHEN status = 'repair' THEN 1 ELSE 0 END) as in_repair,
        SUM(CASE WHEN status = 'standby' THEN 1 ELSE 0 END) as standby,
        SUM(CASE WHEN status = 'decommissioned' THEN 1 ELSE 0 END) as decommissioned,
        SUM(CASE WHEN next_maintenance <= CURRENT_DATE + INTERVAL '30 days' AND status != 'decommissioned' THEN 1 ELSE 0 END) as needs_maintenance_soon
      FROM assets
      WHERE tenant_id = $1 AND is_active = ${IS_ACTIVE.ACTIVE}
      `,
      [tenantId],
    );

    if (row === null) {
      return {
        totalAssets: 0,
        operational: 0,
        inMaintenance: 0,
        inRepair: 0,
        standby: 0,
        decommissioned: 0,
        needsMaintenanceSoon: 0,
      };
    }

    return {
      totalAssets: parseIntOrZero(row.total_assets),
      operational: parseIntOrZero(row.operational),
      inMaintenance: parseIntOrZero(row.in_maintenance),
      inRepair: parseIntOrZero(row.in_repair),
      standby: parseIntOrZero(row.standby),
      decommissioned: parseIntOrZero(row.decommissioned),
      needsMaintenanceSoon: parseIntOrZero(row.needs_maintenance_soon),
    };
  }

  /**
   * Create a maintenance history record from a TPM execution.
   * Bridge: When a TPM card execution is approved (green), a
   * corresponding entry in asset_maintenance_history is created.
   */
  async createFromTpmExecution(
    tenantId: number,
    assetId: number,
    userId: number,
    description: string,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO asset_maintenance_history
         (tenant_id, asset_id, maintenance_type, performed_date,
          performed_by, description, status_after, created_by)
       VALUES ($1, $2, 'preventive', CURRENT_DATE, $3, $4, 'operational', $3)`,
      [tenantId, assetId, userId, description],
    );

    void this.activityLogger.logCreate(
      tenantId,
      userId,
      'asset_maintenance',
      assetId,
      `TPM-Wartungseintrag erstellt: Anlage ${String(assetId)}`,
      { assetId, source: 'tpm_execution' },
    );
  }

  /**
   * Get asset categories
   */
  async getCategories(): Promise<AssetCategory[]> {
    this.logger.debug('Getting asset categories');

    const rows = await this.db.query<DbCategoryRow>(
      `
      SELECT * FROM asset_categories
      WHERE is_active = ${IS_ACTIVE.ACTIVE}
      ORDER BY sort_order ASC, name ASC
      `,
    );

    return rows.map((row: DbCategoryRow) => {
      const category: AssetCategory = {
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
