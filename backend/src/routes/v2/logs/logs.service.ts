import { RowDataPacket, ResultSetHeader } from "mysql2";

import { query as executeQuery } from "../../../utils/db.js";
import { logger } from "../../../utils/logger.js";

import { LogsResponse, LogsListResponse, LogsFilterParams, LogsStatsResponse } from "./types.js";

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

export class LogsService {
  /**
   * Get paginated logs with filters (Root only)
   */
  async getLogs(filters: LogsFilterParams): Promise<LogsListResponse> {
    const {
      page = 1,
      limit = 50,
      userId,
      tenantId,
      action,
      entityType,
      startDate,
      endDate,
      search
    } = filters;

    const offset = (page - 1) * limit;
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];

    // Build WHERE conditions
    if (userId) {
      conditions.push('rl.user_id = ?');
      params.push(userId);
    }

    if (tenantId) {
      conditions.push('rl.tenant_id = ?');
      params.push(tenantId);
    }

    if (action) {
      conditions.push('rl.action = ?');
      params.push(action);
    }

    if (entityType) {
      conditions.push('rl.entity_type = ?');
      params.push(entityType);
    }

    if (startDate) {
      conditions.push('rl.created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('rl.created_at <= ?');
      params.push(endDate);
    }

    if (search) {
      conditions.push('(u.username LIKE ? OR u.email LIKE ? OR rl.action LIKE ? OR rl.entity_type LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const whereClause = conditions.join(' AND ');

    try {
      // Get total count
      const [countResult] = await executeQuery<RowDataPacket[]>(
        `SELECT COUNT(*) as total 
         FROM root_logs rl
         WHERE ${whereClause}`,
        params
      );
      const total = countResult[0].total;

      // Get paginated logs with user and tenant info
      const [logs] = await executeQuery<DbLogRow[]>(
        `SELECT 
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
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      return {
        logs: logs.map(log => this.formatLogResponse(log)),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('[Logs v2] Error fetching logs:', error);
      throw error;
    }
  }

  /**
   * Get log statistics (Root only)
   */
  async getStats(): Promise<LogsStatsResponse> {
    try {
      // Basic stats
      const [basicStats] = await executeQuery<StatsRow[]>(
        `SELECT 
          COUNT(*) as total_logs,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT tenant_id) as unique_tenants,
          SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today_logs
         FROM root_logs`
      );

      // Top actions
      const [topActions] = await executeQuery<StatsRow[]>(
        `SELECT action, COUNT(*) as count 
         FROM root_logs 
         GROUP BY action 
         ORDER BY count DESC 
         LIMIT 10`
      );

      // Top users
      const [topUsers] = await executeQuery<StatsRow[]>(
        `SELECT 
          rl.user_id,
          u.username as user_name,
          COUNT(*) as count
         FROM root_logs rl
         LEFT JOIN users u ON rl.user_id = u.id
         GROUP BY rl.user_id
         ORDER BY count DESC
         LIMIT 10`
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
    } catch (error) {
      logger.error('[Logs v2] Error fetching stats:', error);
      throw error;
    }
  }

  /**
   * Delete logs with filters (Root only)
   */
  async deleteLogs(filters: {
    userId?: number;
    tenantId?: number;
    olderThanDays?: number;
  }): Promise<number> {
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

    if (filters.olderThanDays) {
      conditions.push('created_at < DATE_SUB(NOW(), INTERVAL ? DAY)');
      params.push(filters.olderThanDays);
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
    } catch (error) {
      logger.error('[Logs v2] Error deleting logs:', error);
      throw error;
    }
  }

  /**
   * Format database log to API response
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
      oldValues: log.old_values ? JSON.parse(log.old_values) : undefined,
      newValues: log.new_values ? JSON.parse(log.new_values) : undefined,
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      wasRoleSwitched: Boolean(log.was_role_switched),
      createdAt: log.created_at.toISOString()
    };
  }
}

export const logsService = new LogsService();