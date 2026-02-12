/**
 * Vacation Holidays Service – Unit Tests (Phase 3, Session 13)
 *
 * Mocked dependency: DatabaseService (tenantTransaction).
 * Tests: CRUD, countWorkdays (the core algorithm), duplicate handling.
 *
 * Pattern: tenantTransaction callback receives mockClient with query() mock.
 */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { VacationHolidaysService } from './vacation-holidays.service.js';
import type { VacationHolidayRow } from './vacation.types.js';

// =============================================================
// Mock Factories
// =============================================================

function createMockDb() {
  return {
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockHolidayRow(
  overrides?: Partial<VacationHolidayRow>,
): VacationHolidayRow {
  return {
    id: 'hol-001',
    tenant_id: 1,
    holiday_date: '2026-12-25',
    name: 'Weihnachten',
    recurring: true,
    is_active: 1,
    created_by: 10,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// =============================================================
// Test Suite
// =============================================================

describe('VacationHolidaysService', () => {
  let service: VacationHolidaysService;
  let mockDb: MockDb;
  let mockClient: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockClient = { query: vi.fn() };

    // tenantTransaction executes callback with mockClient
    mockDb.tenantTransaction.mockImplementation(
      async (callback: (client: typeof mockClient) => Promise<unknown>) => {
        return await callback(mockClient);
      },
    );

    service = new VacationHolidaysService(mockDb as unknown as DatabaseService);
  });

  // -----------------------------------------------------------
  // getHolidays
  // -----------------------------------------------------------

  describe('getHolidays()', () => {
    it('should return mapped holidays', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockHolidayRow()],
      });

      const result = await service.getHolidays(1);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('hol-001');
      expect(result[0]?.name).toBe('Weihnachten');
      expect(result[0]?.holidayDate).toBe('2026-12-25');
      expect(result[0]?.recurring).toBe(true);
    });

    it('should return empty array when no holidays', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getHolidays(1);

      expect(result).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------
  // createHoliday
  // -----------------------------------------------------------

  describe('createHoliday()', () => {
    it('should create and return a holiday', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createMockHolidayRow({ name: 'Neujahr', holiday_date: '2026-01-01' }),
        ],
      });

      const result = await service.createHoliday(1, 10, {
        holidayDate: '2026-01-01',
        name: 'Neujahr',
        recurring: true,
      });

      expect(result.name).toBe('Neujahr');
      expect(result.holidayDate).toBe('2026-01-01');
      expect(mockClient.query).toHaveBeenCalledOnce();
    });

    it('should throw ConflictException on duplicate holiday_date (23505)', async () => {
      const pgError = new Error('unique_violation');
      (pgError as unknown as { code: string }).code = '23505';
      mockClient.query.mockRejectedValueOnce(pgError);

      await expect(
        service.createHoliday(1, 10, {
          holidayDate: '2026-12-25',
          name: 'Duplicate',
          recurring: false,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // -----------------------------------------------------------
  // updateHoliday
  // -----------------------------------------------------------

  describe('updateHoliday()', () => {
    it('should update and return updated holiday', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockHolidayRow({ name: 'Updated Name' })],
      });

      const result = await service.updateHoliday(1, 'hol-001', {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException when holiday not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateHoliday(1, 'nonexistent', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------
  // deleteHoliday
  // -----------------------------------------------------------

  describe('deleteHoliday()', () => {
    it('should soft-delete successfully', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'hol-001' }],
      });

      await expect(
        service.deleteHoliday(1, 'hol-001'),
      ).resolves.toBeUndefined();
    });

    it('should throw NotFoundException when holiday not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.deleteHoliday(1, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -----------------------------------------------------------
  // countWorkdays — THE CORE ALGORITHM
  // -----------------------------------------------------------

  describe('countWorkdays()', () => {
    /**
     * Mock holidays for countWorkdays tests.
     * loadHolidaySet issues ONE query to get holidays in range.
     */
    function mockNoHolidays(): void {
      mockClient.query.mockResolvedValueOnce({ rows: [] });
    }

    function mockHolidays(dates: string[], recurring: boolean = false): void {
      mockClient.query.mockResolvedValueOnce({
        rows: dates.map((d: string) => ({ holiday_date: d, recurring })),
      });
    }

    it('should count Mon-Fri as 5 workdays (no holidays)', async () => {
      // 2026-06-01 (Mon) to 2026-06-05 (Fri)
      mockNoHolidays();

      const days = await service.countWorkdays(1, '2026-06-01', '2026-06-05');

      expect(days).toBe(5);
    });

    it('should count week with 1 holiday as 4 workdays', async () => {
      // 2026-06-01 (Mon) to 2026-06-05 (Fri), holiday on Wed
      mockHolidays(['2026-06-03']);

      const days = await service.countWorkdays(1, '2026-06-01', '2026-06-05');

      expect(days).toBe(4);
    });

    it('should count half_day_start = morning as 4.5 workdays', async () => {
      // 2026-06-01 (Mon) to 2026-06-05 (Fri), start is half day
      mockNoHolidays();

      const days = await service.countWorkdays(
        1,
        '2026-06-01',
        '2026-06-05',
        'morning',
      );

      expect(days).toBe(4.5);
    });

    it('should count half_day_end = afternoon as 4.5 workdays', async () => {
      // 2026-06-01 (Mon) to 2026-06-05 (Fri), end is half day
      mockNoHolidays();

      const days = await service.countWorkdays(
        1,
        '2026-06-01',
        '2026-06-05',
        'none',
        'afternoon',
      );

      expect(days).toBe(4.5);
    });

    it('should count single full day as 1.0', async () => {
      // 2026-06-01 (Mon) — single day
      mockNoHolidays();

      const days = await service.countWorkdays(1, '2026-06-01', '2026-06-01');

      expect(days).toBe(1);
    });

    it('should count single half day as 0.5', async () => {
      // 2026-06-01 (Mon) — single day with half-day modifier
      mockNoHolidays();

      const days = await service.countWorkdays(
        1,
        '2026-06-01',
        '2026-06-01',
        'morning',
      );

      expect(days).toBe(0.5);
    });

    it('should exclude weekends', async () => {
      // 2026-06-06 (Sat) to 2026-06-07 (Sun)
      mockNoHolidays();

      const days = await service.countWorkdays(1, '2026-06-06', '2026-06-07');

      expect(days).toBe(0);
    });

    it('should handle 2-week range correctly', async () => {
      // 2026-06-01 (Mon) to 2026-06-12 (Fri) = 10 workdays
      mockNoHolidays();

      const days = await service.countWorkdays(1, '2026-06-01', '2026-06-12');

      expect(days).toBe(10);
    });

    it('should handle recurring holidays matched by month+day', async () => {
      // 2026-06-01 (Mon) to 2026-06-05 (Fri)
      // Recurring holiday on "2025-06-03" — should match 2026-06-03
      mockHolidays(['2025-06-03'], true);

      const days = await service.countWorkdays(1, '2026-06-01', '2026-06-05');

      expect(days).toBe(4);
    });

    it('should handle both half_day_start and half_day_end', async () => {
      // 2026-06-01 (Mon) to 2026-06-05 (Fri), both half days
      mockNoHolidays();

      const days = await service.countWorkdays(
        1,
        '2026-06-01',
        '2026-06-05',
        'afternoon',
        'morning',
      );

      expect(days).toBe(4);
    });
  });

  // -----------------------------------------------------------
  // isHoliday
  // -----------------------------------------------------------

  describe('isHoliday()', () => {
    it('should return true when date is a holiday', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ found: true }],
      });

      const result = await service.isHoliday(1, new Date('2026-12-25'));

      expect(result).toBe(true);
    });

    it('should return false when date is not a holiday', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ found: false }],
      });

      const result = await service.isHoliday(1, new Date('2026-06-15'));

      expect(result).toBe(false);
    });
  });
});
