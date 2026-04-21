/**
 * Extract a tenant subdomain slug from a Host header value (frontend twin of
 * `backend/src/nest/common/utils/extract-slug.ts`).
 *
 * D5 decision (masterplan §Pre-Execution Audit): the slug parser is
 * **duplicated, not shared via `shared/`** — two files, byte-for-byte-
 * compatible on the pinned test vector. Rationale in D5: a `shared/`
 * import adds build-graph friction (frontend + backend both pull from
 * `shared/dist/`), the logic is ~20 LOC, and an architectural test asserts
 * both implementations behave identically on a pinned test vector (tracked
 * as post-Phase-6 tech-debt: equivalence test itself is not yet added).
 *
 * Semantics match the backend exactly:
 *
 *   - `string` → subdomain routing applies; SSR branding resolver should
 *               fetch `/api/v2/tenants/branding/:slug`.
 *   - `null`   → apex / localhost / IP / nested subdomain / garbage — NO
 *               host-based tenant context applies. Branding fetch skipped.
 *
 * Rejects (returns null) for:
 *   - undefined / empty
 *   - apex: `assixx.com`, `www.assixx.com` (case-insensitive)
 *   - localhost: `localhost` and `*.localhost` (RFC 6761 — Vite dev opt-in)
 *   - IPv4 literals
 *   - nested subdomains (`a.b.assixx.com`) — anchored regex rejects
 *   - any host that doesn't end in `.assixx.com`
 *
 * Input is case-normalised (lowercased) before regex matching; the returned
 * slug is always lowercase. Port suffix (`:5173`, `:443`) is stripped before
 * matching.
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §Decision
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 5 Step 5.1
 * @see backend/src/nest/common/utils/extract-slug.ts (source of truth for semantics)
 */

/**
 * Apex hosts (case-insensitive) that MUST NOT resolve to a tenant.
 * Marketing + signup + OAuth callback live here — tenant context comes from
 * the authenticated user's JWT, NOT from the URL.
 */
const APEX_HOSTS = new Set(['assixx.com', 'www.assixx.com']);

/**
 * IPv4-in-dotted-quad regex. Loose — each octet accepts 1–3 digits without
 * a 0–255 range check. The intent is "this looks like an IP, not a DNS
 * hostname", which is sufficient for routing.
 */
const IPV4_REGEX = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/**
 * Exact pattern `<slug>.assixx.com` — one label deep, no nested subdomains.
 * Mirrors the signup DTO regex (`^[a-z0-9][a-z0-9-]*[a-z0-9]$`): starts +
 * ends alphanumeric, interior may contain hyphens, minimum 2 chars.
 */
const SUBDOMAIN_REGEX = /^([a-z0-9][a-z0-9-]*[a-z0-9])\.assixx\.com$/;

/**
 * Dev-only mirror of `SUBDOMAIN_REGEX` — see backend twin for full
 * rationale (Session 12c-fix, 2026-04-21). Must stay byte-for-byte
 * identical to `backend/src/nest/common/utils/extract-slug.ts::DEV_SUBDOMAIN_REGEX`
 * per the D5 duplicate-not-shared decision.
 */
const DEV_SUBDOMAIN_REGEX = /^([a-z0-9][a-z0-9-]*[a-z0-9])\.localhost$/;

/**
 * Hosts that must never resolve to a tenant: empty string, apex domains,
 * plain `localhost`, IPv4 literals. Single-label `*.localhost` (dev-opt-in
 * subdomain workflow) is NOT rejected here — it falls through to the
 * DEV_SUBDOMAIN_REGEX match below. Extracted into a helper so the main
 * `extractSlug` function stays below the cyclomatic-complexity-10 ceiling
 * enforced by the frontend ESLint config.
 */
function isNonTenantHost(hostOnly: string): boolean {
  if (hostOnly === '') return true;
  if (APEX_HOSTS.has(hostOnly)) return true;
  if (hostOnly === 'localhost') return true;
  return IPV4_REGEX.test(hostOnly);
}

export function extractSlug(host: string | undefined): string | null {
  if (host === undefined || host === '') return null;

  // Strip port, lowercase, trim. `split(':')[0]` is always defined for a
  // non-empty string, but `noUncheckedIndexedAccess` (ADR-041) types it as
  // possibly-undefined — `?? host` is the type-safe fallback, never taken
  // at runtime for HTTP-shaped hostnames.
  const hostOnly = (host.split(':')[0] ?? host).toLowerCase().trim();

  if (isNonTenantHost(hostOnly)) return null;

  // RegExpExecArray[1] is typed `string` (not `string | undefined`) after
  // a successful match with a capture group, so `?? null` would be a
  // no-op that `@typescript-eslint/no-unnecessary-condition` rejects.
  const prodMatch = SUBDOMAIN_REGEX.exec(hostOnly);
  if (prodMatch !== null) return prodMatch[1];
  const devMatch = DEV_SUBDOMAIN_REGEX.exec(hostOnly);
  return devMatch === null ? null : devMatch[1];
}
