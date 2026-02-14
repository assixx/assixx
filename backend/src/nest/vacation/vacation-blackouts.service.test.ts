/**
 * Vacation Blackouts Service – Unit Tests
 *
 * Mocked dependency: DatabaseService (tenantTransaction).
 * Tests: CRUD, getConflicts (multi-scope via junction table), scope sync.
 *
 * Pattern: tenantTransaction callback receives mockClient with query() mock.
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { VacationBlackoutsService } from './vacation-blackouts.service.js';
import type { VacationBlackoutRow } from './vacation.types.js';

// =============================================================
// Mock Factories
// =============================================================

function createMockDb() {
  return {
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockActivityLogger() {
  return { log: vi.fn().mockResolvedValue(undefined) };
}

function createMockBlackoutRow(
  overrides?: Partial<VacationBlackoutRow>,
): VacationBlackoutRow {
  return {
    id: 'bo-001',
    tenant_id: 1,
    name: 'Summer Freeze',
    reason: 'Peak production',
    start_date: '2026-07-15',
    end_date: '2026-07-31',
    is_global: true,
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

describe('VacationBlackoutsService', () => {
  let service: VacationBlackoutsService;
  let mockDb: MockDb;
  let mockClient: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockClient = { query: vi.fn() };

    mockDb.tenantTransaction.mockImplementation(
      async (callback: (client: typeof mockClient) => Promise<unknown>) => {
        return await callback(mockClient);
      },
    );

    service = new VacationBlackoutsService(
      mockDb as unknown as DatabaseService,
      createMockActivityLogger() as unknown as ActivityLoggerService,
    );
  });

  // -----------------------------------------------------------
  // getBlackouts
  // -----------------------------------------------------------

  describe('getBlackouts()', () => {
    it('should return mapped blackouts with scope arrays', async () => {
      // 1. Main query returns blackout rows
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockBlackoutRow()],
      });
      // 2. Scope query returns empty (global blackout has no scopes)
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getBlackouts(1);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('bo-001');
      expect(result[0]?.name).toBe('Summer Freeze');
      expect(result[0]?.startDate).toBe('2026-07-15');
      expect(result[0]?.endDate).toBe('2026-07-31');
      expect(result[0]?.isGlobal).toBe(true);
      expect(result[0]?.departmentIds).toEqual([]);
      expect(result[0]?.teamIds).toEqual([]);
      expect(result[0]?.areaIds).toEqual([]);
    });

    it('should return empty array when no blackouts exist', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getBlackouts(1);

      expect(result).toHaveLength(0);
    });

    it('should aggregate scope arrays from junction table', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockBlackoutRow({ is_global: false })],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            blackout_id: 'bo-001',
            org_type: 'department',
            org_id: 5,
            created_at: '',
          },
          {
            id: 2,
            blackout_id: 'bo-001',
            org_type: 'team',
            org_id: 42,
            created_at: '',
          },
          {
            id: 3,
            blackout_id: 'bo-001',
            org_type: 'area',
            org_id: 2,
            created_at: '',
          },
        ],
      });

      const result = await service.getBlackouts(1);

      expect(result[0]?.isGlobal).toBe(false);
      expect(result[0]?.departmentIds).toEqual([5]);
      expect(result[0]?.teamIds).toEqual([42]);
      expect(result[0]?.areaIds).toEqual([2]);
    });

    it('should filter by year when provided', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.getBlackouts(1, 2026);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('start_date <= $2'),
        [1, '2026-12-31', '2026-01-01'],
      );
    });
  });

  // -----------------------------------------------------------
  // createBlackout
  // -----------------------------------------------------------

  describe('createBlackout()', () => {
    it('should create a global blackout', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockBlackoutRow()],
      });

      const result = await service.createBlackout(1, 10, {
        name: 'Summer Freeze',
        startDate: '2026-07-15',
        endDate: '2026-07-31',
        isGlobal: true,
        departmentIds: [],
        teamIds: [],
        areaIds: [],
      });

      expect(result.name).toBe('Summer Freeze');
      expect(result.isGlobal).toBe(true);
      expect(result.departmentIds).toEqual([]);
      expect(mockClient.query).toHaveBeenCalledOnce();
    });

    it('should create scoped blackout with junction table sync', async () => {
      // 1. INSERT into vacation_blackouts
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockBlackoutRow({ is_global: false })],
      });
      // 2. DELETE existing scopes
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 3. INSERT department scope
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 4. INSERT team scope
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 5. Load scopes back
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            blackout_id: 'bo-001',
            org_type: 'department',
            org_id: 5,
            created_at: '',
          },
          {
            id: 2,
            blackout_id: 'bo-001',
            org_type: 'team',
            org_id: 42,
            created_at: '',
          },
        ],
      });

      const result = await service.createBlackout(1, 10, {
        name: 'Scoped Freeze',
        startDate: '2026-07-15',
        endDate: '2026-07-31',
        isGlobal: false,
        departmentIds: [5],
        teamIds: [42],
        areaIds: [],
      });

      expect(result.isGlobal).toBe(false);
      expect(result.departmentIds).toEqual([5]);
      expect(result.teamIds).toEqual([42]);
    });
  });

  // -----------------------------------------------------------
  // updateBlackout
  // -----------------------------------------------------------

  describe('updateBlackout()', () => {
    it('should update and return updated blackout', async () => {
      // 1. UPDATE query
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockBlackoutRow({ name: 'Updated Name' })],
      });
      // 2. getBlackoutById SELECT
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockBlackoutRow({ name: 'Updated Name' })],
      });
      // 3. loadScopes
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.updateBlackout(1, 10, 'bo-001', {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException when blackout not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateBlackout(1, 10, 'nonexistent', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return existing blackout when no fields to update', async () => {
      // Empty DTO → getBlackoutById
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockBlackoutRow()],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.updateBlackout(1, 10, 'bo-001', {});

      expect(result.name).toBe('Summer Freeze');
    });
  });

  // -----------------------------------------------------------
  // deleteBlackout
  // -----------------------------------------------------------

  describe('deleteBlackout()', () => {
    it('should soft-delete successfully', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'bo-001', name: 'Summer Freeze' }],
      });

      await expect(
        service.deleteBlackout(1, 10, 'bo-001'),
      ).resolves.toBeUndefined();
    });

    it('should throw NotFoundException when blackout not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.deleteBlackout(1, 10, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------
  // getConflicts — multi-scope via junction table
  // -----------------------------------------------------------

  describe('getConflicts()', () => {
    it('should return global conflicts', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'bo-001',
            name: 'Summer Freeze',
            start_date: '2026-07-15',
            end_date: '2026-07-31',
            is_global: true,
          },
        ],
      });

      const result = await service.getConflicts(1, '2026-07-20', '2026-07-25');

      expect(result).toHaveLength(1);
      expect(result[0]?.blackoutId).toBe('bo-001');
      expect(result[0]?.name).toBe('Summer Freeze');
      expect(result[0]?.isGlobal).toBe(true);
    });

    it('should return scoped conflicts', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'bo-002',
            name: 'Team Freeze',
            start_date: '2026-08-01',
            end_date: '2026-08-15',
            is_global: false,
          },
        ],
      });

      const result = await service.getConflicts(
        1,
        '2026-08-01',
        '2026-08-10',
        42,
        undefined,
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.isGlobal).toBe(false);
    });

    it('should return empty when no conflicts', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getConflicts(1, '2026-01-01', '2026-01-05');

      expect(result).toHaveLength(0);
    });

    it('should pass both teamId and deptId to query', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.getConflicts(1, '2026-07-20', '2026-07-25', 42, 7);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('vacation_blackout_scopes'),
        [1, '2026-07-20', '2026-07-25', 42, 7],
      );
    });

    it('should pass null for undefined teamId/deptId', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.getConflicts(1, '2026-07-20', '2026-07-25');

      expect(mockClient.query).toHaveBeenCalledWith(expect.any(String), [
        1,
        '2026-07-20',
        '2026-07-25',
        null,
        null,
      ]);
    });
  });
});
