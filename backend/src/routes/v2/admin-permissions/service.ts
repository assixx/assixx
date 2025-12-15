/**
 * Admin Permissions Service v2
 * Business logic for managing admin permissions
 */
import { ServiceError } from '../../../utils/ServiceError.js';
import {
  ResultSetHeader,
  RowDataPacket,
  execute,
  generateBulkPlaceholders,
} from '../../../utils/db.js';
import { getErrorMessage } from '../../../utils/errorHandler.js';
import { logger } from '../../../utils/logger.js';
import { createRootLog } from '../logs/logs.service.js';
import {
  AdminArea,
  AdminDepartment,
  AdminGroup,
  AdminPermissionsResponse,
  BulkOperationResult,
  PermissionCheckResult,
  PermissionLevel,
  PermissionSet,
} from './types.js';

interface DepartmentPermissionRow extends RowDataPacket {
  id: number;
  name: string;
  description?: string;
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
}

// NOTE: GroupPermissionRow removed - department_groups system was removed (2025-11-27)

interface PermissionResult extends RowDataPacket {
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
}

interface AreaPermissionRow extends RowDataPacket {
  id: number;
  name: string;
  description?: string;
  department_count: number;
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
}

interface RoleResult extends RowDataPacket {
  role: string;
  has_full_access: boolean;
}

/**
 * Build permission set from a single permission result
 */
function toPermissionSet(perm: PermissionResult): PermissionSet {
  return {
    canRead: perm.can_read,
    canWrite: perm.can_write,
    canDelete: perm.can_delete,
  };
}

// NOTE: buildPermissionSet removed - was only used by group permissions (2025-11-27)

/**
 *
 */
class AdminPermissionsService {
  /**
   * Check if admin has access to a specific department
   * @param adminId - The adminId parameter
   * @param departmentId - The departmentId parameter
   * @param tenantId - The tenant ID
   * @param requiredPermission - The requiredPermission parameter
   */
  async checkAccess(
    adminId: number,
    departmentId: number,
    tenantId: number,
    requiredPermission: PermissionLevel = 'read',
  ): Promise<PermissionCheckResult> {
    try {
      // Check direct department permissions
      // POSTGRESQL FIX: Parameters must be $1, $2, $3 in order they appear in array
      const directQuery = `
        SELECT can_read, can_write, can_delete
        FROM admin_department_permissions
        WHERE admin_user_id = $1 AND department_id = $2 AND tenant_id = $3
      `;
      const [directPermissions] = await execute<PermissionResult[]>(directQuery, [
        adminId,
        departmentId,
        tenantId,
      ]);

      const perm = directPermissions[0];
      if (perm !== undefined) {
        const hasAccess = this.checkPermissionLevel(perm, requiredPermission);
        return { hasAccess, source: 'direct', permissions: toPermissionSet(perm) };
      }

      // NOTE: Group permissions removed (2025-11-27)
      // admin_group_permissions, department_groups, department_group_members tables were dropped
      // Use Area permissions (admin_area_permissions) for logical groupings instead

      return { hasAccess: false };
    } catch (error: unknown) {
      logger.error('Error checking admin access:', error);
      throw new ServiceError('SERVER_ERROR', 'Failed to check permissions');
    }
  }

  /**
   * Get user role and has_full_access status
   * @param userId - The user ID
   * @param tenantId - The tenant ID
   */
  private async getUserRoleInfo(
    userId: number,
    tenantId: number,
  ): Promise<{ isRoot: boolean; hasFullAccess: boolean }> {
    const [userRows] = await execute<RoleResult[]>(
      'SELECT role, has_full_access FROM users WHERE id = $1 AND tenant_id = $2',
      [userId, tenantId],
    );

    if (userRows.length === 0) {
      logger.error(`[getUserRoleInfo] User not found - userId: ${userId}, tenantId: ${tenantId}`);
      throw new ServiceError('NOT_FOUND', 'User not found');
    }

    const userRow = userRows[0];
    if (userRow === undefined) {
      throw new ServiceError('NOT_FOUND', 'User not found');
    }

    return {
      isRoot: userRow.role === 'root',
      hasFullAccess: userRow.has_full_access,
    };
  }

  /**
   * Get Area permissions for a user
   */
  private async getAreaPermissions(userId: number, tenantId: number): Promise<AdminArea[]> {
    const query = `
      SELECT
        a.id,
        a.name,
        a.description,
        COUNT(DISTINCT d.id) as department_count,
        aap.can_read,
        aap.can_write,
        aap.can_delete
      FROM admin_area_permissions aap
      JOIN areas a ON aap.area_id = a.id
      LEFT JOIN departments d ON d.area_id = a.id AND d.tenant_id = a.tenant_id
      WHERE aap.admin_user_id = $1
      AND aap.tenant_id = $2
      GROUP BY a.id, a.name, a.description, aap.can_read, aap.can_write, aap.can_delete
      ORDER BY a.name
    `;
    const [rows] = await execute<AreaPermissionRow[]>(query, [userId, tenantId]);

    return rows.map((row: AreaPermissionRow) => {
      const result: AdminArea = {
        id: row.id,
        name: row.name,
        departmentCount: row.department_count,
        canRead: row.can_read,
        canWrite: row.can_write,
        canDelete: row.can_delete,
      };
      if (row.description !== undefined) {
        result.description = row.description;
      }
      return result;
    });
  }

  /**
   * Get total areas count
   */
  private async getTotalAreas(tenantId: number): Promise<number> {
    const [countResult] = await execute<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM areas WHERE tenant_id = $1',
      [tenantId],
    );
    return (countResult[0] as { total: number }).total;
  }

  private async getDepartmentPermissions(
    adminId: number,
    tenantId: number,
  ): Promise<AdminDepartment[]> {
    // POSTGRESQL FIX: Parameters must be $1, $2 in order they appear in array
    const query = `
      SELECT
        d.id,
        d.name,
        d.description,
        adp.can_read,
        adp.can_write,
        adp.can_delete
      FROM admin_department_permissions adp
      JOIN departments d ON adp.department_id = d.id
      WHERE adp.admin_user_id = $1
      AND adp.tenant_id = $2
      AND d.is_active = 1
      ORDER BY d.name
    `;
    const [rows] = await execute<DepartmentPermissionRow[]>(query, [adminId, tenantId]);

    return rows.map((row: DepartmentPermissionRow) => {
      const result: AdminDepartment = {
        id: row.id,
        name: row.name,
        canRead: row.can_read,
        canWrite: row.can_write,
        canDelete: row.can_delete,
      };
      if (row.description !== undefined) {
        result.description = row.description;
      }
      return result;
    });
  }

  /**
   * Get Group permissions - DEPRECATED
   * Department groups were removed in the permission system refactoring (2025-11-27).
   * Areas now serve as logical groupings. This method returns empty for backwards compatibility.
   */
  private getGroupPermissions(_adminId: number, _tenantId: number): Promise<AdminGroup[]> {
    // DEPRECATED: admin_group_permissions, department_groups, department_group_members tables were dropped
    // Areas now serve as the logical grouping mechanism
    return Promise.resolve([]);
  }

  private async getTotalDepartments(tenantId: number): Promise<number> {
    const [countResult] = await execute<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM departments WHERE tenant_id = $1 AND is_active = 1',
      [tenantId],
    );
    return (countResult[0] as { total: number }).total;
  }

  async getAdminPermissions(userId: number, tenantId: number): Promise<AdminPermissionsResponse> {
    try {
      logger.info(`[getAdminPermissions] Starting for userId: ${userId}, tenantId: ${tenantId}`);

      const { hasFullAccess } = await this.getUserRoleInfo(userId, tenantId);
      const areas = await this.getAreaPermissions(userId, tenantId);
      const departments = await this.getDepartmentPermissions(userId, tenantId);
      const groups = await this.getGroupPermissions(userId, tenantId);
      const totalAreas = await this.getTotalAreas(tenantId);
      const totalDepartments = await this.getTotalDepartments(tenantId);

      // hasFullAccess from DB (has_full_access) is the single source of truth
      // Root users always have has_full_access = true in DB
      return {
        areas,
        departments,
        groups,
        hasFullAccess,
        totalAreas,
        totalDepartments,
        assignedAreas: areas.length,
        assignedDepartments: departments.length,
      };
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error('[getAdminPermissions] Unexpected error:', error);
      logger.error(
        '[getAdminPermissions] Error stack:',
        error instanceof Error ? error.stack : 'No stack',
      );
      throw new ServiceError('SERVER_ERROR', 'Failed to get permissions');
    }
  }

  /**
   * Set department permissions for an admin
   * @param adminId - The adminId parameter
   * @param departmentIds - The departmentIds parameter
   * @param permissions - The permissions parameter
   * @param modifiedBy - The modifiedBy parameter
   * @param tenantId - The tenant ID
   */
  async setDepartmentPermissions(
    adminId: number,
    departmentIds: number[],
    permissions: PermissionSet,
    modifiedBy: number,
    tenantId: number,
  ): Promise<void> {
    logger.info('setDepartmentPermissions:', { adminId, departmentIds, permissions, tenantId });

    try {
      // Remove existing and add new permissions
      await execute(
        'DELETE FROM admin_department_permissions WHERE admin_user_id = $1 AND tenant_id = $2',
        [adminId, tenantId],
      );

      if (departmentIds.length > 0) {
        await this.insertDepartmentPermissions(
          adminId,
          departmentIds,
          permissions,
          modifiedBy,
          tenantId,
        );
      }

      // Audit log
      await createRootLog({
        action: 'update_admin_permissions',
        user_id: modifiedBy,
        tenant_id: tenantId,
        details: `Updated permissions for admin ${adminId}: ${departmentIds.length} depts`,
      });
    } catch (error: unknown) {
      logger.error('Error setting department permissions:', { adminId, tenantId, error });
      throw new ServiceError('SERVER_ERROR', 'Failed to set permissions');
    }
  }

  /**
   * Set Area permissions for a user
   */
  async setAreaPermissions(
    userId: number,
    areaIds: number[],
    permissions: PermissionSet,
    modifiedBy: number,
    tenantId: number,
  ): Promise<void> {
    logger.info('setAreaPermissions:', { userId, areaIds, permissions, tenantId });

    try {
      // Remove existing area permissions
      await execute(
        'DELETE FROM admin_area_permissions WHERE admin_user_id = $1 AND tenant_id = $2',
        [userId, tenantId],
      );

      // Add new permissions
      if (areaIds.length > 0) {
        const values = areaIds.flatMap((areaId: number) => [
          tenantId,
          userId,
          areaId,
          permissions.canRead,
          permissions.canWrite,
          permissions.canDelete,
          modifiedBy,
        ]);
        const { placeholders } = generateBulkPlaceholders(areaIds.length, 7);

        await execute(
          `INSERT INTO admin_area_permissions
           (tenant_id, admin_user_id, area_id, can_read, can_write, can_delete, assigned_by)
           VALUES ${placeholders}`,
          values,
        );
      }

      // Audit log
      await createRootLog({
        action: 'update_admin_area_permissions',
        user_id: modifiedBy,
        tenant_id: tenantId,
        details: `Updated area permissions for user ${userId}: ${areaIds.length} areas`,
      });
    } catch (error: unknown) {
      logger.error('Error setting area permissions:', { userId, tenantId, error });
      throw new ServiceError('SERVER_ERROR', 'Failed to set area permissions');
    }
  }

  /**
   * Remove specific Area permission
   */
  async removeAreaPermission(
    userId: number,
    areaId: number,
    modifiedBy: number,
    tenantId: number,
  ): Promise<void> {
    try {
      // POSTGRESQL FIX: Parameters must be $1, $2, $3 in order they appear in array
      const [result] = await execute<ResultSetHeader>(
        `DELETE FROM admin_area_permissions
         WHERE admin_user_id = $1 AND area_id = $2 AND tenant_id = $3`,
        [userId, areaId, tenantId],
      );

      if (result.affectedRows === 0) {
        throw new ServiceError('NOT_FOUND', 'Area permission not found');
      }

      await createRootLog({
        action: 'revoke_admin_area_permission',
        user_id: modifiedBy,
        tenant_id: tenantId,
        details: `Revoked area permission for user ${userId} on area ${areaId}`,
      });
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error('Error removing area permission:', error);
      throw new ServiceError('SERVER_ERROR', 'Failed to remove area permission');
    }
  }

  /**
   * Set has_full_access flag for a user
   */
  async setHasFullAccess(
    userId: number,
    hasFullAccess: boolean,
    modifiedBy: number,
    tenantId: number,
  ): Promise<void> {
    try {
      // POSTGRESQL FIX: Parameters must be $1, $2, $3 in order they appear in array
      const [result] = await execute<ResultSetHeader>(
        'UPDATE users SET has_full_access = $1 WHERE id = $2 AND tenant_id = $3',
        [hasFullAccess, userId, tenantId],
      );

      if (result.affectedRows === 0) {
        throw new ServiceError('NOT_FOUND', 'User not found');
      }

      await createRootLog({
        action: hasFullAccess ? 'grant_full_access' : 'revoke_full_access',
        user_id: modifiedBy,
        tenant_id: tenantId,
        details: `${hasFullAccess ? 'Granted' : 'Revoked'} full access for user ${userId}`,
      });
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error('Error setting has_full_access:', error);
      throw new ServiceError('SERVER_ERROR', 'Failed to update full access flag');
    }
  }

  /**
   * Insert department permissions into database
   */
  private async insertDepartmentPermissions(
    adminId: number,
    departmentIds: number[],
    permissions: PermissionSet,
    modifiedBy: number,
    tenantId: number,
  ): Promise<void> {
    const values = departmentIds.flatMap((deptId: number) => [
      adminId,
      deptId,
      tenantId,
      permissions.canRead,
      permissions.canWrite,
      permissions.canDelete,
      modifiedBy,
    ]);
    const { placeholders } = generateBulkPlaceholders(departmentIds.length, 7);

    await execute(
      `INSERT INTO admin_department_permissions
       (admin_user_id, department_id, tenant_id, can_read, can_write, can_delete, assigned_by)
       VALUES ${placeholders}`,
      values,
    );
  }

  /**
   * Set group permissions for an admin - DEPRECATED
   * Department groups were removed in the permission system refactoring (2025-11-27).
   * Use Area permissions (setAreaPermissions) for logical groupings instead.
   * This method is a no-op for backwards compatibility.
   */
  setGroupPermissions(
    _adminId: number,
    groupIds: number[],
    _permissions: PermissionSet,
    _modifiedBy: number,
    _tenantId: number,
  ): Promise<void> {
    // DEPRECATED: admin_group_permissions table was dropped (2025-11-27)
    // Use setAreaPermissions instead
    if (groupIds.length > 0) {
      logger.warn(
        '[DEPRECATED] setGroupPermissions called but department_groups system was removed. Use setAreaPermissions instead.',
      );
    }
    // No-op for backwards compatibility
    return Promise.resolve();
  }

  /**
   * Remove specific department permission
   * @param adminId - The adminId parameter
   * @param departmentId - The departmentId parameter
   * @param modifiedBy - The modifiedBy parameter
   * @param tenantId - The tenant ID
   */
  async removeDepartmentPermission(
    adminId: number,
    departmentId: number,
    modifiedBy: number,
    tenantId: number,
  ): Promise<void> {
    try {
      // POSTGRESQL FIX: Parameters must be $1, $2, $3 in order they appear in array
      const [result] = await execute<ResultSetHeader>(
        `DELETE FROM admin_department_permissions
        WHERE admin_user_id = $1 AND department_id = $2 AND tenant_id = $3`,
        [adminId, departmentId, tenantId],
      );

      if (result.affectedRows === 0) {
        throw new ServiceError('NOT_FOUND', 'Permission not found');
      }

      // Log the action
      await createRootLog({
        action: 'revoke_admin_permission',
        user_id: modifiedBy,
        tenant_id: tenantId,
        details: `Revoked department permission for admin ${adminId} on department ${departmentId}`,
      });
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error('Error removing department permission:', error);
      throw new ServiceError('SERVER_ERROR', 'Failed to remove permission');
    }
  }

  /**
   * Remove specific group permission - DEPRECATED
   * Department groups were removed in the permission system refactoring (2025-11-27).
   * Use Area permissions (removeAreaPermission) for logical groupings instead.
   * Always returns NOT_FOUND since groups no longer exist.
   */
  removeGroupPermission(
    _adminId: number,
    _groupId: number,
    _modifiedBy: number,
    _tenantId: number,
  ): Promise<void> {
    // DEPRECATED: admin_group_permissions table was dropped (2025-11-27)
    // Use removeAreaPermission instead
    logger.warn(
      '[DEPRECATED] removeGroupPermission called but department_groups system was removed. Use removeAreaPermission instead.',
    );
    return Promise.reject(
      new ServiceError(
        'NOT_FOUND',
        'Group permissions system has been removed. Use Area permissions instead.',
      ),
    );
  }

  /**
   * Bulk update permissions
   * @param adminIds - The adminIds parameter
   * @param operation - The operation parameter
   * @param departmentIds - The departmentIds parameter
   * @param permissions - The permissions parameter
   * @param modifiedBy - The modifiedBy parameter
   * @param tenantId - The tenant ID
   */
  async bulkUpdatePermissions(
    adminIds: number[],
    operation: 'assign' | 'remove',
    departmentIds: number[] | undefined,
    permissions: PermissionSet,
    modifiedBy: number,
    tenantId: number,
  ): Promise<BulkOperationResult> {
    let successCount = 0;
    const errors: string[] = [];

    for (const adminId of adminIds) {
      try {
        if (operation === 'assign' && departmentIds) {
          await this.setDepartmentPermissions(
            adminId,
            departmentIds,
            permissions,
            modifiedBy,
            tenantId,
          );
          successCount++;
        } else if (operation === 'remove') {
          await this.setDepartmentPermissions(adminId, [], permissions, modifiedBy, tenantId);
          successCount++;
        }
      } catch (error: unknown) {
        errors.push(`Admin ${adminId}: ${getErrorMessage(error)}`);
      }
    }

    const result: BulkOperationResult = {
      successCount,
      totalCount: adminIds.length,
    };
    if (errors.length > 0) {
      result.errors = errors;
    }
    return result;
  }

  /**
   * Check permission level
   * @param permission - The permission parameter
   * @param requiredLevel - The requiredLevel parameter
   */
  private checkPermissionLevel(
    permission: PermissionResult,
    requiredLevel: PermissionLevel,
  ): boolean {
    switch (requiredLevel) {
      case 'read':
        return permission.can_read;
      case 'write':
        return permission.can_write;
      case 'delete':
        return permission.can_delete;
      default:
        return false;
    }
  }
}

export const adminPermissionsService = new AdminPermissionsService();
