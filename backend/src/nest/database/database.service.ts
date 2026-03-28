/**
 * Database Service
 *
 * Provides database operations using raw PostgreSQL queries.
 * Integrates with ClsService for automatic tenant context.
 * Supports RLS (Row-Level Security) for multi-tenant isolation.
 *
 * IMPORTANT: Uses PostgreSQL $1, $2, $3 placeholders (NOT MySQL's ?)
 */
import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { PoolClient, QueryResultRow } from 'pg';
import { Pool } from 'pg';

import { PG_POOL } from './database.constants.js';

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
   * Execute a simple query without transaction.
   * WARNING: Does NOT set RLS context - use transaction() for tenant-isolated queries
   */
  async query<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }

  async queryOne<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  /** Execute a database transaction with RLS context */
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

      // HttpExceptions are intentional business-logic rejections (e.g. ConflictException 409),
      // not DB failures — log at debug level to avoid ERROR noise and Sentry triggers
      if (error instanceof HttpException) {
        this.logger.debug(
          `Transaction rolled back (HTTP ${String(error.getStatus())}: ${error.message})`,
        );
      } else {
        this.logger.error('Transaction failed, rolled back', error);
      }

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute a transaction using tenant context from CLS.
   * Automatically reads tenantId and userId from request context
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
   * Set tenant context for RLS policies.
   * Sets the app.tenant_id GUC variable for the current transaction
   */
  async setTenantContext(client: PoolClient, tenantId: number): Promise<void> {
    await client.query(`SELECT set_config('app.tenant_id', $1::text, true)`, [String(tenantId)]);
  }

  /**
   * Set user context for RLS policies.
   * Sets the app.user_id GUC variable for the current transaction
   */
  async setUserContext(client: PoolClient, userId: number): Promise<void> {
    await client.query(`SELECT set_config('app.user_id', $1::text, true)`, [String(userId)]);
  }

  getTenantId(): number | undefined {
    return this.cls.get<number | undefined>('tenantId');
  }

  getUserId(): number | undefined {
    return this.cls.get<number | undefined>('userId');
  }

  /**
   * Generate bulk INSERT placeholders
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

  async isHealthy(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
