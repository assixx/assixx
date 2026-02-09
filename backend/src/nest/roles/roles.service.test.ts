/**
 * Unit tests for RolesService
 *
 * Phase 5: First service test — demonstrates mocking pattern for DB-dependent methods.
 *
 * Pure methods (getAllRoles, getRoleById, getRoleHierarchy, getAssignableRoles):
 *   No mocking needed. Service instantiated directly with `new RolesService()`.
 *
 * DB methods (checkUserRole):
 *   `execute` from utils/db.js is mocked via vi.mock().
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Import AFTER mock registration to get the mocked version

import { execute } from '../../utils/db.js';
import { RolesService } from './roles.service.js';

// Mock the database module — hoisted before all imports by Vitest
vi.mock('../../utils/db.js', () => ({
  execute: vi.fn(),
}));

const mockExecute = vi.mocked(execute);

// =============================================================
// RolesService
// =============================================================

describe('SECURITY: RolesService', () => {
  let service: RolesService;

  beforeEach(() => {
    service = new RolesService();
  });

  // =============================================================
  // getAllRoles
  // =============================================================

  describe('getAllRoles', () => {
    it('should return exactly 3 roles', () => {
      const roles = service.getAllRoles();

      expect(roles).toHaveLength(3);
    });

    it('should include root, admin, and employee', () => {
      const roles = service.getAllRoles();
      const ids = roles.map((r) => r.id);

      expect(ids).toContain('root');
      expect(ids).toContain('admin');
      expect(ids).toContain('employee');
    });

    it('should have complete properties on each role', () => {
      const roles = service.getAllRoles();

      for (const role of roles) {
        expect(role).toHaveProperty('id');
        expect(role).toHaveProperty('name');
        expect(role).toHaveProperty('description');
        expect(role).toHaveProperty('level');
        expect(role).toHaveProperty('permissions');
        expect(Array.isArray(role.permissions)).toBe(true);
      }
    });
  });

  // =============================================================
  // getRoleById
  // =============================================================

  describe('getRoleById', () => {
    it.each([
      ['root', 100],
      ['admin', 50],
      ['employee', 10],
    ] as const)('should return %s with level %d', (roleId, expectedLevel) => {
      const role = service.getRoleById(roleId);

      expect(role.id).toBe(roleId);
      expect(role.level).toBe(expectedLevel);
    });

    it('should return root with system.manage permission', () => {
      const role = service.getRoleById('root');

      expect(role.permissions).toContain('system.manage');
    });

    it('should return admin with users.manage permission', () => {
      const role = service.getRoleById('admin');

      expect(role.permissions).toContain('users.manage');
    });

    it('should return employee with profile.view.own permission', () => {
      const role = service.getRoleById('employee');

      expect(role.permissions).toContain('profile.view.own');
    });
  });

  // =============================================================
  // getRoleHierarchy
  // =============================================================

  describe('getRoleHierarchy', () => {
    it('should return hierarchy with 3 entries', () => {
      const { hierarchy } = service.getRoleHierarchy();

      expect(hierarchy).toHaveLength(3);
    });

    it('should have root managing admin and employee', () => {
      const { hierarchy } = service.getRoleHierarchy();
      const rootEntry = hierarchy.find((h) => h.role.id === 'root');

      expect(rootEntry?.canManage).toEqual(['admin', 'employee']);
    });

    it('should have admin managing only employee', () => {
      const { hierarchy } = service.getRoleHierarchy();
      const adminEntry = hierarchy.find((h) => h.role.id === 'admin');

      expect(adminEntry?.canManage).toEqual(['employee']);
    });

    it('should have employee managing nobody', () => {
      const { hierarchy } = service.getRoleHierarchy();
      const employeeEntry = hierarchy.find((h) => h.role.id === 'employee');

      expect(employeeEntry?.canManage).toEqual([]);
    });

    it('should order hierarchy by role level descending', () => {
      const { hierarchy } = service.getRoleHierarchy();
      const levels = hierarchy.map((h) => h.role.level);

      expect(levels).toEqual([100, 50, 10]);
    });
  });

  // =============================================================
  // getAssignableRoles
  // =============================================================

  describe('getAssignableRoles', () => {
    it('should return 3 roles for root', () => {
      const roles = service.getAssignableRoles('root');

      expect(roles).toHaveLength(3);
    });

    it('should allow root to assign admin, employee, and root', () => {
      const roles = service.getAssignableRoles('root');
      const ids = roles.map((r) => r.id);

      expect(ids).toContain('admin');
      expect(ids).toContain('employee');
      expect(ids).toContain('root');
    });

    it('should return only employee for admin', () => {
      const roles = service.getAssignableRoles('admin');

      expect(roles).toHaveLength(1);
      expect(roles[0]?.id).toBe('employee');
    });

    it('should return empty array for employee', () => {
      const roles = service.getAssignableRoles('employee');

      expect(roles).toEqual([]);
    });
  });

  // =============================================================
  // checkUserRole (DB mocking required)
  // =============================================================

  describe('checkUserRole', () => {
    it('should return hasRole: true when user has exact required role', async () => {
      mockExecute.mockResolvedValueOnce([[{ role: 'admin' }]]);

      const result = await service.checkUserRole(1, 10, 'admin');

      expect(result.hasRole).toBe(true);
    });

    it('should return hasRole: false when user has different role', async () => {
      mockExecute.mockResolvedValueOnce([[{ role: 'employee' }]]);

      const result = await service.checkUserRole(1, 10, 'admin');

      expect(result.hasRole).toBe(false);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      await expect(service.checkUserRole(1, 10, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should call execute with correct SQL and parameters', async () => {
      mockExecute.mockResolvedValueOnce([[{ role: 'admin' }]]);

      await service.checkUserRole(42, 7, 'employee');

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT role FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = 1',
        [42, 7],
      );
    });

    it('should return correct userRole and requiredRole in result', async () => {
      mockExecute.mockResolvedValueOnce([[{ role: 'employee' }]]);

      const result = await service.checkUserRole(1, 10, 'root');

      expect(result.userRole).toBe('employee');
      expect(result.requiredRole).toBe('root');
    });

    // Table-driven: all 9 role-level access combinations
    it.each([
      ['root', 'root', true],
      ['root', 'admin', true],
      ['root', 'employee', true],
      ['admin', 'admin', true],
      ['admin', 'employee', true],
      ['admin', 'root', false],
      ['employee', 'employee', true],
      ['employee', 'admin', false],
      ['employee', 'root', false],
    ] as const)(
      'user "%s" vs required "%s" should have hasAccess=%s',
      async (userRole, requiredRole, expectedAccess) => {
        mockExecute.mockResolvedValueOnce([[{ role: userRole }]]);

        const result = await service.checkUserRole(1, 10, requiredRole);

        expect(result.hasAccess).toBe(expectedAccess);
      },
    );
  });
});
