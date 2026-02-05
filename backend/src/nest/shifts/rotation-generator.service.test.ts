/**
 * Unit tests for RotationGeneratorService
 *
 * Phase 9: Service tests — mocked DatabaseService.
 * Private algorithm logic tested through public generateRotationShifts().
 * Focus: shift type determination, weekend skipping, preview mode.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { RotationGeneratorService } from './rotation-generator.service.js';
import type { RotationPatternResponse } from './rotation.types.js';

// =============================================================
// Mocks
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
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

function createMockAssignment(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    user_id: 42,
    shift_group: 'F',
    team_id: 10,
    ...overrides,
  };
}

// =============================================================
// RotationGeneratorService
// =============================================================

describe('RotationGeneratorService', () => {
  let service: RotationGeneratorService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-05T12:00:00Z'));
    mockDb = createMockDb();
    service = new RotationGeneratorService(
      mockDb as unknown as DatabaseService,
    );
  });

  // =============================================================
  // generateRotationShifts — preview mode
  // =============================================================

  describe('generateRotationShifts', () => {
    it('should generate shifts for a single assignment in preview mode', async () => {
      const pattern = createMinimalPattern();
      const assignment = createMockAssignment();
      mockDb.query.mockResolvedValueOnce([assignment]);

      const result = await service.generateRotationShifts(
        pattern,
        {
          patternId: 1,
          startDate: '2026-02-02',
          endDate: '2026-02-06',
          preview: true,
        },
        1,
      );

      expect(result.shifts.length).toBeGreaterThan(0);
      expect(result.shifts[0]?.userId).toBe(42);
      // Preview: no additional DB calls beyond the assignment query
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
      );

      expect(result.shifts).toHaveLength(0);
    });

    it('should skip Saturdays and Sundays when skipWeekends is configured', async () => {
      const pattern = createMinimalPattern({
        patternType: 'alternate_fs',
        patternConfig: { skipWeekends: true },
      });
      const assignment = createMockAssignment();
      mockDb.query.mockResolvedValueOnce([assignment]);

      const result = await service.generateRotationShifts(
        pattern,
        // Mon Feb 2 to Sun Feb 8 (7 days, 2 weekends)
        {
          patternId: 1,
          startDate: '2026-02-02',
          endDate: '2026-02-08',
          preview: true,
        },
        1,
      );

      const dates = result.shifts.map((s) => s.date);
      // Saturday Feb 7 and Sunday Feb 8 should be skipped
      expect(dates).not.toContain('2026-02-07');
      expect(dates).not.toContain('2026-02-08');
      expect(result.shifts).toHaveLength(5); // Mon-Fri
    });

    it('should keep night shift workers in N when nightShiftStatic is true', async () => {
      const pattern = createMinimalPattern({
        patternType: 'alternate_fs',
        patternConfig: { nightShiftStatic: true },
      });
      const assignment = createMockAssignment({ shift_group: 'N' });
      mockDb.query.mockResolvedValueOnce([assignment]);

      const result = await service.generateRotationShifts(
        pattern,
        {
          patternId: 1,
          startDate: '2026-02-02',
          endDate: '2026-02-06',
          preview: true,
        },
        1,
      );

      const allNight = result.shifts.every((s) => s.shiftType === 'N');
      expect(allNight).toBe(true);
    });

    it('should return N for all shifts when pattern is fixed_n', async () => {
      const pattern = createMinimalPattern({ patternType: 'fixed_n' });
      const assignment = createMockAssignment({ shift_group: 'F' });
      mockDb.query.mockResolvedValueOnce([assignment]);

      const result = await service.generateRotationShifts(
        pattern,
        {
          patternId: 1,
          startDate: '2026-02-02',
          endDate: '2026-02-04',
          preview: true,
        },
        1,
      );

      const allNight = result.shifts.every((s) => s.shiftType === 'N');
      expect(allNight).toBe(true);
    });

    it('should generate shifts for multiple assignments', async () => {
      const pattern = createMinimalPattern();
      mockDb.query.mockResolvedValueOnce([
        createMockAssignment({ user_id: 10, shift_group: 'F' }),
        createMockAssignment({ user_id: 20, shift_group: 'S' }),
      ]);

      const result = await service.generateRotationShifts(
        pattern,
        {
          patternId: 1,
          startDate: '2026-02-02',
          endDate: '2026-02-03',
          preview: true,
        },
        1,
      );

      const user10Shifts = result.shifts.filter((s) => s.userId === 10);
      const user20Shifts = result.shifts.filter((s) => s.userId === 20);
      expect(user10Shifts.length).toBeGreaterThan(0);
      expect(user20Shifts.length).toBeGreaterThan(0);
    });
  });
});
