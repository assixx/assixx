/**
 * 2FA server-side action handlers for the signup page (FEAT_2FA_EMAIL_MASTERPLAN
 * Step 5.3, v0.8.2 inline-card revision 2026-04-30).
 *
 * Hosts the `verify` + `resend` named-action implementations consumed from
 * `(public)/signup/+page.server.ts`. Twin of `(public)/login/_lib/2fa-server-helpers.ts`
 * with one critical divergence on the verify-success branch:
 *
 *   - **Login** (tenant subdomain origin): backend sets access/refresh
 *     cookies on the same origin, frontend reads them out of `Set-Cookie`
 *     and re-emits via `setAuthCookies`. Then redirects to the role-scoped
 *     dashboard.
 *   - **Signup** (apex `www.assixx.com` origin): cookies set on apex would
 *     scope to the WRONG origin (the new tenant's subdomain is what needs
 *     them). Backend therefore returns `handoff: { token, subdomain }` and
 *     does NOT set auth cookies. We build a cross-origin redirect URL
 *     `https://<subdomain>.<apex>/signup/oauth-complete?token=<handoff>`
 *     and 303 the browser there. The existing `/signup/oauth-complete?token`
 *     branch (originally for OAuth-login cross-subdomain handoff, ADR-050)
 *     consumes the token via `POST /auth/oauth/handoff`, sets cookies on
 *     the correct origin, and redirects to the role-scoped dashboard.
 *
 * Cross-tenant defence: the challenge cookie is httpOnly + path=/ + cleared
 * on consume, so a stolen apex cookie cannot replay. The handoff-token in
 * the URL is single-use Redis-backed (GETDEL) and host-checked server-side
 * (R15 in `oauth-handoff.service.ts:consume()`) — even if observed in the
 * URL bar it cannot be redeemed twice or from a wrong host.
 *
 * Same R8 / single-use / fail-closed invariants as the login twin.
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §5.3
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md (handoff)
 * @see docs/infrastructure/adr/ADR-046-oauth-sign-in.md (3-cookie invariant)
 * @see (public)/login/_lib/2fa-server-helpers.ts (login twin)
 */
import { fail, redirect, type ActionFailure, type RequestEvent } from '@sveltejs/kit';

import { resilientFetch } from '$lib/server/resilient-fetch';
import { createLogger } from '$lib/utils/logger';

import { CODE_REGEX, MESSAGES } from './2fa-constants';

const log = createLogger('Signup2FA');

/** API base URL for server-side fetching — same convention as login. */
const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

/**
 * Mirror of backend `UserRole`. Duplicated locally for the same reason as the
 * login twin (route files own only `load`/`actions` exports).
 */
type UserRole = 'root' | 'admin' | 'employee' | 'dummy';

/**
 * Backend `TwoFactorVerifyResponse` body shape. Signup-purpose verifies MUST
 * carry `handoff` — the field is the entire reason this branch differs from
 * the login twin. A 200 without `handoff` is a backend contract violation
 * (the controller has explicit logic to set it before responding for the
 * `verified.purpose === 'signup'` branch in `two-factor-auth.controller.ts`).
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

/** SvelteKit `redirect()` is a thrown sentinel; same guard as the login twin. */
function isRedirectError(err: unknown): boolean {
  if (err instanceof Response) return true;
  return typeof err === 'object' && err !== null && 'status' in err;
}

/**
 * Build the `Cookie:` header value for the backend fetch — only forwards the
 * `challengeToken`. Returns `null` if absent so the caller can short-circuit
 * to a fail-closed redirect.
 */
function buildBackendCookieHeader(challengeToken: string | undefined): string | null {
  if (challengeToken === undefined || challengeToken === '') return null;
  return `challengeToken=${encodeURIComponent(challengeToken)}`;
}

/**
 * Validate + normalise the `code` field. Same logic as the login twin —
 * backend Zod schema is shared, so client-side eager validation must match.
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
 * Inspect a 200-OK signup-verify response: shape-check the body and pull the
 * mandatory `handoff` payload. A signup-purpose verify WITHOUT `handoff` is a
 * backend contract violation — log + 500 rather than silently fall through to
 * a same-origin cookie path that would leave the user authenticated on apex
 * but with cookies scoped to the wrong origin.
 */
function readVerifySuccess(
  body: VerifyResponseEnvelope,
):
  | { user: VerifyResponseData['user']; handoff: { token: string; subdomain: string } }
  | ActionFailure<VerifyActionFailureData> {
  if (!body.success || body.data === undefined) {
    log.error('Signup verify 200 without success / data — backend envelope violation');
    return fail(500, { error: MESSAGES.ERR_GENERIC });
  }
  if (body.data.handoff === undefined) {
    log.error('Signup-purpose verify returned no handoff payload — backend contract violation');
    return fail(500, { error: MESSAGES.ERR_GENERIC });
  }
  return { user: body.data.user, handoff: body.data.handoff };
}

/**
 * Map a backend verify error response to a typed `fail()` payload. Status-code
 * semantics identical to the login twin (same backend endpoint serves both
 * flows) — duplicated here only because the failure-data shape is locally
 * typed via `VerifyActionFailureData`.
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
  log.warn({ status }, 'Unexpected signup verify status');
  return fail(status, { error: MESSAGES.ERR_GENERIC });
}

/** Map a backend resend error to a typed `fail()` payload — same shape as login. */
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

/** Discriminate happy-path tuples vs. `ActionFailure` returns. */
function isActionFailure<T>(value: unknown): value is ActionFailure<T> {
  return typeof value === 'object' && value !== null && 'status' in value && 'data' in value;
}

/**
 * Build the cross-origin handoff URL the browser navigates to after signup
 * verify success. Mirrors `buildSubdomainHandoffUrl` in
 * `(public)/login/+page.server.ts` — same primitive, same destination
 * (`/signup/oauth-complete?token=<handoff>` already handles the `?token`
 * branch via `handleHandoff()` for cross-subdomain login).
 *
 * Rules (preserve protocol + port from the request URL):
 *   - `localhost`                → `{slug}.localhost` (dev)
 *   - `assixx.com` / `www.assixx.com` → `{slug}.assixx.com` (prod apex)
 *   - already a subdomain        → swap first label (cross-subdomain redirect)
 *
 * The handoff token rides in the URL query string; that is by design — the
 * receiving page consumes it via single-use Redis GETDEL with R15 host check,
 * so observability in the URL bar is acceptable. Login uses the same pattern.
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
 * `verify` action handler — invoked when the user submits the 6-character
 * code from the inline verify card on `/signup`. Throws SvelteKit `redirect()`
 * to the cross-origin subdomain handoff URL on the happy path; returns
 * `ActionFailure` for typed UX errors.
 *
 * Redirect target: `https://<subdomain>.<apex>/signup/oauth-complete?token=…`
 * (NOT a same-origin dashboard path like login). The receiving page is the
 * existing OAuth handoff consumer, which is dual-purpose by design.
 */
export async function handleVerifyAction(
  event: RequestEvent,
): Promise<ActionFailure<VerifyActionFailureData>> {
  const { request, cookies } = event;
  const formData = await request.formData();

  const parsed = parseCodeField(formData.get('code'));
  if (isActionFailure<VerifyActionFailureData>(parsed)) return parsed;

  const cookieHeader = buildBackendCookieHeader(cookies.get('challengeToken'));
  if (cookieHeader === null) {
    // Cookie cleared between page-load and submit → fail-closed back to signup.
    redirect(303, '/signup');
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

    const verified = readVerifySuccess(body);
    if (isActionFailure<VerifyActionFailureData>(verified)) return verified;

    // Single-use is spent — clear the apex challenge cookie before redirect.
    // Reaching this branch means the backend already cleared its server-side
    // record (verifyChallenge does GETDEL); the apex cookie is now stale and
    // would only confuse `load()` on a back-button into /signup.
    cookies.delete('challengeToken', { path: '/' });

    const handoffUrl = buildSubdomainHandoffUrl(
      verified.handoff.subdomain,
      verified.handoff.token,
      request,
    );
    redirect(303, handoffUrl);
  } catch (err: unknown) {
    if (isRedirectError(err)) throw err;
    log.error({ err }, 'Signup verify request failed');
    return fail(500, { error: MESSAGES.ERR_GENERIC });
  }
}

/**
 * `resend` action handler — invoked from the inline verify card's "Code
 * erneut senden" button. Identical wire contract to the login twin: backend
 * overwrites the Redis challenge in place, the existing httpOnly cookie keeps
 * working, no cookie re-emit needed.
 */
export async function handleResendAction(event: RequestEvent): Promise<ResendActionResult> {
  const { cookies } = event;

  const cookieHeader = buildBackendCookieHeader(cookies.get('challengeToken'));
  if (cookieHeader === null) {
    redirect(303, '/signup');
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
    log.error({ err }, 'Signup resend request failed');
    return fail(500, { error: MESSAGES.ERR_GENERIC });
  }
}
