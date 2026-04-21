/**
 * Extract a tenant subdomain slug from a Host header value.
 *
 * The return value drives the cross-tenant token-replay defence in
 * `TenantHostResolverMiddleware` + `JwtAuthGuard` — so the semantics matter:
 *
 *   - `string` → subdomain routing applies; `JwtAuthGuard` MUST enforce
 *               `req.hostTenantId === user.tenantId` after JWT decode
 *               (403 `CROSS_TENANT_HOST_MISMATCH` on mismatch).
 *   - `null`   → NO host-based tenant context; guards MUST skip the
 *               cross-check. Use cases: apex (marketing + signup + OAuth
 *               callback), localhost dev, internal docker-network calls,
 *               IP literals, unrelated hosts.
 *
 * Rejects (returns null) for:
 *   - undefined / empty
 *   - apex: `assixx.com`, `www.assixx.com` (case-insensitive)
 *   - localhost: `localhost` and `*.localhost` (RFC 6761 — Vite dev opt-in)
 *   - IPv4 literals (docker-network calls, direct-IP probes)
 *   - nested subdomains (`a.b.assixx.com`) — anchored regex rejects
 *   - any host that doesn't end in `.assixx.com`
 *
 * Input is case-normalised (lowercased) before regex matching; the returned
 * slug is always lowercase. Port suffix (`:5173`, `:443`) is stripped before
 * matching.
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §Decision
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 2 Step 2.1
 */

/**
 * Apex hosts (case-insensitive) that MUST NOT resolve to a tenant.
 * Marketing + signup + OAuth callback live here — their tenant context comes
 * from the authenticated user's JWT, NOT from the URL.
 */
const APEX_HOSTS = new Set(['assixx.com', 'www.assixx.com']);

/**
 * IPv4-in-dotted-quad regex. Loose — each octet accepts 1–3 digits without
 * a 0–255 range check. The intent is "this looks like an IP, not a DNS
 * hostname", which is sufficient for routing. Actual routability of the IP
 * is not our concern.
 */
const IPV4_REGEX = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/**
 * Exact pattern `<slug>.assixx.com` — one label deep, no nested subdomains.
 * The slug capture group mirrors the signup DTO regex
 * (`^[a-z0-9][a-z0-9-]*[a-z0-9]$`): starts + ends alphanumeric, interior
 * may contain hyphens, minimum 2 chars.
 *
 * The DB-layer signup DTO enforces min 3 chars AND blocks reserved slugs
 * (ADR-050 §"Reserved Slug List" + migration 20260421102820830). This
 * regex is intentionally wider than the DB rules — the DB lookup in
 * `TenantHostResolverMiddleware` is the final authority. A slug that
 * passes this regex but has no matching tenant row resolves to
 * `hostTenantId = null` (equivalent to the apex case).
 */
const SUBDOMAIN_REGEX = /^([a-z0-9][a-z0-9-]*[a-z0-9])\.assixx\.com$/;

/**
 * Dev-only mirror of `SUBDOMAIN_REGEX` for the `/etc/hosts`-driven local
 * subdomain workflow (Session 12c-fix, 2026-04-21).
 *
 * Before this ADR, `<slug>.localhost` was treated as equivalent to plain
 * `localhost` (return `null`), which made ADR-050 §"Local Dev"'s own advice
 * — "add `/etc/hosts` entries and test the full subdomain flow" — silently
 * ineffective: the handoff endpoint's R15 host-cross-check rejected every
 * dev subdomain because `hostTenantId` stayed null while `payload.tenantId`
 * was real. Dev/prod behaviour diverged.
 *
 * With this regex, `testfirma.localhost` resolves to slug `'testfirma'`, the
 * middleware's DB lookup finds the matching tenant, and R14/R15/cross-tenant
 * defences fire identically to prod. Plain `localhost` (no leading label)
 * still returns `null` — API tests that hit `http://localhost:3000` remain
 * unaffected. Nested `foo.bar.localhost` still returns `null` (single-label
 * only, mirrors prod).
 */
const DEV_SUBDOMAIN_REGEX = /^([a-z0-9][a-z0-9-]*[a-z0-9])\.localhost$/;

export function extractSlug(host: string | undefined): string | null {
  if (host === undefined || host === '') return null;

  // Strip port, lowercase, trim. `split(':')[0]` is always defined for a
  // non-empty string, but `noUncheckedIndexedAccess` (ADR-041) types it as
  // possibly-undefined — `?? host` is the type-safe fallback, never taken
  // at runtime for HTTP-shaped hostnames.
  const hostOnly = (host.split(':')[0] ?? host).toLowerCase().trim();

  if (hostOnly === '') return null;
  if (APEX_HOSTS.has(hostOnly)) return null;
  if (hostOnly === 'localhost') return null; // plain localhost = apex-equivalent
  if (IPV4_REGEX.test(hostOnly)) return null;

  // `noUncheckedIndexedAccess: true` (ADR-041) types `match[1]` as
  // `string | undefined` even after a matched regex with a capture group,
  // so `?? null` is required here. The frontend twin OMITS `?? null`
  // because SvelteKit's tsconfig does not enable the flag and
  // `@typescript-eslint/no-unnecessary-condition` would flag it. Small
  // D5-divergence, deliberate — the single-char difference is noted in
  // both files' comments.
  const prodMatch = SUBDOMAIN_REGEX.exec(hostOnly);
  if (prodMatch !== null) return prodMatch[1] ?? null;
  const devMatch = DEV_SUBDOMAIN_REGEX.exec(hostOnly);
  return devMatch === null ? null : (devMatch[1] ?? null);
}
