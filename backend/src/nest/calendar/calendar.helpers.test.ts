/**
 * Unit tests for Calendar Helpers
 *
 * Phase 6: Pure function tests — 1 test per function, no mocking needed.
 */
import { describe, expect, it } from 'vitest';

import {
  addRecurrenceInterval,
  appendDateSearchFilters,
  buildVisibilityClause,
  calculateRecurrenceDates,
  dbToApiEvent,
  normalizePagination,
  validateSortColumn,
} from './calendar.helpers.js';
import type { DbCalendarEvent } from './calendar.types.js';

describe('calendar.helpers', () => {
  it('buildVisibilityClause should interpolate parameter indices', () => {
    const clause = buildVisibilityClause(3, 4);

    expect(clause).toContain('$3');
    expect(clause).toContain('$4');
    expect(clause).toContain("e.org_level = 'company'");
  });

  it('dbToApiEvent should map DB event to API format', () => {
    const event: DbCalendarEvent = {
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
      is_private: 1,
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
    };

    const result = dbToApiEvent(event);

    expect(result.title).toBe('Team Meeting');
    expect(result.isPrivate).toBe(true);
    expect(result.allDay).toBe(false);
    expect(result.orgLevel).toBe('department');
  });

  it('normalizePagination should clamp values and calculate offset', () => {
    const result = normalizePagination({
      page: 3,
      limit: 500,
      status: undefined,
      filter: undefined,
      search: undefined,
      startDate: undefined,
      endDate: undefined,
      sortBy: undefined,
      sortOrder: undefined,
    });

    expect(result.page).toBe(3);
    expect(result.limit).toBe(200); // clamped to max
    expect(result.offset).toBe(400); // (3-1)*200
  });

  it('validateSortColumn should return default for unknown column', () => {
    expect(validateSortColumn('DROP TABLE')).toBe('start_date');
    expect(validateSortColumn('title')).toBe('title');
  });

  it('calculateRecurrenceDates should generate weekly dates with count limit', () => {
    const start = new Date('2025-01-06T09:00:00Z');
    const dates = calculateRecurrenceDates(
      start,
      'weekly',
      'after',
      4,
      undefined,
    );

    expect(dates).toHaveLength(4);
    expect(dates[1]!.getDate()).toBe(13); // +7 days
    expect(dates[2]!.getDate()).toBe(20); // +14 days
  });

  it('addRecurrenceInterval should add correct interval for each type', () => {
    const base = new Date('2025-01-15T10:00:00Z');

    const daily = addRecurrenceInterval(base, 'daily');
    expect(daily.getDate()).toBe(16);

    const monthly = addRecurrenceInterval(base, 'monthly');
    expect(monthly.getMonth()).toBe(1); // February
  });

  it('appendDateSearchFilters should build WHERE clauses with params', () => {
    const params: unknown[] = [10, 5];
    const result = appendDateSearchFilters(
      {
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        search: 'meeting',
        status: undefined,
        filter: undefined,
        page: undefined,
        limit: undefined,
        sortBy: undefined,
        sortOrder: undefined,
      },
      params,
      3,
    );

    expect(result.clause).toContain('AND e.start_date >= $3');
    expect(result.clause).toContain('AND e.end_date <= $4');
    expect(result.clause).toContain('ILIKE $5');
    expect(result.newIndex).toBe(6);
    expect(params).toHaveLength(5); // 2 original + 3 added
  });
});
