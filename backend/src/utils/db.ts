/**
 * Database utility functions with proper TypeScript support
 * Handles both real Pool and MockDatabase seamlessly
 */
import { FieldPacket, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import pool from '../config/database.js';

/**
 * Type-safe database query function
 * @param sql - SQL query string
 * @param params - Query parameters
 * @returns Promise with query result and fields
 */
export async function query<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params?: unknown[],
): Promise<[T, FieldPacket[]]> {
  // Handle both Pool and MockDatabase
  if ('query' in pool && typeof pool.query === 'function') {
    // lgtm[js/sql-injection] - False positive: This is a low-level DB utility function
    // codeql-ignore[js/sql-injection]: Parameters are properly escaped via mysql2's parameterized queries
    // SECURITY: Always use parameterized queries with the params array to prevent SQL injection
    const result = await (pool as unknown as import('mysql2/promise').Pool).query(sql, params);

    // MySQL2 always returns [rows, fields] tuple
    if (Array.isArray(result)) {
      return result as [T, FieldPacket[]];
    }

    // MockDatabase might return data directly, wrap it
    return [result as unknown as T, []];
  }

  throw new Error('Database pool not properly initialized');
}

/**
 * Type-safe database execute function (for prepared statements)
 * @param sql - SQL query string
 * @param params - Query parameters
 * @returns Promise with query result and fields
 */
export async function execute<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params?: unknown[],
): Promise<[T, FieldPacket[]]> {
  // Handle both Pool and MockDatabase
  if ('execute' in pool && typeof pool.execute === 'function') {
    // lgtm[js/sql-injection] - False positive: This is a low-level DB utility function
    // codeql-ignore[js/sql-injection]: Prepared statements with proper parameter binding
    // SECURITY: This uses prepared statements which are safe against SQL injection
    const result = await (pool as unknown as import('mysql2/promise').Pool).execute(sql, params);

    // MySQL2 always returns [rows, fields] tuple
    if (Array.isArray(result)) {
      return result as [T, FieldPacket[]];
    }

    // MockDatabase might return data directly, wrap it
    return [result as unknown as T, []];
  }

  // Fallback to query for MockDatabase
  return await query<T>(sql, params);
}

/**
 * Get a database connection from the pool
 * @returns Promise with PoolConnection
 */
export async function getConnection(): Promise<PoolConnection> {
  if ('getConnection' in pool && typeof pool.getConnection === 'function') {
    return (await pool.getConnection()) as PoolConnection;
  }

  throw new Error('Database pool does not support connections');
}

/**
 * Get a transactional database connection
 * @returns Promise with connection that has transaction methods
 */
export async function getTransactionConnection(): Promise<{
  connection: PoolConnection;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
  release: () => void;
}> {
  const connection = await getConnection();

  await connection.beginTransaction();

  return {
    connection,
    commit: async () => {
      await connection.commit();
    },
    rollback: async () => {
      await connection.rollback();
    },
    release: () => {
      connection.release();
    },
  };
}

/**
 * Transaction helper function
 * @param callback - Transaction callback function
 * @returns Promise with transaction result
 *
 * NOTE: The callback pattern is intentional here as it guarantees proper
 * connection handling with automatic rollback on error and release in finally.
 * This is a proven pattern used by many database libraries (Knex, TypeORM, etc.)
 */

export async function transaction<T>(
  // eslint-disable-next-line promise/prefer-await-to-callbacks -- See function comment
  callback: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();
    // eslint-disable-next-line promise/prefer-await-to-callbacks -- Executing the transaction callback
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Export types for convenience
export type { RowDataPacket, ResultSetHeader, FieldPacket, PoolConnection };
