import { RowDataPacket, ResultSetHeader } from "mysql2";
import { query as executeQuery } from "../../../utils/db.js";
import { logger } from "../../../utils/logger.js";
import type { LogsResponse, LogsListResponse, LogsFilterParams, LogsStatsResponse } from "./types.js";

interface DbLogRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  tenant_name?: string;
  user_id: number;
  user_name?: string;
  user_email?: string;
  user_role?: string;
  action: string;
  entity_type?: string;
  entity_id?: number;
  old_values?: string;
  new_values?: string;
  ip_address?: string;
  user_agent?: string;
  was_role_switched: number;
  created_at: Date;
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

/**
 *
 */
export class LogsService {
  /**
   * Add search condition to query
   */
  private addSearchCondition(
    search: string | undefined,
    conditions: string[],
    params: unknown[]
  ): void {
    if (search === undefined || search === "") return;

    conditions.push('(u.username LIKE ? OR u.email LIKE ? OR rl.action LIKE ? OR rl.entity_type LIKE ?)');
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  /**
   * Add filter condition to query
   */
  private addFilterCondition(
    value: unknown,
    condition: string,
    conditions: string[],
    params: unknown[]
  ): void {
    if (value === undefined || value === "") return;
    conditions.push(condition);
    params.push(value);
  }

  /**
   * Build WHERE clause conditions for logs query
   */
  private buildWhereClause(filters: LogsFilterParams): { whereClause: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    const { userId, tenantId, action, entityType, startDate, endDate, search } = filters;

    // Add simple filter conditions
    const filterMappings = [
      { value: userId, condition: 'rl.user_id = ?' },
      { value: tenantId, condition: 'rl.tenant_id = ?' },
      { value: action, condition: 'rl.action = ?' },
      { value: entityType, condition: 'rl.entity_type = ?' },
      { value: startDate, condition: 'rl.created_at >= ?' },
      { value: endDate, condition: 'rl.created_at <= ?' },
    ];

    filterMappings.forEach(({ value, condition }) => {
      this.addFilterCondition(value, condition, conditions, params);
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
   */
  private async getLogsCount(whereClause: string, params: unknown[]): Promise<number> {
    const countQuery = `SELECT COUNT(*) as total FROM root_logs rl WHERE ${whereClause}`;
    logger.info(`[Logs v2 Service] Count query: ${countQuery}`);

    const [countResult] = await executeQuery<RowDataPacket[]>(countQuery, params);
    const total = (countResult[0] as { total: number }).total;
    logger.info(`[Logs v2 Service] Total count: ${total}`);

    return total;
  }

  /**
   * Get paginated logs from database
   */
  private async getLogRecords(
    whereClause: string,
    params: unknown[],
    limit: number,
    offset: number
  ): Promise<DbLogRow[]> {
    const logsQuery = `SELECT
        rl.*,
        u.username as user_name,
        u.email as user_email,
        u.role as user_role,
        t.company_name as tenant_name
       FROM root_logs rl
       LEFT JOIN users u ON rl.user_id = u.id
       LEFT JOIN tenants t ON rl.tenant_id = t.id
       WHERE ${whereClause}
       ORDER BY rl.created_at DESC
       LIMIT ? OFFSET ?`;

    logger.info(`[Logs v2 Service] Logs query: ${logsQuery}`);
    logger.info(`[Logs v2 Service] Logs query params:`, [...params, limit, offset]);

    const [logs] = await executeQuery<DbLogRow[]>(
      logsQuery,
      [...params, limit, offset]
    );

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
    logger.info(`[Logs v2 Service] Calculated offset: ${offset} from page: ${page}, limit: ${limit}`);

    const { whereClause, params } = this.buildWhereClause(filters);

    try {
      const total = await this.getLogsCount(whereClause, params);
      const logs = await this.getLogRecords(whereClause, params, limit, offset);

      return {
        logs: logs.map(log => this.formatLogResponse(log)),
        pagination: {
          total,
          page,
          limit,
          offset,
          totalPages: Math.ceil(total / limit),
          hasMore: offset + limit < total
        }
      };
    } catch (error: unknown) {
      logger.error('[Logs v2 Service] Error fetching logs - Detailed error:', error);
      logger.error('[Logs v2 Service] Error stack:', (error as Error).stack);
      logger.error('[Logs v2 Service] Query params were:', { whereClause, params, limit, offset });
      throw error;
    }
  }

  /**
   * Get log statistics (Root only) - filtered by tenant
   * @param tenantId - The tenant ID to filter by
   */
  async getStats(tenantId: number): Promise<LogsStatsResponse> {
    try {
      // Basic stats - FILTERED BY TENANT
      const [basicStats] = await executeQuery<StatsRow[]>(
        `SELECT 
          COUNT(*) as total_logs,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT tenant_id) as unique_tenants,
          SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today_logs
         FROM root_logs
         WHERE tenant_id = ?`,
        [tenantId]
      );

      // Top actions - FILTERED BY TENANT
      const [topActions] = await executeQuery<StatsRow[]>(
        `SELECT action, COUNT(*) as count 
         FROM root_logs 
         WHERE tenant_id = ?
         GROUP BY action 
         ORDER BY count DESC 
         LIMIT 10`,
        [tenantId]
      );

      // Top users - FILTERED BY TENANT
      const [topUsers] = await executeQuery<StatsRow[]>(
        `SELECT 
          rl.user_id,
          u.username as user_name,
          COUNT(*) as count
         FROM root_logs rl
         LEFT JOIN users u ON rl.user_id = u.id
         WHERE rl.tenant_id = ?
         GROUP BY rl.user_id, u.username
         ORDER BY count DESC
         LIMIT 10`,
        [tenantId]
      );

      const stats = basicStats[0];
      return {
        totalLogs: stats.total_logs ?? 0,
        todayLogs: stats.today_logs ?? 0,
        uniqueUsers: stats.unique_users ?? 0,
        uniqueTenants: stats.unique_tenants ?? 0,
        topActions: topActions.map(row => ({
          action: row.action ?? 'unknown',
          count: row.count ?? 0
        })),
        topUsers: topUsers.map(row => ({
          userId: row.user_id ?? 0,
          userName: row.user_name ?? 'Unknown',
          count: row.count ?? 0
        }))
      };
    } catch (error: unknown) {
      logger.error('[Logs v2] Error fetching stats:', error);
      throw error;
    }
  }

  /**
   * Delete logs with filters (Root only)
   * @param filters - The filter criteria
   */
  async deleteLogs(filters: {
    userId?: number;
    tenantId?: number;
    olderThanDays?: number;
    action?: string;
    entityType?: string;
  }): Promise<number> {
    logger.info('[Logs v2 Service] deleteLogs called with filters:', filters);
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.userId) {
      conditions.push('user_id = ?');
      params.push(filters.userId);
    }

    if (filters.tenantId) {
      conditions.push('tenant_id = ?');
      params.push(filters.tenantId);
    }

    if (filters.action) {
      conditions.push('action = ?');
      params.push(filters.action);
    }

    if (filters.entityType) {
      conditions.push('entity_type = ?');
      params.push(filters.entityType);
    }

    if (filters.olderThanDays !== undefined) {
      if (filters.olderThanDays === 0) {
        // olderThanDays: 0 means delete ALL logs (no age restriction)
        // Add a condition that's always true to indicate we have a valid filter
        conditions.push('1=1');
      } else {
        conditions.push('created_at < DATE_SUB(NOW(), INTERVAL ? DAY)');
        params.push(filters.olderThanDays);
      }
    }

    if (conditions.length === 0) {
      throw new Error('At least one filter must be provided for deletion');
    }

    const whereClause = conditions.join(' AND ');

    try {
      const [result] = await executeQuery<ResultSetHeader>(
        `DELETE FROM root_logs WHERE ${whereClause}`,
        params
      );
      return result.affectedRows;
    } catch (error: unknown) {
      logger.error('[Logs v2] Error deleting logs:', error);
      throw error;
    }
  }

  /**
   * Format database log to API response
   * @param log - The log parameter
   */
  private formatLogResponse(log: DbLogRow): LogsResponse {
    return {
      id: log.id,
      tenantId: log.tenant_id,
      tenantName: log.tenant_name,
      userId: log.user_id,
      userName: log.user_name,
      userEmail: log.user_email,
      userRole: log.user_role,
      action: log.action,
      entityType: log.entity_type,
      entityId: log.entity_id,
      oldValues: log.old_values ? (typeof log.old_values === 'string' ? JSON.parse(log.old_values) as Record<string, unknown> : log.old_values) : undefined,
      newValues: log.new_values ? (typeof log.new_values === 'string' ? JSON.parse(log.new_values) as Record<string, unknown> : log.new_values) : undefined,
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      wasRoleSwitched: Boolean(log.was_role_switched),
      createdAt: log.created_at.toISOString()
    };
  }
}

export const logsService = new LogsService();