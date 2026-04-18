/**
 * Tenant Domains — Client-Side API Calls
 *
 * Wraps `apiClient` (auto-unwraps backend's ResponseInterceptor `{success, data}`).
 * Errors surface as `ApiError` with `.code` / `.status` / `.details` per
 * `$lib/utils/api-client.types` — caller (state-data + page) maps codes to
 * German UI messages.
 *
 * Convention matches `frontend/src/routes/(app)/(root)/settings/organigram/_lib/api.ts`.
 *
 * @see masterplan §5.1, §2.7 (controller endpoints + throttle tiers)
 */
import { getApiClient } from '$lib/utils/api-client.js';

import type { TenantDomain } from './types.js';

/** GET /api/v2/domains — primary-first sorted active rows for current tenant. */
export async function fetchDomains(): Promise<TenantDomain[]> {
  const api = getApiClient();
  return await api.get<TenantDomain[]>('/domains');
}

/**
 * POST /api/v2/domains — add a new pending domain.
 *
 * Returns the row WITH `verificationInstructions` attached. These are surfaced
 * ONLY on this response per masterplan §0.2.5 #10; subsequent list/get calls
 * omit them. The caller MUST capture + display them immediately, otherwise the
 * user has to re-derive the TXT host/value from the (unhashed) token elsewhere.
 *
 * Backend gates: `validateBusinessDomain()` (RFC-1035 + freemail/disposable)
 * fires BEFORE the INSERT — invalid domains throw `ApiError` with code
 * `INVALID_DOMAIN_FORMAT` / `DISPOSABLE_DOMAIN` / `FREE_EMAIL_PROVIDER` per §2.5.
 */
export async function addDomain(domain: string): Promise<TenantDomain> {
  const api = getApiClient();
  return await api.post<TenantDomain>('/domains', { domain });
}

/**
 * POST /api/v2/domains/:id/verify — trigger DNS TXT verification.
 *
 * Idempotent: already-verified rows return as-is without re-resolving DNS.
 * Throttled at the dedicated `domain-verify` tier (10 req / 10 min per §2.7,
 * v0.3.2 M3) — UI should not auto-retry on 429.
 */
export async function verifyDomain(id: string): Promise<TenantDomain> {
  const api = getApiClient();
  return await api.post<TenantDomain>(`/domains/${id}/verify`, {});
}

/**
 * PATCH /api/v2/domains/:id/primary — flip primary marker.
 *
 * Returns 204 No Content (backend's 2-statement transaction: clear existing
 * primary, then set target — required by partial UNIQUE
 * `tenant_domains_one_primary_per_tenant` per §2.5).
 */
export async function setPrimaryDomain(id: string): Promise<void> {
  const api = getApiClient();
  await api.patch(`/domains/${id}/primary`, {});
}

/** DELETE /api/v2/domains/:id — soft-delete (`is_active = 4`). Returns 204. */
export async function removeDomain(id: string): Promise<void> {
  const api = getApiClient();
  await api.delete(`/domains/${id}`);
}
