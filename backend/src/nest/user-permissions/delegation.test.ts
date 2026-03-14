/**
 * Unit tests for Delegated Permission Management
 *
 * Tests the delegation security rules:
 * - Regel 1: No self-grant (targetUser ≠ currentUser)
 * - Regel 2: Only delegate own permissions
 * - Regel 3: Only within own scope
 * - Regel 4: manage-permissions not delegatable
 *
 * Tests assertPermissionAccess, isDelegatableEntry, leaderHasPermission,
 * filterByLeaderPerms via the public service/controller API.
 *
 * @see docs/FEAT_DELEGATED_PERMISSION_MANAGEMENT_MASTERPLAN.md Step 3.1
 */
import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import type { HierarchyPermissionService } from '../hierarchy-permission/hierarchy-permission.service.js';
import type { ScopeService } from '../hierarchy-permission/scope.service.js';
import { UserPermissionsController } from './user-permissions.controller.js';
import type { UserPermissionsService } from './user-permissions.service.js';

// =============================================================
// Mock Factories
// =============================================================

function createMockService() {
  return {
    getPermissions: vi.fn().mockResolvedValue([]),
    upsertPermissions: vi.fn().mockResolvedValue({ applied: 0 }),
    hasPermission: vi.fn().mockResolvedValue(false),
    resolveUserId: vi.fn().mockResolvedValue(99),
  };
}

function createMockScope() {
  return {
    getScope: vi.fn().mockResolvedValue({
      type: 'limited',
      areaIds: [],
      departmentIds: [],
      teamIds: [100],
      leadAreaIds: [],
      leadDepartmentIds: [],
      leadTeamIds: [100],
      isAreaLead: false,
      isDepartmentLead: false,
      isTeamLead: true,
      isAnyLead: true,
    }),
  };
}

function createMockHierarchy() {
  return {
    getVisibleUserIds: vi.fn().mockResolvedValue([99, 100, 101]),
  };
}

function createUser(overrides: Partial<NestAuthUser> = {}): NestAuthUser {
  return {
    id: 42,
    email: 'lead@test.de',
    role: 'employee',
    activeRole: 'employee',
    tenantId: 1,
    isRoleSwitched: false,
    hasFullAccess: false,
    ...overrides,
  } as NestAuthUser;
}

// =============================================================
// Tests
// =============================================================

describe('SECURITY: Delegated Permission Management', () => {
  let controller: UserPermissionsController;
  let mockService: ReturnType<typeof createMockService>;
  let mockScope: ReturnType<typeof createMockScope>;
  let mockHierarchy: ReturnType<typeof createMockHierarchy>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockService = createMockService();
    mockScope = createMockScope();
    mockHierarchy = createMockHierarchy();
    controller = new UserPermissionsController(
      mockService as unknown as UserPermissionsService,
      mockScope as unknown as ScopeService,
      mockHierarchy as unknown as HierarchyPermissionService,
    );
  });

  // Scenario 1: Root can always access
  describe('Root access', () => {
    it('should allow root to get permissions for any user', async () => {
      const user = createUser({ id: 1, activeRole: 'root', role: 'root' });
      await controller.getPermissions(1, 'target-uuid', user);
      expect(mockService.getPermissions).toHaveBeenCalledWith(
        1,
        'target-uuid',
        undefined,
      );
    });

    it('should allow root to upsert permissions for any user', async () => {
      const user = createUser({ id: 1, activeRole: 'root', role: 'root' });
      await controller.upsertPermissions(
        1,
        'target-uuid',
        { permissions: [] },
        user,
      );
      expect(mockService.upsertPermissions).toHaveBeenCalled();
    });
  });

  // Scenario 2: Admin with full access
  describe('Admin (full access)', () => {
    it('should allow admin with full access for other users', async () => {
      const user = createUser({
        id: 10,
        activeRole: 'admin',
        role: 'admin',
        hasFullAccess: true,
      });
      mockService.resolveUserId.mockResolvedValue(99); // different user
      await controller.getPermissions(1, 'other-uuid', user);
      expect(mockService.getPermissions).toHaveBeenCalled();
    });
  });

  // Scenario 3: Admin full access — self-edit blocked (Regel 1)
  describe('Self-grant block', () => {
    it('should deny admin full access editing own permissions', async () => {
      const user = createUser({
        id: 10,
        activeRole: 'admin',
        role: 'admin',
        hasFullAccess: true,
      });
      mockService.resolveUserId.mockResolvedValue(10); // same user!
      await expect(
        controller.getPermissions(1, 'self-uuid', user),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should deny employee lead editing own permissions', async () => {
      const user = createUser({ id: 42, activeRole: 'employee' });
      mockService.hasPermission.mockResolvedValue(true);
      mockService.resolveUserId.mockResolvedValue(42); // same user!
      await expect(
        controller.getPermissions(1, 'self-uuid', user),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // Scenario 4: Lead with manage-permissions → access subordinate
  describe('Lead with manage-permissions', () => {
    it('should allow team lead to get permissions of team member', async () => {
      const user = createUser({ id: 42 });
      mockService.hasPermission.mockResolvedValue(true); // has manage-permissions.canRead
      mockService.resolveUserId.mockResolvedValue(99); // different user, in scope
      mockHierarchy.getVisibleUserIds.mockResolvedValue([99, 100]);

      await controller.getPermissions(1, 'member-uuid', user);

      expect(mockService.getPermissions).toHaveBeenCalledWith(
        1,
        'member-uuid',
        42,
      );
    });
  });

  // Scenario 5: Lead WITHOUT manage-permissions → denied
  describe('Lead without manage-permissions', () => {
    it('should deny employee without manage-permissions', async () => {
      const user = createUser({ id: 42 });
      mockService.hasPermission.mockResolvedValue(false); // no manage-permissions
      await expect(
        controller.getPermissions(1, 'member-uuid', user),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // Scenario 6: Lead accessing user outside scope → denied (Regel 3)
  describe('Scope check', () => {
    it('should deny lead accessing user outside scope', async () => {
      const user = createUser({ id: 42 });
      mockService.hasPermission.mockResolvedValue(true);
      mockService.resolveUserId.mockResolvedValue(999); // not in scope
      mockHierarchy.getVisibleUserIds.mockResolvedValue([99, 100]); // 999 NOT included

      await expect(
        controller.getPermissions(1, 'out-of-scope-uuid', user),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // Scenario 7: Delegated upsert passes delegatorScope
  describe('Delegated upsert', () => {
    it('should pass delegatorScope for non-root/non-admin-full', async () => {
      const user = createUser({ id: 42 });
      mockService.hasPermission.mockResolvedValue(true);
      mockService.resolveUserId.mockResolvedValue(99);
      mockHierarchy.getVisibleUserIds.mockResolvedValue([99]);

      await controller.upsertPermissions(
        1,
        'member-uuid',
        { permissions: [] },
        user,
      );

      expect(mockService.upsertPermissions).toHaveBeenCalledWith(
        1,
        'member-uuid',
        [],
        42,
        expect.objectContaining({ type: 'limited' }),
      );
    });

    it('should NOT pass delegatorScope for root', async () => {
      const user = createUser({ id: 1, activeRole: 'root', role: 'root' });
      await controller.upsertPermissions(
        1,
        'target-uuid',
        { permissions: [] },
        user,
      );

      expect(mockService.upsertPermissions).toHaveBeenCalledWith(
        1,
        'target-uuid',
        [],
        1,
        undefined,
      );
    });
  });

  // Scenario 8: getPermissions filters by leader for delegated access
  describe('getPermissions leader filtering', () => {
    it('should pass filterByLeaderId for delegated access', async () => {
      const user = createUser({ id: 42 });
      mockService.hasPermission.mockResolvedValue(true);
      mockService.resolveUserId.mockResolvedValue(99);
      mockHierarchy.getVisibleUserIds.mockResolvedValue([99]);

      await controller.getPermissions(1, 'member-uuid', user);

      expect(mockService.getPermissions).toHaveBeenCalledWith(
        1,
        'member-uuid',
        42,
      );
    });

    it('should NOT filter for root', async () => {
      const user = createUser({ id: 1, activeRole: 'root', role: 'root' });
      await controller.getPermissions(1, 'target-uuid', user);
      expect(mockService.getPermissions).toHaveBeenCalledWith(
        1,
        'target-uuid',
        undefined,
      );
    });

    it('should NOT filter for admin with full access', async () => {
      const user = createUser({
        id: 10,
        activeRole: 'admin',
        hasFullAccess: true,
      });
      mockService.resolveUserId.mockResolvedValue(99);
      await controller.getPermissions(1, 'target-uuid', user);
      expect(mockService.getPermissions).toHaveBeenCalledWith(
        1,
        'target-uuid',
        undefined,
      );
    });
  });
});
