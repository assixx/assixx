/**
 * OAuth DI tokens — extracted into a leaf file (no imports from sibling OAuth code)
 * to break the dependency cycle between `oauth.module.ts` (provides the token) and
 * services like `oauth-state.service.ts` (inject the token).
 *
 * Adding a new shared token? Put it here, NOT in oauth.module.ts.
 *
 * @see docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md (Phase 2)
 */

/**
 * DI token for the OAuth-scoped Redis client. Separate keyspace (`oauth:` prefix)
 * from the throttler client so a `FLUSHDB` on one does not nuke the other in dev.
 */
export const OAUTH_REDIS_CLIENT = Symbol('OAUTH_REDIS_CLIENT');
