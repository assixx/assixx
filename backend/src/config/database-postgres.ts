/**
 * PostgreSQL Database Configuration
 * Connection pool with RLS (Row Level Security) support
 *
 * IMPORTANT: This module uses 'pg' package for PostgreSQL connections.
 * RLS is enforced at the database level for automatic tenant isolation.
 */
import * as dotenv from 'dotenv';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

import { logger } from '../utils/logger.js';

dotenv.config();

// PostgreSQL connection pool
let pool: Pool | null = null;

/**
 * Initialize PostgreSQL connection pool
 */
function initPool(): Pool {
  if (pool !== null) {
    return pool;
  }

  const config = {
    host: process.env['PG_HOST'] ?? process.env['DB_HOST'] ?? 'assixx-postgres',
    port: Number.parseInt(process.env['PG_PORT'] ?? process.env['DB_PORT'] ?? '5432', 10),
    database: process.env['PG_DATABASE'] ?? process.env['DB_NAME'] ?? 'assixx',
    user: process.env['PG_USER'] ?? 'app_user', // Non-superuser for RLS!
    password: process.env['PG_PASSWORD'] ?? 'AppUserP@ss2025!',
    max: 20, // Maximum connections in pool
    idleTimeoutMillis: 30000, // Close idle connections after 30s
    connectionTimeoutMillis: 5000, // Fail after 5s if no connection available
    allowExitOnIdle: true, // Allow pool to exit when idle (for graceful shutdown)
  };

  logger.info('[PostgreSQL] Initializing connection pool', {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    maxConnections: config.max,
  });

  pool = new Pool(config);

  // Handle pool errors
  pool.on('error', (err: Error) => {
    logger.error('[PostgreSQL] Unexpected pool error:', err);
  });

  // Test connection on startup
  void (async () => {
    try {
      const client = await pool.connect();
      const result = await client.query<{ version: string }>('SELECT version()');
      const versionRow = result.rows[0];
      logger.info('[PostgreSQL] Connection successful:', versionRow?.version ?? 'unknown');
      client.release();
    } catch (error: unknown) {
      logger.error('[PostgreSQL] Connection test failed:', error);
    }
  })();

  return pool;
}

/**
 * Get the PostgreSQL pool instance
 */
export function getPool(): Pool {
  return initPool();
}

/**
 * Set tenant context for RLS (Row Level Security)
 * This MUST be called before any query that needs tenant isolation
 *
 * @param client - The database client
 * @param tenantId - The tenant ID to set
 */
export async function setTenantContext(client: PoolClient, tenantId: number): Promise<void> {
  if (tenantId <= 0 || Number.isNaN(tenantId)) {
    throw new Error(`Invalid tenant ID: ${tenantId}`);
  }
  // Set the session variable for RLS policies
  await client.query('SET app.tenant_id = $1', [tenantId.toString()]);
}

/**
 * Execute a query with automatic tenant context (RLS)
 *
 * @param sql - SQL query string (use $1, $2, etc. for parameters)
 * @param params - Query parameters
 * @param tenantId - Optional tenant ID for RLS context
 * @returns Query result
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
  tenantId?: number,
): Promise<QueryResult<T>> {
  const poolInstance = getPool();
  const client = await poolInstance.connect();

  try {
    // Set tenant context if provided
    if (tenantId !== undefined && tenantId > 0) {
      await setTenantContext(client, tenantId);
    }

    // Execute query with parameters
    return await client.query<T>(sql, params);
  } finally {
    client.release();
  }
}

/**
 * Execute a query and return only the rows
 *
 * @param sql - SQL query string
 * @param params - Query parameters
 * @param tenantId - Optional tenant ID for RLS context
 * @returns Array of rows
 */
export async function queryRows<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
  tenantId?: number,
): Promise<T[]> {
  const result = await query<T>(sql, params, tenantId);
  return result.rows;
}

/**
 * Execute a query and return first row or undefined
 *
 * @param sql - SQL query string
 * @param params - Query parameters
 * @param tenantId - Optional tenant ID for RLS context
 * @returns First row or undefined
 */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
  tenantId?: number,
): Promise<T | undefined> {
  const rows = await queryRows<T>(sql, params, tenantId);
  return rows[0];
}

/**
 * Execute a transaction with automatic tenant context
 *
 * @param tenantId - Tenant ID for RLS context
 * @param callback - Transaction callback function
 * @returns Transaction result
 */
export async function transaction<T>(
  tenantId: number,
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const poolInstance = getPool();
  const client = await poolInstance.connect();

  try {
    await client.query('BEGIN');

    // Set tenant context for the entire transaction
    if (tenantId > 0) {
      await setTenantContext(client, tenantId);
    }

    const result = await callback(client);
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
 * Get a database connection from the pool
 * Remember to release the connection after use!
 *
 * @returns PoolClient
 */
export async function getConnection(): Promise<PoolClient> {
  const poolInstance = getPool();
  return await poolInstance.connect();
}

/**
 * Health check for PostgreSQL connection
 *
 * @returns true if connection is healthy
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT 1 as check');
    return result.rows.length === 1;
  } catch (error: unknown) {
    logger.error('[PostgreSQL] Health check failed:', error);
    return false;
  }
}

/**
 * Close the PostgreSQL pool (for graceful shutdown)
 */
export async function closePool(): Promise<void> {
  const currentPool = pool;
  if (currentPool !== null) {
    logger.info('[PostgreSQL] Closing connection pool');
    pool = null;
    await currentPool.end();
  }
}

// Export pool for advanced usage
export { pool };
