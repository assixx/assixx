/**
 * /signup/oauth-complete — SSR load + form action for the Microsoft OAuth
 * company-details step (Plan §5.4).
 *
 * Load:
 *   - Reads `?ticket=…` from the URL.
 *   - Calls the backend peek endpoint (non-consuming) to pre-fill email +
 *     display name on the form.
 *   - 404 (ticket expired or unknown) or 400 (malformed id) → bounces the
 *     user to `/signup?oauth=ticket-expired` so they can restart the flow.
 *   - Other non-2xx → generic 500 with a German message.
 *
 * Action (default):
 *   - Reads the full form (company, subdomain, phone, admin names) + ticket.
 *   - POSTs to `/auth/oauth/microsoft/complete-signup`. The backend consumes
 *     the ticket atomically (GETDEL) and creates tenant+user+oauth-link in
 *     one transaction (R8). On 201 the backend returns tokens in the body
 *     AND sets httpOnly cookies; SvelteKit's server-side fetch does NOT
 *     forward response `Set-Cookie` to the browser, so we re-set cookies
 *     here (mirrors the login action in `login/+page.server.ts`).
 *   - 409 (duplicate Microsoft account) + 401 (ticket expired) are surfaced
 *     with friendly German messages (Plan §6 error-path UX).
 *
 * Cookie options, token TTLs, and envelope shape intentionally mirror
 * `login/+page.server.ts` — same state boundary (unauth → authenticated),
 * same security posture. Any future drift should happen in one place.
 *
 * @see docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md (Phase 5, Step 5.4)
 */
import { error, fail, redirect, type Cookies } from '@sveltejs/kit';

import { setAuthCookies } from '$lib/server/auth-cookies';
import { extractJwtRole } from '$lib/server/jwt-exp';
import { createLogger } from '$lib/utils/logger';

import type { Actions, PageServerLoad } from './$types';
import type { UserRole } from '@assixx/shared';

const log = createLogger('OAuthCompleteSignup');

/** API base URL for server-side fetching — matches login/+page.server.ts. */
const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

/**
 * Role → dashboard path map. MUST mirror
 * `frontend/src/routes/(public)/login/+page.server.ts::getRedirectPath` —
 * diverging here sends OAuth-login users to a different landing than
 * password-login users, which would be a UX bug.
 */
const ROLE_DASHBOARD_PATHS: Record<UserRole, string> = {
  root: '/root-dashboard',
  admin: '/admin-dashboard',
  employee: '/employee-dashboard',
  dummy: '/blackboard',
};

// ─── Backend envelope types (response from NestJS wraps in {success, data|error}) ──

interface PeekSuccess {
  success: true;
  data: { email: string; displayName: string | null };
}
interface ApiError {
  success: false;
  error: { message: string; code?: string };
}
type PeekResponse = PeekSuccess | ApiError;

interface CompleteSuccess {
  success: true;
  data: {
    tenantId: number;
    userId: number;
    subdomain: string;
    trialEndsAt: string;
    message: string;
    accessToken: string;
    refreshToken: string;
  };
}
type CompleteResponse = CompleteSuccess | ApiError;

/**
 * `POST /auth/oauth/handoff` — response shape (ADR-050 §OAuth).
 *
 * CORRECTION 2026-04-21 (Session 12c): NestJS `ResponseInterceptor`
 * (app.module.ts, APP_INTERCEPTOR) wraps EVERY JSON controller return in
 * `{success: true, data: ..., timestamp}` unconditionally. The initial
 * Session 12 implementation treated the body as unwrapped and would have
 * silently returned `payload.accessToken === undefined` at runtime —
 * latent bug (OAuth handoff path not yet end-to-end tested). Confirmed
 * by the Session 10 API test at `tenant-subdomain-routing.api.test.ts:428`
 * which asserts `body.data?.accessToken`.
 *
 * Error responses use NestJS's default exception shape; we only care about
 * the HTTP status code for branching — no envelope access needed there.
 */
interface HandoffSuccessEnvelope {
  success: boolean;
  data?: {
    accessToken: string;
    refreshToken: string;
    userId: number;
    tenantId: number;
  };
}

// ─── Load ────────────────────────────────────────────────────────────────────

/**
 * `/signup/oauth-complete` serves TWO disjoint query shapes (ADR-050 §OAuth):
 *
 *   1. `?token=…` — OAuth-login handoff from the apex callback. The user has
 *      an existing account; apex minted a single-use handoff token and 302'd
 *      us to the correct subdomain. We swap the token for auth cookies
 *      scoped to THIS origin (browser-default, RFC 6265 §5.3 step 6) and
 *      redirect to the role-specific dashboard.
 *
 *   2. `?ticket=…` — OAuth-signup continuation (ADR-046). The user has no
 *      account yet; the callback handed us a peek-able ticket so we can
 *      pre-fill the company-details form. The form action consumes the
 *      ticket atomically and creates tenant+user.
 *
 * Branch priority: `token` wins when both are present (pathological / tampered
 * URL) — login users don't need the signup form. Neither present → bounce
 * to `/signup` for fresh-start UX.
 *
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 5 Step 5.4
 */
/** Read a non-empty URL-search value or return null (collapses null + empty string). */
function readQuery(url: URL, key: string): string | null {
  const value = url.searchParams.get(key);
  return value !== null && value !== '' ? value : null;
}

/**
 * Fetch the signup ticket's peek data and shape it for the form page.
 * Extracted from `load()` to keep its cyclomatic complexity under 10 —
 * the peek path alone has 4 branches (404/400, !ok, !success, success).
 */
async function peekSignupTicket(
  ticket: string,
  fetchFn: typeof fetch,
): Promise<{ ticket: string; email: string; displayName: string | null }> {
  const response = await fetchFn(
    `${API_BASE}/auth/oauth/microsoft/signup-ticket/${encodeURIComponent(ticket)}`,
  );

  // 404 = ticket unknown/expired; 400 = malformed id (tampered URL). Both
  // collapse to the same UX: restart the OAuth flow from /signup.
  if (response.status === 404 || response.status === 400) {
    redirect(303, '/signup?oauth=ticket-expired');
  }

  if (!response.ok) {
    log.error({ status: response.status }, 'Peek signup ticket failed unexpectedly');
    error(500, 'Signup-Daten konnten nicht geladen werden.');
  }

  const body = (await response.json()) as PeekResponse;
  if (!body.success) {
    log.error({ code: body.error.code }, 'Peek returned {success:false}');
    error(500, body.error.message);
  }

  return {
    ticket,
    email: body.data.email,
    displayName: body.data.displayName,
  };
}

export const load: PageServerLoad = async ({ url, fetch, cookies, request }) => {
  const handoffToken = readQuery(url, 'token');
  if (handoffToken !== null) {
    // `?unlock=...` is ADR-050 × ADR-022 cross-origin escrow handoff:
    // the apex login minted a single-use ticket carrying the wrappingKey.
    // We preserve it verbatim into the final dashboard redirect so the
    // (app) layout can consume it via e2e.bootstrapFromUnlockTicket before
    // running initialize().
    return await handleHandoff(
      handoffToken,
      fetch,
      cookies,
      url,
      request,
      readQuery(url, 'unlock'),
    );
  }

  const ticket = readQuery(url, 'ticket');
  if (ticket === null) {
    // User landed here without an OAuth handoff — bounce them to the start.
    redirect(303, '/signup');
  }

  return await peekSignupTicket(ticket, fetch);
};

// ─── OAuth Handoff Branch (ADR-050) ──────────────────────────────────────────

/**
 * Swap a single-use handoff token for auth cookies scoped to the current
 * (subdomain) origin, then redirect to the role-specific dashboard.
 *
 * Never returns normally — always throws a SvelteKit redirect/error. The
 * return type is `never` via re-thrown `redirect()` / `error()`, so the
 * caller's control flow falls through only in unreachable branches.
 *
 * R15 defence-in-depth: the `X-Forwarded-Host` header is explicitly
 * propagated so the backend `TenantHostResolverMiddleware` resolves
 * `req.hostTenantId` from the original subdomain — mismatching the payload
 * tenantId triggers the handoff service's `HANDOFF_HOST_MISMATCH` 403.
 * Without this header the backend would see `localhost` (dev) or the
 * internal docker hostname (prod) and reject every handoff.
 *
 * @see backend/src/nest/auth/oauth/oauth-handoff.controller.ts
 * @see backend/src/nest/auth/oauth/oauth-handoff.service.ts consume() R15 block
 */
async function handleHandoff(
  token: string,
  fetchFn: typeof fetch,
  cookies: Cookies,
  url: URL,
  request: Request,
  unlockTicket: string | null,
): Promise<never> {
  const forwardedHost = request.headers.get('x-forwarded-host') ?? new URL(request.url).hostname;

  let response: Response;
  try {
    response = await fetchFn(`${API_BASE}/auth/oauth/handoff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Nginx prod: already set by reverse proxy; re-setting is a no-op.
        // Dev direct-to-backend (localhost:3000): we're the only source.
        'X-Forwarded-Host': forwardedHost,
      },
      body: JSON.stringify({ token }),
    });
  } catch (err: unknown) {
    log.error({ err }, 'Handoff fetch failed (network)');
    error(500, 'Sitzung konnte nicht übernommen werden.');
  }

  // Map backend error codes to specific login-page error query-params so the
  // login page can surface a targeted German message via its existing
  // `?oauth=…` handling (login/+page.svelte already renders `?oauth=…` hints).
  if (response.status === 400) {
    log.warn('Handoff rejected: malformed token shape');
    redirect(303, '/login?oauth=handoff-invalid');
  }
  if (response.status === 404) {
    log.info('Handoff token expired or unknown');
    redirect(303, '/login?oauth=handoff-expired');
  }
  if (response.status === 403) {
    // R15: host cross-check mismatch. Legit token preserved (Redis GETDEL
    // only fires on match) — user can retry the OAuth flow without losing
    // a round-trip.
    log.warn({ forwardedHost }, 'Handoff rejected: host mismatch (R15)');
    redirect(303, '/login?oauth=handoff-host-mismatch');
  }

  if (!response.ok) {
    log.error({ status: response.status }, 'Handoff failed unexpectedly');
    error(500, 'Sitzung konnte nicht übernommen werden.');
  }

  const envelope = (await response.json()) as HandoffSuccessEnvelope;
  if (envelope.data === undefined) {
    // Envelope drift — if ResponseInterceptor ever changes shape or is
    // disabled for this route, we fail closed rather than set undefined
    // cookies. Logged for Loki alerting.
    log.error({ envelope }, 'Handoff response missing `data` envelope field');
    error(500, 'Sitzung konnte nicht übernommen werden.');
  }
  const { accessToken, refreshToken } = envelope.data;

  let role: UserRole;
  try {
    role = extractJwtRole(accessToken);
  } catch (err: unknown) {
    // Drift guard: the backend always signs JWTs with a valid `role` claim
    // (auth.service.ts::JwtPayload). Reaching this branch means either a
    // corrupted token made it to us or the claim shape changed — either way
    // we cannot safely route the user, so fail closed.
    log.error({ err }, 'Handoff succeeded but JWT has no valid role claim');
    error(500, 'Sitzung konnte nicht übernommen werden.');
  }

  setAuthCookies(cookies, url, accessToken, refreshToken, role);
  // ADR-050 × ADR-022: forward the unlock ticket to the dashboard so the
  // (app) layout can consume it client-side. We append it as a query param
  // rather than e.g. a cookie because cookies are subdomain-scoped here and
  // the layout needs to strip it from the URL ASAP anyway.
  const dashboardPath = ROLE_DASHBOARD_PATHS[role];
  const redirectTarget =
    unlockTicket !== null ?
      `${dashboardPath}?unlock=${encodeURIComponent(unlockTicket)}`
    : dashboardPath;
  redirect(303, redirectTarget);
}

// ─── Action ──────────────────────────────────────────────────────────────────

/** Pull a non-empty string from form data or return null. */
function readStringField(value: FormDataEntryValue | null): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * Build the backend DTO from the submitted form. `countryCode` is merged
 * into `phone` so the payload matches the single `phone` DTO field exactly
 * like `signup/_lib/api.ts` does for the password flow.
 */
function buildCompleteSignupPayload(formData: FormData): {
  ticket: string;
  companyName: string;
  subdomain: string;
  phone: string;
  adminFirstName: string;
  adminLastName: string;
} | null {
  const ticket = readStringField(formData.get('ticket'));
  const companyName = readStringField(formData.get('companyName'));
  const subdomain = readStringField(formData.get('subdomain'));
  const phone = readStringField(formData.get('phone'));
  const countryCode = readStringField(formData.get('countryCode')) ?? '+49';
  const adminFirstName = readStringField(formData.get('adminFirstName'));
  const adminLastName = readStringField(formData.get('adminLastName'));

  if (
    ticket === null ||
    companyName === null ||
    subdomain === null ||
    phone === null ||
    adminFirstName === null ||
    adminLastName === null
  ) {
    return null;
  }

  const fullPhone = `${countryCode}${phone.replace(/\s/g, '')}`;
  return {
    ticket,
    companyName,
    subdomain,
    phone: fullPhone,
    adminFirstName,
    adminLastName,
  };
}

export const actions: Actions = {
  default: async ({ request, fetch, cookies, url }) => {
    const formData = await request.formData();
    const payload = buildCompleteSignupPayload(formData);
    if (payload === null) {
      return fail(400, { error: 'Bitte füllen Sie alle Pflichtfelder aus.' });
    }

    try {
      const response = await fetch(`${API_BASE}/auth/oauth/microsoft/complete-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Error paths with specific, user-readable messages.
      if (response.status === 409) {
        return fail(409, {
          error: 'Dieses Microsoft-Konto ist bereits mit einem Assixx-Tenant verknüpft.',
        });
      }
      if (response.status === 401) {
        return fail(401, {
          error:
            'Die Anmelde-Sitzung ist abgelaufen. Bitte starten Sie die Microsoft-Registrierung erneut.',
        });
      }

      const body = (await response.json()) as CompleteResponse;

      if (!response.ok || !body.success) {
        const message = !body.success ? body.error.message : 'Registrierung fehlgeschlagen.';
        return fail(response.ok ? 500 : response.status, { error: message });
      }

      // OAuth signup always creates a tenant's first root admin — the role
      // was previously hardcoded inside setAuthCookies; now passed explicitly
      // so the function can also serve the login-handoff branch (ADR-050).
      setAuthCookies(cookies, url, body.data.accessToken, body.data.refreshToken, 'root');

      return {
        success: true,
        accessToken: body.data.accessToken,
        user: { role: 'root' as const },
        redirectTo: '/root-dashboard',
      };
    } catch (err: unknown) {
      log.error({ err }, 'Complete-signup action failed');
      return fail(500, { error: 'Ein Serverfehler ist aufgetreten.' });
    }
  },
};
