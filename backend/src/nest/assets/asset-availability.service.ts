/**
 * Asset Availability Service
 *
 * Business logic for asset availability management:
 * - Get current/planned availability for assets
 * - Create availability entries (maintenance windows, repair periods)
 * - Availability history tracking with year/month filters
 * - CRUD for availability entries
 *
 * Mirrors UserAvailabilityService pattern for consistency.
 * Works with asset_availability table.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { UpdateAssetAvailabilityEntryDto } from './dto/update-asset-availability-entry.dto.js';
import type { UpdateAssetAvailabilityDto } from './dto/update-asset-availability.dto.js';

/**
 * Error message constants
 */
const ERROR_MESSAGES = {
  MACHINE_NOT_FOUND: 'Asset not found',
  ENTRY_NOT_FOUND: 'Asset availability entry not found',
} as const;

/**
 * Asset availability row from asset_availability table
 * Used for current/planned availability display
 */
export interface AssetAvailabilityRow {
  asset_id: number;
  status: string;
  start_date: Date | null;
  end_date: Date | null;
  notes: string | null;
}

/**
 * Asset availability history row from database
 */
interface AvailabilityRow {
  id: number;
  asset_id: number;
  status: string;
  start_date: Date | null;
  end_date: Date | null;
  reason: string | null;
  notes: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: Date | null;
  updated_at: Date | null;
}

/**
 * Asset availability history entry - API format (camelCase)
 */
export interface AssetAvailabilityHistoryEntry {
  id: number;
  assetId: number;
  status: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  notes: string | null;
  createdBy: number | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Asset availability history response
 */
export interface AssetAvailabilityHistoryResult {
  asset: {
    id: number;
    uuid: string;
    name: string;
  };
  entries: AssetAvailabilityHistoryEntry[];
  meta: { total: number; year: number | null; month: number | null };
}

/**
 * Asset availability fields for response augmentation
 */
export interface AssetAvailabilityFields {
  availabilityStatus: string | null;
  availabilityStart: string | null;
  availabilityEnd: string | null;
  availabilityNotes: string | null;
}

@Injectable()
export class AssetAvailabilityService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ============================================
  // Public Methods - Single Asset Availability
  // ============================================

  /**
   * Get availability for a single asset
   * Returns the "next relevant" entry:
   * - Priority 1: Entry where start_date \<= TODAY AND end_date \>= TODAY (current active)
   * - Priority 2: Entry where start_date \> TODAY (next future, earliest first)
   */
  async getAssetAvailability(
    assetId: number,
    tenantId: number,
  ): Promise<AssetAvailabilityRow | null> {
    const rows = await this.databaseService.query<AssetAvailabilityRow>(
      `SELECT
         asset_id,
         status,
         start_date,
         end_date,
         notes
       FROM asset_availability
       WHERE asset_id = $1
         AND tenant_id = $2
         AND (end_date >= CURRENT_DATE OR end_date IS NULL)
       ORDER BY
         CASE WHEN start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE THEN 0 ELSE 1 END,
         start_date ASC
       LIMIT 1`,
      [assetId, tenantId],
    );

    return rows[0] ?? null;
  }

  /**
   * Get availability for multiple assets (batch query for efficiency)
   * Returns the "next relevant" entry for each asset using DISTINCT ON
   */
  async getAssetAvailabilityBatch(
    assetIds: number[],
    tenantId: number,
  ): Promise<Map<number, AssetAvailabilityRow>> {
    if (assetIds.length === 0) {
      return new Map();
    }

    const placeholders = assetIds
      .map((_: number, i: number) => `$${i + 2}`)
      .join(', ');

    const rows = await this.databaseService.query<AssetAvailabilityRow>(
      `SELECT DISTINCT ON (asset_id)
         asset_id,
         status,
         start_date,
         end_date,
         notes
       FROM asset_availability
       WHERE asset_id IN (${placeholders})
         AND tenant_id = $1
         AND (end_date >= CURRENT_DATE OR end_date IS NULL)
       ORDER BY asset_id,
         CASE WHEN start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE THEN 0 ELSE 1 END,
         start_date ASC`,
      [tenantId, ...assetIds],
    );

    const availabilityByAsset = new Map<number, AssetAvailabilityRow>();
    for (const row of rows) {
      availabilityByAsset.set(row.asset_id, row);
    }

    return availabilityByAsset;
  }

  /**
   * Add availability info to a response object
   */
  addAvailabilityInfo(
    response: AssetAvailabilityFields,
    availability: AssetAvailabilityRow | undefined,
  ): void {
    if (availability === undefined) {
      response.availabilityStatus = 'operational';
      response.availabilityStart = null;
      response.availabilityEnd = null;
      response.availabilityNotes = null;
      return;
    }

    response.availabilityStatus = availability.status;
    response.availabilityStart =
      availability.start_date?.toISOString().split('T')[0] ?? null;
    response.availabilityEnd =
      availability.end_date?.toISOString().split('T')[0] ?? null;
    response.availabilityNotes = availability.notes;
  }

  // ============================================
  // Public Methods - Date Range Query (for shift planning)
  // ============================================

  /**
   * Get all availability entries for a asset that overlap with a date range.
   * Used by shift planning to visually mark cells where a asset is unavailable.
   *
   * Overlap condition: entry.start_date before/on rangeEnd AND entry.end_date on/after rangeStart
   */
  async getAssetAvailabilityForDateRange(
    assetId: number,
    tenantId: number,
    startDate: string,
    endDate: string,
  ): Promise<AssetAvailabilityHistoryEntry[]> {
    const rows = await this.databaseService.query<AvailabilityRow>(
      `SELECT ma.id, ma.asset_id, ma.status, ma.start_date, ma.end_date,
              ma.reason, ma.notes, ma.created_by,
              CONCAT(u.first_name, ' ', u.last_name) AS created_by_name,
              ma.created_at, ma.updated_at
       FROM asset_availability ma
       LEFT JOIN users u ON ma.created_by = u.id
       WHERE ma.asset_id = $1
         AND ma.tenant_id = $2
         AND ma.start_date <= $4::date
         AND ma.end_date >= $3::date
       ORDER BY ma.start_date ASC`,
      [assetId, tenantId, startDate, endDate],
    );

    return rows.map((row: AvailabilityRow) =>
      this.mapAvailabilityRowToEntry(row),
    );
  }

  // ============================================
  // Public Methods - Update Availability
  // ============================================

  /**
   * Create a new asset availability entry
   * Validates asset exists, dates are valid, and no overlapping ranges
   */
  async updateAvailability(
    assetId: number,
    dto: UpdateAssetAvailabilityDto,
    tenantId: number,
    createdBy?: number,
  ): Promise<{ message: string }> {
    const exists = await this.assetExists(assetId, tenantId);
    if (!exists) {
      throw new NotFoundException(ERROR_MESSAGES.MACHINE_NOT_FOUND);
    }

    this.validateAvailabilityDates(dto);

    if (
      dto.availabilityStart !== undefined &&
      dto.availabilityEnd !== undefined
    ) {
      await this.insertAvailabilityRecord(assetId, tenantId, dto, createdBy);
    }

    return { message: 'Asset availability updated successfully' };
  }

  /**
   * Create a new asset availability entry by UUID
   */
  async updateAvailabilityByUuid(
    uuid: string,
    dto: UpdateAssetAvailabilityDto,
    tenantId: number,
    createdBy?: number,
  ): Promise<{ message: string }> {
    const assetId = await this.resolveAssetIdByUuid(uuid, tenantId);
    return await this.updateAvailability(assetId, dto, tenantId, createdBy);
  }

  // ============================================
  // Public Methods - History
  // ============================================

  /**
   * Get availability history for a asset by UUID
   */
  async getAvailabilityHistoryByUuid(
    uuid: string,
    tenantId: number,
    year?: number,
    month?: number,
  ): Promise<AssetAvailabilityHistoryResult> {
    const assetRow = await this.findAssetBasicInfoByUuid(uuid, tenantId);

    const { query, params } = this.buildAvailabilityHistoryQuery(
      assetRow.id,
      tenantId,
      year,
      month,
    );
    const rows = await this.databaseService.query<AvailabilityRow>(
      query,
      params,
    );

    const entries = rows.map((row: AvailabilityRow) =>
      this.mapAvailabilityRowToEntry(row),
    );

    return {
      asset: {
        id: assetRow.id,
        uuid: assetRow.uuid,
        name: assetRow.name,
      },
      entries,
      meta: { total: entries.length, year: year ?? null, month: month ?? null },
    };
  }

  // ============================================
  // Availability Entry CRUD (for history table)
  // ============================================

  /**
   * Update an availability history entry
   * Business rule: Only entries with endDate on or after today can be edited
   */
  async updateAvailabilityEntry(
    entryId: number,
    dto: UpdateAssetAvailabilityEntryDto,
    tenantId: number,
    actingUserId: number,
  ): Promise<{ message: string }> {
    const entry = await this.findAvailabilityEntryById(entryId, tenantId);
    if (entry === null) {
      throw new NotFoundException(ERROR_MESSAGES.ENTRY_NOT_FOUND);
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const entryEndDate =
      entry.end_date !== null ? new Date(entry.end_date) : null;
    if (entryEndDate !== null) {
      entryEndDate.setUTCHours(0, 0, 0, 0);
      if (entryEndDate < today) {
        throw new BadRequestException(
          'Cannot edit past asset availability entries',
        );
      }
    }

    const oldValues = {
      status: entry.status,
      startDate: entry.start_date?.toISOString().split('T')[0] ?? null,
      endDate: entry.end_date?.toISOString().split('T')[0] ?? null,
      reason: entry.reason,
      notes: entry.notes,
    };

    await this.databaseService.query(
      `UPDATE asset_availability
       SET status = $1, start_date = $2, end_date = $3, reason = $4, notes = $5, updated_at = NOW()
       WHERE id = $6 AND tenant_id = $7`,
      [
        dto.status,
        dto.startDate,
        dto.endDate,
        dto.reason ?? null,
        dto.notes ?? null,
        entryId,
        tenantId,
      ],
    );

    await this.activityLogger.logUpdate(
      tenantId,
      actingUserId,
      'asset_availability',
      entryId,
      `Anlagenverfügbarkeit aktualisiert: ${dto.status} (${dto.startDate} - ${dto.endDate})`,
      oldValues,
      {
        status: dto.status,
        startDate: dto.startDate,
        endDate: dto.endDate,
        reason: dto.reason ?? null,
        notes: dto.notes ?? null,
      },
    );

    return { message: 'Asset availability entry updated successfully' };
  }

  /**
   * Delete an availability history entry
   */
  async deleteAvailabilityEntry(
    entryId: number,
    tenantId: number,
    actingUserId: number,
  ): Promise<{ message: string }> {
    const entry = await this.findAvailabilityEntryById(entryId, tenantId);
    if (entry === null) {
      throw new NotFoundException(ERROR_MESSAGES.ENTRY_NOT_FOUND);
    }

    const deletedValues = {
      status: entry.status,
      startDate: entry.start_date?.toISOString().split('T')[0] ?? null,
      endDate: entry.end_date?.toISOString().split('T')[0] ?? null,
      reason: entry.reason,
      notes: entry.notes,
      assetId: entry.asset_id,
    };

    await this.databaseService.query(
      `DELETE FROM asset_availability WHERE id = $1 AND tenant_id = $2`,
      [entryId, tenantId],
    );

    await this.activityLogger.logDelete(
      tenantId,
      actingUserId,
      'asset_availability',
      entryId,
      `Anlagenverfügbarkeit gelöscht: ${entry.status} (${entry.start_date?.toISOString().split('T')[0] ?? ''} - ${entry.end_date?.toISOString().split('T')[0] ?? ''})`,
      deletedValues,
    );

    return { message: 'Asset availability entry deleted successfully' };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /** Check if asset exists and is active */
  private async assetExists(
    assetId: number,
    tenantId: number,
  ): Promise<boolean> {
    const rows = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM assets WHERE id = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [assetId, tenantId],
    );
    return rows.length > 0;
  }

  /** Resolve asset ID from UUID */
  private async resolveAssetIdByUuid(
    uuid: string,
    tenantId: number,
  ): Promise<number> {
    const rows = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM assets WHERE uuid = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [uuid, tenantId],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new NotFoundException(ERROR_MESSAGES.MACHINE_NOT_FOUND);
    }
    return row.id;
  }

  /** Find asset basic info by UUID */
  private async findAssetBasicInfoByUuid(
    uuid: string,
    tenantId: number,
  ): Promise<{ id: number; uuid: string; name: string }> {
    const rows = await this.databaseService.query<{
      id: number;
      uuid: string;
      name: string;
    }>(
      `SELECT id, uuid, name FROM assets WHERE uuid = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [uuid, tenantId],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new NotFoundException(ERROR_MESSAGES.MACHINE_NOT_FOUND);
    }
    return row;
  }

  /** Validate availability date requirements */
  private validateAvailabilityDates(dto: UpdateAssetAvailabilityDto): void {
    if (
      dto.availabilityStatus !== 'operational' &&
      (dto.availabilityStart === undefined || dto.availabilityEnd === undefined)
    ) {
      throw new BadRequestException(
        'Start- und Enddatum sind für nicht-betriebsbereite Status erforderlich',
      );
    }

    if (
      dto.availabilityStart !== undefined &&
      dto.availabilityEnd !== undefined &&
      dto.availabilityEnd < dto.availabilityStart
    ) {
      throw new BadRequestException(
        'Bis-Datum muss nach oder gleich Von-Datum sein.',
      );
    }
  }

  /** Check for overlapping ranges and insert availability record */
  private async insertAvailabilityRecord(
    assetId: number,
    tenantId: number,
    dto: UpdateAssetAvailabilityDto,
    createdBy?: number,
  ): Promise<void> {
    const overlapping = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM asset_availability
       WHERE asset_id = $1
         AND tenant_id = $2
         AND start_date <= $4::date
         AND end_date >= $3::date`,
      [assetId, tenantId, dto.availabilityStart, dto.availabilityEnd],
    );

    if (overlapping.length > 0) {
      throw new ConflictException(
        'Zeitraum bereits vergeben. Bitte in der Verlauf-Seite aktualisieren.',
      );
    }

    await this.databaseService.query(
      `INSERT INTO asset_availability
        (asset_id, tenant_id, status, start_date, end_date, reason, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        assetId,
        tenantId,
        dto.availabilityStatus,
        dto.availabilityStart,
        dto.availabilityEnd,
        dto.availabilityReason ?? null,
        dto.availabilityNotes ?? null,
        createdBy ?? null,
      ],
    );
  }

  /** Build availability history query with optional year/month filters */
  private buildAvailabilityHistoryQuery(
    assetId: number,
    tenantId: number,
    year?: number,
    month?: number,
  ): { query: string; params: (number | string)[] } {
    const params: (number | string)[] = [assetId, tenantId];
    let paramIndex = 3;

    let query = `
      SELECT ma.id, ma.asset_id, ma.status, ma.start_date, ma.end_date,
             ma.reason, ma.notes, ma.created_by,
             CONCAT(u.first_name, ' ', u.last_name) AS created_by_name,
             ma.created_at, ma.updated_at
      FROM asset_availability ma
      LEFT JOIN users u ON ma.created_by = u.id
      WHERE ma.asset_id = $1 AND ma.tenant_id = $2`;

    if (year !== undefined) {
      query += ` AND (EXTRACT(YEAR FROM ma.start_date) = $${paramIndex}
                 OR EXTRACT(YEAR FROM ma.end_date) = $${paramIndex})`;
      params.push(year);
      paramIndex++;
    }

    if (month !== undefined) {
      query += ` AND (EXTRACT(MONTH FROM ma.start_date) = $${paramIndex}
                 OR EXTRACT(MONTH FROM ma.end_date) = $${paramIndex})`;
      params.push(month);
    }

    query += ` ORDER BY ma.start_date DESC`;

    return { query, params };
  }

  /** Map availability row to API format entry */
  private mapAvailabilityRowToEntry(
    row: AvailabilityRow,
  ): AssetAvailabilityHistoryEntry {
    return {
      id: row.id,
      assetId: row.asset_id,
      status: row.status,
      startDate: row.start_date?.toISOString().split('T')[0] ?? '',
      endDate: row.end_date?.toISOString().split('T')[0] ?? '',
      reason: row.reason,
      notes: row.notes,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at?.toISOString() ?? '',
      updatedAt: row.updated_at?.toISOString() ?? '',
    };
  }

  /**
   * Create a maintenance availability entry from a TPM plan.
   * Called when a TPM maintenance event is scheduled — sets asset
   * status to 'maintenance' for the planned time window.
   */
  async createFromTpmPlan(
    tenantId: number,
    assetId: number,
    startDate: string,
    endDate: string,
    reason: string,
    userId: number,
  ): Promise<void> {
    await this.databaseService.query(
      `INSERT INTO asset_availability
         (tenant_id, asset_id, status, start_date, end_date, reason, created_by)
       VALUES ($1, $2, 'maintenance', $3, $4, $5, $6)`,
      [tenantId, assetId, startDate, endDate, reason, userId],
    );
  }

  /** Find availability entry by ID and tenant */
  private async findAvailabilityEntryById(
    entryId: number,
    tenantId: number,
  ): Promise<AvailabilityRow | null> {
    const rows = await this.databaseService.query<AvailabilityRow>(
      `SELECT id, asset_id, status, start_date, end_date, reason, notes,
              created_by, created_at, updated_at
       FROM asset_availability
       WHERE id = $1 AND tenant_id = $2`,
      [entryId, tenantId],
    );
    return rows[0] ?? null;
  }
}
