/**
 * Unit tests for KvpRewardTiersService
 *
 * Mocked DatabaseService — no Docker needed.
 * Focus: CRUD, sort_order auto-increment, conflict detection, soft-delete.
 */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { KvpRewardTiersService } from './kvp-reward-tiers.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  const qf = vi.fn();
  return { query: qf, tenantQuery: qf };
}

// =============================================================
// KvpRewardTiersService
// =============================================================

describe('KvpRewardTiersService', () => {
  let service: KvpRewardTiersService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new KvpRewardTiersService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // findAll
  // =============================================================

  describe('findAll', () => {
    it('should return mapped reward tiers sorted by sort_order', async () => {
      mockDb.query.mockResolvedValueOnce([
        { id: 1, amount: '50.00', sort_order: 1, is_active: 1 },
        { id: 2, amount: '100.00', sort_order: 2, is_active: 1 },
        { id: 3, amount: '200.00', sort_order: 3, is_active: 1 },
      ]);

      const result = await service.findAll(1);

      expect(result).toEqual([
        { id: 1, amount: 50, sortOrder: 1 },
        { id: 2, amount: 100, sortOrder: 2 },
        { id: 3, amount: 200, sortOrder: 3 },
      ]);
    });

    it('should convert string amounts to numbers', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1, amount: '99.99', sort_order: 1, is_active: 1 }]);

      const result = await service.findAll(1);

      expect(result[0]?.amount).toBe(99.99);
      expect(typeof result[0]?.amount).toBe('number');
    });

    it('should return empty array when no tiers exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.findAll(1);

      expect(result).toEqual([]);
    });

    it('should pass correct tenantId and IS_ACTIVE filter', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.findAll(42);

      expect(mockDb.query).toHaveBeenCalledOnce();
      const [, params] = mockDb.query.mock.calls[0] as [string, unknown[]];
      expect(params[0]).toBe(42);
      expect(params[1]).toBe(1); // IS_ACTIVE.ACTIVE
    });
  });

  // =============================================================
  // create
  // =============================================================

  describe('create', () => {
    it('should create a tier with auto-incremented sort_order', async () => {
      // MAX(sort_order) query
      mockDb.query.mockResolvedValueOnce([{ max: '3' }]);
      // INSERT RETURNING
      mockDb.query.mockResolvedValueOnce([
        { id: 10, amount: '150.00', sort_order: 4, is_active: 1 },
      ]);

      const result = await service.create(1, 150);

      expect(result).toEqual({ id: 10, amount: 150, sortOrder: 4 });
    });

    it('should start sort_order at 1 when no tiers exist', async () => {
      mockDb.query.mockResolvedValueOnce([{ max: null }]);
      mockDb.query.mockResolvedValueOnce([{ id: 1, amount: '50.00', sort_order: 1, is_active: 1 }]);

      const result = await service.create(1, 50);

      expect(result.sortOrder).toBe(1);
      // Verify INSERT was called with sort_order = 1
      const [, insertParams] = mockDb.query.mock.calls[1] as [string, unknown[]];
      expect(insertParams[2]).toBe(1);
    });

    it('should throw ConflictException on duplicate amount', async () => {
      mockDb.query.mockResolvedValueOnce([{ max: '1' }]);
      mockDb.query.mockRejectedValueOnce(
        new Error(
          'duplicate key value violates unique constraint "idx_kvp_reward_tiers_tenant_amount"',
        ),
      );

      const error = await service.create(1, 100).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).message).toContain('100€ existiert bereits');
    });

    it('should rethrow non-conflict errors', async () => {
      mockDb.query.mockResolvedValueOnce([{ max: '1' }]);
      mockDb.query.mockRejectedValueOnce(new Error('connection refused'));

      await expect(service.create(1, 50)).rejects.toThrow('connection refused');
    });

    it('should throw when INSERT returns no rows', async () => {
      mockDb.query.mockResolvedValueOnce([{ max: '0' }]);
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.create(1, 50)).rejects.toThrow('Insert returned no rows');
    });
  });

  // =============================================================
  // remove
  // =============================================================

  describe('remove', () => {
    it('should soft-delete an existing tier', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]);

      await expect(service.remove(1, 5)).resolves.toBeUndefined();
    });

    it('should throw NotFoundException when tier does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.remove(1, 999)).rejects.toThrow(NotFoundException);
    });

    it('should pass correct IS_ACTIVE values (DELETED + ACTIVE filter)', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]);

      await service.remove(42, 5);

      const [, params] = mockDb.query.mock.calls[0] as [string, unknown[]];
      expect(params[0]).toBe(4); // IS_ACTIVE.DELETED
      expect(params[1]).toBe(5); // tierId
      expect(params[2]).toBe(42); // tenantId
      expect(params[3]).toBe(1); // IS_ACTIVE.ACTIVE
    });
  });
});
