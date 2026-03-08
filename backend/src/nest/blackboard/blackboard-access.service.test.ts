/**
 * Unit tests for BlackboardAccessService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: User access info retrieval, role-based access control SQL builders,
 *        entry access checks (root, admin, employee), org permission validation.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import type { HierarchyPermissionService } from '../hierarchy-permission/hierarchy-permission.service.js';
import { BlackboardAccessService } from './blackboard-access.service.js';
import type { DbBlackboardEntry } from './blackboard.types.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

function createMockHierarchyPermission() {
  return {
    getAccessibleAreaIds: vi.fn().mockResolvedValue([]),
    getAccessibleDepartmentIds: vi.fn().mockResolvedValue([]),
    getAccessibleTeamIds: vi.fn().mockResolvedValue([]),
  };
}

function makeEntry(
  overrides: Partial<DbBlackboardEntry> = {},
): DbBlackboardEntry {
  return {
    id: 1,
    tenant_id: 10,
    title: 'Test Entry',
    content: 'Content',
    priority: 'normal',
    org_level: 'company',
    org_id: null,
    created_by: 1,
    is_active: IS_ACTIVE.ACTIVE,
    created_at: new Date('2025-01-01'),
    updated_at: null,
    ...overrides,
  } as DbBlackboardEntry;
}

// =============================================================
// BlackboardAccessService
// =============================================================

describe('SECURITY: BlackboardAccessService', () => {
  let service: BlackboardAccessService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockHierarchy: ReturnType<typeof createMockHierarchyPermission>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockHierarchy = createMockHierarchyPermission();
    service = new BlackboardAccessService(
      mockDb as unknown as DatabaseService,
      mockHierarchy as unknown as HierarchyPermissionService,
    );
  });

  // =============================================================
  // getUserAccessInfo
  // =============================================================

  describe('getUserAccessInfo', () => {
    it('should return default when user not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getUserAccessInfo(999);

      expect(result.role).toBeNull();
      expect(result.departmentId).toBeNull();
      expect(result.hasFullAccess).toBe(false);
    });

    it('should return user access info', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          role: 'admin',
          has_full_access: true,
          primary_department_id: 5,
          team_id: 3,
        },
      ]);

      const result = await service.getUserAccessInfo(1);

      expect(result.role).toBe('admin');
      expect(result.departmentId).toBe(5);
      expect(result.teamId).toBe(3);
      expect(result.hasFullAccess).toBe(true);
    });
  });

  // =============================================================
  // buildAdminAccessSQL
  // =============================================================

  describe('buildAdminAccessSQL', () => {
    it('should return SQL with correct parameter indices', () => {
      const sql = service.buildAdminAccessSQL(3);

      expect(sql).toContain('$3');
      expect(sql).toContain('$4');
      expect(sql).toContain('$5');
      expect(sql).toContain('$6');
      expect(sql).toContain('$7');
    });
  });

  // =============================================================
  // applyAccessControl
  // =============================================================

  describe('applyAccessControl', () => {
    const baseQuery =
      'SELECT * FROM blackboard_entries e WHERE e.tenant_id = $1';

    it('should not modify query for root user', () => {
      const params = [10];
      const result = service.applyAccessControl(
        baseQuery,
        [...params],
        'root',
        null,
        null,
      );

      expect(result.query).toBe(baseQuery);
      expect(result.params).toHaveLength(1);
    });

    it('should not modify query for full-access user', () => {
      const params = [10];
      const result = service.applyAccessControl(
        baseQuery,
        [...params],
        'admin',
        null,
        null,
        undefined,
        true,
      );

      expect(result.query).toBe(baseQuery);
    });

    it('should add admin SQL for admin users', () => {
      const params = [10];
      const result = service.applyAccessControl(
        baseQuery,
        [...params],
        'admin',
        null,
        null,
        5,
      );

      expect(result.query).toContain('admin_area_permissions');
      expect(result.params).toHaveLength(6); // 1 original + 5 userId refs
    });

    it('should add employee SQL for employee users', () => {
      const params = [10];
      const result = service.applyAccessControl(
        baseQuery,
        [...params],
        'employee',
        3,
        7,
      );

      expect(result.query).toContain('org_level');
      expect(result.params).toContain(3); // departmentId
      expect(result.params).toContain(7); // teamId
    });
  });

  // =============================================================
  // checkEntryAccess
  // =============================================================

  describe('checkEntryAccess', () => {
    it('should always grant access for root', async () => {
      const result = await service.checkEntryAccess(
        makeEntry(),
        'root',
        false,
        1,
        10,
        null,
        null,
      );

      expect(result).toBe(true);
    });

    it('should always grant access for full-access user', async () => {
      const result = await service.checkEntryAccess(
        makeEntry(),
        'admin',
        true,
        1,
        10,
        null,
        null,
      );

      expect(result).toBe(true);
    });

    it('should grant employee access to company-level entries', async () => {
      const result = await service.checkEntryAccess(
        makeEntry({ org_level: 'company' }),
        'employee',
        false,
        5,
        10,
        3,
        7,
      );

      expect(result).toBe(true);
    });

    it('should grant employee access to their department entries', async () => {
      const result = await service.checkEntryAccess(
        makeEntry({ org_level: 'department', org_id: 3 }),
        'employee',
        false,
        5,
        10,
        3,
        7,
      );

      expect(result).toBe(true);
    });

    it('should deny employee access to other department entries', async () => {
      const result = await service.checkEntryAccess(
        makeEntry({ org_level: 'department', org_id: 99 }),
        'employee',
        false,
        5,
        10,
        3,
        7,
      );

      expect(result).toBe(false);
    });

    it('should check admin permission tables', async () => {
      // no company-wide assignments
      mockDb.query.mockResolvedValueOnce([]);
      // no area access
      mockDb.query.mockResolvedValueOnce([]);
      // department access found
      mockDb.query.mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.checkEntryAccess(
        makeEntry({ org_level: 'department', org_id: 5 }),
        'admin',
        false,
        2,
        10,
        null,
        null,
      );

      expect(result).toBe(true);
    });
  });

  // =============================================================
  // validateOrgPermissions
  // =============================================================

  describe('validateOrgPermissions', () => {
    it('should pass with empty org arrays', async () => {
      await expect(
        service.validateOrgPermissions(1, 10),
      ).resolves.toBeUndefined();
    });

    it('should throw ForbiddenException for inaccessible area', async () => {
      // mockHierarchy returns empty arrays by default

      await expect(service.validateOrgPermissions(1, 10, [99])).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
