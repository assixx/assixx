/**
 * Unit tests for ShiftPlansService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Plan CRUD, UUID resolution, shift insertion,
 *        orphan cleanup, NotFoundException guards.
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { ShiftPlansService } from './shift-plans.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('mock-uuid-v7'),
}));

vi.mock('./shifts.helpers.js', () => ({
  buildTimestamp: vi.fn(
    (dateStr: string, timeStr: string | undefined, defaultTime?: string) => {
      if (typeof dateStr !== 'string' || dateStr === '') return null;
      const datePart = dateStr.split('T')[0] ?? dateStr;
      if (typeof timeStr === 'string' && timeStr !== '') {
        return `${datePart}T${timeStr}:00`;
      }
      if (defaultTime !== undefined && defaultTime !== '') {
        return `${datePart}T${defaultTime}:00`;
      }
      return null;
    },
  ),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

/** Standard DB shift plan row */
function makePlanRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    uuid: 'plan-uuid-1',
    tenant_id: 10,
    area_id: null,
    department_id: 5,
    team_id: null,
    machine_id: null,
    name: 'Week Plan',
    start_date: '2025-06-01',
    end_date: '2025-06-07',
    shift_notes: null,
    created_by: 1,
    created_at: new Date('2025-06-01'),
    updated_at: null,
    ...overrides,
  };
}

// =============================================================
// ShiftPlansService
// =============================================================

describe('ShiftPlansService', () => {
  let service: ShiftPlansService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new ShiftPlansService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // findPlan
  // =============================================================

  describe('findPlan', () => {
    it('should return undefined when no plan found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.findPlan({}, 10);

      expect(result).toBeUndefined();
    });

    it('should return plan matching filters', async () => {
      const plan = makePlanRow();
      mockDb.query.mockResolvedValueOnce([plan]);

      const result = await service.findPlan({ departmentId: 5 }, 10);

      expect(result).toEqual(plan);
    });
  });

  // =============================================================
  // createShiftPlan
  // =============================================================

  describe('createShiftPlan', () => {
    it('should create plan without shifts', async () => {
      // INSERT plan RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);

      const result = await service.createShiftPlan(
        {
          departmentId: 5,
          startDate: '2025-06-01',
          endDate: '2025-06-07',
          shifts: [],
        } as never,
        10,
        1,
      );

      expect(result.planId).toBe(1);
      expect(result.shiftIds).toEqual([]);
      expect(result.message).toBe('Shift plan created successfully');
    });

    it('should create plan with shifts', async () => {
      // INSERT plan RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // INSERT shift 1 RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 10 }]);
      // INSERT shift 2 RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 11 }]);

      const result = await service.createShiftPlan(
        {
          departmentId: 5,
          startDate: '2025-06-01',
          endDate: '2025-06-07',
          shifts: [
            {
              userId: 1,
              date: '2025-06-01',
              startTime: '08:00',
              endTime: '16:00',
              type: 'early',
            },
            {
              userId: 2,
              date: '2025-06-01',
              startTime: '14:00',
              endTime: '22:00',
              type: 'late',
            },
          ],
        } as never,
        10,
        1,
      );

      expect(result.planId).toBe(1);
      expect(result.shiftIds).toEqual([10, 11]);
    });
  });

  // =============================================================
  // updateShiftPlan
  // =============================================================

  describe('updateShiftPlan', () => {
    it('should throw NotFoundException when plan not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.updateShiftPlan(999, { shifts: [] } as never, 10, 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update plan metadata and upsert shifts', async () => {
      // find plan
      mockDb.query.mockResolvedValueOnce([makePlanRow()]);
      // applyShiftPlanUpdates → UPDATE
      mockDb.query.mockResolvedValueOnce([]);
      // upsert shift RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 10 }]);
      // deleteOrphanedPlanShifts → DELETE with NOT IN
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.updateShiftPlan(
        1,
        {
          name: 'Updated Plan',
          shifts: [
            {
              userId: 1,
              date: '2025-06-01',
              startTime: '08:00',
              endTime: '16:00',
            },
          ],
        } as never,
        10,
        1,
      );

      expect(result.planId).toBe(1);
      expect(result.shiftIds).toEqual([10]);
      expect(result.message).toBe('Shift plan updated successfully');
    });
  });

  // =============================================================
  // resolveShiftPlanIdByUuid
  // =============================================================

  describe('resolveShiftPlanIdByUuid', () => {
    it('should throw NotFoundException when UUID not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.resolveShiftPlanIdByUuid('nonexistent-uuid', 10),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return plan id', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]);

      const result = await service.resolveShiftPlanIdByUuid('plan-uuid-1', 10);

      expect(result).toBe(5);
    });
  });

  // =============================================================
  // deleteShiftPlan
  // =============================================================

  describe('deleteShiftPlan', () => {
    it('should throw NotFoundException when plan not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.deleteShiftPlan(999, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete shifts then plan', async () => {
      // find plan
      mockDb.query.mockResolvedValueOnce([makePlanRow()]);
      // DELETE shifts
      mockDb.query.mockResolvedValueOnce([]);
      // DELETE plan
      mockDb.query.mockResolvedValueOnce([]);

      await service.deleteShiftPlan(1, 10);

      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });
  });

  // =============================================================
  // deleteShiftPlanByUuid
  // =============================================================

  describe('deleteShiftPlanByUuid', () => {
    it('should resolve UUID then delete', async () => {
      // resolveShiftPlanIdByUuid
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]);
      // find plan (inside deleteShiftPlan)
      mockDb.query.mockResolvedValueOnce([makePlanRow({ id: 5 })]);
      // DELETE shifts
      mockDb.query.mockResolvedValueOnce([]);
      // DELETE plan
      mockDb.query.mockResolvedValueOnce([]);

      await service.deleteShiftPlanByUuid('plan-uuid-1', 10);

      expect(mockDb.query).toHaveBeenCalledTimes(4);
    });
  });

  // =============================================================
  // updateShiftPlanByUuid
  // =============================================================

  describe('updateShiftPlanByUuid', () => {
    it('should resolve UUID then update', async () => {
      // resolveShiftPlanIdByUuid
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]);
      // find plan (inside updateShiftPlan)
      mockDb.query.mockResolvedValueOnce([makePlanRow({ id: 5 })]);
      // no shifts to upsert, no orphans to clean
      // deleteOrphanedPlanShifts skipped (keepShiftIds empty + deleteAll false)

      const result = await service.updateShiftPlanByUuid(
        'plan-uuid-1',
        { shifts: undefined } as never,
        10,
        1,
      );

      expect(result.planId).toBe(5);
    });
  });
});
