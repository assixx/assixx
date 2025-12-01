/**
 * PostgreSQL Database Type Definitions
 */
import { Pool, PoolClient, QueryResultRow } from 'pg';

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

export interface MockDatabase {
  query(sql: string, params?: unknown[]): Promise<{ rows: QueryResultRow[]; rowCount: number }>;
  connect(): Promise<PoolClient>;
  end(): Promise<void>;
  on(event: string, callback: (err: Error) => void): MockDatabase;
}

export type DatabasePool = Pool | MockDatabase;

// Helper type to extract result type from query
export type QueryResult<T = QueryResultRow> = T[];
export interface QueryResultWithMeta<T = QueryResultRow> {
  rows: T[];
  rowCount: number;
}
