// =============================================================================
// LOGIN PAGE — 2FA STAGE CONSTANTS
// =============================================================================
//
// German UI strings + protocol constants for the inline 2FA-verify stage on
// the login card (FEAT_2FA_EMAIL_MASTERPLAN Step 5.2, v0.8.1 inline-design
// revision 2026-04-30). The verify stage swaps inside `card__body` when
// `data.stage === 'verify'` — same `<form>` structure, different content.
//
// Originally lived under `(public)/login/verify/_lib/constants.ts`; moved
// here when the separate-route design (`/login/verify`) was retired in
// favour of the user-requested single-card UX.

/**
 * Crockford-Base32 subset code regex — alphabet `[A-HJKMNP-Z2-9]` (31 chars,
 * confusables 0/1/I/L/O excluded). Mirrors backend `VerifyCodeSchema`
 * (`backend/src/nest/two-factor-auth/dto/verify-code.dto.ts:21`) byte-for-byte;
 * client-side validation is eager UX only — backend is the authoritative gate.
 *
 * @see masterplan v0.3.1 changelog (DD-1 / DD-12 / DD-17 alphanumeric switch)
 */
export const CODE_REGEX = /^[A-HJKMNP-Z2-9]{6}$/;

/**
 * Code length — backend enforces exactly 6 (Zod `.regex(/^…{6}$/)`). Auto-submit
 * trigger compares against this constant rather than the literal `6` so any
 * future format change has one source of truth.
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
 * to /login after 5 s". With the inline-card design the redirect-to-/login is
 * effectively a stage-reset (back to credentials) since /login is also where
 * we already are; the delay still gives the user time to read the lockout
 * message before the card swaps back.
 */
export const LOCKOUT_REDIRECT_DELAY_MS = 5_000;

/**
 * UI strings — German with proper ä/ö/ü/ß per CODE-OF-CONDUCT-SVELTE.
 * `INTRO`, `BTN_RESEND_COOLDOWN`, and `ERR_WRONG_CODE` are template-helper
 * functions that take a parameter — keeps the call site declarative
 * (`MESSAGES.INTRO(email)`) instead of scattering template literals through
 * markup.
 *
 * UPPER_CASE convention is intentional for ALL keys (string and function-valued
 * template helpers) to keep the record visually homogeneous and match the
 * masterplan §5.5 contract — block-scoped naming-convention disable below.
 *
 * @see masterplan §5.5 verbatim source
 */
/* eslint-disable @typescript-eslint/naming-convention -- UPPER_CASE for all MESSAGES keys, including function-valued template helpers; see JSDoc above. */
export const MESSAGES = {
  HEADING: 'Bestätigungscode eingeben',
  INTRO: (email: string) => `Wir haben einen 6-stelligen Code an ${email} gesendet.`,
  // Fallback intro when the email is unknown to the page (load did not have it).
  // The challenge cookie is opaque to the frontend; we can't decode the email
  // from it, and the page-server load deliberately does NOT fetch challenge
  // metadata (would require a new GET endpoint just for this label — YAGNI).
  INTRO_FALLBACK: 'Wir haben einen 6-stelligen Code an Ihre E-Mail-Adresse gesendet.',
  CODE_LABEL: 'Bestätigungscode',
  BTN_SUBMIT: 'Bestätigen',
  BTN_SUBMITTING: 'Wird geprüft …',
  BTN_RESEND: 'Code erneut senden',
  BTN_RESEND_COOLDOWN: (sec: number) => `Code erneut senden in ${sec} s`,
  BTN_RESENDING: 'Wird gesendet …',
  BTN_BACK: 'Zurück zur Anmeldung',
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
  ERR_RESEND_LIMIT: 'Maximale Anzahl an Resends erreicht. Bitte starten Sie den Login neu.',
  ERR_RESEND_COOLDOWN: 'Bitte warten Sie, bevor Sie einen neuen Code anfordern.',
  ERR_THROTTLED: 'Zu viele Versuche. Bitte kurz warten und erneut probieren.',
  ERR_GENERIC: 'Ein Fehler ist aufgetreten. Bitte erneut versuchen.',
} as const;
