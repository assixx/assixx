/**
 * Login Password Bridge — Secure one-time password transfer for E2E key escrow
 *
 * The login password is only available during the login flow (+page.svelte).
 * After goto() navigates to the app, the login component is destroyed.
 * SvelteKit is an SPA — module-scoped state survives client-side navigation.
 *
 * Security properties:
 * - Password lives in JS heap memory only — never in any storage API
 * - Consumed exactly once during E2E init — cleared immediately after
 * - Not accessible to other origins (same-origin policy)
 *
 * @see ADR-022 (E2E Key Escrow)
 */

let pendingPassword: string | null = null;

/** Store the login password for consumption by E2E initialization */
export function setLoginPassword(password: string): void {
  pendingPassword = password;
}

/**
 * Consume the stored password (one-time use).
 * Returns null if no password was stored or it was already consumed.
 */
export function consumeLoginPassword(): string | null {
  const pw = pendingPassword;
  pendingPassword = null;
  return pw;
}

/** Force-clear the stored password (safety net) */
export function clearLoginPassword(): void {
  pendingPassword = null;
}
