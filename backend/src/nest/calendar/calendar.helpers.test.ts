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
  it('should interpolate parameter indices', () => {
    const clause = buildVisibilityClause(3, 4);

    expect(clause).toContain('$3');
    expect(clause).toContain('$4');
    expect(clause).toContain("e.org_level = 'company'");
  });

  it('should contain all org_level checks', () => {
    const clause = buildVisibilityClause(1, 2);

    expect(clause).toContain("e.org_level = 'area'");
    expect(clause).toContain("e.org_level = 'department'");
    expect(clause).toContain("e.org_level = 'team'");
    expect(clause).toContain("e.org_level = 'personal'");
  });

  it('should include attendee check', () => {
    const clause = buildVisibilityClause(5, 6);

    expect(clause).toContain('calendar_attendees');
    expect(clause).toContain('ca.user_id = $5');
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
