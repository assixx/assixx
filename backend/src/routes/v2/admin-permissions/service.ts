/**
 * Admin Permissions Service v2
 * Business logic for managing admin permissions
 */

import { RowDataPacket, ResultSetHeader } from "mysql2/promise";

import { RootLog } from "../../../models/rootLog.js";
import { ServiceError } from "../../../utils/ServiceError.js";
import { execute } from "../../../utils/db.js";
import { getErrorMessage } from "../../../utils/errorHandler.js";
import { logger } from "../../../utils/logger.js";

import {
  AdminDepartment,
  AdminGroup,
  AdminPermissionsResponse,
  PermissionSet,
  PermissionLevel,
  PermissionCheckResult,
  BulkOperationResult,
} from "./types.js";

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

export class AdminPermissionsService {
  /**
   * Check if admin has access to a specific department
   */
  async checkAccess(
    adminId: number,
    departmentId: number,
    tenantId: number,
    requiredPermission: PermissionLevel = "read",
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
          source: "direct",
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

          return { hasAccess: true, source: "group", permissions };
        }
      }

      return { hasAccess: false };
    } catch (error) {
      logger.error("Error checking admin access:", error);
      throw new ServiceError("SERVER_ERROR", "Failed to check permissions");
    }
  }

  /**
   * Get all permissions for an admin
   */
  async getAdminPermissions(
    adminId: number,
    tenantId: number,
  ): Promise<AdminPermissionsResponse> {
    try {
      // Get the admin user to check their role
      const [adminRows] = await execute<RowDataPacket[]>(
        "SELECT role FROM users WHERE id = ? AND tenant_id = ?",
        [adminId, tenantId],
      );

      if (!adminRows || adminRows.length === 0) {
        throw new ServiceError("NOT_FOUND", "Admin not found");
      }

      const isRoot = adminRows[0].role === "root";

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
      const [departmentRows] = await execute<DepartmentPermissionRow[]>(
        departmentQuery,
        [adminId, tenantId],
      );

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
      const [groupRows] = await execute<GroupPermissionRow[]>(groupQuery, [
        adminId,
        tenantId,
      ]);

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
        "SELECT COUNT(*) as total FROM departments WHERE tenant_id = ? AND is_active = 1",
        [tenantId],
      );
      const totalDepartments = countResult[0].total;

      return {
        departments,
        groups,
        hasAllAccess: isRoot,
        totalDepartments,
        assignedDepartments: departments.length,
      };
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      logger.error("Error getting admin permissions:", error);
      throw new ServiceError("SERVER_ERROR", "Failed to get permissions");
    }
  }

  /**
   * Set department permissions for an admin
   */
  async setDepartmentPermissions(
    adminId: number,
    departmentIds: number[],
    permissions: PermissionSet,
    modifiedBy: number,
    tenantId: number,
  ): Promise<void> {
    try {
      // Remove existing department permissions
      await execute(
        "DELETE FROM admin_department_permissions WHERE admin_user_id = ? AND tenant_id = ?",
        [adminId, tenantId],
      );

      // Add new permissions
      if (departmentIds.length > 0) {
        const values = departmentIds.map((deptId) => [
          adminId,
          deptId,
          tenantId,
          permissions.canRead ? 1 : 0,
          permissions.canWrite ? 1 : 0,
          permissions.canDelete ? 1 : 0,
        ]);

        const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
        const flatValues = values.flat();

        await execute(
          `INSERT INTO admin_department_permissions 
          (admin_user_id, department_id, tenant_id, can_read, can_write, can_delete) 
          VALUES ${placeholders}`,
          flatValues,
        );
      }

      // Log the action
      await RootLog.log(
        "update_admin_permissions",
        modifiedBy,
        tenantId,
        `Updated department permissions for admin ${adminId}: ${departmentIds.length} departments - ${JSON.stringify({
          adminId,
          departmentCount: departmentIds.length,
          permissions,
        })}`
      );
    } catch (error) {
      logger.error("Error setting department permissions:", error);
      throw new ServiceError("SERVER_ERROR", "Failed to set permissions");
    }
  }

  /**
   * Set group permissions for an admin
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
        "DELETE FROM admin_group_permissions WHERE admin_user_id = ? AND tenant_id = ?",
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
        ]);

        const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
        const flatValues = values.flat();

        await execute(
          `INSERT INTO admin_group_permissions 
          (admin_user_id, group_id, tenant_id, can_read, can_write, can_delete) 
          VALUES ${placeholders}`,
          flatValues,
        );
      }

      // Log the action
      await RootLog.log(
        "update_admin_group_permissions",
        modifiedBy,
        tenantId,
        `Updated group permissions for admin ${adminId}: ${groupIds.length} groups - ${JSON.stringify({
          adminId,
          groupCount: groupIds.length,
          permissions,
        })}`
      );
    } catch (error) {
      logger.error("Error setting group permissions:", error);
      throw new ServiceError("SERVER_ERROR", "Failed to set group permissions");
    }
  }

  /**
   * Remove specific department permission
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
        throw new ServiceError("NOT_FOUND", "Permission not found");
      }

      // Log the action
      await RootLog.log(
        "revoke_admin_permission",
        modifiedBy,
        tenantId,
        `Revoked department permission for admin ${adminId} on department ${departmentId}`
      );
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      logger.error("Error removing department permission:", error);
      throw new ServiceError("SERVER_ERROR", "Failed to remove permission");
    }
  }

  /**
   * Remove specific group permission
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
        throw new ServiceError("NOT_FOUND", "Group permission not found");
      }

      // Log the action
      await RootLog.log(
        "revoke_admin_group_permission",
        modifiedBy,
        tenantId,
        `Revoked group permission for admin ${adminId} on group ${groupId}`
      );
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      logger.error("Error removing group permission:", error);
      throw new ServiceError("SERVER_ERROR", "Failed to remove group permission");
    }
  }

  /**
   * Bulk update permissions
   */
  async bulkUpdatePermissions(
    adminIds: number[],
    operation: "assign" | "remove",
    departmentIds: number[] | undefined,
    permissions: PermissionSet,
    modifiedBy: number,
    tenantId: number,
  ): Promise<BulkOperationResult> {
    let successCount = 0;
    const errors: string[] = [];

    for (const adminId of adminIds) {
      try {
        if (operation === "assign" && departmentIds) {
          await this.setDepartmentPermissions(
            adminId,
            departmentIds,
            permissions,
            modifiedBy,
            tenantId,
          );
          successCount++;
        } else if (operation === "remove") {
          await this.setDepartmentPermissions(
            adminId,
            [],
            permissions,
            modifiedBy,
            tenantId,
          );
          successCount++;
        }
      } catch (error) {
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
   */
  private checkPermissionLevel(
    permission: RowDataPacket,
    requiredLevel: PermissionLevel,
  ): boolean {
    switch (requiredLevel) {
      case "read":
        return permission.can_read === 1;
      case "write":
        return permission.can_write === 1;
      case "delete":
        return permission.can_delete === 1;
      default:
        return false;
    }
  }
}

export const adminPermissionsService = new AdminPermissionsService();