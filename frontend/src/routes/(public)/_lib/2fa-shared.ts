// =============================================================================
// SHARED 2FA CONSTANTS — login + signup verify stages
// =============================================================================
//
// Single source of truth for the protocol invariants and the German UI strings
// that are byte-identical between the login and signup 2FA-verify cards
// (FEAT_2FA_EMAIL_MASTERPLAN Step 5.5 i18n centralization, v0.8.3 2026-04-30).
//
// Per-route copy that DIFFERS lives in each route's own `_lib/2fa-constants.ts`:
//   - HEADING / INTRO_FALLBACK / BTN_BACK / ERR_RESEND_LIMIT (login + signup
//     each provide their own values)
//   - INTRO(email) (login only)
//   - VERIFY_SUCCESS_TITLE / VERIFY_SUCCESS_MESSAGE (signup only)
//
// Drift policy:
//   - Protocol constants (CODE_REGEX, CODE_LENGTH, MAX_VERIFY_ATTEMPTS,
//     RESEND_COOLDOWN_SEC, INITIAL_RESENDS_REMAINING, LOCKOUT_REDIRECT_DELAY_MS)
//     mirror backend authoritatively. Update both sides together when
//     `backend/src/nest/two-factor-auth/two-factor-auth.constants.ts` changes.
//   - Strings in COMMON_MESSAGES are flow-agnostic; if a future copy change
//     applies to ONE flow only, lift the key OUT of COMMON_MESSAGES into the
//     per-route MESSAGES literal — never let the two flows diverge silently
//     by editing the value here for one consumer's behalf.
//
// @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §5.5 (i18n centralization, v0.8.3)
// @see frontend/src/routes/(public)/login/_lib/2fa-constants.ts (login MESSAGES)
// @see frontend/src/routes/(public)/signup/_lib/2fa-constants.ts (signup MESSAGES)

/**
 * Crockford-Base32 subset code regex — alphabet `[A-HJKMNP-Z2-9]` (31 chars,
 * confusables 0/1/I/L/O excluded). Mirrors backend `VerifyCodeSchema`
 * (`backend/src/nest/two-factor-auth/dto/verify-code.dto.ts`) byte-for-byte;
 * client-side validation is eager UX only — backend is the authoritative gate.
 *
 * @see masterplan v0.3.1 changelog (DD-1 / DD-12 / DD-17 alphanumeric switch)
 */
export const CODE_REGEX = /^[A-HJKMNP-Z2-9]{6}$/;

/**
 * Code length — backend enforces exactly 6 (Zod `.regex(/^…{6}$/)`). UI
 * `maxlength` + auto-submit-trigger compare against this constant rather
 * than the literal `6` so any future format change has one source of truth.
 */
export const CODE_LENGTH = 6;

/**
 * Max wrong-code attempts before backend triggers user lockout. Mirror of
 * `MAX_ATTEMPTS` (DD-5) in `backend/src/nest/two-factor-auth/two-factor-auth.constants.ts`.
 * Used purely for the UX countdown ("Noch X Versuche übrig") — server-side
 * enforcement is authoritative; if the constants drift the lockout still
 * fires correctly server-side.
 */
export const MAX_VERIFY_ATTEMPTS = 5;

/**
 * Resend cooldown in seconds. Mirror of `RESEND_COOLDOWN_SEC` (backend constants).
 * Used to seed the live countdown after page-load and after a successful resend.
 */
export const RESEND_COOLDOWN_SEC = 60;

/**
 * Initial resends-remaining value on a fresh challenge. Mirror of
 * `MAX_RESENDS_PER_CHALLENGE` (backend constants, DD-21).
 */
export const INITIAL_RESENDS_REMAINING = 3;

/**
 * Lockout-redirect delay (ms) — masterplan §5.2 "On lockout → message + redirect
 * after 5 s". With the inline-card design the redirect is effectively a
 * stage-reset (back to credentials view) since /login or /signup is also where
 * we already are; the delay still gives the user time to read the lockout
 * message before the card swaps back.
 */
export const LOCKOUT_REDIRECT_DELAY_MS = 5_000;

/**
 * UI strings shared between the login and signup verify cards. Per-route
 * `MESSAGES` records spread this in and add their own overrides + any
 * route-specific keys.
 *
 * UPPER_CASE convention is intentional for ALL keys (string and
 * function-valued template helpers) to keep the record visually homogeneous
 * and match the masterplan §5.5 contract — block-scoped naming-convention
 * disable below.
 */
/* eslint-disable @typescript-eslint/naming-convention -- UPPER_CASE for all MESSAGES keys, including function-valued template helpers; flow-agnostic copy shared with login + signup verify cards. */
export const COMMON_MESSAGES = {
  CODE_LABEL: 'Bestätigungscode',
  BTN_SUBMIT: 'Bestätigen',
  BTN_SUBMITTING: 'Wird geprüft …',
  BTN_RESEND: 'Code erneut senden',
  BTN_RESEND_COOLDOWN: (sec: number) => `Code erneut senden in ${sec} s`,
  BTN_RESENDING: 'Wird gesendet …',
  HINT_SPAM: 'Keine E-Mail erhalten? Bitte auch den Spam-Ordner prüfen.',
  RESEND_SUCCESS: 'Neuer Code gesendet. Bitte E-Mail prüfen.',
  ERR_WRONG_CODE: (remaining: number) =>
    remaining > 0 ?
      `Falscher Code. Noch ${remaining} ${remaining === 1 ? 'Versuch' : 'Versuche'} übrig.`
    : 'Falscher Code.',
  ERR_INVALID_FORMAT:
    'Bitte geben Sie alle 6 Zeichen ein (Großbuchstaben + Ziffern, ohne 0/1/I/L/O).',
  ERR_EXPIRED: 'Der Code ist abgelaufen. Bitte fordern Sie einen neuen an.',
  ERR_LOCKED:
    'Konto gesperrt. Bitte in 15 Minuten erneut versuchen oder Administrator kontaktieren.',
  ERR_NETWORK: 'Verbindung verloren. Bitte erneut versuchen.',
  ERR_SEND_FAILED: 'Der Code konnte nicht gesendet werden. Bitte erneut versuchen.',
  ERR_RESEND_COOLDOWN: 'Bitte warten Sie, bevor Sie einen neuen Code anfordern.',
  ERR_THROTTLED: 'Zu viele Versuche. Bitte kurz warten und erneut probieren.',
  ERR_GENERIC: 'Ein Fehler ist aufgetreten. Bitte erneut versuchen.',
} as const;
