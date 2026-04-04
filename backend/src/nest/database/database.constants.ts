/**
 * Database Constants
 *
 * Injection tokens for database providers.
 * Separated to avoid circular dependencies.
 */

/** Injection token for PostgreSQL Pool (app_user — RLS enforced) */
export const PG_POOL = 'PG_POOL';

/** Injection token for System PostgreSQL Pool (sys_user — BYPASSRLS) */
export const SYSTEM_POOL = 'SYSTEM_POOL';
