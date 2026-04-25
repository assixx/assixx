/**
 * Injection token for the dedicated Redis client used by `TenantsService`
 * for branding cache-through lookups.
 *
 * Kept in a leaf file (no imports back into the module or service) so the
 * token can be referenced without risking an import cycle. Mirrors the
 * `TENANT_HOST_REDIS_CLIENT` pattern in
 * `backend/src/nest/common/middleware/tenant-host-resolver.tokens.ts`.
 *
 * Keyspace (with the module's `keyPrefix: 'tenants-branding:'`):
 *   `tenants-branding:<slug>` → JSON-stringified branding payload
 *
 * TTL: 300 s (5 min). Chosen to match the masterplan's Phase 5 Step 5.3
 * cache spec — long enough to absorb burst traffic during a tenant's login
 * flow, short enough that logo / primary-color edits propagate within
 * a five-minute window.
 *
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 5 Step 5.3
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §"Branding"
 */
export const TENANTS_BRANDING_REDIS_CLIENT = 'TENANTS_BRANDING_REDIS_CLIENT' as const;
