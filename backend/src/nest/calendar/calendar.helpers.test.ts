/**
 * Unit tests for Calendar Helpers
 *
 * Phase 6: Pure function tests — 1 test per function, no mocking needed.
 * Phase 13 Batch D: Deepened — more branches, edge cases, recurrence types.
 */
import { describe, expect, it } from 'vitest';

import {
  ALLOWED_SORT_COLUMNS,
  ERROR_EVENT_NOT_FOUND,
  SORT_BY_MAP,
  addRecurrenceInterval,
  appendDateSearchFilters,
  buildVisibilityClause,
  calculateRecurrenceDates,
  dbToApiEvent,
  normalizePagination,
  validateSortColumn,
} from './calendar.helpers.js';
import type { DbCalendarEvent, EventFilters } from './calendar.types.js';

// ============================================
// Mock Factory
// ============================================

function createMockDbEvent(
  overrides?: Partial<DbCalendarEvent>,
): DbCalendarEvent {
  return {
    id: 1,
    uuid: 'abc-123',
    tenant_id: 10,
    user_id: 5,
    title: 'Team Meeting',
    description: 'Weekly sync',
    location: 'Room A',
    start_date: new Date('2025-06-01T09:00:00Z'),
    end_date: new Date('2025-06-01T10:00:00Z'),
    all_day: 0,
    type: 'meeting',
    status: 'confirmed',
    is_private: 0,
    reminder_minutes: 15,
    color: '#ff0000',
    recurrence_rule: null,
    parent_event_id: null,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-02'),
    org_level: 'department',
    department_id: 3,
    team_id: null,
    area_id: null,
    created_by_role: null,
    allow_attendees: 1,
    ...overrides,
  };
}

const emptyFilters: EventFilters = {
  status: undefined,
  filter: undefined,
  search: undefined,
  startDate: undefined,
  endDate: undefined,
  page: undefined,
  limit: undefined,
  sortBy: undefined,
  sortOrder: undefined,
};

// ============================================
// Constants
// ============================================

describe('calendar constants', () => {
  it('ERROR_EVENT_NOT_FOUND should be defined', () => {
    expect(ERROR_EVENT_NOT_FOUND).toBe('Event not found');
  });

  it('ALLOWED_SORT_COLUMNS should contain standard columns', () => {
    expect(ALLOWED_SORT_COLUMNS.has('start_date')).toBe(true);
    expect(ALLOWED_SORT_COLUMNS.has('title')).toBe(true);
    expect(ALLOWED_SORT_COLUMNS.has('created_at')).toBe(true);
  });

  it('SORT_BY_MAP should map camelCase to snake_case', () => {
    expect(SORT_BY_MAP['startDate']).toBe('start_date');
    expect(SORT_BY_MAP['createdAt']).toBe('created_at');
  });
});

// ============================================
// buildVisibilityClause
// ============================================

describe('buildVisibilityClause', () => {
  const fullScope = {
    type: 'full' as const,
    areaIds: [],
    departmentIds: [],
    teamIds: [],
    leadAreaIds: [],
    leadDepartmentIds: [],
    leadTeamIds: [],
    isAreaLead: false,
    isDepartmentLead: false,
    isTeamLead: false,
    isAnyLead: false,
  };

  const limitedScope = {
    ...fullScope,
    type: 'limited' as const,
    areaIds: [10, 20],
    departmentIds: [30],
    teamIds: [40, 50],
  };

  const noneScope = {
    ...fullScope,
    type: 'none' as const,
  };

  const memberships = { departmentIds: [31, 32], teamIds: [41] };
  const emptyMemberships = { departmentIds: [], teamIds: [] };

  it('should return empty clause for full scope', () => {
    const result = buildVisibilityClause(fullScope, emptyMemberships, 1, 3);

    expect(result.clause).toBe('');
    expect(result.params).toEqual([]);
  });

  it('should use ANY() with merged scope + membership arrays for limited scope', () => {
    const result = buildVisibilityClause(limitedScope, memberships, 99, 1);

    expect(result.clause).toContain("e.org_level = 'company'");
    expect(result.clause).toContain('e.area_id = ANY($1)');
    expect(result.clause).toContain('e.department_id = ANY($2)');
    expect(result.clause).toContain('e.team_id = ANY($3)');
    expect(result.clause).toContain('e.user_id = $4');
    // params: areaIds, deptIds (merged+deduplicated), teamIds (merged+deduplicated), userId
    const deptParam = result.params[1] as number[];
    const teamParam = result.params[2] as number[];
    expect(result.params[0]).toEqual([10, 20]); // areaIds from scope
    expect(new Set(deptParam)).toEqual(new Set([30, 31, 32])); // scope + memberships
    expect(new Set(teamParam)).toEqual(new Set([40, 50, 41])); // scope + memberships
    expect(result.params[3]).toBe(99); // userId
  });

  it('should use only membership arrays for none scope', () => {
    const result = buildVisibilityClause(noneScope, memberships, 5, 1);

    expect(result.clause).toContain("e.org_level = 'company'");
    expect(result.params[0]).toEqual([0]); // no areaIds → safe [0]
    expect(result.params[1]).toEqual([31, 32]); // memberships only
    expect(result.params[2]).toEqual([41]); // memberships only
    expect(result.params[3]).toBe(5); // userId
  });

  it('should use [0] fallback for empty arrays', () => {
    const result = buildVisibilityClause(noneScope, emptyMemberships, 1, 1);

    expect(result.params[0]).toEqual([0]); // safe fallback
    expect(result.params[1]).toEqual([0]); // safe fallback
    expect(result.params[2]).toEqual([0]); // safe fallback
  });

  it('should contain all org_level checks', () => {
    const result = buildVisibilityClause(limitedScope, memberships, 1, 1);

    expect(result.clause).toContain("e.org_level = 'area'");
    expect(result.clause).toContain("e.org_level = 'department'");
    expect(result.clause).toContain("e.org_level = 'team'");
    expect(result.clause).toContain("e.org_level = 'personal'");
  });

  it('should include attendee EXISTS check', () => {
    const result = buildVisibilityClause(limitedScope, memberships, 1, 5);

    expect(result.clause).toContain('calendar_attendees');
    expect(result.clause).toContain('ca.user_id = $8'); // startIdx 5 + 3 = userId at $8
  });

  it('should produce correct param count (4 params)', () => {
    const result = buildVisibilityClause(limitedScope, emptyMemberships, 1, 10);

    expect(result.params).toHaveLength(4);
    // Param indices: $10=areaIds, $11=deptIds, $12=teamIds, $13=userId
    expect(result.clause).toContain('$10');
    expect(result.clause).toContain('$13');
  });

  it('should deduplicate overlapping scope + membership IDs', () => {
    const overlapping = { departmentIds: [30, 99], teamIds: [40, 99] };
    const result = buildVisibilityClause(limitedScope, overlapping, 1, 1);

    const deptParam = result.params[1] as number[];
    const teamParam = result.params[2] as number[];
    // 30 exists in both scope and memberships — should appear only once
    expect(deptParam.filter((id: number) => id === 30)).toHaveLength(1);
    expect(teamParam.filter((id: number) => id === 40)).toHaveLength(1);
  });
});

// ============================================
// dbToApiEvent
// ============================================

describe('dbToApiEvent', () => {
  it('should map DB event to API format', () => {
    const event = createMockDbEvent({ is_private: 1 });
    const result = dbToApiEvent(event);

    expect(result.title).toBe('Team Meeting');
    expect(result.isPrivate).toBe(true);
    expect(result.allDay).toBe(false);
    expect(result.orgLevel).toBe('department');
  });

  it('should handle all_day=true (boolean)', () => {
    const event = createMockDbEvent({ all_day: true as never });
    const result = dbToApiEvent(event);

    expect(result.allDay).toBe(true);
  });

  it('should handle all_day=1 (integer)', () => {
    const event = createMockDbEvent({ all_day: 1 });
    const result = dbToApiEvent(event);

    expect(result.allDay).toBe(true);
  });

  it('should handle is_private=false (boolean)', () => {
    const event = createMockDbEvent({ is_private: false as never });
    const result = dbToApiEvent(event);

    expect(result.isPrivate).toBe(false);
  });
});

// ============================================
// normalizePagination
// ============================================

describe('normalizePagination', () => {
  it('should clamp limit to max 200', () => {
    const result = normalizePagination({
      ...emptyFilters,
      page: 3,
      limit: 500,
    });

    expect(result.page).toBe(3);
    expect(result.limit).toBe(200);
    expect(result.offset).toBe(400);
  });

  it('should default page to 1 and limit to 50', () => {
    const result = normalizePagination(emptyFilters);

    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it('should clamp negative page to 1', () => {
    const result = normalizePagination({
      ...emptyFilters,
      page: -5,
      limit: 10,
    });

    expect(result.page).toBe(1);
    expect(result.offset).toBe(0);
  });

  it('should clamp limit minimum to 1', () => {
    const result = normalizePagination({ ...emptyFilters, page: 1, limit: 0 });

    expect(result.limit).toBe(1);
  });
});

// ============================================
// validateSortColumn
// ============================================

describe('validateSortColumn', () => {
  it('should return default for unknown column', () => {
    expect(validateSortColumn('DROP TABLE')).toBe('start_date');
  });

  it('should accept valid columns', () => {
    expect(validateSortColumn('title')).toBe('title');
    expect(validateSortColumn('end_date')).toBe('end_date');
    expect(validateSortColumn('updated_at')).toBe('updated_at');
  });
});

// ============================================
// calculateRecurrenceDates
// ============================================

describe('calculateRecurrenceDates', () => {
  it('should generate weekly dates with count limit', () => {
    const start = new Date('2025-01-06T09:00:00Z');
    const dates = calculateRecurrenceDates(
      start,
      'weekly',
      'after',
      4,
      undefined,
    );

    expect(dates).toHaveLength(4);
    expect(dates[1]!.getDate()).toBe(13);
    expect(dates[2]!.getDate()).toBe(20);
  });

  it('should return single date when no recurrence', () => {
    const start = new Date('2025-01-01T09:00:00Z');
    const dates = calculateRecurrenceDates(
      start,
      undefined,
      undefined,
      undefined,
      undefined,
    );

    expect(dates).toHaveLength(1);
  });

  it('should stop at until date', () => {
    const start = new Date('2025-01-01T09:00:00Z');
    const dates = calculateRecurrenceDates(
      start,
      'daily',
      'until',
      undefined,
      '2025-01-04T23:59:59Z',
    );

    expect(dates).toHaveLength(4); // Jan 1, 2, 3, 4
  });

  it('should respect MAX_OCCURRENCES safety limit (52)', () => {
    const start = new Date('2025-01-01T09:00:00Z');
    const dates = calculateRecurrenceDates(
      start,
      'daily',
      'after',
      100,
      undefined,
    );

    expect(dates).toHaveLength(52); // capped at MAX_OCCURRENCES
  });

  it('should generate monthly dates', () => {
    const start = new Date('2025-01-15T09:00:00Z');
    const dates = calculateRecurrenceDates(
      start,
      'monthly',
      'after',
      3,
      undefined,
    );

    expect(dates).toHaveLength(3);
    expect(dates[1]!.getMonth()).toBe(1); // Feb
    expect(dates[2]!.getMonth()).toBe(2); // Mar
  });
});

// ============================================
// addRecurrenceInterval
// ============================================

describe('addRecurrenceInterval', () => {
  const base = new Date('2025-01-15T10:00:00Z');

  it('should add 1 day for daily', () => {
    const result = addRecurrenceInterval(base, 'daily');
    expect(result.getDate()).toBe(16);
  });

  it('should add 7 days for weekly', () => {
    const result = addRecurrenceInterval(base, 'weekly');
    expect(result.getDate()).toBe(22);
  });

  it('should add 1 month for monthly', () => {
    const result = addRecurrenceInterval(base, 'monthly');
    expect(result.getMonth()).toBe(1); // February
  });

  it('should add 1 year for yearly', () => {
    const result = addRecurrenceInterval(base, 'yearly');
    expect(result.getFullYear()).toBe(2026);
  });

  it('should throw for unknown recurrence type', () => {
    expect(() => addRecurrenceInterval(base, 'biweekly')).toThrow(
      'Unknown recurrence type: biweekly',
    );
  });
});

// ============================================
// appendDateSearchFilters
// ============================================

describe('appendDateSearchFilters', () => {
  it('should build WHERE clauses with params', () => {
    const params: unknown[] = [10, 5];
    const result = appendDateSearchFilters(
      {
        ...emptyFilters,
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        search: 'meeting',
      },
      params,
      3,
    );

    expect(result.clause).toContain('AND e.start_date >= $3');
    expect(result.clause).toContain('AND e.end_date <= $4');
    expect(result.clause).toContain('ILIKE $5');
    expect(result.newIndex).toBe(6);
    expect(params).toHaveLength(5);
  });

  it('should return empty clause when no filters', () => {
    const params: unknown[] = [];
    const result = appendDateSearchFilters(emptyFilters, params, 1);

    expect(result.clause).toBe('');
    expect(result.newIndex).toBe(1);
    expect(params).toHaveLength(0);
  });

  it('should handle only startDate', () => {
    const params: unknown[] = [10];
    const result = appendDateSearchFilters(
      { ...emptyFilters, startDate: '2025-06-01' },
      params,
      2,
    );

    expect(result.clause).toContain('AND e.start_date >= $2');
    expect(result.newIndex).toBe(3);
    expect(params).toHaveLength(2);
  });

  it('should skip empty search string', () => {
    const params: unknown[] = [];
    const result = appendDateSearchFilters(
      { ...emptyFilters, search: '' },
      params,
      1,
    );

    expect(result.clause).toBe('');
  });
});
