/**
 * E2E Escrow DI tokens — leaf file to avoid service<->module import cycles.
 *
 * Mirrors the pattern in `auth/oauth/oauth.tokens.ts`. Adding a new shared
 * token here keeps module providers and services de-coupled.
 *
 * @see ADR-022 (E2E Key Escrow)
 * @see ADR-050 (cross-origin handoff — unlock tickets are its ADR-022-twin)
 */

/**
 * DI token for the E2E-escrow-scoped Redis client. Separate keyspace
 * (`escrow:` prefix) from oauth (`oauth:`) and throttler so a `FLUSHDB` on
 * one does not nuke the others in dev. Single-use unlock tickets live under
 * `escrow:unlock:{uuidv7}` with a 60-second TTL.
 */
export const ESCROW_REDIS_CLIENT = Symbol('ESCROW_REDIS_CLIENT');
