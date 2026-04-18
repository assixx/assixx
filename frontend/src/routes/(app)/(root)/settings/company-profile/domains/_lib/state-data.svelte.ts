/**
 * Tenant Domains — Data State (Svelte 5 Runes)
 *
 * Holds the list of domains for the current tenant + mutation helpers that
 * call `_lib/api.ts` and reflect the result in local state. UI-only state
 * (modal-open, in-flight action ID, instructions panel target) lives in
 * `state-ui.svelte.ts` per the v0.3.4 D24 split.
 *
 * The mutations (addDomain / verifyDomain / setPrimary / removeDomain) are
 * exercised by the §5.4.1 unit tests with `_lib/api.ts` mocked — keep them
 * pure (no DOM, no toast) so the tests can assert on state transitions in
 * isolation.
 *
 * @see masterplan §5.1 (page) + §5.4.1 (unit tests for this module)
 */
import * as api from './api.js';

import type { TenantDomain } from './types.js';

// --- Reactive state ---

let domains = $state<TenantDomain[]>([]);

// --- Getters ---

export function getDomains(): TenantDomain[] {
  return domains;
}

/**
 * Frontend-derived equivalent of backend's `TenantVerificationService.isVerified()`:
 * the tenant is "verified" iff at least one ACTIVE domain has status='verified'.
 *
 * Note: only ACTIVE rows are returned by `GET /domains` (backend filters
 * `is_active = 1` per §2.5), so anything in `domains[]` is already active —
 * no extra filter needed here.
 */
export function getTenantVerified(): boolean {
  return domains.some((d) => d.status === 'verified');
}

// --- Hydration ---

/**
 * Replaces the whole domains list. Called from `+page.svelte` on initial
 * mount with the SSR-loaded `data.domains`, and (defensively) on `data` change.
 */
export function setDomains(rows: TenantDomain[]): void {
  domains = rows;
}

// --- Mutations (call api + reflect in state) ---

/**
 * Add a new pending domain. Returns the row WITH `verificationInstructions`
 * so the caller (page) can immediately surface them via the
 * `VerifyInstructionsPanel` (§0.2.5 #10 — instructions are one-shot).
 */
export async function addDomain(domain: string): Promise<TenantDomain> {
  const created = await api.addDomain(domain);
  // Append + leave existing primary alone — backend does NOT auto-promote
  // new pending rows to primary unless it's the first one for the tenant.
  domains = [...domains, created];
  return created;
}

/**
 * Trigger DNS verification + reflect the (possibly-flipped) row.
 * Idempotent on already-verified rows — backend returns the row unchanged.
 */
export async function verifyDomain(id: string): Promise<TenantDomain> {
  const updated = await api.verifyDomain(id);
  domains = domains.map((d) => (d.id === id ? updated : d));
  return updated;
}

/**
 * Mark a domain as primary. Backend's 2-statement transaction (clear-then-set)
 * guarantees exactly one primary per tenant via partial UNIQUE
 * `tenant_domains_one_primary_per_tenant` (§2.5). We mirror that contract
 * locally so the UI doesn't briefly show two primaries during the round-trip.
 */
export async function setPrimary(id: string): Promise<void> {
  await api.setPrimaryDomain(id);
  domains = domains.map((d) => ({ ...d, isPrimary: d.id === id }));
}

/**
 * Soft-delete a domain (`is_active = 4` server-side). The row disappears from
 * the active list — we drop it locally too. Caller (page) is responsible for
 * the re-lock UX side-effect: if this was the only verified row, the tenant
 * falls back to unverified and `getTenantVerified()` flips to `false`.
 */
export async function removeDomain(id: string): Promise<void> {
  await api.removeDomain(id);
  domains = domains.filter((d) => d.id !== id);
}
