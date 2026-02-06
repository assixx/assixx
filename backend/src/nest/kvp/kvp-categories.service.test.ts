/**
 * Unit tests for KvpCategoriesService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Access control (root/admin-full-access), overlay pattern
 *        (defaults + custom), category limit, conflict checks.
 */
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { KvpCategoriesService } from './kvp-categories.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

// =============================================================
// KvpCategoriesService
// =============================================================

describe('KvpCategoriesService', () => {
  let service: KvpCategoriesService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new KvpCategoriesService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // Access control (assertHasFullAccess)
  // =============================================================

  describe('access control', () => {
    it('should allow root user access', async () => {
      // defaults query + custom query (Promise.all)
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.getCustomizable(10, 1, 'root'),
      ).resolves.toBeDefined();
    });

    it('should allow admin with has_full_access', async () => {
      // assertHasFullAccess → check user
      mockDb.query.mockResolvedValueOnce([{ has_full_access: true }]);
      // defaults + custom
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.getCustomizable(10, 1, 'admin'),
      ).resolves.toBeDefined();
    });

    it('should deny admin without has_full_access', async () => {
      mockDb.query.mockResolvedValueOnce([{ has_full_access: false }]);

      await expect(service.getCustomizable(10, 1, 'admin')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should deny employee user', async () => {
      await expect(service.getCustomizable(10, 1, 'employee')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // =============================================================
  // getCustomizable
  // =============================================================

  describe('getCustomizable', () => {
    it('should return defaults with override info and custom categories', async () => {
      // defaults query
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Safety',
          description: 'Safety improvements',
          color: '#ff0000',
          icon: 'shield',
          custom_name: 'Sicherheit',
        },
        {
          id: 2,
          name: 'Quality',
          description: 'Quality improvements',
          color: '#00ff00',
          icon: 'check',
          custom_name: null,
        },
      ]);
      // custom query
      mockDb.query.mockResolvedValueOnce([
        {
          id: 100,
          custom_name: 'Custom Cat',
          description: 'A custom category',
          color: '#0000ff',
          icon: 'star',
        },
      ]);

      const result = await service.getCustomizable(10, 1, 'root');

      expect(result.defaults).toHaveLength(2);
      expect(result.defaults[0]?.isCustomized).toBe(true);
      expect(result.defaults[0]?.customName).toBe('Sicherheit');
      expect(result.defaults[1]?.isCustomized).toBe(false);
      expect(result.custom).toHaveLength(1);
      expect(result.totalCount).toBe(3);
      expect(result.maxAllowed).toBe(20);
      expect(result.remainingSlots).toBe(17);
    });
  });

  // =============================================================
  // upsertOverride
  // =============================================================

  describe('upsertOverride', () => {
    it('should throw NotFoundException when global category not found', async () => {
      // assertGlobalCategoryExists → not found
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.upsertOverride(10, 999, 'Custom Name', 1, 'root'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should upsert override and return id', async () => {
      // assertGlobalCategoryExists → found
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // INSERT ON CONFLICT RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 50 }]);

      const result = await service.upsertOverride(
        10,
        1,
        'Sicherheit',
        1,
        'root',
      );

      expect(result.id).toBe(50);
    });
  });

  // =============================================================
  // deleteOverride
  // =============================================================

  describe('deleteOverride', () => {
    it('should delete override', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.deleteOverride(10, 1, 1, 'root');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM kvp_categories_custom'),
        [1, 10],
      );
    });
  });

  // =============================================================
  // createCustom
  // =============================================================

  describe('createCustom', () => {
    it('should throw ForbiddenException when limit reached', async () => {
      // assertCategoryLimitNotReached → count = 20
      mockDb.query.mockResolvedValueOnce([{ cnt: 20 }]);

      await expect(
        service.createCustom(10, 'New Cat', '#fff', 'star', 1, 'root'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create custom category and return id', async () => {
      // assertCategoryLimitNotReached → count = 10
      mockDb.query.mockResolvedValueOnce([{ cnt: 10 }]);
      // INSERT RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 100 }]);

      const result = await service.createCustom(
        10,
        'New Cat',
        '#fff',
        'star',
        1,
        'root',
        'A description',
      );

      expect(result.id).toBe(100);
    });
  });

  // =============================================================
  // deleteCustom
  // =============================================================

  describe('deleteCustom', () => {
    it('should throw ConflictException when suggestions reference category', async () => {
      // assertNoSuggestionsReference → count > 0
      mockDb.query.mockResolvedValueOnce([{ cnt: 3 }]);

      await expect(service.deleteCustom(10, 100, 1, 'root')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException when custom category not found', async () => {
      // assertNoSuggestionsReference → 0
      mockDb.query.mockResolvedValueOnce([{ cnt: 0 }]);
      // DELETE → no rows returned
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.deleteCustom(10, 999, 1, 'root')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete custom category', async () => {
      // assertNoSuggestionsReference → 0
      mockDb.query.mockResolvedValueOnce([{ cnt: 0 }]);
      // DELETE RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 100 }]);

      await service.deleteCustom(10, 100, 1, 'root');

      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });
});
