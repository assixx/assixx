/**
 * Unit tests for RotationGeneratorService
 *
 * Phase 9: Initial 6 tests (preview mode basics).
 * Phase 14 Batch A1: Deepened to 35 tests.
 * Covers: shift type determination, weekend skipping, save mode with
 * transactions, config-based generation, special rules, cycle advancement.
 */
import { InternalServerErrorException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { GenerateRotationFromConfigDto } from './dto/rotation-config.dto.js';
import { RotationGeneratorService } from './rotation-generator.service.js';
import type { RotationPatternResponse } from './rotation.types.js';

// =============================================================
// Mocks
// =============================================================

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('mock-uuid-v7'),
}));

function createMockDb(): {
  query: ReturnType<typeof vi.fn>;
  tenantQuery: ReturnType<typeof vi.fn>;
  tenantQueryOne: ReturnType<typeof vi.fn>;
} {
  const query = vi.fn();
  return { query, tenantQuery: query, tenantQueryOne: vi.fn() };
}

function createMinimalPattern(
  overrides?: Partial<RotationPatternResponse>,
): RotationPatternResponse {
  return {
    id: 1,
    teamId: null,
    name: 'Test Pattern',
    patternType: 'alternate_fs',
    patternConfig: {},
    cycleLengthWeeks: 2,
    startsAt: '2026-02-02', // Monday
    endsAt: null,
    isActive: 1,
    createdBy: 1,
    createdAt: '2026-01-01',
    ...overrides,
  } as RotationPatternResponse;
}

function createMockAssignment(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 1,
    user_id: 42,
    shift_group: 'F',
    team_id: 10,
    ...overrides,
  };
}

function createConfigDto(overrides?: Record<string, unknown>): GenerateRotationFromConfigDto {
  return {
    config: {
      shiftBlockLength: 2,
      freeDays: 1,
      startShift: 'early',
      shiftSequence: ['early', 'late', 'night'],
    },
    assignments: [{ userId: 42, userName: 'Test', startGroup: 'F' }],
    startDate: '2026-02-02',
    endDate: '2026-02-04',
    teamId: 10,
    ...overrides,
  } as unknown as GenerateRotationFromConfigDto;
}

/** Mock DB to route by SQL content for config-based tests */
function setupConfigDbMock(
  db: { query: ReturnType<typeof vi.fn> },
  opts?: {
    patternId?: number;
    onHistoryInsert?: (params: unknown[]) => void;
  },
): void {
  let assignmentCounter = 0;
  db.query.mockImplementation((sql: string, params?: unknown[]) => {
    if (
      typeof sql === 'string' &&
      sql.includes('shift_rotation_patterns') &&
      sql.includes('RETURNING')
    ) {
      return Promise.resolve([{ id: opts?.patternId ?? 100 }]);
    }
    if (
      typeof sql === 'string' &&
      sql.includes('shift_rotation_assignments') &&
      sql.includes('RETURNING')
    ) {
      assignmentCounter++;
      return Promise.resolve([{ id: 200 + assignmentCounter - 1 }]);
    }
    if (
      typeof sql === 'string' &&
      sql.includes('shift_rotation_history') &&
      sql.includes('INSERT') &&
      opts?.onHistoryInsert !== undefined
    ) {
      const paramArray = params as unknown[];
      opts.onHistoryInsert(paramArray);
    }
    return Promise.resolve([]);
  });
}

// =============================================================
// Tests
// =============================================================

const mockActivityLogger = {
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
  log: vi.fn().mockResolvedValue(undefined),
};

describe('RotationGeneratorService', () => {
  let service: RotationGeneratorService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-05T12:00:00Z'));
    mockDb = createMockDb();
    service = new RotationGeneratorService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =============================================================
  // generateRotationShifts
  // =============================================================

  describe('generateRotationShifts', () => {
    // ----- PREVIEW MODE -----

    describe('preview mode', () => {
      it('should generate shifts for a single assignment', async () => {
        mockDb.query.mockResolvedValueOnce([createMockAssignment()]);

        const result = await service.generateRotationShifts(
          createMinimalPattern(),
          {
            patternId: 1,
            startDate: '2026-02-02',
            endDate: '2026-02-06',
            preview: true,
          },
          1,
          1,
        );

        expect(result.shifts.length).toBeGreaterThan(0);
        expect(result.shifts[0]?.userId).toBe(42);
        expect(mockDb.query).toHaveBeenCalledTimes(1);
      });

      it('should return empty shifts when no active assignments exist', async () => {
        mockDb.query.mockResolvedValueOnce([]);

        const result = await service.generateRotationShifts(
          createMinimalPattern(),
          {
            patternId: 1,
            startDate: '2026-02-02',
            endDate: '2026-02-06',
            preview: true,
          },
          1,
          1,
        );

        expect(result.shifts).toHaveLength(0);
      });

      it('should skip Saturdays and Sundays when skipWeekends is configured', async () => {
        const pattern = createMinimalPattern({
          patternConfig: { skipWeekends: true },
        });
        mockDb.query.mockResolvedValueOnce([createMockAssignment()]);

        const result = await service.generateRotationShifts(
          pattern,
          {
            patternId: 1,
            startDate: '2026-02-02',
            endDate: '2026-02-08',
            preview: true,
          },
          1,
          1,
        );

        const dates = result.shifts.map((s) => s.date);
        expect(dates).not.toContain('2026-02-07');
        expect(dates).not.toContain('2026-02-08');
        expect(result.shifts).toHaveLength(5);
      });

      it('should keep night shift workers in N when nightShiftStatic is true', async () => {
        const pattern = createMinimalPattern({
          patternConfig: { nightShiftStatic: true },
        });
        mockDb.query.mockResolvedValueOnce([createMockAssignment({ shift_group: 'N' })]);

        const result = await service.generateRotationShifts(
          pattern,
          {
            patternId: 1,
            startDate: '2026-02-02',
            endDate: '2026-02-06',
            preview: true,
          },
          1,
          1,
        );

        expect(result.shifts.every((s) => s.shiftType === 'N')).toBe(true);
      });

      it('should return N for all shifts when pattern is fixed_n', async () => {
        const pattern = createMinimalPattern({ patternType: 'fixed_n' });
        mockDb.query.mockResolvedValueOnce([createMockAssignment({ shift_group: 'F' })]);

        const result = await service.generateRotationShifts(
          pattern,
          {
            patternId: 1,
            startDate: '2026-02-02',
            endDate: '2026-02-04',
            preview: true,
          },
          1,
          1,
        );

        expect(result.shifts.every((s) => s.shiftType === 'N')).toBe(true);
      });

      it('should generate shifts for multiple assignments', async () => {
        mockDb.query.mockResolvedValueOnce([
          createMockAssignment({ user_id: 10, shift_group: 'F' }),
          createMockAssignment({ user_id: 20, shift_group: 'S' }),
        ]);

        const result = await service.generateRotationShifts(
          createMinimalPattern(),
          {
            patternId: 1,
            startDate: '2026-02-02',
            endDate: '2026-02-03',
            preview: true,
          },
          1,
          1,
        );

        const user10 = result.shifts.filter((s) => s.userId === 10);
        const user20 = result.shifts.filter((s) => s.userId === 20);
        expect(user10.length).toBeGreaterThan(0);
        expect(user20.length).toBeGreaterThan(0);
      });

      it('should generate exactly 1 shift for a single-day range', async () => {
        mockDb.query.mockResolvedValueOnce([createMockAssignment()]);

        const result = await service.generateRotationShifts(
          createMinimalPattern(),
          {
            patternId: 1,
            startDate: '2026-02-02',
            endDate: '2026-02-02',
            preview: true,
          },
          1,
          1,
        );

        expect(result.shifts).toHaveLength(1);
        expect(result.shifts[0]?.date).toBe('2026-02-02');
      });
    });

    // ----- SHIFT TYPE DETERMINATION -----

    describe('shift type determination', () => {
      it('should alternate F→S for F-group with nightShiftStatic', async () => {
        const pattern = createMinimalPattern({
          patternConfig: { nightShiftStatic: true },
        });
        mockDb.query.mockResolvedValueOnce([createMockAssignment({ shift_group: 'F' })]);

        const result = await service.generateRotationShifts(
          pattern,
          {
            patternId: 1,
            startDate: '2026-02-02',
            endDate: '2026-02-15',
            preview: true,
          },
          1,
          1,
        );

        const week0 = result.shifts.filter((s) => s.date < '2026-02-09');
        const week1 = result.shifts.filter((s) => s.date >= '2026-02-09');
        expect(week0.every((s) => s.shiftType === 'F')).toBe(true);
        expect(week1.every((s) => s.shiftType === 'S')).toBe(true);
      });

      it('should alternate S→F for S-group with nightShiftStatic', async () => {
        const pattern = createMinimalPattern({
          patternConfig: { nightShiftStatic: true },
        });
        mockDb.query.mockResolvedValueOnce([createMockAssignment({ shift_group: 'S' })]);

        const result = await service.generateRotationShifts(
          pattern,
          {
            patternId: 1,
            startDate: '2026-02-02',
            endDate: '2026-02-15',
            preview: true,
          },
          1,
          1,
        );

        const week0 = result.shifts.filter((s) => s.date < '2026-02-09');
        const week1 = result.shifts.filter((s) => s.date >= '2026-02-09');
        expect(week0.every((s) => s.shiftType === 'S')).toBe(true);
        expect(week1.every((s) => s.shiftType === 'F')).toBe(true);
      });

      it('should cycle F→S→N for 3-shift rotation without nightShiftStatic', async () => {
        const pattern = createMinimalPattern({ patternConfig: {} });
        mockDb.query.mockResolvedValueOnce([createMockAssignment()]);

        const result = await service.generateRotationShifts(
          pattern,
          {
            patternId: 1,
            startDate: '2026-02-02',
            endDate: '2026-02-22',
            preview: true,
          },
          1,
          1,
        );

        const week0 = result.shifts.filter((s) => s.date < '2026-02-09');
        const week1 = result.shifts.filter((s) => s.date >= '2026-02-09' && s.date < '2026-02-16');
        const week2 = result.shifts.filter((s) => s.date >= '2026-02-16');
        expect(week0.every((s) => s.shiftType === 'F')).toBe(true);
        expect(week1.every((s) => s.shiftType === 'S')).toBe(true);
        expect(week2.every((s) => s.shiftType === 'N')).toBe(true);
      });

      it('should wrap 3-shift rotation back to F after N', async () => {
        const pattern = createMinimalPattern({ patternConfig: {} });
        mockDb.query.mockResolvedValueOnce([createMockAssignment()]);

        const result = await service.generateRotationShifts(
          pattern,
          {
            patternId: 1,
            startDate: '2026-02-02',
            endDate: '2026-03-01',
            preview: true,
          },
          1,
          1,
        );

        const week3 = result.shifts.filter((s) => s.date >= '2026-02-23');
        expect(week3.every((s) => s.shiftType === 'F')).toBe(true);
      });

      it('should return raw shiftGroup for non-weekly pattern', async () => {
        const pattern = createMinimalPattern({
          patternType: 'custom',
          patternConfig: { cycleWeeks: 4 },
        });
        mockDb.query.mockResolvedValueOnce([createMockAssignment({ shift_group: 'S' })]);

        const result = await service.generateRotationShifts(
          pattern,
          {
            patternId: 1,
            startDate: '2026-02-02',
            endDate: '2026-02-04',
            preview: true,
          },
          1,
          1,
        );

        expect(result.shifts.every((s) => s.shiftType === 'S')).toBe(true);
      });

      it('should treat custom with cycleWeeks=1 as weekly rotation', async () => {
        const pattern = createMinimalPattern({
          patternType: 'custom',
          patternConfig: { cycleWeeks: 1, nightShiftStatic: true },
        });
        mockDb.query.mockResolvedValueOnce([createMockAssignment({ shift_group: 'F' })]);

        const result = await service.generateRotationShifts(
          pattern,
          {
            patternId: 1,
            startDate: '2026-02-02',
            endDate: '2026-02-15',
            preview: true,
          },
          1,
          1,
        );

        const week0 = result.shifts.filter((s) => s.date < '2026-02-09');
        const week1 = result.shifts.filter((s) => s.date >= '2026-02-09');
        expect(week0.every((s) => s.shiftType === 'F')).toBe(true);
        expect(week1.every((s) => s.shiftType === 'S')).toBe(true);
      });

      it('should treat ignoreNightShift as alias for nightShiftStatic', async () => {
        const pattern = createMinimalPattern({
          patternConfig: { ignoreNightShift: true },
        });
        mockDb.query.mockResolvedValueOnce([createMockAssignment({ shift_group: 'N' })]);

        const result = await service.generateRotationShifts(
          pattern,
          {
            patternId: 1,
            startDate: '2026-02-02',
            endDate: '2026-02-06',
            preview: true,
          },
          1,
          1,
        );

        expect(result.shifts.every((s) => s.shiftType === 'N')).toBe(true);
      });

      it('should use patternStart for week calculation, not startDate', async () => {
        // Pattern starts Jan 26 (one week before generation range)
        const pattern = createMinimalPattern({
          startsAt: '2026-01-26',
          patternConfig: { nightShiftStatic: true },
        });
        mockDb.query.mockResolvedValueOnce([createMockAssignment({ shift_group: 'F' })]);

        const result = await service.generateRotationShifts(
          pattern,
          {
            patternId: 1,
            startDate: '2026-02-02',
            endDate: '2026-02-03',
            preview: true,
          },
          1,
          1,
        );

        // Feb 2 is week 1 relative to Jan 26 → cycleWeek=1%2=1 → S for F-group
        expect(result.shifts.every((s) => s.shiftType === 'S')).toBe(true);
      });
    });

    // ----- WEEKEND SKIPPING -----

    describe('weekend skipping', () => {
      it('should skip only Saturday when skipSaturday is true', async () => {
        const pattern = createMinimalPattern({
          patternConfig: { skipSaturday: true },
        });
        mockDb.query.mockResolvedValueOnce([createMockAssignment()]);

        const result = await service.generateRotationShifts(
          pattern,
          {
            patternId: 1,
            startDate: '2026-02-02',
            endDate: '2026-02-08',
            preview: true,
          },
          1,
          1,
        );

        const dates = result.shifts.map((s) => s.date);
        expect(dates).not.toContain('2026-02-07'); // Saturday skipped
        expect(dates).toContain('2026-02-08'); // Sunday included
        expect(result.shifts).toHaveLength(6);
      });

      it('should skip only Sunday when skipSunday is true', async () => {
        const pattern = createMinimalPattern({
          patternConfig: { skipSunday: true },
        });
        mockDb.query.mockResolvedValueOnce([createMockAssignment()]);

        const result = await service.generateRotationShifts(
          pattern,
          {
            patternId: 1,
            startDate: '2026-02-02',
            endDate: '2026-02-08',
            preview: true,
          },
          1,
          1,
        );

        const dates = result.shifts.map((s) => s.date);
        expect(dates).toContain('2026-02-07'); // Saturday included
        expect(dates).not.toContain('2026-02-08'); // Sunday skipped
        expect(result.shifts).toHaveLength(6);
      });
    });

    // ----- SAVE MODE -----

    describe('save mode', () => {
      it('should save shifts to DB with BEGIN/INSERT/COMMIT', async () => {
        mockDb.query
          .mockResolvedValueOnce([createMockAssignment()]) // assignments
          .mockResolvedValueOnce([]) // BEGIN
          .mockResolvedValueOnce([]) // SELECT existing 1 (none)
          .mockResolvedValueOnce([]) // INSERT history 1
          .mockResolvedValueOnce([]) // SELECT existing 2 (none)
          .mockResolvedValueOnce([]) // INSERT history 2
          .mockResolvedValueOnce([]); // COMMIT

        const result = await service.generateRotationShifts(
          createMinimalPattern(),
          {
            patternId: 1,
            startDate: '2026-02-02',
            endDate: '2026-02-03',
            preview: false,
          },
          1,
          1,
        );

        expect(result.shifts).toHaveLength(2);
        const calls = mockDb.query.mock.calls;
        expect(calls[1]?.[0]).toBe('BEGIN');
        expect(calls[calls.length - 1]?.[0]).toBe('COMMIT');
      });

      it('should skip INSERT when shift already exists in DB', async () => {
        mockDb.query
          .mockResolvedValueOnce([createMockAssignment()]) // assignments
          .mockResolvedValueOnce([]) // BEGIN
          .mockResolvedValueOnce([{ id: 99 }]) // shift 1 EXISTS
          .mockResolvedValueOnce([]) // SELECT shift 2 (none)
          .mockResolvedValueOnce([]) // INSERT shift 2
          .mockResolvedValueOnce([]); // COMMIT

        await service.generateRotationShifts(
          createMinimalPattern(),
          {
            patternId: 1,
            startDate: '2026-02-02',
            endDate: '2026-02-03',
            preview: false,
          },
          1,
          1,
        );

        // 6 calls: assignments, BEGIN, SELECT(exists), SELECT, INSERT, COMMIT
        expect(mockDb.query).toHaveBeenCalledTimes(6);
      });

      it('should ROLLBACK on error during save', async () => {
        mockDb.query
          .mockResolvedValueOnce([createMockAssignment()]) // assignments
          .mockResolvedValueOnce([]) // BEGIN
          .mockResolvedValueOnce([]) // SELECT (none)
          .mockRejectedValueOnce(new Error('DB write error')) // INSERT fails
          .mockResolvedValueOnce([]); // ROLLBACK

        await expect(
          service.generateRotationShifts(
            createMinimalPattern(),
            {
              patternId: 1,
              startDate: '2026-02-02',
              endDate: '2026-02-03',
              preview: false,
            },
            1,
            1,
          ),
        ).rejects.toThrow('DB write error');

        const lastCall = mockDb.query.mock.calls[mockDb.query.mock.calls.length - 1];
        expect(lastCall?.[0]).toBe('ROLLBACK');
      });

      it('should not save when no shifts are generated', async () => {
        mockDb.query.mockResolvedValueOnce([]); // no assignments

        const result = await service.generateRotationShifts(
          createMinimalPattern(),
          {
            patternId: 1,
            startDate: '2026-02-02',
            endDate: '2026-02-03',
            preview: false,
          },
          1,
          1,
        );

        expect(result.shifts).toHaveLength(0);
        expect(mockDb.query).toHaveBeenCalledTimes(1);
      });

      it('should include correct weekNumber in INSERT params', async () => {
        mockDb.query
          .mockResolvedValueOnce([createMockAssignment()]) // assignments
          .mockResolvedValueOnce([]) // BEGIN
          .mockResolvedValueOnce([]) // SELECT (none)
          .mockResolvedValueOnce([]) // INSERT history
          .mockResolvedValueOnce([]); // COMMIT

        await service.generateRotationShifts(
          createMinimalPattern(),
          {
            patternId: 1,
            startDate: '2026-02-02',
            endDate: '2026-02-02',
            preview: false,
          },
          1,
          1,
        );

        // INSERT call is at index 3; weekNumber is param[7]
        const insertParams = mockDb.query.mock.calls[3]?.[1] as unknown[];
        expect(typeof insertParams?.[7]).toBe('number');
        expect(insertParams?.[7]).toBeGreaterThan(0);
      });
    });
  });

  // =============================================================
  // generateRotationFromConfig
  // =============================================================

  describe('generateRotationFromConfig', () => {
    it('should create pattern, assignment, and history in transaction', async () => {
      setupConfigDbMock(mockDb);

      const result = await service.generateRotationFromConfig(createConfigDto(), 1, 5);

      expect(result).toEqual({
        success: true,
        shiftsCreated: 2,
        patternId: 100,
      });
      const calls = mockDb.query.mock.calls;
      expect(calls[0]?.[0]).toBe('BEGIN');
      expect(calls[calls.length - 1]?.[0]).toBe('COMMIT');
    });

    it('should ROLLBACK and throw InternalServerErrorException on failure', async () => {
      mockDb.query
        .mockResolvedValueOnce([]) // BEGIN
        .mockRejectedValueOnce(new Error('Insert failed')) // INSERT pattern
        .mockResolvedValueOnce([]); // ROLLBACK

      await expect(service.generateRotationFromConfig(createConfigDto(), 1, 5)).rejects.toThrow(
        InternalServerErrorException,
      );

      const lastCall = mockDb.query.mock.calls[mockDb.query.mock.calls.length - 1];
      expect(lastCall?.[0]).toBe('ROLLBACK');
    });

    it('should handle multiple assignments', async () => {
      setupConfigDbMock(mockDb);

      const dto = createConfigDto({
        assignments: [
          { userId: 42, userName: 'User A', startGroup: 'F' },
          { userId: 43, userName: 'User B', startGroup: 'S' },
        ],
      });

      const result = await service.generateRotationFromConfig(dto, 1, 5);

      // 2 assignments × 2 work days each = 4 shifts
      expect(result).toEqual({
        success: true,
        shiftsCreated: 4,
        patternId: 100,
      });
    });

    it('should create gaps for free days in cycle', async () => {
      setupConfigDbMock(mockDb);

      const dto = createConfigDto({
        config: {
          shiftBlockLength: 2,
          freeDays: 2,
          startShift: 'early',
          shiftSequence: ['early', 'late', 'night'],
        },
        startDate: '2026-02-02',
        endDate: '2026-02-05', // 4 days: work, work, free, free
      });

      const result = await service.generateRotationFromConfig(dto, 1, 5);

      expect(result).toEqual({
        success: true,
        shiftsCreated: 2,
        patternId: 100,
      });
    });

    it('should skip days matching nth_weekday_free special rule', async () => {
      setupConfigDbMock(mockDb);

      // Feb 13, 2026 is the 2nd Friday (weekday=5)
      const dto = createConfigDto({
        config: {
          shiftBlockLength: 14,
          freeDays: 0,
          startShift: 'early',
          shiftSequence: ['early', 'late', 'night'],
          specialRules: [{ type: 'nth_weekday_free', weekday: 5, n: 2 }],
        },
        startDate: '2026-02-12', // Thursday
        endDate: '2026-02-14', // Saturday — 3 days, Feb 13 skipped
      });

      const result = await service.generateRotationFromConfig(dto, 1, 5);

      expect(result).toEqual({
        success: true,
        shiftsCreated: 2,
        patternId: 100,
      });
    });

    it('should cycle through shift sequence types', async () => {
      const insertedShiftTypes: string[] = [];
      setupConfigDbMock(mockDb, {
        onHistoryInsert: (params) => {
          insertedShiftTypes.push(String(params[6]));
        },
      });

      // shiftBlockLength=1, freeDays=0 → new shift type each day
      const dto = createConfigDto({
        config: {
          shiftBlockLength: 1,
          freeDays: 0,
          startShift: 'early',
          shiftSequence: ['early', 'late', 'night'],
        },
        startDate: '2026-02-02',
        endDate: '2026-02-04', // 3 days
      });

      await service.generateRotationFromConfig(dto, 1, 5);

      // F-group starts at index 0: early→F, late→S, night→N
      expect(insertedShiftTypes).toEqual(['F', 'S', 'N']);
    });

    it('should start S-group at late position in sequence', async () => {
      const insertedShiftTypes: string[] = [];
      setupConfigDbMock(mockDb, {
        onHistoryInsert: (params) => {
          insertedShiftTypes.push(String(params[6]));
        },
      });

      const dto = createConfigDto({
        config: {
          shiftBlockLength: 1,
          freeDays: 0,
          startShift: 'early',
          shiftSequence: ['early', 'late', 'night'],
        },
        assignments: [{ userId: 42, userName: 'Test', startGroup: 'S' }],
        startDate: '2026-02-02',
        endDate: '2026-02-04',
      });

      await service.generateRotationFromConfig(dto, 1, 5);

      // S→late is at index 1: late→S, night→N, early→F
      expect(insertedShiftTypes).toEqual(['S', 'N', 'F']);
    });

    it('should start N-group at night position in sequence', async () => {
      const insertedShiftTypes: string[] = [];
      setupConfigDbMock(mockDb, {
        onHistoryInsert: (params) => {
          insertedShiftTypes.push(String(params[6]));
        },
      });

      const dto = createConfigDto({
        config: {
          shiftBlockLength: 1,
          freeDays: 0,
          startShift: 'early',
          shiftSequence: ['early', 'late', 'night'],
        },
        assignments: [{ userId: 42, userName: 'Test', startGroup: 'N' }],
        startDate: '2026-02-02',
        endDate: '2026-02-04',
      });

      await service.generateRotationFromConfig(dto, 1, 5);

      // N→night is at index 2: night→N, early→F, late→S
      expect(insertedShiftTypes).toEqual(['N', 'F', 'S']);
    });

    it('should pass null teamId when teamId is undefined', async () => {
      let capturedTeamId: unknown = 'not-set';
      mockDb.query.mockImplementation((sql: string, params?: unknown[]) => {
        if (
          typeof sql === 'string' &&
          sql.includes('shift_rotation_patterns') &&
          sql.includes('RETURNING')
        ) {
          capturedTeamId = (params as unknown[])?.[1];
          return Promise.resolve([{ id: 100 }]);
        }
        if (
          typeof sql === 'string' &&
          sql.includes('shift_rotation_assignments') &&
          sql.includes('RETURNING')
        ) {
          return Promise.resolve([{ id: 200 }]);
        }
        return Promise.resolve([]);
      });

      const dto = createConfigDto();
      delete (dto as Record<string, unknown>).teamId;

      await service.generateRotationFromConfig(dto, 1, 5);

      expect(capturedTeamId).toBeNull();
    });

    it('should generate all work days when freeDays is 0', async () => {
      setupConfigDbMock(mockDb);

      const dto = createConfigDto({
        config: {
          shiftBlockLength: 5,
          freeDays: 0,
          startShift: 'early',
          shiftSequence: ['early', 'late', 'night'],
        },
        startDate: '2026-02-02',
        endDate: '2026-02-06', // 5 days, all work
      });

      const result = await service.generateRotationFromConfig(dto, 1, 5);

      expect(result).toEqual({
        success: true,
        shiftsCreated: 5,
        patternId: 100,
      });
    });

    it('should fall back to index 0 when group not found in sequence', async () => {
      const insertedShiftTypes: string[] = [];
      setupConfigDbMock(mockDb, {
        onHistoryInsert: (params) => {
          insertedShiftTypes.push(String(params[6]));
        },
      });

      // Sequence has no 'late' → S-group indexOf('late')=-1 → fallback to 0
      const dto = createConfigDto({
        config: {
          shiftBlockLength: 1,
          freeDays: 0,
          startShift: 'early',
          shiftSequence: ['early', 'night', 'early'],
        },
        assignments: [{ userId: 42, userName: 'Test', startGroup: 'S' }],
        startDate: '2026-02-02',
        endDate: '2026-02-03', // 2 days
      });

      await service.generateRotationFromConfig(dto, 1, 5);

      // Falls back to index 0 (early→F), then index 1 (night→N)
      expect(insertedShiftTypes).toEqual(['F', 'N']);
    });
  });
});
