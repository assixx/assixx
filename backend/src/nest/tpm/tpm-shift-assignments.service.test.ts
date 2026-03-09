/**
 * Unit tests for TpmShiftAssignmentsService
 *
 * Mocked dependencies: DatabaseService (query).
 * Tests: getShiftAssignments, setAssignments, getAssignmentsForPlan.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { TpmShiftAssignmentsService } from './tpm-shift-assignments.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}
type MockDb = ReturnType<typeof createMockDb>;

function makeAssignmentRow(overrides: Record<string, unknown> = {}) {
  return {
    plan_uuid: 'plan-uuid-001                           ',
    asset_id: 10,
    shift_date: '2026-03-15',
    user_id: 5,
    first_name: 'Max',
    last_name: 'Müller',
    shift_type: 'early',
    ...overrides,
  };
}

function makePlanAssignmentRow(overrides: Record<string, unknown> = {}) {
  return {
    uuid: '019ca4a8-bb6d-7743-8184-2c74e4a64e3c',
    user_id: 5,
    first_name: 'Max',
    last_name: 'Müller',
    user_name: 'Max Müller',
    scheduled_date: '2026-03-15',
    ...overrides,
  };
}

function makePlanIdRow(overrides: Record<string, unknown> = {}) {
  return { id: 42, asset_id: 10, ...overrides };
}

// =============================================================
// TpmShiftAssignmentsService
// =============================================================

describe('TpmShiftAssignmentsService', () => {
  let service: TpmShiftAssignmentsService;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new TpmShiftAssignmentsService(
      mockDb as unknown as DatabaseService,
    );
  });

  // =============================================================
  // getShiftAssignments
  // =============================================================

  describe('getShiftAssignments', () => {
    it('should return empty array when no assignments exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getShiftAssignments(
        10,
        '2026-03-01',
        '2026-03-31',
      );

      expect(result).toEqual([]);
      expect(mockDb.query).toHaveBeenCalledOnce();
    });

    it('should pass correct parameters to query', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getShiftAssignments(10, '2026-03-01', '2026-03-31');

      const callArgs = mockDb.query.mock.calls[0];
      expect(callArgs?.[1]).toEqual([10, '2026-03-01', '2026-03-31']);
    });

    it('should query from tpm_plan_assignments table', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getShiftAssignments(10, '2026-03-01', '2026-03-31');

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('FROM tpm_plan_assignments pa');
    });

    it('should join tpm_maintenance_plans via plan_id', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getShiftAssignments(10, '2026-03-01', '2026-03-31');

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('mp.id = pa.plan_id');
    });

    it('should map DB rows to API response correctly', async () => {
      mockDb.query.mockResolvedValueOnce([
        makeAssignmentRow(),
        makeAssignmentRow({
          plan_uuid: 'plan-uuid-002                           ',
          asset_id: 20,
          user_id: 7,
          first_name: 'Anna',
          last_name: 'Schmidt',
          shift_type: 'late',
        }),
      ]);

      const result = await service.getShiftAssignments(
        10,
        '2026-03-01',
        '2026-03-31',
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        planUuid: 'plan-uuid-001',
        assetId: 10,
        shiftDate: '2026-03-15',
        userId: 5,
        firstName: 'Max',
        lastName: 'Müller',
        shiftType: 'early',
      });
      expect(result[1]).toEqual({
        planUuid: 'plan-uuid-002',
        assetId: 20,
        shiftDate: '2026-03-15',
        userId: 7,
        firstName: 'Anna',
        lastName: 'Schmidt',
        shiftType: 'late',
      });
    });

    it('should trim plan_uuid (char(36) padding)', async () => {
      mockDb.query.mockResolvedValueOnce([
        makeAssignmentRow({ plan_uuid: 'abc-123   ' }),
      ]);

      const result = await service.getShiftAssignments(
        10,
        '2026-03-01',
        '2026-03-31',
      );

      expect(result[0]?.planUuid).toBe('abc-123');
    });

    it('should only query active TPM plans', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getShiftAssignments(10, '2026-03-01', '2026-03-31');

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain(`mp.is_active = ${IS_ACTIVE.ACTIVE}`);
    });

    it('should use DISTINCT to avoid duplicate rows', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getShiftAssignments(10, '2026-03-01', '2026-03-31');

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('SELECT DISTINCT');
    });
  });

  // =============================================================
  // setAssignments
  // =============================================================

  describe('setAssignments', () => {
    it('should throw NotFoundException for unknown plan UUID', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.setAssignments(10, 1, 'nonexistent-uuid', [5], '2026-03-15'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should resolve plan ID before writing', async () => {
      mockDb.query
        .mockResolvedValueOnce([makePlanIdRow()])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makePlanAssignmentRow()]);

      await service.setAssignments(10, 1, 'plan-uuid', [5], '2026-03-15');

      const resolveSQL = mockDb.query.mock.calls[0]?.[0] as string;
      expect(resolveSQL).toContain('tpm_maintenance_plans');
      expect(mockDb.query.mock.calls[0]?.[1]).toEqual([10, 'plan-uuid']);
    });

    it('should deactivate old assignments not in new list', async () => {
      mockDb.query
        .mockResolvedValueOnce([makePlanIdRow()])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makePlanAssignmentRow()]);

      await service.setAssignments(10, 1, 'plan-uuid', [5], '2026-03-15');

      const deactivateSQL = mockDb.query.mock.calls[1]?.[0] as string;
      expect(deactivateSQL).toContain(`is_active = ${IS_ACTIVE.DELETED}`);
      expect(deactivateSQL).toContain('user_id != ALL');
    });

    it('should upsert each user ID individually', async () => {
      mockDb.query
        .mockResolvedValueOnce([makePlanIdRow()])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          makePlanAssignmentRow({ user_id: 5 }),
          makePlanAssignmentRow({ user_id: 7 }),
        ]);

      await service.setAssignments(10, 1, 'plan-uuid', [5, 7], '2026-03-15');

      // call 0: resolvePlanId, call 1: deactivate, call 2+3: upserts, call 4: read-back
      const upsertSQL1 = mockDb.query.mock.calls[2]?.[0] as string;
      expect(upsertSQL1).toContain('INSERT INTO tpm_plan_assignments');
      expect(upsertSQL1).toContain('ON CONFLICT');
      expect(mockDb.query.mock.calls[2]?.[1]?.[3]).toBe(5);
      expect(mockDb.query.mock.calls[3]?.[1]?.[3]).toBe(7);
    });

    it('should handle empty userIds (remove all)', async () => {
      mockDb.query
        .mockResolvedValueOnce([makePlanIdRow()])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.setAssignments(
        10,
        1,
        'plan-uuid',
        [],
        '2026-03-15',
      );

      // call 0: resolve, call 1: deactivate, call 2: read-back (no upserts)
      expect(mockDb.query).toHaveBeenCalledTimes(3);
      expect(result).toEqual([]);
    });

    it('should return mapped assignments from read-back query', async () => {
      mockDb.query
        .mockResolvedValueOnce([makePlanIdRow()])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makePlanAssignmentRow()]);

      const result = await service.setAssignments(
        10,
        1,
        'plan-uuid',
        [5],
        '2026-03-15',
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        uuid: '019ca4a8-bb6d-7743-8184-2c74e4a64e3c',
        userId: 5,
        firstName: 'Max',
        lastName: 'Müller',
        userName: 'Max Müller',
        scheduledDate: '2026-03-15',
      });
    });
  });

  // =============================================================
  // getAssignmentsForPlan
  // =============================================================

  describe('getAssignmentsForPlan', () => {
    it('should return empty array when no assignments exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getAssignmentsForPlan(
        10,
        'plan-uuid',
        '2026-03-01',
        '2026-03-31',
      );

      expect(result).toEqual([]);
    });

    it('should pass correct parameters', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getAssignmentsForPlan(
        10,
        'plan-uuid',
        '2026-03-01',
        '2026-03-31',
      );

      expect(mockDb.query.mock.calls[0]?.[1]).toEqual([
        10,
        'plan-uuid',
        '2026-03-01',
        '2026-03-31',
      ]);
    });

    it('should filter by active assignments and active plans', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getAssignmentsForPlan(
        10,
        'plan-uuid',
        '2026-03-01',
        '2026-03-31',
      );

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain(`pa.is_active = ${IS_ACTIVE.ACTIVE}`);
      expect(sql).toContain(`mp.is_active = ${IS_ACTIVE.ACTIVE}`);
    });

    it('should map DB rows to API response', async () => {
      mockDb.query.mockResolvedValueOnce([
        makePlanAssignmentRow(),
        makePlanAssignmentRow({
          uuid: 'uuid-002',
          user_id: 7,
          first_name: 'Anna',
          last_name: 'Schmidt',
          user_name: 'Anna Schmidt',
          scheduled_date: '2026-03-20',
        }),
      ]);

      const result = await service.getAssignmentsForPlan(
        10,
        'plan-uuid',
        '2026-03-01',
        '2026-03-31',
      );

      expect(result).toHaveLength(2);
      expect(result[0]?.userId).toBe(5);
      expect(result[0]?.scheduledDate).toBe('2026-03-15');
      expect(result[1]?.userId).toBe(7);
      expect(result[1]?.scheduledDate).toBe('2026-03-20');
    });

    it('should trim uuid (char(36) padding)', async () => {
      mockDb.query.mockResolvedValueOnce([
        makePlanAssignmentRow({ uuid: 'abc-123   ' }),
      ]);

      const result = await service.getAssignmentsForPlan(
        10,
        'plan-uuid',
        '2026-03-01',
        '2026-03-31',
      );

      expect(result[0]?.uuid).toBe('abc-123');
    });

    it('should join users table for name resolution', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getAssignmentsForPlan(
        10,
        'plan-uuid',
        '2026-03-01',
        '2026-03-31',
      );

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('JOIN users u');
    });
  });
});
