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
  // calculateIntervalDate
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

    it('long_runner: adds 2 years', () => {
      const result = service.calculateIntervalDate(base, 'long_runner');
      expect(result).toEqual(new Date('2028-02-18'));
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
  // calculateNextDueDates
  // =============================================================

  describe('calculateNextDueDates()', () => {
    it('should return sorted dates for all standard interval types', () => {
      const from = new Date('2026-02-18');
      const results = service.calculateNextDueDates(0, 1, from);

      // Should have 7 entries (all standard types, no custom)
      expect(results).toHaveLength(7);

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
  });
});
