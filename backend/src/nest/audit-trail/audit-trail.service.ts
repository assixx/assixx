/**
 * Audit Trail Service (NestJS)
 *
 * Native NestJS implementation for audit trail management.
 * Uses DatabaseService directly for PostgreSQL queries.
 *
 * IMPORTANT: Uses PostgreSQL $1, $2, $3 placeholders (NOT MySQL's ?)
 */
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import type { QueryResultRow } from 'pg';

import type { NestAuthUser } from '../common/index.js';
import { DatabaseService, UserRepository } from '../database/index.js';
import type {
  AuditEntryResponse,
  AuditPaginationResponse,
  AuditStatsResponseData,
  ComplianceReportResponseData,
  DeleteOldEntriesBodyDto,
  DeleteOldEntriesResponseData,
  ExportEntriesQueryDto,
  GenerateReportBodyDto,
  GetEntriesQueryDto,
  GetEntriesResponseData,
  GetStatsQueryDto,
} from './dto/index.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Filter options for audit queries */
interface AuditFilter {
  tenantId: number;
  userId?: number | undefined;
  action?: string | undefined;
  resourceType?: string | undefined;
  resourceId?: number | undefined;
  status?: 'success' | 'failure' | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  sortBy?: 'created_at' | 'action' | 'user_id' | 'resource_type' | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
}

/** DTO for creating audit entries */
interface CreateAuditEntryDto {
  action: string;
  resourceType: string;
  resourceId?: number | undefined;
  resourceName?: string | undefined;
  changes?: Record<string, unknown> | undefined;
  status: 'success' | 'failure';
  errorMessage?: string | undefined;
}

// ============================================================================
// DATABASE ROW TYPES
// ============================================================================

interface DbAuditEntry extends QueryResultRow {
  id: number;
  tenant_id: number;
  user_id: number;
  user_name: string | null;
  user_role: string | null;
  action: string;
  resource_type: string;
  resource_id: number | null;
  resource_name: string | null;
  changes: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status: 'success' | 'failure';
  error_message: string | null;
  created_at: Date | string;
}

interface DbCountResult extends QueryResultRow {
  total: number | string;
}

interface DbActionCountResult extends QueryResultRow {
  action: string;
  count: number | string;
}

interface DbResourceTypeCountResult extends QueryResultRow {
  resource_type: string;
  count: number | string;
}

interface DbUserCountResult extends QueryResultRow {
  user_id: number;
  user_name: string | null;
  count: number | string;
}

interface DbStatusCountResult extends QueryResultRow {
  status: 'success' | 'failure';
  count: number | string;
}

/** Raw query results for stats aggregation */
interface StatsQueryResults {
  actionRows: DbActionCountResult[];
  resourceRows: DbResourceTypeCountResult[];
  userRows: DbUserCountResult[];
  statusRows: DbStatusCountResult[];
}

interface DbUserInfo extends QueryResultRow {
  username: string;
  role: string;
  password?: string;
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

@Injectable()
export class AuditTrailService {
  private readonly logger = new Logger(AuditTrailService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly userRepository: UserRepository,
  ) {}

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Get audit entries with filters and pagination
   */
  async getEntries(
    currentUser: NestAuthUser,
    dto: GetEntriesQueryDto,
  ): Promise<GetEntriesResponseData> {
    const filter = this.buildFilter(currentUser, dto);

    // Apply access control - non-root users can only see their own entries
    if (currentUser.role !== 'root') {
      if (dto.userId !== undefined && dto.userId !== currentUser.id) {
        throw new ForbiddenException("Cannot view other users' audit entries");
      }
      filter.userId = currentUser.id;
    }

    const result = await this.queryEntries(filter);
    const pagination = this.buildPagination(result.total, dto.page, dto.limit);

    return {
      entries: result.entries,
      pagination,
    };
  }

  /**
   * Get audit entry by ID
   */
  async getEntryById(
    currentUser: NestAuthUser,
    id: number,
  ): Promise<AuditEntryResponse> {
    const rows = await this.db.query<DbAuditEntry>(
      `SELECT * FROM audit_trail WHERE id = $1 AND tenant_id = $2`,
      [id, currentUser.tenantId],
    );

    if (rows.length === 0) {
      throw new NotFoundException('Audit entry not found');
    }

    const row = rows[0];
    if (row === undefined) {
      throw new NotFoundException('Audit entry not found');
    }

    const entry = this.mapDbRowToEntry(row);

    // Only root users can see entries from other users
    if (currentUser.role !== 'root' && entry.userId !== currentUser.id) {
      throw new ForbiddenException("Cannot view other users' audit entries");
    }

    return entry;
  }

  /**
   * Get audit statistics
   */
  async getStats(
    currentUser: NestAuthUser,
    dto: GetStatsQueryDto,
  ): Promise<AuditStatsResponseData> {
    this.verifyAdminAccess(currentUser);

    const { whereClause, params } = this.buildStatsWhereClause(
      currentUser.tenantId,
      dto.dateFrom,
      dto.dateTo,
    );

    // Get total count
    const totalRows = await this.db.query<DbCountResult>(
      `SELECT COUNT(*) as total FROM audit_trail WHERE ${whereClause}`,
      params,
    );

    // Get action counts
    const actionRows = await this.db.query<DbActionCountResult>(
      `SELECT action, COUNT(*) as count FROM audit_trail WHERE ${whereClause} GROUP BY action`,
      params,
    );

    // Get resource type counts
    const resourceRows = await this.db.query<DbResourceTypeCountResult>(
      `SELECT resource_type, COUNT(*) as count FROM audit_trail WHERE ${whereClause} GROUP BY resource_type`,
      params,
    );

    // Get user counts (top 10)
    const userRows = await this.db.query<DbUserCountResult>(
      `SELECT user_id, user_name, COUNT(*) as count
       FROM audit_trail WHERE ${whereClause}
       GROUP BY user_id, user_name ORDER BY count DESC LIMIT 10`,
      params,
    );

    // Get status counts
    const statusRows = await this.db.query<DbStatusCountResult>(
      `SELECT status, COUNT(*) as count FROM audit_trail WHERE ${whereClause} GROUP BY status`,
      params,
    );

    return this.transformStatsResults(
      { actionRows, resourceRows, userRows, statusRows },
      Number(totalRows[0]?.total ?? 0),
      dto.dateFrom,
      dto.dateTo,
    );
  }

  /** Transform raw stats query results into response format */
  private transformStatsResults(
    results: StatsQueryResults,
    totalEntries: number,
    dateFrom: string | undefined,
    dateTo: string | undefined,
  ): AuditStatsResponseData {
    const byAction: Record<string, number> = {};
    for (const row of results.actionRows) {
      byAction[row.action] = Number(row.count);
    }

    const byResourceType: Record<string, number> = {};
    for (const row of results.resourceRows) {
      byResourceType[row.resource_type] = Number(row.count);
    }

    const byUser = results.userRows.map((row: DbUserCountResult) => ({
      userId: row.user_id,
      userName: row.user_name ?? 'Unknown',
      count: Number(row.count),
    }));

    const byStatus = { success: 0, failure: 0 };
    for (const row of results.statusRows) {
      if (row.status === 'success') {
        byStatus.success = Number(row.count);
      } else {
        byStatus.failure = Number(row.count);
      }
    }

    return {
      totalEntries,
      byAction,
      byResourceType,
      byUser,
      byStatus,
      timeRange: {
        from: dateFrom ?? 'unlimited',
        to: dateTo ?? 'unlimited',
      },
    };
  }

  /**
   * Generate compliance report
   */
  async generateReport(
    currentUser: NestAuthUser,
    dto: GenerateReportBodyDto,
  ): Promise<ComplianceReportResponseData> {
    this.verifyAdminAccess(currentUser);

    const conditions: string[] = [
      'tenant_id = $1',
      'created_at >= $2',
      'created_at <= $3',
    ];
    const params: (string | number)[] = [
      currentUser.tenantId,
      dto.dateFrom,
      dto.dateTo,
    ];

    // Add report-specific filters
    switch (dto.reportType) {
      case 'gdpr':
        conditions.push(`(
          (action IN ('read', 'export', 'delete') AND resource_type = 'user') OR
          action IN ('export', 'delete')
        )`);
        break;
      case 'data_access':
        conditions.push(`action IN ('read', 'export')`);
        break;
      case 'data_changes':
        conditions.push(
          `action IN ('create', 'update', 'delete', 'bulk_create', 'bulk_update', 'bulk_delete')`,
        );
        break;
      case 'user_activity':
        // All actions - no additional filter
        break;
    }

    const whereClause = conditions.join(' AND ');

    const rows = await this.db.query<DbAuditEntry>(
      `SELECT * FROM audit_trail WHERE ${whereClause} ORDER BY created_at DESC`,
      params,
    );

    const entries = rows.map((row: DbAuditEntry) => this.mapDbRowToEntry(row));

    return {
      tenantId: currentUser.tenantId,
      reportType: dto.reportType,
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
      entries,
      summary: this.calculateReportSummary(entries),
      generatedAt: new Date().toISOString(),
      generatedBy: currentUser.id,
    };
  }

  /**
   * Export audit entries
   */
  async exportEntries(
    currentUser: NestAuthUser,
    dto: ExportEntriesQueryDto,
    ipAddress: string | undefined,
    userAgent: string | undefined,
  ): Promise<{ entries: AuditEntryResponse[]; format: string }> {
    this.verifyAdminAccess(currentUser);

    const filter: AuditFilter = {
      tenantId: currentUser.tenantId,
      page: 1,
      limit: 10000, // Max export limit
    };

    if (dto.dateFrom !== undefined) filter.dateFrom = dto.dateFrom;
    if (dto.dateTo !== undefined) filter.dateTo = dto.dateTo;

    const result = await this.queryEntries(filter);

    // Log the export action
    await this.createEntry(
      currentUser.tenantId,
      currentUser.id,
      {
        action: 'export',
        resourceType: 'audit_trail',
        resourceName: `Audit export (${result.entries.length} entries)`,
        status: 'success',
      },
      ipAddress,
      userAgent,
    );

    return {
      entries: result.entries,
      format: dto.format ?? 'json',
    };
  }

  /**
   * Delete old audit entries (data retention)
   */
  async deleteOldEntries(
    currentUser: NestAuthUser,
    dto: DeleteOldEntriesBodyDto,
    ipAddress: string | undefined,
    userAgent: string | undefined,
  ): Promise<DeleteOldEntriesResponseData> {
    this.verifyRootAccess(currentUser);

    await this.verifyPassword(currentUser, dto.confirmPassword);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - dto.olderThanDays);

    // Delete old entries and get count
    const deleteResult = await this.db.query<DbCountResult>(
      `WITH deleted AS (
        DELETE FROM audit_trail WHERE tenant_id = $1 AND created_at < $2 RETURNING 1
      ) SELECT COUNT(*) as total FROM deleted`,
      [currentUser.tenantId, cutoffDate],
    );

    const deletedCount = Number(deleteResult[0]?.total ?? 0);

    // Log the deletion
    await this.createEntry(
      currentUser.tenantId,
      currentUser.id,
      {
        action: 'delete',
        resourceType: 'audit_trail',
        resourceName: `Deleted ${deletedCount} entries older than ${dto.olderThanDays} days`,
        changes: { deletedCount, olderThanDays: dto.olderThanDays },
        status: 'success',
      },
      ipAddress,
      userAgent,
    );

    return {
      deletedCount,
      cutoffDate: cutoffDate.toISOString(),
    };
  }

  /**
   * Generate CSV from audit entries
   */
  generateCSV(entries: AuditEntryResponse[]): string {
    const headers = [
      'ID',
      'Date/Time',
      'User',
      'Role',
      'Action',
      'Resource Type',
      'Resource',
      'Status',
      'IP Address',
    ];

    const rows = entries.map((entry: AuditEntryResponse) => [
      entry.id,
      entry.createdAt,
      entry.userName ?? entry.userId,
      entry.userRole ?? '',
      entry.action,
      entry.resourceType,
      entry.resourceName ?? entry.resourceId ?? '',
      entry.status,
      entry.ipAddress ?? '',
    ]);

    return [
      headers.join(','),
      ...rows.map((row: unknown[]) =>
        row.map((cell: unknown) => `"${String(cell)}"`).join(','),
      ),
    ].join('\n');
  }

  // ==========================================================================
  // PRIVATE HELPER METHODS
  // ==========================================================================

  /**
   * Query entries with filter
   */
  private async queryEntries(
    filter: AuditFilter,
  ): Promise<{ entries: AuditEntryResponse[]; total: number }> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 50;
    const sortBy = filter.sortBy ?? 'created_at';
    const sortOrder = filter.sortOrder ?? 'desc';
    const offset = (page - 1) * limit;

    const { whereClause, params } = this.buildWhereClause(filter);

    // Get total count
    const countRows = await this.db.query<DbCountResult>(
      `SELECT COUNT(*) as total FROM audit_trail WHERE ${whereClause}`,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);

    // Validate sort field
    const validSortFields = [
      'created_at',
      'action',
      'user_id',
      'resource_type',
    ];
    const orderBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Get entries
    const limitParamIndex = params.length + 1;
    const offsetParamIndex = params.length + 2;
    const rows = await this.db.query<DbAuditEntry>(
      `SELECT * FROM audit_trail WHERE ${whereClause}
       ORDER BY ${orderBy} ${order}
       LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
      [...params, limit, offset],
    );

    return {
      entries: rows.map((row: DbAuditEntry) => this.mapDbRowToEntry(row)),
      total,
    };
  }

  /**
   * Build WHERE clause from filter
   */
  private buildWhereClause(filter: AuditFilter): {
    whereClause: string;
    params: (string | number)[];
  } {
    const conditions: string[] = ['tenant_id = $1'];
    const params: (string | number)[] = [filter.tenantId];
    let paramIndex = 2;

    if (filter.userId !== undefined) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(filter.userId);
    }
    if (filter.action !== undefined) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(filter.action);
    }
    if (filter.resourceType !== undefined) {
      conditions.push(`resource_type = $${paramIndex++}`);
      params.push(filter.resourceType);
    }
    if (filter.resourceId !== undefined) {
      conditions.push(`resource_id = $${paramIndex++}`);
      params.push(filter.resourceId);
    }
    if (filter.status !== undefined) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filter.status);
    }
    if (filter.dateFrom !== undefined) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(filter.dateFrom);
    }
    if (filter.dateTo !== undefined) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(filter.dateTo);
    }
    if (filter.search !== undefined) {
      conditions.push(
        `(user_name ILIKE $${paramIndex} OR resource_name ILIKE $${paramIndex + 1} OR action ILIKE $${paramIndex + 2})`,
      );
      const searchPattern = `%${filter.search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    return { whereClause: conditions.join(' AND '), params };
  }

  /**
   * Build stats WHERE clause
   */
  private buildStatsWhereClause(
    tenantId: number,
    dateFrom?: string,
    dateTo?: string,
  ): { whereClause: string; params: (string | number)[] } {
    const conditions: string[] = ['tenant_id = $1'];
    const params: (string | number)[] = [tenantId];
    let paramIndex = 2;

    if (dateFrom !== undefined && dateFrom !== '') {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(dateFrom);
    }
    if (dateTo !== undefined && dateTo !== '') {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(dateTo);
    }

    return { whereClause: conditions.join(' AND '), params };
  }

  /**
   * Build filter from DTO
   */
  private buildFilter(
    currentUser: NestAuthUser,
    dto: GetEntriesQueryDto,
  ): AuditFilter {
    const filter: AuditFilter = {
      tenantId: currentUser.tenantId,
      page: dto.page,
      limit: dto.limit,
    };

    if (dto.userId !== undefined) filter.userId = dto.userId;
    if (dto.action !== undefined) filter.action = dto.action;
    if (dto.resourceType !== undefined) filter.resourceType = dto.resourceType;
    if (dto.resourceId !== undefined) filter.resourceId = dto.resourceId;
    if (dto.status !== undefined) filter.status = dto.status;
    if (dto.dateFrom !== undefined) filter.dateFrom = dto.dateFrom;
    if (dto.dateTo !== undefined) filter.dateTo = dto.dateTo;
    if (dto.search !== undefined) filter.search = dto.search;
    if (dto.sortBy !== undefined) filter.sortBy = dto.sortBy;
    if (dto.sortOrder !== undefined) filter.sortOrder = dto.sortOrder;

    return filter;
  }

  /**
   * Build pagination response
   */
  private buildPagination(
    total: number,
    page: number,
    limit: number,
  ): AuditPaginationResponse {
    return {
      currentPage: page,
      pageSize: limit,
      totalItems: total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create audit entry (internal use for logging export/delete actions)
   */
  private async createEntry(
    tenantId: number,
    userId: number,
    entry: CreateAuditEntryDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      // Get user details
      const userRows = await this.db.query<DbUserInfo>(
        `SELECT username, role FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = 1`,
        [userId, tenantId],
      );

      const user = userRows[0];
      if (user === undefined) {
        this.logger.warn(`User not found for audit entry: ${userId}`);
        return;
      }

      await this.db.query(
        `INSERT INTO audit_trail (
          tenant_id, user_id, user_name, user_role,
          action, resource_type, resource_id, resource_name,
          changes, ip_address, user_agent, status, error_message, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
        [
          tenantId,
          userId,
          user.username,
          user.role,
          entry.action,
          entry.resourceType,
          entry.resourceId ?? null,
          entry.resourceName ?? null,
          entry.changes !== undefined ? JSON.stringify(entry.changes) : null,
          ipAddress ?? null,
          userAgent ?? null,
          entry.status,
          entry.errorMessage ?? null,
        ],
      );
    } catch (error: unknown) {
      // Don't fail if audit logging fails
      this.logger.error('Failed to create audit entry:', error);
    }
  }

  /**
   * Map DB row to API response
   */
  private mapDbRowToEntry(row: DbAuditEntry): AuditEntryResponse {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      action: row.action,
      resourceType: row.resource_type,
      status: row.status,
      createdAt:
        row.created_at instanceof Date ?
          row.created_at.toISOString()
        : row.created_at,
      ...this.buildOptionalEntryFields(row),
    };
  }

  /** Build optional fields for audit entry response */
  private buildOptionalEntryFields(
    row: DbAuditEntry,
  ): Partial<AuditEntryResponse> {
    const fields: Partial<AuditEntryResponse> = {};

    if (row.user_name !== null) fields.userName = row.user_name;
    if (row.user_role !== null) fields.userRole = row.user_role;
    if (row.resource_id !== null) fields.resourceId = row.resource_id;
    if (row.resource_name !== null) fields.resourceName = row.resource_name;
    if (row.ip_address !== null) fields.ipAddress = row.ip_address;
    if (row.user_agent !== null) fields.userAgent = row.user_agent;
    if (row.error_message !== null) fields.errorMessage = row.error_message;
    if (row.changes !== null) {
      const parsed = this.parseChangesJson(row.changes);
      if (parsed !== undefined) fields.changes = parsed;
    }

    return fields;
  }

  /** Safely parse JSON changes field */
  private parseChangesJson(
    changes: string,
  ): Record<string, unknown> | undefined {
    try {
      return JSON.parse(changes) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }

  /** Calculate summary statistics for a compliance report */
  private calculateReportSummary(
    entries: AuditEntryResponse[],
  ): ComplianceReportResponseData['summary'] {
    const uniqueUsers = new Set(
      entries.map((e: AuditEntryResponse) => e.userId),
    ).size;
    const dataAccessCount = entries.filter((e: AuditEntryResponse) =>
      ['read', 'export'].includes(e.action),
    ).length;
    const dataModificationCount = entries.filter((e: AuditEntryResponse) =>
      ['create', 'update'].includes(e.action),
    ).length;
    const dataDeletionCount = entries.filter(
      (e: AuditEntryResponse) => e.action === 'delete',
    ).length;

    return {
      totalActions: entries.length,
      uniqueUsers,
      dataAccessCount,
      dataModificationCount,
      dataDeletionCount,
    };
  }

  /**
   * Verify user has admin or root role
   */
  private verifyAdminAccess(currentUser: NestAuthUser): void {
    if (!['admin', 'root'].includes(currentUser.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  /**
   * Verify user has root role
   */
  private verifyRootAccess(currentUser: NestAuthUser): void {
    if (currentUser.role !== 'root') {
      throw new ForbiddenException('Only root users can delete audit entries');
    }
  }

  /**
   * Verify password for destructive operations
   * SECURITY: Only allows ACTIVE users (is_active = 1) to perform destructive operations
   */
  private async verifyPassword(
    currentUser: NestAuthUser,
    password: string,
  ): Promise<void> {
    const passwordHash = await this.userRepository.getPasswordHash(
      currentUser.id,
      currentUser.tenantId,
    );

    if (passwordHash === null) {
      throw new NotFoundException('User not found or inactive');
    }

    const isValid = await bcrypt.compare(password, passwordHash);
    if (!isValid) {
      throw new ForbiddenException('Invalid password');
    }
  }
}
