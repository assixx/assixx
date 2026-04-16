/**
 * Pure OAuth helpers — extracted from login/+page.svelte and
 * signup/oauth-complete/+page.svelte so they can be unit-tested
 * in isolation (ADR-018 Tier 1b — frontend-unit tests).
 *
 * Keeping them here lets future OAuth-aware pages (V2 link/unlink settings,
 * a potential error-page redesign, etc.) reuse the same mapping logic
 * without copy-paste drift.
 *
 * @see docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md Phase 6 (tests close-out)
 * @see docs/infrastructure/adr/ADR-046-oauth-sign-in.md
 */

/**
 * Map a whitelisted backend OAuth error slug to a user-facing German message.
 *
 * Backend `OAuthController.sanitiseErrorReason` pre-filters the slug
 * (alphanum + `._-: ` only, 80-char cap), so this switch is the single
 * translation layer. Unknown slugs fall through to a generic message —
 * intentional: when Microsoft introduces a new error code the UI degrades
 * gracefully instead of exposing the raw Microsoft string to end users
 * (Plan §6 error-path UX).
 */
export function mapOAuthErrorReason(reason: string): string {
  switch (reason) {
    case 'already_linked':
      return 'Dieses Microsoft-Konto ist bereits mit einem Assixx-Tenant verknüpft.';
    case 'callback_failed':
      return 'Die Microsoft-Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.';
    case 'missing_code':
      return 'Die Microsoft-Anmeldung wurde abgebrochen. Bitte starten Sie erneut.';
    default:
      return 'Die Microsoft-Anmeldung konnte nicht abgeschlossen werden.';
  }
}

/**
 * Best-effort first/last name split of the Microsoft `displayName` claim.
 *
 * Examples:
 *   "Ada Lovelace"        → { first: "Ada", last: "Lovelace" }
 *   "Max"                 → { first: "Max", last: "" }
 *   "Hans Peter Müller"   → { first: "Hans", last: "Peter Müller" }
 *   "  Ada   Lovelace  "  → { first: "Ada", last: "Lovelace" }   (whitespace collapsed)
 *   null / empty          → { first: "", last: "" }
 *
 * Used to pre-fill editable name fields in `/signup/oauth-complete`. The
 * user can always edit either field — the split is a best-effort
 * convenience, not a canonical parser.
 */
export function splitDisplayName(display: string | null | undefined): {
  first: string;
  last: string;
} {
  if (display === null || display === undefined || display.trim() === '') {
    return { first: '', last: '' };
  }
  const parts = display.trim().split(/\s+/);
  const firstPart = parts[0] ?? '';
  if (parts.length === 1) {
    return { first: firstPart, last: '' };
  }
  return {
    first: firstPart,
    last: parts.slice(1).join(' '),
  };
}
