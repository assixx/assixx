/**
 * Rotation Service
 *
 * Native NestJS implementation for shift rotation pattern management.
 * No Express dependencies - uses DatabaseService directly.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { dbToApi } from '../../utils/fieldMapping.js';
import { DatabaseService } from '../database/database.service.js';
import type { AssignUsersToPatternDto } from './dto/assign-users-to-pattern.dto.js';
import type { CreateRotationPatternDto } from './dto/create-rotation-pattern.dto.js';
import type { GenerateRotationShiftsDto } from './dto/generate-rotation-shifts.dto.js';
import type { GenerateRotationFromConfigDto } from './dto/rotation-config.dto.js';
import type { UpdateRotationPatternDto } from './dto/update-rotation-pattern.dto.js';

// ============================================================
// DATABASE ROW TYPES
// ============================================================

interface DbPatternRow {
  id: number;
  tenant_id: number;
  team_id: number | null;
  name: string;
  description: string | null;
  pattern_type: 'alternate_fs' | 'fixed_n' | 'custom';
  pattern_config: Record<string, unknown> | string;
  cycle_length_weeks: number;
  starts_at: string | Date;
  ends_at: string | Date | null;
  is_active: number;
  created_by: number;
  created_by_name?: string;
  created_at?: string | Date;
  updated_at?: string | Date;
}

interface DbAssignmentRow {
  id: number;
  tenant_id: number;
  pattern_id: number;
  user_id: number;
  team_id: number | null;
  shift_group: 'F' | 'S' | 'N';
  rotation_order: number;
  can_override: boolean;
  override_dates: Record<string, unknown> | null;
  is_active: number;
  starts_at: string | Date;
  ends_at: string | Date | null;
  assigned_by: number;
  assigned_at?: string | Date;
  updated_at?: string | Date;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface DbHistoryRow {
  id: number;
  tenant_id: number;
  pattern_id: number;
  assignment_id: number;
  user_id: number;
  team_id: number | null;
  shift_date: string | Date;
  shift_type: 'F' | 'S' | 'N';
  week_number: number;
  status: 'generated' | 'confirmed' | 'modified' | 'cancelled';
  modified_reason: string | null;
  generated_at?: string | Date;
  confirmed_at?: string | Date;
  confirmed_by?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  pattern_name?: string;
}

// ============================================================
// RESPONSE TYPES
// ============================================================

/**
 * Rotation pattern response
 */
export interface RotationPatternResponse {
  id: number;
  tenantId: number;
  teamId?: number | null;
  name: string;
  description?: string;
  patternType: 'alternate_fs' | 'fixed_n' | 'custom';
  patternConfig: Record<string, unknown>;
  cycleLengthWeeks: number;
  startsAt: string;
  endsAt?: string | null;
  isActive: boolean;
  createdBy: number;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Rotation assignment response
 */
export interface RotationAssignmentResponse {
  id: number;
  patternId: number;
  userId: number;
  shiftGroup: 'F' | 'S' | 'N';
  startsAt: string;
  endsAt?: string | null;
  username?: string;
  firstName?: string;
  lastName?: string;
  [key: string]: unknown;
}

/**
 * Rotation history response
 */
export interface RotationHistoryResponse {
  id: number;
  patternId: number;
  userId: number;
  shiftDate: string;
  shiftType: 'F' | 'S' | 'N';
  status: 'generated' | 'confirmed' | 'modified' | 'cancelled';
  username?: string;
  firstName?: string;
  lastName?: string;
  patternName?: string;
  [key: string]: unknown;
}

/**
 * Generated shifts response
 */
export interface GeneratedShiftsResponse {
  shifts: GeneratedShift[];
  [key: string]: unknown;
}

interface GeneratedShift {
  userId: number;
  date: string;
  shiftType: 'F' | 'S' | 'N';
  [key: string]: unknown;
}

/**
 * Delete history counts response
 */
export interface DeleteHistoryCountsResponse {
  patterns: number;
  assignments: number;
  history: number;
  shifts?: number; // Shifts deleted that were in rotation_history
  plans?: number; // Shift plans deleted for the team
}

// ============================================================
// FILTER TYPES
// ============================================================

/**
 * Rotation history filters
 */
export interface RotationHistoryFilters {
  patternId?: number | undefined;
  userId?: number | undefined;
  teamId?: number | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  status?: string | undefined;
}

/**
 * Pattern configuration
 */
interface PatternConfig {
  weekType?: 'F' | 'S';
  cycleWeeks?: number;
  shiftType?: 'N';
  skipSaturday?: boolean;
  skipSunday?: boolean;
  nightShiftStatic?: boolean;
  skipWeekends?: boolean; // Legacy
  ignoreNightShift?: boolean; // Legacy
  shiftBlockLength?: number;
  freeDays?: number;
  startShift?: 'early' | 'late' | 'night';
  shiftSequence?: ('early' | 'late' | 'night')[];
  specialRules?: unknown[];
  pattern?: { week: number; shift: 'F' | 'S' | 'N' }[];
  customPattern?: {
    week1: Record<string, unknown>;
    week2: Record<string, unknown>;
  };
}

// ============================================================
// SERVICE IMPLEMENTATION
// ============================================================

@Injectable()
export class RotationService {
  private readonly logger = new Logger(RotationService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  // ============================================================
  // HELPER METHODS
  // ============================================================

  /**
   * Parse pattern config from database (JSON string or object)
   */
  private parsePatternConfig(
    config: Record<string, unknown> | string,
  ): Record<string, unknown> {
    if (typeof config === 'string') {
      return JSON.parse(config) as Record<string, unknown>;
    }
    return config;
  }

  /**
   * Format date to ISO date string (YYYY-MM-DD)
   */
  private formatDate(date: Date | string): string {
    if (typeof date === 'string') {
      return date.split('T')[0] ?? date;
    }
    return date.toISOString().split('T')[0] ?? '';
  }

  /**
   * Convert DB pattern row to API response
   */
  private patternRowToResponse(row: DbPatternRow): RotationPatternResponse {
    const apiData = dbToApi(row as unknown as Record<string, unknown>);
    return {
      ...apiData,
      patternConfig: this.parsePatternConfig(row.pattern_config),
      isActive: row.is_active === 1,
      startsAt: this.formatDate(row.starts_at),
      endsAt: row.ends_at !== null ? this.formatDate(row.ends_at) : null,
    } as RotationPatternResponse;
  }

  // ============================================================
  // PATTERNS CRUD
  // ============================================================

  /**
   * Get all rotation patterns
   */
  async getRotationPatterns(
    tenantId: number,
    activeOnly: boolean = true,
  ): Promise<RotationPatternResponse[]> {
    this.logger.debug(`Getting rotation patterns for tenant ${tenantId}`);

    let query = `
      SELECT
        p.*,
        u.username as created_by_name
      FROM shift_rotation_patterns p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.tenant_id = $1
    `;

    const params: (number | string)[] = [tenantId];

    if (activeOnly) {
      query += ' AND p.is_active = 1';
    }

    query += ' ORDER BY p.created_at DESC';

    const rows = await this.databaseService.query<DbPatternRow>(query, params);
    return rows.map((row: DbPatternRow) => this.patternRowToResponse(row));
  }

  /**
   * Get single rotation pattern by ID
   */
  async getRotationPattern(
    patternId: number,
    tenantId: number,
  ): Promise<RotationPatternResponse> {
    this.logger.debug(
      `Getting rotation pattern ${patternId} for tenant ${tenantId}`,
    );

    const query = `
      SELECT
        p.*,
        u.username as created_by_name
      FROM shift_rotation_patterns p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = $1 AND p.tenant_id = $2
    `;

    const rows = await this.databaseService.query<DbPatternRow>(query, [
      patternId,
      tenantId,
    ]);

    if (rows.length === 0 || rows[0] === undefined) {
      throw new NotFoundException(`Rotation pattern ${patternId} not found`);
    }

    return this.patternRowToResponse(rows[0]);
  }

  /**
   * Create rotation pattern
   */
  async createRotationPattern(
    dto: CreateRotationPatternDto,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<RotationPatternResponse> {
    this.logger.debug(`Creating rotation pattern for tenant ${tenantId}`);

    if (userRole !== 'admin' && userRole !== 'root') {
      throw new ForbiddenException('Only admins can create rotation patterns');
    }

    // Check for existing pattern with same name
    const existing = await this.databaseService.query<{ id: number }>(
      'SELECT id FROM shift_rotation_patterns WHERE name = $1 AND tenant_id = $2 AND is_active = 1',
      [dto.name, tenantId],
    );

    if (existing.length > 0 && existing[0] !== undefined) {
      throw new ConflictException(
        `Ein Rotationsmuster mit dem Namen "${dto.name}" existiert bereits.`,
      );
    }

    // is_active is SMALLINT: 0=inactive, 1=active
    const isActiveValue = !dto.isActive ? 0 : 1;
    const patternUuid = uuidv7();

    const insertQuery = `
      INSERT INTO shift_rotation_patterns (
        tenant_id, team_id, name, description, pattern_type,
        pattern_config, cycle_length_weeks, starts_at,
        ends_at, is_active, created_by, uuid, uuid_created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      RETURNING id
    `;

    const result = await this.databaseService.query<{ id: number }>(
      insertQuery,
      [
        tenantId,
        dto.teamId ?? null,
        dto.name,
        dto.description ?? null,
        dto.patternType,
        JSON.stringify(dto.patternConfig),
        dto.cycleLengthWeeks,
        dto.startsAt,
        dto.endsAt ?? null,
        isActiveValue,
        userId,
        patternUuid,
      ],
    );

    if (result[0] === undefined) {
      throw new InternalServerErrorException(
        'Failed to create rotation pattern',
      );
    }

    return await this.getRotationPattern(result[0].id, tenantId);
  }

  /**
   * Update rotation pattern
   */
  async updateRotationPattern(
    patternId: number,
    dto: UpdateRotationPatternDto,
    tenantId: number,
    userRole: string,
  ): Promise<RotationPatternResponse> {
    this.logger.debug(
      `Updating rotation pattern ${patternId} for tenant ${tenantId}`,
    );

    if (userRole !== 'admin' && userRole !== 'root') {
      throw new ForbiddenException('Only admins can update rotation patterns');
    }

    // Check pattern exists
    await this.getRotationPattern(patternId, tenantId);

    // Build dynamic update query
    const updates: string[] = [];
    const params: (string | number | boolean | null)[] = [];

    const addField = (column: string, value: unknown): void => {
      if (value === undefined) return;
      const paramIndex = params.length + 1;
      updates.push(`${column} = $${paramIndex}`);
      params.push(value as string | number | boolean | null);
    };

    addField('name', dto.name);
    addField('description', dto.description ?? null);
    addField('team_id', dto.teamId ?? null);
    if (dto.patternConfig !== undefined) {
      addField('pattern_config', JSON.stringify(dto.patternConfig));
    }
    addField('cycle_length_weeks', dto.cycleLengthWeeks);
    addField('starts_at', dto.startsAt);
    addField('ends_at', dto.endsAt ?? null);
    if (dto.isActive !== undefined) {
      addField('is_active', dto.isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const patternIdIndex = params.length + 1;
    const tenantIdIndex = params.length + 2;
    params.push(patternId, tenantId);

    await this.databaseService.query(
      `UPDATE shift_rotation_patterns SET ${updates.join(', ')} WHERE id = $${patternIdIndex} AND tenant_id = $${tenantIdIndex}`,
      params,
    );

    return await this.getRotationPattern(patternId, tenantId);
  }

  /**
   * Delete rotation pattern
   */
  async deleteRotationPattern(
    patternId: number,
    tenantId: number,
    userRole: string,
  ): Promise<void> {
    this.logger.debug(
      `Deleting rotation pattern ${patternId} for tenant ${tenantId}`,
    );

    if (userRole !== 'admin' && userRole !== 'root') {
      throw new ForbiddenException('Only admins can delete rotation patterns');
    }

    // Check pattern exists
    await this.getRotationPattern(patternId, tenantId);

    // Delete pattern (cascade will handle assignments and history)
    await this.databaseService.query(
      'DELETE FROM shift_rotation_patterns WHERE id = $1 AND tenant_id = $2',
      [patternId, tenantId],
    );
  }

  // ============================================================
  // ASSIGNMENTS
  // ============================================================

  /**
   * Get active assignments for a pattern
   */
  private async getPatternAssignments(
    patternId: number,
    tenantId: number,
  ): Promise<RotationAssignmentResponse[]> {
    const rows = await this.databaseService.query<DbAssignmentRow>(
      `SELECT a.*, u.username, u.first_name, u.last_name
       FROM shift_rotation_assignments a
       JOIN users u ON a.user_id = u.id
       WHERE a.pattern_id = $1 AND a.tenant_id = $2 AND a.is_active = 1`,
      [patternId, tenantId],
    );

    return rows.map(
      (row: DbAssignmentRow) =>
        dbToApi(
          row as unknown as Record<string, unknown>,
        ) as RotationAssignmentResponse,
    );
  }

  /**
   * Assign users to rotation pattern
   */
  async assignUsersToPattern(
    dto: AssignUsersToPatternDto,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<RotationAssignmentResponse[]> {
    this.logger.debug(`Assigning users to pattern for tenant ${tenantId}`);

    if (userRole !== 'admin' && userRole !== 'root') {
      throw new ForbiddenException('Only admins can assign users to patterns');
    }

    // Validate pattern exists
    await this.getRotationPattern(dto.patternId, tenantId);

    // Process each assignment
    for (const assignment of dto.assignments) {
      const { userId: assignUserId, group: shiftGroup } = assignment;

      // Check for existing active assignment
      const existing = await this.databaseService.query<{ id: number }>(
        `SELECT id FROM shift_rotation_assignments
         WHERE tenant_id = $1 AND pattern_id = $2 AND user_id = $3
         AND (ends_at IS NULL OR ends_at > NOW())`,
        [tenantId, dto.patternId, assignUserId],
      );

      if (existing.length > 0 && existing[0] !== undefined) {
        // Update existing assignment
        await this.databaseService.query(
          `UPDATE shift_rotation_assignments
           SET shift_group = $1, starts_at = $2, ends_at = $3, updated_at = NOW()
           WHERE id = $4`,
          [shiftGroup, dto.startsAt, dto.endsAt ?? null, existing[0].id],
        );
      } else {
        // Create new assignment
        const assignmentUuid = uuidv7();
        await this.databaseService.query(
          `INSERT INTO shift_rotation_assignments
           (tenant_id, pattern_id, user_id, team_id, shift_group,
            rotation_order, can_override, starts_at, ends_at, is_active, assigned_by, uuid, uuid_created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
          [
            tenantId,
            dto.patternId,
            assignUserId,
            dto.teamId ?? null,
            shiftGroup,
            0,
            true,
            dto.startsAt,
            dto.endsAt ?? null,
            1,
            userId,
            assignmentUuid,
          ],
        );
      }
    }

    return await this.getPatternAssignments(dto.patternId, tenantId);
  }

  // ============================================================
  // SHIFT GENERATION
  // ============================================================

  /**
   * Determine alternating shift type for F/S with night shift ignored
   */
  private determineAlternatingShiftType(
    shiftGroup: string,
    cycleWeek: number,
  ): 'F' | 'S' | 'N' {
    if (shiftGroup === 'F') {
      return cycleWeek === 0 ? 'F' : 'S';
    }
    if (shiftGroup === 'S') {
      return cycleWeek === 0 ? 'S' : 'F';
    }
    // Night shift workers stay in N
    return shiftGroup === 'N' ? 'N' : 'F';
  }

  /**
   * Determine shift type for a given date and pattern
   */
  private determineShiftType(
    shiftGroup: string,
    patternType: string,
    config: PatternConfig,
    weeksSinceStart: number,
  ): 'F' | 'S' | 'N' {
    const nightShiftStatic =
      config.nightShiftStatic ?? config.ignoreNightShift ?? false;

    // Fixed night shift pattern
    if (patternType === 'fixed_n') {
      return 'N';
    }

    // Weekly rotation
    const isWeeklyRotation =
      patternType === 'alternate_fs' ||
      (patternType === 'custom' && config.cycleWeeks === 1);

    if (!isWeeklyRotation) {
      return shiftGroup as 'F' | 'S' | 'N';
    }

    // Weekly rotation with nightShiftStatic
    if (nightShiftStatic) {
      const cycleWeek = weeksSinceStart % 2;
      return this.determineAlternatingShiftType(shiftGroup, cycleWeek);
    }

    // Original 3-shift rotation
    const cycleWeek = weeksSinceStart % 3;
    if (cycleWeek === 0) return 'F';
    if (cycleWeek === 1) return 'S';
    return 'N';
  }

  /**
   * Generate shifts for a single assignment
   */
  private generateShiftsForAssignment(
    assignment: DbAssignmentRow,
    pattern: RotationPatternResponse,
    startDate: string,
    endDate: string,
  ): GeneratedShift[] {
    const shifts: GeneratedShift[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const patternStart = new Date(pattern.startsAt);

    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const config = pattern.patternConfig as PatternConfig;

    const skipSaturday = config.skipSaturday ?? config.skipWeekends ?? false;
    const skipSunday = config.skipSunday ?? config.skipWeekends ?? false;

    for (
      let date = new Date(start);
      date <= end;
      date.setDate(date.getDate() + 1)
    ) {
      const dayOfWeek = date.getDay();

      // Skip weekends if configured
      if (skipSaturday && dayOfWeek === 6) continue;
      if (skipSunday && dayOfWeek === 0) continue;

      const weeksSinceStart = Math.floor(
        (date.getTime() - patternStart.getTime()) / msPerWeek,
      );
      const shiftType = this.determineShiftType(
        assignment.shift_group,
        pattern.patternType,
        config,
        weeksSinceStart,
      );

      const dateString = date.toISOString().split('T')[0];
      if (dateString !== undefined) {
        shifts.push({
          userId: assignment.user_id,
          date: dateString,
          shiftType,
        });
      }
    }

    return shifts;
  }

  /**
   * Calculate week number for a date
   */
  private getWeekNumber(date: Date): number {
    const yearStart = new Date(date.getFullYear(), 0, 1);
    return Math.ceil(
      ((date.getTime() - yearStart.getTime()) / 86400000 +
        yearStart.getDay() +
        1) /
        7,
    );
  }

  /**
   * Generate rotation shifts from pattern
   */
  async generateRotationShifts(
    dto: GenerateRotationShiftsDto,
    tenantId: number,
    _userId: number,
    userRole: string,
  ): Promise<GeneratedShiftsResponse> {
    this.logger.debug(`Generating rotation shifts for tenant ${tenantId}`);

    if (userRole !== 'admin' && userRole !== 'root') {
      throw new ForbiddenException('Only admins can generate rotation shifts');
    }

    const pattern = await this.getRotationPattern(dto.patternId, tenantId);

    // Get active assignments for pattern
    const assignments = await this.databaseService.query<DbAssignmentRow>(
      `SELECT * FROM shift_rotation_assignments
       WHERE pattern_id = $1 AND tenant_id = $2
       AND is_active = 1
       AND starts_at <= $3
       AND (ends_at IS NULL OR ends_at >= $4)`,
      [dto.patternId, tenantId, dto.endDate, dto.startDate],
    );

    const generatedShifts: GeneratedShift[] = [];
    for (const assignment of assignments) {
      const shifts = this.generateShiftsForAssignment(
        assignment,
        pattern,
        dto.startDate,
        dto.endDate,
      );
      generatedShifts.push(...shifts);
    }

    // If not preview mode, save shifts
    if (!dto.preview && generatedShifts.length > 0) {
      await this.saveGeneratedShifts(
        generatedShifts,
        pattern.id,
        assignments,
        tenantId,
      );
    }

    return { shifts: generatedShifts };
  }

  /**
   * Save generated shifts to history table
   */
  private async saveGeneratedShifts(
    shifts: GeneratedShift[],
    patternId: number,
    assignments: DbAssignmentRow[],
    tenantId: number,
  ): Promise<void> {
    // Create a map of userId to assignment
    const assignmentMap = new Map<number, DbAssignmentRow>();
    for (const assignment of assignments) {
      assignmentMap.set(assignment.user_id, assignment);
    }

    // Use transaction for consistency
    await this.databaseService.query('BEGIN', []);

    try {
      for (const shift of shifts) {
        const assignment = assignmentMap.get(shift.userId);
        if (assignment === undefined) continue;

        // Check if shift already exists
        const existing = await this.databaseService.query<{ id: number }>(
          `SELECT id FROM shift_rotation_history
           WHERE tenant_id = $1 AND user_id = $2 AND shift_date = $3`,
          [tenantId, shift.userId, shift.date],
        );

        if (existing.length === 0) {
          const weekNumber = this.getWeekNumber(new Date(shift.date));
          const historyUuid = uuidv7();

          await this.databaseService.query(
            `INSERT INTO shift_rotation_history (
              tenant_id, pattern_id, assignment_id, user_id, team_id,
              shift_date, shift_type, week_number, status, uuid, uuid_created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'generated', $9, NOW())`,
            [
              tenantId,
              patternId,
              assignment.id,
              shift.userId,
              assignment.team_id,
              shift.date,
              shift.shiftType,
              weekNumber,
              historyUuid,
            ],
          );
        }
      }

      await this.databaseService.query('COMMIT', []);
    } catch (error) {
      await this.databaseService.query('ROLLBACK', []);
      throw error;
    }
  }

  /**
   * Map shift type to group enum
   */
  private mapShiftTypeToGroup(
    shiftType: 'early' | 'late' | 'night',
  ): 'F' | 'S' | 'N' {
    switch (shiftType) {
      case 'early':
        return 'F';
      case 'late':
        return 'S';
      case 'night':
        return 'N';
      default:
        return 'F';
    }
  }

  /**
   * Get group start index in sequence
   */
  private getGroupStartIndex(
    group: 'F' | 'S' | 'N',
    sequence: ('early' | 'late' | 'night')[],
  ): number {
    let shiftType: 'early' | 'late' | 'night';
    switch (group) {
      case 'F':
        shiftType = 'early';
        break;
      case 'S':
        shiftType = 'late';
        break;
      case 'N':
        shiftType = 'night';
        break;
    }
    const index = sequence.indexOf(shiftType);
    return index >= 0 ? index : 0;
  }

  /**
   * Check if a date should be skipped based on special rules
   * Example: "Jeder 2. Freitag im Monat frei" → skip every 2nd Friday
   */
  private shouldSkipBySpecialRules(
    date: Date,
    specialRules?: { type: string; weekday: number; n: number }[],
  ): boolean {
    if (!specialRules || specialRules.length === 0) {
      return false;
    }

    const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const dayOfMonth = date.getDate();

    for (const rule of specialRules) {
      if (rule.type === 'nth_weekday_free') {
        // Check if this day is the correct weekday
        if (dayOfWeek !== rule.weekday) {
          continue;
        }

        // Calculate which occurrence of this weekday in the month
        // Example: Jan 9 is a Friday, dayOfMonth=9
        // First Friday of Jan 2026 is Jan 2 (day 2)
        // To find nth occurrence: count how many of this weekday came before + 1
        // Formula: ceil(dayOfMonth / 7) works for most cases but is not exact
        // Exact: floor((dayOfMonth - 1) / 7) + 1
        const nthOccurrence = Math.floor((dayOfMonth - 1) / 7) + 1;

        if (nthOccurrence === rule.n) {
          const dateStr = date.toISOString().split('T')[0] ?? 'unknown';
          this.logger.debug(
            `Special rule match: ${dateStr} is ${rule.n}. weekday ${rule.weekday} - SKIPPING`,
          );
          return true;
        }
      }
    }

    return false;
  }

  /** Validates that team exists and is active */
  private async validateTeamExists(
    teamId: number | null | undefined,
    tenantId: number,
  ): Promise<void> {
    if (teamId === undefined || teamId === null) return;
    const teamResult = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM teams WHERE id = $1 AND tenant_id = $2 AND is_active = 1`,
      [teamId, tenantId],
    );
    if (teamResult.length === 0) {
      throw new BadRequestException(
        `Team with ID ${teamId} does not exist or is not active`,
      );
    }
  }

  /** Validates that all user IDs in assignments exist and are active */
  private async validateAssignmentUserIds(
    assignments: { userId: number; startGroup: string }[],
    tenantId: number,
  ): Promise<void> {
    if (assignments.length === 0) return;
    const userIds = assignments.map((a: { userId: number }) => a.userId);
    const userResult = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM users WHERE id = ANY($1::int[]) AND tenant_id = $2 AND is_active = 1`,
      [userIds, tenantId],
    );
    const validUserIds = new Set(userResult.map((r: { id: number }) => r.id));
    const invalidUserIds = userIds.filter(
      (id: number) => !validUserIds.has(id),
    );
    if (invalidUserIds.length > 0) {
      throw new BadRequestException(
        `Invalid user IDs in assignments: ${invalidUserIds.join(', ')}. Users must exist and be active.`,
      );
    }
  }

  /** Creates a rotation pattern and returns its ID */
  private async createPatternForConfig(
    config: GenerateRotationFromConfigDto['config'],
    teamId: number | null | undefined,
    startDate: string,
    endDate: string,
    tenantId: number,
    userId: number,
  ): Promise<number> {
    const patternConfig = JSON.stringify({
      shiftBlockLength: config.shiftBlockLength,
      freeDays: config.freeDays,
      startShift: config.startShift,
      shiftSequence: config.shiftSequence,
      specialRules: config.specialRules,
    });
    const cycleWeeks = Math.ceil(
      (config.shiftBlockLength + config.freeDays) / 7,
    );
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
    const patternName = `Custom-Rotation ${timestamp}`;
    const patternUuid = uuidv7();
    const patternResult = await this.databaseService.query<{ id: number }>(
      `INSERT INTO shift_rotation_patterns
       (tenant_id, team_id, name, pattern_type, pattern_config, cycle_length_weeks, starts_at, ends_at, created_by, uuid, uuid_created_at)
       VALUES ($1, $2, $3, 'custom', $4::jsonb, $5, $6, $7, $8, $9, NOW()) RETURNING id`,
      [
        tenantId,
        teamId ?? null,
        patternName,
        patternConfig,
        cycleWeeks,
        startDate,
        endDate,
        userId,
        patternUuid,
      ],
    );
    return patternResult[0]?.id ?? 0;
  }

  /** Inserts a single history entry for a shift day */
  private async insertHistoryEntry(params: {
    tenantId: number;
    patternId: number;
    assignmentId: number;
    visitorUserId: number;
    teamId: number | null | undefined;
    dateStr: string;
    shiftType: 'early' | 'late' | 'night';
    weekNumber: number;
  }): Promise<void> {
    const historyUuid = uuidv7();
    await this.databaseService.query(
      `INSERT INTO shift_rotation_history
       (tenant_id, pattern_id, assignment_id, user_id, team_id, shift_date, shift_type, week_number, status, uuid, uuid_created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'generated', $9, NOW())
       ON CONFLICT (tenant_id, user_id, shift_date) DO UPDATE SET
       shift_type = EXCLUDED.shift_type, pattern_id = EXCLUDED.pattern_id, assignment_id = EXCLUDED.assignment_id`,
      [
        params.tenantId,
        params.patternId,
        params.assignmentId,
        params.visitorUserId,
        params.teamId ?? null,
        params.dateStr,
        this.mapShiftTypeToGroup(params.shiftType),
        params.weekNumber,
        historyUuid,
      ],
    );
  }

  /** Advances cycle state and returns updated values */
  private advanceCycleState(
    dayInCycle: number,
    currentShiftIndex: number,
    cycleLength: number,
  ): { dayInCycle: number; currentShiftIndex: number } {
    const newDayInCycle = dayInCycle + 1;
    if (newDayInCycle >= cycleLength) {
      return { dayInCycle: 0, currentShiftIndex: currentShiftIndex + 1 };
    }
    return { dayInCycle: newDayInCycle, currentShiftIndex };
  }

  /** Generates shift history entries for a single user assignment */
  private async generateUserShiftHistory(params: {
    assignmentId: number;
    userId: number;
    startGroup: 'F' | 'S' | 'N';
    patternId: number;
    teamId: number | null | undefined;
    config: GenerateRotationFromConfigDto['config'];
    start: Date;
    totalDays: number;
    tenantId: number;
  }): Promise<number> {
    const {
      config,
      start,
      totalDays,
      tenantId,
      patternId,
      teamId,
      assignmentId,
      userId,
    } = params;
    const { shiftBlockLength, freeDays, shiftSequence, specialRules } = config;
    const cycleLength = shiftBlockLength + freeDays;
    const typedRules = specialRules as
      | { type: string; weekday: number; n: number }[]
      | undefined;

    let currentShiftIndex = this.getGroupStartIndex(
      params.startGroup,
      shiftSequence,
    );
    let dayInCycle = 0;
    let shiftCount = 0;

    for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + dayOffset);
      const isWorkDay = dayInCycle % cycleLength < shiftBlockLength;
      const shouldSkip = this.shouldSkipBySpecialRules(currentDate, typedRules);

      if (isWorkDay && !shouldSkip) {
        const shiftType =
          shiftSequence[currentShiftIndex % shiftSequence.length] ?? 'early';
        await this.insertHistoryEntry({
          tenantId,
          patternId,
          assignmentId,
          visitorUserId: userId,
          teamId,
          dateStr: currentDate.toISOString().split('T')[0] ?? '',
          shiftType,
          weekNumber: this.getWeekNumber(currentDate),
        });
        shiftCount++;
      }
      ({ dayInCycle, currentShiftIndex } = this.advanceCycleState(
        dayInCycle,
        currentShiftIndex,
        cycleLength,
      ));
    }
    return shiftCount;
  }

  /** Creates assignment and history entries for a single user, returns shift count */
  private async createAssignmentWithHistory(
    assignment: { userId: number; startGroup: 'F' | 'S' | 'N' },
    patternId: number,
    teamId: number | null | undefined,
    config: GenerateRotationFromConfigDto['config'],
    start: Date,
    totalDays: number,
    tenantId: number,
    userId: number,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const assignmentUuid = uuidv7();
    const assignmentResult = await this.databaseService.query<{ id: number }>(
      `INSERT INTO shift_rotation_assignments
       (tenant_id, pattern_id, user_id, team_id, shift_group, starts_at, ends_at, assigned_by, uuid, uuid_created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING id`,
      [
        tenantId,
        patternId,
        assignment.userId,
        teamId ?? null,
        assignment.startGroup,
        startDate,
        endDate,
        userId,
        assignmentUuid,
      ],
    );
    const assignmentId = assignmentResult[0]?.id ?? 0;

    return await this.generateUserShiftHistory({
      assignmentId,
      userId: assignment.userId,
      startGroup: assignment.startGroup,
      patternId,
      teamId,
      config,
      start,
      totalDays,
      tenantId,
    });
  }

  /**
   * Generate rotation shifts from algorithm config
   */
  async generateRotationFromConfig(
    dto: GenerateRotationFromConfigDto,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<Record<string, unknown>> {
    this.logger.debug(`Generating rotation from config for tenant ${tenantId}`);

    if (userRole !== 'admin' && userRole !== 'root') {
      throw new ForbiddenException('Only admins can generate rotation shifts');
    }

    const { config, assignments, startDate, endDate, teamId } = dto;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays =
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    await this.validateTeamExists(teamId, tenantId);
    await this.validateAssignmentUserIds(assignments, tenantId);

    await this.databaseService.query('BEGIN', []);

    try {
      const patternId = await this.createPatternForConfig(
        config,
        teamId,
        startDate,
        endDate,
        tenantId,
        userId,
      );

      let totalShifts = 0;
      for (const assignment of assignments) {
        const shiftCount = await this.createAssignmentWithHistory(
          assignment,
          patternId,
          teamId,
          config,
          start,
          totalDays,
          tenantId,
          userId,
          startDate,
          endDate,
        );
        totalShifts += shiftCount;
      }

      await this.databaseService.query('COMMIT', []);
      return { success: true, shiftsCreated: totalShifts, patternId };
    } catch (error) {
      await this.databaseService.query('ROLLBACK', []);
      this.logger.error('Failed to generate rotation from config', error);
      throw new InternalServerErrorException(
        'Failed to generate rotation shifts',
      );
    }
  }

  // ============================================================
  // HISTORY
  // ============================================================

  /**
   * Get rotation history
   */
  async getRotationHistory(
    tenantId: number,
    filters: RotationHistoryFilters,
  ): Promise<RotationHistoryResponse[]> {
    this.logger.debug(`Getting rotation history for tenant ${tenantId}`);

    let query = `
      SELECT
        h.*,
        u.username,
        u.first_name,
        u.last_name,
        p.name as pattern_name
      FROM shift_rotation_history h
      JOIN users u ON h.user_id = u.id
      JOIN shift_rotation_patterns p ON h.pattern_id = p.id
      WHERE h.tenant_id = $1
    `;

    const params: (string | number)[] = [tenantId];

    if (filters.patternId !== undefined) {
      const paramIndex = params.length + 1;
      query += ` AND h.pattern_id = $${paramIndex}`;
      params.push(filters.patternId);
    }

    if (filters.teamId !== undefined) {
      const paramIndex = params.length + 1;
      query += ` AND h.team_id = $${paramIndex}`;
      params.push(filters.teamId);
    }

    if (filters.userId !== undefined) {
      const paramIndex = params.length + 1;
      query += ` AND h.user_id = $${paramIndex}`;
      params.push(filters.userId);
    }

    if (filters.startDate !== undefined && filters.startDate !== '') {
      const paramIndex = params.length + 1;
      query += ` AND h.shift_date >= $${paramIndex}`;
      params.push(filters.startDate);
    }

    if (filters.endDate !== undefined && filters.endDate !== '') {
      const paramIndex = params.length + 1;
      query += ` AND h.shift_date <= $${paramIndex}`;
      params.push(filters.endDate);
    }

    if (filters.status !== undefined && filters.status !== '') {
      const paramIndex = params.length + 1;
      query += ` AND h.status = $${paramIndex}`;
      params.push(filters.status);
    }

    query += ' ORDER BY h.shift_date DESC, h.user_id';

    const rows = await this.databaseService.query<DbHistoryRow>(query, params);
    return rows.map(
      (row: DbHistoryRow) =>
        dbToApi(
          row as unknown as Record<string, unknown>,
        ) as RotationHistoryResponse,
    );
  }

  /** Helper: Execute DELETE query and return count */
  private async executeDeleteWithCount(
    query: string,
    params: unknown[],
  ): Promise<number> {
    const result = await this.databaseService.query<{ count: string }>(
      query,
      params,
    );
    return Number.parseInt(result[0]?.count ?? '0', 10);
  }

  /** Helper: Build shifts delete query based on pattern filter */
  private buildShiftsDeleteQuery(hasPatternId: boolean): string {
    const patternFilter = hasPatternId ? 'AND h.pattern_id = $3' : '';
    return `WITH to_delete AS (
      SELECT DISTINCT h.user_id, h.shift_date FROM shift_rotation_history h
      WHERE h.tenant_id = $1 AND h.team_id = $2 ${patternFilter}
    ), deleted AS (
      DELETE FROM shifts s USING to_delete td
      WHERE s.tenant_id = $1 AND s.team_id = $2 AND s.user_id = td.user_id AND s.date = td.shift_date
      RETURNING s.*
    ) SELECT COUNT(*) as count FROM deleted`;
  }

  /**
   * Delete rotation history for a team
   * @param patternId - Optional: if provided, only delete this specific pattern
   */
  async deleteRotationHistory(
    tenantId: number,
    teamId: number,
    userRole: string,
    patternId?: number,
  ): Promise<DeleteHistoryCountsResponse> {
    const hasPatternId = patternId !== undefined;
    this.logger.debug(
      `Deleting ${hasPatternId ? `pattern ${patternId}` : 'all patterns'} for team ${teamId}`,
    );

    if (userRole !== 'admin' && userRole !== 'root') {
      throw new ForbiddenException('Only admins can delete rotation history');
    }

    await this.databaseService.query('BEGIN', []);

    try {
      const params =
        hasPatternId ? [tenantId, teamId, patternId] : [tenantId, teamId];
      const patternCond = hasPatternId ? 'AND pattern_id = $3' : '';

      // Delete in order: shifts → history → assignments → patterns → plans
      const shifts = await this.executeDeleteWithCount(
        this.buildShiftsDeleteQuery(hasPatternId),
        params,
      );

      const history = await this.executeDeleteWithCount(
        `WITH d AS (DELETE FROM shift_rotation_history WHERE tenant_id=$1 AND team_id=$2 ${patternCond} RETURNING *) SELECT COUNT(*) as count FROM d`,
        params,
      );

      const assignments = await this.executeDeleteWithCount(
        `WITH d AS (DELETE FROM shift_rotation_assignments WHERE tenant_id=$1 AND team_id=$2 ${patternCond} RETURNING *) SELECT COUNT(*) as count FROM d`,
        params,
      );

      const patternQuery =
        hasPatternId ?
          `WITH d AS (DELETE FROM shift_rotation_patterns WHERE tenant_id=$1 AND team_id=$2 AND id=$3 RETURNING *) SELECT COUNT(*) as count FROM d`
        : `WITH d AS (DELETE FROM shift_rotation_patterns WHERE tenant_id=$1 AND team_id=$2 RETURNING *) SELECT COUNT(*) as count FROM d`;
      const patterns = await this.executeDeleteWithCount(patternQuery, params);

      // Delete plans only when deleting ALL patterns
      let plans = 0;
      if (!hasPatternId) {
        plans = await this.executeDeleteWithCount(
          `WITH d AS (DELETE FROM shift_plans WHERE tenant_id=$1 AND team_id=$2 RETURNING *) SELECT COUNT(*) as count FROM d`,
          [tenantId, teamId],
        );
      }

      await this.databaseService.query('COMMIT', []);
      return { patterns, assignments, history, shifts, plans };
    } catch (error) {
      await this.databaseService.query('ROLLBACK', []);
      throw error;
    }
  }

  /**
   * Delete rotation history by date range
   */
  async deleteRotationHistoryByDateRange(
    tenantId: number,
    teamId: number,
    startDate: string,
    endDate: string,
    userRole: string,
  ): Promise<DeleteHistoryCountsResponse> {
    this.logger.debug(
      `Deleting rotation history for team ${teamId} from ${startDate} to ${endDate}`,
    );

    if (userRole !== 'admin' && userRole !== 'root') {
      throw new ForbiddenException('Only admins can delete rotation history');
    }

    const result = await this.databaseService.query<{ count: string }>(
      `WITH deleted AS (
        DELETE FROM shift_rotation_history
        WHERE tenant_id = $1 AND team_id = $2 AND shift_date >= $3 AND shift_date <= $4
        RETURNING *
      ) SELECT COUNT(*) as count FROM deleted`,
      [tenantId, teamId, startDate, endDate],
    );

    const historyDeleted = Number.parseInt(result[0]?.count ?? '0', 10);

    return {
      patterns: 0,
      assignments: 0,
      history: historyDeleted,
    };
  }

  /**
   * Delete single rotation history entry
   */
  async deleteRotationHistoryEntry(
    historyId: number,
    tenantId: number,
    userRole: string,
  ): Promise<void> {
    this.logger.debug(
      `Deleting rotation history entry ${historyId} for tenant ${tenantId}`,
    );

    if (userRole !== 'admin' && userRole !== 'root') {
      throw new ForbiddenException(
        'Only admins can delete rotation history entries',
      );
    }

    const result = await this.databaseService.query<{ count: string }>(
      `WITH deleted AS (
        DELETE FROM shift_rotation_history WHERE id = $1 AND tenant_id = $2 RETURNING *
      ) SELECT COUNT(*) as count FROM deleted`,
      [historyId, tenantId],
    );

    const deletedCount = Number.parseInt(result[0]?.count ?? '0', 10);

    if (deletedCount === 0) {
      throw new NotFoundException(
        `Rotation history entry ${historyId} not found`,
      );
    }
  }

  // ============================================================
  // UUID-BASED METHODS (P1 Migration)
  // ============================================================

  /**
   * Resolve pattern UUID to internal ID
   */
  private async resolvePatternIdByUuid(
    uuid: string,
    tenantId: number,
  ): Promise<number> {
    const result = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM shift_rotation_patterns WHERE uuid = $1 AND tenant_id = $2`,
      [uuid, tenantId],
    );
    if (result[0] === undefined) {
      throw new NotFoundException(
        `Rotation pattern with UUID ${uuid} not found`,
      );
    }
    return result[0].id;
  }

  /**
   * Get rotation pattern by UUID
   */
  async getRotationPatternByUuid(
    uuid: string,
    tenantId: number,
  ): Promise<RotationPatternResponse> {
    const patternId = await this.resolvePatternIdByUuid(uuid, tenantId);
    return await this.getRotationPattern(patternId, tenantId);
  }

  /**
   * Update rotation pattern by UUID
   */
  async updateRotationPatternByUuid(
    uuid: string,
    dto: UpdateRotationPatternDto,
    tenantId: number,
    userRole: string,
  ): Promise<RotationPatternResponse> {
    const patternId = await this.resolvePatternIdByUuid(uuid, tenantId);
    return await this.updateRotationPattern(patternId, dto, tenantId, userRole);
  }

  /**
   * Delete rotation pattern by UUID
   */
  async deleteRotationPatternByUuid(
    uuid: string,
    tenantId: number,
    userRole: string,
  ): Promise<void> {
    const patternId = await this.resolvePatternIdByUuid(uuid, tenantId);
    await this.deleteRotationPattern(patternId, tenantId, userRole);
  }
}
