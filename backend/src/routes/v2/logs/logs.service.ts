import { ResultSetHeader, RowDataPacket } from 'mysql2';

import { query as executeQuery } from '../../../utils/db.js';
import { logger } from '../../../utils/logger.js';
import type {
  LogsFilterParams,
  LogsListResponse,
  LogsResponse,
  LogsStatsResponse,
} from './types.js';

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
   */
  private addSearchCondition(
    search: string | undefined,
    conditions: string[],
    params: unknown[],
  ): void {
    if (search === undefined || search === '') return;

    conditions.push(
      '(u.username LIKE ? OR u.email LIKE ? OR rl.action LIKE ? OR rl.entity_type LIKE ?)',
    );
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
    params: unknown[],
  ): void {
    if (value === undefined || value === '') return;
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

    filterMappings.forEach(({ value, condition }: { value: unknown; condition: string }) => {
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
    offset: number,
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
   * Get basic stats query result
   */
  private async getBasicStats(tenantId: number): Promise<StatsRow[]> {
    const [rows] = await executeQuery<StatsRow[]>(
      `SELECT COUNT(*) as total_logs, COUNT(DISTINCT user_id) as unique_users,
       COUNT(DISTINCT tenant_id) as unique_tenants,
       SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today_logs
       FROM root_logs WHERE tenant_id = ?`,
      [tenantId],
    );
    return rows;
  }

  /**
   * Get top actions query result
   */
  private async getTopActions(tenantId: number): Promise<TopActionResult[]> {
    const [rows] = await executeQuery<TopActionResult[]>(
      `SELECT action, COUNT(*) as count FROM root_logs WHERE tenant_id = ?
       GROUP BY action ORDER BY count DESC LIMIT 10`,
      [tenantId],
    );
    return rows;
  }

  /**
   * Get top users query result
   */
  private async getTopUsers(tenantId: number): Promise<TopUserResult[]> {
    const [rows] = await executeQuery<TopUserResult[]>(
      `SELECT rl.user_id, u.username as user_name, COUNT(*) as count
       FROM root_logs rl LEFT JOIN users u ON rl.user_id = u.id
       WHERE rl.tenant_id = ? GROUP BY rl.user_id, u.username ORDER BY count DESC LIMIT 10`,
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

    if (filters.userId !== undefined) {
      conditions.push('user_id = ?');
      params.push(filters.userId);
    }
    if (filters.tenantId !== undefined) {
      conditions.push('tenant_id = ?');
      params.push(filters.tenantId);
    }
    if (filters.action !== undefined && filters.action !== '') {
      conditions.push('action = ?');
      params.push(filters.action);
    }
    if (filters.entityType !== undefined && filters.entityType !== '') {
      conditions.push('entity_type = ?');
      params.push(filters.entityType);
    }

    return { conditions, params };
  }

  /**
   * Delete logs with filters (Root only)
   */
  async deleteLogs(filters: {
    userId?: number;
    tenantId?: number;
    olderThanDays?: number;
    action?: string;
    entityType?: string;
  }): Promise<number> {
    logger.info('[Logs v2 Service] deleteLogs called with filters:', filters);
    const { conditions, params } = this.buildDeleteConditions(filters);

    // Handle olderThanDays: 0 means delete ALL, >0 means older than N days
    if (filters.olderThanDays !== undefined) {
      if (filters.olderThanDays === 0) {
        conditions.push('1=1');
      } else {
        conditions.push('created_at < DATE_SUB(NOW(), INTERVAL ? DAY)');
        params.push(filters.olderThanDays);
      }
    }

    if (conditions.length === 0) {
      throw new Error('At least one filter must be provided for deletion');
    }

    try {
      const [result] = await executeQuery<ResultSetHeader>(
        `DELETE FROM root_logs WHERE ${conditions.join(' AND ')}`,
        params,
      );
      return result.affectedRows;
    } catch (error: unknown) {
      logger.error('[Logs v2] Error deleting logs:', error);
      throw error;
    }
  }

  /**
   * Apply optional string fields from DB row to response
   */
  private applyOptionalLogFields(response: LogsResponse, log: DbLogRow): void {
    if (log.tenant_name !== undefined) response.tenantName = log.tenant_name;
    if (log.user_name !== undefined) response.userName = log.user_name;
    if (log.user_email !== undefined) response.userEmail = log.user_email;
    if (log.user_role !== undefined) response.userRole = log.user_role;
    if (log.entity_type !== undefined) response.entityType = log.entity_type;
    if (log.entity_id !== undefined) response.entityId = log.entity_id;
    if (log.ip_address !== undefined) response.ipAddress = log.ip_address;
    if (log.user_agent !== undefined) response.userAgent = log.user_agent;
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
    const response: LogsResponse = {
      id: log.id,
      tenantId: log.tenant_id,
      userId: log.user_id,
      action: log.action,
      wasRoleSwitched: Boolean(log.was_role_switched),
      createdAt: log.created_at.toISOString(),
    };

    this.applyOptionalLogFields(response, log);

    if (log.old_values !== undefined) response.oldValues = this.parseJsonValue(log.old_values);
    if (log.new_values !== undefined) response.newValues = this.parseJsonValue(log.new_values);

    return response;
  }
}

export const logsService = new LogsService();
