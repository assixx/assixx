/**
 * Shifts Service – Unit Tests
 *
 * Tests for pure helper method + DB-mocked public methods.
 * Private methods tested via bracket notation.
 */
import {
  ForbiddenException,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { ShiftPlansService } from './shift-plans.service.js';
import type { ShiftSwapService } from './shift-swap.service.js';
import { ShiftsService } from './shifts.service.js';

// ============================================================
// Setup
// ============================================================

function createServiceWithMock(): {
  service: ShiftsService;
  mockDb: { query: ReturnType<typeof vi.fn> };
  mockActivityLogger: Record<string, ReturnType<typeof vi.fn>>;
  mockPlansService: Record<string, ReturnType<typeof vi.fn>>;
  mockSwapService: Record<string, ReturnType<typeof vi.fn>>;
} {
  const mockDb = { query: vi.fn() };
  const mockActivityLogger = {
    logCreate: vi.fn(),
    logUpdate: vi.fn(),
    logDelete: vi.fn(),
  };
  const mockPlansService = {
    findPlan: vi.fn(),
    createShiftPlan: vi.fn(),
    updateShiftPlan: vi.fn(),
    updateShiftPlanByUuid: vi.fn(),
    deleteShiftPlanByUuid: vi.fn(),
    deleteShiftPlan: vi.fn(),
  };
  const mockSwapService = {
    listSwapRequests: vi.fn(),
    createSwapRequest: vi.fn(),
    updateSwapRequestStatus: vi.fn(),
  };

  const service = new ShiftsService(
    mockDb as unknown as DatabaseService,
    mockActivityLogger as unknown as ActivityLoggerService,
    mockPlansService as unknown as ShiftPlansService,
    mockSwapService as unknown as ShiftSwapService,
  );

  return {
    service,
    mockDb,
    mockActivityLogger,
    mockPlansService,
    mockSwapService,
  };
}

// ============================================================
// Pure Private Methods
// ============================================================

describe('ShiftsService – pure helpers', () => {
  let service: ShiftsService;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
  });

  describe('buildShiftFilterConditions', () => {
    it('builds conditions for date filter', () => {
      const filters = { date: '2025-06-15' } as never;
      const result = service['buildShiftFilterConditions'](filters, 2);

      expect(result.conditions).toContain('DATE(s.date) = $2');
      expect(result.params).toEqual(['2025-06-15']);
      expect(result.nextIndex).toBe(3);
    });

    it('builds range conditions for startDate and endDate', () => {
      const filters = {
        startDate: '2025-06-01',
        endDate: '2025-06-30',
      } as never;
      const result = service['buildShiftFilterConditions'](filters, 2);

      expect(result.conditions).toContain('s.date >= $2');
      expect(result.conditions).toContain('s.date <= $3');
      expect(result.params).toEqual(['2025-06-01', '2025-06-30']);
    });

    it('builds conditions for multiple filters', () => {
      const filters = {
        userId: 5,
        departmentId: 10,
        status: 'planned',
      } as never;
      const result = service['buildShiftFilterConditions'](filters, 2);

      expect(result.conditions).toContain('s.user_id = $2');
      expect(result.conditions).toContain('s.department_id = $3');
      expect(result.conditions).toContain('s.status = $4');
      expect(result.params).toEqual([5, 10, 'planned']);
    });

    it('returns empty string when no filters', () => {
      const result = service['buildShiftFilterConditions']({} as never, 2);

      expect(result.conditions).toBe('');
      expect(result.params).toEqual([]);
    });
  });
});

// ============================================================
// DB-Mocked Methods
// ============================================================

describe('ShiftsService – DB-mocked methods', () => {
  let service: ShiftsService;
  let mockDb: { query: ReturnType<typeof vi.fn> };
  let mockPlansService: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
    mockPlansService = result.mockPlansService;
  });

  describe('getShiftById', () => {
    it('throws NotFoundException when shift does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getShiftById(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteShiftsByWeek', () => {
    it('returns count of deleted shifts', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '5' }]);

      const result = await service.deleteShiftsByWeek(
        1,
        '2025-06-01',
        '2025-06-07',
        42,
      );

      expect(result.shiftsDeleted).toBe(5);
    });

    it('returns 0 when no shifts match', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);

      const result = await service.deleteShiftsByWeek(
        1,
        '2025-06-01',
        '2025-06-07',
        42,
      );

      expect(result.shiftsDeleted).toBe(0);
    });
  });

  describe('deleteShiftsByTeam', () => {
    it('returns count of deleted shifts', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '12' }]);

      const result = await service.deleteShiftsByTeam(1, 42);

      expect(result.shiftsDeleted).toBe(12);
    });
  });

  describe('exportShifts', () => {
    it('throws NotImplementedException for excel format', async () => {
      await expect(
        service.exportShifts(
          { startDate: '2025-06-01', endDate: '2025-06-30' },
          1,
          'excel',
        ),
      ).rejects.toThrow(NotImplementedException);
    });
  });

  describe('createSwapRequest', () => {
    it('throws ForbiddenException when shift does not belong to user', async () => {
      // getShiftById returns shift owned by user 99
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          user_id: 99,
          tenant_id: 1,
          date: '2025-06-15',
          start_time: '08:00',
          end_time: '16:00',
          status: 'planned',
          type: 'F',
        },
      ]);

      await expect(
        service.createSwapRequest(
          { shiftId: 1, reason: 'test' },
          1,
          5, // different user
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getShiftPlan – delegation', () => {
    it('delegates to shiftPlansService.findPlan', async () => {
      mockPlansService.findPlan.mockResolvedValueOnce(undefined);
      mockDb.query.mockResolvedValueOnce([]); // listShifts

      const result = await service.getShiftPlan(
        {
          startDate: '2025-06-01',
          endDate: '2025-06-07',
        },
        42,
      );

      expect(mockPlansService.findPlan).toHaveBeenCalledOnce();
      expect(result.plan).toBeUndefined();
      expect(result.shifts).toEqual([]);
    });
  });
});
