/**
 * Vacation Validation Service – Unit Tests
 *
 * Mocked dependencies: VacationSettingsService, VacationEntitlementsService,
 * VacationBlackoutsService, VacationHolidaysService.
 * Methods receiving PoolClient mock client.query() directly.
 *
 * Uses vi.useFakeTimers() pinned to 2026-03-15 for deterministic date logic.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CreateVacationRequestDto } from './dto/create-vacation-request.dto.js';
import type { UpdateVacationRequestDto } from './dto/update-vacation-request.dto.js';
import { VacationValidationService } from './vacation-validation.service.js';
import type {
  VacationHalfDay,
  VacationRequestRow,
  VacationType,
} from './vacation.types.js';

// =============================================================
// Fake Clock — pinned to 2026-03-15T00:00:00.000Z
// =============================================================

const FAKE_NOW = new Date('2026-03-15T00:00:00.000Z');

// =============================================================
// Mock Factories
// =============================================================

function createMockSettingsService() {
  return {
    getSettings: vi.fn().mockResolvedValue({
      advanceNoticeDays: 3,
      maxConsecutiveDays: 30,
    }),
  };
}
type MockSettings = ReturnType<typeof createMockSettingsService>;

function createMockEntitlementsService() {
  return {
    getBalance: vi.fn().mockResolvedValue({
      remainingDays: 20,
      pendingDays: 5,
      projectedRemaining: 10,
    }),
  };
}
type MockEntitlements = ReturnType<typeof createMockEntitlementsService>;

function createMockBlackoutsService() {
  return {
    getConflicts: vi.fn().mockResolvedValue([]),
  };
}
type MockBlackouts = ReturnType<typeof createMockBlackoutsService>;

function createMockHolidaysService() {
  return {
    countWorkdays: vi.fn().mockResolvedValue(5),
  };
}
type MockHolidays = ReturnType<typeof createMockHolidaysService>;

function createMockClient() {
  return { query: vi.fn().mockResolvedValue({ rows: [] }) };
}
type MockClient = ReturnType<typeof createMockClient>;

function createDto(
  overrides?: Partial<CreateVacationRequestDto>,
): CreateVacationRequestDto {
  return {
    startDate: '2026-04-01',
    endDate: '2026-04-05',
    halfDayStart: 'none' as VacationHalfDay,
    halfDayEnd: 'none' as VacationHalfDay,
    vacationType: 'regular' as VacationType,
    reason: 'Test vacation',
    ...overrides,
  };
}

function createExistingRequest(
  overrides?: Partial<VacationRequestRow>,
): VacationRequestRow {
  return {
    id: 1,
    uuid: 'req-uuid-001',
    tenant_id: 1,
    requester_id: 100,
    approver_id: 200,
    start_date: '2026-04-01',
    end_date: '2026-04-05',
    half_day_start: 'none' as VacationHalfDay,
    half_day_end: 'none' as VacationHalfDay,
    vacation_type: 'regular' as VacationType,
    status: 'pending',
    computed_days: 5,
    reason: 'Existing request',
    response_note: null,
    is_active: 1,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
    ...overrides,
  } as VacationRequestRow;
}

// =============================================================
// Test Suite
// =============================================================

describe('VacationValidationService', () => {
  let service: VacationValidationService;
  let mockSettings: MockSettings;
  let mockEntitlements: MockEntitlements;
  let mockBlackouts: MockBlackouts;
  let mockHolidays: MockHolidays;
  let mockClient: MockClient;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FAKE_NOW);
    vi.clearAllMocks();

    mockSettings = createMockSettingsService();
    mockEntitlements = createMockEntitlementsService();
    mockBlackouts = createMockBlackoutsService();
    mockHolidays = createMockHolidaysService();
    mockClient = createMockClient();

    service = new VacationValidationService(
      mockSettings as any,
      mockEntitlements as any,
      mockBlackouts as any,
      mockHolidays as any,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------
  // validateNewRequest
  // -----------------------------------------------------------

  describe('validateNewRequest()', () => {
    it('should pass with valid future date and no overlap', async () => {
      await expect(
        service.validateNewRequest(
          mockClient as unknown as PoolClient,
          1,
          100,
          createDto(),
        ),
      ).resolves.toBeUndefined();

      expect(mockSettings.getSettings).toHaveBeenCalledWith(1);
      expect(mockClient.query).toHaveBeenCalledOnce();
    });

    it('should throw BadRequestException for past start date', async () => {
      const dto = createDto({ startDate: '2026-03-01' });

      await expect(
        service.validateNewRequest(
          mockClient as unknown as PoolClient,
          1,
          100,
          dto,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when advance notice insufficient', async () => {
      // Today is 2026-03-15, advance = 3 days, so earliest = 2026-03-18
      const dto = createDto({ startDate: '2026-03-16' });

      await expect(
        service.validateNewRequest(
          mockClient as unknown as PoolClient,
          1,
          100,
          dto,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should skip advance notice when advanceDays is 0', async () => {
      mockSettings.getSettings.mockResolvedValueOnce({
        advanceNoticeDays: 0,
        maxConsecutiveDays: 30,
      });
      // Tomorrow — no advance notice needed
      const dto = createDto({ startDate: '2026-03-16' });

      await expect(
        service.validateNewRequest(
          mockClient as unknown as PoolClient,
          1,
          100,
          dto,
        ),
      ).resolves.toBeUndefined();
    });

    it('should throw BadRequestException when exceeding max consecutive days', async () => {
      mockSettings.getSettings.mockResolvedValueOnce({
        advanceNoticeDays: 0,
        maxConsecutiveDays: 5,
      });
      // 10 calendar days > max 5
      const dto = createDto({
        startDate: '2026-04-01',
        endDate: '2026-04-10',
      });

      await expect(
        service.validateNewRequest(
          mockClient as unknown as PoolClient,
          1,
          100,
          dto,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should skip max consecutive check when maxDays is null', async () => {
      mockSettings.getSettings.mockResolvedValueOnce({
        advanceNoticeDays: 0,
        maxConsecutiveDays: null,
      });
      // 60 days — no limit
      const dto = createDto({
        startDate: '2026-04-01',
        endDate: '2026-05-30',
      });

      await expect(
        service.validateNewRequest(
          mockClient as unknown as PoolClient,
          1,
          100,
          dto,
        ),
      ).resolves.toBeUndefined();
    });

    it('should throw ConflictException on overlapping request', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await expect(
        service.validateNewRequest(
          mockClient as unknown as PoolClient,
          1,
          100,
          createDto(),
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // -----------------------------------------------------------
  // validateBalanceAndBlackouts
  // -----------------------------------------------------------

  describe('validateBalanceAndBlackouts()', () => {
    it('should check balance and blackouts for paid vacation', async () => {
      await expect(
        service.validateBalanceAndBlackouts(1, 100, createDto(), 5, 10, 5),
      ).resolves.toBeUndefined();

      expect(mockEntitlements.getBalance).toHaveBeenCalledOnce();
      expect(mockBlackouts.getConflicts).toHaveBeenCalledOnce();
    });

    it('should skip balance check for unpaid vacation', async () => {
      const dto = createDto({ vacationType: 'unpaid' as VacationType });

      await expect(
        service.validateBalanceAndBlackouts(1, 100, dto, 5, 10, 5),
      ).resolves.toBeUndefined();

      expect(mockEntitlements.getBalance).not.toHaveBeenCalled();
      expect(mockBlackouts.getConflicts).toHaveBeenCalledOnce();
    });

    it('should throw BadRequestException on insufficient balance', async () => {
      mockEntitlements.getBalance.mockResolvedValueOnce({
        remainingDays: 2,
        pendingDays: 0,
        projectedRemaining: -3,
      });

      await expect(
        service.validateBalanceAndBlackouts(1, 100, createDto(), 5, 10, 5),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException on blackout conflict', async () => {
      mockBlackouts.getConflicts.mockResolvedValueOnce([
        {
          name: 'Summer Freeze',
          startDate: '2026-04-01',
          endDate: '2026-04-10',
        },
      ]);

      await expect(
        service.validateBalanceAndBlackouts(1, 100, createDto(), 5, 10, 5),
      ).rejects.toThrow(BadRequestException);
    });

    it('should check balance for cross-year requests', async () => {
      const dto = createDto({
        startDate: '2026-12-28',
        endDate: '2027-01-05',
      });
      mockEntitlements.getBalance
        .mockResolvedValueOnce({ projectedRemaining: 5 })
        .mockResolvedValueOnce({ projectedRemaining: 10 });

      await expect(
        service.validateBalanceAndBlackouts(1, 100, dto, 5, 10, 5),
      ).resolves.toBeUndefined();

      expect(mockEntitlements.getBalance).toHaveBeenCalledTimes(2);
    });
  });

  // -----------------------------------------------------------
  // computeWorkdays
  // -----------------------------------------------------------

  describe('computeWorkdays()', () => {
    it('should return workday count', async () => {
      mockHolidays.countWorkdays.mockResolvedValueOnce(5);

      const result = await service.computeWorkdays(
        1,
        '2026-04-01',
        '2026-04-07',
        'none' as VacationHalfDay,
        'none' as VacationHalfDay,
      );

      expect(result).toBe(5);
      expect(mockHolidays.countWorkdays).toHaveBeenCalledWith(
        1,
        '2026-04-01',
        '2026-04-07',
        'none',
        'none',
      );
    });

    it('should throw BadRequestException when workdays is zero', async () => {
      mockHolidays.countWorkdays.mockResolvedValueOnce(0);

      await expect(
        service.computeWorkdays(
          1,
          '2026-04-04',
          '2026-04-05',
          'none' as VacationHalfDay,
          'none' as VacationHalfDay,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -----------------------------------------------------------
  // countWorkdays (no-throw variant)
  // -----------------------------------------------------------

  describe('countWorkdays()', () => {
    it('should return count without throwing on zero', async () => {
      mockHolidays.countWorkdays.mockResolvedValueOnce(0);

      const result = await service.countWorkdays(
        1,
        '2026-04-04',
        '2026-04-05',
        'none' as VacationHalfDay,
        'none' as VacationHalfDay,
      );

      expect(result).toBe(0);
    });
  });

  // -----------------------------------------------------------
  // reCheckBalanceForApproval
  // -----------------------------------------------------------

  describe('reCheckBalanceForApproval()', () => {
    it('should pass when balance is sufficient', async () => {
      mockEntitlements.getBalance.mockResolvedValueOnce({
        remainingDays: 20,
        pendingDays: 5,
      });

      await expect(
        service.reCheckBalanceForApproval(1, createExistingRequest(), 5),
      ).resolves.toBeUndefined();
    });

    it('should throw BadRequestException when balance insufficient', async () => {
      // available = remainingDays - pendingDays + computedDays = 1 - 5 + 5 = 1 < 5
      mockEntitlements.getBalance.mockResolvedValueOnce({
        remainingDays: 1,
        pendingDays: 5,
      });

      await expect(
        service.reCheckBalanceForApproval(1, createExistingRequest(), 5),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -----------------------------------------------------------
  // guardFutureStartDate
  // -----------------------------------------------------------

  describe('guardFutureStartDate()', () => {
    it('should pass for future date', () => {
      expect(() => {
        service.guardFutureStartDate('2026-04-01');
      }).not.toThrow();
    });

    it('should throw ForbiddenException for today', () => {
      expect(() => {
        service.guardFutureStartDate('2026-03-15');
      }).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for past date', () => {
      expect(() => {
        service.guardFutureStartDate('2026-01-01');
      }).toThrow(ForbiddenException);
    });
  });

  // -----------------------------------------------------------
  // mergeWithExisting
  // -----------------------------------------------------------

  describe('mergeWithExisting()', () => {
    it('should use DTO values when provided', () => {
      const dto: UpdateVacationRequestDto = {
        startDate: '2026-05-01',
        endDate: '2026-05-10',
        halfDayStart: 'morning' as VacationHalfDay,
        halfDayEnd: 'afternoon' as VacationHalfDay,
        vacationType: 'special' as VacationType,
      };

      const result = service.mergeWithExisting(dto, createExistingRequest());

      expect(result.startDate).toBe('2026-05-01');
      expect(result.endDate).toBe('2026-05-10');
      expect(result.halfDayStart).toBe('morning');
      expect(result.halfDayEnd).toBe('afternoon');
      expect(result.vacationType).toBe('special');
    });

    it('should fall back to existing values when DTO fields undefined', () => {
      const dto: UpdateVacationRequestDto = {};

      const result = service.mergeWithExisting(dto, createExistingRequest());

      expect(result.startDate).toBe('2026-04-01');
      expect(result.endDate).toBe('2026-04-05');
      expect(result.halfDayStart).toBe('none');
      expect(result.halfDayEnd).toBe('none');
      expect(result.vacationType).toBe('regular');
    });

    it('should handle Date objects from existing row', () => {
      const dto: UpdateVacationRequestDto = {};
      const existing = createExistingRequest({
        start_date: new Date('2026-06-15T00:00:00.000Z') as unknown as string,
        end_date: new Date('2026-06-20T00:00:00.000Z') as unknown as string,
      });

      const result = service.mergeWithExisting(dto, existing);

      expect(result.startDate).toBe('2026-06-15');
      expect(result.endDate).toBe('2026-06-20');
    });
  });

  // -----------------------------------------------------------
  // validateEditedRequest
  // -----------------------------------------------------------

  describe('validateEditedRequest()', () => {
    const validMerged = {
      startDate: '2026-04-01',
      endDate: '2026-04-05',
      halfDayStart: 'none' as VacationHalfDay,
      halfDayEnd: 'none' as VacationHalfDay,
      vacationType: 'regular' as VacationType,
    };

    it('should pass with valid merged fields', async () => {
      mockHolidays.countWorkdays.mockResolvedValueOnce(5);

      await expect(
        service.validateEditedRequest(
          mockClient as unknown as PoolClient,
          1,
          100,
          'req-uuid-001',
          validMerged,
          10,
          5,
        ),
      ).resolves.toBeUndefined();

      expect(mockSettings.getSettings).toHaveBeenCalledWith(1);
      expect(mockHolidays.countWorkdays).toHaveBeenCalledOnce();
      expect(mockBlackouts.getConflicts).toHaveBeenCalledOnce();
    });

    it('should throw when endDate before startDate', async () => {
      const merged = { ...validMerged, endDate: '2026-03-20' };

      await expect(
        service.validateEditedRequest(
          mockClient as unknown as PoolClient,
          1,
          100,
          'req-uuid-001',
          merged,
          10,
          5,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should pass excludeId to overlap check', async () => {
      mockHolidays.countWorkdays.mockResolvedValueOnce(5);

      await service.validateEditedRequest(
        mockClient as unknown as PoolClient,
        1,
        100,
        'req-uuid-001',
        validMerged,
        10,
        5,
      );

      // checkOverlap SQL should contain $5 for excludeId
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('AND id != $5'),
        [1, 100, '2026-04-01', '2026-04-05', 'req-uuid-001'],
      );
    });

    it('should throw when edited range has no workdays', async () => {
      mockHolidays.countWorkdays.mockResolvedValueOnce(0);

      await expect(
        service.validateEditedRequest(
          mockClient as unknown as PoolClient,
          1,
          100,
          'req-uuid-001',
          validMerged,
          10,
          5,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should skip balance check for unpaid vacation type', async () => {
      mockHolidays.countWorkdays.mockResolvedValueOnce(5);
      const merged = { ...validMerged, vacationType: 'unpaid' as VacationType };

      await service.validateEditedRequest(
        mockClient as unknown as PoolClient,
        1,
        100,
        'req-uuid-001',
        merged,
        10,
        5,
      );

      expect(mockEntitlements.getBalance).not.toHaveBeenCalled();
    });

    it('should check blackouts with teamId and departmentId', async () => {
      mockHolidays.countWorkdays.mockResolvedValueOnce(5);

      await service.validateEditedRequest(
        mockClient as unknown as PoolClient,
        1,
        100,
        'req-uuid-001',
        validMerged,
        42,
        7,
      );

      expect(mockBlackouts.getConflicts).toHaveBeenCalledWith(
        1,
        '2026-04-01',
        '2026-04-05',
        42,
        7,
      );
    });
  });
});
