/**
 * Build an absolute subdomain URL for OAuth redirect targets.
 *
 * Dev/prod parity is derived from `PUBLIC_APP_URL` — the same env var that
 * drives the Microsoft OAuth `redirect_uri` (see `microsoft.provider.ts`).
 * That guarantees the two URLs share the same apex/port/scheme: if Azure
 * sends the browser to `http://localhost:5173/api/…/callback`, the handoff
 * redirect lands on `http://<slug>.localhost:5173/…` — never port 3000, never
 * a mismatched scheme.
 *
 * Mirrors `buildSubdomainHandoffUrl()` in
 * `frontend/src/routes/(public)/login/+page.server.ts` (Session 12c) — any
 * drift between the two helpers silently breaks cookie isolation or the
 * handoff host-cross-check (R15). See `build-subdomain-url.test.ts` for the
 * full table of PUBLIC_APP_URL → subdomain-URL mappings.
 *
 * Extracted from `oauth.controller.ts` so it can be unit-tested as a pure
 * function without spinning up the Nest test harness.
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §"Local Dev"
 * @see frontend/src/routes/(public)/login/+page.server.ts `buildSubdomainHandoffUrl`
 */

/**
 * Construct `{protocol}//{slug}.{apex}{port}{pathWithQuery}` from the
 * configured `PUBLIC_APP_URL`. `slug` is validated upstream (DB lookup via
 * `authService.getSubdomainForTenant` or state-service roundtrip); no further
 * sanitisation needed.
 *
 * @param slug            Tenant subdomain slug (lowercase, RFC-1035 conformant).
 * @param pathWithQuery   Path + query segment, MUST start with `/`.
 * @param publicAppUrl    Defaults to `process.env.PUBLIC_APP_URL`. Pass
 *                        explicitly in unit tests to avoid env-coupling.
 */
export function buildSubdomainUrl(
  slug: string,
  pathWithQuery: string,
  publicAppUrl: string = process.env['PUBLIC_APP_URL'] ?? 'https://www.assixx.com',
): string {
  const url = new URL(publicAppUrl);
  const hostname = url.hostname;

  let newHost: string;
  if (hostname === 'localhost' || hostname === 'assixx.com') {
    newHost = `${slug}.${hostname}`;
  } else if (hostname === 'www.assixx.com') {
    // Drop the `www` label before prepending the tenant slug — subdomain
    // namespace is `*.assixx.com`, not `*.www.assixx.com`.
    newHost = `${slug}.assixx.com`;
  } else {
    // Pathological: PUBLIC_APP_URL already carries a subdomain label. Swap
    // the first label to avoid producing `{slug}.{existing-sub}.assixx.com`
    // which the wildcard cert wouldn't cover (RFC 6125 §6.4.3: one label deep).
    const parts = hostname.split('.');
    parts[0] = slug;
    newHost = parts.join('.');
  }

  const portSuffix = url.port === '' ? '' : `:${url.port}`;
  return `${url.protocol}//${newHost}${portSuffix}${pathWithQuery}`;
}
