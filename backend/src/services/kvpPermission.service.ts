/**
 * KVP Permission Service
 * Handles permission checks and department visibility for KVP suggestions
 */

import { query as executeQuery, RowDataPacket } from "../utils/db";
import { logger } from "../utils/logger.js";
import adminPermissionService from "./adminPermission.service.js";

interface KvpVisibilityQuery {
  userId: number;
  role: "root" | "admin" | "employee";
  tenantId: number;
  includeArchived?: boolean;
  statusFilter?: string;
  departmentFilter?: number;
}

class KvpPermissionService {
  /**
   * Get all departments an admin has access to
   */
  async getAdminDepartments(
    adminId: number,
    tenantId: number
  ): Promise<number[]> {
    try {
      const result = await adminPermissionService.getAdminDepartments(
        adminId,
        tenantId
      );
      return result.departments.map((dept) => dept.id);
    } catch (error) {
      logger.error("Error getting admin departments:", error);
      return [];
    }
  }

  /**
   * Check if user can view a specific KVP suggestion
   */
  async canViewSuggestion(
    userId: number,
    suggestionId: number,
    role: "root" | "admin" | "employee",
    tenantId: number
  ): Promise<boolean> {
    try {
      // Root can see everything
      if (role === "root") return true;

      // Get suggestion details
      const [suggestions] = await executeQuery<RowDataPacket[]>(
        `SELECT tenant_id, department_id, org_level, org_id, submitted_by 
         FROM kvp_suggestions 
         WHERE id = ?`,
        [suggestionId]
      );

      if (suggestions.length === 0) return false;
      const suggestion = suggestions[0];

      // Check tenant match
      if (suggestion.tenant_id !== tenantId) return false;

      // Employee logic
      if (role === "employee") {
        // Can see own suggestions
        if (suggestion.submitted_by === userId) return true;

        // Can see company-wide suggestions
        if (suggestion.org_level === "company") return true;

        // Can see department suggestions if in same department
        const [userInfo] = await executeQuery<RowDataPacket[]>(
          "SELECT department_id FROM users WHERE id = ?",
          [userId]
        );

        if (userInfo.length > 0 && suggestion.org_level === "department") {
          return userInfo[0].department_id === suggestion.department_id;
        }
      }

      // Admin logic
      if (role === "admin") {
        // Can see company-wide
        if (suggestion.org_level === "company") return true;

        // Check if admin manages this department
        const adminDepts = await this.getAdminDepartments(userId, tenantId);
        return adminDepts.includes(suggestion.department_id);
      }

      return false;
    } catch (error) {
      logger.error("Error checking view permission:", error);
      return false;
    }
  }

  /**
   * Check if user can edit a specific KVP suggestion
   */
  async canEditSuggestion(
    userId: number,
    suggestionId: number,
    role: "root" | "admin" | "employee",
    tenantId: number
  ): Promise<boolean> {
    try {
      // Get suggestion details
      const [suggestions] = await executeQuery<RowDataPacket[]>(
        `SELECT tenant_id, department_id, org_level, org_id, submitted_by, status, shared_by 
         FROM kvp_suggestions 
         WHERE id = ?`,
        [suggestionId]
      );

      if (suggestions.length === 0) return false;
      const suggestion = suggestions[0];

      // Check tenant match
      if (suggestion.tenant_id !== tenantId) return false;

      // Root can edit everything
      if (role === "root") return true;

      // Employee can only edit their own suggestions in 'new' status
      if (role === "employee") {
        return (
          suggestion.submitted_by === userId && suggestion.status === "new"
        );
      }

      // Admin logic
      if (role === "admin") {
        // For company-wide suggestions, only the original sharer can edit
        if (suggestion.org_level === "company") {
          return suggestion.shared_by === userId;
        }

        // For department suggestions, check admin permissions
        const adminDepts = await this.getAdminDepartments(userId, tenantId);
        return adminDepts.includes(suggestion.department_id);
      }

      return false;
    } catch (error) {
      logger.error("Error checking edit permission:", error);
      return false;
    }
  }

  /**
   * Build SQL WHERE clause for visibility filtering
   */
  async buildVisibilityQuery(params: KvpVisibilityQuery): Promise<{
    whereClause: string;
    queryParams: (string | number)[];
  }> {
    const {
      userId,
      role,
      tenantId,
      includeArchived,
      statusFilter,
      departmentFilter,
    } = params;
    const conditions: string[] = ["s.tenant_id = ?"];
    const queryParams: (string | number)[] = [tenantId];

    // Root sees everything
    if (role === "root") {
      // No additional filters needed
    } else if (role === "employee") {
      // Get user's department
      const [userInfo] = await executeQuery<RowDataPacket[]>(
        "SELECT department_id FROM users WHERE id = ?",
        [userId]
      );

      const userDeptId = userInfo[0]?.department_id ?? null;

      // Employee sees: own + department + company-wide
      const visibilityConditions = [
        "s.submitted_by = ?",
        "(s.org_level = ? AND s.department_id = ?)",
        "s.org_level = ?",
      ];

      conditions.push(`(${visibilityConditions.join(" OR ")})`);
      queryParams.push(
        userId,
        "department",
        userDeptId || 0, // Use 0 as fallback for NULL department
        "company"
      );
    } else if (role === "admin") {
      // Get admin's managed departments
      const adminDepts = await this.getAdminDepartments(userId, tenantId);

      if (adminDepts.length > 0) {
        const deptPlaceholders = adminDepts.map(() => "?").join(",");
        conditions.push(
          `(s.department_id IN (${deptPlaceholders}) OR s.org_level = ?)`
        );
        queryParams.push(...adminDepts, "company");
      } else {
        // Admin with no departments only sees company-wide
        conditions.push("s.org_level = ?");
        queryParams.push("company");
      }
    }

    // Status filter
    if (!includeArchived) {
      conditions.push("s.status != ?");
      queryParams.push("archived");
    }

    if (statusFilter && statusFilter !== "all") {
      if (statusFilter === "active") {
        conditions.push("s.status NOT IN (?, ?)");
        queryParams.push("archived", "rejected");
      } else {
        conditions.push("s.status = ?");
        queryParams.push(statusFilter);
      }
    }

    // Department filter (for admins)
    if (departmentFilter && role === "admin") {
      conditions.push("s.department_id = ?");
      queryParams.push(departmentFilter);
    }

    return {
      whereClause: conditions.join(" AND "),
      queryParams,
    };
  }

  /**
   * Check if admin can share a suggestion company-wide
   */
  async canShareSuggestion(
    adminId: number,
    suggestionId: number,
    tenantId: number
  ): Promise<boolean> {
    try {
      // Get suggestion details
      const [suggestions] = await executeQuery<RowDataPacket[]>(
        `SELECT tenant_id, department_id, org_level 
         FROM kvp_suggestions 
         WHERE id = ?`,
        [suggestionId]
      );

      if (suggestions.length === 0) return false;
      const suggestion = suggestions[0];

      // Check tenant match
      if (suggestion.tenant_id !== tenantId) return false;

      // Already company-wide
      if (suggestion.org_level === "company") return false;

      // Check if admin manages this department
      const adminDepts = await this.getAdminDepartments(adminId, tenantId);
      return adminDepts.includes(suggestion.department_id);
    } catch (error) {
      logger.error("Error checking share permission:", error);
      return false;
    }
  }

  /**
   * Log admin action for audit trail
   */
  async logAdminAction(
    adminId: number,
    action: string,
    entityId: number,
    entityType: string = "kvp_suggestion",
    tenantId: number,
    oldValue?: unknown,
    newValue?: unknown
  ): Promise<void> {
    try {
      await executeQuery(
        `INSERT INTO admin_logs 
         (tenant_id, admin_user_id, action, entity_type, entity_id, old_value, new_value) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          adminId,
          action,
          entityType,
          entityId,
          oldValue ? JSON.stringify(oldValue) : null,
          newValue ? JSON.stringify(newValue) : null,
        ]
      );
    } catch (error) {
      logger.error("Error logging admin action:", error);
    }
  }

  /**
   * Get suggestion statistics for a department or company
   */
  async getSuggestionStats(
    scope: "company" | "department",
    scopeId: number,
    tenantId: number
  ): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    totalSavings: number;
  }> {
    try {
      let whereClause = "s.tenant_id = ?";
      const params: (string | number)[] = [tenantId];

      if (scope === "department") {
        whereClause += " AND s.department_id = ?";
        params.push(scopeId);
      }

      // Get counts by status
      const [statusCounts] = await executeQuery<RowDataPacket[]>(
        `SELECT status, COUNT(*) as count 
         FROM kvp_suggestions s
         WHERE ${whereClause}
         GROUP BY status`,
        params
      );

      // Get counts by priority
      const [priorityCounts] = await executeQuery<RowDataPacket[]>(
        `SELECT priority, COUNT(*) as count 
         FROM kvp_suggestions s
         WHERE ${whereClause}
         GROUP BY priority`,
        params
      );

      // Get total savings
      const [savings] = await executeQuery<RowDataPacket[]>(
        `SELECT COALESCE(SUM(actual_savings), 0) as total_savings 
         FROM kvp_suggestions s
         WHERE ${whereClause} AND status = 'implemented'`,
        params
      );

      // Build result
      const byStatus: Record<string, number> = {};
      statusCounts.forEach((row: RowDataPacket) => {
        byStatus[row.status] = row.count;
      });

      const byPriority: Record<string, number> = {};
      priorityCounts.forEach((row: RowDataPacket) => {
        byPriority[row.priority] = row.count;
      });

      const total = Object.values(byStatus).reduce(
        (sum, count) => sum + count,
        0
      );

      return {
        total,
        byStatus,
        byPriority,
        totalSavings: parseFloat(savings[0].total_savings) ?? 0,
      };
    } catch (error) {
      logger.error("Error getting suggestion stats:", error);
      return {
        total: 0,
        byStatus: {},
        byPriority: {},
        totalSavings: 0,
      };
    }
  }
}

export default new KvpPermissionService();
