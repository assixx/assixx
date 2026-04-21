/**
 * Injection token for the Redis client used by
 * `TenantHostResolverMiddleware`.
 *
 * Kept in a leaf file (no imports back into the middleware or module) so
 * the token can be referenced from either side without risk of an import
 * cycle. Mirrors the pattern established in
 * `backend/src/nest/auth/oauth/oauth.tokens.ts`.
 *
 * Keyspace (with the module's `keyPrefix: 'tenant:'`):
 *   `tenant:slug:<slug>` → tenant id as decimal string
 *
 * TTL: 60 s. Chosen because it bounds the R13 cache-poisoning blast-radius
 * (ADR-050 §Architectural Risks) while staying long enough to amortise the
 * hot-path DB lookup across a burst of requests from the same subdomain.
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §R13
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 2 Step 2.2
 */
export const TENANT_HOST_REDIS_CLIENT = 'TENANT_HOST_REDIS_CLIENT' as const;
