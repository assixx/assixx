/**
 * Database utility functions with proper TypeScript support
 * Handles both real Pool and MockDatabase seamlessly
 */

import {
  RowDataPacket,
  ResultSetHeader,
  FieldPacket,
  PoolConnection,
} from "mysql2/promise";

import pool from "../database";

/**
 * Type-safe database query function
 * @param sql SQL query string
 * @param params Query parameters
 * @returns Promise with query result and fields
 */
export async function query<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params?: unknown[],
): Promise<[T, FieldPacket[]]> {
  // Handle both Pool and MockDatabase
  if ("query" in pool && typeof pool.query === "function") {
    const result = await (
      pool as unknown as import("mysql2/promise").Pool
    ).query(sql, params);

    // MySQL2 always returns [rows, fields] tuple
    if (Array.isArray(result) && result.length === 2) {
      return result as [T, FieldPacket[]];
    }

    // MockDatabase might return data directly, wrap it
    return [result as unknown as T, []];
  }

  throw new Error("Database pool not properly initialized");
}

/**
 * Type-safe database execute function (for prepared statements)
 * @param sql SQL query string
 * @param params Query parameters
 * @returns Promise with query result and fields
 */
export async function execute<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params?: unknown[],
): Promise<[T, FieldPacket[]]> {
  // Handle both Pool and MockDatabase
  if ("execute" in pool && typeof pool.execute === "function") {
    const result = await (
      pool as unknown as import("mysql2/promise").Pool
    ).execute(sql, params);

    // MySQL2 always returns [rows, fields] tuple
    if (Array.isArray(result) && result.length === 2) {
      return result as [T, FieldPacket[]];
    }

    // MockDatabase might return data directly, wrap it
    return [result as unknown as T, []];
  }

  // Fallback to query for MockDatabase
  return query<T>(sql, params);
}

/**
 * Get a database connection from the pool
 * @returns Promise with PoolConnection
 */
export async function getConnection(): Promise<PoolConnection> {
  if ("getConnection" in pool && typeof pool.getConnection === "function") {
    return (await pool.getConnection()) as PoolConnection;
  }

  throw new Error("Database pool does not support connections");
}

/**
 * Transaction helper function
 * @param callback Transaction callback function
 * @returns Promise with transaction result
 */
export async function transaction<T>(
  callback: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Export types for convenience
export type { RowDataPacket, ResultSetHeader, FieldPacket, PoolConnection };
