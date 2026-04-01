/**
 * Unit tests for slot-assistant-helpers — assignment count functions
 *
 * Tests buildDateIntervalMap(), buildPlanAssignmentCounts(),
 * and COUNT_INTERVAL_COLUMNS.
 * Private helpers (processIntervals, toSortedAssignmentCounts) are
 * tested indirectly via buildPlanAssignmentCounts().
 */
import { describe, expect, it } from 'vitest';

import {
  COUNT_INTERVAL_COLUMNS,
  buildDateIntervalMap,
  buildPlanAssignmentCounts,
} from './slot-assistant-helpers.js';

import type { AssignmentCount } from './slot-assistant-helpers.js';
import type { IntervalType, ProjectedSlot, TpmPlanAssignment } from '../../../_admin/types.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const PLAN_UUID = 'plan-001';
const OTHER_PLAN = 'plan-002';
const DATE_A = '2026-03-01';
const DATE_B = '2026-03-11';
const DATE_C = '2026-04-01';

function makeSlot(overrides: Partial<ProjectedSlot> = {}): ProjectedSlot {
  return {
    planUuid: PLAN_UUID,
    planName: 'Wartungsplan A',
    assetId: 1,
    assetName: 'Presse P17',
    intervalTypes: ['monthly'],
    date: DATE_A,
    startTime: '08:00:00',
    endTime: '10:00:00',
    bufferHours: 2,
    isFullDay: false,
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<TpmPlanAssignment> = {}): TpmPlanAssignment {
  return {
    uuid: 'assign-001',
    userId: 10,
    firstName: 'Warren',
    lastName: 'Buffett',
    userName: 'Warren Buffett',
    scheduledDate: DATE_A,
    ...overrides,
  };
}

// =============================================================================
// COUNT_INTERVAL_COLUMNS
// =============================================================================

describe('COUNT_INTERVAL_COLUMNS', () => {
  it('should contain exactly 5 interval types (no daily/weekly)', () => {
    expect(COUNT_INTERVAL_COLUMNS).toHaveLength(5);
    expect(COUNT_INTERVAL_COLUMNS).toEqual([
      'monthly',
      'quarterly',
      'semi_annual',
      'annual',
      'custom',
    ]);
  });

  it('should not include daily or weekly', () => {
    expect(COUNT_INTERVAL_COLUMNS).not.toContain('daily');
    expect(COUNT_INTERVAL_COLUMNS).not.toContain('weekly');
  });
});

// =============================================================================
// buildDateIntervalMap — basics
// =============================================================================

describe('buildDateIntervalMap – basics', () => {
  it('should return empty map for empty slots', () => {
    const result = buildDateIntervalMap([], PLAN_UUID);
    expect(result.size).toBe(0);
  });

  it('should build date → interval set for matching plan', () => {
    const slots = [
      makeSlot({ date: DATE_A, intervalTypes: ['monthly'] }),
      makeSlot({ date: DATE_B, intervalTypes: ['quarterly'] }),
    ];

    const result = buildDateIntervalMap(slots, PLAN_UUID);

    expect(result.size).toBe(2);
    expect(result.get(DATE_A)).toEqual(new Set(['monthly']));
    expect(result.get(DATE_B)).toEqual(new Set(['quarterly']));
  });

  it('should merge multiple intervals for same date', () => {
    const slots = [
      makeSlot({
        date: DATE_A,
        intervalTypes: ['monthly', 'quarterly', 'annual'],
      }),
    ];

    const result = buildDateIntervalMap(slots, PLAN_UUID);

    expect(result.get(DATE_A)).toEqual(new Set(['monthly', 'quarterly', 'annual']));
  });

  it('should filter out slots from other plans', () => {
    const slots = [
      makeSlot({ planUuid: PLAN_UUID, date: DATE_A }),
      makeSlot({ planUuid: OTHER_PLAN, date: DATE_B }),
    ];

    const result = buildDateIntervalMap(slots, PLAN_UUID);

    expect(result.size).toBe(1);
    expect(result.has(DATE_A)).toBe(true);
    expect(result.has(DATE_B)).toBe(false);
  });

  it('should merge intervals from multiple slots on same date', () => {
    const slots = [
      makeSlot({ date: DATE_A, intervalTypes: ['monthly'] }),
      makeSlot({ date: DATE_A, intervalTypes: ['quarterly'] }),
    ];

    const result = buildDateIntervalMap(slots, PLAN_UUID);

    expect(result.get(DATE_A)).toEqual(new Set(['monthly', 'quarterly']));
  });
});

// =============================================================================
// buildPlanAssignmentCounts — empty inputs
// =============================================================================

describe('buildPlanAssignmentCounts – empty inputs', () => {
  it('should return empty array for empty assignments', () => {
    const idx = new Map<string, Set<IntervalType>>([
      [DATE_A, new Set(['monthly'] as IntervalType[])],
    ]);
    expect(buildPlanAssignmentCounts([], idx)).toEqual([]);
  });

  it('should return empty array for empty date index', () => {
    const items = [makeAssignment()];
    expect(buildPlanAssignmentCounts(items, new Map())).toEqual([]);
  });

  it('should return empty array when both are empty', () => {
    expect(buildPlanAssignmentCounts([], new Map())).toEqual([]);
  });
});

// =============================================================================
// buildPlanAssignmentCounts — single assignment
// =============================================================================

describe('buildPlanAssignmentCounts – single assignment', () => {
  it('should count one assignment in one interval', () => {
    const items = [makeAssignment({ scheduledDate: DATE_A })];
    const idx = new Map<string, Set<IntervalType>>([
      [DATE_A, new Set(['monthly'] as IntervalType[])],
    ]);

    const result = buildPlanAssignmentCounts(items, idx);

    expect(result).toHaveLength(1);
    expect(result[0].counts.monthly).toBe(1);
    expect(result[0].total).toBe(1);
    expect(result[0].lastName).toBe('Buffett');
  });

  it('should skip assignment when date has no match in index', () => {
    const items = [makeAssignment({ scheduledDate: '2026-05-01' })];
    const idx = new Map<string, Set<IntervalType>>([
      [DATE_A, new Set(['monthly'] as IntervalType[])],
    ]);

    expect(buildPlanAssignmentCounts(items, idx)).toEqual([]);
  });
});

// =============================================================================
// buildPlanAssignmentCounts — cascade dates (multi-interval)
// =============================================================================

describe('buildPlanAssignmentCounts – cascade dates', () => {
  it('should count cascade date across multiple intervals', () => {
    const items = [makeAssignment({ scheduledDate: DATE_A })];
    const idx = new Map<string, Set<IntervalType>>([
      [DATE_A, new Set(['monthly', 'quarterly', 'annual'] as IntervalType[])],
    ]);

    const result = buildPlanAssignmentCounts(items, idx);

    expect(result).toHaveLength(1);
    expect(result[0].counts.monthly).toBe(1);
    expect(result[0].counts.quarterly).toBe(1);
    expect(result[0].counts.annual).toBe(1);
    expect(result[0].total).toBe(3);
  });
});

// =============================================================================
// buildPlanAssignmentCounts — multiple employees
// =============================================================================

describe('buildPlanAssignmentCounts – multiple employees', () => {
  it('should count separately per employee', () => {
    const items = [
      makeAssignment({
        uuid: 'a1',
        userId: 10,
        firstName: 'Warren',
        lastName: 'Buffett',
        scheduledDate: DATE_A,
      }),
      makeAssignment({
        uuid: 'a2',
        userId: 20,
        firstName: 'Ray',
        lastName: 'Dalio',
        scheduledDate: DATE_A,
      }),
    ];
    const idx = new Map<string, Set<IntervalType>>([
      [DATE_A, new Set(['monthly'] as IntervalType[])],
    ]);

    const result = buildPlanAssignmentCounts(items, idx);

    expect(result).toHaveLength(2);
    expect(result[0].lastName).toBe('Buffett');
    expect(result[0].total).toBe(1);
    expect(result[1].lastName).toBe('Dalio');
    expect(result[1].total).toBe(1);
  });

  it('should aggregate across multiple dates per employee', () => {
    const items = [
      makeAssignment({ uuid: 'a1', userId: 10, scheduledDate: DATE_A }),
      makeAssignment({ uuid: 'a2', userId: 10, scheduledDate: DATE_B }),
    ];
    const idx = new Map<string, Set<IntervalType>>([
      [DATE_A, new Set(['monthly'] as IntervalType[])],
      [DATE_B, new Set(['monthly'] as IntervalType[])],
    ]);

    const result = buildPlanAssignmentCounts(items, idx);

    expect(result).toHaveLength(1);
    expect(result[0].counts.monthly).toBe(2);
    expect(result[0].total).toBe(2);
  });
});

// =============================================================================
// buildPlanAssignmentCounts — deduplication
// =============================================================================

describe('buildPlanAssignmentCounts – deduplication', () => {
  it('should not double-count same userId+date+interval', () => {
    const items = [
      makeAssignment({ uuid: 'a1', userId: 10, scheduledDate: DATE_A }),
      makeAssignment({ uuid: 'a2', userId: 10, scheduledDate: DATE_A }),
    ];
    const idx = new Map<string, Set<IntervalType>>([
      [DATE_A, new Set(['monthly'] as IntervalType[])],
    ]);

    const result = buildPlanAssignmentCounts(items, idx);

    expect(result).toHaveLength(1);
    expect(result[0].counts.monthly).toBe(1);
    expect(result[0].total).toBe(1);
  });
});

// =============================================================================
// buildPlanAssignmentCounts — sorting
// =============================================================================

describe('buildPlanAssignmentCounts – sorting', () => {
  it('should sort by lastName, firstName (German locale)', () => {
    const items = [
      makeAssignment({
        uuid: 'a3',
        userId: 30,
        firstName: 'Tupac',
        lastName: 'Shakur',
        scheduledDate: DATE_A,
      }),
      makeAssignment({
        uuid: 'a1',
        userId: 10,
        firstName: 'Warren',
        lastName: 'Buffett',
        scheduledDate: DATE_A,
      }),
      makeAssignment({
        uuid: 'a2',
        userId: 20,
        firstName: 'Ray',
        lastName: 'Dalio',
        scheduledDate: DATE_A,
      }),
    ];
    const idx = new Map<string, Set<IntervalType>>([
      [DATE_A, new Set(['monthly'] as IntervalType[])],
    ]);

    const result = buildPlanAssignmentCounts(items, idx);

    expect(result.map((r: AssignmentCount) => r.lastName)).toEqual(['Buffett', 'Dalio', 'Shakur']);
  });
});

// =============================================================================
// Integration: buildDateIntervalMap + buildPlanAssignmentCounts
// =============================================================================

describe('Integration – end-to-end counts', () => {
  it('should produce correct counts from slots + assignments', () => {
    const slots: ProjectedSlot[] = [
      makeSlot({ date: DATE_A, intervalTypes: ['monthly', 'quarterly'] }),
      makeSlot({ date: DATE_C, intervalTypes: ['monthly'] }),
      makeSlot({
        planUuid: OTHER_PLAN,
        date: DATE_B,
        intervalTypes: ['annual'],
      }),
    ];
    const dateIntervals = buildDateIntervalMap(slots, PLAN_UUID);
    const assignments: TpmPlanAssignment[] = [
      makeAssignment({ uuid: 'a1', userId: 10, scheduledDate: DATE_A }),
      makeAssignment({ uuid: 'a2', userId: 10, scheduledDate: DATE_C }),
      makeAssignment({
        uuid: 'a3',
        userId: 20,
        firstName: 'Ray',
        lastName: 'Dalio',
        scheduledDate: DATE_A,
      }),
    ];

    const result = buildPlanAssignmentCounts(assignments, dateIntervals);

    expect(result).toHaveLength(2);
    // Buffett: DATE_A monthly+quarterly + DATE_C monthly → total=3
    expect(result[0].lastName).toBe('Buffett');
    expect(result[0].counts.monthly).toBe(2);
    expect(result[0].counts.quarterly).toBe(1);
    expect(result[0].total).toBe(3);
    // Dalio: DATE_A monthly+quarterly → total=2
    expect(result[1].lastName).toBe('Dalio');
    expect(result[1].counts.monthly).toBe(1);
    expect(result[1].counts.quarterly).toBe(1);
    expect(result[1].total).toBe(2);
  });
});

describe('Integration – plan filtering', () => {
  it('should ignore slots from other plans in date interval map', () => {
    const slots: ProjectedSlot[] = [
      makeSlot({
        planUuid: OTHER_PLAN,
        date: DATE_A,
        intervalTypes: ['monthly'],
      }),
    ];
    const dateIntervals = buildDateIntervalMap(slots, PLAN_UUID);

    const result = buildPlanAssignmentCounts(
      [makeAssignment({ scheduledDate: DATE_A })],
      dateIntervals,
    );

    expect(result).toEqual([]);
  });
});
