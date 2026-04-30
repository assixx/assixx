// =============================================================================
// SIGNUP PAGE — 2FA STAGE CONSTANTS
// =============================================================================
//
// German UI strings + protocol constants for the inline 2FA-verify stage on
// the signup card (FEAT_2FA_EMAIL_MASTERPLAN Step 5.3, v0.8.2 inline-design
// revision 2026-04-30 — mirrors Step 5.2 login). The verify stage swaps
// inside the signup card body when `data.stage === 'verify'`.
//
// Differs from `(public)/login/_lib/2fa-constants.ts` ONLY in three keys:
//   - HEADING:           "E-Mail bestätigen" (signup tone — first-time email
//                        ownership proof, not a per-login re-verification)
//   - INTRO_FALLBACK:    Mentions the registration completion goal so the
//                        user understands why the code arrived
//   - BTN_BACK:          Points back to the signup card (`/signup`), not
//                        login. Matches the lockout-redirect target.
//
// All other strings (errors, button labels, hints) are flow-agnostic and stay
// byte-identical to the login version. Drift between the two files is
// intentional only on the three keys above; reviewers should reject any other
// divergence unless tied to a documented signup-specific behaviour change.
//
// @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §5.3
// @see frontend/src/routes/(public)/login/_lib/2fa-constants.ts (login twin)

/**
 * Crockford-Base32 subset code regex — alphabet `[A-HJKMNP-Z2-9]` (31 chars,
 * confusables 0/1/I/L/O excluded). Mirrors backend `VerifyCodeSchema`
 * (`backend/src/nest/two-factor-auth/dto/verify-code.dto.ts`) byte-for-byte.
 *
 * @see masterplan v0.3.1 changelog (DD-1 / DD-12 / DD-17 alphanumeric switch)
 */
export const CODE_REGEX = /^[A-HJKMNP-Z2-9]{6}$/;

/**
 * Code length — backend enforces exactly 6. Used in `maxlength` + `pattern`
 * attributes so the UI matches the server-side Zod schema.
 */
export const CODE_LENGTH = 6;

/**
 * Max wrong-code attempts before backend triggers user lockout. Mirror of
 * `MAX_ATTEMPTS` (DD-5) in `backend/src/nest/two-factor-auth/two-factor-auth.constants.ts`.
 * UX-only — server-side enforcement is authoritative.
 */
export const MAX_VERIFY_ATTEMPTS = 5;

/**
 * Resend cooldown in seconds. Mirror of `RESEND_COOLDOWN_SEC` (backend constants).
 */
export const RESEND_COOLDOWN_SEC = 60;

/**
 * Initial resends-remaining value on a fresh challenge. Mirror of
 * `MAX_RESENDS_PER_CHALLENGE` (backend constants, DD-21).
 */
export const INITIAL_RESENDS_REMAINING = 3;

/**
 * Lockout-redirect delay (ms) — masterplan §5.2 "redirect after 5 s". With the
 * inline-card design the redirect is effectively a stage-reset (back to
 * signup credentials view) since /signup is also where we already are. The
 * delay gives the user time to read the lockout message before the card
 * swaps back.
 */
export const LOCKOUT_REDIRECT_DELAY_MS = 5_000;

/**
 * UI strings — German with proper ä/ö/ü/ß per CODE-OF-CONDUCT-SVELTE.
 * `BTN_RESEND_COOLDOWN` and `ERR_WRONG_CODE` are template-helper functions.
 *
 * UPPER_CASE convention is intentional for ALL keys (string and function-valued
 * template helpers) to keep the record visually homogeneous and match the
 * masterplan §5.5 contract — block-scoped naming-convention disable below.
 *
 * @see masterplan §5.5 verbatim source
 * @see (public)/login/_lib/2fa-constants.ts (login twin — diverges only on
 *      HEADING / INTRO_FALLBACK / BTN_BACK)
 */
/* eslint-disable @typescript-eslint/naming-convention -- UPPER_CASE for all MESSAGES keys, including function-valued template helpers; see JSDoc above. */
export const MESSAGES = {
  // Signup-specific copy per masterplan §5.3
  HEADING: 'E-Mail bestätigen',
  // German `schliessen` per ß rule (masterplan §5.3 explicit instruction)
  INTRO_FALLBACK: 'Bitte bestätigen Sie Ihre E-Mail-Adresse, um die Registrierung abzuschliessen.',
  CODE_LABEL: 'Bestätigungscode',
  BTN_SUBMIT: 'Bestätigen',
  BTN_SUBMITTING: 'Wird geprüft …',
  BTN_RESEND: 'Code erneut senden',
  BTN_RESEND_COOLDOWN: (sec: number) => `Code erneut senden in ${sec} s`,
  BTN_RESENDING: 'Wird gesendet …',
  // Signup-specific: back to the signup form, not the login page.
  BTN_BACK: 'Zurück zur Registrierung',
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
  ERR_RESEND_LIMIT: 'Maximale Anzahl an Resends erreicht. Bitte starten Sie die Registrierung neu.',
  ERR_RESEND_COOLDOWN: 'Bitte warten Sie, bevor Sie einen neuen Code anfordern.',
  ERR_THROTTLED: 'Zu viele Versuche. Bitte kurz warten und erneut probieren.',
  ERR_GENERIC: 'Ein Fehler ist aufgetreten. Bitte erneut versuchen.',
} as const;
