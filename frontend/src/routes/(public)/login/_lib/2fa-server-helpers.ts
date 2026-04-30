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
 * `handoff` is signup-only; login-purpose verifies never carry it.
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
 * Inspect a 200-OK verify response: shape-check the body, reject the
 * unexpected signup-handoff branch (login-purpose verifies never include it),
 * and pull the auth-cookie pair out of `Set-Cookie`.
 */
function readVerifySuccess(
  response: Response,
  body: VerifyResponseEnvelope,
):
  | { user: VerifyResponseData['user']; tokens: { accessToken: string; refreshToken: string } }
  | ActionFailure<VerifyActionFailureData> {
  if (!body.success || body.data === undefined) {
    log.error('Verify 200 without success / data — backend envelope violation');
    return fail(500, { error: MESSAGES.ERR_GENERIC });
  }
  if (body.data.handoff !== undefined) {
    log.error('Login-purpose verify returned a signup handoff — backend contract violation');
    return fail(500, { error: MESSAGES.ERR_GENERIC });
  }
  const tokens = extractAuthTokensFromVerify(response);
  if (tokens === null) {
    log.error('Verify 200 without accessToken/refreshToken Set-Cookie — contract violation');
    return fail(500, { error: MESSAGES.ERR_GENERIC });
  }
  return { user: body.data.user, tokens };
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
 * `verify` action handler — invoked when the user submits the 6-character
 * code from the inline verify card on `/login`. Throws SvelteKit `redirect()`
 * on the happy path; returns `ActionFailure` for typed UX errors.
 */
export async function handleVerifyAction(
  event: RequestEvent,
): Promise<ActionFailure<VerifyActionFailureData>> {
  const { request, cookies, url } = event;
  const formData = await request.formData();

  const parsed = parseCodeField(formData.get('code'));
  if (isActionFailure<VerifyActionFailureData>(parsed)) return parsed;

  const cookieHeader = buildBackendCookieHeader(cookies.get('challengeToken'));
  if (cookieHeader === null) {
    // Cookie cleared between page-load and submit → fail-closed back to login.
    redirect(303, '/login');
  }

  try {
    const response = await resilientFetch(`${API_BASE}/auth/2fa/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ code: parsed.code }),
    });

    const body = (await response.json()) as VerifyResponseEnvelope;

    if (!response.ok) {
      return mapVerifyError(response.status);
    }

    const verified = readVerifySuccess(response, body);
    if (isActionFailure<VerifyActionFailureData>(verified)) return verified;

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
