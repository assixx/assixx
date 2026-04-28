/**
 * Centralized auth-cookie set/clear helpers.
 *
 * Why this module exists:
 *   `login/+page.server.ts` and `signup/oauth-complete/+page.server.ts` both
 *   set the same 4-cookie auth-session state (accessToken, refreshToken,
 *   userRole, accessTokenExp). The pre-2026-04-27 implementation duplicated
 *   the option constants + helper functions across both files with explicit
 *   comments ("MUST stay in shape-parity with login/+page.server.ts") — drift
 *   between them was a latent security risk. Centralizing makes the 3-cookie
 *   invariant (extended to 4 per ADR-046 §"3-cookie invariant") a structural
 *   property, not a comment-policed convention.
 *
 * Why `secure` is derived from `url.protocol`, not `process.env.NODE_ENV`:
 *   `NODE_ENV=production` is a build-mode signal; the cookie `Secure`
 *   attribute is a TRANSPORT signal (RFC 6265bis §4.1.2.5: "user agent MUST
 *   ignore the Set-Cookie header if Secure is set and the request was not
 *   made over a secure protocol"). The two diverge during production-profile
 *   local testing per `docs/PRODUCTION-AND-DEVELOPMENT-TESTING.md`:
 *   `NODE_ENV=production` over plain HTTP. Setting Secure unconditionally
 *   silently drops every Set-Cookie → handoff appears to succeed but the
 *   browser ends up with no auth state → bounce-to-login loop.
 *
 *   Reading from `event.url.protocol` requires adapter-node to populate
 *   `event.url` from the proxy's X-Forwarded-Proto header. This is wired via
 *   the `PROTOCOL_HEADER=x-forwarded-proto` + `HOST_HEADER=x-forwarded-host`
 *   env vars in `docker-compose.yml` and `Dockerfile.frontend`, paired with
 *   matching `proxy_set_header X-Forwarded-{Proto,Host}` directives in
 *   `docker/nginx/nginx.conf`. Real prod (HTTPS via Cloudflare → Nginx →
 *   adapter-node) sets the header to `https` → `secure: true`. Local-prod-test
 *   (HTTP) sets it to `http` → `secure: false`. Dev (`pnpm run dev:svelte`,
 *   no Nginx) falls back to the actual TCP scheme `http` → `secure: false`.
 *
 * @see docs/infrastructure/adr/ADR-046-oauth-sign-in.md §"3-cookie invariant"
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md
 * @see docs/PRODUCTION-AND-DEVELOPMENT-TESTING.md
 */
import { extractJwtExp } from './jwt-exp';

import type { UserRole } from '@assixx/shared';
import type { Cookies } from '@sveltejs/kit';

/** Access token expiry: 30 minutes (mirrors backend JWT lifetime). */
const ACCESS_TOKEN_MAX_AGE = 30 * 60;

/** Refresh token expiry: 7 days. */
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60;

/** Detect transport security from the request URL — see file header rationale. */
function isHttpsRequest(url: URL): boolean {
  return url.protocol === 'https:';
}

/**
 * Set the 4-cookie auth-session state (ADR-046 §"3-cookie invariant" + userRole).
 *
 * Cookie matrix:
 * | Name             | Path             | httpOnly | sameSite | Reader        |
 * | ---------------- | ---------------- | -------- | -------- | ------------- |
 * | accessToken      | /                | true     | lax      | Backend (API) |
 * | refreshToken     | /api/v2/auth     | true     | strict   | Backend       |
 * | userRole         | /                | false    | lax      | Frontend JS   |
 * | accessTokenExp   | /                | false    | lax      | TokenManager  |
 *
 * The refreshToken's `sameSite: strict` + path-scoping is the CSRF defence;
 * everything else needs lax for OAuth callback redirects and same-site SSR
 * fetches to work.
 *
 * SvelteKit's server-side fetch strips backend `Set-Cookie` response headers
 * → we MUST re-emit cookies here, not rely on backend response forwarding.
 */
export function setAuthCookies(
  cookies: Cookies,
  url: URL,
  accessToken: string,
  refreshToken: string,
  role: UserRole,
): void {
  const secure = isHttpsRequest(url);

  cookies.set('accessToken', accessToken, {
    path: '/',
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  cookies.set('refreshToken', refreshToken, {
    path: '/api/v2/auth',
    httpOnly: true,
    secure,
    sameSite: 'strict',
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });

  // userRole — readable by client JS so the router can pick the dashboard.
  cookies.set('userRole', role, {
    path: '/',
    httpOnly: false,
    secure,
    sameSite: 'lax',
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  // accessTokenExp — TokenManager reads this for its expiry timer; SvelteKit's
  // server-fetch strips backend Set-Cookie, so re-emit to prevent stale values
  // from a prior OAuth session leaking into the header timer (ADR-046 amendment).
  cookies.set('accessTokenExp', String(extractJwtExp(accessToken)), {
    path: '/',
    httpOnly: false,
    secure,
    sameSite: 'lax',
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
}

/**
 * Clear all auth cookies — mirrors setAuthCookies 1:1 (path-scoping must
 * match exactly or the browser keeps stale cookies in another path bucket).
 */
export function clearAuthCookies(cookies: Cookies): void {
  cookies.delete('accessToken', { path: '/' });
  cookies.delete('refreshToken', { path: '/api/v2/auth' });
  cookies.delete('userRole', { path: '/' });
  cookies.delete('accessTokenExp', { path: '/' });
}
