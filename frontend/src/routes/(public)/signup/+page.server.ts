/**
 * Signup Page — Server Actions & Load (FEAT_2FA_EMAIL_MASTERPLAN Step 5.4 +
 * 5.3, v0.8.2 inline-card revision 2026-04-30).
 *
 * Net-new file per masterplan §5.4 (DD-19): the legacy signup page POSTed
 * client-side via `_lib/api.ts`; this server-side action replaces that hop so
 * the backend's `challengeToken` Set-Cookie can be forwarded to the browser
 * (cross-origin Set-Cookie is NOT auto-forwarded by SvelteKit's server-side
 * `fetch`, mirroring the same constraint resolved on the login page in
 * Step 5.1).
 *
 * Load:
 *   Returns `stage: 'credentials' | 'verify'` based on the presence of the
 *   `challengeToken` httpOnly cookie. The signup page surfaces this via
 *   `data.stage` and swaps its body between the 20-field credentials form
 *   and `<TwoFactorVerifyForm />`. Cookie — not the `form` prop — is the
 *   source of truth, so refresh in the verify stage is idempotent.
 *
 *   NOTE: signup does NOT redirect already-authenticated users to a dashboard
 *   the way login does. A user mid-signup has no access token (tokens are
 *   minted only after 2FA verify and land on the new tenant's subdomain via
 *   apex→subdomain handoff, not on apex). The credentials-stage code path
 *   is the default state for any visitor.
 *
 * Actions:
 *   - `signup` (named): Turnstile verify + payload normalisation + POST to
 *     `/api/v2/signup`. Backend creates pending tenant + pending root user
 *     (`is_active = INACTIVE`) and emails a 6-character code. We forward the
 *     httpOnly `challengeToken` Set-Cookie onto the SvelteKit response and
 *     303-redirect back to `/signup` so the next `load` reads the cookie
 *     and surfaces `stage='verify'`. R8 invariant preserved end-to-end.
 *   - `verify`: delegates to `_lib/2fa-server-helpers::handleVerifyAction`.
 *     On success the helper builds a cross-origin handoff URL
 *     (`https://<subdomain>.<apex>/signup/oauth-complete?token=<handoff>`)
 *     and 303s the browser there. Apex challenge cookie cleared on consume.
 *   - `resend`: delegates to `_lib/2fa-server-helpers::handleResendAction`.
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §5.3 + §5.4
 * @see docs/infrastructure/adr/ADR-005-authentication-strategy.md (R8)
 * @see docs/infrastructure/adr/ADR-007-api-response-standardization.md (envelope)
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md (handoff)
 * @see (public)/login/+page.server.ts (login twin, Step 5.1)
 */
import { fail, redirect, type ActionFailure, type Cookies } from '@sveltejs/kit';

import { verifyTurnstile } from '$lib/server/turnstile';
import { createLogger } from '$lib/utils/logger';

import { handleResendAction, handleVerifyAction } from './_lib/2fa-server-helpers';

import type { Actions, PageServerLoad } from './$types';

const log = createLogger('Signup');

/** API base URL for server-side fetching — same convention as login. */
const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

/**
 * Backend `LoginResultBody` discriminated union (mirror of
 * `backend/src/nest/two-factor-auth/two-factor-auth.types.ts:LoginResultBody`).
 * Under v0.5.0 (DD-10 removed) every password signup emits
 * `'challenge_required'`. The `'authenticated'` branch is preserved for
 * compile-time exhaustiveness.
 */
interface ChallengeRequiredData {
  stage: 'challenge_required';
  challenge: {
    expiresAt: string;
    resendAvailableAt: string;
    resendsRemaining: number;
  };
}

interface AuthenticatedData {
  stage: 'authenticated';
  accessToken: string;
  refreshToken: string;
  user: { id: number; email: string; role: string };
}

type SignupResultData = ChallengeRequiredData | AuthenticatedData;

interface SignupResponseEnvelope {
  success: boolean;
  data?: SignupResultData;
  error?: { message: string; code?: string };
}

/**
 * Page-stage discriminator (mirror of login's). The signup card swaps its
 * body content based on this value:
 *   - `'credentials'`: 20-field signup form (default state).
 *   - `'verify'`: 2FA code-entry form (after `actions.signup` mints the
 *     challenge cookie + 303-redirects back to `/signup`).
 */
type SignupStage = 'credentials' | 'verify';

/** SvelteKit `redirect()` is a thrown sentinel; same guard as login. */
function isRedirectError(err: unknown): boolean {
  if (err instanceof Response) return true;
  return typeof err === 'object' && err !== null && 'status' in err;
}

// Sync `load` — no awaits needed (no /users/me probe like login has, since
// signup users have no access token on apex). Dropping the `async` keyword
// satisfies @typescript-eslint/require-await; PageServerLoad accepts both
// sync and async signatures.
export const load: PageServerLoad = ({ cookies }) => {
  // Stage discriminator: pending challenge cookie → verify stage. Same
  // pattern as login but without the authenticated-user fast path
  // (apex never receives access-token cookies; tokens land on the new
  // tenant's subdomain via the post-verify cross-origin handoff).
  const challengeToken = cookies.get('challengeToken');
  if (challengeToken !== undefined && challengeToken !== '') {
    return { stage: 'verify' satisfies SignupStage };
  }
  return { stage: 'credentials' satisfies SignupStage };
};

/** Read a non-empty string field from formData. */
function readStringField(value: FormDataEntryValue | null): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * Build the backend signup DTO from the submitted formData. Mirrors the
 * client-side `createRegisterPayload` in `_lib/api.ts` so the wire shape
 * stays unchanged — backend `SignupSchema` accepts `{ companyName,
 * subdomain, email, phone, adminEmail, adminPassword, adminFirstName,
 * adminLastName }`. Returns null on any missing required field so the
 * caller can fail-fast with a UX message instead of a 400 from the backend.
 */
function buildSignupPayload(formData: FormData): {
  companyName: string;
  subdomain: string;
  email: string;
  phone: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
} | null {
  const companyName = readStringField(formData.get('companyName'));
  const subdomain = readStringField(formData.get('subdomain'));
  const email = readStringField(formData.get('email'));
  const phoneRaw = readStringField(formData.get('phone'));
  const countryCode = readStringField(formData.get('countryCode')) ?? '+49';
  const adminFirstName = readStringField(formData.get('adminFirstName'));
  const adminLastName = readStringField(formData.get('adminLastName'));
  const adminPassword = readStringField(formData.get('adminPassword'));

  if (
    companyName === null ||
    subdomain === null ||
    email === null ||
    phoneRaw === null ||
    adminFirstName === null ||
    adminLastName === null ||
    adminPassword === null
  ) {
    return null;
  }

  // Combine country code + digits-only phone (matches `_lib/api.ts:createRegisterPayload`).
  const fullPhone = `${countryCode}${phoneRaw.replace(/\s/g, '')}`;

  return {
    companyName,
    subdomain,
    email,
    phone: fullPhone,
    adminEmail: email,
    adminPassword,
    adminFirstName,
    adminLastName,
  };
}

/**
 * Verify Turnstile token from the submitted formData. Returns null on
 * success / no-token (token is optional in dev — Turnstile may be disabled),
 * or an `ActionFailure` carrying the German UX message on verification
 * failure. Mirrors login's `verifyTurnstileFromForm`.
 */
async function verifyTurnstileFromForm(
  request: Request,
  turnstileToken: FormDataEntryValue | null,
): Promise<ActionFailure<{ error: string }> | null> {
  const tokenValue = typeof turnstileToken === 'string' ? turnstileToken : '';
  if (tokenValue === '') return null;

  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? '';
  const valid = await verifyTurnstile(tokenValue, ip, 'signup');

  if (!valid) {
    return fail(403, {
      error: 'Sicherheitsprüfung fehlgeschlagen. Bitte versuchen Sie es erneut.',
    });
  }
  return null;
}

/**
 * Extract `challengeToken` from the backend's `Set-Cookie` headers. Same
 * cross-origin Set-Cookie forwarding as login (Step 5.1). The backend's
 * SignupController calls `setChallengeCookie(reply)` which emits the same
 * cookie shape login does — anchored regex on `^challengeToken=` prevents
 * accidental substring matches on adjacent cookies.
 */
function extractChallengeTokenFromSetCookie(response: Response): string | null {
  const setCookieHeaders = response.headers.getSetCookie();
  for (const header of setCookieHeaders) {
    const match = /^challengeToken=([^;]+)/.exec(header);
    if (match?.[1] !== undefined) {
      return decodeURIComponent(match[1]);
    }
  }
  return null;
}

/**
 * Forward the backend's `challengeToken` Set-Cookie onto the SvelteKit
 * response and 303-redirect to `/signup` (so the next `load` picks up the
 * cookie and surfaces `stage='verify'`).
 *
 * Throws SvelteKit `redirect(303)` on the happy path → never returns. On
 * the failure path (no Set-Cookie despite stage=challenge_required) returns
 * an `ActionFailure` so the caller can `return` it.
 *
 * Same pattern as login's `handleChallengeRequiredOrFail` — extracted for
 * symmetry and to keep the action body under the cognitive-complexity / max-
 * lines ceilings.
 */
function handleChallengeRequiredOrFail(
  response: Response,
  cookies: Cookies,
  url: URL,
): ActionFailure<{ error: string }> {
  const challengeToken = extractChallengeTokenFromSetCookie(response);
  if (challengeToken === null) {
    log.error(
      'Signup backend returned stage=challenge_required without a challengeToken Set-Cookie header — backend contract violation',
    );
    return fail(500, { error: 'Ein Serverfehler ist aufgetreten' });
  }
  // Cookie attributes mirror backend `CHALLENGE_COOKIE_OPTIONS`
  // (auth.controller.ts:CHALLENGE_COOKIE_OPTIONS) and login's Step 5.1
  // implementation — secure derived from request URL protocol per
  // ARCHITECTURE.md §1.2.
  cookies.set('challengeToken', challengeToken, {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10, // CODE_TTL_SEC mirror — 10 min, matches backend
  });
  // Redirect back to /signup so the load function reads the freshly-set
  // challengeToken cookie and returns `stage: 'verify'` — the card body
  // then swaps to TwoFactorVerifyForm. No separate `/signup/verify` route
  // in this design (mirrors login Step 5.2 v0.8.1 inline revision).
  redirect(303, '/signup');
}

/** Map a known backend signup-validation error code to the German UX message. */
function mapSignupError(status: number, body: SignupResponseEnvelope): string {
  if (status === 429) {
    return 'Zu viele Anmeldeversuche. Bitte warten Sie einen Moment.';
  }
  if (status === 503) {
    return 'Der Bestätigungscode konnte nicht gesendet werden. Bitte erneut versuchen.';
  }
  // 400/409 (validation, conflict) → backend's German message is already
  // user-friendly and code-mapped (e.g. "Subdomain ist bereits vergeben").
  return body.error?.message ?? 'Registrierung fehlgeschlagen.';
}

export const actions: Actions = {
  /**
   * Credentials submit. Named `signup` (mirror of login's `?/login` named
   * action) because SvelteKit forbids mixing `default` with named actions
   * in the same `actions` object — `verify` + `resend` below are named, so
   * this one must follow.
   *
   * The companion `<form action="?/signup">` is in `+page.svelte`.
   */
  signup: async ({ request, cookies, fetch, url }) => {
    const formData = await request.formData();

    const payload = buildSignupPayload(formData);
    if (payload === null) {
      return fail(400, { error: 'Bitte füllen Sie alle Pflichtfelder aus.' });
    }

    const turnstileError = await verifyTurnstileFromForm(request, formData.get('turnstileToken'));
    if (turnstileError !== null) return turnstileError;

    try {
      // Server-side fetch — `resilientFetch` retries transient ECONNRESET
      // (mirrors login's resilience pattern; signup is a write so retry is
      // limited to the connection establishment phase, not the request body).
      const response = await fetch(`${API_BASE}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as SignupResponseEnvelope;

      if (!response.ok || !result.success || result.data === undefined) {
        return fail(response.status, { error: mapSignupError(response.status, result) });
      }

      // 2FA branch — backend Step 2.5 (DONE 2026-04-29) emits
      // `stage: 'challenge_required'` on every password signup under v0.5.0
      // (DD-10 removed). Helper forwards the httpOnly challengeToken cookie
      // + 303s to /signup (which load() then surfaces as stage='verify').
      // R8 invariant: token never reaches JS-readable state.
      if (result.data.stage === 'challenge_required') {
        return handleChallengeRequiredOrFail(response, cookies, url);
      }

      // Authenticated branch — currently unreachable from POST /signup under
      // v0.5.0 (every password signup issues a challenge). Kept for future
      // per-tenant skip flag (V2). If reached, this path would need to set
      // auth cookies on the apex — but apex auth cookies scope to the wrong
      // origin for the new tenant's subdomain, so the correct action would
      // be to mint a handoff token and redirect there. NOT IMPLEMENTED here
      // because the branch is unreachable; if v2 introduces it, mirror the
      // login `+page.server.ts::buildHandoffRedirect` pattern.
      log.warn(
        'Signup returned stage=authenticated — unreachable under v0.5.0; v2 per-tenant 2FA-skip flag would land here',
      );
      return fail(500, { error: 'Ein Serverfehler ist aufgetreten.' });
    } catch (err: unknown) {
      // SvelteKit `redirect()` is implemented as a thrown sentinel; same
      // rethrow guard as login's catch block.
      if (isRedirectError(err)) throw err;
      log.error({ err }, 'Signup request failed');
      return fail(500, { error: 'Ein Serverfehler ist aufgetreten.' });
    }
  },

  /**
   * 2FA verify action — invoked from the inline verify card after the user
   * types the 6-character code. Implementation lives in
   * `_lib/2fa-server-helpers.ts` to keep this file under the 800-line ceiling
   * + each action under the 60-line / complexity-10 ceilings.
   *
   * Throws SvelteKit `redirect()` on the happy path (→ cross-origin
   * subdomain handoff URL); returns `ActionFailure` for typed UX errors.
   *
   * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §5.3
   */
  verify: handleVerifyAction,

  /**
   * 2FA resend action — invoked from the inline verify card's "Code erneut
   * senden" button. Backend overwrites the Redis challenge in place; the
   * existing httpOnly `challengeToken` cookie keeps working unchanged.
   *
   * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §5.3
   */
  resend: handleResendAction,

  /**
   * 2FA cancel action — invoked from the verify card's "Zurück zur
   * Registrierung" button. Without this action a `<a href="/signup">` link
   * would just hard-navigate to /signup, where `load()` reads the still-
   * present `challengeToken` cookie and returns `stage: 'verify'` again →
   * the user is stuck in the verify stage until the cookie's 10-min TTL
   * expires.
   *
   * Cleanup scope (KISS):
   *   1. Apex `challengeToken` cookie deleted → next load() falls through
   *      to `stage: 'credentials'`.
   *   2. Backend Redis record (`2fa:challenge:{token}`) self-expires after
   *      `CODE_TTL_SEC` (10 min) — no backend abort endpoint needed.
   *   3. Pending tenant + user rows are reaped by the stale-pending-reaper
   *      cron (Step 2.11) — no eager DELETE here.
   *
   * 303 to /signup so the browser's POST→GET cycle re-runs `load()` and
   * surfaces `stage='credentials'` cleanly. SvelteKit's `redirect()` is a
   * thrown sentinel; the `enhanceCancel` callback in TwoFactorVerifyForm
   * hard-navs on `result.type === 'redirect'` to guarantee the load runs
   * server-side with the cookie already cleared.
   */
  cancel: ({ cookies }) => {
    cookies.delete('challengeToken', { path: '/' });
    redirect(303, '/signup');
  },
};
