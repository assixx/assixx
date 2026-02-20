/**
 * Unit tests for TpmSchedulingService
 *
 * Covers: calculateInitialDueDate (daily=today, weekly=next weekday,
 * monthly+=interval from today), initializeCardSchedule (INSERT + SET),
 * advanceSchedule (mark past, get next, update card).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TpmPlansIntervalService } from './tpm-plans-interval.service.js';
import type { PlanSchedulingConfig } from './tpm-scheduling.service.js';
import { TpmSchedulingService } from './tpm-scheduling.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockClient() {
  return {
    query: vi.fn(),
  };
}
type MockClient = ReturnType<typeof createMockClient>;

// =============================================================
// TpmSchedulingService
// =============================================================

describe('TpmSchedulingService', () => {
  let service: TpmSchedulingService;
  let intervalService: TpmPlansIntervalService;
  let mockClient: MockClient;

  const defaultConfig: PlanSchedulingConfig = {
    baseWeekday: 0, // Monday
    baseRepeatEvery: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    intervalService = new TpmPlansIntervalService();
    service = new TpmSchedulingService(intervalService);
    mockClient = createMockClient();
  });

  // =============================================================
  // calculateInitialDueDate
  // =============================================================

  describe('calculateInitialDueDate()', () => {
    it('should return today for daily interval', () => {
      const result = service.calculateInitialDueDate(
        'daily',
        defaultConfig,
        null,
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expect(result.getTime()).toBe(today.getTime());
    });

    it('should return next weekday for weekly interval', () => {
      const result = service.calculateInitialDueDate(
        'weekly',
        { baseWeekday: 2, baseRepeatEvery: 1 }, // Wednesday
        null,
      );

      // Should be a Wednesday (JS: 3)
      const jsWeekday = (2 + 1) % 7; // TPM 2 = JS 3 (Wednesday)
      expect(result.getDay()).toBe(jsWeekday);
      expect(result > new Date()).toBe(true);
    });

    it('should return 1 month from today for monthly interval', () => {
      const result = service.calculateInitialDueDate(
        'monthly',
        defaultConfig,
        null,
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expected = new Date(today);
      expected.setMonth(expected.getMonth() + 1);
      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should return 3 months from today for quarterly interval', () => {
      const result = service.calculateInitialDueDate(
        'quarterly',
        defaultConfig,
        null,
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expected = new Date(today);
      expected.setMonth(expected.getMonth() + 3);
      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should use custom days for custom interval', () => {
      const result = service.calculateInitialDueDate(
        'custom',
        defaultConfig,
        14,
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expected = new Date(today);
      expected.setDate(expected.getDate() + 14);
      expect(result.getTime()).toBe(expected.getTime());
    });
  });

  // =============================================================
  // initializeCardSchedule
  // =============================================================

  describe('initializeCardSchedule()', () => {
    it('should insert scheduled dates and set current_due_date for monthly', async () => {
      // INSERT scheduled dates (1 call) + UPDATE card due date (1 call)
      mockClient.query.mockResolvedValue({ rows: [] });

      await service.initializeCardSchedule(
        mockClient as never,
        10,
        42,
        'monthly',
        defaultConfig,
        null,
      );

      // Should have 2 queries: INSERT (scheduled dates) + UPDATE (card due date)
      expect(mockClient.query).toHaveBeenCalledTimes(2);

      // First call: INSERT into tpm_scheduled_dates
      const insertCall = mockClient.query.mock.calls[0];
      expect(insertCall[0]).toContain('INSERT INTO tpm_scheduled_dates');
      expect(insertCall[0]).toContain('ON CONFLICT');

      // Second call: UPDATE tpm_cards SET current_due_date
      const updateCall = mockClient.query.mock.calls[1];
      expect(updateCall[0]).toContain('UPDATE tpm_cards SET current_due_date');
    });

    it('should generate ~365 dates for daily interval', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await service.initializeCardSchedule(
        mockClient as never,
        10,
        42,
        'daily',
        defaultConfig,
        null,
      );

      // INSERT call params: each date = 3 params (tenantId, cardId, dateStr)
      const insertCall = mockClient.query.mock.calls[0];
      const paramCount = (insertCall[1] as unknown[]).length;
      const dateCount = paramCount / 3;

      // Daily for 1 year ≈ 365-366 dates
      expect(dateCount).toBeGreaterThanOrEqual(365);
      expect(dateCount).toBeLessThanOrEqual(367);
    });

    it('should generate ~12 dates for monthly interval', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await service.initializeCardSchedule(
        mockClient as never,
        10,
        42,
        'monthly',
        defaultConfig,
        null,
      );

      const insertCall = mockClient.query.mock.calls[0];
      const paramCount = (insertCall[1] as unknown[]).length;
      const dateCount = paramCount / 3;

      // Monthly for 1 year = 12-13 dates
      expect(dateCount).toBeGreaterThanOrEqual(12);
      expect(dateCount).toBeLessThanOrEqual(14);
    });

    it('should generate 1 date for annual interval', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await service.initializeCardSchedule(
        mockClient as never,
        10,
        42,
        'annual',
        defaultConfig,
        null,
      );

      const insertCall = mockClient.query.mock.calls[0];
      const paramCount = (insertCall[1] as unknown[]).length;
      const dateCount = paramCount / 3;

      // Annual: first date + maybe 1 more at year boundary
      expect(dateCount).toBeGreaterThanOrEqual(1);
      expect(dateCount).toBeLessThanOrEqual(2);
    });
  });

  // =============================================================
  // advanceSchedule
  // =============================================================

  describe('advanceSchedule()', () => {
    it('should mark past dates and set next due date', async () => {
      // 1st call: UPDATE mark past dates
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 2nd call: SELECT next date
      mockClient.query.mockResolvedValueOnce({
        rows: [{ scheduled_date: '2026-04-15' }],
      });
      // 3rd call: UPDATE card current_due_date
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.advanceSchedule(mockClient as never, 10, 42);

      expect(result).toBe('2026-04-15');
      expect(mockClient.query).toHaveBeenCalledTimes(3);

      // Mark past dates completed
      expect(mockClient.query.mock.calls[0][0]).toContain(
        'UPDATE tpm_scheduled_dates',
      );
      expect(mockClient.query.mock.calls[0][0]).toContain(
        'is_completed = true',
      );

      // Get next scheduled date
      expect(mockClient.query.mock.calls[1][0]).toContain(
        'SELECT scheduled_date',
      );

      // Update card due date
      expect(mockClient.query.mock.calls[2][0]).toContain(
        'UPDATE tpm_cards SET current_due_date',
      );
    });

    it('should return null when schedule is exhausted', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // no next date
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.advanceSchedule(mockClient as never, 10, 42);

      expect(result).toBeNull();

      // Should still update card (set to null)
      const updateCall = mockClient.query.mock.calls[2];
      expect(updateCall[1]).toEqual([null, 42, 10]);
    });
  });
});
