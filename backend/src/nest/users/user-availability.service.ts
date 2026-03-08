/**
 * User Availability Service
 *
 * Business logic for employee availability management:
 * - Get current/planned availability for users
 * - Update availability status
 * - Availability history tracking
 * - CRUD for availability entries
 *
 * Extracted from UsersService for better separation of concerns.
 * Works with user_availability table (not user columns).
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
import { UserRepository } from '../database/repositories/user.repository.js';
import type { UpdateAvailabilityEntryDto } from './dto/update-availability-entry.dto.js';
import type { UpdateAvailabilityDto } from './dto/update-availability.dto.js';

/** Error message constants */
const ERROR_MESSAGES = {
  USER_NOT_FOUND: 'User not found',
  ENTRY_NOT_FOUND: 'Availability entry not found',
} as const;

/** User availability row from user_availability table */
export interface UserAvailabilityRow {
  user_id: number;
  status: string;
  start_date: Date | null;
  end_date: Date | null;
  notes: string | null;
}

/** Availability history row from database */
export interface AvailabilityRow {
  id: number;
  user_id: number;
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

/** Availability history entry - API format (camelCase) */
export interface AvailabilityHistoryEntry {
  id: number;
  userId: number;
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

/** Availability history response */
export interface AvailabilityHistoryResult {
  employee: {
    id: number;
    uuid: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  entries: AvailabilityHistoryEntry[];
  meta: { total: number; year: number | null; month: number | null };
}

/** Safe user response type (partial - only availability fields) */
export interface AvailabilityFields {
  availabilityStatus: string | null;
  availabilityStart: string | null;
  availabilityEnd: string | null;
  availabilityNotes: string | null;
}

@Injectable()
export class UserAvailabilityService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
    private readonly userRepository: UserRepository,
  ) {}

  // ============================================
  // Public Methods - Single User Availability
  // ============================================

  /**
   * Get availability for a single user
   * Returns the "next relevant" entry:
   * - Priority 1: Entry where start_date is before/equal TODAY and end_date is after/equal TODAY (current active)
   * - Priority 2: Entry where start_date is after TODAY (next future, earliest first)
   */
  async getUserAvailability(
    userId: number,
    tenantId: number,
  ): Promise<UserAvailabilityRow | null> {
    const rows = await this.databaseService.query<UserAvailabilityRow>(
      `SELECT
         user_id,
         status,
         start_date,
         end_date,
         notes
       FROM user_availability
       WHERE user_id = $1
         AND tenant_id = $2
         AND (end_date >= CURRENT_DATE OR end_date IS NULL)
       ORDER BY
         CASE WHEN start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE THEN 0 ELSE 1 END,
         start_date ASC
       LIMIT 1`,
      [userId, tenantId],
    );

    return rows[0] ?? null;
  }

  /**
   * Get availability for multiple users (batch query for efficiency)
   * Returns the "next relevant" entry for each user:
   * - Priority 1: Entry where start_date is before/equal TODAY and end_date is after/equal TODAY (current active)
   * - Priority 2: Entry where start_date is after TODAY (next future, earliest first)
   */
  async getUserAvailabilityBatch(
    userIds: number[],
    tenantId: number,
  ): Promise<Map<number, UserAvailabilityRow>> {
    if (userIds.length === 0) {
      return new Map();
    }

    // Build parameterized query for user IDs
    const placeholders = userIds
      .map((_: number, i: number) => `$${i + 2}`)
      .join(', ');

    // Query uses DISTINCT ON to get one entry per user
    // Orders by: 1) is_current (active today first), 2) start_date ASC (earliest future)
    const rows = await this.databaseService.query<UserAvailabilityRow>(
      `SELECT DISTINCT ON (user_id)
         user_id,
         status,
         start_date,
         end_date,
         notes
       FROM user_availability
       WHERE user_id IN (${placeholders})
         AND tenant_id = $1
         AND (end_date >= CURRENT_DATE OR end_date IS NULL)
       ORDER BY user_id,
         CASE WHEN start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE THEN 0 ELSE 1 END,
         start_date ASC`,
      [tenantId, ...userIds],
    );

    // Map by user_id
    const availabilityByUser = new Map<number, UserAvailabilityRow>();
    for (const row of rows) {
      availabilityByUser.set(row.user_id, row);
    }

    return availabilityByUser;
  }

  /** Add availability info to a response object */
  addAvailabilityInfo(
    response: AvailabilityFields,
    availability: UserAvailabilityRow | undefined,
  ): void {
    if (availability === undefined) {
      // No availability entry - default to available
      response.availabilityStatus = 'available';
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
  // Public Methods - Update Availability
  // ============================================

  /** Update availability (writes to user_availability table only) */
  async updateAvailability(
    userId: number,
    dto: UpdateAvailabilityDto,
    tenantId: number,
    createdBy?: number,
  ): Promise<{ message: string }> {
    const userExists = await this.userExists(userId, tenantId);
    if (!userExists) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    this.validateAvailabilityDates(dto);

    if (
      dto.availabilityStart !== undefined &&
      dto.availabilityEnd !== undefined
    ) {
      await this.insertAvailabilityRecord(userId, tenantId, dto, createdBy);
    }

    return { message: 'Availability updated successfully' };
  }

  /** Validates availability date requirements */
  private validateAvailabilityDates(dto: UpdateAvailabilityDto): void {
    if (
      dto.availabilityStatus !== 'available' &&
      (dto.availabilityStart === undefined || dto.availabilityEnd === undefined)
    ) {
      throw new BadRequestException(
        'Start and end dates are required for non-available status',
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

  /** Checks for overlapping ranges and inserts availability record */
  private async insertAvailabilityRecord(
    userId: number,
    tenantId: number,
    dto: UpdateAvailabilityDto,
    createdBy?: number,
  ): Promise<void> {
    const overlapping = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM user_availability
       WHERE user_id = $1
         AND tenant_id = $2
         AND start_date <= $4::date
         AND end_date >= $3::date`,
      [userId, tenantId, dto.availabilityStart, dto.availabilityEnd],
    );

    if (overlapping.length > 0) {
      throw new ConflictException(
        'Zeitraum bereits vergeben. Bitte in der Verlauf-Seite aktualisieren.',
      );
    }

    await this.databaseService.query(
      `INSERT INTO user_availability
        (user_id, tenant_id, status, start_date, end_date, reason, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
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

  /** Insert into availability history if availability fields were updated via updateUser */
  async insertAvailabilityHistoryIfNeeded(
    userId: number,
    tenantId: number,
    availabilityStatus: string | undefined,
    availabilityStart: string | null | undefined,
    availabilityEnd: string | null | undefined,
    availabilityReason: string | null | undefined,
    availabilityNotes: string | null | undefined,
    actingUserId: number,
  ): Promise<void> {
    // Only insert if availability fields are present and have valid dates
    if (
      availabilityStatus === undefined ||
      availabilityStart === undefined ||
      availabilityEnd === undefined ||
      availabilityStart === null ||
      availabilityEnd === null
    ) {
      return;
    }

    // Validate: end date must be on or after start date
    if (availabilityEnd < availabilityStart) {
      throw new BadRequestException(
        'Bis-Datum muss nach oder gleich Von-Datum sein.',
      );
    }

    // Check for overlapping date ranges
    const overlapping = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM user_availability
       WHERE user_id = $1
         AND tenant_id = $2
         AND start_date <= $4::date
         AND end_date >= $3::date`,
      [userId, tenantId, availabilityStart, availabilityEnd],
    );

    if (overlapping.length > 0) {
      throw new ConflictException(
        'Zeitraum bereits vergeben. Bitte in der Verlauf-Seite aktualisieren.',
      );
    }

    await this.databaseService.query(
      `INSERT INTO user_availability
        (user_id, tenant_id, status, start_date, end_date, reason, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        tenantId,
        availabilityStatus,
        availabilityStart,
        availabilityEnd,
        availabilityReason ?? null,
        availabilityNotes ?? null,
        actingUserId,
      ],
    );
  }

  // ============================================
  // UUID-based Methods (for API consistency)
  // ============================================

  /** Update user availability by UUID (wrapper for UUID-based API) */
  async updateAvailabilityByUuid(
    uuid: string,
    dto: UpdateAvailabilityDto,
    tenantId: number,
    createdBy?: number,
  ): Promise<{ message: string }> {
    const userId = await this.resolveUserIdByUuid(uuid, tenantId);
    return await this.updateAvailability(userId, dto, tenantId, createdBy);
  }

  /** Get availability history for a user by UUID */
  async getAvailabilityHistoryByUuid(
    uuid: string,
    tenantId: number,
    year?: number,
    month?: number,
  ): Promise<AvailabilityHistoryResult> {
    // Get user info
    const userRow = await this.findUserBasicInfoByUuid(uuid, tenantId);

    // Build and execute query
    const { query, params } = this.buildAvailabilityHistoryQuery(
      userRow.id,
      tenantId,
      year,
      month,
    );
    const rows = await this.databaseService.query<AvailabilityRow>(
      query,
      params,
    );

    // Map rows to API format
    const entries = rows.map((row: AvailabilityRow) =>
      this.mapAvailabilityRowToEntry(row),
    );

    return {
      employee: {
        id: userRow.id,
        uuid: userRow.uuid,
        firstName: userRow.first_name ?? '',
        lastName: userRow.last_name ?? '',
        email: userRow.email,
      },
      entries,
      meta: { total: entries.length, year: year ?? null, month: month ?? null },
    };
  }

  // ============================================
  // Availability Entry CRUD (for history table)
  // ============================================

  /** Update an availability history entry (only entries with endDate >= today) */
  async updateAvailabilityEntry(
    entryId: number,
    dto: UpdateAvailabilityEntryDto,
    tenantId: number,
    actingUserId: number,
  ): Promise<{ message: string }> {
    // Find entry and verify tenant
    const entry = await this.findAvailabilityEntryById(entryId, tenantId);
    if (entry === null) {
      throw new NotFoundException(ERROR_MESSAGES.ENTRY_NOT_FOUND);
    }

    // Check if entry is editable (endDate >= today)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const entryEndDate =
      entry.end_date !== null ? new Date(entry.end_date) : null;
    if (entryEndDate !== null) {
      entryEndDate.setUTCHours(0, 0, 0, 0);
      if (entryEndDate < today) {
        throw new BadRequestException('Cannot edit past availability entries');
      }
    }

    // Store old values for logging
    const oldValues = {
      status: entry.status,
      startDate: entry.start_date?.toISOString().split('T')[0] ?? null,
      endDate: entry.end_date?.toISOString().split('T')[0] ?? null,
      reason: entry.reason,
      notes: entry.notes,
    };

    // Execute update
    await this.databaseService.query(
      `UPDATE user_availability
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

    // Log activity
    await this.activityLogger.logUpdate(
      tenantId,
      actingUserId,
      'availability',
      entryId,
      `Verfügbarkeitseintrag aktualisiert: ${dto.status} (${dto.startDate} - ${dto.endDate})`,
      oldValues,
      {
        status: dto.status,
        startDate: dto.startDate,
        endDate: dto.endDate,
        reason: dto.reason ?? null,
        notes: dto.notes ?? null,
      },
    );

    return { message: 'Availability entry updated successfully' };
  }

  /** Delete an availability history entry */
  async deleteAvailabilityEntry(
    entryId: number,
    tenantId: number,
    actingUserId: number,
  ): Promise<{ message: string }> {
    // Find entry and verify tenant
    const entry = await this.findAvailabilityEntryById(entryId, tenantId);
    if (entry === null) {
      throw new NotFoundException(ERROR_MESSAGES.ENTRY_NOT_FOUND);
    }

    // Store values for logging
    const deletedValues = {
      status: entry.status,
      startDate: entry.start_date?.toISOString().split('T')[0] ?? null,
      endDate: entry.end_date?.toISOString().split('T')[0] ?? null,
      reason: entry.reason,
      notes: entry.notes,
      userId: entry.user_id,
    };

    // Execute delete
    await this.databaseService.query(
      `DELETE FROM user_availability WHERE id = $1 AND tenant_id = $2`,
      [entryId, tenantId],
    );

    // Log activity
    await this.activityLogger.logDelete(
      tenantId,
      actingUserId,
      'availability',
      entryId,
      `Verfügbarkeitseintrag gelöscht: ${entry.status} (${entry.start_date?.toISOString().split('T')[0] ?? ''} - ${entry.end_date?.toISOString().split('T')[0] ?? ''})`,
      deletedValues,
    );

    return { message: 'Availability entry deleted successfully' };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /** Check if user exists and is active */
  private async userExists(userId: number, tenantId: number): Promise<boolean> {
    const rows = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [userId, tenantId],
    );
    return rows.length > 0;
  }

  /**
   * Resolve user ID from UUID
   * SECURITY: Only resolves ACTIVE users (is_active = 1)
   * @throws NotFoundException if user not found or deleted
   */
  private async resolveUserIdByUuid(
    uuid: string,
    tenantId: number,
  ): Promise<number> {
    const userId = await this.userRepository.resolveUuidToId(uuid, tenantId);
    if (userId === null) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }
    return userId;
  }

  /**
   * Find user basic info by UUID.
   * SECURITY: Only returns ACTIVE users (is_active = 1).
   */
  private async findUserBasicInfoByUuid(
    uuid: string,
    tenantId: number,
  ): Promise<{
    id: number;
    uuid: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  }> {
    const result = await this.databaseService.query<{
      id: number;
      uuid: string;
      first_name: string | null;
      last_name: string | null;
      email: string;
    }>(
      `SELECT id, uuid, first_name, last_name, email FROM users WHERE uuid = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [uuid, tenantId],
    );

    const userRow = result[0];
    if (userRow === undefined) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }
    return userRow;
  }

  /** Build availability history query with optional year/month filters */
  private buildAvailabilityHistoryQuery(
    employeeId: number,
    tenantId: number,
    year?: number,
    month?: number,
  ): { query: string; params: (number | string)[] } {
    const params: (number | string)[] = [employeeId, tenantId];
    let paramIndex = 3;

    let query = `
      SELECT ea.id, ea.user_id, ea.status, ea.start_date, ea.end_date,
             ea.reason, ea.notes, ea.created_by,
             CONCAT(u.first_name, ' ', u.last_name) AS created_by_name,
             ea.created_at, ea.updated_at
      FROM user_availability ea
      LEFT JOIN users u ON ea.created_by = u.id
      WHERE ea.user_id = $1 AND ea.tenant_id = $2`;

    if (year !== undefined) {
      query += ` AND (EXTRACT(YEAR FROM ea.start_date) = $${paramIndex}
                 OR EXTRACT(YEAR FROM ea.end_date) = $${paramIndex})`;
      params.push(year);
      paramIndex++;
    }

    if (month !== undefined) {
      query += ` AND (EXTRACT(MONTH FROM ea.start_date) = $${paramIndex}
                 OR EXTRACT(MONTH FROM ea.end_date) = $${paramIndex})`;
      params.push(month);
    }

    query += ` ORDER BY ea.start_date DESC`;

    return { query, params };
  }

  /** Map availability row to API format entry */
  private mapAvailabilityRowToEntry(
    row: AvailabilityRow,
  ): AvailabilityHistoryEntry {
    return {
      id: row.id,
      userId: row.user_id,
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

  /** Find availability entry by ID and tenant */
  private async findAvailabilityEntryById(
    entryId: number,
    tenantId: number,
  ): Promise<AvailabilityRow | null> {
    const rows = await this.databaseService.query<AvailabilityRow>(
      `SELECT id, user_id, status, start_date, end_date, reason, notes,
              created_by, created_at, updated_at
       FROM user_availability
       WHERE id = $1 AND tenant_id = $2`,
      [entryId, tenantId],
    );
    return rows[0] ?? null;
  }
}
