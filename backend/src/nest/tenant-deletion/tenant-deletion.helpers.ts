/**
 * Shared utility functions for the tenant deletion service split.
 *
 * WHY these are standalone functions (not in a class):
 * - validateTenantId: Pure validation, no state needed
 * - getTablesWithTenantId / getUserRelatedTables: Stateless schema introspection queries
 *   used by executor, exporter, AND analyzer — must be shared without DI coupling
 */
import type { PoolClient } from 'pg';

import { CRITICAL_TABLES, type TableNameRow } from './tenant-deletion.types.js';

/**
 * Validate tenant ID is a positive integer
 * @throws Error if tenantId is invalid
 */
export function validateTenantId(tenantId: number): void {
  if (tenantId <= 0 || !Number.isInteger(tenantId)) {
    throw new Error(
      `INVALID TENANT_ID: ${tenantId} - must be positive integer`,
    );
  }
}

/**
 * Get all tables with tenant_id column.
 * NOTE: Uses PostgreSQL information_schema with table_schema = 'public'
 */
export async function getTablesWithTenantId(
  client: PoolClient,
): Promise<TableNameRow[]> {
  const result = await client.query<TableNameRow>(`
    SELECT DISTINCT table_name AS "TABLE_NAME"
    FROM information_schema.columns
    WHERE column_name = 'tenant_id'
    AND table_schema = 'public'
    AND table_name NOT LIKE 'v_%'
    ORDER BY table_name
  `);
  return result.rows;
}

/**
 * Get user-related tables (with user_id FK), excluding critical tables.
 * NOTE: Uses PostgreSQL information_schema with table_schema = 'public'
 */
export async function getUserRelatedTables(
  client: PoolClient,
): Promise<TableNameRow[]> {
  const criticalTables = [...CRITICAL_TABLES];
  const placeholders = criticalTables
    .map((_: string, idx: number) => `$${idx + 1}`)
    .join(',');

  const result = await client.query<TableNameRow>(
    `SELECT DISTINCT table_name AS "TABLE_NAME"
    FROM information_schema.columns
    WHERE column_name = 'user_id'
    AND table_schema = 'public'
    ${placeholders !== '' ? `AND table_name NOT IN (${placeholders})` : ''}`,
    criticalTables,
  );
  return result.rows;
}
