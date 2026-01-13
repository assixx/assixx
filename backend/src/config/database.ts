/**
 * PostgreSQL Database Configuration
 * Connection pool with RLS (Row Level Security) support
 */
import * as dotenv from 'dotenv';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

import { logger } from '../utils/logger.js';

dotenv.config();

// Check for mock mode (testing)
const USE_MOCK_DB = process.env['USE_MOCK_DB'] === 'true';

let pool: Pool;

if (USE_MOCK_DB) {
  // Mock implementation for tests
  logger.info('[Database] Using MOCK database for testing');

  // Create a minimal mock that satisfies the Pool interface
  pool = {
    connect: () =>
      Promise.resolve({
        query: () => Promise.resolve({ rows: [], rowCount: 0 }),
        release: (): void => {
          /* no-op for mock */
        },
      }),
    query: () => Promise.resolve({ rows: [], rowCount: 0 }),
    end: () => Promise.resolve(),
    on: () => pool,
  } as unknown as Pool;
} else {
  // Real PostgreSQL connection
  // SECURITY: DB_PASSWORD is required - no default fallback
  const dbPassword = process.env['DB_PASSWORD'];
  if (dbPassword === undefined || dbPassword === '') {
    throw new Error(
      'SECURITY ERROR: DB_PASSWORD environment variable is required. ' +
        'Set it in docker/.env or your environment.',
    );
  }

  const config = {
    host: process.env['DB_HOST'] ?? 'postgres',
    port: Number.parseInt(process.env['DB_PORT'] ?? '5432', 10),
    database: process.env['DB_NAME'] ?? 'assixx',
    user: process.env['DB_USER'] ?? 'app_user',
    password: dbPassword,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };

  logger.info(
    { host: config.host, port: config.port, database: config.database, user: config.user },
    '[PostgreSQL] Connecting to database',
  );

  pool = new Pool(config);

  pool.on('error', (err: Error) => {
    logger.error({ err }, '[PostgreSQL] Pool error');
  });

  // Test connection on startup (non-blocking)
  if (process.env['NODE_ENV'] !== 'test') {
    void (async () => {
      try {
        const client = await pool.connect();
        const result = await client.query<{ version: string }>('SELECT version()');
        const versionRow = result.rows[0];
        const versionInfo = versionRow?.version.split(' ').slice(0, 2).join(' ') ?? 'unknown';
        logger.info(`[PostgreSQL] Connected: ${versionInfo}`);
        client.release();
      } catch (error: unknown) {
        logger.error({ err: error }, '[PostgreSQL] Connection failed');
      }
    })();
  }
}

/**
 * Set tenant context for RLS (Row Level Security)
 * Uses set_config() because SET command doesn't support parameterized queries
 *
 * @param client - PostgreSQL PoolClient
 * @param tenantId - Tenant ID for RLS isolation
 */
export async function setTenantContext(client: PoolClient, tenantId: number): Promise<void> {
  if (tenantId <= 0 || Number.isNaN(tenantId)) {
    throw new Error(`Invalid tenant ID: ${tenantId}`);
  }
  // set_config(name, value, is_local) - is_local=true means transaction-scoped
  await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId.toString()]);
}

/**
 * Set user context for RLS (Row Level Security)
 * Required for participant-based isolation (chat messages, attachments)
 * NEW 2025-12-04: Enables conversation participant checks in RLS policies
 *
 * @param client - PostgreSQL PoolClient
 * @param userId - User ID for RLS participant checks
 */
export async function setUserContext(client: PoolClient, userId: number): Promise<void> {
  if (userId <= 0 || Number.isNaN(userId)) {
    throw new Error(`Invalid user ID: ${userId}`);
  }
  await client.query('SELECT set_config($1, $2, true)', ['app.user_id', userId.toString()]);
}

/**
 * Set both tenant and user context for RLS
 * Convenience function for setting both contexts at once
 * NEW 2025-12-04
 *
 * @param client - PostgreSQL PoolClient
 * @param tenantId - Tenant ID for tenant isolation
 * @param userId - User ID for participant checks
 */
export async function setRLSContext(
  client: PoolClient,
  tenantId: number,
  userId: number,
): Promise<void> {
  await setTenantContext(client, tenantId);
  await setUserContext(client, userId);
}

/**
 * Close pool for graceful shutdown
 */
export async function closePool(): Promise<void> {
  await pool.end();
  logger.info('[PostgreSQL] Pool closed');
}

export default pool;
export { pool };
export type { Pool, PoolClient, QueryResult, QueryResultRow };
