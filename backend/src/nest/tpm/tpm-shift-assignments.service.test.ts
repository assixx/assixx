/**
 * Unit tests for TpmShiftAssignmentsService
 *
 * Mocked dependencies: DatabaseService (query).
 * Tests: getShiftAssignments, setAssignments, getAssignmentsForPlan,
 *        getCalendarAssignments (admin/non-admin, color resolution).
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
  const queryFn = vi.fn();
  return { query: queryFn, tenantQuery: queryFn, tenantQueryOne: vi.fn().mockResolvedValue(null) };
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

function makeCalendarRow(overrides: Record<string, unknown> = {}) {
  return {
    plan_uuid: 'plan-uuid-001                           ',
    shift_date: '2026-03-15',
    asset_name: 'Anlage A',
    plan_name: 'Wartungsplan 1',
    interval_types: ['monthly'],
    shift_type: 'assigned',
    ...overrides,
  };
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
    service = new TpmShiftAssignmentsService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // getShiftAssignments
  // =============================================================

  describe('getShiftAssignments', () => {
    it('should return empty array when no assignments exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getShiftAssignments(10, '2026-03-01', '2026-03-31');

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

      const result = await service.getShiftAssignments(10, '2026-03-01', '2026-03-31');

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
      mockDb.query.mockResolvedValueOnce([makeAssignmentRow({ plan_uuid: 'abc-123   ' })]);

      const result = await service.getShiftAssignments(10, '2026-03-01', '2026-03-31');

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

      const result = await service.setAssignments(10, 1, 'plan-uuid', [], '2026-03-15');

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

      const result = await service.setAssignments(10, 1, 'plan-uuid', [5], '2026-03-15');

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

      await service.getAssignmentsForPlan(10, 'plan-uuid', '2026-03-01', '2026-03-31');

      expect(mockDb.query.mock.calls[0]?.[1]).toEqual([
        10,
        'plan-uuid',
        '2026-03-01',
        '2026-03-31',
      ]);
    });

    it('should filter by active assignments and active plans', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getAssignmentsForPlan(10, 'plan-uuid', '2026-03-01', '2026-03-31');

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
      mockDb.query.mockResolvedValueOnce([makePlanAssignmentRow({ uuid: 'abc-123   ' })]);

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

      await service.getAssignmentsForPlan(10, 'plan-uuid', '2026-03-01', '2026-03-31');

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('JOIN users u');
    });
  });

  // =============================================================
  // getCalendarAssignments
  // =============================================================

  describe('getCalendarAssignments', () => {
    it('should return empty array when no assignments exist', async () => {
      // calendar query → empty
      mockDb.query.mockResolvedValueOnce([]);
      // loadIntervalColors → empty
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getCalendarAssignments(10, 5, true, '2026-03-01', '2026-03-31');

      expect(result).toEqual([]);
    });

    it('should pass tenantId, startDate, endDate as parameters', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.getCalendarAssignments(10, 5, true, '2026-03-01', '2026-03-31');

      const params = mockDb.query.mock.calls[0]?.[1] as (number | string)[];
      expect(params[0]).toBe(10);
      expect(params[1]).toBe('2026-03-01');
      expect(params[2]).toBe('2026-03-31');
    });

    it('should NOT add user filter for admin users', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.getCalendarAssignments(10, 5, true, '2026-03-01', '2026-03-31');

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).not.toContain('pa.user_id = $4');
      const params = mockDb.query.mock.calls[0]?.[1] as (number | string)[];
      expect(params).toHaveLength(3);
    });

    it('should add user filter for non-admin users', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.getCalendarAssignments(10, 5, false, '2026-03-01', '2026-03-31');

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('pa.user_id = $4');
      const params = mockDb.query.mock.calls[0]?.[1] as (number | string)[];
      expect(params).toHaveLength(4);
      expect(params[3]).toBe(5);
    });

    it('should map DB rows to API response with colorHex', async () => {
      mockDb.query.mockResolvedValueOnce([makeCalendarRow()]);
      // loadIntervalColors → no tenant overrides
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getCalendarAssignments(10, 5, true, '2026-03-01', '2026-03-31');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        planUuid: 'plan-uuid-001',
        shiftDate: '2026-03-15',
        assetName: 'Anlage A',
        planName: 'Wartungsplan 1',
        intervalTypes: ['monthly'],
        shiftType: 'assigned',
        colorHex: '#5bb5f5',
      });
    });

    it('should use tenant-specific color when available', async () => {
      mockDb.query.mockResolvedValueOnce([makeCalendarRow()]);
      // loadIntervalColors → tenant overrides monthly color
      mockDb.query.mockResolvedValueOnce([{ status_key: 'monthly', color_hex: '#FF0000' }]);

      const result = await service.getCalendarAssignments(10, 5, true, '2026-03-01', '2026-03-31');

      expect(result[0]?.colorHex).toBe('#FF0000');
    });

    it('should pick the most significant interval for color', async () => {
      mockDb.query.mockResolvedValueOnce([
        makeCalendarRow({ interval_types: ['monthly', 'annual', 'quarterly'] }),
      ]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getCalendarAssignments(10, 5, true, '2026-03-01', '2026-03-31');

      // annual (significance 1) should be picked → default color #c8b88a
      expect(result[0]?.colorHex).toBe('#c8b88a');
    });

    it('should fall back to #FF9800 for unknown interval types', async () => {
      mockDb.query.mockResolvedValueOnce([makeCalendarRow({ interval_types: ['unknown_type'] })]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getCalendarAssignments(10, 5, true, '2026-03-01', '2026-03-31');

      expect(result[0]?.colorHex).toBe('#FF9800');
    });

    it('should trim plan_uuid from calendar rows', async () => {
      mockDb.query.mockResolvedValueOnce([makeCalendarRow({ plan_uuid: 'uuid-padded   ' })]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getCalendarAssignments(10, 5, true, '2026-03-01', '2026-03-31');

      expect(result[0]?.planUuid).toBe('uuid-padded');
    });

    it('should query tpm_color_config for tenant colors', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.getCalendarAssignments(10, 5, true, '2026-03-01', '2026-03-31');

      const colorSQL = mockDb.query.mock.calls[1]?.[0] as string;
      expect(colorSQL).toContain('tpm_color_config');
      expect(mockDb.query.mock.calls[1]?.[1]).toEqual([10]);
    });

    it('should handle multiple calendar rows', async () => {
      mockDb.query.mockResolvedValueOnce([
        makeCalendarRow(),
        makeCalendarRow({
          plan_uuid: 'plan-uuid-002                           ',
          shift_date: '2026-03-20',
          asset_name: 'Anlage B',
          plan_name: 'Wartungsplan 2',
          interval_types: ['quarterly'],
        }),
      ]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getCalendarAssignments(10, 5, true, '2026-03-01', '2026-03-31');

      expect(result).toHaveLength(2);
      expect(result[0]?.planName).toBe('Wartungsplan 1');
      expect(result[1]?.planName).toBe('Wartungsplan 2');
      expect(result[1]?.colorHex).toBe('#b0b0b0');
    });
  });
});
