/**
 * Rotation Generator Service
 *
 * Engine for generating shift rotation schedules.
 * Handles shift calculation, assignment creation, and history generation.
 *
 * Note: This service exceeds the 400-line sub-service guideline because the
 * shift generation algorithm is a tightly coupled state machine. Splitting it
 * would scatter related logic across files and harm readability.
 */
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { GenerateRotationShiftsDto } from './dto/generate-rotation-shifts.dto.js';
import type { GenerateRotationFromConfigDto } from './dto/rotation-config.dto.js';
import type {
  DbAssignmentRow,
  GeneratedShift,
  GeneratedShiftsResponse,
  PatternConfig,
  RotationPatternResponse,
} from './rotation.types.js';

@Injectable()
export class RotationGeneratorService {
  private readonly logger = new Logger(RotationGeneratorService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ============================================================
  // SHIFT TYPE DETERMINATION
  // ============================================================

  /** F/S alternate each cycle week; N stays static */
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

  /** Determine shift type based on pattern type, config, and week offset */
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

  // ============================================================
  // PATTERN-BASED GENERATION
  // ============================================================

  /** Generate shifts for a single assignment across the date range */
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

  /** Calculate ISO-ish week number for a date */
  private getWeekNumber(date: Date): number {
    const yearStart = new Date(date.getFullYear(), 0, 1);
    return Math.ceil(
      ((date.getTime() - yearStart.getTime()) / 86400000 +
        yearStart.getDay() +
        1) /
        7,
    );
  }

  /** @param pattern - Pre-fetched pattern from the facade (avoids duplicate DB lookup) */
  async generateRotationShifts(
    pattern: RotationPatternResponse,
    dto: GenerateRotationShiftsDto,
    tenantId: number,
    userId: number,
  ): Promise<GeneratedShiftsResponse> {
    this.logger.debug(`Generating rotation shifts for tenant ${tenantId}`);

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

      void this.activityLogger.logCreate(
        tenantId,
        userId,
        'rotation_pattern',
        dto.patternId,
        `Rotationsschichten generiert: ${generatedShifts.length} Schichten`,
        { patternId: dto.patternId, shiftCount: generatedShifts.length },
      );
    }

    return { shifts: generatedShifts };
  }

  /** Persist generated shifts to shift_rotation_history in a transaction */
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

  // ============================================================
  // CONFIG-BASED GENERATION
  // ============================================================

  /** Map shift type string to single-char group enum */
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

  /** Find starting position of a shift group in the rotation sequence */
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

  /** @example "Jeder 2. Freitag im Monat frei" -> skip every 2nd Friday */
  private shouldSkipBySpecialRules(
    date: Date,
    specialRules?: { type: string; weekday: number; n: number }[],
  ): boolean {
    if (!specialRules || specialRules.length === 0) {
      return false;
    }

    const dayOfWeek = date.getDay();
    const dayOfMonth = date.getDate();

    for (const rule of specialRules) {
      if (rule.type === 'nth_weekday_free') {
        if (dayOfWeek !== rule.weekday) {
          continue;
        }

        // Exact nth occurrence: floor((dayOfMonth - 1) / 7) + 1
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

  /** Create a rotation pattern DB record for config-based generation */
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

  /** Insert a single shift_rotation_history row with upsert */
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

  /** Advance day-in-cycle counter, rotating shift index at cycle boundary */
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

  /** Generate and persist shift history entries for a single user */
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

  /** Create assignment DB record and generate shift history for one user */
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
   * Generate rotation shifts from algorithm config.
   * Owns its own transaction: creates pattern, assignments, and history atomically.
   */
  async generateRotationFromConfig(
    dto: GenerateRotationFromConfigDto,
    tenantId: number,
    userId: number,
  ): Promise<Record<string, unknown>> {
    this.logger.debug(`Generating rotation from config for tenant ${tenantId}`);

    const { config, assignments, startDate, endDate, teamId } = dto;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays =
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

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

      void this.activityLogger.logCreate(
        tenantId,
        userId,
        'rotation_pattern',
        patternId,
        `Rotation generiert: ${totalShifts} Schichten`,
        { patternId, shiftsCreated: totalShifts, startDate, endDate },
      );

      return { success: true, shiftsCreated: totalShifts, patternId };
    } catch (error) {
      await this.databaseService.query('ROLLBACK', []);
      this.logger.error('Failed to generate rotation from config', error);
      throw new InternalServerErrorException(
        'Failed to generate rotation shifts',
      );
    }
  }
}
