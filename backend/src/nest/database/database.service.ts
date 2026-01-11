/**
 * Database Service
 *
 * Provides database operations using raw PostgreSQL queries.
 * Integrates with ClsService for automatic tenant context.
 * Supports RLS (Row-Level Security) for multi-tenant isolation.
 *
 * IMPORTANT: Uses PostgreSQL $1, $2, $3 placeholders (NOT MySQL's ?)
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { PoolClient, QueryResultRow } from 'pg';
import { Pool } from 'pg';

import { PG_POOL } from './database.constants.js';

/**
 * Options for database transactions
 */
interface TransactionOptions {
  /** Tenant ID for RLS context */
  tenantId?: number | undefined;
  /** User ID for RLS context */
  userId?: number | undefined;
}

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly cls: ClsService,
  ) {}

  /**
   * Execute a simple query without transaction
   * WARNING: Does NOT set RLS context - use transaction() for tenant-isolated queries
   *
   * @param sql - SQL query with $1, $2, $3 placeholders
   * @param params - Query parameters
   * @returns Query result rows
   */
  async query<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }

  /**
   * Execute a query and return the first row
   *
   * @param sql - SQL query with $1, $2, $3 placeholders
   * @param params - Query parameters
   * @returns First row or null
   */
  async queryOne<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  /**
   * Execute a database transaction with RLS context
   *
   * @param callback - Function to execute within transaction
   * @param options - Transaction options (tenantId, userId)
   * @returns Result from callback
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Set RLS context
      const tenantId = options?.tenantId;
      const userId = options?.userId;

      if (tenantId !== undefined) {
        await this.setTenantContext(client, tenantId);
      }

      if (userId !== undefined) {
        await this.setUserContext(client, userId);
      }

      const result = await callback(client);

      await client.query('COMMIT');
      return result;
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      this.logger.error('Transaction failed, rolled back', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute a transaction using tenant context from CLS
   * Automatically reads tenantId and userId from request context
   *
   * @param callback - Function to execute within transaction
   * @returns Result from callback
   */
  async tenantTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const tenantId = this.cls.get<number | undefined>('tenantId');
    const userId = this.cls.get<number | undefined>('userId');

    if (tenantId === undefined) {
      this.logger.warn('tenantTransaction called without tenantId in CLS context');
    }

    return await this.transaction(callback, { tenantId, userId });
  }

  /**
   * Set tenant context for RLS policies
   * Sets the app.tenant_id GUC variable for the current transaction
   *
   * @param client - Database client
   * @param tenantId - Tenant ID
   */
  async setTenantContext(client: PoolClient, tenantId: number): Promise<void> {
    await client.query(`SELECT set_config('app.tenant_id', $1::text, true)`, [String(tenantId)]);
  }

  /**
   * Set user context for RLS policies
   * Sets the app.user_id GUC variable for the current transaction
   *
   * @param client - Database client
   * @param userId - User ID
   */
  async setUserContext(client: PoolClient, userId: number): Promise<void> {
    await client.query(`SELECT set_config('app.user_id', $1::text, true)`, [String(userId)]);
  }

  /**
   * Get current tenant ID from CLS context
   *
   * @returns Tenant ID or undefined if not set
   */
  getTenantId(): number | undefined {
    return this.cls.get<number | undefined>('tenantId');
  }

  /**
   * Get current user ID from CLS context
   *
   * @returns User ID or undefined if not set
   */
  getUserId(): number | undefined {
    return this.cls.get<number | undefined>('userId');
  }

  /**
   * Generate bulk INSERT placeholders
   *
   * @param rowCount - Number of rows
   * @param columnsPerRow - Columns per row
   * @param startIndex - Starting placeholder index (default 1)
   * @returns Object with placeholders string and next index
   *
   * @example
   * generateBulkPlaceholders(3, 2, 1)
   * // Returns placeholders: '($1, $2), ($3, $4), ($5, $6)', nextIndex: 7
   */
  generateBulkPlaceholders(
    rowCount: number,
    columnsPerRow: number,
    startIndex: number = 1,
  ): { placeholders: string; nextIndex: number } {
    const rows: string[] = [];
    let currentIndex = startIndex;

    for (let i = 0; i < rowCount; i++) {
      const columns: string[] = [];
      for (let j = 0; j < columnsPerRow; j++) {
        columns.push(`$${currentIndex}`);
        currentIndex++;
      }
      rows.push(`(${columns.join(', ')})`);
    }

    return {
      placeholders: rows.join(', '),
      nextIndex: currentIndex,
    };
  }

  /**
   * Generate IN clause placeholders
   *
   * @param count - Number of values
   * @param startIndex - Starting placeholder index (default 1)
   * @returns Object with placeholders string and next index
   *
   * @example
   * generateInPlaceholders(3, 1)
   * // Returns placeholders: '$1, $2, $3', nextIndex: 4
   */
  generateInPlaceholders(
    count: number,
    startIndex: number = 1,
  ): { placeholders: string; nextIndex: number } {
    const placeholders: string[] = [];
    for (let i = 0; i < count; i++) {
      placeholders.push(`$${startIndex + i}`);
    }

    return {
      placeholders: placeholders.join(', '),
      nextIndex: startIndex + count,
    };
  }

  /**
   * Close the connection pool
   * Called on application shutdown
   */
  async closePool(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Health check for database connection
   *
   * @returns True if database is reachable
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
