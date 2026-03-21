/**
 * Unit tests for KvpCategoriesService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Access control (root/admin-full-access), overlay pattern
 *        (defaults + custom), category limit, conflict checks.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
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

      await expect(service.getCustomizable(10, 1, 'root')).resolves.toBeDefined();
    });

    it('should allow admin with has_full_access', async () => {
      // assertHasFullAccess → check user
      mockDb.query.mockResolvedValueOnce([{ has_full_access: true }]);
      // defaults + custom
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getCustomizable(10, 1, 'admin')).resolves.toBeDefined();
    });

    it('should deny admin without has_full_access', async () => {
      mockDb.query.mockResolvedValueOnce([{ has_full_access: false }]);

      await expect(service.getCustomizable(10, 1, 'admin')).rejects.toThrow(ForbiddenException);
    });

    it('should deny employee user', async () => {
      await expect(service.getCustomizable(10, 1, 'employee')).rejects.toThrow(ForbiddenException);
    });

    it('should deny admin when user row not found in DB', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getCustomizable(10, 1, 'admin')).rejects.toThrow(ForbiddenException);
    });

    it('should deny admin when has_full_access is null/undefined', async () => {
      mockDb.query.mockResolvedValueOnce([{ has_full_access: null }]);

      await expect(service.getCustomizable(10, 1, 'admin')).rejects.toThrow(ForbiddenException);
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

    it('should map custom category suggestion_count correctly', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([
        {
          id: 200,
          custom_name: 'Custom With Count',
          description: null,
          color: '#123456',
          icon: 'tag',
          suggestion_count: 7,
        },
      ]);

      const result = await service.getCustomizable(10, 1, 'root');

      expect(result.custom).toHaveLength(1);
      expect(result.custom[0]?.suggestionCount).toBe(7);
      expect(result.custom[0]?.name).toBe('Custom With Count');
      expect(result.custom[0]?.description).toBeNull();
    });

    it('should return empty defaults and custom when no categories exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getCustomizable(10, 1, 'root');

      expect(result.defaults).toHaveLength(0);
      expect(result.custom).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(result.remainingSlots).toBe(20);
    });
  });

  // =============================================================
  // upsertOverride
  // =============================================================

  describe('upsertOverride', () => {
    it('should throw NotFoundException when global category not found', async () => {
      // assertGlobalCategoryExists → not found
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.upsertOverride(10, 999, 'Custom Name', 1, 'root')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should upsert override and return id', async () => {
      // assertGlobalCategoryExists → found
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // INSERT ON CONFLICT RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 50 }]);

      const result = await service.upsertOverride(10, 1, 'Sicherheit', 1, 'root');

      expect(result.id).toBe(50);
    });

    it('should throw Error when upsert returns no rows', async () => {
      // assertGlobalCategoryExists → found
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // INSERT ON CONFLICT returns empty array
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.upsertOverride(10, 1, 'Override Name', 1, 'root')).rejects.toThrow(
        'Failed to upsert override',
      );
    });

    it('should check access for admin user before upserting', async () => {
      // assertHasFullAccess → admin with full access
      mockDb.query.mockResolvedValueOnce([{ has_full_access: true }]);
      // assertGlobalCategoryExists → found
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // INSERT RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 60 }]);

      const result = await service.upsertOverride(10, 1, 'Admin Override', 1, 'admin');

      expect(result.id).toBe(60);
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

    it('should deny access for employee role', async () => {
      await expect(service.deleteOverride(10, 1, 1, 'employee')).rejects.toThrow(
        ForbiddenException,
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

      await expect(service.createCustom(10, 'New Cat', '#fff', 'star', 1, 'root')).rejects.toThrow(
        ForbiddenException,
      );
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

    it('should create custom category without description (null fallback)', async () => {
      // assertCategoryLimitNotReached → count = 5
      mockDb.query.mockResolvedValueOnce([{ cnt: 5 }]);
      // INSERT RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 101 }]);

      const result = await service.createCustom(10, 'No Desc Cat', '#000', 'circle', 1, 'root');

      expect(result.id).toBe(101);
      // Verify description was passed as null
      expect(mockDb.query).toHaveBeenLastCalledWith(
        expect.stringContaining('INSERT INTO kvp_categories_custom'),
        [10, 'No Desc Cat', null, '#000', 'circle'],
      );
    });

    it('should throw Error when insert returns no rows', async () => {
      // assertCategoryLimitNotReached → count = 5
      mockDb.query.mockResolvedValueOnce([{ cnt: 5 }]);
      // INSERT returns empty array
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.createCustom(10, 'Fail Cat', '#fff', 'star', 1, 'root')).rejects.toThrow(
        'Failed to create custom category',
      );
    });

    it('should use cnt ?? 0 fallback when limit check returns undefined row', async () => {
      // assertCategoryLimitNotReached → returns empty array (rows[0] undefined → cnt defaults to 0)
      mockDb.query.mockResolvedValueOnce([]);
      // INSERT RETURNING id (should proceed since 0 < 20)
      mockDb.query.mockResolvedValueOnce([{ id: 102 }]);

      const result = await service.createCustom(10, 'Fallback Cat', '#abc', 'flag', 1, 'root');

      expect(result.id).toBe(102);
    });
  });

  // =============================================================
  // deleteCustom
  // =============================================================

  describe('deleteCustom', () => {
    it('should throw NotFoundException when custom category not found', async () => {
      // UPDATE SET is_active = 4 → no rows returned (not found or already deleted)
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.deleteCustom(10, 999, 1, 'root')).rejects.toThrow(NotFoundException);
    });

    it('should soft-delete custom category and return affected count', async () => {
      // UPDATE SET is_active = 4 → returns soft-deleted row
      mockDb.query.mockResolvedValueOnce([{ id: 100 }]);
      // COUNT affected suggestions
      mockDb.query.mockResolvedValueOnce([{ cnt: 3 }]);

      const result = await service.deleteCustom(10, 100, 1, 'root');

      expect(result.affectedSuggestions).toBe(3);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining(`SET is_active = ${IS_ACTIVE.DELETED}`),
        [100, 10],
      );
    });

    it('should soft-delete category with zero affected suggestions', async () => {
      // UPDATE SET is_active = 4 → returns soft-deleted row
      mockDb.query.mockResolvedValueOnce([{ id: 100 }]);
      // COUNT affected suggestions → 0
      mockDb.query.mockResolvedValueOnce([{ cnt: 0 }]);

      const result = await service.deleteCustom(10, 100, 1, 'root');

      expect(result.affectedSuggestions).toBe(0);
    });

    it('should default to 0 affected suggestions when count query returns empty', async () => {
      // UPDATE SET is_active = 4 → returns soft-deleted row
      mockDb.query.mockResolvedValueOnce([{ id: 100 }]);
      // COUNT query returns empty array (rows[0] undefined → cnt ?? 0)
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.deleteCustom(10, 100, 1, 'root');

      expect(result.affectedSuggestions).toBe(0);
    });
  });

  // =============================================================
  // updateCustom
  // =============================================================

  describe('updateCustom', () => {
    it('should throw BadRequestException when no fields to update', async () => {
      await expect(service.updateCustom(10, 1, 1, 'root', {})).rejects.toThrow(BadRequestException);
    });

    it('should update only name field', async () => {
      // UPDATE RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);

      const result = await service.updateCustom(10, 1, 1, 'root', {
        name: 'Renamed Cat',
      });

      expect(result.id).toBe(1);
      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('custom_name = $1'), [
        'Renamed Cat',
        1,
        10,
      ]);
    });

    it('should update only color field', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 2 }]);

      const result = await service.updateCustom(10, 2, 1, 'root', {
        color: '#ff0000',
      });

      expect(result.id).toBe(2);
      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('color = $1'), [
        '#ff0000',
        2,
        10,
      ]);
    });

    it('should update only icon field', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 3 }]);

      const result = await service.updateCustom(10, 3, 1, 'root', {
        icon: 'bolt',
      });

      expect(result.id).toBe(3);
      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('icon = $1'), [
        'bolt',
        3,
        10,
      ]);
    });

    it('should update only description field', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 4 }]);

      const result = await service.updateCustom(10, 4, 1, 'root', {
        description: 'New description',
      });

      expect(result.id).toBe(4);
      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('description = $1'), [
        'New description',
        4,
        10,
      ]);
    });

    it('should update multiple fields at once', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]);

      const result = await service.updateCustom(10, 5, 1, 'root', {
        name: 'Updated',
        color: '#aabbcc',
        icon: 'rocket',
        description: 'Full update',
      });

      expect(result.id).toBe(5);
      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('custom_name = $1'), [
        'Updated',
        '#aabbcc',
        'rocket',
        'Full update',
        5,
        10,
      ]);
    });

    it('should throw NotFoundException when custom category not found', async () => {
      // UPDATE returns empty array (not found or wrong tenant)
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.updateCustom(10, 999, 1, 'root', { name: 'Ghost' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should deny access for employee role', async () => {
      await expect(service.updateCustom(10, 1, 1, 'employee', { name: 'Nope' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow admin with has_full_access to update', async () => {
      // assertHasFullAccess → admin with full access
      mockDb.query.mockResolvedValueOnce([{ has_full_access: true }]);
      // UPDATE RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 10 }]);

      const result = await service.updateCustom(10, 10, 1, 'admin', {
        name: 'Admin Updated',
      });

      expect(result.id).toBe(10);
    });
  });
});
