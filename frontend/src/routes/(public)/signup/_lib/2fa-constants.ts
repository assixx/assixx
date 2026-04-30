// =============================================================================
// SIGNUP PAGE — 2FA STAGE CONSTANTS
// =============================================================================
//
// Signup-flavoured copy for the inline 2FA-verify stage on the signup card
// (FEAT_2FA_EMAIL_MASTERPLAN Step 5.3 v0.8.2, Step 5.5 i18n centralization
// v0.8.3 2026-04-30). Protocol invariants + flow-agnostic strings live in
// `(public)/_lib/2fa-shared.ts`; only signup-specific overrides + signup-only
// keys (VERIFY_SUCCESS_TITLE / VERIFY_SUCCESS_MESSAGE) are declared here.
//
// Differs from `(public)/login/_lib/2fa-constants.ts` ONLY in:
//   - HEADING:           "E-Mail bestätigen" (signup tone — first-time email
//                        ownership proof, not a per-login re-verification)
//   - INTRO_FALLBACK:    Mentions the registration completion goal so the
//                        user understands why the code arrived
//   - BTN_BACK:          Points back to the signup card (`/signup`), not
//                        login. Matches the lockout-redirect target.
//   - ERR_RESEND_LIMIT:  Redirects user to "Registrierung neu" not "Login neu"
//   - VERIFY_SUCCESS_*:  Signup-only post-verify success toast (login lands
//                        directly on the dashboard via same-origin redirect)
//
// All other strings (errors, button labels, hints) come from `COMMON_MESSAGES`
// in `_lib/2fa-shared.ts` — drift between login and signup is now structural,
// not human-enforced.
//
// @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §5.3 (inline-card UX) and §5.5 (i18n)
// @see frontend/src/routes/(public)/_lib/2fa-shared.ts (shared invariants)
// @see frontend/src/routes/(public)/login/_lib/2fa-constants.ts (login twin)

import { COMMON_MESSAGES } from '../../_lib/2fa-shared';

export {
  CODE_LENGTH,
  CODE_REGEX,
  INITIAL_RESENDS_REMAINING,
  LOCKOUT_REDIRECT_DELAY_MS,
  MAX_VERIFY_ATTEMPTS,
  RESEND_COOLDOWN_SEC,
} from '../../_lib/2fa-shared';

/**
 * UI strings — German with proper ä/ö/ü/ß per CODE-OF-CONDUCT-SVELTE.
 * Spreads `COMMON_MESSAGES` (flow-agnostic copy) and adds signup-flavoured
 * overrides for HEADING / INTRO_FALLBACK / BTN_BACK / ERR_RESEND_LIMIT plus
 * the signup-only post-verify success toast strings.
 *
 * UPPER_CASE convention is intentional for ALL keys to keep the record
 * visually homogeneous and match the masterplan §5.5 contract. The
 * function-valued template helpers (`BTN_RESEND_COOLDOWN`, `ERR_WRONG_CODE`)
 * — which would otherwise trip `@typescript-eslint/naming-convention` — are
 * supplied by the spread from `COMMON_MESSAGES` and declared in the shared
 * module, where the rule is disabled centrally. No local override-key in
 * this file is function-valued, so no per-file disable is needed here.
 *
 * @see masterplan §5.5 verbatim source
 * @see (public)/login/_lib/2fa-constants.ts (login twin — diverges only on
 *      HEADING / INTRO_FALLBACK / BTN_BACK / ERR_RESEND_LIMIT)
 */
export const MESSAGES = {
  ...COMMON_MESSAGES,
  // Signup-specific copy per masterplan §5.3
  HEADING: 'E-Mail bestätigen',
  // German `schliessen` per ß rule (masterplan §5.3 explicit instruction)
  INTRO_FALLBACK: 'Bitte bestätigen Sie Ihre E-Mail-Adresse, um die Registrierung abzuschliessen.',
  // Signup-specific: back to the signup form, not the login page.
  BTN_BACK: 'Zurück zur Registrierung',
  ERR_RESEND_LIMIT: 'Maximale Anzahl an Resends erreicht. Bitte starten Sie die Registrierung neu.',
  // Post-verify success toast (signup-only). Login lands directly on the
  // dashboard via same-origin redirect — no toast needed there. For signup
  // the verify-success branch hops cross-origin to `<subdomain>.<apex>/
  // signup/oauth-complete?token=…`; surfacing a 5 s acknowledgement before
  // the hop matches the legacy pre-2FA UX (`showToast` + `SUCCESS_REDIRECT_DELAY`
  // in the old `handleSubmit`) and gives the user a beat to register that the
  // origin is about to change.
  VERIFY_SUCCESS_TITLE: 'Registrierung abgeschlossen',
  VERIFY_SUCCESS_MESSAGE: 'Sie werden zu Ihrem Dashboard weitergeleitet …',
} as const;
