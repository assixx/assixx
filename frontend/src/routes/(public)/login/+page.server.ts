/**
 * Login Page - Server Actions & Load
 * @module login/+page.server
 *
 * - Load: Redirects already-authenticated users to their dashboard
 * - Actions: Handles login form submission server-side to set httpOnly cookies
 *
 * This enables SSR pages to access the auth token via cookies.
 */
import { fail, redirect, type ActionFailure, type Cookies } from '@sveltejs/kit';

import { setAuthCookies, clearAuthCookies } from '$lib/server/auth-cookies';
import { resilientFetch } from '$lib/server/resilient-fetch';
import { verifyTurnstile } from '$lib/server/turnstile';
import { createLogger } from '$lib/utils/logger';

import { handleResendAction, handleVerifyAction } from './_lib/2fa-server-helpers';

import type { Actions, PageServerLoad } from './$types';

const log = createLogger('Login');

/** API base URL for server-side fetching */
const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

type UserRole = 'root' | 'admin' | 'employee' | 'dummy';

/**
 * Authenticated login result — mirror of backend `LoginResultBody` authenticated
 * branch (backend/src/nest/two-factor-auth/two-factor-auth.types.ts:LoginResultBody).
 *
 * Reachable today only via the OAuth `loginWithVerifiedUser()` exempt path
 * (DD-7 in FEAT_2FA_EMAIL_MASTERPLAN). Password logins always emit
 * `'challenge_required'` under v0.5.0 (DD-10 removed) — see Step 5.1.
 */
interface LoginResponseData {
  stage: 'authenticated';
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    tenantId: number;
    // Session 12c (ADR-050): tenant routing slug. `null` only for legacy
    // tenants with no subdomain populated — greenfield prod always has one.
    subdomain: string | null;
  };
}

/**
 * 2FA challenge-required login result — emitted on every password login after
 * Step 2.4 (DONE 2026-04-29). Mirror of backend `LoginResultBody`
 * challenge_required branch.
 *
 * `challengeToken` is intentionally absent: R8 mitigation requires the token
 * travel exclusively via the httpOnly Set-Cookie set by the backend
 * (auth.controller.ts:setChallengeCookie), never via the JSON body.
 */
interface ChallengeRequiredData {
  stage: 'challenge_required';
  challenge: {
    expiresAt: string;
    resendAvailableAt: string;
    resendsRemaining: number;
  };
}

/**
 * Discriminated union — narrow on `stage` before reading branch-specific
 * fields. Mirrors backend `LoginResultBody` so the frontend cannot accidentally
 * treat a challenge_required response as authenticated and skip the 2FA gate.
 */
type LoginResultData = LoginResponseData | ChallengeRequiredData;

/**
 * Response shape of `POST /api/v2/auth/handoff/mint` (Session 12c).
 *
 * NestJS wraps every controller return in `{success, data: ...}` via the
 * global response interceptor (same envelope as `/auth/login`). So the
 * raw JSON body is `{success, data: {token, subdomain}}` — we read
 * `.data.token` / `.data.subdomain`, not the top-level fields.
 *
 * `token` is the 64-hex-char handoff, `subdomain` is the target tenant slug.
 * The frontend constructs `http[s]://<slug>.<apexOrLocalhost>/signup/oauth-complete?token=X`
 * and redirects the browser there; that page (Session 12) consumes the token
 * via `POST /api/v2/auth/oauth/handoff` and sets cookies on the subdomain.
 */
interface HandoffMintEnvelope {
  success: boolean;
  data?: {
    token: string;
    subdomain: string;
  };
}

interface LoginResponse {
  success: boolean;
  data?: LoginResultData;
  error?: {
    message: string;
    code?: string;
  };
}

/** Get redirect path based on user role */
function getRedirectPath(role: UserRole): string {
  const paths: Record<UserRole, string> = {
    root: '/root-dashboard',
    admin: '/admin-dashboard',
    employee: '/employee-dashboard',
    dummy: '/blackboard',
  };
  return paths[role];
}

/** API response for /users/me */
interface MeResponse {
  success?: boolean;
  data?: { role: UserRole };
  role?: UserRole;
}

/** Extract role from /users/me response */
function extractRoleFromResponse(result: MeResponse): UserRole | null {
  return result.data?.role ?? result.role ?? null;
}

/** Check if error is a redirect (SvelteKit uses throw for redirects) */
function isRedirectError(err: unknown): boolean {
  if (err instanceof Response) return true;
  return typeof err === 'object' && err !== null && 'status' in err;
}

/**
 * Page-stage discriminator (FEAT_2FA_EMAIL_MASTERPLAN Step 5.2 v0.8.1
 * inline-design revision). The login card swaps its body content based on
 * this value:
 *   - `'credentials'`: email + password form (default state)
 *   - `'verify'`: 2FA code-entry form (after `actions.default` mints the
 *     challenge cookie + redirects back to `/login` so this load runs again)
 *
 * The cookie — not the `form` prop — is the source of truth, so a refresh in
 * the verify stage is idempotent (cookie persists, load returns the same stage).
 */
type LoginStage = 'credentials' | 'verify';

/**
 * Load — primary purpose: redirect already-authenticated users to their
 * dashboard. Secondary purpose (Step 5.2): detect a pending 2FA challenge
 * via the httpOnly `challengeToken` cookie and surface the stage to the
 * page so the card body can swap to the verify form.
 *
 * NOTE: We intentionally bypass SvelteKit's scoped `fetch` here. The target
 * `${API_BASE}/users/me` is cross-origin (backend :3000), so the enhancements
 * offered by the scoped fetch (same-origin cookie-forwarding, relative URL
 * resolution) add nothing. `resilientFetch` wraps the global fetch with
 * retry-on-ECONNRESET semantics that matter much more for this auth check.
 */
export const load: PageServerLoad = async ({ cookies }) => {
  // Fast path: pending 2FA challenge → verify stage. Checked BEFORE the
  // /users/me probe because a user mid-2FA does NOT have an accessToken yet
  // (tokens are minted only AFTER verify succeeds), so the probe would 401
  // and clear cookies anyway. Short-circuiting is cheaper and preserves the
  // challenge cookie for the verify action.
  const challengeToken = cookies.get('challengeToken');
  if (challengeToken !== undefined && challengeToken !== '') {
    return { stage: 'verify' satisfies LoginStage };
  }

  const token = cookies.get('accessToken');

  if (token === undefined || token === '') {
    return { stage: 'credentials' satisfies LoginStage };
  }

  try {
    // resilientFetch retries transient network errors (ECONNRESET etc.) so an
    // in-flight backend restart (HMR rebuild / rolling deploy / OOM recovery —
    // ~3–4 s Fastify bootstrap window) does not bounce authenticated users
    // back to the login page instead of their dashboard. GET — idempotent.
    const response = await resilientFetch(`${API_BASE}/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      log.debug('Token invalid, clearing cookies');
      clearAuthCookies(cookies);
      return { stage: 'credentials' satisfies LoginStage };
    }

    const result = (await response.json()) as MeResponse;
    const role = extractRoleFromResponse(result);

    if (role === null) {
      log.warn('No role in /users/me response');
      return { stage: 'credentials' satisfies LoginStage };
    }

    log.debug({ role }, 'User already logged in, redirecting to dashboard');
    redirect(302, getRedirectPath(role));
  } catch (err: unknown) {
    if (isRedirectError(err)) throw err;
    log.error({ err }, 'Error checking auth status');
    return { stage: 'credentials' satisfies LoginStage };
  }
};

/** Validate that a form field is a non-empty string */
function isValidStringField(value: FormDataEntryValue | null): value is string {
  return typeof value === 'string' && value !== '';
}

/** Check if login response indicates success with valid data (any stage). */
function isSuccessfulLogin(
  response: Response,
  result: LoginResponse,
): result is LoginResponse & { data: LoginResultData } {
  return response.ok && result.success && result.data !== undefined;
}

/** Get error response for failed login based on status */
function getLoginErrorResponse(response: Response, result: LoginResponse, email: string) {
  if (response.status === 429) {
    return fail(429, {
      error: 'Zu viele Anmeldeversuche. Bitte warten Sie.',
      email,
    });
  }
  return fail(401, {
    error: result.error?.message ?? 'Login fehlgeschlagen',
    email,
  });
}

/**
 * Extract `challengeToken` from the backend's `Set-Cookie` headers.
 *
 * **Why this is needed:** the backend (`auth.controller.ts:setChallengeCookie`)
 * sets `challengeToken` as an httpOnly Set-Cookie on the `/auth/login` response.
 * SvelteKit's server-side `fetch` to the backend is **cross-origin**
 * (SvelteKit on :5173/:3001, backend on :3000), so the Set-Cookie header
 * arrives at the SvelteKit fetch but is **NOT** auto-forwarded to the browser.
 * We extract the value here and re-emit on the SvelteKit response so the
 * browser stores the cookie on the same origin where `/login/verify` reads it.
 *
 * **R8 invariant preserved:** the token never crosses any JS-readable surface
 * — body strips it (backend `LoginResultBody.challenge` is `PublicTwoFactorChallenge`
 * which omits `challengeToken`), and both hops keep it httpOnly.
 *
 * @returns the raw `challengeToken` value, or `null` if no matching header is
 *   present (defensive — the backend always sets it on `stage='challenge_required'`,
 *   missing case is treated as a server error rather than silent retry).
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
 * Handle the `stage='challenge_required'` branch: forward the backend's
 * `challengeToken` Set-Cookie onto the SvelteKit response and 303-redirect to
 * `/login/verify`.
 *
 * Extracted from `actions.default` to keep the action body under the
 * cognitive-complexity / max-lines ceilings — Step 5.1 added one new branch
 * which tipped the action over both limits.
 *
 * Return semantics:
 *   - happy path: throws SvelteKit `redirect(303)` → never returns.
 *   - failure path (no Set-Cookie despite stage=challenge_required): returns
 *     `ActionFailure` so the caller can `return` it. `never` from `redirect()`
 *     is assignable to `ActionFailure`, hence the union narrows to the
 *     failure shape only.
 */
function handleChallengeRequiredOrFail(
  response: Response,
  cookies: Cookies,
  url: URL,
  email: string,
): ActionFailure<{ error: string; email: string }> {
  const challengeToken = extractChallengeTokenFromSetCookie(response);
  if (challengeToken === null) {
    log.error(
      'Backend returned stage=challenge_required without a challengeToken Set-Cookie header — backend contract violation',
    );
    return fail(500, { error: 'Ein Serverfehler ist aufgetreten', email });
  }
  // Cookie attributes mirror backend `CHALLENGE_COOKIE_OPTIONS`
  // (auth.controller.ts:CHALLENGE_COOKIE_OPTIONS) so the SvelteKit-side cookie
  // cannot outlive its Redis-backed challenge record. `secure` derived from
  // request URL protocol per ARCHITECTURE.md §1.2 — same pattern as
  // `setAuthCookies` in `$lib/server/auth-cookies`.
  cookies.set('challengeToken', challengeToken, {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10, // CODE_TTL_SEC mirror — 10 min, matches backend
  });
  // Step 5.2 v0.8.1 (inline-card revision): redirect back to /login so the
  // load function reads the freshly-set challengeToken cookie and returns
  // `stage: 'verify'` — the card body then swaps to TwoFactorVerifyForm.
  // No separate `/login/verify` route in this design.
  redirect(303, '/login');
}

/** Verify Turnstile token from form data, return fail response on failure */
async function verifyTurnstileFromForm(
  request: Request,
  turnstileToken: FormDataEntryValue | null,
  email: string,
): Promise<ActionFailure<{ error: string; email: string }> | null> {
  const tokenValue = typeof turnstileToken === 'string' ? turnstileToken : '';
  if (tokenValue === '') return null;

  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? '';
  const valid = await verifyTurnstile(tokenValue, ip, 'login');

  if (!valid) {
    return fail(403, {
      error: 'Sicherheitsprüfung fehlgeschlagen. Bitte versuchen Sie es erneut.',
      email,
    });
  }
  return null;
}

/**
 * Build the subdomain-scoped handoff URL the browser should navigate to
 * after apex-login mint (Session 12c).
 *
 * Rules:
 *   - `localhost`                → `{slug}.localhost` (dev)
 *   - `assixx.com` / `www.assixx.com` → `{slug}.assixx.com` (prod apex)
 *   - subdomain already          → swap first label (cross-subdomain redirect)
 *
 * Preserves protocol + port from the current request URL, so dev on
 * `:5173` stays on `:5173` and prod stays on 443.
 */
function buildSubdomainHandoffUrl(slug: string, token: string, request: Request): string {
  const url = new URL(request.url);
  const hostname = url.hostname;

  let newHost: string;
  if (hostname === 'localhost' || hostname === 'assixx.com') {
    newHost = `${slug}.${hostname}`;
  } else if (hostname === 'www.assixx.com') {
    newHost = `${slug}.assixx.com`;
  } else {
    // Subdomain context (incl. `foo.localhost`) — replace first label.
    const parts = hostname.split('.');
    parts[0] = slug;
    newHost = parts.join('.');
  }

  const port = url.port ? `:${url.port}` : '';
  return `${url.protocol}//${newHost}${port}/signup/oauth-complete?token=${encodeURIComponent(token)}`;
}

/**
 * Session 12c (ADR-050): if the browser authenticated on the apex (or a
 * different subdomain than the user's tenant), mint a handoff token and
 * return an absolute redirect URL pointing at the correct subdomain.
 *
 * Extracted to keep the login action body under the 60-line / complexity-10
 * ceiling. Returns `null` when no handoff is needed (user is already on
 * their correct origin OR tenant has no subdomain configured), in which
 * case the caller falls through to normal apex-cookie flow.
 */
async function buildHandoffRedirect(
  data: LoginResponseData,
  hostSlug: string | null,
  fetchFn: typeof fetch,
  request: Request,
): Promise<string | null> {
  const userSubdomain = data.user.subdomain;
  if (userSubdomain === null || userSubdomain === hostSlug) {
    // No subdomain configured, or user is already on the right origin.
    return null;
  }

  const mintResp = await fetchFn(`${API_BASE}/auth/handoff/mint`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.accessToken}`,
    },
    body: JSON.stringify({ refreshToken: data.refreshToken }),
  });

  if (!mintResp.ok) {
    // Defensive: mint failed. Caller logs + falls back to apex cookies.
    log.error(
      { status: mintResp.status, userSubdomain, hostSlug },
      'Handoff mint failed after successful login — falling back to apex cookies',
    );
    return null;
  }

  // NestJS ResponseInterceptor wraps controller returns in `{success, data}`
  // unconditionally for JSON responses (see app.module.ts APP_INTERCEPTOR
  // registration). Read via `.data.xxx` — direct access returns undefined
  // and produces "http://undefined.localhost:5173/?token=undefined" bugs.
  const envelope = (await mintResp.json()) as HandoffMintEnvelope;
  if (envelope.data === undefined) {
    log.error({ envelope }, 'Handoff mint returned no `data` field — envelope shape drift?');
    return null;
  }
  return buildSubdomainHandoffUrl(envelope.data.subdomain, envelope.data.token, request);
}

export const actions: Actions = {
  // Credentials submit. Renamed from `default` to a named action because
  // SvelteKit forbids mixing `default` with named actions in the same
  // `actions` object (`check_named_default_separate` in
  // @sveltejs/kit/src/runtime/server/page/actions.js) — Step 5.2 added
  // `verify` + `resend` named actions, so this one had to follow.
  // The companion `<form action="?/login">` is in `+page.svelte`.
  login: async ({ request, cookies, fetch, locals, url }) => {
    const formData = await request.formData();
    const email = formData.get('email');
    const password = formData.get('password');
    const turnstileToken = formData.get('turnstileToken');

    if (!isValidStringField(email) || !isValidStringField(password)) {
      const emailValue = typeof email === 'string' ? email : '';
      return fail(400, {
        error: 'E-Mail und Passwort sind erforderlich',
        email: emailValue,
      });
    }

    const turnstileError = await verifyTurnstileFromForm(request, turnstileToken, email);
    if (turnstileError !== null) return turnstileError;

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const result = (await response.json()) as LoginResponse;

      if (!isSuccessfulLogin(response, result)) {
        return getLoginErrorResponse(response, result, email);
      }

      // 2FA branch — Step 5.1, FEAT_2FA_EMAIL_MASTERPLAN v0.8.0. Backend Step
      // 2.4 (DONE 2026-04-29) emits `stage: 'challenge_required'` on every
      // password login under v0.5.0 (DD-10 removed). Helper forwards the
      // httpOnly challengeToken cookie + 303s to /login/verify (Step 5.2). R8
      // invariant: token never reaches JS-readable state (httpOnly on both hops).
      if (result.data.stage === 'challenge_required') {
        return handleChallengeRequiredOrFail(response, cookies, url, email);
      }

      // Authenticated branch — currently reachable only via OAuth bypass paths
      // (`loginWithVerifiedUser`, DD-7 exempt). Password logins always hit the
      // `'challenge_required'` branch above. Existing handoff + 3-cookie triad
      // logic unchanged below.
      //
      // Session 12c (ADR-050): origin-aware branch. If user's tenant has a
      // subdomain AND we're NOT on it, mint a handoff token so cookies land
      // on the correct subdomain. Otherwise fall through to apex-cookie flow.
      const handoffUrl = await buildHandoffRedirect(result.data, locals.hostSlug, fetch, request);
      if (handoffUrl !== null) {
        // IMPORTANT: do NOT setAuthCookies() — cookies must land on the
        // subdomain origin, not apex. Subdomain page (Session 12 consumer)
        // swaps the handoff token and sets cookies there.
        //
        // ADR-050 × ADR-022: include accessToken + user identity so the
        // client-side use:enhance callback can mint the cross-origin escrow
        // unlock ticket BEFORE the redirect. The accessToken lives in JS
        // memory on the apex for a few hundred ms and is never persisted
        // (no localStorage / cookie here) — it just buys authenticated
        // access to `/e2e/escrow` + `/e2e/escrow/unlock-ticket` during the
        // cross-origin handoff window. User id is needed because the Worker
        // scopes IndexedDB per user (`assixx-e2e-user-${id}`); the tenant
        // id is forwarded for future cross-tenant debugging only — backend
        // derives authoritative tenantId from the JWT, not from client input.
        return {
          success: true,
          redirectTo: handoffUrl,
          user: {
            id: result.data.user.id,
            role: result.data.user.role,
            tenantId: result.data.user.tenantId,
          },
          accessToken: result.data.accessToken,
        };
      }

      setAuthCookies(
        cookies,
        url,
        result.data.accessToken,
        result.data.refreshToken,
        result.data.user.role,
      );

      return {
        success: true,
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        user: result.data.user,
        redirectTo: getRedirectPath(result.data.user.role),
      };
    } catch (err: unknown) {
      // Step 5.1: SvelteKit `redirect()` is implemented as a thrown sentinel
      // (`{status, location}`). The challenge_required branch above relies on
      // this throw to propagate; without the explicit rethrow the generic
      // catch would swallow it and emit a 500. Mirrors the `load`-fn pattern
      // at the top of this file.
      if (isRedirectError(err)) throw err;
      log.error({ err }, 'Server error');
      return fail(500, { error: 'Ein Serverfehler ist aufgetreten', email });
    }
  },

  /**
   * 2FA verify action — invoked from the inline verify card after the user
   * types the 6-character code. Implementation lives in
   * `_lib/2fa-server-helpers.ts` to keep this file under the 800-line ceiling
   * + each action under the 60-line / complexity-10 ceilings.
   *
   * Throws SvelteKit `redirect()` on the happy path (→ role-based dashboard);
   * returns `ActionFailure<VerifyActionFailureData>` for typed UX errors
   * (wrong code / lockout / throttle / expired challenge).
   *
   * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §5.2
   */
  verify: handleVerifyAction,

  /**
   * 2FA resend action — invoked from the inline verify card's "Code erneut
   * senden" button. Backend overwrites the Redis challenge in place; the
   * existing httpOnly `challengeToken` cookie keeps working unchanged.
   * Returns `{ resent: true, resendsRemaining, resendAvailableAt }` on
   * success or a typed `ActionFailure` for cooldown / cap / expired errors.
   *
   * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §5.2
   */
  resend: handleResendAction,

  /**
   * 2FA cancel action — "Zurück zur Anmeldung" submit. Without this action
   * a `<a href="/login">` would just hard-navigate to /login, where load()
   * reads the still-present `challengeToken` cookie and re-renders the
   * verify stage → user is stuck until the cookie's 10-min TTL expires.
   *
   * Cleanup scope (KISS, mirrors signup twin):
   *   1. Apex `challengeToken` cookie deleted → next load() falls through
   *      to `stage: 'credentials'`.
   *   2. Backend Redis record self-expires after `CODE_TTL_SEC` (10 min).
   *
   * Bug discovered + fix mirrored from signup 2026-04-30 evening.
   * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §5.2
   */
  cancel: ({ cookies }) => {
    cookies.delete('challengeToken', { path: '/' });
    redirect(303, '/login');
  },
};
