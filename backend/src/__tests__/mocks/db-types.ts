/**
 * Database Type Helpers for Tests
 * Provides type compatibility between mysql2 RowDataPacket and test objects
 */

import { RowDataPacket } from "mysql2";

/**
 * Helper type that extends RowDataPacket while allowing custom properties
 * This resolves the TypeScript error about incompatible constructor.name types
 */
export type TestRowDataPacket<T = any> = T & RowDataPacket;

/**
 * Type guard to check if a value is a RowDataPacket array
 */
export function isRowDataPacketArray(value: unknown): value is RowDataPacket[] {
  return Array.isArray(value) && value.length >= 0;
}

/**
 * Helper function to cast database results to the expected type
 * Use this when destructuring results from db.execute()
 *
 * Example:
 * const [rows] = await db.execute(...);
 * const sessions = asTestRows<SessionType>(rows);
 */
export function asTestRows<T>(rows: unknown): T[] {
  return rows as T[];
}

/**
 * Helper function to cast a single row to the expected type
 */
export function asTestRow<T>(row: unknown): T {
  return row as T;
}
