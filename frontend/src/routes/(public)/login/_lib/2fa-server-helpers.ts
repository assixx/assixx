/**
 * 2FA server-side action handlers for the login page (FEAT_2FA_EMAIL_MASTERPLAN
 * Step 5.2 v0.8.1, inline-card revision 2026-04-30).
 *
 * Hosts the `verify` + `resend` named-action implementations consumed from
 * `(public)/login/+page.server.ts`. Extraction keeps the parent file under
 * the 800-line per-file ceiling and the 60-line per-function ceiling
 * (frontend ESLint, Power-of-Ten §10).
 *
 * Design contract — same as the original `(public)/login/verify/+page.server.ts`
 * (now retired): cross-origin Set-Cookie forwarding for backend `accessToken` /
 * `refreshToken` (R8 — tokens never in body), single-use challenge cookie
 * cleared on consume, fail-closed redirect to `/login` when the challenge
 * cookie is missing, ADR-007 envelope unwrapping, ADR-046 §"3-cookie
 * invariant" via `setAuthCookies`.
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §5.2
 * @see docs/infrastructure/adr/ADR-005-authentication-strategy.md
 * @see docs/infrastructure/adr/ADR-007-api-response-standardization.md
 * @see docs/infrastructure/adr/ADR-046-oauth-sign-in.md (3-cookie invariant)
 */
import { fail, redirect, type ActionFailure, type RequestEvent } from '@sveltejs/kit';

import { setAuthCookies } from '$lib/server/auth-cookies';
// ADR-050 §"OAuth: Centralized Callback, Post-Callback Handoff" + ADR-054
// Mandatory-2FA: when verify happens on a host that does not match the
// user's tenant subdomain, the backend mints a handoff token instead of
// setting cookies on the wrong origin. We use the same URL builder as the
// pre-2FA OAuth-bypass code path in `+page.server.ts`.
import { buildSubdomainHandoffUrl } from '$lib/server/handoff-url';
import { resilientFetch } from '$lib/server/resilient-fetch';
import { createLogger } from '$lib/utils/logger';

import { CODE_REGEX, MESSAGES } from './2fa-constants';

const log = createLogger('Login2FA');

/** API base URL for server-side fetching — same convention as `+page.server.ts`. */
const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

/**
 * Mirror of backend `UserRole`. Duplicated from `(public)/login/+page.server.ts`
 * because exporting from a SvelteKit route file is fragile (route files own
 * `load`/`actions` exports only). Per CLAUDE.md KISS/YAGNI, extract to
 * `$lib/server/auth-roles.ts` only when a third call site materialises.
 */
type UserRole = 'root' | 'admin' | 'employee' | 'dummy';

/**
 * Backend `TwoFactorVerifyResponse` body shape (mirror of
 * `backend/src/nest/two-factor-auth/two-factor-auth.types.ts:TwoFactorVerifyResponse`).
 *
 * `handoff` is set whenever the verify happened on a host that does NOT
 * match the user's tenant subdomain — i.e. ALWAYS for signup-purpose
 * (apex by definition) and for login-purpose when the user logged in on
 * the apex / on a foreign subdomain (ADR-050 §"OAuth", reinforced by
 * ADR-054's mandatory-2FA gate that turned every password login into a
 * verify call). When `handoff` is present, the backend also echoes
 * `accessToken` so the apex-side enhance callback can mint the ADR-022
 * escrow unlock ticket BEFORE the cross-origin redirect — sessionStorage
 * does not survive cross-origin navigation, so the ticket-via-Redis path
 * is the only way to keep E2E recovery working through the handoff.
 */
interface VerifyResponseData {
  stage: 'authenticated';
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    tenantId: number;
    subdomain: string | null;
  };
  handoff?: { token: string; subdomain: string };
  accessToken?: string;
}

interface VerifyResponseEnvelope {
  success: boolean;
  data?: VerifyResponseData;
  error?: { message: string; code?: string };
}

interface ResendResponseEnvelope {
  success: boolean;
  data?: {
    challenge: {
      expiresAt: string;
      resendAvailableAt: string;
      resendsRemaining: number;
    };
  };
  error?: { message: string; code?: string };
}

/** Form-action return shape for `verify`. */
interface VerifyActionFailureData {
  error: string;
  wrongCode?: true;
  locked?: true;
  expired?: true;
}

/**
 * Form-action SUCCESS-return shape for the cross-origin handoff branch.
 *
 * Returned (not thrown) by `handleVerifyAction` when the backend mints a
 * subdomain handoff — i.e. login-purpose verify on a host that does NOT
 * match the user's tenant subdomain (apex / wrong subdomain), or any
 * signup-purpose verify (the apex case by definition). The client-side
 * `enhance` callback in `TwoFactorVerifyForm.svelte` MUST consume this
 * result and `window.location.href`-navigate to `redirectTo` (a cross-
 * origin URL on the user's tenant subdomain, where the existing handoff
 * consumer at `/signup/oauth-complete?token=…` swaps the token for
 * subdomain-scoped auth cookies).
 *
 * Why a returned value instead of a thrown SvelteKit `redirect()` (which
 * is what the same-origin branch does):
 *   1. The apex-side enhance callback needs `accessToken` + `user.id` to
 *      mint the ADR-022 escrow unlock ticket BEFORE the redirect — that
 *      ticket carries the wrappingKey across the cross-origin boundary
 *      (sessionStorage cannot). A thrown `redirect()` would short-circuit
 *      the flow before the ticket mint can run.
 *   2. Although browsers DO follow cross-origin `303 Location:` redirects,
 *      we need a client-side step for the escrow ticket dance, so the
 *      browser's automatic redirect-following is the wrong primitive here.
 *
 * `accessToken` lives in JS heap memory only for the few hundred ms
 * between this return and the cross-origin redirect, used exclusively for
 * the authenticated `/e2e/escrow*` fetches. NOT persisted (no
 * localStorage, no apex cookie). The session lives on the subdomain via
 * the handoff payload's accessToken+refreshToken (set as cookies by the
 * `/signup/oauth-complete` consumer).
 */
export interface VerifyHandoffResult {
  success: true;
  /** Absolute URL on `<userSubdomain>` — handoff consumer at `/signup/oauth-complete?token=…`. */
  redirectTo: string;
  /** Short-lived bearer for the ADR-022 escrow ticket mint on apex. NEVER persist. */
  accessToken: string;
  user: {
    id: number;
    role: UserRole;
    /** Forwarded for cross-tenant debugging only; backend re-derives from JWT. */
    tenantId: number;
  };
}

/**
 * Internal discriminated union returned by `readVerifySuccess`. The
 * `handoff` branch maps 1:1 to the public `VerifyHandoffResult` action
 * return; the `same-origin` branch is consumed inside `handleVerifyAction`
 * and produces a thrown `redirect()` to the same-origin dashboard.
 */
type VerifySuccessResult =
  | {
      kind: 'same-origin';
      user: VerifyResponseData['user'];
      tokens: { accessToken: string; refreshToken: string };
    }
  | {
      kind: 'handoff';
      user: VerifyResponseData['user'];
      handoff: { token: string; subdomain: string };
      accessToken: string;
    };

/** Form-action return shape for `resend`. */
type ResendActionResult =
  | { resent: true; resendsRemaining: number; resendAvailableAt: string }
  | ActionFailure<{ error: string; resendLimit?: true; cooldown?: true; expired?: true }>;

/** SvelteKit `redirect()` is a thrown sentinel; mirror of login `+page.server.ts::isRedirectError`. */
function isRedirectError(err: unknown): boolean {
  if (err instanceof Response) return true;
  return typeof err === 'object' && err !== null && 'status' in err;
}

/**
 * Generic Set-Cookie value extractor. Anchors on `^name=` so a header like
 * `__Host-foo=bar; refreshToken=...` (substring containing the target name)
 * cannot accidentally match. Cookie names are ASCII per RFC 6265 §2.2 so a
 * literal regex is safe. Returns `null` if no header matches.
 */
function extractCookieFromSetCookie(response: Response, name: string): string | null {
  const headers = response.headers.getSetCookie();
  const pattern = new RegExp(`^${name}=([^;]+)`);
  for (const header of headers) {
    const match = pattern.exec(header);
    if (match?.[1] !== undefined) {
      return decodeURIComponent(match[1]);
    }
  }
  return null;
}

/**
 * Extract the access + refresh token pair from the backend verify response.
 * Returns `null` if either is missing — the caller treats that as a backend
 * contract violation (5xx-side fail, not a silent partial-auth state).
 */
function extractAuthTokensFromVerify(response: Response): {
  accessToken: string;
  refreshToken: string;
} | null {
  const accessToken = extractCookieFromSetCookie(response, 'accessToken');
  const refreshToken = extractCookieFromSetCookie(response, 'refreshToken');
  if (accessToken === null || refreshToken === null) return null;
  return { accessToken, refreshToken };
}

/**
 * Build the `Cookie:` header value for the backend fetch — only forwards the
 * `challengeToken` (the only cookie the backend reads on these paths). Returns
 * `null` if absent so the caller can short-circuit to a fail-closed redirect.
 */
function buildBackendCookieHeader(challengeToken: string | undefined): string | null {
  if (challengeToken === undefined || challengeToken === '') return null;
  return `challengeToken=${encodeURIComponent(challengeToken)}`;
}

/**
 * Validate + normalise the `code` field from the submitted formData.
 * Returns the cleaned code OR an `ActionFailure` carrying the invalid-format
 * UX message. Extracted so action bodies stay under sonarjs/complexity-10.
 */
function parseCodeField(
  codeRaw: FormDataEntryValue | null,
): { code: string } | ActionFailure<VerifyActionFailureData> {
  if (typeof codeRaw !== 'string') {
    return fail(400, { error: MESSAGES.ERR_INVALID_FORMAT });
  }
  const code = codeRaw.trim().toUpperCase();
  if (!CODE_REGEX.test(code)) {
    return fail(400, { error: MESSAGES.ERR_INVALID_FORMAT });
  }
  return { code };
}

/**
 * Inspect a 200-OK verify response and discriminate the two valid shapes:
 *
 *   - **handoff**     — `body.data.handoff` set + `body.data.accessToken`
 *                       echoed. Backend deliberately did NOT issue
 *                       `Set-Cookie` for the auth tokens because they
 *                       belong on a different origin (the user's tenant
 *                       subdomain). Frontend must redirect cross-origin.
 *   - **same-origin** — `body.data.handoff` absent. Backend wrote the
 *                       3-cookie auth triad as `Set-Cookie` headers; we
 *                       extract + re-emit them on the SvelteKit response
 *                       (cross-origin Set-Cookie is not auto-forwarded by
 *                       SvelteKit's server-side `fetch`).
 *
 * Pre-2026-05-01 the handoff branch was treated as a backend contract
 * violation and 500-failed. ADR-054 made 2FA mandatory for every password
 * login, and ADR-050 §"Backend: Pre-Auth Host Resolver" requires the
 * verify endpoint to handoff whenever the request host does NOT match the
 * user's tenant subdomain (apex login, foreign subdomain). The
 * `two-factor-auth.controller.ts` handoff branch fixed the missing path;
 * this function now treats both shapes as valid.
 */
function readVerifySuccess(
  response: Response,
  body: VerifyResponseEnvelope,
): VerifySuccessResult | ActionFailure<VerifyActionFailureData> {
  if (!body.success || body.data === undefined) {
    log.error('Verify 200 without success / data — backend envelope violation');
    return fail(500, { error: MESSAGES.ERR_GENERIC });
  }

  if (body.data.handoff !== undefined) {
    // Cross-origin (handoff) branch — `Set-Cookie` intentionally absent.
    // `accessToken` MUST be echoed in the body for the apex-side ADR-022
    // escrow ticket mint; missing it is a backend contract violation.
    if (typeof body.data.accessToken !== 'string' || body.data.accessToken === '') {
      log.error('Verify handoff branch missing accessToken in body — backend contract violation');
      return fail(500, { error: MESSAGES.ERR_GENERIC });
    }
    return {
      kind: 'handoff',
      user: body.data.user,
      handoff: body.data.handoff,
      accessToken: body.data.accessToken,
    };
  }

  // Same-origin branch: tokens travel via `Set-Cookie` (R8-style transport,
  // never JSON body). Extract and re-emit on this response.
  const tokens = extractAuthTokensFromVerify(response);
  if (tokens === null) {
    log.error('Verify 200 without accessToken/refreshToken Set-Cookie — contract violation');
    return fail(500, { error: MESSAGES.ERR_GENERIC });
  }
  return { kind: 'same-origin', user: body.data.user, tokens };
}

/**
 * Map a backend verify error response (4xx / 5xx) to a typed `fail()` payload.
 * Status-code semantics verified against `two-factor-auth.service.ts`:
 *   - 401 (`UnauthorizedException`): wrong code OR expired/invalid challenge.
 *   - 403 (`ForbiddenException`): user lockout (5 wrong attempts → 15 min lockout).
 *   - 429: throttler — `2fa-verify` tier exhausted (5/10 min per challenge cookie).
 */
function mapVerifyError(status: number): ActionFailure<VerifyActionFailureData> {
  if (status === 403) {
    return fail(403, { error: MESSAGES.ERR_LOCKED, locked: true });
  }
  if (status === 429) {
    return fail(429, { error: MESSAGES.ERR_THROTTLED });
  }
  if (status === 401) {
    return fail(401, { error: MESSAGES.ERR_WRONG_CODE(0), wrongCode: true });
  }
  log.warn({ status }, 'Unexpected verify status');
  return fail(status, { error: MESSAGES.ERR_GENERIC });
}

/**
 * Map a backend resend error response to a typed `fail()` payload.
 * 429 distinguishes `RESEND_LIMIT_EXCEEDED` vs. cooldown via `body.error.code`
 * (per `two-factor-auth.service.ts:378-387`); throttler-tier 429s fall through
 * to the safer "cooldown" copy.
 */
function mapResendError(
  status: number,
  body: ResendResponseEnvelope,
): ActionFailure<{ error: string; resendLimit?: true; cooldown?: true; expired?: true }> {
  if (status === 429) {
    if (body.error?.code === 'RESEND_LIMIT_EXCEEDED') {
      return fail(429, { error: MESSAGES.ERR_RESEND_LIMIT, resendLimit: true });
    }
    return fail(429, { error: MESSAGES.ERR_RESEND_COOLDOWN, cooldown: true });
  }
  if (status === 401) {
    return fail(401, { error: MESSAGES.ERR_EXPIRED, expired: true });
  }
  if (status === 503) {
    return fail(503, { error: MESSAGES.ERR_SEND_FAILED });
  }
  return fail(status, { error: MESSAGES.ERR_GENERIC });
}

/** Discriminate happy-path tuples vs. `ActionFailure` returns from the helpers above. */
function isActionFailure<T>(value: unknown): value is ActionFailure<T> {
  return typeof value === 'object' && value !== null && 'status' in value && 'data' in value;
}

/**
 * Map backend `UserRole` → dashboard path. Duplicate of the same map in
 * `(public)/login/+page.server.ts::getRedirectPath`. Extract to
 * `$lib/server/auth-redirect.ts` when a third call site appears.
 */
function getRedirectPath(role: UserRole): string {
  const paths: Record<UserRole, string> = {
    root: '/root-dashboard',
    admin: '/admin-dashboard',
    employee: '/employee-dashboard',
    dummy: '/blackboard',
  };
  return paths[role];
}

/**
 * Build the public action-return for the cross-origin handoff branch.
 * Extracted to keep `handleVerifyAction` under the cognitive-complexity
 * (sonarjs/cognitive-complexity = 10) and 60-line ceilings — the
 * branch logic itself is trivial, but the URL build, cookie cleanup,
 * and result-shape construction add to the surrounding cyclomatic count.
 */
function applyHandoffSuccess(
  verified: Extract<VerifySuccessResult, { kind: 'handoff' }>,
  cookies: RequestEvent['cookies'],
  request: Request,
): VerifyHandoffResult {
  // Single-use challenge cookie — already consumed server-side by the
  // backend's `reply.clearCookie('challengeToken')` (see
  // `two-factor-auth.controller.ts`). The same-origin branch deletes it
  // here too; mirror that for symmetry so a stale cookie from a partial
  // response can't survive (defence-in-depth, free of cost).
  cookies.delete('challengeToken', { path: '/' });
  return {
    success: true,
    redirectTo: buildSubdomainHandoffUrl(
      verified.handoff.subdomain,
      verified.handoff.token,
      request,
    ),
    accessToken: verified.accessToken,
    user: {
      id: verified.user.id,
      role: verified.user.role,
      tenantId: verified.user.tenantId,
    },
  };
}

/**
 * `verify` action handler — invoked when the user submits the 6-character
 * code from the inline verify card on `/login`.
 *
 * Two success outcomes (mutually exclusive, discriminated by the backend
 * response's `handoff` field — see ADR-050 §"Backend: Pre-Auth Host
 * Resolver" + ADR-054):
 *
 *   1. **same-origin** (request host == user's tenant subdomain):
 *      writes the 3-cookie auth triad on this origin and **throws**
 *      SvelteKit `redirect(303, …)` to the role dashboard. Never
 *      returns normally on this branch.
 *
 *   2. **cross-origin handoff** (apex login, foreign subdomain): RETURNS
 *      a `VerifyHandoffResult` so the client-side `enhance` callback in
 *      `TwoFactorVerifyForm.svelte` can mint the ADR-022 escrow unlock
 *      ticket BEFORE `window.location.href`-navigating to the handoff
 *      consumer on the user's subdomain. The handoff consumer then sets
 *      cookies on the correct origin.
 *
 * Failure outcomes always return `ActionFailure` for typed UX errors
 * (wrong code / lockout / throttle / contract violation).
 *
 * @returns `ActionFailure` on validation/server failure, `VerifyHandoffResult`
 *          on cross-origin success. Same-origin success throws `redirect()`
 *          and therefore never reaches the caller's value position.
 */
export async function handleVerifyAction(
  event: RequestEvent,
): Promise<ActionFailure<VerifyActionFailureData> | VerifyHandoffResult> {
  const { request, cookies, url } = event;
  const formData = await request.formData();

  const parsed = parseCodeField(formData.get('code'));
  if (isActionFailure<VerifyActionFailureData>(parsed)) return parsed;

  const cookieHeader = buildBackendCookieHeader(cookies.get('challengeToken'));
  if (cookieHeader === null) {
    // Cookie cleared between page-load and submit → fail-closed back to login.
    redirect(303, '/login');
  }

  // ADR-050 §"SSR Host Propagation: Nginx + adapter-node Chain" — the
  // backend's `TenantHostResolverMiddleware` reads `X-Forwarded-Host` to
  // populate `req.raw.hostTenantId`, which the verify endpoint uses to
  // pick the same-origin Set-Cookie branch vs. the cross-origin handoff
  // branch (ADR-054 controller change 2026-05-01). SvelteKit's server-
  // side fetch goes directly to `localhost:3000` and does NOT auto-
  // forward the browser's Host — without this header the backend would
  // see `localhost` → `hostTenantId=null` → handoff fires even when the
  // browser is already on the user's correct tenant subdomain (the e2e
  // bug surfaced on 2026-05-01: `assixx.localhost/login` redirected to
  // `assixx.localhost/root-dashboard?unlock=…` via an unnecessary
  // handoff round-trip). Mirrors the OAuth-handoff consumer's
  // propagation pattern in `(public)/signup/oauth-complete/+page.server.ts`.
  const forwardedHost = request.headers.get('x-forwarded-host') ?? new URL(request.url).hostname;

  try {
    const response = await resilientFetch(`${API_BASE}/auth/2fa/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
        'X-Forwarded-Host': forwardedHost,
      },
      body: JSON.stringify({ code: parsed.code }),
    });

    const body = (await response.json()) as VerifyResponseEnvelope;

    if (!response.ok) {
      return mapVerifyError(response.status);
    }

    const verified = readVerifySuccess(response, body);
    if (isActionFailure<VerifyActionFailureData>(verified)) return verified;

    if (verified.kind === 'handoff') {
      return applyHandoffSuccess(verified, cookies, request);
    }

    // Same-origin: write cookies on this origin + redirect to dashboard.
    setAuthCookies(
      cookies,
      url,
      verified.tokens.accessToken,
      verified.tokens.refreshToken,
      verified.user.role,
    );
    cookies.delete('challengeToken', { path: '/' });
    redirect(303, getRedirectPath(verified.user.role));
  } catch (err: unknown) {
    if (isRedirectError(err)) throw err;
    log.error({ err }, 'Verify request failed');
    return fail(500, { error: MESSAGES.ERR_GENERIC });
  }
}

/**
 * `resend` action handler — invoked when the user clicks "Code erneut senden".
 * Backend overwrites the Redis challenge in place (same cookie remains valid),
 * so no cookie re-emit is needed here.
 */
export async function handleResendAction(event: RequestEvent): Promise<ResendActionResult> {
  const { cookies } = event;

  const cookieHeader = buildBackendCookieHeader(cookies.get('challengeToken'));
  if (cookieHeader === null) {
    redirect(303, '/login');
  }

  try {
    const response = await resilientFetch(`${API_BASE}/auth/2fa/resend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      body: JSON.stringify({}),
    });

    const body = (await response.json()) as ResendResponseEnvelope;

    if (!response.ok || !body.success || body.data === undefined) {
      return mapResendError(response.status, body);
    }

    return {
      resent: true,
      resendsRemaining: body.data.challenge.resendsRemaining,
      resendAvailableAt: body.data.challenge.resendAvailableAt,
    };
  } catch (err: unknown) {
    if (isRedirectError(err)) throw err;
    log.error({ err }, 'Resend request failed');
    return fail(500, { error: MESSAGES.ERR_GENERIC });
  }
}
