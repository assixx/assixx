/**
 * Tenant Database Module (PostgreSQL + RLS)
 *
 * With PostgreSQL Row Level Security (RLS), we no longer need separate
 * database connections per tenant. The main database pool handles everything,
 * and RLS policies automatically filter data by tenant_id.
 *
 * This module is kept for backward compatibility with existing code that
 * passes tenantDb as a parameter.
 */
import { Pool } from 'pg';

import pool from '../config/database.js';

// Export the main pool - RLS handles tenant isolation
export function createTenantConnection(_tenantId: string): Pool {
  // With RLS, we use the same pool for all tenants
  // Tenant isolation is enforced at the database level
  return pool;
}

/**
 * No longer needed with PostgreSQL + RLS
 * RLS policies handle tenant isolation automatically
 */
export function initializeTenantDatabase(_tenantId: string): void {
  // No-op: PostgreSQL + RLS doesn't need per-tenant databases
}

/**
 * Close all connections (delegates to main pool)
 */
export function closeAllConnections(): void {
  // Main pool closure is handled by database.ts
}
