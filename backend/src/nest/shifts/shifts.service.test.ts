/**
 * Shifts Service – Unit Tests (Phase 12)
 *
 * Tests for pure helper method + DB-mocked public methods + delegation.
 * Private methods tested via bracket notation.
 */
import {
  BadRequestException,
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

/** Complete mock DB shift row with all required and optional fields */
function createMockDbShift(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    tenant_id: 42,
    plan_id: null,
    user_id: 5,
    date: '2025-06-15',
    start_time: '08:00',
    end_time: '16:00',
    title: null,
    required_employees: null,
    actual_start: null,
    actual_end: null,
    break_minutes: 30,
    status: 'planned',
    type: 'F',
    notes: null,
    area_id: null,
    department_id: 10,
    team_id: null,
    machine_id: null,
    created_by: 5,
    created_at: new Date('2025-06-15'),
    updated_at: new Date('2025-06-15'),
    user_name: 'testuser',
    first_name: 'Test',
    last_name: 'User',
    department_name: 'Engineering',
    team_name: null,
    ...overrides,
  };
}

/** Mock DB favorite row */
function createMockDbFavorite(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    tenant_id: 42,
    user_id: 5,
    name: 'My Favorite',
    area_id: 1,
    area_name: 'Area 1',
    department_id: 10,
    department_name: 'Engineering',
    machine_id: 0,
    machine_name: '',
    team_id: 3,
    team_name: 'Team Alpha',
    created_at: new Date('2025-06-15'),
    ...overrides,
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

    it('builds conditions for teamId filter', () => {
      const filters = { teamId: 3 } as never;
      const result = service['buildShiftFilterConditions'](filters, 2);

      expect(result.conditions).toContain('s.team_id = $2');
      expect(result.params).toEqual([3]);
    });

    it('builds conditions for type filter', () => {
      const filters = { type: 'F' } as never;
      const result = service['buildShiftFilterConditions'](filters, 2);

      expect(result.conditions).toContain('s.type = $2');
      expect(result.params).toEqual(['F']);
    });

    it('builds conditions for planId filter', () => {
      const filters = { planId: 7 } as never;
      const result = service['buildShiftFilterConditions'](filters, 2);

      expect(result.conditions).toContain('s.plan_id = $2');
      expect(result.params).toEqual([7]);
    });
  });
});

// ============================================================
// DB-Mocked Methods
// ============================================================

describe('ShiftsService – DB-mocked methods', () => {
  let service: ShiftsService;
  let mockDb: { query: ReturnType<typeof vi.fn> };
  let mockActivityLogger: Record<string, ReturnType<typeof vi.fn>>;
  let mockPlansService: Record<string, ReturnType<typeof vi.fn>>;
  let mockSwapService: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
    mockActivityLogger = result.mockActivityLogger;
    mockPlansService = result.mockPlansService;
    mockSwapService = result.mockSwapService;
  });

  // ----------------------------------------------------------
  // listShifts
  // ----------------------------------------------------------

  describe('listShifts', () => {
    it('returns empty array when no shifts match', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.listShifts(42, {
        page: 1,
        limit: 10,
        sortBy: 'date',
        sortOrder: 'asc',
      });

      expect(result).toEqual([]);
    });

    it('returns mapped shifts with pagination', async () => {
      mockDb.query.mockResolvedValueOnce([
        createMockDbShift(),
        createMockDbShift({ id: 2, user_id: 6, user_name: 'user2' }),
      ]);

      const result = await service.listShifts(42, {
        page: 1,
        limit: 10,
        sortBy: 'date',
        sortOrder: 'asc',
      });

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe(1);
      expect(result[1]?.id).toBe(2);
      // Verify user object is attached
      expect(result[0]).toHaveProperty('user');
    });

    it('applies sort and pagination params correctly', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.listShifts(42, {
        page: 3,
        limit: 25,
        sortBy: 'startTime',
        sortOrder: 'desc',
      });

      const [query, params] = mockDb.query.mock.calls[0] as [
        string,
        unknown[],
      ];
      expect(query).toContain('ORDER BY s.start_time DESC');
      expect(query).toContain('LIMIT');
      // page 3, limit 25 → offset = (3-1)*25 = 50
      expect(params).toContain(25);
      expect(params).toContain(50);
    });

    it('uses default sort column for unknown sortBy', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.listShifts(42, {
        page: 1,
        limit: 10,
        sortBy: 'nonexistent',
        sortOrder: 'asc',
      });

      const [query] = mockDb.query.mock.calls[0] as [string, unknown[]];
      expect(query).toContain('ORDER BY s.date ASC');
    });
  });

  // ----------------------------------------------------------
  // getShiftById
  // ----------------------------------------------------------

  describe('getShiftById', () => {
    it('throws NotFoundException when shift does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getShiftById(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns mapped shift when found', async () => {
      mockDb.query.mockResolvedValueOnce([createMockDbShift()]);

      const result = await service.getShiftById(1, 42);

      expect(result.id).toBe(1);
      expect(result).toHaveProperty('user');
    });
  });

  // ----------------------------------------------------------
  // createShift
  // ----------------------------------------------------------

  describe('createShift', () => {
    it('inserts shift, logs activity, and returns result', async () => {
      // Q1: INSERT → [{id: 1}]
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // Q2: getShiftById → [mockDbShift]
      mockDb.query.mockResolvedValueOnce([createMockDbShift()]);

      const result = await service.createShift(
        {
          date: '2025-06-15',
          userId: 5,
          startTime: '08:00',
          endTime: '16:00',
          departmentId: 10,
        } as never,
        42,
        5,
      );

      expect(result.id).toBe(1);
      expect(mockActivityLogger.logCreate).toHaveBeenCalledOnce();
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('handles empty INSERT result gracefully', async () => {
      // Q1: INSERT returns empty → id defaults to 0
      mockDb.query.mockResolvedValueOnce([]);
      // Q2: getShiftById(0, 42) → not found
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.createShift(
          {
            date: '2025-06-15',
            userId: 5,
            startTime: '08:00',
            endTime: '16:00',
            departmentId: 10,
          } as never,
          42,
          5,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ----------------------------------------------------------
  // updateShift
  // ----------------------------------------------------------

  describe('updateShift', () => {
    it('updates fields, logs activity, and returns updated shift', async () => {
      // Q1: getShiftById (existing)
      mockDb.query.mockResolvedValueOnce([createMockDbShift()]);
      // Q2: UPDATE
      mockDb.query.mockResolvedValueOnce([]);
      // Q3: getShiftById (updated)
      mockDb.query.mockResolvedValueOnce([
        createMockDbShift({ status: 'confirmed' }),
      ]);

      const result = await service.updateShift(
        1,
        { status: 'confirmed' } as never,
        42,
        5,
      );

      expect(result.id).toBe(1);
      expect(mockActivityLogger.logUpdate).toHaveBeenCalledOnce();
      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });

    it('throws BadRequestException when no fields to update', async () => {
      // Q1: getShiftById
      mockDb.query.mockResolvedValueOnce([createMockDbShift()]);

      await expect(
        service.updateShift(1, {} as never, 42, 5),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ----------------------------------------------------------
  // deleteShift
  // ----------------------------------------------------------

  describe('deleteShift', () => {
    it('deletes shift, logs activity, and returns success message', async () => {
      // Q1: getShiftById
      mockDb.query.mockResolvedValueOnce([createMockDbShift()]);
      // Q2: DELETE
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.deleteShift(1, 42, 5);

      expect(result.message).toBe('Shift deleted successfully');
      expect(mockActivityLogger.logDelete).toHaveBeenCalledOnce();
    });

    it('throws NotFoundException if shift does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.deleteShift(999, 42, 5)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ----------------------------------------------------------
  // deleteShiftsByWeek
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // deleteShiftsByTeam
  // ----------------------------------------------------------

  describe('deleteShiftsByTeam', () => {
    it('returns count of deleted shifts', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '12' }]);

      const result = await service.deleteShiftsByTeam(1, 42);

      expect(result.shiftsDeleted).toBe(12);
    });
  });

  // ----------------------------------------------------------
  // getOvertimeReport
  // ----------------------------------------------------------

  describe('getOvertimeReport', () => {
    it('returns mapped overtime data', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          total_shifts: '10',
          total_hours: '80.5',
          total_break_hours: '5.0',
        },
      ]);

      const result = await service.getOvertimeReport(
        { userId: 5, startDate: '2025-06-01', endDate: '2025-06-30' },
        42,
      );

      expect(result.userId).toBe(5);
      expect(result.totalShifts).toBe(10);
      expect(result.totalHours).toBe(80.5);
      expect(result.totalBreakHours).toBe(5);
      expect(result.netHours).toBe(75.5);
    });

    it('returns zeros when no result row', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getOvertimeReport(
        { userId: 5, startDate: '2025-06-01', endDate: '2025-06-30' },
        42,
      );

      expect(result.totalShifts).toBe(0);
      expect(result.totalHours).toBe(0);
      expect(result.netHours).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // exportShifts
  // ----------------------------------------------------------

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

    it('returns CSV string for csv format', async () => {
      mockDb.query.mockResolvedValueOnce([createMockDbShift()]);

      const csv = await service.exportShifts(
        { startDate: '2025-06-01', endDate: '2025-06-30' },
        42,
        'csv',
      );

      expect(typeof csv).toBe('string');
      // First line should be headers
      const lines = csv.split('\n');
      expect(lines[0]).toContain('Date');
      expect(lines[0]).toContain('Employee');
      expect(lines[0]).toContain('Status');
      // Second line should be data
      expect(lines.length).toBeGreaterThan(1);
    });

    it('returns only headers for empty shift list', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const csv = await service.exportShifts(
        { startDate: '2025-06-01', endDate: '2025-06-30' },
        42,
        'csv',
      );

      const lines = csv.split('\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('Date');
    });
  });

  // ----------------------------------------------------------
  // getUserCalendarShifts
  // ----------------------------------------------------------

  describe('getUserCalendarShifts', () => {
    it('returns mapped calendar shifts', async () => {
      mockDb.query.mockResolvedValueOnce([
        { date: '2025-06-15', type: 'F' },
        { date: '2025-06-16', type: 'S' },
      ]);

      const result = await service.getUserCalendarShifts(
        5,
        42,
        '2025-06-01',
        '2025-06-30',
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ date: '2025-06-15', type: 'F' });
      expect(result[1]).toEqual({ date: '2025-06-16', type: 'S' });
    });

    it('converts legacy type names to short codes', async () => {
      mockDb.query.mockResolvedValueOnce([
        { date: '2025-06-15', type: 'early' },
        { date: '2025-06-16', type: 'late' },
        { date: '2025-06-17', type: 'night' },
      ]);

      const result = await service.getUserCalendarShifts(
        5,
        42,
        '2025-06-01',
        '2025-06-30',
      );

      expect(result[0]?.type).toBe('F'); // early → F
      expect(result[1]?.type).toBe('S'); // late → S
      expect(result[2]?.type).toBe('N'); // night → N
    });

    it('returns empty array when no calendar shifts', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getUserCalendarShifts(
        5,
        42,
        '2025-06-01',
        '2025-06-30',
      );

      expect(result).toEqual([]);
    });

    it('passes all 8 params to query', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getUserCalendarShifts(
        5,
        42,
        '2025-06-01',
        '2025-06-30',
      );

      const [, params] = mockDb.query.mock.calls[0] as [string, unknown[]];
      expect(params).toEqual([
        5, 42, '2025-06-01', '2025-06-30',
        5, 42, '2025-06-01', '2025-06-30',
      ]);
    });
  });

  // ----------------------------------------------------------
  // listFavorites
  // ----------------------------------------------------------

  describe('listFavorites', () => {
    it('returns mapped favorites', async () => {
      mockDb.query.mockResolvedValueOnce([createMockDbFavorite()]);

      const result = await service.listFavorites(42, 5);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('name', 'My Favorite');
    });

    it('returns empty array when no favorites', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.listFavorites(42, 5);

      expect(result).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // createFavorite
  // ----------------------------------------------------------

  describe('createFavorite', () => {
    it('inserts and returns the new favorite', async () => {
      // Q1: INSERT
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // Q2: SELECT by id
      mockDb.query.mockResolvedValueOnce([createMockDbFavorite()]);

      const result = await service.createFavorite(
        {
          name: 'My Favorite',
          areaId: 1,
          areaName: 'Area 1',
          departmentId: 10,
          departmentName: 'Engineering',
          machineId: 0,
          machineName: '',
          teamId: 3,
          teamName: 'Team Alpha',
        } as never,
        42,
        5,
      );

      expect(result).toHaveProperty('name', 'My Favorite');
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  // ----------------------------------------------------------
  // deleteFavorite
  // ----------------------------------------------------------

  describe('deleteFavorite', () => {
    it('throws NotFoundException when favorite does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.deleteFavorite(999, 42, 5)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes favorite when found', async () => {
      // Q1: SELECT (ownership check)
      mockDb.query.mockResolvedValueOnce([createMockDbFavorite()]);
      // Q2: DELETE
      mockDb.query.mockResolvedValueOnce([]);

      await service.deleteFavorite(1, 42, 5);

      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  // ----------------------------------------------------------
  // createSwapRequest
  // ----------------------------------------------------------

  describe('createSwapRequest', () => {
    it('throws ForbiddenException when shift does not belong to user', async () => {
      // getShiftById returns shift owned by user 99
      mockDb.query.mockResolvedValueOnce([
        createMockDbShift({ user_id: 99 }),
      ]);

      await expect(
        service.createSwapRequest(
          { shiftId: 1, reason: 'test' },
          1,
          5, // different user
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('delegates to shiftSwapService when ownership passes', async () => {
      // getShiftById returns shift owned by user 5
      mockDb.query.mockResolvedValueOnce([
        createMockDbShift({ user_id: 5 }),
      ]);
      const mockSwapResult = { id: 1, shiftId: 1, requestedBy: 5, status: 'pending' };
      mockSwapService.createSwapRequest.mockResolvedValueOnce(mockSwapResult);

      const result = await service.createSwapRequest(
        { shiftId: 1, reason: 'personal' } as never,
        42,
        5,
      );

      expect(result).toEqual(mockSwapResult);
      expect(mockSwapService.createSwapRequest).toHaveBeenCalledOnce();
    });
  });

  // ----------------------------------------------------------
  // getShiftPlan
  // ----------------------------------------------------------

  describe('getShiftPlan', () => {
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

    it('includes plan in result when found', async () => {
      const mockPlan = {
        id: 7,
        tenant_id: 42,
        department_id: 10,
        start_date: '2025-06-01',
        end_date: '2025-06-07',
      };
      mockPlansService.findPlan.mockResolvedValueOnce(mockPlan);
      mockDb.query.mockResolvedValueOnce([createMockDbShift()]);

      const result = await service.getShiftPlan(
        { startDate: '2025-06-01', endDate: '2025-06-07' },
        42,
      );

      expect(result.plan).toBeDefined();
      expect(result.shifts).toHaveLength(1);
      expect(result.notes).toEqual([]);
    });
  });
});

// ============================================================
// Delegation Methods
// ============================================================

describe('ShiftsService – delegation methods', () => {
  let service: ShiftsService;
  let mockPlansService: Record<string, ReturnType<typeof vi.fn>>;
  let mockSwapService: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
    mockPlansService = result.mockPlansService;
    mockSwapService = result.mockSwapService;
  });

  describe('createShiftPlan', () => {
    it('delegates to shiftPlansService', async () => {
      const mockResult = { planId: 1, shiftIds: [1, 2], message: 'created' };
      mockPlansService.createShiftPlan.mockResolvedValueOnce(mockResult);

      const result = await service.createShiftPlan(
        {} as never,
        42,
        5,
      );

      expect(result).toEqual(mockResult);
      expect(mockPlansService.createShiftPlan).toHaveBeenCalledWith(
        expect.anything(),
        42,
        5,
      );
    });
  });

  describe('updateShiftPlan', () => {
    it('delegates to shiftPlansService', async () => {
      const mockResult = { planId: 1, shiftIds: [], message: 'updated' };
      mockPlansService.updateShiftPlan.mockResolvedValueOnce(mockResult);

      const result = await service.updateShiftPlan(1, {} as never, 42, 5);

      expect(result).toEqual(mockResult);
      expect(mockPlansService.updateShiftPlan).toHaveBeenCalledWith(
        1,
        expect.anything(),
        42,
        5,
      );
    });
  });

  describe('updateShiftPlanByUuid', () => {
    it('delegates to shiftPlansService', async () => {
      const mockResult = { planId: 1, shiftIds: [], message: 'updated' };
      mockPlansService.updateShiftPlanByUuid.mockResolvedValueOnce(mockResult);

      const result = await service.updateShiftPlanByUuid(
        'plan-uuid',
        {} as never,
        42,
        5,
      );

      expect(result).toEqual(mockResult);
      expect(mockPlansService.updateShiftPlanByUuid).toHaveBeenCalledWith(
        'plan-uuid',
        expect.anything(),
        42,
        5,
      );
    });
  });

  describe('deleteShiftPlanByUuid', () => {
    it('delegates to shiftPlansService', async () => {
      mockPlansService.deleteShiftPlanByUuid.mockResolvedValueOnce(undefined);

      await service.deleteShiftPlanByUuid('plan-uuid', 42);

      expect(mockPlansService.deleteShiftPlanByUuid).toHaveBeenCalledWith(
        'plan-uuid',
        42,
      );
    });
  });

  describe('deleteShiftPlan', () => {
    it('delegates to shiftPlansService', async () => {
      mockPlansService.deleteShiftPlan.mockResolvedValueOnce(undefined);

      await service.deleteShiftPlan(1, 42);

      expect(mockPlansService.deleteShiftPlan).toHaveBeenCalledWith(1, 42);
    });
  });

  describe('listSwapRequests', () => {
    it('delegates to shiftSwapService', async () => {
      const mockResult = [{ id: 1, shiftId: 1, status: 'pending' }];
      mockSwapService.listSwapRequests.mockResolvedValueOnce(mockResult);

      const result = await service.listSwapRequests(42, {});

      expect(result).toEqual(mockResult);
      expect(mockSwapService.listSwapRequests).toHaveBeenCalledWith(
        42,
        expect.anything(),
      );
    });
  });

  describe('updateSwapRequestStatus', () => {
    it('delegates to shiftSwapService', async () => {
      const mockResult = { message: 'Swap request updated' };
      mockSwapService.updateSwapRequestStatus.mockResolvedValueOnce(
        mockResult,
      );

      const result = await service.updateSwapRequestStatus(
        1,
        { status: 'approved' } as never,
        42,
        5,
      );

      expect(result).toEqual(mockResult);
      expect(mockSwapService.updateSwapRequestStatus).toHaveBeenCalledWith(
        1,
        expect.anything(),
        42,
        5,
      );
    });
  });
});
