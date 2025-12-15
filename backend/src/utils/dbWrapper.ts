/**
 * Database wrapper utilities for PostgreSQL
 * Provides a unified interface for database connections
 */
import { QueryResultRow } from 'pg';

import { PoolConnection, ResultSetHeader } from './db.js';

export interface DbConnection {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: QueryResultRow[]; rowCount: number | null }>;
  release(): void;
}

/**
 * ConnectionWrapper provides a consistent interface for database operations
 * Works with PoolConnection from db.ts
 */
export class ConnectionWrapper {
  constructor(private conn: PoolConnection) {}

  async query<T extends QueryResultRow[] = QueryResultRow[]>(
    sql: string,
    params?: unknown[],
  ): Promise<T> {
    const [rows] = await this.conn.query<T>(sql, params);
    return rows;
  }

  async execute(sql: string, params?: unknown[]): Promise<ResultSetHeader> {
    const [result] = await this.conn.execute<ResultSetHeader>(sql, params);
    return result;
  }

  async beginTransaction(): Promise<void> {
    await this.conn.beginTransaction();
  }

  async commit(): Promise<void> {
    await this.conn.commit();
  }

  async rollback(): Promise<void> {
    await this.conn.rollback();
  }

  release(): void {
    this.conn.release();
  }
}

export function wrapConnection(conn: PoolConnection): ConnectionWrapper {
  return new ConnectionWrapper(conn);
}
