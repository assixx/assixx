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

/**
 *
 */
export class AdminPermissionsService {
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
      const [directPermissions] = await execute<RowDataPacket[]>(directQuery, [
        adminId,
        departmentId,
        tenantId,
      ]);

      if (directPermissions.length > 0) {
        const perm = directPermissions[0];
        const hasAccess = this.checkPermissionLevel(perm, requiredPermission);
        return {
          hasAccess,
          source: 'direct',
          permissions: {
            canRead: perm.can_read === 1,
            canWrite: perm.can_write === 1,
            canDelete: perm.can_delete === 1,
          },
        };
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
      const [groupPermissions] = await execute<RowDataPacket[]>(groupQuery, [
        adminId,
        departmentId,
        tenantId,
      ]);

      if (groupPermissions.length > 0) {
        // Check if any group grants the required permission
        const hasAccess = groupPermissions.some((perm) =>
          this.checkPermissionLevel(perm, requiredPermission),
        );

        if (hasAccess) {
          // Get the highest permissions from all groups
          const permissions: PermissionSet = {
            canRead: groupPermissions.some((p) => p.can_read === 1),
            canWrite: groupPermissions.some((p) => p.can_write === 1),
            canDelete: groupPermissions.some((p) => p.can_delete === 1),
          };

          return { hasAccess: true, source: 'group', permissions };
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
  async getAdminPermissions(adminId: number, tenantId: number): Promise<AdminPermissionsResponse> {
    try {
      // Get the admin user to check their role
      const [adminRows] = await execute<RowDataPacket[]>(
        'SELECT role FROM users WHERE id = ? AND tenant_id = ?',
        [adminId, tenantId],
      );

      if (adminRows.length === 0) {
        throw new ServiceError('NOT_FOUND', 'Admin not found');
      }

      const isRoot = adminRows[0].role === 'root';

      // Get direct department permissions
      const departmentQuery = `
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
      const [departmentRows] = await execute<DepartmentPermissionRow[]>(departmentQuery, [
        adminId,
        tenantId,
      ]);

      const departments: AdminDepartment[] = departmentRows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        canRead: row.can_read === 1,
        canWrite: row.can_write === 1,
        canDelete: row.can_delete === 1,
      }));

      // Get group permissions
      const groupQuery = `
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
        AND dg.is_active = 1
        GROUP BY dg.id, dg.name, dg.description, agp.can_read, agp.can_write, agp.can_delete
        ORDER BY dg.name
      `;
      const [groupRows] = await execute<GroupPermissionRow[]>(groupQuery, [adminId, tenantId]);

      const groups: AdminGroup[] = groupRows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        departmentCount: row.department_count,
        canRead: row.can_read === 1,
        canWrite: row.can_write === 1,
        canDelete: row.can_delete === 1,
      }));

      // Get total department count
      const [countResult] = await execute<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM departments WHERE tenant_id = ? AND is_active = 1',
        [tenantId],
      );
      const totalDepartments = (countResult[0] as { total: number }).total;

      return {
        departments,
        groups,
        hasAllAccess: isRoot,
        totalDepartments,
        assignedDepartments: departments.length,
      };
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error('Error getting admin permissions:', error);
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
    logger.info('setDepartmentPermissions called with:', {
      adminId,
      departmentIds,
      permissions,
      modifiedBy,
      tenantId,
    });

    try {
      logger.info('Starting to remove existing permissions...');
      // Remove existing department permissions
      await execute(
        'DELETE FROM admin_department_permissions WHERE admin_user_id = ? AND tenant_id = ?',
        [adminId, tenantId],
      );
      logger.info('Existing permissions removed successfully');

      // Add new permissions
      if (departmentIds.length > 0) {
        logger.info('Adding new permissions for departments:', departmentIds);
        const values = departmentIds.map((deptId) => [
          adminId,
          deptId,
          tenantId,
          permissions.canRead ? 1 : 0,
          permissions.canWrite ? 1 : 0,
          permissions.canDelete ? 1 : 0,
          modifiedBy, // assigned_by
        ]);

        const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        const flatValues = values.flat();

        logger.info('SQL INSERT values:', { placeholders, flatValues });

        await execute(
          `INSERT INTO admin_department_permissions
          (admin_user_id, department_id, tenant_id, can_read, can_write, can_delete, assigned_by)
          VALUES ${placeholders}`,
          flatValues,
        );
        logger.info('Permissions inserted successfully');
      }

      // Log the action
      logger.info('Creating root log entry...');
      await createRootLog({
        action: 'update_admin_permissions',
        user_id: modifiedBy,
        tenant_id: tenantId,
        details: `Updated department permissions for admin ${adminId}: ${departmentIds.length} departments - ${JSON.stringify(
          {
            adminId,
            departmentCount: departmentIds.length,
            permissions,
          },
        )}`,
      });
      logger.info('Root log entry created successfully');
    } catch (error: unknown) {
      logger.error('Error setting department permissions:', error);
      logger.error('Error details:', {
        adminId,
        departmentIds,
        permissions,
        tenantId,
        modifiedBy,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ServiceError('SERVER_ERROR', 'Failed to set permissions');
    }
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
        const values = groupIds.map((groupId) => [
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

    return {
      successCount,
      totalCount: adminIds.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Check permission level
   * @param permission - The permission parameter
   * @param requiredLevel - The requiredLevel parameter
   */
  private checkPermissionLevel(permission: RowDataPacket, requiredLevel: PermissionLevel): boolean {
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
