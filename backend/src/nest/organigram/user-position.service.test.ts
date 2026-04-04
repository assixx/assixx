/**
 * Unit tests for UserPositionService
 *
 * Focus: getByUser, getByPosition, assign (idempotent), unassign, hasPosition.
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { UserPositionDetailRow } from './position-catalog.types.js';
import { UserPositionService } from './user-position.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('mock-uuid-v7'),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  const qf = vi.fn();
  const qof = vi.fn().mockResolvedValue(null);
  return {
    query: qf,
    tenantQuery: qf,
    queryOne: qof,
    tenantQueryOne: qof,
    getUserId: vi.fn().mockReturnValue(1),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockActivityLogger() {
  return { log: vi.fn().mockResolvedValue(undefined) };
}

function makeDetailRow(overrides: Partial<UserPositionDetailRow> = {}): UserPositionDetailRow {
  return {
    id: 'up-uuid-001',
    tenant_id: 10,
    user_id: 42,
    position_id: 'pos-uuid-001',
    created_at: '2026-03-20T10:00:00Z',
    position_name: 'Qualitätsmanager',
    role_category: 'employee',
    ...overrides,
  };
}

// =============================================================
// Tests
// =============================================================

describe('UserPositionService', () => {
  let service: UserPositionService;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    const mockActivityLogger = createMockActivityLogger();
    service = new UserPositionService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // getByUser
  // =============================================================

  describe('getByUser', () => {
    it('should return mapped user positions with JOINed names', async () => {
      mockDb.query.mockResolvedValueOnce([makeDetailRow()]);

      const result = await service.getByUser(10, 42);

      expect(result).toHaveLength(1);
      expect(result[0]?.positionName).toBe('Qualitätsmanager');
      expect(result[0]?.roleCategory).toBe('employee');
      expect(result[0]?.userId).toBe(42);
    });

    it('should return empty array when user has no positions', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getByUser(10, 42);

      expect(result).toEqual([]);
    });
  });

  // =============================================================
  // getByPosition
  // =============================================================

  describe('getByPosition', () => {
    it('should return users with the given position', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          user_id: 42,
          first_name: 'Max',
          last_name: 'Muster',
          username: 'max',
        },
        {
          user_id: 43,
          first_name: 'Erika',
          last_name: 'Muster',
          username: 'erika',
        },
      ]);

      const result = await service.getByPosition(10, 'pos-uuid-001');

      expect(result).toHaveLength(2);
      expect(result[0]?.user_id).toBe(42);
      expect(result[1]?.first_name).toBe('Erika');
    });
  });

  // =============================================================
  // assign
  // =============================================================

  describe('assign', () => {
    it('should check position exists then insert with ON CONFLICT DO NOTHING', async () => {
      // assertPositionExists (uses query)
      mockDb.query.mockResolvedValueOnce([{ id: 'pos-uuid-001' }]);
      // INSERT (uses tenantQuery)
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await service.assign(10, 42, 'pos-uuid-001');

      // 2 total: assertPositionExists + INSERT (query === tenantQuery, same fn)
      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(2);
      // Index 1 = second call = INSERT (first was assertPositionExists)
      const insertCall = mockDb.tenantQuery.mock.calls[1];
      expect(insertCall?.[0]).toContain('ON CONFLICT');
      expect(insertCall?.[0]).toContain('DO NOTHING');
    });

    it('should throw NotFoundException when position does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.assign(10, 42, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should be idempotent — second assign does not throw', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 'pos-uuid-001' }]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(service.assign(10, 42, 'pos-uuid-001')).resolves.toBeUndefined();
    });
  });

  // =============================================================
  // unassign
  // =============================================================

  describe('unassign', () => {
    it('should delete the assignment', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 'up-uuid-001' }]);

      await service.unassign(10, 42, 'pos-uuid-001');

      const deleteCall = mockDb.tenantQuery.mock.calls[0];
      expect(deleteCall?.[0]).toContain('DELETE FROM user_positions');
      expect(deleteCall?.[1]).toEqual([10, 42, 'pos-uuid-001']);
    });

    it('should not throw when assignment does not exist', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(service.unassign(10, 42, 'pos-uuid-001')).resolves.toBeUndefined();
    });
  });

  // =============================================================
  // hasPosition
  // =============================================================

  describe('hasPosition', () => {
    it('should return true when assignment exists', async () => {
      mockDb.query.mockResolvedValueOnce([{ exists: true }]);

      const result = await service.hasPosition(10, 42, 'pos-uuid-001');

      expect(result).toBe(true);
    });

    it('should return false when assignment does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([{ exists: false }]);

      const result = await service.hasPosition(10, 42, 'pos-uuid-001');

      expect(result).toBe(false);
    });
  });
});
