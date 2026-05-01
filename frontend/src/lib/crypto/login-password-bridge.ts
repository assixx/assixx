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

/**
 * Store the login password for consumption by E2E initialization.
 *
 * Empty-string guard (security): if a caller hands us `''`, we silently
 * drop it. Why this matters — `e2e-state.svelte.ts:resolveOrRecoverKey`
 * branches on `loginPassword !== null`, NOT on truthiness; an empty-string
 * bridge value would still trigger `tryCreateEscrow('')`, which feeds an
 * empty password to Argon2id and produces a deterministic wrapping key
 * that any attacker with the DB dump can re-derive trivially.
 *
 * Reachable scenario: user reaches the 2FA verify stage (challengeToken
 * cookie set), reloads the tab (or opens a fresh tab while the cookie is
 * still valid), and the parent component's `password = $state('')`
 * remounts empty. Verify still succeeds because the cookie persists, and
 * without this guard the verify-success branch would bridge `''` and burn
 * the user's escrow with a worthless wrapping key.
 *
 * @see docs/infrastructure/adr/ADR-022-e2e-key-escrow.md §Threat-Model
 */
export function setLoginPassword(password: string): void {
  if (password === '') return;
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(STORAGE_KEY, password);
  }
}

/**
 * Consume the stored password (one-time use).
 * Returns null if no password was stored or it was already consumed.
 *
 * Empty-string guard (security): treats `''` as `null` so any storage
 * tampering or pre-guard legacy entries that left an empty value cannot
 * sneak past `e2e-state.svelte.ts`'s `loginPassword !== null` check
 * and trigger an empty-password Argon2id derivation. See `setLoginPassword`
 * docblock above for the full threat-model rationale.
 */
export function consumeLoginPassword(): string | null {
  if (typeof sessionStorage === 'undefined') return null;

  const pw = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  return pw === '' ? null : pw;
}

/** Force-clear the stored password (safety net) */
export function clearLoginPassword(): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}
