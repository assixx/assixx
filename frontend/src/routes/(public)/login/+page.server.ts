/**
 * Login Page - Server Actions & Load
 * @module login/+page.server
 *
 * - Load: Redirects already-authenticated users to their dashboard
 * - Actions: Handles login form submission server-side to set httpOnly cookies
 *
 * This enables SSR pages to access the auth token via cookies.
 */
import { fail, redirect, type ActionFailure } from '@sveltejs/kit';

import { setAuthCookies, clearAuthCookies } from '$lib/server/auth-cookies';
import { resilientFetch } from '$lib/server/resilient-fetch';
import { verifyTurnstile } from '$lib/server/turnstile';
import { createLogger } from '$lib/utils/logger';

import type { Actions, PageServerLoad } from './$types';

const log = createLogger('Login');

/** API base URL for server-side fetching */
const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

type UserRole = 'root' | 'admin' | 'employee' | 'dummy';

interface LoginResponseData {
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
  data?: LoginResponseData;
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
 * Load function - redirects already-authenticated users to their dashboard
 *
 * This runs BEFORE the page renders, checking if user is already logged in.
 * If they have a valid token, they get redirected to their dashboard.
 */
// NOTE: We intentionally bypass SvelteKit's scoped `fetch` here. The target
// `${API_BASE}/users/me` is cross-origin (backend :3000), so the enhancements
// offered by the scoped fetch (same-origin cookie-forwarding, relative URL
// resolution) add nothing. `resilientFetch` wraps the global fetch with
// retry-on-ECONNRESET semantics that matter much more for this auth check.
export const load: PageServerLoad = async ({ cookies }) => {
  const token = cookies.get('accessToken');

  if (token === undefined || token === '') {
    return {};
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
      return {};
    }

    const result = (await response.json()) as MeResponse;
    const role = extractRoleFromResponse(result);

    if (role === null) {
      log.warn('No role in /users/me response');
      return {};
    }

    log.debug({ role }, 'User already logged in, redirecting to dashboard');
    redirect(302, getRedirectPath(role));
  } catch (err: unknown) {
    if (isRedirectError(err)) throw err;
    log.error({ err }, 'Error checking auth status');
    return {};
  }
};

/** Validate that a form field is a non-empty string */
function isValidStringField(value: FormDataEntryValue | null): value is string {
  return typeof value === 'string' && value !== '';
}

/** Check if login response indicates success with valid data */
function isSuccessfulLogin(
  response: Response,
  result: LoginResponse,
): result is LoginResponse & { data: LoginResponseData } {
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
  default: async ({ request, cookies, fetch, locals, url }) => {
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
      log.error({ err }, 'Server error');
      return fail(500, { error: 'Ein Serverfehler ist aufgetreten', email });
    }
  },
};
