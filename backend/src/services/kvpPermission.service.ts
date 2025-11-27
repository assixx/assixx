/**
 * KVP Permission Service
 * Handles permission checks and department visibility for KVP suggestions
 */
import {
  KvpSuggestionDetailsResult,
  PriorityCountResult,
  StatusCountResult,
  TotalSavingsResult,
  UserDepartmentIdResult,
} from '../types/query-results.types.js';
import { query as executeQuery } from '../utils/db.js';
import { logger } from '../utils/logger.js';
import adminPermissionService from './adminPermission.service.js';

interface KvpVisibilityQuery {
  userId: number;
  role: 'root' | 'admin' | 'employee';
  tenantId: number;
  includeArchived?: boolean;
  statusFilter?: string;
  departmentFilter?: number;
}

/**
 *
 */
class KvpPermissionService {
  /**
   * Get all departments an admin has access to
   * @param adminId - The adminId parameter
   * @param tenantId - The tenant ID
   */
  async getAdminDepartments(adminId: number, tenantId: number): Promise<number[]> {
    try {
      const result = await adminPermissionService.getAdminDepartments(adminId, tenantId);
      return result.departments.map((dept: { id: number }) => dept.id);
    } catch (error: unknown) {
      logger.error('Error getting admin departments:', error);
      return [];
    }
  }

  private async getSuggestionDetails(
    suggestionId: number,
  ): Promise<KvpSuggestionDetailsResult | null> {
    const [suggestions] = await executeQuery<KvpSuggestionDetailsResult[]>(
      `SELECT tenant_id, department_id, org_level, org_id, submitted_by
       FROM kvp_suggestions
       WHERE id = ?`,
      [suggestionId],
    );
    const suggestion = suggestions[0];
    if (suggestion === undefined) return null;
    return suggestion;
  }

  private async canEmployeeViewSuggestion(
    userId: number,
    suggestion: KvpSuggestionDetailsResult,
  ): Promise<boolean> {
    // Can see own suggestions
    if (suggestion.submitted_by === userId) return true;

    // Can see company-wide suggestions
    if (suggestion.org_level === 'company') return true;

    // Can see department suggestions if in same department
    const [userInfo] = await executeQuery<UserDepartmentIdResult[]>(
      'SELECT department_id FROM users WHERE id = ?',
      [userId],
    );

    const userRow = userInfo[0];
    if (userRow !== undefined && suggestion.org_level === 'department') {
      return userRow.department_id === suggestion.department_id;
    }

    return false;
  }

  private async canAdminViewSuggestion(
    userId: number,
    suggestion: KvpSuggestionDetailsResult,
    tenantId: number,
  ): Promise<boolean> {
    // Can see company-wide
    if (suggestion.org_level === 'company') return true;

    // Check if admin manages this department
    const adminDepts = await this.getAdminDepartments(userId, tenantId);
    return suggestion.department_id !== null && adminDepts.includes(suggestion.department_id);
  }

  /**
   * Check if user can view a specific KVP suggestion
   * @param userId - The user ID
   * @param suggestionId - The suggestionId parameter
   * @param role - The role parameter
   * @param tenantId - The tenant ID
   */
  async canViewSuggestion(
    userId: number,
    suggestionId: number,
    role: 'root' | 'admin' | 'employee',
    tenantId: number,
  ): Promise<boolean> {
    try {
      // Root can see everything
      if (role === 'root') return true;

      // Get suggestion details
      const suggestion = await this.getSuggestionDetails(suggestionId);
      if (!suggestion) return false;

      // Check tenant match
      if (suggestion.tenant_id !== tenantId) return false;

      // Check role-specific permissions
      if (role === 'employee') {
        return await this.canEmployeeViewSuggestion(userId, suggestion);
      }

      // At this point, role must be 'admin' (union type exhausted)
      return await this.canAdminViewSuggestion(userId, suggestion, tenantId);
    } catch (error: unknown) {
      logger.error('Error checking view permission:', error);
      return false;
    }
  }

  /**
   * Check if user can edit a specific KVP suggestion
   * @param userId - The user ID
   * @param suggestionId - The suggestionId parameter
   * @param role - The role parameter
   * @param tenantId - The tenant ID
   */
  async canEditSuggestion(
    userId: number,
    suggestionId: number,
    role: 'root' | 'admin' | 'employee',
    tenantId: number,
  ): Promise<boolean> {
    try {
      // Get suggestion details
      const [suggestions] = await executeQuery<KvpSuggestionDetailsResult[]>(
        `SELECT tenant_id, department_id, org_level, org_id, submitted_by, status, shared_by
         FROM kvp_suggestions
         WHERE id = ?`,
        [suggestionId],
      );

      const suggestion = suggestions[0];
      if (suggestion === undefined) return false;

      // Check tenant match
      if (suggestion.tenant_id !== tenantId) return false;

      // Root can edit everything
      if (role === 'root') return true;

      // Employee can only edit their own suggestions in 'new' status
      if (role === 'employee') {
        return suggestion.submitted_by === userId && suggestion.status === 'new';
      }

      // Admin logic - at this point role must be "admin"
      // For company-wide suggestions, only the original sharer can edit
      if (suggestion.org_level === 'company') {
        return suggestion.shared_by === userId;
      }

      // For department suggestions, check admin permissions
      const adminDepts = await this.getAdminDepartments(userId, tenantId);
      return suggestion.department_id !== null && adminDepts.includes(suggestion.department_id);
    } catch (error: unknown) {
      logger.error('Error checking edit permission:', error);
      return false;
    }
  }

  private async addEmployeeVisibilityConditions(
    userId: number,
    conditions: string[],
    queryParams: (string | number)[],
  ): Promise<void> {
    // Get user's department
    const [userInfo] = await executeQuery<UserDepartmentIdResult[]>(
      'SELECT department_id FROM users WHERE id = ?',
      [userId],
    );

    const userDeptId = userInfo[0]?.department_id;

    // Employee sees: own + department + company-wide
    const visibilityConditions = [
      's.submitted_by = ?',
      '(s.org_level = ? AND s.department_id = ?)',
      's.org_level = ?',
    ];

    conditions.push(`(${visibilityConditions.join(' OR ')})`);
    queryParams.push(
      userId,
      'department',
      userDeptId ?? 0, // Use 0 as fallback for NULL department
      'company',
    );
  }

  private async addAdminVisibilityConditions(
    userId: number,
    tenantId: number,
    conditions: string[],
    queryParams: (string | number)[],
  ): Promise<void> {
    // Admin role - Get admin's managed departments
    const adminDepts = await this.getAdminDepartments(userId, tenantId);

    if (adminDepts.length > 0) {
      const deptPlaceholders = adminDepts.map(() => '?').join(',');
      conditions.push(`(s.department_id IN (${deptPlaceholders}) OR s.org_level = ?)`);
      queryParams.push(...adminDepts, 'company');
    } else {
      // Admin with no departments only sees company-wide
      conditions.push('s.org_level = ?');
      queryParams.push('company');
    }
  }

  private addStatusFilterConditions(
    statusFilter: string | undefined,
    includeArchived: boolean | undefined,
    conditions: string[],
    queryParams: (string | number)[],
  ): void {
    // Status filter
    if (includeArchived === false) {
      conditions.push('s.status != ?');
      queryParams.push('archived');
    }

    if (statusFilter != null && statusFilter !== '' && statusFilter !== 'all') {
      if (statusFilter === 'active') {
        conditions.push('s.status NOT IN (?, ?)');
        queryParams.push('archived', 'rejected');
      } else {
        conditions.push('s.status = ?');
        queryParams.push(statusFilter);
      }
    }
  }

  /**
   * Build SQL WHERE clause for visibility filtering
   * @param params - The parameters object
   */
  async buildVisibilityQuery(params: KvpVisibilityQuery): Promise<{
    whereClause: string;
    queryParams: (string | number)[];
  }> {
    const { userId, role, tenantId, includeArchived, statusFilter, departmentFilter } = params;
    const conditions: string[] = ['s.tenant_id = ?'];
    const queryParams: (string | number)[] = [tenantId];

    // Add role-specific visibility conditions
    if (role === 'root') {
      // No additional filters needed for root
    } else if (role === 'employee') {
      await this.addEmployeeVisibilityConditions(userId, conditions, queryParams);
    } else {
      await this.addAdminVisibilityConditions(userId, tenantId, conditions, queryParams);
    }

    // Add status filters
    this.addStatusFilterConditions(statusFilter, includeArchived, conditions, queryParams);

    // Department filter (for admins)
    if (departmentFilter != null && departmentFilter !== 0 && role === 'admin') {
      conditions.push('s.department_id = ?');
      queryParams.push(departmentFilter);
    }

    return {
      whereClause: conditions.join(' AND '),
      queryParams,
    };
  }

  /**
   * Check if admin can share a suggestion company-wide
   * @param adminId - The adminId parameter
   * @param suggestionId - The suggestionId parameter
   * @param tenantId - The tenant ID
   */
  async canShareSuggestion(
    adminId: number,
    suggestionId: number,
    tenantId: number,
  ): Promise<boolean> {
    try {
      // Get suggestion details
      const [suggestions] = await executeQuery<KvpSuggestionDetailsResult[]>(
        `SELECT tenant_id, department_id, org_level
         FROM kvp_suggestions
         WHERE id = ?`,
        [suggestionId],
      );

      const suggestion = suggestions[0];
      if (suggestion === undefined) return false;

      // Check tenant match
      if (suggestion.tenant_id !== tenantId) return false;

      // Already company-wide
      if (suggestion.org_level === 'company') return false;

      // Check if admin manages this department
      const adminDepts = await this.getAdminDepartments(adminId, tenantId);
      return suggestion.department_id !== null && adminDepts.includes(suggestion.department_id);
    } catch (error: unknown) {
      logger.error('Error checking share permission:', error);
      return false;
    }
  }

  /**
   * Log admin action for audit trail
   * @param adminId - The adminId parameter
   * @param action - The action parameter
   * @param entityId - The entityId parameter
   * @param entityType - The entityType parameter
   * @param tenantId - The tenant ID
   * @param oldValue - The oldValue parameter
   * @param newValue - The newValue parameter
   */
  async logAdminAction(
    adminId: number,
    action: string,
    entityId: number,
    entityType: string | undefined,
    tenantId: number,
    oldValue?: unknown,
    newValue?: unknown,
  ): Promise<void> {
    const resolvedEntityType = entityType ?? 'kvp_suggestion';

    try {
      await executeQuery(
        `INSERT INTO admin_logs
         (tenant_id, admin_user_id, action, entity_type, entity_id, old_value, new_value)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          adminId,
          action,
          resolvedEntityType,
          entityId,
          oldValue != null ? JSON.stringify(oldValue) : null,
          newValue != null ? JSON.stringify(newValue) : null,
        ],
      );
    } catch (error: unknown) {
      logger.error('Error logging admin action:', error);
    }
  }

  /** Build WHERE clause for stats queries */
  private buildStatsWhereClause(
    scope: 'company' | 'department',
    scopeId: number,
    tenantId: number,
  ): { where: string; params: (string | number)[] } {
    const params: (string | number)[] = [tenantId];
    let where = 's.tenant_id = ?';
    if (scope === 'department') {
      where += ' AND s.department_id = ?';
      params.push(scopeId);
    }
    return { where, params };
  }

  /** Parse savings value safely */
  private parseSavings(savingsRow: TotalSavingsResult | undefined): number {
    if (savingsRow === undefined) return 0;
    if (typeof savingsRow.total_savings === 'string') {
      const parsed = Number.parseFloat(savingsRow.total_savings);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    return savingsRow.total_savings;
  }

  /**
   * Get suggestion statistics for a department or company
   */
  async getSuggestionStats(
    scope: 'company' | 'department',
    scopeId: number,
    tenantId: number,
  ): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    totalSavings: number;
  }> {
    try {
      const { where, params } = this.buildStatsWhereClause(scope, scopeId, tenantId);

      const [statusCounts] = await executeQuery<StatusCountResult[]>(
        `SELECT status, COUNT(*) as count FROM kvp_suggestions s WHERE ${where} GROUP BY status`,
        params,
      );
      const [priorityCounts] = await executeQuery<PriorityCountResult[]>(
        `SELECT priority, COUNT(*) as count FROM kvp_suggestions s WHERE ${where} GROUP BY priority`,
        params,
      );
      const [savings] = await executeQuery<TotalSavingsResult[]>(
        `SELECT COALESCE(SUM(actual_savings), 0) as total_savings FROM kvp_suggestions s WHERE ${where} AND status = 'implemented'`,
        params,
      );

      const byStatus: Record<string, number> = {};
      statusCounts.forEach((row: StatusCountResult) => {
        byStatus[row.status] = row.count;
      });

      const byPriority: Record<string, number> = {};
      priorityCounts.forEach((row: PriorityCountResult) => {
        byPriority[row.priority] = row.count;
      });

      const total = Object.values(byStatus).reduce((sum: number, count: number) => sum + count, 0);
      return { total, byStatus, byPriority, totalSavings: this.parseSavings(savings[0]) };
    } catch (error: unknown) {
      logger.error('Error getting suggestion stats:', error);
      return { total: 0, byStatus: {}, byPriority: {}, totalSavings: 0 };
    }
  }
}

export default new KvpPermissionService();
