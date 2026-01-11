/**
 * Logs Service
 *
 * Native NestJS implementation for system audit logs.
 * No Express dependencies - uses DatabaseService directly.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';

import { DatabaseService } from '../database/database.service.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import type {
  DeleteLogsBodyDto,
  DeleteLogsResponseData,
  LogsListResponseData,
  LogsStatsResponseData,
} from './dto/index.js';

// ============================================================
// DATABASE ROW TYPES
// ============================================================

interface DbLogRow {
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
  is_active?: number;
  created_at: Date | null;
}

interface StatsRow {
  total_logs?: number;
  today_logs?: number;
  unique_users?: number;
  unique_tenants?: number;
}

interface TopActionResult {
  action: string | null;
  count: number | null;
}

interface TopUserResult {
  user_id: number | null;
  user_name: string | null;
  count: number | null;
}

interface DbUserRow {
  id: number;
  password: string;
}

// ============================================================
// RESPONSE TYPES
// ============================================================

interface LogsResponse {
  id: number;
  tenantId: number;
  userId: number;
  action: string;
  wasRoleSwitched: boolean;
  createdAt: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  userFirstName?: string;
  userLastName?: string;
  employeeNumber?: string;
  tenantName?: string;
  entityType?: string;
  entityId?: number;
  ipAddress?: string;
  userAgent?: string;
  departmentName?: string;
  areaName?: string;
  teamName?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

// ============================================================
// FILTER TYPES
// ============================================================

interface DeleteFilterOutput {
  userId?: number | undefined;
  tenantId: number;
  olderThanDays?: number | undefined;
  action?: string | undefined;
  entityType?: string | undefined;
  search?: string | undefined;
}

interface LogsFilterParams {
  page?: number | undefined;
  limit?: number | undefined;
  tenantId: number;
  userId?: number | undefined;
  action?: string | undefined;
  entityType?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  search?: string | undefined;
}

// ============================================================
// SERVICE IMPLEMENTATION
// ============================================================

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  // ============================================================
  // ACCESS CONTROL
  // ============================================================

  /**
   * Verify user has root role
   */
  private verifyRootAccess(currentUser: NestAuthUser): void {
    if (currentUser.role !== 'root') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only root users can access logs',
      });
    }
  }

  /**
   * Verify user password for destructive operations
   */
  private async verifyPassword(currentUser: NestAuthUser, password: string): Promise<void> {
    const users = await this.databaseService.query<DbUserRow>(
      'SELECT id, password FROM users WHERE id = $1 AND tenant_id = $2',
      [currentUser.id, currentUser.tenantId],
    );

    if (users.length === 0 || users[0] === undefined) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'User not found',
      });
    }

    const isValidPassword = await bcrypt.compare(password, users[0].password);
    if (!isValidPassword) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid password',
      });
    }
  }

  // ============================================================
  // QUERY BUILDING
  // ============================================================

  /**
   * Add search condition to query
   */
  private addSearchCondition(
    search: string | undefined,
    conditions: string[],
    params: unknown[],
  ): void {
    if (search === undefined || search === '') return;

    const paramIndex = params.length + 1;
    const searchFields = [
      `u.first_name ILIKE $${paramIndex}`,
      `u.last_name ILIKE $${paramIndex + 1}`,
      `CONCAT(u.first_name, ' ', u.last_name) ILIKE $${paramIndex + 2}`,
      `u.employee_number ILIKE $${paramIndex + 3}`,
      `u.username ILIKE $${paramIndex + 4}`,
      `u.email ILIKE $${paramIndex + 5}`,
      `d.name ILIKE $${paramIndex + 6}`,
      `a.name ILIKE $${paramIndex + 7}`,
      `t.name ILIKE $${paramIndex + 8}`,
      `rl.action ILIKE $${paramIndex + 9}`,
      `rl.entity_type ILIKE $${paramIndex + 10}`,
    ];
    conditions.push(`(${searchFields.join(' OR ')})`);

    const searchPattern = `%${search}%`;
    // Push 11 params for 11 search fields
    for (let i = 0; i < 11; i++) {
      params.push(searchPattern);
    }
  }

  /**
   * Build WHERE clause conditions for logs query
   */
  private buildWhereClause(filters: LogsFilterParams): { whereClause: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    // Always filter out soft-deleted logs (is_active = 4)
    conditions.push('(rl.is_active IS NULL OR rl.is_active != 4)');

    // Add filter conditions
    const filterFields: { value: unknown; field: string; operator?: string }[] = [
      { value: filters.userId, field: 'rl.user_id' },
      { value: filters.tenantId, field: 'rl.tenant_id' },
      { value: filters.action, field: 'rl.action' },
      { value: filters.entityType, field: 'rl.entity_type' },
      { value: filters.startDate, field: 'rl.created_at', operator: '>=' },
      { value: filters.endDate, field: 'rl.created_at', operator: '<=' },
    ];

    for (const { value, field, operator = '=' } of filterFields) {
      if (value === undefined || value === '') continue;
      const paramIndex = params.length + 1;
      conditions.push(`${field} ${operator} $${paramIndex}`);
      params.push(value);
    }

    // Add search condition
    this.addSearchCondition(filters.search, conditions, params);

    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';
    return { whereClause, params };
  }

  /**
   * Get total count of logs matching filters
   */
  private async getLogsCount(whereClause: string, params: unknown[]): Promise<number> {
    const countQuery = `SELECT COUNT(DISTINCT rl.id) as total
      FROM root_logs rl
      LEFT JOIN users u ON rl.user_id = u.id
      LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.is_primary = true
      LEFT JOIN departments d ON ud.department_id = d.id
      LEFT JOIN areas a ON d.area_id = a.id
      LEFT JOIN user_teams ut ON u.id = ut.user_id
      LEFT JOIN teams t ON ut.team_id = t.id
      WHERE ${whereClause}`;

    const result = await this.databaseService.query<{ total: string }>(countQuery, params);
    return Number.parseInt(result[0]?.total ?? '0', 10);
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
    const limitParamIndex = params.length + 1;
    const offsetParamIndex = params.length + 2;

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

    return await this.databaseService.query<DbLogRow>(logsQuery, [...params, limit, offset]);
  }

  // ============================================================
  // RESPONSE FORMATTING
  // ============================================================

  /**
   * Parse JSON value if needed
   */
  private parseJsonValue(value: string | Record<string, unknown>): Record<string, unknown> {
    return typeof value === 'string' ? (JSON.parse(value) as Record<string, unknown>) : value;
  }

  /**
   * Format created_at to ISO string
   */
  private formatCreatedAt(createdAt: Date | null): string {
    if (createdAt === null) {
      return new Date().toISOString();
    }
    return createdAt instanceof Date ? createdAt.toISOString() : String(createdAt);
  }

  /**
   * Build optional user fields from log row
   */
  private buildUserFields(log: DbLogRow): Partial<LogsResponse> {
    const fields: Partial<LogsResponse> = {};
    if (log.user_name !== undefined) fields.userName = log.user_name;
    if (log.user_email !== undefined) fields.userEmail = log.user_email;
    if (log.user_role !== undefined) fields.userRole = log.user_role;
    if (log.user_first_name !== undefined) fields.userFirstName = log.user_first_name;
    if (log.user_last_name !== undefined) fields.userLastName = log.user_last_name;
    if (log.employee_number !== undefined) fields.employeeNumber = log.employee_number;
    return fields;
  }

  /**
   * Build optional context fields from log row
   */
  private buildContextFields(log: DbLogRow): Partial<LogsResponse> {
    const fields: Partial<LogsResponse> = {};
    if (log.tenant_name !== undefined) fields.tenantName = log.tenant_name;
    if (log.entity_type !== undefined) fields.entityType = log.entity_type;
    if (log.entity_id !== undefined) fields.entityId = log.entity_id;
    if (log.ip_address !== undefined) fields.ipAddress = log.ip_address;
    if (log.user_agent !== undefined) fields.userAgent = log.user_agent;
    if (log.department_name !== undefined) fields.departmentName = log.department_name;
    if (log.area_name !== undefined) fields.areaName = log.area_name;
    if (log.team_name !== undefined) fields.teamName = log.team_name;
    if (log.old_values !== undefined) fields.oldValues = this.parseJsonValue(log.old_values);
    if (log.new_values !== undefined) fields.newValues = this.parseJsonValue(log.new_values);
    return fields;
  }

  /**
   * Format database log to API response
   */
  private formatLogResponse(log: DbLogRow): LogsResponse {
    return {
      id: log.id,
      tenantId: log.tenant_id,
      userId: log.user_id,
      action: log.action,
      wasRoleSwitched: Boolean(log.was_role_switched),
      createdAt: this.formatCreatedAt(log.created_at),
      ...this.buildUserFields(log),
      ...this.buildContextFields(log),
    };
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  /**
   * Get logs with filters
   */
  async getLogs(
    currentUser: NestAuthUser,
    query: {
      page?: number | undefined;
      limit?: number | undefined;
      userId?: number | undefined;
      action?: string | undefined;
      entityType?: string | undefined;
      startDate?: string | undefined;
      endDate?: string | undefined;
      search?: string | undefined;
      offset?: number | undefined;
    },
  ): Promise<LogsListResponseData> {
    this.verifyRootAccess(currentUser);

    const limit = query.limit ?? 50;
    let page = query.page ?? 1;

    if (query.offset !== undefined) {
      page = Math.floor(query.offset / limit) + 1;
    }

    const filters: LogsFilterParams = {
      page,
      limit,
      tenantId: currentUser.tenantId,
    };

    if (query.userId !== undefined) filters.userId = query.userId;
    if (query.action !== undefined) filters.action = query.action;
    if (query.entityType !== undefined) filters.entityType = query.entityType;
    if (query.startDate !== undefined) filters.startDate = query.startDate;
    if (query.endDate !== undefined) filters.endDate = query.endDate;
    if (query.search !== undefined) filters.search = query.search;

    this.logger.debug(`Fetching logs with filters: ${JSON.stringify(filters)}`);

    const { whereClause, params } = this.buildWhereClause(filters);
    const offset = (page - 1) * limit;

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
  }

  /**
   * Get log statistics
   */
  async getStats(currentUser: NestAuthUser): Promise<LogsStatsResponseData> {
    this.verifyRootAccess(currentUser);

    const tenantId = currentUser.tenantId;

    // Run all stats queries in parallel
    const [basicStats, topActions, topUsers] = await Promise.all([
      this.databaseService.query<StatsRow>(
        `SELECT COUNT(*) as total_logs, COUNT(DISTINCT user_id) as unique_users,
         COUNT(DISTINCT tenant_id) as unique_tenants,
         SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 ELSE 0 END) as today_logs
         FROM root_logs WHERE tenant_id = $1 AND (is_active IS NULL OR is_active != 4)`,
        [tenantId],
      ),
      this.databaseService.query<TopActionResult>(
        `SELECT action, COUNT(*) as count FROM root_logs
         WHERE tenant_id = $1 AND (is_active IS NULL OR is_active != 4)
         GROUP BY action ORDER BY count DESC LIMIT 10`,
        [tenantId],
      ),
      this.databaseService.query<TopUserResult>(
        `SELECT rl.user_id, u.username as user_name, COUNT(*) as count
         FROM root_logs rl LEFT JOIN users u ON rl.user_id = u.id
         WHERE rl.tenant_id = $1 AND (rl.is_active IS NULL OR rl.is_active != 4)
         GROUP BY rl.user_id, u.username ORDER BY count DESC LIMIT 10`,
        [tenantId],
      ),
    ]);

    const stats = basicStats[0];
    if (stats === undefined) {
      return {
        totalLogs: 0,
        todayLogs: 0,
        uniqueUsers: 0,
        uniqueTenants: 0,
        topActions: [],
        topUsers: [],
      };
    }

    return {
      totalLogs: stats.total_logs ?? 0,
      todayLogs: stats.today_logs ?? 0,
      uniqueUsers: stats.unique_users ?? 0,
      uniqueTenants: stats.unique_tenants ?? 0,
      topActions: topActions.map((r: TopActionResult) => ({ action: r.action ?? 'unknown', count: r.count ?? 0 })),
      topUsers: topUsers.map((r: TopUserResult) => ({
        userId: r.user_id ?? 0,
        userName: r.user_name ?? 'Unknown',
        count: r.count ?? 0,
      })),
    };
  }

  /**
   * Check if delete request has at least one filter
   */
  private hasAnyDeleteFilter(dto: DeleteLogsBodyDto): boolean {
    return (
      dto.userId !== undefined ||
      dto.olderThanDays !== undefined ||
      (dto.action !== undefined && dto.action !== '') ||
      (dto.entityType !== undefined && dto.entityType !== '') ||
      (dto.search !== undefined && dto.search !== '')
    );
  }

  /**
   * Build delete filters from DTO
   */
  private buildDeleteFilters(dto: DeleteLogsBodyDto, tenantId: number): DeleteFilterOutput {
    const filters: DeleteFilterOutput = { tenantId };

    if (dto.userId !== undefined) filters.userId = dto.userId;
    if (dto.olderThanDays !== undefined) filters.olderThanDays = dto.olderThanDays;
    if (dto.action !== undefined && dto.action !== '') filters.action = dto.action;
    if (dto.entityType !== undefined && dto.entityType !== '') filters.entityType = dto.entityType;
    if (dto.search !== undefined && dto.search !== '') filters.search = dto.search;

    return filters;
  }

  /**
   * Delete logs with search filter using subquery approach
   */
  private async deleteLogsWithSearch(filters: DeleteFilterOutput): Promise<number> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    // Add search conditions
    if (filters.search !== undefined && filters.search !== '') {
      this.addSearchCondition(filters.search, conditions, params);
    }

    // Add basic filters
    if (filters.userId !== undefined) {
      const paramIndex = params.length + 1;
      conditions.push(`rl.user_id = $${paramIndex}`);
      params.push(filters.userId);
    }

    // tenantId is always required (not optional in DeleteFilterOutput)
    const tenantParamIndex = params.length + 1;
    conditions.push(`rl.tenant_id = $${tenantParamIndex}`);
    params.push(filters.tenantId);
    if (filters.action !== undefined && filters.action !== '') {
      const paramIndex = params.length + 1;
      conditions.push(`rl.action = $${paramIndex}`);
      params.push(filters.action);
    }
    if (filters.entityType !== undefined && filters.entityType !== '') {
      const paramIndex = params.length + 1;
      conditions.push(`rl.entity_type = $${paramIndex}`);
      params.push(filters.entityType);
    }

    // Handle olderThanDays
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

    const result = await this.databaseService.query<{ rowCount: number }>(deleteQuery, params);
    // PostgreSQL returns affected rows on the result object
    const rowCount = (result as unknown as { rowCount?: number }).rowCount;
    return rowCount ?? 0;
  }

  /**
   * Build delete response object
   */
  private buildDeleteResponse(deletedCount: number): DeleteLogsResponseData {
    return {
      message: `Successfully deleted ${deletedCount} logs`,
      deletedCount,
    };
  }

  /**
   * Execute standard deletion without search filters
   */
  private async executeStandardDeletion(filters: DeleteFilterOutput): Promise<number> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.userId !== undefined) {
      const paramIndex = params.length + 1;
      conditions.push(`user_id = $${paramIndex}`);
      params.push(filters.userId);
    }

    // tenantId is always required
    const tenantParamIndex = params.length + 1;
    conditions.push(`tenant_id = $${tenantParamIndex}`);
    params.push(filters.tenantId);

    if (filters.action !== undefined && filters.action !== '') {
      const paramIndex = params.length + 1;
      conditions.push(`action = $${paramIndex}`);
      params.push(filters.action);
    }
    if (filters.entityType !== undefined && filters.entityType !== '') {
      const paramIndex = params.length + 1;
      conditions.push(`entity_type = $${paramIndex}`);
      params.push(filters.entityType);
    }

    // Handle olderThanDays: 0 means delete ALL, >0 means older than N days
    if (filters.olderThanDays !== undefined && filters.olderThanDays > 0) {
      const paramIndex = params.length + 1;
      conditions.push(`created_at < NOW() - ($${paramIndex} * INTERVAL '1 day')`);
      params.push(filters.olderThanDays);
    }

    // Only soft-delete logs that are not already deleted
    conditions.push('(is_active IS NULL OR is_active != 4)');

    const result = await this.databaseService.query<{ rowCount: number }>(
      `UPDATE root_logs SET is_active = 4 WHERE ${conditions.join(' AND ')}`,
      params,
    );

    const rowCount = (result as unknown as { rowCount?: number }).rowCount;
    return rowCount ?? 0;
  }

  /**
   * Delete logs with filters (soft delete)
   */
  async deleteLogs(
    currentUser: NestAuthUser,
    dto: DeleteLogsBodyDto,
  ): Promise<DeleteLogsResponseData> {
    this.verifyRootAccess(currentUser);
    await this.verifyPassword(currentUser, dto.confirmPassword);

    if (!this.hasAnyDeleteFilter(dto)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'At least one filter must be provided',
      });
    }

    const deleteFilters = this.buildDeleteFilters(dto, currentUser.tenantId);
    const hasSearch = deleteFilters.search !== undefined && deleteFilters.search !== '';

    const deletedCount = hasSearch
      ? await this.deleteLogsWithSearch(deleteFilters)
      : await this.executeStandardDeletion(deleteFilters);

    const suffix = hasSearch ? ' (with search filter)' : '';
    this.logger.log(`Root user ${currentUser.id} deleted ${deletedCount} logs${suffix}`);

    return this.buildDeleteResponse(deletedCount);
  }
}
