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

// =============================================================
// AdminPermissionsService
// =============================================================

describe('SECURITY: AdminPermissionsService', () => {
  let service: AdminPermissionsService;
  let mockDb: MockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new AdminPermissionsService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // checkAccess — exercises checkPermissionLevel (private)
  // =============================================================

  describe('checkAccess', () => {
    it('should return hasAccess: true when user has read permission', async () => {
      mockDb.query.mockResolvedValueOnce([
        { can_read: true, can_write: false, can_delete: false },
      ]);

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
      mockDb.query.mockResolvedValueOnce([
        { can_read: true, can_write: true, can_delete: false },
      ]);

      const result = await service.checkAccess(1, 10, 5, 'write');

      expect(result.hasAccess).toBe(true);
    });

    it('should check delete permission when requested', async () => {
      mockDb.query.mockResolvedValueOnce([
        { can_read: true, can_write: true, can_delete: true },
      ]);

      const result = await service.checkAccess(1, 10, 5, 'delete');

      expect(result.hasAccess).toBe(true);
    });

    it('should return hasAccess: false when no write but write requested', async () => {
      mockDb.query.mockResolvedValueOnce([
        { can_read: true, can_write: false, can_delete: false },
      ]);

      const result = await service.checkAccess(1, 10, 5, 'write');

      expect(result.hasAccess).toBe(false);
    });

    it('should return permissions object on direct access', async () => {
      mockDb.query.mockResolvedValueOnce([
        { can_read: true, can_write: true, can_delete: false },
      ]);

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
      mockDb.query.mockResolvedValueOnce([
        { can_read: true, can_write: false, can_delete: false },
      ]);

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
      expect(() => service.removeGroupPermission(1, 10, 5, 1)).toThrow(
        NotFoundException,
      );
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
      mockDb.query.mockResolvedValueOnce([
        { role: 'admin', has_full_access: false },
      ]);

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

      // getTotalAreas
      mockDb.query.mockResolvedValueOnce([{ total: '5' }]);

      // getTotalDepartments
      mockDb.query.mockResolvedValueOnce([{ total: '12' }]);

      const result = await service.getAdminPermissions(1, 10);

      expect(result.hasFullAccess).toBe(false);
      expect(result.areas).toHaveLength(1);
      expect(result.departments).toHaveLength(1);
      expect(result.groups).toEqual([]); // Deprecated
      expect(result.totalAreas).toBe(5);
      expect(result.totalDepartments).toBe(12);
      expect(result.assignedAreas).toBe(1);
      expect(result.assignedDepartments).toBe(1);
    });

    it('should convert department_count string to number', async () => {
      mockDb.query.mockResolvedValueOnce([
        { role: 'admin', has_full_access: false },
      ]);
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
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([{ total: '1' }]);
      mockDb.query.mockResolvedValueOnce([{ total: '7' }]);

      const result = await service.getAdminPermissions(1, 10);

      expect(result.areas[0]?.departmentCount).toBe(7);
    });

    it('should omit description when null in area', async () => {
      mockDb.query.mockResolvedValueOnce([
        { role: 'admin', has_full_access: false },
      ]);
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
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([{ total: '1' }]);
      mockDb.query.mockResolvedValueOnce([{ total: '0' }]);

      const result = await service.getAdminPermissions(1, 10);

      expect(result.areas[0]).not.toHaveProperty('description');
    });

    it('should throw NotFoundException when user not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getAdminPermissions(999, 10)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =============================================================
  // setHasFullAccess — employee guard
  // =============================================================

  describe('setHasFullAccess', () => {
    it('should throw BadRequestException when granting full access to employee', async () => {
      // getUserRoleInfo → employee
      mockDb.query.mockResolvedValueOnce([
        { role: 'employee', has_full_access: false },
      ]);

      await expect(service.setHasFullAccess(1, true, 99, 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow granting full access to admin', async () => {
      // getUserRoleInfo → admin
      mockDb.query.mockResolvedValueOnce([
        { role: 'admin', has_full_access: false },
      ]);
      // UPDATE RETURNING
      mockDb.query.mockResolvedValueOnce([{ 1: 1 }]);
      // createAuditLog
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.setHasFullAccess(1, true, 99, 10),
      ).resolves.toBeUndefined();
    });

    it('should allow revoking full access from employee (false is always ok)', async () => {
      // No getUserRoleInfo call when hasFullAccess=false (guard skipped)
      // UPDATE RETURNING
      mockDb.query.mockResolvedValueOnce([{ 1: 1 }]);
      // createAuditLog
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.setHasFullAccess(1, false, 99, 10),
      ).resolves.toBeUndefined();
    });

    it('should throw NotFoundException when user not found during grant', async () => {
      // getUserRoleInfo → empty (user not found)
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.setHasFullAccess(999, true, 99, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should propagate CHECK constraint error (23514) as DB safety net', async () => {
      // getUserRoleInfo → admin (passes service-level check)
      mockDb.query.mockResolvedValueOnce([
        { role: 'admin', has_full_access: false },
      ]);
      // UPDATE triggers CHECK constraint violation (DB safety net)
      const pgError = Object.assign(
        new Error(
          'new row violates check constraint "chk_employee_no_full_access"',
        ),
        { code: '23514' },
      );
      mockDb.query.mockRejectedValueOnce(pgError);

      // Error must propagate — not swallowed
      await expect(service.setHasFullAccess(1, true, 99, 10)).rejects.toThrow(
        'chk_employee_no_full_access',
      );
    });
  });
});
