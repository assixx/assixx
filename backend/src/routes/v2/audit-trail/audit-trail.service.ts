/**
 * Audit Trail Service Layer for v2 API
 * Handles all database operations for audit logging
 */
import { ServiceError } from '../../../utils/ServiceError.js';
import {
  ResultSetHeader,
  RowDataPacket,
  execute,
  getConnection,
  query,
} from '../../../utils/db.js';
import {
  AuditEntry,
  AuditFilter,
  AuditStats,
  ComplianceReport,
  CreateAuditEntryDto,
} from './types.js';

interface DbAuditEntry extends RowDataPacket {
  id: number;
  tenant_id: number;
  user_id: number;
  user_name?: string;
  user_role?: string;
  action: string;
  resource_type: string;
  resource_id?: number;
  resource_name?: string;
  changes?: string;
  ip_address?: string;
  user_agent?: string;
  status: 'success' | 'failure';
  error_message?: string;
  created_at: Date;
}

// Query result types for type safety
interface UserUsernameRoleResult extends RowDataPacket {
  username: string;
  role: string;
}

interface CountResult extends RowDataPacket {
  total: number;
}

interface ActionCountResult extends RowDataPacket {
  action: string;
  count: number;
}

interface ResourceTypeCountResult extends RowDataPacket {
  resource_type: string;
  count: number;
}

interface UserCountResult extends RowDataPacket {
  user_id: number;
  user_name: string | null;
  count: number;
}

interface StatusCountResult extends RowDataPacket {
  status: 'success' | 'failure';
  count: number;
}

/**
 *
 */
class AuditTrailService {
  /**
   * Create a new audit entry
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param entry - The entry parameter
   * @param ipAddress - The ipAddress parameter
   * @param userAgent - The userAgent parameter
   */
  async createEntry(
    tenantId: number,
    userId: number,
    entry: CreateAuditEntryDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditEntry> {
    const connection = await getConnection();

    try {
      // Get user details for audit
      const [userRows] = await connection.execute<UserUsernameRoleResult[]>(
        `SELECT username, role FROM users WHERE id = $1 AND tenant_id = $2`,
        [userId, tenantId],
      );

      if (userRows.length === 0) {
        throw new ServiceError('USER_NOT_FOUND', 'User not found');
      }

      const user = userRows[0];
      if (user === undefined) {
        throw new ServiceError('USER_NOT_FOUND', 'User data is undefined');
      }

      // POSTGRESQL: RETURNING id required to get insertId
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO audit_trail (
          tenant_id, user_id, user_name, user_role,
          action, resource_type, resource_id, resource_name,
          changes, ip_address, user_agent, status, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id`,
        [
          tenantId,
          userId,
          user.username,
          user.role,
          entry.action,
          entry.resourceType,
          entry.resourceId ?? null,
          entry.resourceName ?? null,
          entry.changes ? JSON.stringify(entry.changes) : null,
          ipAddress ?? null,
          userAgent ?? null,
          entry.status,
          entry.errorMessage ?? null,
        ],
      );

      return await this.getEntryById(result.insertId, tenantId);
    } finally {
      connection.release();
    }
  }

  /**
   * Build WHERE clause conditions and params from filter
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
        `(user_name LIKE $${paramIndex} OR resource_name LIKE $${paramIndex + 1} OR action LIKE $${paramIndex + 2})`,
      );
      const searchPattern = `%${filter.search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    return { whereClause: conditions.join(' AND '), params };
  }

  /**
   * Get total count of entries matching filter
   */
  private async getEntriesCount(whereClause: string, params: (string | number)[]): Promise<number> {
    const [countRows] = await execute<CountResult[]>(
      `SELECT COUNT(*) as total FROM audit_trail WHERE ${whereClause}`,
      params,
    );
    const firstCount = countRows[0];
    if (firstCount === undefined) {
      throw new ServiceError('DATABASE_ERROR', 'Failed to get count from database');
    }
    return firstCount.total;
  }

  /**
   * Get audit entries with filters
   */
  async getEntries(filter: AuditFilter): Promise<{ entries: AuditEntry[]; total: number }> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 50;
    const sortBy = filter.sortBy ?? 'created_at';
    const sortOrder = filter.sortOrder ?? 'desc';
    const offset = (page - 1) * limit;

    const { whereClause, params } = this.buildWhereClause(filter);
    const total = await this.getEntriesCount(whereClause, params);

    const validSortFields = ['created_at', 'action', 'user_id', 'resource_type'];
    const orderBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const limitParamIndex = params.length + 1;
    const offsetParamIndex = params.length + 2;
    const [rows] = await query<DbAuditEntry[]>(
      `SELECT * FROM audit_trail WHERE ${whereClause} ORDER BY ${orderBy} ${order} LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
      [...params, limit, offset],
    );

    return { entries: rows.map((row: DbAuditEntry) => this.mapToAuditEntry(row)), total };
  }

  /**
   * Get audit entry by ID
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   */
  async getEntryById(id: number, tenantId: number): Promise<AuditEntry> {
    const [rows] = await execute<DbAuditEntry[]>(
      `SELECT * FROM audit_trail WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    if (rows.length === 0) {
      throw new ServiceError('NOT_FOUND', 'Audit entry not found');
    }

    const row = rows[0];
    if (row === undefined) {
      throw new ServiceError('NOT_FOUND', 'Audit entry data is undefined');
    }

    return this.mapToAuditEntry(row);
  }

  /**
   * Get audit statistics
   * @param filter - The filter parameter
   */
  private buildStatsWhereClause(filter: AuditFilter): {
    whereClause: string;
    params: (string | number | Date)[];
  } {
    const { tenantId, dateFrom, dateTo } = filter;
    const conditions: string[] = ['tenant_id = $1'];
    const params: (string | number | Date)[] = [tenantId];
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

  private transformStatsResults(
    actionRows: ActionCountResult[],
    resourceRows: ResourceTypeCountResult[],
    userRows: UserCountResult[],
    statusRows: StatusCountResult[],
  ): {
    byAction: Record<string, number>;
    byResourceType: Record<string, number>;
    byUser: { userId: number; userName: string; count: number }[];
    byStatus: { success: number; failure: number };
  } {
    const byAction: Record<string, number> = {};
    actionRows.forEach((row: ActionCountResult) => {
      byAction[row.action] = row.count;
    });

    const byResourceType: Record<string, number> = {};
    resourceRows.forEach((row: ResourceTypeCountResult) => {
      byResourceType[row.resource_type] = row.count;
    });

    const byUser = userRows.map((row: UserCountResult) => ({
      userId: row.user_id,
      userName: row.user_name ?? 'Unknown',
      count: row.count,
    }));

    const byStatus = { success: 0, failure: 0 };
    statusRows.forEach((row: StatusCountResult) => {
      if (row.status === 'success') {
        byStatus.success = row.count;
      } else {
        byStatus.failure = row.count;
      }
    });

    return { byAction, byResourceType, byUser, byStatus };
  }

  async getStats(filter: AuditFilter): Promise<AuditStats> {
    const { dateFrom, dateTo } = filter;
    const { whereClause, params } = this.buildStatsWhereClause(filter);

    // Get all required data
    const [totalRows] = await execute<CountResult[]>(
      `SELECT COUNT(*) as total FROM audit_trail WHERE ${whereClause}`,
      params,
    );

    const [actionRows] = await execute<ActionCountResult[]>(
      `SELECT action, COUNT(*) as count FROM audit_trail WHERE ${whereClause} GROUP BY action`,
      params,
    );

    const [resourceRows] = await execute<ResourceTypeCountResult[]>(
      `SELECT resource_type, COUNT(*) as count FROM audit_trail WHERE ${whereClause} GROUP BY resource_type`,
      params,
    );

    const [userRows] = await execute<UserCountResult[]>(
      `SELECT user_id, user_name, COUNT(*) as count
       FROM audit_trail WHERE ${whereClause}
       GROUP BY user_id, user_name ORDER BY count DESC LIMIT 10`,
      params,
    );

    const [statusRows] = await execute<StatusCountResult[]>(
      `SELECT status, COUNT(*) as count FROM audit_trail WHERE ${whereClause} GROUP BY status`,
      params,
    );

    const { byAction, byResourceType, byUser, byStatus } = this.transformStatsResults(
      actionRows,
      resourceRows,
      userRows,
      statusRows,
    );

    const firstTotal = totalRows[0];
    if (firstTotal === undefined) {
      throw new ServiceError('DATABASE_ERROR', 'Failed to get total count from database');
    }

    return {
      totalEntries: firstTotal.total,
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
   * @param tenantId - The tenant ID
   * @param reportType - The reportType parameter
   * @param dateFrom - The dateFrom parameter
   * @param dateTo - The dateTo parameter
   * @param generatedBy - The generatedBy parameter
   */
  async generateComplianceReport(
    tenantId: number,
    reportType: 'gdpr' | 'data_access' | 'data_changes' | 'user_activity',
    dateFrom: string,
    dateTo: string,
    generatedBy: number,
  ): Promise<ComplianceReport> {
    const conditions: string[] = ['tenant_id = $1', 'created_at >= $2', 'created_at <= $3'];
    const params: (string | number)[] = [tenantId, dateFrom, dateTo];

    // Add report-specific filters
    switch (reportType) {
      case 'gdpr':
        // GDPR relevant actions: read, export, delete user data
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
        // All actions
        break;
    }

    const whereClause = conditions.join(' AND ');

    // Get entries
    const [rows] = await execute<DbAuditEntry[]>(
      `SELECT * FROM audit_trail
       WHERE ${whereClause}
       ORDER BY created_at DESC`,
      params,
    );

    const entries = rows.map((row: DbAuditEntry) => this.mapToAuditEntry(row));

    // Calculate summary
    const uniqueUsers = new Set(entries.map((e: AuditEntry) => e.userId)).size;
    const dataAccessCount = entries.filter((e: AuditEntry) =>
      ['read', 'export'].includes(e.action),
    ).length;
    const dataModificationCount = entries.filter((e: AuditEntry) =>
      ['create', 'update'].includes(e.action),
    ).length;
    const dataDeletionCount = entries.filter((e: AuditEntry) => e.action === 'delete').length;

    return {
      tenantId,
      reportType,
      dateFrom,
      dateTo,
      entries,
      summary: {
        totalActions: entries.length,
        uniqueUsers,
        dataAccessCount,
        dataModificationCount,
        dataDeletionCount,
      },
      generatedAt: new Date().toISOString(),
      generatedBy,
    };
  }

  /**
   * Delete old audit entries (for data retention policies)
   * @param tenantId - The tenant ID
   * @param olderThan - The olderThan parameter
   */
  async deleteOldEntries(tenantId: number, olderThan: Date): Promise<number> {
    const [result] = await execute<ResultSetHeader>(
      `DELETE FROM audit_trail WHERE tenant_id = $1 AND created_at < $2`,
      [tenantId, olderThan],
    );

    return result.affectedRows;
  }

  /**
   * Apply optional string fields from DB row to entry
   */
  private applyOptionalStringFields(entry: AuditEntry, row: DbAuditEntry): void {
    if (row.user_name !== undefined) entry.userName = row.user_name;
    if (row.user_role !== undefined) entry.userRole = row.user_role;
    if (row.resource_name !== undefined) entry.resourceName = row.resource_name;
    if (row.ip_address !== undefined) entry.ipAddress = row.ip_address;
    if (row.user_agent !== undefined) entry.userAgent = row.user_agent;
    if (row.error_message !== undefined) entry.errorMessage = row.error_message;
  }

  /**
   * Map database row to AuditEntry
   */
  private mapToAuditEntry(row: DbAuditEntry): AuditEntry {
    const entry: AuditEntry = {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      action: row.action,
      resourceType: row.resource_type,
      status: row.status,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    };

    this.applyOptionalStringFields(entry, row);

    if (row.resource_id !== undefined) entry.resourceId = row.resource_id;
    if (row.changes !== undefined) {
      entry.changes = JSON.parse(row.changes) as Record<string, unknown>;
    }

    return entry;
  }
}

export const auditTrailService = new AuditTrailService();
