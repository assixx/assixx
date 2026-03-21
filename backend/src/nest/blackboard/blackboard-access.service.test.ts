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
import type { ScopeService } from '../hierarchy-permission/scope.service.js';
import { BlackboardAccessService } from './blackboard-access.service.js';
import type { DbBlackboardEntry } from './blackboard.types.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

function createMockScopeService() {
  return {
    getScope: vi.fn().mockResolvedValue({
      type: 'limited',
      areaIds: [],
      departmentIds: [],
      teamIds: [],
      leadAreaIds: [],
      leadDepartmentIds: [],
      leadTeamIds: [],
      isAreaLead: false,
      isDepartmentLead: false,
      isTeamLead: false,
      isAnyLead: false,
    }),
  };
}

function makeEntry(overrides: Partial<DbBlackboardEntry> = {}): DbBlackboardEntry {
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
  let mockScope: ReturnType<typeof createMockScopeService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockScope = createMockScopeService();
    service = new BlackboardAccessService(
      mockDb as unknown as DatabaseService,
      mockScope as unknown as ScopeService,
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
    const baseQuery = 'SELECT * FROM blackboard_entries e WHERE e.tenant_id = $1';

    it('should not modify query for root user', () => {
      const params = [10];
      const result = service.applyAccessControl(baseQuery, [...params], 'root', null, null);

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
      const result = service.applyAccessControl(baseQuery, [...params], 'admin', null, null, 5);

      expect(result.query).toContain('admin_area_permissions');
      expect(result.params).toHaveLength(6); // 1 original + 5 userId refs
    });

    it('should add employee SQL for employee users', () => {
      const params = [10];
      const result = service.applyAccessControl(baseQuery, [...params], 'employee', 3, 7);

      expect(result.query).toContain('org_level');
      expect(result.params).toContain(3); // departmentId
      expect(result.params).toContain(7); // teamId
    });

    it('should use 0 as fallback for null department/team', () => {
      const params = [10];
      const result = service.applyAccessControl(baseQuery, [...params], 'employee', null, null);

      expect(result.params).toContain(0); // departmentId ?? 0
      expect(result.params[1]).toBe(0);
      expect(result.params[2]).toBe(0);
    });
  });

  // =============================================================
  // checkEntryAccess
  // =============================================================

  describe('checkEntryAccess', () => {
    it('should always grant access for root', async () => {
      const result = await service.checkEntryAccess(makeEntry(), 'root', false, 1, 10, null, null);

      expect(result).toBe(true);
    });

    it('should always grant access for full-access user', async () => {
      const result = await service.checkEntryAccess(makeEntry(), 'admin', true, 1, 10, null, null);

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

    it('should grant employee access to their team entries', async () => {
      const result = await service.checkEntryAccess(
        makeEntry({ org_level: 'team', org_id: 7 }),
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

    it('should grant admin access via company-wide entry (no assignments)', async () => {
      // company-wide found — early return
      mockDb.query.mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.checkEntryAccess(
        makeEntry({ org_level: 'company' }),
        'admin',
        false,
        2,
        10,
        null,
        null,
      );

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should grant admin access via area permission', async () => {
      // no company-wide assignments
      mockDb.query.mockResolvedValueOnce([]);
      // area access found — early return
      mockDb.query.mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.checkEntryAccess(
        makeEntry({ org_level: 'area', org_id: 2 }),
        'admin',
        false,
        2,
        10,
        null,
        null,
      );

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
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

    it('should grant admin access via team permission', async () => {
      // no company-wide assignments
      mockDb.query.mockResolvedValueOnce([]);
      // no area access
      mockDb.query.mockResolvedValueOnce([]);
      // no department access
      mockDb.query.mockResolvedValueOnce([]);
      // team access found
      mockDb.query.mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.checkEntryAccess(
        makeEntry({ org_level: 'team', org_id: 7 }),
        'admin',
        false,
        2,
        10,
        null,
        null,
      );

      expect(result).toBe(true);
    });

    it('should deny admin access when no permissions match', async () => {
      // no company-wide assignments
      mockDb.query.mockResolvedValueOnce([]);
      // no area access
      mockDb.query.mockResolvedValueOnce([]);
      // no department access
      mockDb.query.mockResolvedValueOnce([]);
      // no team access
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.checkEntryAccess(
        makeEntry({ org_level: 'team', org_id: 7 }),
        'admin',
        false,
        2,
        10,
        null,
        null,
      );

      expect(result).toBe(false);
    });
  });

  // =============================================================
  // validateOrgPermissions
  // =============================================================

  describe('validateOrgPermissions', () => {
    it('should pass with empty org arrays', async () => {
      await expect(service.validateOrgPermissions(1, 10)).resolves.toBeUndefined();
    });

    it('should skip validation for full-scope user', async () => {
      mockScope.getScope.mockResolvedValueOnce({
        type: 'full',
        areaIds: [],
        departmentIds: [],
        teamIds: [],
      });

      await expect(
        service.validateOrgPermissions(1, 10, [99], [42], [77]),
      ).resolves.toBeUndefined();
    });

    it('should pass when all IDs are in scope', async () => {
      mockScope.getScope.mockResolvedValueOnce({
        type: 'limited',
        areaIds: [1, 2],
        departmentIds: [10, 20],
        teamIds: [100, 200],
      });

      await expect(
        service.validateOrgPermissions(1, 10, [1], [10], [100]),
      ).resolves.toBeUndefined();
    });

    it('should throw ForbiddenException for inaccessible area', async () => {
      await expect(service.validateOrgPermissions(1, 10, [99])).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for inaccessible department', async () => {
      await expect(service.validateOrgPermissions(1, 10, [], [42])).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException for inaccessible team', async () => {
      await expect(service.validateOrgPermissions(1, 10, [], [], [77])).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
