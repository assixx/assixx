/**
 * Unit tests for Overall View (Gesamtansicht) utility functions
 *
 * Tests buildMatrix(), formatDate(), formatTimeRange(), isFullDay()
 * and INTERVAL_COLUMNS.
 * indexSlots() is private — tested indirectly via buildMatrix().
 */
import { describe, expect, it } from 'vitest';

import {
  INTERVAL_COLUMNS,
  buildMatrix,
  buildDateIndex,
  buildAssignmentCounts,
  formatDate,
  formatTimeRange,
  isFullDay,
} from './overall-view-utils.js';

import type { MatrixRow, TpmAssignmentCount } from './overall-view-utils.js';
import type { IntervalType, ProjectedSlot, TpmPlan, TpmShiftAssignment } from '../../_lib/types.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const DEFAULT_PLAN_UUID = 'plan-001';
const DEFAULT_DATE = '2026-03-01';
const SECOND_DATE = '2026-03-11';

function makePlan(overrides: Partial<TpmPlan> = {}): TpmPlan {
  return {
    uuid: DEFAULT_PLAN_UUID,
    assetId: 1,
    assetName: 'Presse P17',
    name: 'Wartungsplan A',
    baseWeekday: 1,
    baseRepeatEvery: 1,
    baseTime: '08:00:00',
    bufferHours: 2,
    shiftPlanRequired: false,
    notes: null,
    createdBy: 1,
    isActive: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeSlot(overrides: Partial<ProjectedSlot> = {}): ProjectedSlot {
  return {
    planUuid: DEFAULT_PLAN_UUID,
    planName: 'Wartungsplan A',
    assetId: 1,
    assetName: 'Presse P17',
    intervalTypes: ['monthly'],
    date: DEFAULT_DATE,
    startTime: '08:00:00',
    endTime: '10:00:00',
    bufferHours: 2,
    isFullDay: false,
    ...overrides,
  };
}

// =============================================================================
// INTERVAL_COLUMNS
// =============================================================================

describe('INTERVAL_COLUMNS', () => {
  it('should contain exactly 5 interval types (no daily/weekly)', () => {
    expect(INTERVAL_COLUMNS).toHaveLength(5);
    expect(INTERVAL_COLUMNS).toEqual(['monthly', 'quarterly', 'semi_annual', 'annual', 'custom']);
  });

  it('should not include daily or weekly', () => {
    expect(INTERVAL_COLUMNS).not.toContain('daily');
    expect(INTERVAL_COLUMNS).not.toContain('weekly');
  });
});

// =============================================================================
// buildMatrix — basic behavior
// =============================================================================

describe('buildMatrix – basics', () => {
  it('should return empty array for empty plans', () => {
    const result = buildMatrix([], [], 4);
    expect(result).toEqual([]);
  });

  it('should return one row per plan with empty cells when no slots', () => {
    const plans = [makePlan()];
    const result = buildMatrix(plans, [], 4);

    expect(result).toHaveLength(1);
    expect(result[0].plan.uuid).toBe(DEFAULT_PLAN_UUID);

    for (const col of INTERVAL_COLUMNS) {
      expect(result[0].cells[col]).toEqual([]);
    }
  });

  it('should assign slot dates to correct plan × interval cell', () => {
    const plans = [makePlan()];
    const slots = [
      makeSlot({ date: DEFAULT_DATE, intervalTypes: ['monthly'] }),
      makeSlot({ date: '2026-04-01', intervalTypes: ['monthly'] }),
      makeSlot({ date: '2026-07-01', intervalTypes: ['quarterly'] }),
    ];

    const result = buildMatrix(plans, slots, 4);

    expect(result[0].cells.monthly).toEqual([DEFAULT_DATE, '2026-04-01']);
    expect(result[0].cells.quarterly).toEqual(['2026-07-01']);
    expect(result[0].cells.annual).toEqual([]);
  });

  it('should return correct MatrixRow shape', () => {
    const plans = [makePlan()];
    const result: MatrixRow[] = buildMatrix(plans, [], 4);

    expect(result[0]).toHaveProperty('plan');
    expect(result[0]).toHaveProperty('cells');
    expect(result[0].plan).toBe(plans[0]);
  });
});

// =============================================================================
// buildMatrix — sorting, capping, dedup
// =============================================================================

describe('buildMatrix – sorting & capping', () => {
  it('should sort dates ascending within each cell', () => {
    const plans = [makePlan()];
    const slots = [
      makeSlot({ date: '2026-06-01', intervalTypes: ['monthly'] }),
      makeSlot({ date: DEFAULT_DATE, intervalTypes: ['monthly'] }),
      makeSlot({ date: '2026-09-01', intervalTypes: ['monthly'] }),
    ];

    const result = buildMatrix(plans, slots, 10);
    expect(result[0].cells.monthly).toEqual([DEFAULT_DATE, '2026-06-01', '2026-09-01']);
  });

  it('should cap dates at maxDates', () => {
    const plans = [makePlan()];
    const slots = Array.from({ length: 8 }, (_: unknown, i: number) =>
      makeSlot({
        date: `2026-${String(i + 1).padStart(2, '0')}-01`,
        intervalTypes: ['monthly'],
      }),
    );

    const resultCap4 = buildMatrix(plans, slots, 4);
    expect(resultCap4[0].cells.monthly).toHaveLength(4);

    const resultCap10 = buildMatrix(plans, slots, 10);
    expect(resultCap10[0].cells.monthly).toHaveLength(8);
  });

  it('should deduplicate same date for same plan × interval', () => {
    const plans = [makePlan()];
    const slots = [
      makeSlot({ date: DEFAULT_DATE, intervalTypes: ['monthly'] }),
      makeSlot({ date: DEFAULT_DATE, intervalTypes: ['monthly'] }),
    ];

    const result = buildMatrix(plans, slots, 4);
    expect(result[0].cells.monthly).toEqual([DEFAULT_DATE]);
  });
});

// =============================================================================
// buildMatrix — multi-interval & multi-plan
// =============================================================================

describe('buildMatrix – multi-interval & multi-plan', () => {
  it('should handle slot with multiple intervalTypes', () => {
    const plans = [makePlan()];
    const slots = [
      makeSlot({
        date: '2026-01-01',
        intervalTypes: ['monthly', 'quarterly', 'annual'],
      }),
    ];

    const result = buildMatrix(plans, slots, 4);
    expect(result[0].cells.monthly).toEqual(['2026-01-01']);
    expect(result[0].cells.quarterly).toEqual(['2026-01-01']);
    expect(result[0].cells.annual).toEqual(['2026-01-01']);
    expect(result[0].cells.semi_annual).toEqual([]);
  });

  it('should handle multiple plans independently', () => {
    const plans = [
      makePlan({ uuid: 'plan-A', assetName: 'Anlage A' }),
      makePlan({ uuid: 'plan-B', assetName: 'Anlage B' }),
    ];
    const slots = [
      makeSlot({
        planUuid: 'plan-A',
        date: DEFAULT_DATE,
        intervalTypes: ['monthly'],
      }),
      makeSlot({
        planUuid: 'plan-B',
        date: '2026-06-01',
        intervalTypes: ['quarterly'],
      }),
    ];

    const result = buildMatrix(plans, slots, 4);

    expect(result).toHaveLength(2);
    expect(result[0].cells.monthly).toEqual([DEFAULT_DATE]);
    expect(result[0].cells.quarterly).toEqual([]);
    expect(result[1].cells.monthly).toEqual([]);
    expect(result[1].cells.quarterly).toEqual(['2026-06-01']);
  });

  it('should ignore slots for plans not in the plans array', () => {
    const plans = [makePlan({ uuid: 'plan-A' })];
    const slots = [
      makeSlot({
        planUuid: 'plan-X',
        date: DEFAULT_DATE,
        intervalTypes: ['monthly'],
      }),
    ];

    const result = buildMatrix(plans, slots, 4);
    expect(result[0].cells.monthly).toEqual([]);
  });
});

// =============================================================================
// formatDate
// =============================================================================

describe('formatDate', () => {
  it('should format ISO date to German DD.MM.YYYY', () => {
    expect(formatDate(DEFAULT_DATE)).toBe('01.03.2026');
  });

  it('should format different dates correctly', () => {
    expect(formatDate('2026-12-25')).toBe('25.12.2026');
    expect(formatDate('2027-01-01')).toBe('01.01.2027');
  });
});

// =============================================================================
// formatTimeRange
// =============================================================================

describe('formatTimeRange', () => {
  it('should return start – end time range', () => {
    expect(formatTimeRange('09:00:00', 5)).toBe('09:00 – 14:00');
  });

  it('should handle zero buffer hours', () => {
    expect(formatTimeRange('08:00:00', 0)).toBe('08:00 – 08:00');
  });

  it('should handle minutes in base time', () => {
    expect(formatTimeRange('08:30:00', 2)).toBe('08:30 – 10:30');
  });

  it('should wrap around midnight', () => {
    expect(formatTimeRange('22:00:00', 4)).toBe('22:00 – 02:00');
  });

  it('should return empty string for null', () => {
    expect(formatTimeRange(null, 5)).toBe('');
  });

  it('should return empty string for empty/whitespace string', () => {
    expect(formatTimeRange('', 5)).toBe('');
    expect(formatTimeRange('   ', 5)).toBe('');
  });

  it('should handle HH:MM format (no seconds)', () => {
    expect(formatTimeRange('08:00', 3)).toBe('08:00 – 11:00');
  });
});

// =============================================================================
// isFullDay
// =============================================================================

describe('isFullDay', () => {
  it('should return true for null', () => {
    expect(isFullDay(null)).toBe(true);
  });

  it('should return true for empty string', () => {
    expect(isFullDay('')).toBe(true);
    expect(isFullDay('   ')).toBe(true);
  });

  it('should return false for valid time', () => {
    expect(isFullDay('08:00:00')).toBe(false);
    expect(isFullDay('14:30')).toBe(false);
  });
});

// =============================================================================
// buildAssignmentCounts — Test Fixtures
// =============================================================================

function makeAssignment(overrides: Partial<TpmShiftAssignment> = {}): TpmShiftAssignment {
  return {
    planUuid: DEFAULT_PLAN_UUID,
    assetId: 1,
    shiftDate: DEFAULT_DATE,
    userId: 10,
    firstName: 'Warren',
    lastName: 'Buffett',
    shiftType: 'early',
    ...overrides,
  };
}

/** Entry for building a test date index */
interface DateIndexEntry {
  planUuid: string;
  date: string;
  intervals: IntervalType[];
}

/** Build a dateIndex from plan UUID + dates → interval sets */
function makeDateIndex(entries: DateIndexEntry[]): Map<string, Set<IntervalType>> {
  const idx = new Map<string, Set<IntervalType>>();
  for (const e of entries) {
    idx.set(`${e.planUuid}:${e.date}`, new Set(e.intervals));
  }
  return idx;
}

// =============================================================================
// buildAssignmentCounts — empty inputs
// =============================================================================

describe('buildAssignmentCounts – empty inputs', () => {
  it('should return empty array for empty assignments', () => {
    const idx = makeDateIndex([{ planUuid: 'p1', date: DEFAULT_DATE, intervals: ['monthly'] }]);
    expect(buildAssignmentCounts([], idx)).toEqual([]);
  });

  it('should return empty array for empty date index', () => {
    const items = [makeAssignment()];
    const idx = new Map<string, Set<IntervalType>>();
    expect(buildAssignmentCounts(items, idx)).toEqual([]);
  });

  it('should return empty array when both are empty', () => {
    expect(buildAssignmentCounts([], new Map())).toEqual([]);
  });
});

// =============================================================================
// buildAssignmentCounts — single assignment
// =============================================================================

describe('buildAssignmentCounts – single assignment', () => {
  it('should count one assignment in one interval', () => {
    const items = [makeAssignment({ planUuid: 'p1', shiftDate: DEFAULT_DATE })];
    const idx = makeDateIndex([{ planUuid: 'p1', date: DEFAULT_DATE, intervals: ['monthly'] }]);

    const result = buildAssignmentCounts(items, idx);

    expect(result).toHaveLength(1);
    expect(result[0].counts.monthly).toBe(1);
    expect(result[0].total).toBe(1);
    expect(result[0].lastName).toBe('Buffett');
  });

  it('should skip assignment when date has no match in index', () => {
    const items = [makeAssignment({ planUuid: 'p1', shiftDate: '2026-05-01' })];
    const idx = makeDateIndex([{ planUuid: 'p1', date: DEFAULT_DATE, intervals: ['monthly'] }]);

    expect(buildAssignmentCounts(items, idx)).toEqual([]);
  });
});

// =============================================================================
// buildAssignmentCounts — cascade dates (multi-interval)
// =============================================================================

describe('buildAssignmentCounts – cascade dates', () => {
  it('should count cascade date across multiple intervals', () => {
    const items = [makeAssignment({ planUuid: 'p1', shiftDate: DEFAULT_DATE })];
    const idx = makeDateIndex([
      {
        planUuid: 'p1',
        date: DEFAULT_DATE,
        intervals: ['monthly', 'quarterly', 'annual'],
      },
    ]);

    const result = buildAssignmentCounts(items, idx);

    expect(result).toHaveLength(1);
    expect(result[0].counts.monthly).toBe(1);
    expect(result[0].counts.quarterly).toBe(1);
    expect(result[0].counts.annual).toBe(1);
    expect(result[0].total).toBe(3);
  });
});

// =============================================================================
// buildAssignmentCounts — multiple employees & plans
// =============================================================================

describe('buildAssignmentCounts – multiple employees & plans', () => {
  it('should count separately per employee', () => {
    const items = [
      makeAssignment({
        userId: 10,
        firstName: 'Warren',
        lastName: 'Buffett',
        planUuid: 'p1',
        shiftDate: DEFAULT_DATE,
      }),
      makeAssignment({
        userId: 20,
        firstName: 'Ray',
        lastName: 'Dalio',
        planUuid: 'p1',
        shiftDate: DEFAULT_DATE,
      }),
    ];
    const idx = makeDateIndex([{ planUuid: 'p1', date: DEFAULT_DATE, intervals: ['monthly'] }]);

    const result = buildAssignmentCounts(items, idx);

    expect(result).toHaveLength(2);
    expect(result[0].lastName).toBe('Buffett');
    expect(result[0].total).toBe(1);
    expect(result[1].lastName).toBe('Dalio');
    expect(result[1].total).toBe(1);
  });

  it('should aggregate across multiple plans per employee', () => {
    const items = [
      makeAssignment({ userId: 10, planUuid: 'p1', shiftDate: DEFAULT_DATE }),
      makeAssignment({ userId: 10, planUuid: 'p2', shiftDate: SECOND_DATE }),
    ];
    const idx = makeDateIndex([
      { planUuid: 'p1', date: DEFAULT_DATE, intervals: ['monthly'] },
      { planUuid: 'p2', date: SECOND_DATE, intervals: ['monthly'] },
    ]);

    const result = buildAssignmentCounts(items, idx);

    expect(result).toHaveLength(1);
    expect(result[0].counts.monthly).toBe(2);
    expect(result[0].total).toBe(2);
  });
});

// =============================================================================
// buildAssignmentCounts — deduplication
// =============================================================================

describe('buildAssignmentCounts – deduplication', () => {
  it('should not double-count same userId+plan+date+interval', () => {
    const items = [
      makeAssignment({ userId: 10, planUuid: 'p1', shiftDate: DEFAULT_DATE }),
      makeAssignment({ userId: 10, planUuid: 'p1', shiftDate: DEFAULT_DATE }),
    ];
    const idx = makeDateIndex([{ planUuid: 'p1', date: DEFAULT_DATE, intervals: ['monthly'] }]);

    const result = buildAssignmentCounts(items, idx);

    expect(result).toHaveLength(1);
    expect(result[0].counts.monthly).toBe(1);
    expect(result[0].total).toBe(1);
  });
});

// =============================================================================
// buildAssignmentCounts — sorting
// =============================================================================

describe('buildAssignmentCounts – sorting', () => {
  it('should sort by lastName, firstName (German locale)', () => {
    const items = [
      makeAssignment({
        userId: 30,
        firstName: 'Tupac',
        lastName: 'Shakur',
        planUuid: 'p1',
        shiftDate: DEFAULT_DATE,
      }),
      makeAssignment({
        userId: 10,
        firstName: 'Warren',
        lastName: 'Buffett',
        planUuid: 'p1',
        shiftDate: DEFAULT_DATE,
      }),
      makeAssignment({
        userId: 20,
        firstName: 'Ray',
        lastName: 'Dalio',
        planUuid: 'p1',
        shiftDate: DEFAULT_DATE,
      }),
    ];
    const idx = makeDateIndex([{ planUuid: 'p1', date: DEFAULT_DATE, intervals: ['monthly'] }]);

    const result = buildAssignmentCounts(items, idx);

    expect(result.map((r: TpmAssignmentCount) => r.lastName)).toEqual([
      'Buffett',
      'Dalio',
      'Shakur',
    ]);
  });
});

// =============================================================================
// buildAssignmentCounts — integration with buildDateIndex
// =============================================================================

describe('buildAssignmentCounts – integration with buildDateIndex', () => {
  it('should work with dateIndex built from matrixRows', () => {
    const plans = [
      makePlan({ uuid: 'p1', assetName: 'Asset A' }),
      makePlan({ uuid: 'p2', assetName: 'Asset B' }),
    ];
    const slots: ProjectedSlot[] = [
      makeSlot({
        planUuid: 'p1',
        date: '2026-03-02',
        intervalTypes: ['monthly', 'quarterly'],
      }),
      makeSlot({
        planUuid: 'p2',
        date: SECOND_DATE,
        intervalTypes: ['monthly'],
      }),
    ];

    const matrix = buildMatrix(plans, slots, 4);
    const dateIdx = buildDateIndex(matrix);

    const assignments: TpmShiftAssignment[] = [
      makeAssignment({
        userId: 30,
        firstName: 'Tupac',
        lastName: 'Shakur',
        planUuid: 'p1',
        shiftDate: '2026-03-02',
      }),
      makeAssignment({
        userId: 30,
        firstName: 'Tupac',
        lastName: 'Shakur',
        planUuid: 'p2',
        shiftDate: SECOND_DATE,
      }),
      makeAssignment({
        userId: 10,
        firstName: 'Warren',
        lastName: 'Buffett',
        planUuid: 'p2',
        shiftDate: SECOND_DATE,
      }),
    ];

    const result = buildAssignmentCounts(assignments, dateIdx);

    expect(result).toHaveLength(2);

    // Buffett: p2 monthly = 1
    expect(result[0].lastName).toBe('Buffett');
    expect(result[0].counts.monthly).toBe(1);
    expect(result[0].total).toBe(1);

    // Shakur: p1 monthly=1, p1 quarterly=1, p2 monthly=1
    expect(result[1].lastName).toBe('Shakur');
    expect(result[1].counts.monthly).toBe(2);
    expect(result[1].counts.quarterly).toBe(1);
    expect(result[1].total).toBe(3);
  });
});
