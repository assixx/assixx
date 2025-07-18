/**
 * Admin Permission Service
 * Handles department and group permissions for admin users
 */

import {
  execute,
  getConnection,
  RowDataPacket,
  ResultSetHeader,
} from "../utils/db";
import { logger } from "../utils/logger.js";

interface Permission {
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
}

interface DepartmentWithPermission {
  id: number;
  name: string;
  description?: string;
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
}

class AdminPermissionService {
  /**
   * Check if admin has access to a specific department
   */
  async hasAccess(
    adminId: number,
    departmentId: number,
    tenantId: number,
    requiredPermission: "read" | "write" | "delete" = "read",
  ): Promise<boolean> {
    try {
      // First check direct department permissions
      const [directPermissions] = await execute<RowDataPacket[]>(
        `SELECT can_read, can_write, can_delete 
         FROM admin_department_permissions 
         WHERE admin_user_id = ? AND department_id = ? AND tenant_id = ?`,
        [adminId, departmentId, tenantId],
      );

      if (directPermissions.length > 0) {
        const perm = directPermissions[0];
        return this.checkPermissionLevel(perm, requiredPermission);
      }

      // Check group permissions
      const [groupPermissions] = await execute<RowDataPacket[]>(
        `SELECT agp.can_read, agp.can_write, agp.can_delete
         FROM admin_group_permissions agp
         JOIN department_group_members dgm ON agp.group_id = dgm.group_id
         WHERE agp.admin_user_id = ? 
         AND dgm.department_id = ? 
         AND agp.tenant_id = ?`,
        [adminId, departmentId, tenantId],
      );

      if (groupPermissions.length > 0) {
        // Check if any group grants the required permission
        return groupPermissions.some((perm: RowDataPacket) =>
          this.checkPermissionLevel(perm, requiredPermission),
        );
      }

      return false;
    } catch (error) {
      logger.error("Error checking admin access:", error);
      return false;
    }
  }

  private checkPermissionLevel(
    permission: RowDataPacket,
    requiredLevel: "read" | "write" | "delete",
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

  /**
   * Get all departments an admin has access to (direct + via groups)
   */
  async getAdminDepartments(
    adminId: number,
    tenantId: number,
  ): Promise<{
    departments: DepartmentWithPermission[];
    hasAllAccess: boolean;
  }> {
    try {
      // Check if admin has access to all departments
      const [adminInfo] = await execute<RowDataPacket[]>(
        `SELECT COUNT(*) as dept_count FROM admin_department_permissions 
         WHERE admin_user_id = ? AND tenant_id = ?`,
        [adminId, tenantId],
      );

      const [totalDepts] = await execute<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM departments WHERE tenant_id = ?`,
        [tenantId],
      );

      const hasAllAccess =
        adminInfo[0].dept_count === totalDepts[0].total &&
        totalDepts[0].total > 0;

      // Get direct department permissions
      const [directDepts] = await execute<RowDataPacket[]>(
        `SELECT d.id, d.name, d.description, 
                adp.can_read, adp.can_write, adp.can_delete
         FROM departments d
         JOIN admin_department_permissions adp ON d.id = adp.department_id
         WHERE adp.admin_user_id = ? AND adp.tenant_id = ?`,
        [adminId, tenantId],
      );

      // Get departments via group permissions
      const [groupDepts] = await execute<RowDataPacket[]>(
        `SELECT DISTINCT d.id, d.name, d.description,
                MAX(agp.can_read) as can_read,
                MAX(agp.can_write) as can_write,
                MAX(agp.can_delete) as can_delete
         FROM departments d
         JOIN department_group_members dgm ON d.id = dgm.department_id
         JOIN admin_group_permissions agp ON dgm.group_id = agp.group_id
         WHERE agp.admin_user_id = ? AND agp.tenant_id = ?
         GROUP BY d.id, d.name, d.description`,
        [adminId, tenantId],
      );

      // Merge results, avoiding duplicates
      const departmentMap = new Map<number, DepartmentWithPermission>();

      // Add direct permissions
      directDepts.forEach((dept) => {
        departmentMap.set(dept.id, {
          id: dept.id,
          name: dept.name,
          description: dept.description,
          can_read: dept.can_read === 1,
          can_write: dept.can_write === 1,
          can_delete: dept.can_delete === 1,
        });
      });

      // Add/update with group permissions (taking maximum permissions)
      groupDepts.forEach((dept) => {
        const existing = departmentMap.get(dept.id);
        if (existing) {
          // Take maximum permissions
          existing.can_read = existing.can_read ?? dept.can_read === 1;
          existing.can_write = existing.can_write ?? dept.can_write === 1;
          existing.can_delete = existing.can_delete ?? dept.can_delete === 1;
        } else {
          departmentMap.set(dept.id, {
            id: dept.id,
            name: dept.name,
            description: dept.description,
            can_read: dept.can_read === 1,
            can_write: dept.can_write === 1,
            can_delete: dept.can_delete === 1,
          });
        }
      });

      return {
        departments: Array.from(departmentMap.values()),
        hasAllAccess,
      };
    } catch (error) {
      logger.error("Error getting admin departments:", error);
      return { departments: [], hasAllAccess: false };
    }
  }

  /**
   * Set department permissions for an admin (overwrites existing)
   */
  async setPermissions(
    adminId: number,
    departmentIds: number[],
    assignedBy: number,
    tenantId: number,
    permissions: Permission = {
      can_read: true,
      can_write: false,
      can_delete: false,
    },
  ): Promise<boolean> {
    const connection = await getConnection();

    try {
      logger.info(`[DEBUG] setPermissions called:`, {
        adminId,
        departmentIds,
        assignedBy,
        tenantId,
        permissions,
      });

      await connection.beginTransaction();

      // Log old permissions for audit
      const [oldPerms] = await connection.execute(
        `SELECT department_id, can_read, can_write, can_delete 
         FROM admin_department_permissions 
         WHERE admin_user_id = ? AND tenant_id = ?`,
        [adminId, tenantId],
      );

      // Remove all existing permissions
      await connection.execute(
        `DELETE FROM admin_department_permissions 
         WHERE admin_user_id = ? AND tenant_id = ?`,
        [adminId, tenantId],
      );

      // Add new permissions
      if (departmentIds.length > 0) {
        const values = departmentIds.map((deptId) => [
          tenantId,
          adminId,
          deptId,
          permissions.can_read ? 1 : 0,
          permissions.can_write ? 1 : 0,
          permissions.can_delete ? 1 : 0,
          assignedBy,
        ]);

        logger.info(`[DEBUG] Inserting permissions:`, {
          departmentCount: departmentIds.length,
          sampleValue: values[0],
        });

        const placeholders = departmentIds
          .map(() => "(?, ?, ?, ?, ?, ?, ?)")
          .join(", ");

        await connection.execute(
          `INSERT INTO admin_department_permissions 
           (tenant_id, admin_user_id, department_id, can_read, can_write, can_delete, assigned_by) 
           VALUES ${placeholders}`,
          values.flat(),
        );
      }

      // Log permission change
      await connection.execute(
        `INSERT INTO admin_permission_logs 
         (tenant_id, action, admin_user_id, target_id, target_type, changed_by, old_permissions, new_permissions) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          "modify",
          adminId,
          0, // No specific target, batch operation
          "department",
          assignedBy,
          JSON.stringify(oldPerms),
          JSON.stringify(
            departmentIds.map((id) => ({ department_id: id, ...permissions })),
          ),
        ],
      );

      await connection.commit();
      logger.info(`[DEBUG] Successfully set permissions for admin ${adminId}`);
      return true;
    } catch (error) {
      await connection.rollback();
      logger.error("Error setting admin permissions:", error);
      logger.error("[DEBUG] Error details:", {
        message: (error as Error).message,
        code: (error as { code?: string }).code,
        sqlMessage: (error as { sqlMessage?: string }).sqlMessage,
      });
      return false;
    } finally {
      connection.release();
    }
  }

  /**
   * Set group permissions for an admin
   */
  async setGroupPermissions(
    adminId: number,
    groupIds: number[],
    assignedBy: number,
    tenantId: number,
    permissions: Permission = {
      can_read: true,
      can_write: false,
      can_delete: false,
    },
  ): Promise<boolean> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      // Remove all existing group permissions
      await connection.execute(
        `DELETE FROM admin_group_permissions 
         WHERE admin_user_id = ? AND tenant_id = ?`,
        [adminId, tenantId],
      );

      // Add new permissions
      if (groupIds.length > 0) {
        const values = groupIds.map((groupId) => [
          tenantId,
          adminId,
          groupId,
          permissions.can_read,
          permissions.can_write,
          permissions.can_delete,
          assignedBy,
        ]);

        const placeholders = groupIds
          .map(() => "(?, ?, ?, ?, ?, ?, ?)")
          .join(", ");

        await connection.execute(
          `INSERT INTO admin_group_permissions 
           (tenant_id, admin_user_id, group_id, can_read, can_write, can_delete, assigned_by) 
           VALUES ${placeholders}`,
          values.flat(),
        );
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      logger.error("Error setting admin group permissions:", error);
      return false;
    } finally {
      connection.release();
    }
  }

  /**
   * Remove specific department permission
   */
  async removePermission(
    adminId: number,
    departmentId: number,
    tenantId: number,
  ): Promise<boolean> {
    try {
      const [result] = await execute<ResultSetHeader>(
        `DELETE FROM admin_department_permissions 
         WHERE admin_user_id = ? AND department_id = ? AND tenant_id = ?`,
        [adminId, departmentId, tenantId],
      );

      return result.affectedRows > 0;
    } catch (error) {
      logger.error("Error removing admin permission:", error);
      return false;
    }
  }

  /**
   * Remove specific group permission
   */
  async removeGroupPermission(
    adminId: number,
    groupId: number,
    tenantId: number,
  ): Promise<boolean> {
    try {
      const [result] = await execute<ResultSetHeader>(
        `DELETE FROM admin_group_permissions 
         WHERE admin_user_id = ? AND group_id = ? AND tenant_id = ?`,
        [adminId, groupId, tenantId],
      );

      return result.affectedRows > 0;
    } catch (error) {
      logger.error("Error removing admin group permission:", error);
      return false;
    }
  }

  /**
   * Log permission change for audit trail
   */
  async logPermissionChange(
    action: "grant" | "revoke" | "modify",
    adminId: number,
    targetId: number,
    targetType: "department" | "group",
    changedBy: number,
    tenantId: number,
    oldPermissions?: unknown,
    newPermissions?: unknown,
  ): Promise<void> {
    try {
      await execute<ResultSetHeader>(
        `INSERT INTO admin_permission_logs 
         (tenant_id, action, admin_user_id, target_id, target_type, changed_by, old_permissions, new_permissions) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          action,
          adminId,
          targetId,
          targetType,
          changedBy,
          oldPermissions ? JSON.stringify(oldPermissions) : null,
          newPermissions ? JSON.stringify(newPermissions) : null,
        ],
      );
    } catch (error) {
      logger.error("Error logging permission change:", error);
    }
  }
}

export default new AdminPermissionService();
