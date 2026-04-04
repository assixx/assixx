/**
 * Unified Logs Service
 *
 * Provides cursor-based streaming export of audit logs from both
 * audit_trail and root_logs tables with proper RLS enforcement.
 *
 * CRITICAL SECURITY: This service handles RLS context explicitly
 * because PostgreSQL cursors require the app.tenant_id to be set
 * BEFORE the cursor query, not per-transaction.
 *
 * @see ADR-009 Central Audit Logging
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { Pool } from 'pg';
// eslint-disable-next-line @typescript-eslint/naming-convention -- pg-cursor exports Cursor as default
import Cursor from 'pg-cursor';

import { SYSTEM_POOL } from '../database/database.constants.js';
import type { ExportMetadata, UnifiedLogEntry } from './dto/export-logs.dto.js';
import { IS_ACTIVE } from '@assixx/shared/constants';

/** Batch size for cursor reads - 1000 rows at a time */
const CURSOR_BATCH_SIZE = 1000;

/** Raw row from audit_trail table */
interface AuditTrailRow {
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
  status: string;
  error_message: string | null;
  created_at: Date;
}

/** Raw row from root_logs table (denormalized columns, no JOIN) */
interface RootLogsRow {
  id: number;
  tenant_id: number;
  user_id: number;
  user_name: string | null; // Denormalized column
  user_role: string | null; // Denormalized column
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  details: string | null;
  old_values: string | null;
  new_values: string | null;
  ip_address: string | null;
  user_agent: string | null;
  was_role_switched: boolean;
  is_active: number | null;
  created_at: Date;
}

/** Filter parameters for log queries */
export interface LogFilterParams {
  tenantId: number;
  dateFrom: Date;
  dateTo: Date;
  source: 'audit_trail' | 'root_logs' | 'all';
  action?: string;
  userId?: number;
  entityType?: string;
}

@Injectable()
export class UnifiedLogsService {
  private readonly logger = new Logger(UnifiedLogsService.name);

  constructor(@Inject(SYSTEM_POOL) private readonly pool: Pool) {}

  /**
   * Stream unified logs with cursor-based pagination.
   *
   * CRITICAL SECURITY:
   * - Sets app.tenant_id BEFORE any query to enforce RLS
   * - Without this, RLS policy returns ALL rows (data breach!)
   * - Uses is_local=false for connection-scope (not just transaction)
   *
   * Memory efficient: Only CURSOR_BATCH_SIZE rows in RAM at a time.
   */
  async *streamLogs(filter: LogFilterParams): AsyncGenerator<UnifiedLogEntry> {
    // CRITICAL: Validate tenantId - NEVER allow 0
    if (filter.tenantId === 0) {
      throw new Error('tenantId is required for RLS-protected queries');
    }

    const client = await this.pool.connect();

    try {
      // ============================================================
      // CRITICAL: Set RLS context BEFORE any query!
      // Without this, RLS policy returns ALL rows (data breach)
      // ============================================================
      await this.setRlsContext(client, filter.tenantId);

      this.logger.debug(
        `Streaming logs for tenant ${filter.tenantId}, ` +
          `${filter.dateFrom.toISOString()} to ${filter.dateTo.toISOString()}, ` +
          `source: ${filter.source}`,
      );

      // Stream from audit_trail
      if (filter.source === 'all' || filter.source === 'audit_trail') {
        yield* this.streamFromAuditTrail(client, filter);
      }

      // Stream from root_logs
      if (filter.source === 'all' || filter.source === 'root_logs') {
        yield* this.streamFromRootLogs(client, filter);
      }
    } finally {
      // Clear RLS context before releasing (defense in depth)
      try {
        await this.clearRlsContext(client);
      } catch {
        // Ignore cleanup errors - connection will be reset by pool anyway
      }
      // Always release connection back to pool
      client.release();
    }
  }

  /**
   * Count total logs matching filter (for metadata).
   * Uses same RLS context pattern as streaming.
   */
  async countLogs(filter: LogFilterParams): Promise<number> {
    if (filter.tenantId === 0) {
      throw new Error('tenantId is required for RLS-protected queries');
    }

    const client = await this.pool.connect();

    try {
      await this.setRlsContext(client, filter.tenantId);

      let total = 0;

      if (filter.source === 'all' || filter.source === 'audit_trail') {
        const { whereClause, params } = this.buildAuditTrailWhereClause(filter);
        const result = await client.query<{ count: string }>(
          `SELECT COUNT(*) as count FROM audit_trail ${whereClause}`,
          params,
        );
        total += Number.parseInt(result.rows[0]?.count ?? '0', 10);
      }

      if (filter.source === 'all' || filter.source === 'root_logs') {
        const { whereClause, params } = this.buildRootLogsWhereClause(filter);
        const result = await client.query<{ count: string }>(
          `SELECT COUNT(*) as count FROM root_logs r ${whereClause}`,
          params,
        );
        total += Number.parseInt(result.rows[0]?.count ?? '0', 10);
      }

      return total;
    } finally {
      try {
        await this.clearRlsContext(client);
      } catch {
        // Ignore cleanup errors
      }
      client.release();
    }
  }

  /**
   * Get export metadata for TXT header.
   */
  async getExportMetadata(
    filter: LogFilterParams,
    tenantName?: string,
  ): Promise<ExportMetadata> {
    const totalEntries = await this.countLogs(filter);

    return {
      tenantId: filter.tenantId,
      tenantName,
      dateFrom: filter.dateFrom.toISOString(),
      dateTo: filter.dateTo.toISOString(),
      generatedAt: new Date().toISOString(),
      totalEntries,
      source: filter.source,
    };
  }

  /**
   * Set RLS context on connection.
   * MUST be called before any tenant-scoped query!
   *
   * Uses is_local=false to persist for entire connection session
   * (not just transaction, since cursors may span multiple read operations).
   */
  private async setRlsContext(client: PoolClient, tenantId: number): Promise<void> {
    await client.query(`SELECT set_config('app.tenant_id', $1::text, false)`, [
      String(tenantId),
    ]);
    this.logger.debug(`Set RLS context: app.tenant_id = ${tenantId}`);
  }

  /**
   * Clear RLS context when done (defense in depth).
   * Prevents context leaking to next pool user.
   */
  private async clearRlsContext(client: PoolClient): Promise<void> {
    await client.query(`SELECT set_config('app.tenant_id', '', false)`);
    this.logger.debug('Cleared RLS context');
  }

  /**
   * Stream logs from audit_trail table using cursor.
   *
   * Note: pg-cursor has incomplete TypeScript types, requiring type casts.
   */
  private async *streamFromAuditTrail(
    client: PoolClient,
    filter: LogFilterParams,
  ): AsyncGenerator<UnifiedLogEntry> {
    const { whereClause, params } = this.buildAuditTrailWhereClause(filter);

    const query = `
      SELECT
        id, tenant_id, user_id, user_name, user_role,
        action, resource_type, resource_id, resource_name,
        changes, ip_address, user_agent, status, error_message, created_at
      FROM audit_trail
      ${whereClause}
      ORDER BY created_at DESC
    `;

    
    const cursor: Cursor<AuditTrailRow> = client.query(new Cursor(query, params));

    try {
      let rows: AuditTrailRow[] = await cursor.read(CURSOR_BATCH_SIZE);
      while (rows.length > 0) {
        for (const row of rows) {
          yield this.mapAuditTrailRow(row);
        }
        rows = await cursor.read(CURSOR_BATCH_SIZE);
      }
    } finally {
      await cursor.close();
    }

  }

  /**
   * Stream logs from root_logs table using cursor.
   * No JOINs — user_name and user_role are denormalized columns.
   * COALESCE preserves the "First Last" format from before denormalization.
   *
   * Note: pg-cursor has incomplete TypeScript types, requiring type casts.
   */
  private async *streamFromRootLogs(
    client: PoolClient,
    filter: LogFilterParams,
  ): AsyncGenerator<UnifiedLogEntry> {
    const { whereClause, params } = this.buildRootLogsWhereClause(filter);

    const query = `
      SELECT
        r.id, r.tenant_id, r.user_id,
        COALESCE(r.first_name || ' ' || r.last_name, r.user_name, 'Unknown') as user_name,
        r.user_role,
        r.action, r.entity_type, r.entity_id,
        r.details, r.old_values, r.new_values, r.ip_address, r.user_agent,
        r.was_role_switched, r.is_active, r.created_at
      FROM root_logs r
      ${whereClause}
      ORDER BY r.created_at DESC
    `;


    const cursor: Cursor<RootLogsRow> = client.query(new Cursor(query, params));

    try {
      let rows: RootLogsRow[] = await cursor.read(CURSOR_BATCH_SIZE);
      while (rows.length > 0) {
        for (const row of rows) {
          yield this.mapRootLogsRow(row);
        }
        rows = await cursor.read(CURSOR_BATCH_SIZE);
      }
    } finally {
      await cursor.close();
    }

  }

  /**
   * Build WHERE clause for audit_trail queries.
   * Always includes tenant_id as defense-in-depth (even with RLS).
   */
  private buildAuditTrailWhereClause(filter: LogFilterParams): {
    whereClause: string;
    params: unknown[];
  } {
    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [filter.tenantId];
    let paramIndex = 2;

    // Date range filter (required)
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filter.dateFrom);

    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(filter.dateTo);

    // Optional filters
    if (filter.action !== undefined) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(filter.action);
    }

    if (filter.userId !== undefined) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(filter.userId);
    }

    if (filter.entityType !== undefined) {
      // eslint-disable-next-line no-useless-assignment -- paramIndex++ kept for consistency so adding a new filter won't reuse the same index
      conditions.push(`resource_type = $${paramIndex++}`);
      params.push(filter.entityType);
    }

    return {
      whereClause: `WHERE ${conditions.join(' AND ')}`,
      params,
    };
  }

  /**
   * Build WHERE clause for root_logs queries.
   * Always includes tenant_id as defense-in-depth (even with RLS).
   * Excludes soft-deleted records (is_active = 4).
   * Uses 'r.' prefix for table alias in JOIN query.
   */
  private buildRootLogsWhereClause(filter: LogFilterParams): {
    whereClause: string;
    params: unknown[];
  } {
    const conditions: string[] = [
      'r.tenant_id = $1',
      `(r.is_active IS NULL OR r.is_active != ${IS_ACTIVE.DELETED})`, // Exclude soft-deleted
    ];
    const params: unknown[] = [filter.tenantId];
    let paramIndex = 2;

    // Date range filter (required)
    conditions.push(`r.created_at >= $${paramIndex++}`);
    params.push(filter.dateFrom);

    conditions.push(`r.created_at <= $${paramIndex++}`);
    params.push(filter.dateTo);

    // Optional filters
    if (filter.action !== undefined) {
      conditions.push(`r.action = $${paramIndex++}`);
      params.push(filter.action);
    }

    if (filter.userId !== undefined) {
      conditions.push(`r.user_id = $${paramIndex++}`);
      params.push(filter.userId);
    }

    if (filter.entityType !== undefined) {
      // eslint-disable-next-line no-useless-assignment -- paramIndex++ kept for consistency so adding a new filter won't reuse the same index
      conditions.push(`r.entity_type = $${paramIndex++}`);
      params.push(filter.entityType);
    }

    return {
      whereClause: `WHERE ${conditions.join(' AND ')}`,
      params,
    };
  }

  private mapAuditTrailRow(row: AuditTrailRow): UnifiedLogEntry {
    return {
      id: row.id,
      timestamp: row.created_at.toISOString(),
      tenantId: row.tenant_id,
      userId: row.user_id,
      userName: row.user_name ?? 'Unknown',
      userRole: row.user_role ?? '',
      source: 'audit_trail',
      action: row.action,
      entityType: row.resource_type,
      entityId: row.resource_id ?? undefined,
      details: row.resource_name ?? undefined,
      ipAddress: row.ip_address ?? undefined,
      status: row.status === 'failure' ? 'failure' : 'success',
      changes: this.safeJsonParse(row.changes),
    };
  }

  /**
   * Map root_logs row to UnifiedLogEntry.
   * user_name comes from COALESCE(first_name||last_name, user_name) — denormalized columns.
   */
  private mapRootLogsRow(row: RootLogsRow): UnifiedLogEntry {
    return {
      id: row.id,
      timestamp: row.created_at.toISOString(),
      tenantId: row.tenant_id,
      userId: row.user_id,
      userName: row.user_name ?? 'Unknown',
      userRole: row.user_role ?? '',
      source: 'root_logs',
      action: row.action,
      entityType: row.entity_type ?? '',
      entityId: row.entity_id ?? undefined,
      details: row.details ?? undefined,
      ipAddress: row.ip_address ?? undefined,
      status: 'success', // root_logs doesn't have status field
      oldValues: this.safeJsonParse(row.old_values),
      newValues: this.safeJsonParse(row.new_values),
      wasRoleSwitched: row.was_role_switched,
    };
  }

  private safeJsonParse(value: string | null | undefined): Record<string, unknown> | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    // If already an object (JSONB auto-parsed), return as-is
    if (typeof value === 'object') {
      return value as Record<string, unknown>;
    }

    try {
      const parsed: unknown = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  }
}
