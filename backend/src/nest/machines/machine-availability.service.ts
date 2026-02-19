/**
 * Machine Availability Service
 *
 * Business logic for machine availability management:
 * - Get current/planned availability for machines
 * - Create availability entries (maintenance windows, repair periods)
 * - Availability history tracking with year/month filters
 * - CRUD for availability entries
 *
 * Mirrors UserAvailabilityService pattern for consistency.
 * Works with machine_availability table.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { UpdateMachineAvailabilityEntryDto } from './dto/update-machine-availability-entry.dto.js';
import type { UpdateMachineAvailabilityDto } from './dto/update-machine-availability.dto.js';

/**
 * Error message constants
 */
const ERROR_MESSAGES = {
  MACHINE_NOT_FOUND: 'Machine not found',
  ENTRY_NOT_FOUND: 'Machine availability entry not found',
} as const;

/**
 * Machine availability row from machine_availability table
 * Used for current/planned availability display
 */
export interface MachineAvailabilityRow {
  machine_id: number;
  status: string;
  start_date: Date | null;
  end_date: Date | null;
  notes: string | null;
}

/**
 * Machine availability history row from database
 */
interface AvailabilityRow {
  id: number;
  machine_id: number;
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
 * Machine availability history entry - API format (camelCase)
 */
export interface MachineAvailabilityHistoryEntry {
  id: number;
  machineId: number;
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
 * Machine availability history response
 */
export interface MachineAvailabilityHistoryResult {
  machine: {
    id: number;
    uuid: string;
    name: string;
  };
  entries: MachineAvailabilityHistoryEntry[];
  meta: { total: number; year: number | null; month: number | null };
}

/**
 * Machine availability fields for response augmentation
 */
export interface MachineAvailabilityFields {
  availabilityStatus: string | null;
  availabilityStart: string | null;
  availabilityEnd: string | null;
  availabilityNotes: string | null;
}

@Injectable()
export class MachineAvailabilityService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ============================================
  // Public Methods - Single Machine Availability
  // ============================================

  /**
   * Get availability for a single machine
   * Returns the "next relevant" entry:
   * - Priority 1: Entry where start_date \<= TODAY AND end_date \>= TODAY (current active)
   * - Priority 2: Entry where start_date \> TODAY (next future, earliest first)
   */
  async getMachineAvailability(
    machineId: number,
    tenantId: number,
  ): Promise<MachineAvailabilityRow | null> {
    const rows = await this.databaseService.query<MachineAvailabilityRow>(
      `SELECT
         machine_id,
         status,
         start_date,
         end_date,
         notes
       FROM machine_availability
       WHERE machine_id = $1
         AND tenant_id = $2
         AND (end_date >= CURRENT_DATE OR end_date IS NULL)
       ORDER BY
         CASE WHEN start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE THEN 0 ELSE 1 END,
         start_date ASC
       LIMIT 1`,
      [machineId, tenantId],
    );

    return rows[0] ?? null;
  }

  /**
   * Get availability for multiple machines (batch query for efficiency)
   * Returns the "next relevant" entry for each machine using DISTINCT ON
   */
  async getMachineAvailabilityBatch(
    machineIds: number[],
    tenantId: number,
  ): Promise<Map<number, MachineAvailabilityRow>> {
    if (machineIds.length === 0) {
      return new Map();
    }

    const placeholders = machineIds
      .map((_: number, i: number) => `$${i + 2}`)
      .join(', ');

    const rows = await this.databaseService.query<MachineAvailabilityRow>(
      `SELECT DISTINCT ON (machine_id)
         machine_id,
         status,
         start_date,
         end_date,
         notes
       FROM machine_availability
       WHERE machine_id IN (${placeholders})
         AND tenant_id = $1
         AND (end_date >= CURRENT_DATE OR end_date IS NULL)
       ORDER BY machine_id,
         CASE WHEN start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE THEN 0 ELSE 1 END,
         start_date ASC`,
      [tenantId, ...machineIds],
    );

    const availabilityByMachine = new Map<number, MachineAvailabilityRow>();
    for (const row of rows) {
      availabilityByMachine.set(row.machine_id, row);
    }

    return availabilityByMachine;
  }

  /**
   * Add availability info to a response object
   */
  addAvailabilityInfo(
    response: MachineAvailabilityFields,
    availability: MachineAvailabilityRow | undefined,
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
   * Get all availability entries for a machine that overlap with a date range.
   * Used by shift planning to visually mark cells where a machine is unavailable.
   *
   * Overlap condition: entry.start_date before/on rangeEnd AND entry.end_date on/after rangeStart
   */
  async getMachineAvailabilityForDateRange(
    machineId: number,
    tenantId: number,
    startDate: string,
    endDate: string,
  ): Promise<MachineAvailabilityHistoryEntry[]> {
    const rows = await this.databaseService.query<AvailabilityRow>(
      `SELECT ma.id, ma.machine_id, ma.status, ma.start_date, ma.end_date,
              ma.reason, ma.notes, ma.created_by,
              CONCAT(u.first_name, ' ', u.last_name) AS created_by_name,
              ma.created_at, ma.updated_at
       FROM machine_availability ma
       LEFT JOIN users u ON ma.created_by = u.id
       WHERE ma.machine_id = $1
         AND ma.tenant_id = $2
         AND ma.start_date <= $4::date
         AND ma.end_date >= $3::date
       ORDER BY ma.start_date ASC`,
      [machineId, tenantId, startDate, endDate],
    );

    return rows.map((row: AvailabilityRow) =>
      this.mapAvailabilityRowToEntry(row),
    );
  }

  // ============================================
  // Public Methods - Update Availability
  // ============================================

  /**
   * Create a new machine availability entry
   * Validates machine exists, dates are valid, and no overlapping ranges
   */
  async updateAvailability(
    machineId: number,
    dto: UpdateMachineAvailabilityDto,
    tenantId: number,
    createdBy?: number,
  ): Promise<{ message: string }> {
    const exists = await this.machineExists(machineId, tenantId);
    if (!exists) {
      throw new NotFoundException(ERROR_MESSAGES.MACHINE_NOT_FOUND);
    }

    this.validateAvailabilityDates(dto);

    if (
      dto.availabilityStart !== undefined &&
      dto.availabilityEnd !== undefined
    ) {
      await this.insertAvailabilityRecord(machineId, tenantId, dto, createdBy);
    }

    return { message: 'Machine availability updated successfully' };
  }

  /**
   * Create a new machine availability entry by UUID
   */
  async updateAvailabilityByUuid(
    uuid: string,
    dto: UpdateMachineAvailabilityDto,
    tenantId: number,
    createdBy?: number,
  ): Promise<{ message: string }> {
    const machineId = await this.resolveMachineIdByUuid(uuid, tenantId);
    return await this.updateAvailability(machineId, dto, tenantId, createdBy);
  }

  // ============================================
  // Public Methods - History
  // ============================================

  /**
   * Get availability history for a machine by UUID
   */
  async getAvailabilityHistoryByUuid(
    uuid: string,
    tenantId: number,
    year?: number,
    month?: number,
  ): Promise<MachineAvailabilityHistoryResult> {
    const machineRow = await this.findMachineBasicInfoByUuid(uuid, tenantId);

    const { query, params } = this.buildAvailabilityHistoryQuery(
      machineRow.id,
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
      machine: {
        id: machineRow.id,
        uuid: machineRow.uuid,
        name: machineRow.name,
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
    dto: UpdateMachineAvailabilityEntryDto,
    tenantId: number,
    actingUserId: number,
  ): Promise<{ message: string }> {
    const entry = await this.findAvailabilityEntryById(entryId, tenantId);
    if (entry === null) {
      throw new NotFoundException(ERROR_MESSAGES.ENTRY_NOT_FOUND);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const entryEndDate =
      entry.end_date !== null ? new Date(entry.end_date) : null;
    if (entryEndDate !== null) {
      entryEndDate.setHours(0, 0, 0, 0);
      if (entryEndDate < today) {
        throw new BadRequestException(
          'Cannot edit past machine availability entries',
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
      `UPDATE machine_availability
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
      'machine_availability',
      entryId,
      `Maschinenverfügbarkeit aktualisiert: ${dto.status} (${dto.startDate} - ${dto.endDate})`,
      oldValues,
      {
        status: dto.status,
        startDate: dto.startDate,
        endDate: dto.endDate,
        reason: dto.reason ?? null,
        notes: dto.notes ?? null,
      },
    );

    return { message: 'Machine availability entry updated successfully' };
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
      machineId: entry.machine_id,
    };

    await this.databaseService.query(
      `DELETE FROM machine_availability WHERE id = $1 AND tenant_id = $2`,
      [entryId, tenantId],
    );

    await this.activityLogger.logDelete(
      tenantId,
      actingUserId,
      'machine_availability',
      entryId,
      `Maschinenverfügbarkeit gelöscht: ${entry.status} (${entry.start_date?.toISOString().split('T')[0] ?? ''} - ${entry.end_date?.toISOString().split('T')[0] ?? ''})`,
      deletedValues,
    );

    return { message: 'Machine availability entry deleted successfully' };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /** Check if machine exists and is active */
  private async machineExists(
    machineId: number,
    tenantId: number,
  ): Promise<boolean> {
    const rows = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM machines WHERE id = $1 AND tenant_id = $2 AND is_active = 1`,
      [machineId, tenantId],
    );
    return rows.length > 0;
  }

  /** Resolve machine ID from UUID */
  private async resolveMachineIdByUuid(
    uuid: string,
    tenantId: number,
  ): Promise<number> {
    const rows = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM machines WHERE uuid = $1 AND tenant_id = $2 AND is_active = 1`,
      [uuid, tenantId],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new NotFoundException(ERROR_MESSAGES.MACHINE_NOT_FOUND);
    }
    return row.id;
  }

  /** Find machine basic info by UUID */
  private async findMachineBasicInfoByUuid(
    uuid: string,
    tenantId: number,
  ): Promise<{ id: number; uuid: string; name: string }> {
    const rows = await this.databaseService.query<{
      id: number;
      uuid: string;
      name: string;
    }>(
      `SELECT id, uuid, name FROM machines WHERE uuid = $1 AND tenant_id = $2 AND is_active = 1`,
      [uuid, tenantId],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new NotFoundException(ERROR_MESSAGES.MACHINE_NOT_FOUND);
    }
    return row;
  }

  /** Validate availability date requirements */
  private validateAvailabilityDates(dto: UpdateMachineAvailabilityDto): void {
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
    machineId: number,
    tenantId: number,
    dto: UpdateMachineAvailabilityDto,
    createdBy?: number,
  ): Promise<void> {
    const overlapping = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM machine_availability
       WHERE machine_id = $1
         AND tenant_id = $2
         AND start_date <= $4::date
         AND end_date >= $3::date`,
      [machineId, tenantId, dto.availabilityStart, dto.availabilityEnd],
    );

    if (overlapping.length > 0) {
      throw new ConflictException(
        'Zeitraum bereits vergeben. Bitte in der Verlauf-Seite aktualisieren.',
      );
    }

    await this.databaseService.query(
      `INSERT INTO machine_availability
        (machine_id, tenant_id, status, start_date, end_date, reason, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        machineId,
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
    machineId: number,
    tenantId: number,
    year?: number,
    month?: number,
  ): { query: string; params: (number | string)[] } {
    const params: (number | string)[] = [machineId, tenantId];
    let paramIndex = 3;

    let query = `
      SELECT ma.id, ma.machine_id, ma.status, ma.start_date, ma.end_date,
             ma.reason, ma.notes, ma.created_by,
             CONCAT(u.first_name, ' ', u.last_name) AS created_by_name,
             ma.created_at, ma.updated_at
      FROM machine_availability ma
      LEFT JOIN users u ON ma.created_by = u.id
      WHERE ma.machine_id = $1 AND ma.tenant_id = $2`;

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
  ): MachineAvailabilityHistoryEntry {
    return {
      id: row.id,
      machineId: row.machine_id,
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
   * Called when a TPM maintenance event is scheduled — sets machine
   * status to 'maintenance' for the planned time window.
   */
  async createFromTpmPlan(
    tenantId: number,
    machineId: number,
    startDate: string,
    endDate: string,
    reason: string,
    userId: number,
  ): Promise<void> {
    await this.databaseService.query(
      `INSERT INTO machine_availability
         (tenant_id, machine_id, status, start_date, end_date, reason, created_by)
       VALUES ($1, $2, 'maintenance', $3, $4, $5, $6)`,
      [tenantId, machineId, startDate, endDate, reason, userId],
    );
  }

  /** Find availability entry by ID and tenant */
  private async findAvailabilityEntryById(
    entryId: number,
    tenantId: number,
  ): Promise<AvailabilityRow | null> {
    const rows = await this.databaseService.query<AvailabilityRow>(
      `SELECT id, machine_id, status, start_date, end_date, reason, notes,
              created_by, created_at, updated_at
       FROM machine_availability
       WHERE id = $1 AND tenant_id = $2`,
      [entryId, tenantId],
    );
    return rows[0] ?? null;
  }
}
