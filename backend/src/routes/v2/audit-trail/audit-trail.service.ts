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

/**
 *
 */
export class AuditTrailService {
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
      const [userRows] = await connection.execute<RowDataPacket[]>(
        `SELECT username, role FROM users WHERE id = ? AND tenant_id = ?`,
        [userId, tenantId],
      );

      if (userRows.length === 0) {
        throw new ServiceError('USER_NOT_FOUND', 'User not found');
      }

      const user = userRows[0];

      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO audit_trail (
          tenant_id, user_id, user_name, user_role,
          action, resource_type, resource_id, resource_name,
          changes, ip_address, user_agent, status, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
   * Get audit entries with filters
   * @param filter - The filter parameter
   */
  async getEntries(filter: AuditFilter): Promise<{ entries: AuditEntry[]; total: number }> {
    const {
      tenantId,
      userId,
      action,
      resourceType,
      resourceId,
      status,
      dateFrom,
      dateTo,
      search,
      page = 1,
      limit = 50,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = filter;

    const offset = (page - 1) * limit;
    const conditions: string[] = ['tenant_id = ?'];
    const params: (string | number | boolean)[] = [tenantId];

    // Build WHERE conditions
    if (userId) {
      conditions.push('user_id = ?');
      params.push(userId);
    }
    if (action) {
      conditions.push('action = ?');
      params.push(action);
    }
    if (resourceType) {
      conditions.push('resource_type = ?');
      params.push(resourceType);
    }
    if (resourceId) {
      conditions.push('resource_id = ?');
      params.push(resourceId);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (dateFrom) {
      conditions.push('created_at >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('created_at <= ?');
      params.push(dateTo);
    }
    if (search) {
      conditions.push('(user_name LIKE ? OR resource_name LIKE ? OR action LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const [countRows] = await execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM audit_trail WHERE ${whereClause}`,
      params,
    );
    const total = countRows[0].total as number;

    // Get paginated entries
    const validSortFields = ['created_at', 'action', 'user_id', 'resource_type'];
    const orderBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Debug logging
    console.info('[Audit Trail Service] Query params:', {
      whereClause,
      params,
      limit,
      offset,
      finalParams: [...params, limit, offset],
    });

    const [rows] = await query<DbAuditEntry[]>(
      `SELECT * FROM audit_trail
       WHERE ${whereClause}
       ORDER BY ${orderBy} ${order}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const entries = rows.map((row) => this.mapToAuditEntry(row));

    return { entries, total };
  }

  /**
   * Get audit entry by ID
   * @param id - The resource ID
   * @param tenantId - The tenant ID
   */
  async getEntryById(id: number, tenantId: number): Promise<AuditEntry> {
    const [rows] = await execute<DbAuditEntry[]>(
      `SELECT * FROM audit_trail WHERE id = ? AND tenant_id = ?`,
      [id, tenantId],
    );

    if (rows.length === 0) {
      throw new ServiceError('NOT_FOUND', 'Audit entry not found');
    }

    return this.mapToAuditEntry(rows[0]);
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
    const conditions: string[] = ['tenant_id = ?'];
    const params: (string | number | Date)[] = [tenantId];

    if (dateFrom) {
      conditions.push('created_at >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('created_at <= ?');
      params.push(dateTo);
    }

    return { whereClause: conditions.join(' AND '), params };
  }

  private transformStatsResults(
    actionRows: RowDataPacket[],
    resourceRows: RowDataPacket[],
    userRows: RowDataPacket[],
    statusRows: RowDataPacket[],
  ): {
    byAction: Record<string, number>;
    byResourceType: Record<string, number>;
    byUser: { userId: number; userName: string; count: number }[];
    byStatus: { success: number; failure: number };
  } {
    const byAction: Record<string, number> = {};
    actionRows.forEach((row) => {
      byAction[row.action as string] = row.count as number;
    });

    const byResourceType: Record<string, number> = {};
    resourceRows.forEach((row) => {
      byResourceType[row.resource_type as string] = row.count as number;
    });

    const byUser = userRows.map((row) => ({
      userId: row.user_id as number,
      userName: row.user_name ? (row.user_name as string) : 'Unknown',
      count: row.count as number,
    }));

    const byStatus = { success: 0, failure: 0 };
    statusRows.forEach((row) => {
      if (row.status === 'success') {
        byStatus.success = row.count as number;
      } else if (row.status === 'failure') {
        byStatus.failure = row.count as number;
      }
    });

    return { byAction, byResourceType, byUser, byStatus };
  }

  async getStats(filter: AuditFilter): Promise<AuditStats> {
    const { dateFrom, dateTo } = filter;
    const { whereClause, params } = this.buildStatsWhereClause(filter);

    // Get all required data
    const [totalRows] = await execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM audit_trail WHERE ${whereClause}`,
      params,
    );

    const [actionRows] = await execute<RowDataPacket[]>(
      `SELECT action, COUNT(*) as count FROM audit_trail WHERE ${whereClause} GROUP BY action`,
      params,
    );

    const [resourceRows] = await execute<RowDataPacket[]>(
      `SELECT resource_type, COUNT(*) as count FROM audit_trail WHERE ${whereClause} GROUP BY resource_type`,
      params,
    );

    const [userRows] = await execute<RowDataPacket[]>(
      `SELECT user_id, user_name, COUNT(*) as count
       FROM audit_trail WHERE ${whereClause}
       GROUP BY user_id, user_name ORDER BY count DESC LIMIT 10`,
      params,
    );

    const [statusRows] = await execute<RowDataPacket[]>(
      `SELECT status, COUNT(*) as count FROM audit_trail WHERE ${whereClause} GROUP BY status`,
      params,
    );

    const { byAction, byResourceType, byUser, byStatus } = this.transformStatsResults(
      actionRows,
      resourceRows,
      userRows,
      statusRows,
    );

    return {
      totalEntries: totalRows[0].total as number,
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
    const conditions: string[] = ['tenant_id = ?', 'created_at >= ?', 'created_at <= ?'];
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

    const entries = rows.map((row) => this.mapToAuditEntry(row));

    // Calculate summary
    const uniqueUsers = new Set(entries.map((e) => e.userId)).size;
    const dataAccessCount = entries.filter((e) => ['read', 'export'].includes(e.action)).length;
    const dataModificationCount = entries.filter((e) =>
      ['create', 'update'].includes(e.action),
    ).length;
    const dataDeletionCount = entries.filter((e) => e.action === 'delete').length;

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
      `DELETE FROM audit_trail WHERE tenant_id = ? AND created_at < ?`,
      [tenantId, olderThan],
    );

    return result.affectedRows;
  }

  /**
   * Map database row to AuditEntry
   * @param row - The row parameter
   */
  private mapToAuditEntry(row: DbAuditEntry): AuditEntry {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      userName: row.user_name,
      userRole: row.user_role,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      resourceName: row.resource_name,
      changes:
        row.changes ?
          typeof row.changes === 'string' ?
            (JSON.parse(row.changes) as Record<string, unknown>)
          : (row.changes as Record<string, unknown>)
        : undefined,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      status: row.status,
      errorMessage: row.error_message,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    };
  }
}

export const auditTrailService = new AuditTrailService();
