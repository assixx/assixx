/**
 * PostgreSQL Database Utilities
 * Pure PostgreSQL implementation - NO MySQL compatibility layer
 *
 * IMPORTANT: All SQL queries MUST use PostgreSQL $1, $2, $3 placeholders
 * Example: SELECT * FROM users WHERE id = ? AND tenant_id = $2
 */
import { Pool, PoolClient, QueryResultRow } from 'pg';

import pool, { setTenantContext } from '../config/database.js';

/**
 * Result header for INSERT/UPDATE/DELETE operations
 */
export interface ResultSetHeader {
  affectedRows: number;
  insertId: number;
  rowCount: number;
}

/**
 * Field metadata from query result
 */
export interface FieldPacket {
  name: string;
  dataTypeID: number;
}

/**
 * PostgreSQL PoolConnection interface
 */
export interface PoolConnection {
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
  execute<T extends QueryResultRow[] | ResultSetHeader>(
    sql: string,
    params?: unknown[],
  ): Promise<[T, FieldPacket[]]>;
  query<T extends QueryResultRow[] | ResultSetHeader>(
    sql: string,
    params?: unknown[],
  ): Promise<[T, FieldPacket[]]>;
}

/**
 * Process query result into standard format
 */
function processQueryResult<T extends QueryResultRow[] | ResultSetHeader>(
  sql: string,
  result: {
    rows: QueryResultRow[];
    rowCount: number | null;
    fields?: { name: string; dataTypeID: number }[];
  },
): [T, FieldPacket[]] {
  const isSelect = sql.trim().toUpperCase().startsWith('SELECT');

  if (isSelect) {
    const fields: FieldPacket[] =
      result.fields?.map((f: { name: string; dataTypeID: number }) => ({
        name: f.name,
        dataTypeID: f.dataTypeID,
      })) ?? [];
    return [result.rows as T, fields];
  } else {
    const firstRow = result.rows[0] as { id?: number } | undefined;
    const header: ResultSetHeader = {
      affectedRows: result.rowCount ?? 0,
      insertId: firstRow?.id ?? 0,
      rowCount: result.rowCount ?? 0,
    };
    return [header as T, []];
  }
}

/**
 * Wrap a PoolClient with transaction methods
 */
function wrapClient(client: PoolClient): PoolConnection {
  const originalQuery = client.query.bind(client);

  return {
    beginTransaction: async () => {
      await originalQuery('BEGIN');
    },
    commit: async () => {
      await originalQuery('COMMIT');
    },
    rollback: async () => {
      await originalQuery('ROLLBACK');
    },
    release: () => {
      client.release();
    },
    query: async <T extends QueryResultRow[] | ResultSetHeader>(
      sql: string,
      params?: unknown[],
    ): Promise<[T, FieldPacket[]]> => {
      const result = await originalQuery(sql, params);
      return processQueryResult<T>(sql, result);
    },
    execute: async <T extends QueryResultRow[] | ResultSetHeader>(
      sql: string,
      params?: unknown[],
    ): Promise<[T, FieldPacket[]]> => {
      const result = await originalQuery(sql, params);
      return processQueryResult<T>(sql, result);
    },
  };
}

/**
 * Execute a SQL query
 *
 * @param sql - SQL query with $1, $2, $3 placeholders (PostgreSQL native)
 * @param params - Query parameters
 * @returns Promise with [rows, fields] tuple
 *
 * @example
 * // SELECT query
 * const [users] = await query\<User[]\>('SELECT * FROM users WHERE id = $1', [userId]);
 *
 * // INSERT query
 * const [result] = await query<ResultSetHeader>(
 *   'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id',
 *   [name, email]
 * );
 */
export async function query<T extends QueryResultRow[] | ResultSetHeader>(
  sql: string,
  params?: unknown[],
): Promise<[T, FieldPacket[]]> {
  const client = await pool.connect();

  try {
    const result = await client.query(sql, params);
    // Check for queries that return rows:
    // - SELECT: standard queries
    // - WITH: Common Table Expressions (CTEs)
    // - TABLE: PostgreSQL shorthand for SELECT * FROM
    // - EXPLAIN: query plan analysis
    // - VALUES: standalone values list
    const sqlUpper = sql.trim().toUpperCase();
    const isSelect =
      sqlUpper.startsWith('SELECT') ||
      sqlUpper.startsWith('WITH') ||
      sqlUpper.startsWith('TABLE') ||
      sqlUpper.startsWith('EXPLAIN') ||
      sqlUpper.startsWith('VALUES');

    if (isSelect) {
      const fields: FieldPacket[] = result.fields.map(
        (f: { name: string; dataTypeID: number }) => ({
          name: f.name,
          dataTypeID: f.dataTypeID,
        }),
      );
      return [result.rows as T, fields];
    } else {
      const firstRow = result.rows[0] as { id?: number } | undefined;
      const header: ResultSetHeader = {
        affectedRows: result.rowCount ?? 0,
        insertId: firstRow?.id ?? 0,
        rowCount: result.rowCount ?? 0,
      };
      return [header as T, []];
    }
  } finally {
    client.release();
  }
}

/**
 * Execute a SQL statement (alias for query)
 */
export async function execute<T extends QueryResultRow[] | ResultSetHeader>(
  sql: string,
  params?: unknown[],
): Promise<[T, FieldPacket[]]> {
  return await query<T>(sql, params);
}

/**
 * Get a database connection from the pool
 */
export async function getConnection(): Promise<PoolConnection> {
  const client = await pool.connect();
  return wrapClient(client);
}

/**
 * Execute callback within a transaction
 *
 * @param callback - Transaction callback
 * @param tenantId - Optional tenant ID for RLS context
 */
export async function transaction<T>(
  callback: (connection: PoolConnection) => Promise<T>,
  tenantId?: number,
): Promise<T> {
  const client = await pool.connect();
  const wrapped = wrapClient(client);

  try {
    await client.query('BEGIN');

    if (tenantId !== undefined && tenantId > 0) {
      await setTenantContext(client, tenantId);
    }

    const result = await callback(wrapped);
    await client.query('COMMIT');
    return result;
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Generate PostgreSQL bulk insert placeholders
 * @param rowCount - Number of rows to insert
 * @param columnsPerRow - Number of columns per row
 * @param startIndex - Starting parameter index (default 1)
 * @returns Object with placeholders string and next param index
 *
 * @example
 * const result = generateBulkPlaceholders(3, 4);
 * // Returns placeholders: "($1, $2, $3, $4), ($5, $6, $7, $8), ($9, $10, $11, $12)"
 */
export function generateBulkPlaceholders(
  rowCount: number,
  columnsPerRow: number,
  startIndex: number = 1,
): { placeholders: string; nextIndex: number } {
  const rows: string[] = [];
  let paramIndex = startIndex;

  for (let i = 0; i < rowCount; i++) {
    const cols: string[] = [];
    for (let j = 0; j < columnsPerRow; j++) {
      cols.push(`$${paramIndex}`);
      paramIndex++;
    }
    rows.push(`(${cols.join(', ')})`);
  }

  return {
    placeholders: rows.join(', '),
    nextIndex: paramIndex,
  };
}

/**
 * Generate PostgreSQL IN clause placeholders
 * @param count - Number of values
 * @param startIndex - Starting parameter index (default 1)
 * @returns Object with placeholders string and next param index
 *
 * @example
 * const result = generateInPlaceholders(3);
 * // Returns placeholders: "$1, $2, $3"
 */
export function generateInPlaceholders(
  count: number,
  startIndex: number = 1,
): { placeholders: string; nextIndex: number } {
  const params: string[] = [];
  for (let i = 0; i < count; i++) {
    params.push(`$${startIndex + i}`);
  }
  return {
    placeholders: params.join(', '),
    nextIndex: startIndex + count,
  };
}

// Re-export types
export type { Pool, PoolClient, QueryResultRow };

/**
 * RowDataPacket type for query results
 */
// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style -- Interface with index signature is needed for intersection types in query results
export interface RowDataPacket extends QueryResultRow {
  [key: string]: unknown;
}
