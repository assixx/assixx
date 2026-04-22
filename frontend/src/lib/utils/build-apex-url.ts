/**
 * Build an absolute apex-origin URL for cross-origin redirects out of tenant
 * subdomains back to the public / marketing / login surface.
 *
 * Mirrors `buildSubdomainUrl()` in `backend/src/nest/auth/oauth/` (the inverse
 * direction — slug-in, subdomain-URL-out). Both helpers derive origin from
 * `PUBLIC_APP_URL` — single source of truth for dev/prod parity. In dev this
 * is `http://localhost:5173`; in prod `https://www.assixx.com`.
 *
 * Every logout path (normal logout, OAuth logout, session-expired,
 * CROSS_TENANT_HOST_MISMATCH) uses this to re-enter the apex login surface.
 * Cross-origin navigation MUST use `window.location.href = ...` — SvelteKit's
 * `goto()` is client-router-bound and cannot leave the current origin.
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md
 *      §"Amendment — Logout → Apex"
 * @see backend/src/nest/auth/oauth/build-subdomain-url.ts — apex→subdomain twin
 */
import { extractSlug } from './extract-slug.js';

import { env } from '$env/dynamic/public';

/**
 * Reason discriminator embedded as a query param on the login page.
 *
 * Namespace split encodes the active-vs-passive distinction so the login
 * page picks the correct toast tone (success / warning / error) without
 * heuristics:
 *
 * - `logout-success`    → User-initiated logout completed cleanly. Active
 *                         action-result. Success toast.
 * - `session-expired`   → JWT / refresh token expired mid-session. Passive
 *                         system event. Warning toast.
 * - `session-forbidden` → JWT decoded OK but host did not match
 *                         (CROSS_TENANT_HOST_MISMATCH, ADR-050 §Decision).
 *                         Passive system event. Error toast.
 */
export type LoginRedirectReason = 'logout-success' | 'session-expired' | 'session-forbidden';

// Reason → query-string mapping. Only the values here are allowed on the
// login URL; the architectural test forbids hardcoded `/login?logout=...`
// or `/login?session=...` strings anywhere else in the codebase.
const REASON_TO_QUERY: Record<LoginRedirectReason, string> = {
  'logout-success': 'logout=success',
  'session-expired': 'session=expired',
  'session-forbidden': 'session=forbidden',
};

const DEFAULT_PUBLIC_APP_URL = 'https://www.assixx.com';

/**
 * Derive apex origin from `window.location` by stripping the leading
 * subdomain label. Self-healing fallback for the common dev case where
 * `PUBLIC_APP_URL` is NOT injected into the SvelteKit Vite dev server —
 * user runs `pnpm run dev:svelte` (no Doppler) and `env.PUBLIC_APP_URL`
 * is undefined. Without this fallback, logouts from `<slug>.localhost:5173`
 * would redirect to the prod `https://www.assixx.com` hardcoded default,
 * which is the bug discovered 2026-04-22 during manual smoke-test.
 *
 * Prod convention (ADR-050 §Decision): the bare `assixx.com` label is
 * normalised to `www.assixx.com` — the canonical apex host registered
 * as an explicit SAN on the wildcard TLS cert.
 *
 * Returns null in SSR (no `window`), pre-hydration edge cases (no
 * `window.location`), or on parse errors — caller then falls back to
 * `DEFAULT_PUBLIC_APP_URL`.
 */
function deriveApexFromBrowser(): string | null {
  if (typeof window === 'undefined') return null;
  // The vitest frontend-setup shim assigns `window = globalThis` without a
  // `.location` property; the optional-chain below handles that + any
  // pre-hydration SSR edge where `window` exists but `location` doesn't
  // yet. TypeScript types `window.location` as a non-null `Location`, so
  // we cast to expose the runtime-optional shape.
  const maybeLoc = (window as unknown as { location?: { href?: string } }).location;
  const href = maybeLoc?.href;
  if (typeof href !== 'string' || href === '') return null;
  const url = new URL(href);
  const slug = extractSlug(url.hostname);
  if (slug === null) {
    // Already on apex (localhost, www.assixx.com, bare assixx.com) — or
    // unrecognised host. Origin as-is.
    return url.origin;
  }
  // Strip `<slug>.` prefix. `testfirma.localhost` → `localhost`;
  // `scs.assixx.com` → `assixx.com` → normalised to `www.assixx.com`.
  const strippedHost = url.hostname.slice(slug.length + 1);
  const apexHostname = strippedHost === 'assixx.com' ? 'www.assixx.com' : strippedHost;
  const portSuffix = url.port === '' ? '' : `:${url.port}`;
  return `${url.protocol}//${apexHostname}${portSuffix}`;
}

/**
 * Construct an absolute apex URL for the given path.
 *
 * Resolution priority (first hit wins):
 *
 * 1. **Explicit `publicAppUrl` param** — used by unit tests and anywhere
 *    a caller needs to override the runtime default.
 * 2. **`env.PUBLIC_APP_URL`** — deployment contract. Prod ops and
 *    Doppler-injected dev both set this. When present, it is authoritative
 *    even if the browser is currently on a different origin.
 * 3. **Browser fallback** via {@link deriveApexFromBrowser} — strips the
 *    subdomain label from the current `window.location`. Handles the
 *    "forgot Doppler" dev case without requiring workflow changes.
 * 4. **Hardcoded `https://www.assixx.com`** — last-resort SSR / SSG
 *    fallback (no browser, no env, no override).
 *
 * @param pathWithQuery MUST start with `/`. No sanitisation performed.
 * @param publicAppUrl  Explicit override. Omit in production callers.
 */
export function buildApexUrl(pathWithQuery: string, publicAppUrl?: string): string {
  if (publicAppUrl !== undefined) {
    return `${new URL(publicAppUrl).origin}${pathWithQuery}`;
  }
  // SvelteKit types `env.PUBLIC_*` as `string` (non-nullable) after
  // `svelte-kit sync` — but at runtime the value is genuinely `undefined`
  // when the env var is not provisioned. Annotate explicitly so TypeScript
  // does not strip the `!== undefined` guard below as unreachable (the
  // guard IS reachable — it's the whole point of this branch).
  const envUrl: string | undefined = env.PUBLIC_APP_URL;
  if (envUrl !== undefined && envUrl !== '') {
    return `${new URL(envUrl).origin}${pathWithQuery}`;
  }
  const browserApex = deriveApexFromBrowser();
  if (browserApex !== null) {
    return `${browserApex}${pathWithQuery}`;
  }
  return `${DEFAULT_PUBLIC_APP_URL}${pathWithQuery}`;
}

/**
 * Construct `<apex>/login` with an optional reason query param.
 *
 * Use for every cross-origin redirect out of a tenant subdomain to the apex
 * login page. Combine with `window.location.href = ...` — NEVER `goto()`
 * (client-router only, will not leave the current origin).
 *
 * @param reason        Optional reason discriminator. Omit for neutral
 *                      login-page entry (direct link, no banner).
 * @param publicAppUrl  Test-only override; production code uses the env default.
 */
export function buildLoginUrl(reason?: LoginRedirectReason, publicAppUrl?: string): string {
  const base = buildApexUrl('/login', publicAppUrl);
  return reason === undefined ? base : `${base}?${REASON_TO_QUERY[reason]}`;
}
