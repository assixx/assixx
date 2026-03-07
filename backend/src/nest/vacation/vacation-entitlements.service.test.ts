/**
 * Vacation Entitlements Service – Unit Tests (Phase 3, Session 13)
 *
 * Mocked dependencies: DatabaseService, VacationHolidaysService, VacationSettingsService.
 * Tests: getBalance (correct calculation, carry-over expiry, cross-year splitting,
 * special_leave exclusion), createOrUpdateEntitlement (UPSERT), addDays, NotFoundException.
 *
 * Pattern: tenantTransaction callback receives mockClient with query() mock.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { VacationEntitlementsService } from './vacation-entitlements.service.js';
import type { VacationHolidaysService } from './vacation-holidays.service.js';
import type { VacationSettingsService } from './vacation-settings.service.js';
import type { VacationEntitlementRow } from './vacation.types.js';

// =============================================================
// Mock Factories
// =============================================================

function createMockDb() {
  return {
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockHolidaysService() {
  return {
    countWorkdays: vi.fn(),
    getHolidays: vi.fn(),
    createHoliday: vi.fn(),
    updateHoliday: vi.fn(),
    deleteHoliday: vi.fn(),
    isHoliday: vi.fn(),
  };
}

function createMockActivityLogger() {
  return { log: vi.fn().mockResolvedValue(undefined) };
}

function createMockSettingsService() {
  return {
    getSettings: vi.fn().mockResolvedValue({
      id: 'settings-001',
      defaultAnnualDays: 30,
      maxCarryOverDays: 5,
      carryOverDeadlineMonth: 3,
      carryOverDeadlineDay: 31,
      advanceNoticeDays: 3,
      maxConsecutiveDays: null,
      createdBy: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }),
    updateSettings: vi.fn(),
  };
}

function createEntitlementRow(
  overrides?: Partial<VacationEntitlementRow>,
): VacationEntitlementRow {
  return {
    id: 'ent-001',
    tenant_id: 1,
    user_id: 5,
    year: 2026,
    total_days: '30',
    carried_over_days: '3',
    additional_days: '2',
    carry_over_expires_at: null,
    is_active: IS_ACTIVE.ACTIVE,
    created_by: 10,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// =============================================================
// Test Suite
// =============================================================

describe('VacationEntitlementsService', () => {
  let service: VacationEntitlementsService;
  let mockDb: MockDb;
  let mockClient: { query: ReturnType<typeof vi.fn> };
  let mockHolidays: ReturnType<typeof createMockHolidaysService>;
  let mockSettings: ReturnType<typeof createMockSettingsService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockClient = { query: vi.fn() };
    mockHolidays = createMockHolidaysService();
    mockSettings = createMockSettingsService();

    mockDb.tenantTransaction.mockImplementation(
      async (callback: (client: typeof mockClient) => Promise<unknown>) => {
        return await callback(mockClient);
      },
    );

    service = new VacationEntitlementsService(
      mockDb as unknown as DatabaseService,
      mockHolidays as unknown as VacationHolidaysService,
      mockSettings as unknown as VacationSettingsService,
      createMockActivityLogger() as unknown as ActivityLoggerService,
    );
  });

  // -----------------------------------------------------------
  // getEntitlement
  // -----------------------------------------------------------

  describe('getEntitlement()', () => {
    it('should return mapped entitlement', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createEntitlementRow()],
      });

      const result = await service.getEntitlement(1, 5, 2026);

      expect(result).toBeDefined();
      expect(result?.userId).toBe(5);
      expect(result?.year).toBe(2026);
      expect(result?.totalDays).toBe(30);
      expect(result?.carriedOverDays).toBe(3);
      expect(result?.additionalDays).toBe(2);
    });

    it('should return undefined when no entitlement exists', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getEntitlement(1, 5, 2026);

      expect(result).toBeUndefined();
    });
  });

  // -----------------------------------------------------------
  // getBalance — THE critical calculation
  // -----------------------------------------------------------

  describe('getBalance()', () => {
    it('should calculate correct balance with no used/pending days', async () => {
      // 1. findEntitlement → entitlement row
      mockClient.query.mockResolvedValueOnce({
        rows: [createEntitlementRow()],
      });
      // 2. sameYearResult (approved) → 0
      mockClient.query.mockResolvedValueOnce({
        rows: [{ total: '0' }],
      });
      // 3. crossYearResult (approved) → no cross-year requests
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 4. sameYearResult (pending) → 0
      mockClient.query.mockResolvedValueOnce({
        rows: [{ total: '0' }],
      });
      // 5. crossYearResult (pending) → no cross-year requests
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getBalance(1, 5, 2026);

      // totalDays=30 + carriedOver=3 + additional=2 = 35 available
      expect(result.year).toBe(2026);
      expect(result.totalDays).toBe(30);
      expect(result.carriedOverDays).toBe(3);
      expect(result.effectiveCarriedOver).toBe(3);
      expect(result.additionalDays).toBe(2);
      expect(result.availableDays).toBe(35);
      expect(result.usedDays).toBe(0);
      expect(result.remainingDays).toBe(35);
      expect(result.pendingDays).toBe(0);
      expect(result.projectedRemaining).toBe(35);
    });

    it('should calculate balance with used and pending days', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createEntitlementRow()],
      });
      // approved: 10 days used
      mockClient.query.mockResolvedValueOnce({
        rows: [{ total: '10' }],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // pending: 5 days
      mockClient.query.mockResolvedValueOnce({
        rows: [{ total: '5' }],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getBalance(1, 5, 2026);

      expect(result.availableDays).toBe(35);
      expect(result.usedDays).toBe(10);
      expect(result.remainingDays).toBe(25);
      expect(result.pendingDays).toBe(5);
      expect(result.projectedRemaining).toBe(20);
    });

    it('should exclude expired carry-over', async () => {
      // carry-over expired yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const expiredDate = yesterday.toISOString().slice(0, 10);

      mockClient.query.mockResolvedValueOnce({
        rows: [
          createEntitlementRow({
            carried_over_days: '5',
            carry_over_expires_at: expiredDate,
          }),
        ],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getBalance(1, 5, 2026);

      // effectiveCarriedOver = 0 (expired), totalDays=30+0+2 = 32
      expect(result.carriedOverDays).toBe(5);
      expect(result.effectiveCarriedOver).toBe(0);
      expect(result.availableDays).toBe(32);
    });

    it('should include non-expired carry-over', async () => {
      // carry-over expires tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const futureDate = tomorrow.toISOString().slice(0, 10);

      mockClient.query.mockResolvedValueOnce({
        rows: [
          createEntitlementRow({
            carried_over_days: '5',
            carry_over_expires_at: futureDate,
          }),
        ],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getBalance(1, 5, 2026);

      expect(result.effectiveCarriedOver).toBe(5);
      expect(result.availableDays).toBe(37);
    });

    it('should create default entitlement when none exists', async () => {
      // findEntitlement → not found
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // createDefaultEntitlement → INSERT returns row
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createEntitlementRow({
            total_days: '30',
            carried_over_days: '0',
            additional_days: '0',
          }),
        ],
      });
      // approved days → 0
      mockClient.query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // pending days → 0
      mockClient.query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getBalance(1, 5, 2026);

      expect(result.totalDays).toBe(30);
      expect(result.availableDays).toBe(30);
      expect(mockSettings.getSettings).toHaveBeenCalledWith(1);
    });

    it('should handle cross-year request splitting (approved)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createEntitlementRow({
            carried_over_days: '0',
            additional_days: '0',
          }),
        ],
      });
      // sameYear approved → 5
      mockClient.query.mockResolvedValueOnce({ rows: [{ total: '5' }] });
      // cross-year approved → 1 request spanning 2025-12-29 to 2026-01-02
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'req-cross',
            start_date: '2025-12-29',
            end_date: '2026-01-02',
            half_day_start: 'none',
            half_day_end: 'none',
            computed_days: '5',
          },
        ],
      });
      // countWorkdays for clamped range (2026-01-01 to 2026-01-02) → 2 workdays
      mockHolidays.countWorkdays.mockResolvedValueOnce(2);
      // sameYear pending → 0
      mockClient.query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
      // cross-year pending → none
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getBalance(1, 5, 2026);

      // usedDays = 5 (sameYear) + 2 (crossYear portion) = 7
      expect(result.usedDays).toBe(7);
      expect(result.remainingDays).toBe(23); // 30 - 7
      expect(mockHolidays.countWorkdays).toHaveBeenCalledWith(
        1,
        '2026-01-01',
        '2026-01-02',
        'none',
        'none',
      );
    });

    it('should handle cross-year pending request splitting', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createEntitlementRow({
            carried_over_days: '0',
            additional_days: '0',
          }),
        ],
      });
      // sameYear approved → 0
      mockClient.query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
      // cross-year approved → none
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // sameYear pending → 3
      mockClient.query.mockResolvedValueOnce({ rows: [{ total: '3' }] });
      // cross-year pending → 1 request spanning 2026-12-20 to 2027-01-10
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'req-cross-pend',
            start_date: '2026-12-20',
            end_date: '2027-01-10',
            half_day_start: 'none',
            half_day_end: 'none',
            computed_days: '16',
          },
        ],
      });
      // countWorkdays for clamped range (2026-12-20 to 2026-12-31) → 8 workdays
      mockHolidays.countWorkdays.mockResolvedValueOnce(8);

      const result = await service.getBalance(1, 5, 2026);

      // pendingDays = 3 (sameYear) + 8 (crossYear portion in 2026) = 11
      expect(result.pendingDays).toBe(11);
      expect(result.projectedRemaining).toBe(19); // 30 - 0 - 11
      expect(mockHolidays.countWorkdays).toHaveBeenCalledWith(
        1,
        '2026-12-20',
        '2026-12-31',
        'none',
        'none',
      );
    });

    it('should preserve half-day at original boundary but drop it at clamp', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createEntitlementRow({
            carried_over_days: '0',
            additional_days: '0',
          }),
        ],
      });
      // sameYear approved → 0
      mockClient.query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
      // cross-year approved → request 2025-12-15 to 2026-01-05 with half-day modifiers
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'req-cross-half',
            start_date: '2025-12-15',
            end_date: '2026-01-05',
            half_day_start: 'morning',
            half_day_end: 'afternoon',
            computed_days: '15',
          },
        ],
      });
      // Clamped: 2026-01-01 to 2026-01-05
      // halfDayStart → 'none' (clamped start != original start)
      // halfDayEnd → 'afternoon' (clamped end == original end)
      mockHolidays.countWorkdays.mockResolvedValueOnce(3.5);
      // sameYear pending → 0
      mockClient.query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
      // cross-year pending → none
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getBalance(1, 5, 2026);

      expect(result.usedDays).toBe(3.5);
      expect(mockHolidays.countWorkdays).toHaveBeenCalledWith(
        1,
        '2026-01-01',
        '2026-01-05',
        'none', // halfDayStart dropped (clamped)
        'afternoon', // halfDayEnd preserved (original boundary)
      );
    });

    it('should sum multiple cross-year requests in same balance', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createEntitlementRow({
            carried_over_days: '0',
            additional_days: '0',
          }),
        ],
      });
      // sameYear approved → 10
      mockClient.query.mockResolvedValueOnce({ rows: [{ total: '10' }] });
      // cross-year approved → 2 requests overlapping 2026
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'req-cross-1',
            start_date: '2025-12-29',
            end_date: '2026-01-02',
            half_day_start: 'none',
            half_day_end: 'none',
            computed_days: '5',
          },
          {
            id: 'req-cross-2',
            start_date: '2026-12-28',
            end_date: '2027-01-03',
            half_day_start: 'none',
            half_day_end: 'none',
            computed_days: '5',
          },
        ],
      });
      // countWorkdays for req-cross-1 clamped (2026-01-01 to 2026-01-02) → 2
      mockHolidays.countWorkdays.mockResolvedValueOnce(2);
      // countWorkdays for req-cross-2 clamped (2026-12-28 to 2026-12-31) → 3
      mockHolidays.countWorkdays.mockResolvedValueOnce(3);
      // sameYear pending → 0
      mockClient.query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
      // cross-year pending → none
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getBalance(1, 5, 2026);

      // usedDays = 10 (sameYear) + 2 (cross-1) + 3 (cross-2) = 15
      expect(result.usedDays).toBe(15);
      expect(result.remainingDays).toBe(15); // 30 - 15
      expect(mockHolidays.countWorkdays).toHaveBeenCalledTimes(2);
    });
  });

  // -----------------------------------------------------------
  // createOrUpdateEntitlement
  // -----------------------------------------------------------

  describe('createOrUpdateEntitlement()', () => {
    it('should upsert and return entitlement', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createEntitlementRow()],
      });

      const result = await service.createOrUpdateEntitlement(1, 5, {
        userId: 5,
        year: 2026,
        totalDays: 30,
        carriedOverDays: 0,
        additionalDays: 0,
      });

      expect(result.userId).toBe(5);
      expect(result.year).toBe(2026);
    });
  });

  // -----------------------------------------------------------
  // addDays
  // -----------------------------------------------------------

  describe('addDays()', () => {
    it('should add days and return updated entitlement', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createEntitlementRow({ additional_days: '7' })],
      });

      const result = await service.addDays(1, 10, 5, 2026, 5);

      expect(result.additionalDays).toBe(7);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('additional_days = additional_days + $1'),
        [5, 1, 5, 2026],
      );
    });

    it('should throw NotFoundException when no entitlement exists', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.addDays(1, 10, 5, 2026, 5)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -----------------------------------------------------------
  // updateEntitlement
  // -----------------------------------------------------------

  describe('updateEntitlement()', () => {
    it('should update and return entitlement', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createEntitlementRow({ total_days: '25' })],
      });

      const result = await service.updateEntitlement(1, 'ent-001', {
        totalDays: 25,
      });

      expect(result.totalDays).toBe(25);
    });

    it('should throw NotFoundException when entitlement not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateEntitlement(1, 'nonexistent', { totalDays: 25 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return existing entitlement when no fields to update', async () => {
      // Empty DTO → re-fetch by ID
      mockClient.query.mockResolvedValueOnce({
        rows: [createEntitlementRow()],
      });

      const result = await service.updateEntitlement(1, 'ent-001', {});

      expect(result.userId).toBe(5);
    });
  });
});
