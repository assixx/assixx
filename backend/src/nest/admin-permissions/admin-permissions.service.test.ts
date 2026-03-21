/**
 * Unit tests for AdminPermissionsService
 *
 * Phase 5: Tests permission level checking logic (via checkAccess),
 * deprecated method behavior, and mapper logic.
 *
 * DatabaseService is mocked — no real DB calls.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { AdminPermissionsService } from './admin-permissions.service.js';

// Factory for mock DatabaseService
function createMockDb() {
  return {
    query: vi.fn(),
    queryOne: vi.fn(),
  };
}

type MockDb = ReturnType<typeof createMockDb>;

// Factory for mock ActivityLoggerService
function createMockActivityLogger() {
  return {
    logCreate: vi.fn(),
    logUpdate: vi.fn(),
    logDelete: vi.fn(),
    log: vi.fn(),
  };
}

// =============================================================
// AdminPermissionsService
// =============================================================

describe('SECURITY: AdminPermissionsService', () => {
  let service: AdminPermissionsService;
  let mockDb: MockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    const mockActivityLogger = createMockActivityLogger();
    service = new AdminPermissionsService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // checkAccess — exercises checkPermissionLevel (private)
  // =============================================================

  describe('checkAccess', () => {
    it('should return hasAccess: true when user has read permission', async () => {
      mockDb.query.mockResolvedValueOnce([{ can_read: true, can_write: false, can_delete: false }]);

      const result = await service.checkAccess(1, 10, 5, 'read');

      expect(result.hasAccess).toBe(true);
      expect(result.source).toBe('direct');
    });

    it('should return hasAccess: false when user lacks read permission', async () => {
      mockDb.query.mockResolvedValueOnce([
        { can_read: false, can_write: false, can_delete: false },
      ]);

      const result = await service.checkAccess(1, 10, 5, 'read');

      expect(result.hasAccess).toBe(false);
    });

    it('should check write permission when requested', async () => {
      mockDb.query.mockResolvedValueOnce([{ can_read: true, can_write: true, can_delete: false }]);

      const result = await service.checkAccess(1, 10, 5, 'write');

      expect(result.hasAccess).toBe(true);
    });

    it('should check delete permission when requested', async () => {
      mockDb.query.mockResolvedValueOnce([{ can_read: true, can_write: true, can_delete: true }]);

      const result = await service.checkAccess(1, 10, 5, 'delete');

      expect(result.hasAccess).toBe(true);
    });

    it('should return hasAccess: false when no write but write requested', async () => {
      mockDb.query.mockResolvedValueOnce([{ can_read: true, can_write: false, can_delete: false }]);

      const result = await service.checkAccess(1, 10, 5, 'write');

      expect(result.hasAccess).toBe(false);
    });

    it('should return permissions object on direct access', async () => {
      mockDb.query.mockResolvedValueOnce([{ can_read: true, can_write: true, can_delete: false }]);

      const result = await service.checkAccess(1, 10, 5, 'read');

      expect(result.permissions).toEqual({
        canRead: true,
        canWrite: true,
        canDelete: false,
      });
    });

    it('should return hasAccess: false when no permission row found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.checkAccess(1, 10, 5, 'read');

      expect(result.hasAccess).toBe(false);
      expect(result.source).toBeUndefined();
      expect(result.permissions).toBeUndefined();
    });

    it('should default to read permission level', async () => {
      mockDb.query.mockResolvedValueOnce([{ can_read: true, can_write: false, can_delete: false }]);

      const result = await service.checkAccess(1, 10, 5);

      expect(result.hasAccess).toBe(true);
    });

    it('should pass correct parameters to query', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.checkAccess(42, 7, 99, 'write');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('admin_user_id = $1'),
        [42, 7, 99],
      );
    });
  });

  // =============================================================
  // removeGroupPermission — deprecated, always throws
  // =============================================================

  describe('removeGroupPermission', () => {
    it('should throw NotFoundException', () => {
      expect(() => service.removeGroupPermission(1, 10, 5, 1)).toThrow(NotFoundException);
    });

    it('should mention Area permissions in error message', () => {
      expect(() => service.removeGroupPermission(1, 10, 5, 1)).toThrow(
        'Use Area permissions instead',
      );
    });
  });

  // =============================================================
  // setGroupPermissions — deprecated, no-op
  // =============================================================

  describe('setGroupPermissions', () => {
    it('should not throw even with non-empty groupIds', () => {
      expect(() =>
        service.setGroupPermissions(
          1,
          [10, 20],
          { canRead: true, canWrite: false, canDelete: false },
          5,
          1,
        ),
      ).not.toThrow();
    });

    it('should not make any DB calls', () => {
      service.setGroupPermissions(
        1,
        [10],
        { canRead: true, canWrite: false, canDelete: false },
        5,
        1,
      );

      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  // =============================================================
  // getAdminPermissions — mapper + aggregation
  // =============================================================

  describe('getAdminPermissions', () => {
    it('should return complete permissions response', async () => {
      // getUserRoleInfo
      mockDb.query.mockResolvedValueOnce([{ role: 'admin', has_full_access: false }]);

      // getAreaPermissions
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Production',
          description: 'Production area',
          department_count: '3',
          can_read: true,
          can_write: true,
          can_delete: false,
        },
      ]);

      // getDepartmentPermissions
      mockDb.query.mockResolvedValueOnce([
        {
          id: 10,
          name: 'Assembly',
          description: null,
          can_read: true,
          can_write: false,
          can_delete: false,
        },
      ]);

      // getLeadAreas
      mockDb.query.mockResolvedValueOnce([]);

      // getLeadDepartments
      mockDb.query.mockResolvedValueOnce([]);

      // getTotalAreas
      mockDb.query.mockResolvedValueOnce([{ total: '5' }]);

      // getTotalDepartments
      mockDb.query.mockResolvedValueOnce([{ total: '12' }]);

      const result = await service.getAdminPermissions(1, 10);

      expect(result.hasFullAccess).toBe(false);
      expect(result.areas).toHaveLength(1);
      expect(result.departments).toHaveLength(1);
      expect(result.groups).toEqual([]); // Deprecated
      expect(result.leadAreas).toEqual([]);
      expect(result.leadDepartments).toEqual([]);
      expect(result.totalAreas).toBe(5);
      expect(result.totalDepartments).toBe(12);
      expect(result.assignedAreas).toBe(1);
      expect(result.assignedDepartments).toBe(1);
    });

    it('should convert department_count string to number', async () => {
      mockDb.query.mockResolvedValueOnce([{ role: 'admin', has_full_access: false }]);
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Area',
          description: null,
          department_count: '7',
          can_read: true,
          can_write: false,
          can_delete: false,
        },
      ]);
      mockDb.query.mockResolvedValueOnce([]); // getDepartmentPermissions
      mockDb.query.mockResolvedValueOnce([]); // getLeadAreas
      mockDb.query.mockResolvedValueOnce([]); // getLeadDepartments
      mockDb.query.mockResolvedValueOnce([{ total: '1' }]);
      mockDb.query.mockResolvedValueOnce([{ total: '7' }]);

      const result = await service.getAdminPermissions(1, 10);

      expect(result.areas[0]?.departmentCount).toBe(7);
    });

    it('should omit description when null in area', async () => {
      mockDb.query.mockResolvedValueOnce([{ role: 'admin', has_full_access: false }]);
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Area',
          description: null,
          department_count: '0',
          can_read: true,
          can_write: false,
          can_delete: false,
        },
      ]);
      mockDb.query.mockResolvedValueOnce([]); // getDepartmentPermissions
      mockDb.query.mockResolvedValueOnce([]); // getLeadAreas
      mockDb.query.mockResolvedValueOnce([]); // getLeadDepartments
      mockDb.query.mockResolvedValueOnce([{ total: '1' }]);
      mockDb.query.mockResolvedValueOnce([{ total: '0' }]);

      const result = await service.getAdminPermissions(1, 10);

      expect(result.areas[0]).not.toHaveProperty('description');
    });

    it('should throw NotFoundException when user not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getAdminPermissions(999, 10)).rejects.toThrow(NotFoundException);
    });
  });

  // =============================================================
  // setHasFullAccess — employee guard
  // =============================================================

  describe('setHasFullAccess', () => {
    it('should throw BadRequestException when granting full access to employee', async () => {
      // getUserRoleInfo → employee
      mockDb.query.mockResolvedValueOnce([{ role: 'employee', has_full_access: false }]);

      await expect(service.setHasFullAccess(1, true, 99, 10)).rejects.toThrow(BadRequestException);
    });

    it('should allow granting full access to admin', async () => {
      // getUserRoleInfo → admin
      mockDb.query.mockResolvedValueOnce([{ role: 'admin', has_full_access: false }]);
      // UPDATE RETURNING
      mockDb.query.mockResolvedValueOnce([{ 1: 1 }]);
      // createAuditLog
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.setHasFullAccess(1, true, 99, 10)).resolves.toBeUndefined();
    });

    it('should allow revoking full access from employee (false is always ok)', async () => {
      // No getUserRoleInfo call when hasFullAccess=false (guard skipped)
      // UPDATE RETURNING
      mockDb.query.mockResolvedValueOnce([{ 1: 1 }]);
      // createAuditLog
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.setHasFullAccess(1, false, 99, 10)).resolves.toBeUndefined();
    });

    it('should throw NotFoundException when user not found during grant', async () => {
      // getUserRoleInfo → empty (user not found)
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.setHasFullAccess(999, true, 99, 10)).rejects.toThrow(NotFoundException);
    });

    it('should propagate CHECK constraint error (23514) as DB safety net', async () => {
      // getUserRoleInfo → admin (passes service-level check)
      mockDb.query.mockResolvedValueOnce([{ role: 'admin', has_full_access: false }]);
      // UPDATE triggers CHECK constraint violation (DB safety net)
      const pgError = Object.assign(
        new Error('new row violates check constraint "chk_employee_no_full_access"'),
        { code: '23514' },
      );
      mockDb.query.mockRejectedValueOnce(pgError);

      // Error must propagate — not swallowed
      await expect(service.setHasFullAccess(1, true, 99, 10)).rejects.toThrow(
        'chk_employee_no_full_access',
      );
    });

    it('should throw NotFoundException when revoking from non-existent user', async () => {
      // hasFullAccess=false → skips getUserRoleInfo
      // UPDATE RETURNING → empty
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.setHasFullAccess(999, false, 99, 10)).rejects.toThrow(NotFoundException);
    });
  });

  // =============================================================
  // setDepartmentPermissions
  // =============================================================

  describe('setDepartmentPermissions', () => {
    const perms = { canRead: true, canWrite: true, canDelete: false };

    it('should delete existing and insert new permissions', async () => {
      // DELETE existing
      mockDb.query.mockResolvedValueOnce([]);
      // INSERT new
      mockDb.query.mockResolvedValueOnce([]);
      // createAuditLog
      mockDb.query.mockResolvedValueOnce([]);

      await service.setDepartmentPermissions(1, [10, 20], perms, 99, 5);

      expect(mockDb.query).toHaveBeenCalledTimes(3);
      expect(mockDb.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('DELETE FROM admin_department_permissions'),
        [1, 5],
      );
      expect(mockDb.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO admin_department_permissions'),
        expect.any(Array),
      );
    });

    it('should skip INSERT when departmentIds is empty', async () => {
      // DELETE existing
      mockDb.query.mockResolvedValueOnce([]);
      // createAuditLog
      mockDb.query.mockResolvedValueOnce([]);

      await service.setDepartmentPermissions(1, [], perms, 99, 5);

      // Only DELETE + audit (no INSERT)
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  // =============================================================
  // removeDepartmentPermission
  // =============================================================

  describe('removeDepartmentPermission', () => {
    it('should delete and log audit on success', async () => {
      // DELETE RETURNING
      mockDb.query.mockResolvedValueOnce([{ 1: 1 }]);
      // createAuditLog
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.removeDepartmentPermission(1, 10, 99, 5)).resolves.toBeUndefined();
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException when permission not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.removeDepartmentPermission(1, 999, 99, 5)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =============================================================
  // bulkUpdatePermissions
  // =============================================================

  describe('bulkUpdatePermissions', () => {
    const perms = { canRead: true, canWrite: false, canDelete: false };

    it('should assign permissions to multiple admins', async () => {
      // For admin 1: DELETE + INSERT + audit = 3 queries
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);
      // For admin 2: DELETE + INSERT + audit = 3 queries
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.bulkUpdatePermissions([1, 2], 'assign', [10], perms, 99, 5);

      expect(result.successCount).toBe(2);
      expect(result.totalCount).toBe(2);
      expect(result.errors).toBeUndefined();
    });

    it('should remove permissions (empty deptIds)', async () => {
      // For admin 1: DELETE existing + audit = 2 queries
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.bulkUpdatePermissions([1], 'remove', undefined, perms, 99, 5);

      expect(result.successCount).toBe(1);
    });

    it('should collect errors without failing', async () => {
      // Admin 1: DELETE fails
      mockDb.query.mockRejectedValueOnce(new Error('DB error'));
      // Admin 2: DELETE + audit
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.bulkUpdatePermissions([1, 2], 'remove', undefined, perms, 99, 5);

      expect(result.successCount).toBe(1);
      expect(result.totalCount).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]).toContain('Admin 1');
    });

    it('should return success:false for assign without departmentIds', async () => {
      const result = await service.bulkUpdatePermissions([1], 'assign', undefined, perms, 99, 5);

      expect(result.successCount).toBe(0);
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  // =============================================================
  // setAreaPermissions
  // =============================================================

  describe('setAreaPermissions', () => {
    const perms = { canRead: true, canWrite: true, canDelete: false };

    it('should delete existing, insert new, cleanup memberships, and audit', async () => {
      // DELETE existing area perms
      mockDb.query.mockResolvedValueOnce([]);
      // INSERT new area perms
      mockDb.query.mockResolvedValueOnce([]);
      // cleanupEmployeeMemberships: DELETE teams CTE
      mockDb.query.mockResolvedValueOnce([{ count: '2' }]);
      // cleanupEmployeeMemberships: DELETE depts CTE
      mockDb.query.mockResolvedValueOnce([{ count: '1' }]);
      // createAuditLog
      mockDb.query.mockResolvedValueOnce([]);

      await service.setAreaPermissions(1, [10, 20], perms, 99, 5);

      expect(mockDb.query).toHaveBeenCalledTimes(5);
      expect(mockDb.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('DELETE FROM admin_area_permissions'),
        [1, 5],
      );
      expect(mockDb.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO admin_area_permissions'),
        expect.any(Array),
      );
    });

    it('should remove all memberships when areaIds is empty', async () => {
      // DELETE existing area perms
      mockDb.query.mockResolvedValueOnce([]);
      // cleanupEmployeeMemberships (empty areas):
      //   DELETE user_teams
      mockDb.query.mockResolvedValueOnce([]);
      //   DELETE user_departments
      mockDb.query.mockResolvedValueOnce([]);
      // createAuditLog
      mockDb.query.mockResolvedValueOnce([]);

      await service.setAreaPermissions(1, [], perms, 99, 5);

      // No INSERT (empty), but cleanup + audit
      expect(mockDb.query).toHaveBeenCalledTimes(4);
      expect(mockDb.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('DELETE FROM user_teams'),
        [1, 5],
      );
      expect(mockDb.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('DELETE FROM user_departments'),
        [1, 5],
      );
    });
  });

  // =============================================================
  // removeAreaPermission
  // =============================================================

  describe('removeAreaPermission', () => {
    it('should delete and log audit on success', async () => {
      // DELETE RETURNING
      mockDb.query.mockResolvedValueOnce([{ 1: 1 }]);
      // createAuditLog
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.removeAreaPermission(1, 10, 99, 5)).resolves.toBeUndefined();
    });

    it('should throw NotFoundException when area permission not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.removeAreaPermission(1, 999, 99, 5)).rejects.toThrow(NotFoundException);
    });
  });

  // =============================================================
  // setGroupPermissions — empty groupIds branch
  // =============================================================

  describe('setGroupPermissions — empty groupIds', () => {
    it('should be a no-op for empty groupIds without warning', () => {
      service.setGroupPermissions(
        1,
        [],
        { canRead: true, canWrite: false, canDelete: false },
        5,
        1,
      );

      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  // =============================================================
  // getAdminPermissions — lead areas & lead departments
  // =============================================================

  describe('getAdminPermissions — lead areas returned', () => {
    it('should map lead areas with read-only permissions', async () => {
      mockDb.query.mockResolvedValueOnce([{ role: 'admin', has_full_access: false }]);
      mockDb.query.mockResolvedValueOnce([]); // getAreaPermissions
      mockDb.query.mockResolvedValueOnce([]); // getDepartmentPermissions
      // getLeadAreas — user is area_lead
      mockDb.query.mockResolvedValueOnce([
        {
          id: 5,
          name: 'Lead Area',
          description: 'Area led by this user',
          department_count: '2',
        },
      ]);
      mockDb.query.mockResolvedValueOnce([]); // getLeadDepartments
      mockDb.query.mockResolvedValueOnce([{ total: '3' }]);
      mockDb.query.mockResolvedValueOnce([{ total: '0' }]);

      const result = await service.getAdminPermissions(1, 10);

      expect(result.leadAreas).toHaveLength(1);
      expect(result.leadAreas[0]).toEqual({
        id: 5,
        name: 'Lead Area',
        description: 'Area led by this user',
        departmentCount: 2,
        canRead: true,
        canWrite: false,
        canDelete: false,
      });
    });

    it('should omit description from lead area when null', async () => {
      mockDb.query.mockResolvedValueOnce([{ role: 'admin', has_full_access: false }]);
      mockDb.query.mockResolvedValueOnce([]); // getAreaPermissions
      mockDb.query.mockResolvedValueOnce([]); // getDepartmentPermissions
      mockDb.query.mockResolvedValueOnce([
        {
          id: 7,
          name: 'No Desc Area',
          description: null,
          department_count: '0',
        },
      ]);
      mockDb.query.mockResolvedValueOnce([]); // getLeadDepartments
      mockDb.query.mockResolvedValueOnce([{ total: '1' }]);
      mockDb.query.mockResolvedValueOnce([{ total: '0' }]);

      const result = await service.getAdminPermissions(1, 10);

      expect(result.leadAreas[0]).not.toHaveProperty('description');
      expect(result.leadAreas[0]?.canRead).toBe(true);
    });
  });

  describe('getAdminPermissions — lead departments returned', () => {
    it('should map lead departments with read-only permissions via mapDepartmentRow', async () => {
      mockDb.query.mockResolvedValueOnce([{ role: 'admin', has_full_access: false }]);
      mockDb.query.mockResolvedValueOnce([]); // getAreaPermissions
      mockDb.query.mockResolvedValueOnce([]); // getDepartmentPermissions
      mockDb.query.mockResolvedValueOnce([]); // getLeadAreas
      // getLeadDepartments — user is department_lead
      mockDb.query.mockResolvedValueOnce([
        {
          id: 20,
          name: 'Lead Dept',
          description: 'Dept led by this user',
          area_id: 3,
          area_name: 'Parent Area',
        },
      ]);
      mockDb.query.mockResolvedValueOnce([{ total: '0' }]);
      mockDb.query.mockResolvedValueOnce([{ total: '5' }]);

      const result = await service.getAdminPermissions(1, 10);

      expect(result.leadDepartments).toHaveLength(1);
      expect(result.leadDepartments[0]).toEqual({
        id: 20,
        name: 'Lead Dept',
        description: 'Dept led by this user',
        areaId: 3,
        areaName: 'Parent Area',
        canRead: true,
        canWrite: false,
        canDelete: false,
      });
    });
  });

  // =============================================================
  // getAdminPermissions — description included
  // =============================================================

  describe('getAdminPermissions — department with description', () => {
    it('should include description when not null', async () => {
      mockDb.query.mockResolvedValueOnce([{ role: 'admin', has_full_access: true }]);
      mockDb.query.mockResolvedValueOnce([]); // areas
      mockDb.query.mockResolvedValueOnce([
        {
          id: 10,
          name: 'Assembly',
          description: 'Main assembly line',
          can_read: true,
          can_write: false,
          can_delete: false,
        },
      ]);
      mockDb.query.mockResolvedValueOnce([]); // getLeadAreas
      mockDb.query.mockResolvedValueOnce([]); // getLeadDepartments
      mockDb.query.mockResolvedValueOnce([{ total: '0' }]);
      mockDb.query.mockResolvedValueOnce([{ total: '1' }]);

      const result = await service.getAdminPermissions(1, 10);

      expect(result.departments[0]?.description).toBe('Main assembly line');
      expect(result.hasFullAccess).toBe(true);
    });

    it('should omit areaId and areaName when null', async () => {
      mockDb.query.mockResolvedValueOnce([{ role: 'admin', has_full_access: false }]);
      mockDb.query.mockResolvedValueOnce([]); // areas
      mockDb.query.mockResolvedValueOnce([
        {
          id: 10,
          name: 'Standalone',
          description: null,
          area_id: null,
          area_name: null,
          can_read: true,
          can_write: false,
          can_delete: false,
        },
      ]);
      mockDb.query.mockResolvedValueOnce([]); // getLeadAreas
      mockDb.query.mockResolvedValueOnce([]); // getLeadDepartments
      mockDb.query.mockResolvedValueOnce([{ total: '0' }]);
      mockDb.query.mockResolvedValueOnce([{ total: '1' }]);

      const result = await service.getAdminPermissions(1, 10);

      expect(result.departments[0]?.areaId).toBeUndefined();
      expect(result.departments[0]?.areaName).toBeUndefined();
      expect(result.departments[0]?.description).toBeUndefined();
    });
  });

  // =============================================================
  // createAuditLog — error handling
  // =============================================================

  describe('createAuditLog — error handling', () => {
    it('should not fail the main operation when audit log insert fails', async () => {
      const perms = { canRead: true, canWrite: false, canDelete: false };
      // DELETE existing
      mockDb.query.mockResolvedValueOnce([]);
      // createAuditLog → fails
      mockDb.query.mockRejectedValueOnce(new Error('Audit DB down'));

      // setDepartmentPermissions with empty depts (skips INSERT) → just DELETE + audit
      await expect(service.setDepartmentPermissions(1, [], perms, 99, 5)).resolves.toBeUndefined();
    });
  });
});
