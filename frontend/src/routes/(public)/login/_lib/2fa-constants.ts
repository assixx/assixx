// =============================================================================
// LOGIN PAGE — 2FA STAGE CONSTANTS
// =============================================================================
//
// Login-flavoured copy for the inline 2FA-verify stage on the login card
// (FEAT_2FA_EMAIL_MASTERPLAN Step 5.2 v0.8.1, Step 5.5 i18n centralization
// v0.8.3 2026-04-30). Protocol invariants + flow-agnostic strings live in
// `(public)/_lib/2fa-shared.ts`; only login-specific overrides + login-only
// keys (the `INTRO(email)` template helper) are declared here.
//
// Originally lived under `(public)/login/verify/_lib/constants.ts`; moved
// here when the separate-route design (`/login/verify`) was retired in
// favour of the user-requested single-card UX (Step 5.2 v0.8.1).
//
// @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §5.2 (inline-card UX) and §5.5 (i18n)
// @see frontend/src/routes/(public)/_lib/2fa-shared.ts (shared invariants)
// @see frontend/src/routes/(public)/signup/_lib/2fa-constants.ts (signup twin)

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
 * Spreads `COMMON_MESSAGES` (flow-agnostic copy) and adds login-flavoured
 * overrides for HEADING / INTRO_FALLBACK / BTN_BACK / ERR_RESEND_LIMIT, plus
 * the login-only `INTRO(email)` template helper.
 *
 * UPPER_CASE convention is intentional for ALL keys (string and
 * function-valued template helpers) to keep the record visually homogeneous
 * and match the masterplan §5.5 contract — block-scoped naming-convention
 * disable below.
 *
 * @see masterplan §5.5 verbatim source
 */
/* eslint-disable @typescript-eslint/naming-convention -- UPPER_CASE for all MESSAGES keys, including function-valued template helpers; see JSDoc above. */
export const MESSAGES = {
  ...COMMON_MESSAGES,
  HEADING: 'Bestätigungscode eingeben',
  INTRO: (email: string) => `Wir haben einen 6-stelligen Code an ${email} gesendet.`,
  // Fallback intro when the email is unknown to the page (load did not have it).
  // The challenge cookie is opaque to the frontend; we can't decode the email
  // from it, and the page-server load deliberately does NOT fetch challenge
  // metadata (would require a new GET endpoint just for this label — YAGNI).
  INTRO_FALLBACK: 'Wir haben einen 6-stelligen Code an Ihre E-Mail-Adresse gesendet.',
  BTN_BACK: 'Zurück zur Anmeldung',
  ERR_RESEND_LIMIT: 'Maximale Anzahl an Resends erreicht. Bitte starten Sie den Login neu.',
} as const;
