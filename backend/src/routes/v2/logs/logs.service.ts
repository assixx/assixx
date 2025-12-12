import { ResultSetHeader, RowDataPacket, query as executeQuery  } from '../../../utils/db.js';

import { logger } from '../../../utils/logger.js';
import type {
  DbRootLog,
  LogsFilterParams,
  LogsListResponse,
  LogsResponse,
  LogsStatsResponse,
  RootLogCreateData,
} from './types.js';

// Extend RowDataPacket for DB queries
interface DbRootLogRow extends RowDataPacket, DbRootLog {}

interface DbLogRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  tenant_name?: string;
  user_id: number;
  user_name?: string;
  user_email?: string;
  user_role?: string;
  user_first_name?: string;
  user_last_name?: string;
  employee_number?: string;
  // Organization fields for search results
  department_name?: string;
  area_name?: string;
  team_name?: string;
  action: string;
  entity_type?: string;
  entity_id?: number;
  old_values?: string;
  new_values?: string;
  ip_address?: string;
  user_agent?: string;
  was_role_switched: number;
  created_at: Date | null; // PostgreSQL can return null for timestamps
}

interface StatsRow extends RowDataPacket {
  total_logs?: number;
  today_logs?: number;
  unique_users?: number;
  unique_tenants?: number;
  action?: string;
  count?: number;
  user_id?: number;
  user_name?: string;
}

// Specific result types for stats queries
interface TopActionResult extends RowDataPacket {
  action: string | null;
  count: number | null;
}

interface TopUserResult extends RowDataPacket {
  user_id: number | null;
  user_name: string | null;
  count: number | null;
}

/**
 *
 */
class LogsService {
  /**
   * Add search condition to query
   * Searches: first_name, last_name, full_name, employee_number, username, email,
   *           department, area, team, action, entity_type
   */
  private addSearchCondition(
    search: string | undefined,
    conditions: string[],
    params: unknown[],
  ): void {
    if (search === undefined || search === '') return;

    const paramIndex = params.length + 1;
    // Search fields with table aliases:
    // u = users, d = departments, a = areas, t = teams, rl = root_logs
    const searchFields = [
      // User fields
      `u.first_name ILIKE $${paramIndex}`,
      `u.last_name ILIKE $${paramIndex + 1}`,
      `CONCAT(u.first_name, ' ', u.last_name) ILIKE $${paramIndex + 2}`, // Full name
      `u.employee_number ILIKE $${paramIndex + 3}`,
      `u.username ILIKE $${paramIndex + 4}`,
      `u.email ILIKE $${paramIndex + 5}`,
      // Organization fields
      `d.name ILIKE $${paramIndex + 6}`, // Department name
      `a.name ILIKE $${paramIndex + 7}`, // Area name
      `t.name ILIKE $${paramIndex + 8}`, // Team name
      // Log fields
      `rl.action ILIKE $${paramIndex + 9}`,
      `rl.entity_type ILIKE $${paramIndex + 10}`,
    ];
    conditions.push(`(${searchFields.join(' OR ')})`);

    const searchPattern = `%${search}%`;
    // Push 11 params for 11 search fields
    params.push(
      searchPattern, searchPattern, searchPattern, searchPattern,
      searchPattern, searchPattern, searchPattern, searchPattern,
      searchPattern, searchPattern, searchPattern,
    );
  }

  /**
   * Build WHERE clause conditions for logs query
   * Always excludes soft-deleted logs (is_active = 4)
   */
  private buildWhereClause(filters: LogsFilterParams): { whereClause: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    const { userId, tenantId, action, entityType, startDate, endDate, search } = filters;

    // ALWAYS filter out soft-deleted logs (is_active = 4)
    // NULL = normal/active, 4 = soft deleted
    conditions.push('(rl.is_active IS NULL OR rl.is_active != 4)');

    // Add simple filter conditions with PostgreSQL dynamic $N placeholders
    const filterFields = [
      { value: userId, field: 'rl.user_id' },
      { value: tenantId, field: 'rl.tenant_id' },
      { value: action, field: 'rl.action' },
      { value: entityType, field: 'rl.entity_type' },
      { value: startDate, field: 'rl.created_at', operator: '>=' },
      { value: endDate, field: 'rl.created_at', operator: '<=' },
    ];

    filterFields.forEach(({ value, field, operator = '=' }: { value: unknown; field: string; operator?: string }) => {
      if (value === undefined || value === '') return;
      const paramIndex = params.length + 1;
      conditions.push(`${field} ${operator} $${paramIndex}`);
      params.push(value);
    });

    // Add search condition
    this.addSearchCondition(search, conditions, params);

    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';
    logger.info(`[Logs v2 Service] Built WHERE clause: ${whereClause}`);
    logger.info(`[Logs v2 Service] Query params:`, params);

    return { whereClause, params };
  }

  /**
   * Get total count of logs matching filters
   * Includes JOINs to users, departments, areas, teams for search functionality
   */
  private async getLogsCount(whereClause: string, params: unknown[]): Promise<number> {
    // Must include all JOINs since WHERE clause may reference d.*, a.*, t.* fields when searching
    const countQuery = `SELECT COUNT(DISTINCT rl.id) as total
      FROM root_logs rl
      LEFT JOIN users u ON rl.user_id = u.id
      LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.is_primary = true
      LEFT JOIN departments d ON ud.department_id = d.id
      LEFT JOIN areas a ON d.area_id = a.id
      LEFT JOIN user_teams ut ON u.id = ut.user_id
      LEFT JOIN teams t ON ut.team_id = t.id
      WHERE ${whereClause}`;
    logger.info(`[Logs v2 Service] Count query: ${countQuery}`);

    const [countResult] = await executeQuery<RowDataPacket[]>(countQuery, params);
    const total = Number((countResult[0] as { total: string | number }).total);
    logger.info(`[Logs v2 Service] Total count: ${total}`);

    return total;
  }

  /**
   * Get paginated logs from database
   * PostgreSQL: Dynamic $N parameter numbering based on WHERE clause params
   * Includes JOINs for department, area, team search
   */
  private async getLogRecords(
    whereClause: string,
    params: unknown[],
    limit: number,
    offset: number,
  ): Promise<DbLogRow[]> {
    // Dynamic parameter indexes: LIMIT comes after WHERE params, OFFSET after LIMIT
    const limitParamIndex = params.length + 1;
    const offsetParamIndex = params.length + 2;

    // Use subquery to get distinct log IDs first, then join for full data
    // This prevents duplicate rows from multiple team memberships
    const logsQuery = `SELECT DISTINCT ON (rl.id)
        rl.*,
        u.username as user_name,
        u.email as user_email,
        u.role as user_role,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.employee_number as employee_number,
        ten.company_name as tenant_name,
        d.name as department_name,
        a.name as area_name,
        t.name as team_name
       FROM root_logs rl
       LEFT JOIN users u ON rl.user_id = u.id
       LEFT JOIN tenants ten ON rl.tenant_id = ten.id
       LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.is_primary = true
       LEFT JOIN departments d ON ud.department_id = d.id
       LEFT JOIN areas a ON d.area_id = a.id
       LEFT JOIN user_teams ut ON u.id = ut.user_id
       LEFT JOIN teams t ON ut.team_id = t.id
       WHERE ${whereClause}
       ORDER BY rl.id DESC, rl.created_at DESC
       LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`;

    logger.info(`[Logs v2 Service] Logs query: ${logsQuery}`);
    logger.info(`[Logs v2 Service] Logs query params:`, [...params, limit, offset]);

    const [logs] = await executeQuery<DbLogRow[]>(logsQuery, [...params, limit, offset]);

    return logs;
  }

  /**
   * Get paginated logs with filters (Root only)
   * @param filters - The filter criteria
   */
  async getLogs(filters: LogsFilterParams): Promise<LogsListResponse> {
    logger.info('[Logs v2 Service] getLogs called with filters:', filters);

    const { page = 1, limit = 50 } = filters;
    const offset = (page - 1) * limit;
    logger.info(
      `[Logs v2 Service] Calculated offset: ${offset} from page: ${page}, limit: ${limit}`,
    );

    const { whereClause, params } = this.buildWhereClause(filters);

    try {
      const total = await this.getLogsCount(whereClause, params);
      const logs = await this.getLogRecords(whereClause, params, limit, offset);

      return {
        logs: logs.map((log: DbLogRow) => this.formatLogResponse(log)),
        pagination: {
          total,
          page,
          limit,
          offset,
          totalPages: Math.ceil(total / limit),
          hasMore: offset + limit < total,
        },
      };
    } catch (error: unknown) {
      logger.error('[Logs v2 Service] Error fetching logs - Detailed error:', error);
      logger.error('[Logs v2 Service] Error stack:', (error as Error).stack);
      logger.error('[Logs v2 Service] Query params were:', { whereClause, params, limit, offset });
      throw error;
    }
  }

  /**
   * Get basic stats query result (excludes soft-deleted logs)
   */
  private async getBasicStats(tenantId: number): Promise<StatsRow[]> {
    const [rows] = await executeQuery<StatsRow[]>(
      `SELECT COUNT(*) as total_logs, COUNT(DISTINCT user_id) as unique_users,
       COUNT(DISTINCT tenant_id) as unique_tenants,
       SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 ELSE 0 END) as today_logs
       FROM root_logs WHERE tenant_id = $1 AND (is_active IS NULL OR is_active != 4)`,
      [tenantId],
    );
    return rows;
  }

  /**
   * Get top actions query result (excludes soft-deleted logs)
   */
  private async getTopActions(tenantId: number): Promise<TopActionResult[]> {
    const [rows] = await executeQuery<TopActionResult[]>(
      `SELECT action, COUNT(*) as count FROM root_logs
       WHERE tenant_id = $1 AND (is_active IS NULL OR is_active != 4)
       GROUP BY action ORDER BY count DESC LIMIT 10`,
      [tenantId],
    );
    return rows;
  }

  /**
   * Get top users query result (excludes soft-deleted logs)
   */
  private async getTopUsers(tenantId: number): Promise<TopUserResult[]> {
    const [rows] = await executeQuery<TopUserResult[]>(
      `SELECT rl.user_id, u.username as user_name, COUNT(*) as count
       FROM root_logs rl LEFT JOIN users u ON rl.user_id = u.id
       WHERE rl.tenant_id = $1 AND (rl.is_active IS NULL OR rl.is_active != 4)
       GROUP BY rl.user_id, u.username ORDER BY count DESC LIMIT 10`,
      [tenantId],
    );
    return rows;
  }

  /**
   * Get log statistics (Root only) - filtered by tenant
   */
  async getStats(tenantId: number): Promise<LogsStatsResponse> {
    try {
      const [basicStats, topActions, topUsers] = await Promise.all([
        this.getBasicStats(tenantId),
        this.getTopActions(tenantId),
        this.getTopUsers(tenantId),
      ]);

      const stats = basicStats[0];
      if (stats === undefined) {
        return { totalLogs: 0, todayLogs: 0, uniqueUsers: 0, uniqueTenants: 0, topActions: [], topUsers: [] };
      }

      return {
        totalLogs: stats.total_logs ?? 0,
        todayLogs: stats.today_logs ?? 0,
        uniqueUsers: stats.unique_users ?? 0,
        uniqueTenants: stats.unique_tenants ?? 0,
        topActions: topActions.map((r: TopActionResult) => ({ action: r.action ?? 'unknown', count: r.count ?? 0 })),
        topUsers: topUsers.map((r: TopUserResult) => ({ userId: r.user_id ?? 0, userName: r.user_name ?? 'Unknown', count: r.count ?? 0 })),
      };
    } catch (error: unknown) {
      logger.error('[Logs v2] Error fetching stats:', error);
      throw error;
    }
  }

  /**
   * Build delete filter conditions
   */
  private buildDeleteConditions(filters: {
    userId?: number;
    tenantId?: number;
    olderThanDays?: number;
    action?: string;
    entityType?: string;
  }): { conditions: string[]; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.userId !== undefined) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(filters.userId);
    }
    if (filters.tenantId !== undefined) {
      conditions.push(`tenant_id = $${paramIndex++}`);
      params.push(filters.tenantId);
    }
    if (filters.action !== undefined && filters.action !== '') {
      conditions.push(`action = $${paramIndex++}`);
      params.push(filters.action);
    }
    if (filters.entityType !== undefined && filters.entityType !== '') {
      conditions.push(`entity_type = $${paramIndex++}`);
      params.push(filters.entityType);
    }

    return { conditions, params };
  }

  /**
   * Soft delete logs with filters (Root only)
   * Sets is_active = 4 instead of hard delete (audit logs should NEVER be permanently deleted)
   *
   * is_active values:
   *   NULL = normal/active (default, shown in UI)
   *   4 = deleted (soft delete, hidden from UI)
   *
   * When search is provided, uses subquery with JOINs to find matching logs
   * across users, departments, areas, teams tables.
   */
  async deleteLogs(filters: {
    userId?: number;
    tenantId?: number;
    olderThanDays?: number;
    action?: string;
    entityType?: string;
    search?: string;
  }): Promise<number> {
    logger.info('[Logs v2 Service] deleteLogs (soft delete) called with filters:', filters);

    // If search is provided, use subquery approach with JOINs
    if (filters.search !== undefined && filters.search !== '') {
      return await this.deleteLogsWithSearch(filters);
    }

    // Standard deletion without search - simple UPDATE without JOINs
    const { conditions, params } = this.buildDeleteConditions(filters);

    // Handle olderThanDays: 0 means delete ALL, >0 means older than N days
    if (filters.olderThanDays !== undefined) {
      if (filters.olderThanDays === 0) {
        conditions.push('1=1');
      } else {
        const paramIndex = params.length + 1;
        conditions.push(`created_at < NOW() - ($${paramIndex} * INTERVAL '1 day')`);
        params.push(filters.olderThanDays);
      }
    }

    // Only soft-delete logs that are not already deleted
    conditions.push('(is_active IS NULL OR is_active != 4)');

    if (conditions.length === 0) {
      throw new Error('At least one filter must be provided for deletion');
    }

    try {
      // SOFT DELETE: Set is_active = 4 instead of DELETE
      const [result] = await executeQuery<ResultSetHeader>(
        `UPDATE root_logs SET is_active = 4 WHERE ${conditions.join(' AND ')}`,
        params,
      );
      logger.info(`[Logs v2 Service] Soft deleted ${result.affectedRows} logs`);
      return result.affectedRows;
    } catch (error: unknown) {
      logger.error('[Logs v2] Error soft deleting logs:', error);
      throw error;
    }
  }

  /**
   * Delete logs with search filter using subquery approach
   * Required because search spans multiple tables (users, departments, areas, teams)
   */
  private async deleteLogsWithSearch(filters: {
    userId?: number;
    tenantId?: number;
    olderThanDays?: number;
    action?: string;
    entityType?: string;
    search?: string;
  }): Promise<number> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    // Build search conditions using existing helper
    if (filters.search !== undefined && filters.search !== '') {
      this.addSearchCondition(filters.search, conditions, params);
    }

    // Add basic filters with rl. prefix for subquery (compact pattern)
    const filterFields = [
      { value: filters.userId, field: 'rl.user_id' },
      { value: filters.tenantId, field: 'rl.tenant_id' },
      { value: filters.action, field: 'rl.action' },
      { value: filters.entityType, field: 'rl.entity_type' },
    ];
    filterFields.forEach(({ value, field }: { value: unknown; field: string }) => {
      if (value === undefined || value === '') return;
      const paramIndex = params.length + 1;
      conditions.push(`${field} = $${paramIndex}`);
      params.push(value);
    });

    // Handle olderThanDays (0 = delete all matching, >0 = older than N days)
    if (filters.olderThanDays !== undefined && filters.olderThanDays > 0) {
      const paramIndex = params.length + 1;
      conditions.push(`rl.created_at < NOW() - ($${paramIndex} * INTERVAL '1 day')`);
      params.push(filters.olderThanDays);
    }

    // Only soft-delete logs that are not already deleted
    conditions.push('(rl.is_active IS NULL OR rl.is_active != 4)');

    const whereClause = conditions.join(' AND ');
    const deleteQuery = `UPDATE root_logs SET is_active = 4 WHERE id IN (
      SELECT DISTINCT rl.id FROM root_logs rl
      LEFT JOIN users u ON rl.user_id = u.id
      LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.is_primary = true
      LEFT JOIN departments d ON ud.department_id = d.id
      LEFT JOIN areas a ON d.area_id = a.id
      LEFT JOIN user_teams ut ON u.id = ut.user_id
      LEFT JOIN teams t ON ut.team_id = t.id
      WHERE ${whereClause})`;
    logger.info('[Logs v2 Service] Delete with search:', { query: deleteQuery, params });

    try {
      const [result] = await executeQuery<ResultSetHeader>(deleteQuery, params);
      logger.info(`[Logs v2 Service] Soft deleted ${result.affectedRows} logs (with search filter)`);
      return result.affectedRows;
    } catch (error: unknown) {
      logger.error('[Logs v2] Error soft deleting logs with search:', error);
      throw error;
    }
  }

  /**
   * Apply user-related optional fields from DB row to response
   */
  private applyUserFields(response: LogsResponse, log: DbLogRow): void {
    if (log.user_name !== undefined) response.userName = log.user_name;
    if (log.user_email !== undefined) response.userEmail = log.user_email;
    if (log.user_role !== undefined) response.userRole = log.user_role;
    if (log.user_first_name !== undefined) response.userFirstName = log.user_first_name;
    if (log.user_last_name !== undefined) response.userLastName = log.user_last_name;
    if (log.employee_number !== undefined) response.employeeNumber = log.employee_number;
  }

  /**
   * Apply context-related optional fields from DB row to response
   */
  private applyContextFields(response: LogsResponse, log: DbLogRow): void {
    if (log.tenant_name !== undefined) response.tenantName = log.tenant_name;
    if (log.entity_type !== undefined) response.entityType = log.entity_type;
    if (log.entity_id !== undefined) response.entityId = log.entity_id;
    if (log.ip_address !== undefined) response.ipAddress = log.ip_address;
    if (log.user_agent !== undefined) response.userAgent = log.user_agent;
    // Organization context
    if (log.department_name !== undefined) response.departmentName = log.department_name;
    if (log.area_name !== undefined) response.areaName = log.area_name;
    if (log.team_name !== undefined) response.teamName = log.team_name;
  }

  /**
   * Parse JSON values if needed
   */
  private parseJsonValue(value: string | Record<string, unknown>): Record<string, unknown> {
    return typeof value === 'string' ? (JSON.parse(value) as Record<string, unknown>) : value;
  }

  /**
   * Format database log to API response
   */
  private formatLogResponse(log: DbLogRow): LogsResponse {
    // Handle null/undefined created_at safely
    const createdAtValue = log.created_at != null
      ? (log.created_at instanceof Date ? log.created_at.toISOString() : String(log.created_at))
      : new Date().toISOString();

    const response: LogsResponse = {
      id: log.id,
      tenantId: log.tenant_id,
      userId: log.user_id,
      action: log.action,
      wasRoleSwitched: Boolean(log.was_role_switched),
      createdAt: createdAtValue,
    };

    this.applyUserFields(response, log);
    this.applyContextFields(response, log);

    if (log.old_values !== undefined) response.oldValues = this.parseJsonValue(log.old_values);
    if (log.new_values !== undefined) response.newValues = this.parseJsonValue(log.new_values);

    return response;
  }

  // ===== CREATE LOG METHODS (migrated from models/rootLog.ts) =====

  /**
   * Create a new root log entry
   * @param logData - The log data to insert
   * @returns The ID of the created log entry
   */
  async createLog(logData: RootLogCreateData): Promise<number> {
    const {
      user_id: userId,
      action,
      ip_address: ipAddress,
      tenant_id: tenantId,
      entity_type: entityType,
      entity_id: entityId,
      details,
      old_values: oldValues,
      new_values: newValues,
      user_agent: userAgent,
      was_role_switched: wasRoleSwitched,
    } = logData;

    const sql = `INSERT INTO root_logs (tenant_id, user_id, action, entity_type, entity_id, details, old_values, new_values, ip_address, user_agent, was_role_switched)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`;

    try {
      const [result] = await executeQuery<ResultSetHeader>(sql, [
        tenantId,
        userId,
        action,
        entityType ?? null,
        entityId ?? null,
        details ?? null,
        oldValues !== undefined ? JSON.stringify(oldValues) : null,
        newValues !== undefined ? JSON.stringify(newValues) : null,
        ipAddress ?? null,
        userAgent ?? null,
        wasRoleSwitched ?? false,
      ]);
      return result.insertId;
    } catch (error: unknown) {
      logger.error(`[Logs Service] Error creating root log: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Convenience method for simple logging
   * @param action - The action being logged
   * @param userId - The user performing the action
   * @param tenantId - The tenant ID
   * @param details - Optional details about the action
   * @returns The ID of the created log entry
   */
  async logAction(
    action: string,
    userId: number,
    tenantId: number,
    details?: string | Record<string, unknown>,
  ): Promise<number> {
    const logData: RootLogCreateData = {
      user_id: userId,
      tenant_id: tenantId,
      action,
      new_values: typeof details === 'string' ? { details } : details,
    };
    return await this.createLog(logData);
  }

  /**
   * Get logs by user ID (excludes soft-deleted logs)
   * @param userId - The user ID
   * @param days - Optional: Only get logs from the last X days (0 = all)
   * @returns Array of log entries
   */
  async getLogsByUserId(userId: number, days?: number): Promise<DbRootLog[]> {
    const effectiveDays: number = days ?? 0;
    let sql = `SELECT * FROM root_logs WHERE user_id = $1 AND (is_active IS NULL OR is_active != 4)`;
    const params: unknown[] = [userId];

    if (effectiveDays > 0) {
      sql += ` AND created_at >= NOW() - ($2 * INTERVAL '1 day')`;
      params.push(effectiveDays);
    }

    sql += ` ORDER BY created_at DESC`;

    try {
      const [rows] = await executeQuery<DbRootLogRow[]>(sql, params);
      return rows;
    } catch (error: unknown) {
      logger.error(`[Logs Service] Error fetching logs for user ${userId}: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Get the last login record for a user (excludes soft-deleted logs)
   * @param userId - The user ID
   * @returns The last login record or null if not found
   */
  async getLastLogin(userId: number): Promise<DbRootLog | null> {
    const sql = `SELECT * FROM root_logs
                 WHERE user_id = $1 AND action = 'login' AND (is_active IS NULL OR is_active != 4)
                 ORDER BY created_at DESC LIMIT 1`;

    try {
      const [rows] = await executeQuery<DbRootLogRow[]>(sql, [userId]);
      const row = rows[0];
      return row !== undefined ? row : null;
    } catch (error: unknown) {
      logger.error(`[Logs Service] Error fetching last login for user ${userId}: ${(error as Error).message}`);
      throw error;
    }
  }
}

export const logsService = new LogsService();

// ===== NAMED EXPORTS for easy import =====
// These wrap the service methods for backward compatibility

/**
 * Create a root log entry
 * @param logData - The log data
 * @returns The created log ID
 */
export async function createRootLog(logData: RootLogCreateData): Promise<number> {
  return await logsService.createLog(logData);
}

/**
 * Convenience function for simple logging
 * @param action - The action
 * @param userId - The user ID
 * @param tenantId - The tenant ID
 * @param details - Optional details
 * @returns The created log ID
 */
export async function logRootAction(
  action: string,
  userId: number,
  tenantId: number,
  details?: string | Record<string, unknown>,
): Promise<number> {
  return await logsService.logAction(action, userId, tenantId, details);
}

/**
 * Get logs by user ID
 * @param userId - The user ID
 * @param days - Optional days filter
 * @returns Array of logs
 */
export async function getRootLogsByUserId(userId: number, days?: number): Promise<DbRootLog[]> {
  return await logsService.getLogsByUserId(userId, days);
}

/**
 * Get last login for a user
 * @param userId - The user ID
 * @returns Last login record or null
 */
export async function getLastRootLogin(userId: number): Promise<DbRootLog | null> {
  return await logsService.getLastLogin(userId);
}

// Backward compatibility object (for `import rootLog from ...` pattern)
const rootLog = {
  log: logRootAction,
  create: createRootLog,
  getByUserId: getRootLogsByUserId,
  getLastLogin: getLastRootLogin,
};

export default rootLog;
