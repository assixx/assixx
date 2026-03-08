/**
 * Assets Service — Facade
 *
 * Orchestrates asset CRUD operations and delegates to sub-services:
 * - AssetMaintenanceService — maintenance history, statistics, categories
 * - AssetTeamService — asset-team associations
 *
 * Pure helper functions are in assets.helpers.ts
 * Types are in assets.types.ts
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
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
import { AssetMaintenanceService } from './asset-maintenance.service.js';
import { AssetTeamService } from './asset-team.service.js';
import {
  buildAssetFilterClauses,
  buildAssetInsertParams,
  buildAssetUpdateFields,
  hasContent,
  mapDbAssetToApi,
} from './assets.helpers.js';
import type {
  AssetCategory,
  AssetCreateRequest,
  AssetFilters,
  AssetResponse,
  AssetStatistics,
  AssetTeamResponse,
  AssetUpdateRequest,
  DbAssetRow,
  MaintenanceHistoryResponse,
  MaintenanceRecordRequest,
} from './assets.types.js';

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
    private readonly maintenance: AssetMaintenanceService,
    private readonly teams: AssetTeamService,
  ) {}

  // ============================================================================
  // MACHINE CRUD
  // ============================================================================

  /**
   * List all assets with filters
   * Excludes soft-deleted assets (is_active = 4) by default
   */
  async listAssets(
    tenantId: number,
    filters: AssetFilters = {},
  ): Promise<AssetResponse[]> {
    this.logger.debug(`Listing assets for tenant ${tenantId}`);

    const baseSql = `
      SELECT m.*,
             d.name as department_name,
             a.name as area_name,
             u1.username as created_by_name,
             u2.username as updated_by_name,
             COALESCE(
               (SELECT json_agg(json_build_object('id', t.id, 'name', t.name))
                FROM asset_teams mt
                JOIN teams t ON mt.team_id = t.id
                WHERE mt.asset_id = m.id),
               '[]'
             ) as teams
      FROM assets m
      LEFT JOIN departments d ON m.department_id = d.id AND d.tenant_id = m.tenant_id
      LEFT JOIN areas a ON m.area_id = a.id AND a.tenant_id = m.tenant_id
      LEFT JOIN users u1 ON m.created_by = u1.id
      LEFT JOIN users u2 ON m.updated_by = u2.id
      WHERE m.tenant_id = $1 AND m.is_active != ${IS_ACTIVE.DELETED}`;

    const { clauses, params } = buildAssetFilterClauses(filters, 2);
    const sql = `${baseSql} ${clauses} ORDER BY m.name ASC`;

    const rows = await this.db.query<DbAssetRow>(sql, [tenantId, ...params]);
    return rows.map((row: DbAssetRow) => mapDbAssetToApi(row));
  }

  /**
   * Get asset by ID
   */
  async getAssetById(id: number, tenantId: number): Promise<AssetResponse> {
    this.logger.debug(`Getting asset ${id}`);

    const row = await this.db.queryOne<DbAssetRow>(
      `
      SELECT m.*,
             d.name as department_name
      FROM assets m
      LEFT JOIN departments d ON m.department_id = d.id AND d.tenant_id = m.tenant_id
      WHERE m.id = $1 AND m.tenant_id = $2
      `,
      [id, tenantId],
    );

    if (row === null) {
      throw new NotFoundException('Asset not found');
    }

    return mapDbAssetToApi(row);
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

    let sql = `SELECT id FROM assets WHERE tenant_id = $1 AND serial_number = $2`;
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
   * Create new asset
   */
  async createAsset(
    data: AssetCreateRequest,
    tenantId: number,
    userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<AssetResponse> {
    this.logger.log(`Creating asset: ${data.name}`);
    await this.validateSerialNumberUnique(data.serialNumber, tenantId);

    const assetUuid = uuidv7();
    const params = buildAssetInsertParams(data, tenantId, userId, assetUuid);
    const rows = await this.db.query<{ id: number }>(
      `INSERT INTO assets (
        tenant_id, name, model, manufacturer, serial_number, asset_number,
        department_id, area_id, location, asset_type, status,
        purchase_date, installation_date, warranty_until,
        last_maintenance, next_maintenance, operating_hours,
        production_capacity, energy_consumption, manual_url,
        qr_code, notes, created_by, updated_by, uuid, uuid_created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NOW())
      RETURNING id`,
      params,
    );

    if (rows.length === 0 || rows[0] === undefined) {
      throw new InternalServerErrorException('Failed to create asset');
    }

    await this.activityLogger.logCreate(
      tenantId,
      userId,
      'asset',
      rows[0].id,
      `Anlage erstellt: ${data.name}`,
      {
        name: data.name,
        serialNumber: data.serialNumber,
        status: data.status ?? 'operational',
      },
    );

    return await this.getAssetById(rows[0].id, tenantId);
  }

  /**
   * Update asset
   */
  async updateAsset(
    id: number,
    data: AssetUpdateRequest,
    tenantId: number,
    userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<AssetResponse> {
    this.logger.log(`Updating asset ${id}`);

    const existing = await this.getAssetById(id, tenantId);
    if (
      hasContent(data.serialNumber) &&
      data.serialNumber !== existing.serialNumber
    ) {
      await this.validateSerialNumberUnique(data.serialNumber, tenantId, id);
    }

    const { fields, params, paramIndex } = buildAssetUpdateFields(data, userId);
    params.push(id, tenantId);

    const sql = `
      UPDATE assets
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
    `;

    await this.db.query(sql, params);

    await this.activityLogger.logUpdate(
      tenantId,
      userId,
      'asset',
      id,
      `Anlage aktualisiert: ${existing.name}`,
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

    return await this.getAssetById(id, tenantId);
  }

  /**
   * Delete asset
   */
  async deleteAsset(
    id: number,
    tenantId: number,
    userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<void> {
    this.logger.log(`Deleting asset ${id}`);

    const existing = await this.getAssetById(id, tenantId);

    await this.db.query('DELETE FROM assets WHERE id = $1 AND tenant_id = $2', [
      id,
      tenantId,
    ]);

    await this.activityLogger.logDelete(
      tenantId,
      userId,
      'asset',
      id,
      `Anlage gelöscht: ${existing.name}`,
      {
        name: existing.name,
        serialNumber: existing.serialNumber,
        status: existing.status,
      },
    );
  }

  /**
   * Deactivate asset
   */
  async deactivateAsset(
    id: number,
    tenantId: number,
    _userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<void> {
    this.logger.log(`Deactivating asset ${id}`);
    await this.getAssetById(id, tenantId);
    await this.db.query(
      `UPDATE assets SET is_active = ${IS_ACTIVE.INACTIVE}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
  }

  /**
   * Activate asset
   */
  async activateAsset(
    id: number,
    tenantId: number,
    _userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<void> {
    this.logger.log(`Activating asset ${id}`);
    await this.getAssetById(id, tenantId);
    await this.db.query(
      `UPDATE assets SET is_active = ${IS_ACTIVE.ACTIVE}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
  }

  // ============================================================================
  // MAINTENANCE DELEGATION
  // ============================================================================

  /** Get maintenance history for a asset */
  async getMaintenanceHistory(
    assetId: number,
    tenantId: number,
  ): Promise<MaintenanceHistoryResponse[]> {
    await this.getAssetById(assetId, tenantId);
    return await this.maintenance.getMaintenanceHistory(assetId, tenantId);
  }

  /** Add maintenance record */
  async addMaintenanceRecord(
    data: MaintenanceRecordRequest,
    tenantId: number,
    userId: number,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<MaintenanceHistoryResponse> {
    await this.getAssetById(data.assetId, tenantId);
    return await this.maintenance.addMaintenanceRecord(data, tenantId, userId);
  }

  /** Get upcoming maintenance */
  async getUpcomingMaintenance(
    tenantId: number,
    days?: number,
  ): Promise<AssetResponse[]> {
    return await this.maintenance.getUpcomingMaintenance(tenantId, days);
  }

  /** Get asset statistics */
  async getStatistics(tenantId: number): Promise<AssetStatistics> {
    return await this.maintenance.getStatistics(tenantId);
  }

  /** Get asset categories */
  async getCategories(): Promise<AssetCategory[]> {
    return await this.maintenance.getCategories();
  }

  // ============================================================================
  // TEAM DELEGATION
  // ============================================================================

  /** Get teams assigned to a asset */
  async getAssetTeams(
    assetId: number,
    tenantId: number,
  ): Promise<AssetTeamResponse[]> {
    await this.getAssetById(assetId, tenantId);
    return await this.teams.getAssetTeams(assetId, tenantId);
  }

  /** Set teams for a asset */
  async setAssetTeams(
    assetId: number,
    teamIds: number[],
    tenantId: number,
    userId: number,
  ): Promise<AssetTeamResponse[]> {
    await this.getAssetById(assetId, tenantId);
    return await this.teams.setAssetTeams(assetId, teamIds, tenantId, userId);
  }

  // ============================================================================
  // UUID-BASED METHODS (P1 Migration)
  // ============================================================================

  /**
   * Resolve asset UUID to internal ID
   */
  private async resolveAssetIdByUuid(
    uuid: string,
    tenantId: number,
  ): Promise<number> {
    const result = await this.db.query<{ id: number }>(
      `SELECT id FROM assets WHERE uuid = $1 AND tenant_id = $2`,
      [uuid, tenantId],
    );
    if (result[0] === undefined) {
      throw new NotFoundException(`Asset with UUID ${uuid} not found`);
    }
    return result[0].id;
  }

  /** Get asset by UUID */
  async getAssetByUuid(uuid: string, tenantId: number): Promise<AssetResponse> {
    const assetId = await this.resolveAssetIdByUuid(uuid, tenantId);
    return await this.getAssetById(assetId, tenantId);
  }

  /** Update asset by UUID */
  async updateAssetByUuid(
    uuid: string,
    data: AssetUpdateRequest,
    tenantId: number,
    userId: number,
  ): Promise<AssetResponse> {
    const assetId = await this.resolveAssetIdByUuid(uuid, tenantId);
    return await this.updateAsset(assetId, data, tenantId, userId);
  }

  /** Delete asset by UUID */
  async deleteAssetByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
  ): Promise<void> {
    const assetId = await this.resolveAssetIdByUuid(uuid, tenantId);
    await this.deleteAsset(assetId, tenantId, userId);
  }

  /** Deactivate asset by UUID */
  async deactivateAssetByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
  ): Promise<void> {
    const assetId = await this.resolveAssetIdByUuid(uuid, tenantId);
    await this.deactivateAsset(assetId, tenantId, userId);
  }

  /** Activate asset by UUID */
  async activateAssetByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
  ): Promise<void> {
    const assetId = await this.resolveAssetIdByUuid(uuid, tenantId);
    await this.activateAsset(assetId, tenantId, userId);
  }
}
