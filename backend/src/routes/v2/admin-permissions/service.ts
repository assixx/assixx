/**
 * Admin Permissions Service v2
 * Business logic for managing admin permissions
 */
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { createRootLog } from '../../../models/rootLog.js';
import { ServiceError } from '../../../utils/ServiceError.js';
import { execute } from '../../../utils/db.js';
import { getErrorMessage } from '../../../utils/errorHandler.js';
import { logger } from '../../../utils/logger.js';
import {
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
  can_read: number;
  can_write: number;
  can_delete: number;
}

interface GroupPermissionRow extends RowDataPacket {
  id: number;
  name: string;
  description?: string;
  department_count: number;
  can_read: number;
  can_write: number;
  can_delete: number;
}

interface PermissionResult extends RowDataPacket {
  can_read: number;
  can_write: number;
  can_delete: number;
}

interface RoleResult extends RowDataPacket {
  role: string;
}

/**
 * Build permission set from a single permission result
 */
function toPermissionSet(perm: PermissionResult): PermissionSet {
  return {
    canRead: perm.can_read === 1,
    canWrite: perm.can_write === 1,
    canDelete: perm.can_delete === 1,
  };
}

/**
 * Build permission set from multiple permission results (highest permissions)
 */
function buildPermissionSet(perms: PermissionResult[]): PermissionSet {
  return {
    canRead: perms.some((p: PermissionResult) => p.can_read === 1),
    canWrite: perms.some((p: PermissionResult) => p.can_write === 1),
    canDelete: perms.some((p: PermissionResult) => p.can_delete === 1),
  };
}

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
      const directQuery = `
        SELECT can_read, can_write, can_delete
        FROM admin_department_permissions
        WHERE admin_user_id = ? AND department_id = ? AND tenant_id = ?
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

      // Check group permissions
      const groupQuery = `
        SELECT agp.can_read, agp.can_write, agp.can_delete
        FROM admin_group_permissions agp
        JOIN department_group_members dgm ON agp.group_id = dgm.group_id
        WHERE agp.admin_user_id = ?
        AND dgm.department_id = ?
        AND agp.tenant_id = ?
      `;
      const [groupPermissions] = await execute<PermissionResult[]>(groupQuery, [
        adminId,
        departmentId,
        tenantId,
      ]);

      if (groupPermissions.length > 0) {
        const hasAccess = groupPermissions.some((perm: PermissionResult) =>
          this.checkPermissionLevel(perm, requiredPermission),
        );
        if (hasAccess) {
          return {
            hasAccess: true,
            source: 'group',
            permissions: buildPermissionSet(groupPermissions),
          };
        }
      }

      return { hasAccess: false };
    } catch (error: unknown) {
      logger.error('Error checking admin access:', error);
      throw new ServiceError('SERVER_ERROR', 'Failed to check permissions');
    }
  }

  /**
   * Get all permissions for an admin
   * @param adminId - The adminId parameter
   * @param tenantId - The tenant ID
   */
  private async getAdminRole(adminId: number, tenantId: number): Promise<boolean> {
    const [adminRows] = await execute<RoleResult[]>(
      'SELECT role FROM users WHERE id = ? AND tenant_id = ?',
      [adminId, tenantId],
    );

    logger.info(`[getAdminRole] Admin query result:`, adminRows);

    if (adminRows.length === 0) {
      logger.error(`[getAdminRole] Admin not found - adminId: ${adminId}, tenantId: ${tenantId}`);
      throw new ServiceError('NOT_FOUND', 'Admin not found');
    }

    const adminRow = adminRows[0];
    if (adminRow === undefined) {
      throw new ServiceError('NOT_FOUND', 'Admin not found');
    }

    return adminRow.role === 'root';
  }

  private async getDepartmentPermissions(
    adminId: number,
    tenantId: number,
  ): Promise<AdminDepartment[]> {
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
      WHERE adp.admin_user_id = ?
      AND adp.tenant_id = ?
      AND d.is_active = 1
      ORDER BY d.name
    `;
    const [rows] = await execute<DepartmentPermissionRow[]>(query, [adminId, tenantId]);

    return rows.map((row: DepartmentPermissionRow) => {
      const result: AdminDepartment = {
        id: row.id,
        name: row.name,
        canRead: row.can_read === 1,
        canWrite: row.can_write === 1,
        canDelete: row.can_delete === 1,
      };
      if (row.description !== undefined) {
        result.description = row.description;
      }
      return result;
    });
  }

  private async getGroupPermissions(adminId: number, tenantId: number): Promise<AdminGroup[]> {
    const query = `
      SELECT
        dg.id,
        dg.name,
        dg.description,
        COUNT(DISTINCT dgm.department_id) as department_count,
        agp.can_read,
        agp.can_write,
        agp.can_delete
      FROM admin_group_permissions agp
      JOIN department_groups dg ON agp.group_id = dg.id
      LEFT JOIN department_group_members dgm ON dg.id = dgm.group_id
      WHERE agp.admin_user_id = ?
      AND agp.tenant_id = ?
      GROUP BY dg.id, dg.name, dg.description, agp.can_read, agp.can_write, agp.can_delete
      ORDER BY dg.name
    `;
    const [rows] = await execute<GroupPermissionRow[]>(query, [adminId, tenantId]);

    return rows.map((row: GroupPermissionRow) => {
      const result: AdminGroup = {
        id: row.id,
        name: row.name,
        departmentCount: row.department_count,
        canRead: row.can_read === 1,
        canWrite: row.can_write === 1,
        canDelete: row.can_delete === 1,
      };
      if (row.description !== undefined) {
        result.description = row.description;
      }
      return result;
    });
  }

  private async getTotalDepartments(tenantId: number): Promise<number> {
    const [countResult] = await execute<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM departments WHERE tenant_id = ? AND is_active = 1',
      [tenantId],
    );
    return (countResult[0] as { total: number }).total;
  }

  async getAdminPermissions(adminId: number, tenantId: number): Promise<AdminPermissionsResponse> {
    try {
      logger.info(`[getAdminPermissions] Starting for adminId: ${adminId}, tenantId: ${tenantId}`);

      const isRoot = await this.getAdminRole(adminId, tenantId);
      const departments = await this.getDepartmentPermissions(adminId, tenantId);
      const groups = await this.getGroupPermissions(adminId, tenantId);
      const totalDepartments = await this.getTotalDepartments(tenantId);

      return {
        departments,
        groups,
        hasAllAccess: isRoot,
        totalDepartments,
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
        'DELETE FROM admin_department_permissions WHERE admin_user_id = ? AND tenant_id = ?',
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
   * Insert department permissions into database
   */
  private async insertDepartmentPermissions(
    adminId: number,
    departmentIds: number[],
    permissions: PermissionSet,
    modifiedBy: number,
    tenantId: number,
  ): Promise<void> {
    const values = departmentIds.map((deptId: number) => [
      adminId,
      deptId,
      tenantId,
      permissions.canRead ? 1 : 0,
      permissions.canWrite ? 1 : 0,
      permissions.canDelete ? 1 : 0,
      modifiedBy,
    ]);
    const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');

    await execute(
      `INSERT INTO admin_department_permissions
       (admin_user_id, department_id, tenant_id, can_read, can_write, can_delete, assigned_by)
       VALUES ${placeholders}`,
      values.flat(),
    );
  }

  /**
   * Set group permissions for an admin
   * @param adminId - The adminId parameter
   * @param groupIds - The groupIds parameter
   * @param permissions - The permissions parameter
   * @param modifiedBy - The modifiedBy parameter
   * @param tenantId - The tenant ID
   */
  async setGroupPermissions(
    adminId: number,
    groupIds: number[],
    permissions: PermissionSet,
    modifiedBy: number,
    tenantId: number,
  ): Promise<void> {
    try {
      // Remove existing group permissions
      await execute(
        'DELETE FROM admin_group_permissions WHERE admin_user_id = ? AND tenant_id = ?',
        [adminId, tenantId],
      );

      // Add new permissions
      if (groupIds.length > 0) {
        const values = groupIds.map((groupId: number) => [
          adminId,
          groupId,
          tenantId,
          permissions.canRead ? 1 : 0,
          permissions.canWrite ? 1 : 0,
          permissions.canDelete ? 1 : 0,
          modifiedBy, // assigned_by
        ]);

        const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        const flatValues = values.flat();

        await execute(
          `INSERT INTO admin_group_permissions
          (admin_user_id, group_id, tenant_id, can_read, can_write, can_delete, assigned_by)
          VALUES ${placeholders}`,
          flatValues,
        );
      }

      // Log the action
      await createRootLog({
        action: 'update_admin_group_permissions',
        user_id: modifiedBy,
        tenant_id: tenantId,
        details: `Updated group permissions for admin ${adminId}: ${groupIds.length} groups - ${JSON.stringify(
          {
            adminId,
            groupCount: groupIds.length,
            permissions,
          },
        )}`,
      });
    } catch (error: unknown) {
      logger.error('Error setting group permissions:', error);
      throw new ServiceError('SERVER_ERROR', 'Failed to set group permissions');
    }
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
      const [result] = await execute<ResultSetHeader>(
        `DELETE FROM admin_department_permissions
        WHERE admin_user_id = ? AND department_id = ? AND tenant_id = ?`,
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
   * Remove specific group permission
   * @param adminId - The adminId parameter
   * @param groupId - The groupId parameter
   * @param modifiedBy - The modifiedBy parameter
   * @param tenantId - The tenant ID
   */
  async removeGroupPermission(
    adminId: number,
    groupId: number,
    modifiedBy: number,
    tenantId: number,
  ): Promise<void> {
    try {
      const [result] = await execute<ResultSetHeader>(
        `DELETE FROM admin_group_permissions
        WHERE admin_user_id = ? AND group_id = ? AND tenant_id = ?`,
        [adminId, groupId, tenantId],
      );

      if (result.affectedRows === 0) {
        throw new ServiceError('NOT_FOUND', 'Group permission not found');
      }

      // Log the action
      await createRootLog({
        action: 'revoke_admin_group_permission',
        user_id: modifiedBy,
        tenant_id: tenantId,
        details: `Revoked group permission for admin ${adminId} on group ${groupId}`,
      });
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error('Error removing group permission:', error);
      throw new ServiceError('SERVER_ERROR', 'Failed to remove group permission');
    }
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
        return permission.can_read === 1;
      case 'write':
        return permission.can_write === 1;
      case 'delete':
        return permission.can_delete === 1;
      default:
        return false;
    }
  }
}

export const adminPermissionsService = new AdminPermissionsService();
