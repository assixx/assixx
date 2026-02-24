/**
 * Unit tests for TpmPlansIntervalService
 *
 * Pure calculation logic — no DB, no mocks needed.
 * Tests: getNextOccurrence (weekday conversion, repeat frequency),
 * calculateIntervalDate (all 8 interval types), calculateNextDueDates (batch + sort).
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { TpmPlansIntervalService } from './tpm-plans-interval.service.js';

describe('TpmPlansIntervalService', () => {
  let service: TpmPlansIntervalService;

  beforeEach(() => {
    service = new TpmPlansIntervalService();
  });

  // =============================================================
  // getNextOccurrence
  // =============================================================

  describe('getNextOccurrence()', () => {
    it('should find the next Monday from a Wednesday', () => {
      // 2026-02-18 is a Wednesday
      const from = new Date('2026-02-18');
      // TPM weekday 0 = Monday → JS weekday 1 = Monday
      const result = service.getNextOccurrence(0, 1, from);

      expect(result.getDay()).toBe(1); // Monday
      expect(result.getDate()).toBe(23); // 2026-02-23
    });

    it('should find the next Thursday from a Wednesday', () => {
      const from = new Date('2026-02-18'); // Wednesday
      // TPM weekday 3 = Thursday
      const result = service.getNextOccurrence(3, 1, from);

      expect(result.getDay()).toBe(4); // Thursday in JS
      expect(result.getDate()).toBe(19); // Next day: 2026-02-19
    });

    it('should find the next Sunday from a Saturday', () => {
      const from = new Date('2026-02-21'); // Saturday
      // TPM weekday 6 = Sunday
      const result = service.getNextOccurrence(6, 1, from);

      expect(result.getDay()).toBe(0); // Sunday in JS
      expect(result.getDate()).toBe(22); // 2026-02-22
    });

    it('should skip weeks when repeatEvery is 2 (biweekly)', () => {
      const from = new Date('2026-02-18'); // Wednesday
      // TPM weekday 0 = Monday, repeat every 2 weeks
      const result = service.getNextOccurrence(0, 2, from);

      expect(result.getDay()).toBe(1); // Monday
      // First Monday after Wed = Feb 23, then +7 = Mar 2
      expect(result).toEqual(new Date('2026-03-02'));
    });

    it('should skip 3 additional weeks when repeatEvery is 4', () => {
      const from = new Date('2026-02-18'); // Wednesday
      // TPM weekday 0 = Monday, repeat every 4 weeks
      const result = service.getNextOccurrence(0, 4, from);

      expect(result.getDay()).toBe(1); // Monday
      // First Monday after Wed = Feb 23, then +(4-1)*7 = +21 = Mar 16
      expect(result).toEqual(new Date('2026-03-16'));
    });

    it('should advance to next week when today is the target day', () => {
      const from = new Date('2026-02-19'); // Thursday
      // TPM weekday 3 = Thursday, daysUntil = 0, should add 7
      const result = service.getNextOccurrence(3, 1, from);

      expect(result.getDay()).toBe(4); // Thursday in JS
      expect(result.getDate()).toBe(26); // Next Thursday
    });
  });

  // =============================================================
  // getNthWeekdayOfMonth
  // =============================================================

  describe('getNthWeekdayOfMonth()', () => {
    it('should find 1st Monday of March 2026', () => {
      // March 1, 2026 = Sunday. 1st Monday = March 2.
      const result = service.getNthWeekdayOfMonth(2026, 2, 0, 1);
      expect(result).toEqual(new Date(2026, 2, 2));
    });

    it('should find 2nd Wednesday of March 2026', () => {
      // March 1 = Sunday. 1st Wed = March 4. 2nd Wed = March 11.
      const result = service.getNthWeekdayOfMonth(2026, 2, 2, 2);
      expect(result).toEqual(new Date(2026, 2, 11));
    });

    it('should find 4th Friday of February 2026', () => {
      // Feb 1, 2026 = Sunday. 1st Fri = Feb 6. 4th Fri = Feb 27.
      const result = service.getNthWeekdayOfMonth(2026, 1, 4, 4);
      expect(result).toEqual(new Date(2026, 1, 27));
    });

    it('should find 1st Sunday when month starts on Sunday', () => {
      // Feb 1, 2026 = Sunday. TPM 6 = Sunday.
      const result = service.getNthWeekdayOfMonth(2026, 1, 6, 1);
      expect(result).toEqual(new Date(2026, 1, 1));
    });

    it('should fall back to last occurrence when Nth overflows', () => {
      // Feb 2026: Mondays are 2, 9, 16, 23. No 5th Monday.
      const result = service.getNthWeekdayOfMonth(2026, 1, 0, 5);
      expect(result).toEqual(new Date(2026, 1, 23)); // 4th Monday
    });

    it('should find 3rd Thursday of January 2026', () => {
      // Jan 1, 2026 = Thursday. 1st Thu = Jan 1. 3rd Thu = Jan 15.
      const result = service.getNthWeekdayOfMonth(2026, 0, 3, 3);
      expect(result).toEqual(new Date(2026, 0, 15));
    });
  });

  // =============================================================
  // calculateIntervalDate (without anchor — simple path)
  // =============================================================

  describe('calculateIntervalDate()', () => {
    const base = new Date('2026-02-18');

    it('daily: adds 1 day', () => {
      const result = service.calculateIntervalDate(base, 'daily');
      expect(result).toEqual(new Date('2026-02-19'));
    });

    it('weekly: adds 7 days', () => {
      const result = service.calculateIntervalDate(base, 'weekly');
      expect(result).toEqual(new Date('2026-02-25'));
    });

    it('monthly: adds 1 month', () => {
      const result = service.calculateIntervalDate(base, 'monthly');
      expect(result).toEqual(new Date('2026-03-18'));
    });

    it('quarterly: adds 3 months', () => {
      const result = service.calculateIntervalDate(base, 'quarterly');
      expect(result).toEqual(new Date('2026-05-18'));
    });

    it('semi_annual: adds 6 months', () => {
      const result = service.calculateIntervalDate(base, 'semi_annual');
      expect(result).toEqual(new Date('2026-08-18'));
    });

    it('annual: adds 1 year', () => {
      const result = service.calculateIntervalDate(base, 'annual');
      expect(result).toEqual(new Date('2027-02-18'));
    });

    it('custom: uses provided customDays', () => {
      const result = service.calculateIntervalDate(base, 'custom', 45);
      expect(result).toEqual(new Date('2026-04-04'));
    });

    it('custom: defaults to 30 days when customDays is null', () => {
      const result = service.calculateIntervalDate(base, 'custom', null);
      expect(result).toEqual(new Date('2026-03-20'));
    });

    it('custom: defaults to 30 days when customDays is undefined', () => {
      const result = service.calculateIntervalDate(base, 'custom');
      expect(result).toEqual(new Date('2026-03-20'));
    });
  });

  // =============================================================
  // calculateIntervalDate (with weekday anchor — monthly+ path)
  // =============================================================

  describe('calculateIntervalDate() with weekday anchor', () => {
    it('monthly: should return 2nd Wednesday of next month', () => {
      const base = new Date('2026-02-18');
      const anchor = { weekday: 2, nth: 2 };
      const result = service.calculateIntervalDate(
        base,
        'monthly',
        null,
        anchor,
      );
      // March: 1st Wed = March 4, 2nd Wed = March 11
      expect(result).toEqual(new Date(2026, 2, 11));
    });

    it('quarterly: should return 2nd Wednesday 3 months ahead', () => {
      const base = new Date('2026-02-18');
      const anchor = { weekday: 2, nth: 2 };
      const result = service.calculateIntervalDate(
        base,
        'quarterly',
        null,
        anchor,
      );
      // May: 1st Wed = May 6, 2nd Wed = May 13
      expect(result).toEqual(new Date(2026, 4, 13));
    });

    it('semi_annual: should return 1st Monday 6 months ahead', () => {
      const base = new Date('2026-02-18');
      const anchor = { weekday: 0, nth: 1 };
      const result = service.calculateIntervalDate(
        base,
        'semi_annual',
        null,
        anchor,
      );
      // Aug: 1st Mon = Aug 3
      expect(result).toEqual(new Date(2026, 7, 3));
    });

    it('annual: should return 2nd Wednesday of same month next year', () => {
      const base = new Date('2026-02-18');
      const anchor = { weekday: 2, nth: 2 };
      const result = service.calculateIntervalDate(
        base,
        'annual',
        null,
        anchor,
      );
      // Feb 2027: 1st Wed = Feb 3, 2nd Wed = Feb 10
      expect(result).toEqual(new Date(2027, 1, 10));
    });

    it('daily: should ignore anchor and add 1 day', () => {
      const base = new Date('2026-02-18');
      const anchor = { weekday: 2, nth: 2 };
      const result = service.calculateIntervalDate(base, 'daily', null, anchor);
      expect(result).toEqual(new Date('2026-02-19'));
    });

    it('custom: should ignore anchor and use customDays', () => {
      const base = new Date('2026-02-18');
      const anchor = { weekday: 2, nth: 2 };
      const result = service.calculateIntervalDate(base, 'custom', 45, anchor);
      expect(result).toEqual(new Date('2026-04-04'));
    });
  });

  // =============================================================
  // calculateNextDueDates
  // =============================================================

  describe('calculateNextDueDates()', () => {
    it('should return sorted dates for all standard interval types', () => {
      const from = new Date('2026-02-18');
      const results = service.calculateNextDueDates(0, 1, from);

      // Should have 6 entries (all standard types, no custom)
      expect(results).toHaveLength(6);

      // Verify sorted ascending by dueDate
      const timestamps = results.map((r) => r.dueDate.getTime());
      const sorted = [...timestamps].sort((a: number, b: number) => a - b);
      expect(timestamps).toEqual(sorted);

      // Daily should be first (soonest)
      expect(results[0]?.intervalType).toBe('daily');
    });

    it('should use getNextOccurrence for weekly interval', () => {
      const from = new Date('2026-02-18'); // Wednesday
      // baseWeekday=3 (Thursday), repeatEvery=1
      const results = service.calculateNextDueDates(3, 1, from, ['weekly']);

      expect(results).toHaveLength(1);
      expect(results[0]?.intervalType).toBe('weekly');
      // Next Thursday from Wednesday = Feb 19
      expect(results[0]?.dueDate.getDay()).toBe(4); // Thursday in JS
    });

    it('should filter by provided intervalTypes', () => {
      const from = new Date('2026-02-18');
      const results = service.calculateNextDueDates(0, 1, from, [
        'daily',
        'monthly',
      ]);

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.intervalType)).toContain('daily');
      expect(results.map((r) => r.intervalType)).toContain('monthly');
    });

    it('should handle custom interval with provided customDays', () => {
      const from = new Date('2026-02-18');
      const results = service.calculateNextDueDates(0, 1, from, ['custom'], 15);

      expect(results).toHaveLength(1);
      expect(results[0]?.intervalType).toBe('custom');
      expect(results[0]?.dueDate).toEqual(new Date('2026-03-05'));
    });

    it('should return empty array when no intervalTypes provided', () => {
      const from = new Date('2026-02-18');
      const results = service.calculateNextDueDates(0, 1, from, []);

      expect(results).toHaveLength(0);
    });

    it('should anchor monthly intervals to Nth weekday of target month', () => {
      const from = new Date('2026-02-18');
      // baseWeekday=2 (Wed), baseRepeatEvery=2 (2nd Wed)
      const results = service.calculateNextDueDates(2, 2, from, ['monthly']);

      expect(results).toHaveLength(1);
      // 2nd Wednesday of March 2026 = March 11
      expect(results[0]?.dueDate).toEqual(new Date(2026, 2, 11));
    });

    it('should anchor quarterly intervals to Nth weekday of target month', () => {
      const from = new Date('2026-02-18');
      // baseWeekday=0 (Mon), baseRepeatEvery=3 (3rd Mon)
      const results = service.calculateNextDueDates(0, 3, from, ['quarterly']);

      expect(results).toHaveLength(1);
      // 3rd Monday of May 2026: 1st Mon = May 4, 3rd Mon = May 18
      expect(results[0]?.dueDate).toEqual(new Date(2026, 4, 18));
    });
  });
});
