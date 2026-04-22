/**
 * Centralized session-expired handling.
 *
 * Previously duplicated across 15 route-level API files.
 * Provides consistent SESSION_EXPIRED error detection and redirect.
 *
 * ADR-050 Amendment (Logout → Apex): redirect target is the apex origin,
 * not the current tenant subdomain. A mid-session expiry on
 * `<slug>.assixx.com` lands the user on `www.assixx.com/login?session=expired`
 * where the tenant-agnostic login surface lives. Cross-origin navigation
 * MUST use `window.location.href` — `goto()` is client-router-bound and
 * cannot leave the current origin.
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md
 *      §"Amendment — Logout → Apex"
 */
import { buildLoginUrl } from './build-apex-url.js';

/** Check if an error is a SESSION_EXPIRED response from the backend. */
export function isSessionExpiredError(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === 'SESSION_EXPIRED'
  );
}

/**
 * Redirect to apex login page with `?session=expired`.
 *
 * Hard-navigate required: apex origin differs from any tenant subdomain.
 * `window.location.href = ...` forces full page load, dropping
 * SvelteKit's client-router state (stale for a logged-out user anyway).
 */
export function handleSessionExpired(): void {
  window.location.href = buildLoginUrl('session-expired');
}

/** Check for session expired and redirect if so. Returns true if expired. */
export function checkSessionExpired(err: unknown): boolean {
  if (isSessionExpiredError(err)) {
    handleSessionExpired();
    return true;
  }
  return false;
}
