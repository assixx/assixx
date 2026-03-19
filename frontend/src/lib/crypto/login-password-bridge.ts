/**
 * Login Password Bridge — Secure one-time password transfer for E2E key escrow
 *
 * The login password is only available during the login flow (+page.svelte).
 * After login, a full page reload navigates to the dashboard (window.location.href),
 * which destroys all JS module state. sessionStorage bridges the reload within
 * the same tab — the password is consumed and cleared within ~1 second.
 *
 * Security properties:
 * - sessionStorage is same-origin, same-tab only (not shared across tabs)
 * - Consumed exactly once during E2E init — cleared immediately after
 * - XSS exposure identical to the login form input itself (ADR-022 threat model)
 * - Cleared on tab close (sessionStorage lifetime)
 *
 * Why sessionStorage instead of module-scoped variable:
 * Vite 8 SSR breaks client-side goto() when navigating across layout group
 * boundaries (/login → /dashboard). Full page reload is required, which
 * destroys module scope. sessionStorage is the only mechanism that survives
 * a same-tab reload without involving server-side state.
 *
 * @see ADR-022 (E2E Key Escrow)
 */

const STORAGE_KEY = '__assixx_e2e_pw_bridge';

/** Store the login password for consumption by E2E initialization */
export function setLoginPassword(password: string): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(STORAGE_KEY, password);
  }
}

/**
 * Consume the stored password (one-time use).
 * Returns null if no password was stored or it was already consumed.
 */
export function consumeLoginPassword(): string | null {
  if (typeof sessionStorage === 'undefined') return null;

  const pw = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  return pw;
}

/** Force-clear the stored password (safety net) */
export function clearLoginPassword(): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}
