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

import { createLogger } from '$lib/utils/logger';

import type { Actions, PageServerLoad } from './$types';

const log = createLogger('OAuthCompleteSignup');

/** API base URL for server-side fetching — matches login/+page.server.ts. */
const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

/** Cookie options for the short-lived access token (see login action). */
const ACCESS_COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
};

/**
 * Cookie options for the long-lived refresh token — stricter than access
 * token: sameSite:'strict' + path scoped to /api/v2/auth (CSRF defence).
 */
const REFRESH_COOKIE_OPTIONS = {
  path: '/api/v2/auth',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
};

const ACCESS_TOKEN_MAX_AGE = 30 * 60; // 30 min
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

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

// ─── Load ────────────────────────────────────────────────────────────────────

export const load: PageServerLoad = async ({ url, fetch }) => {
  const ticket = url.searchParams.get('ticket');
  if (ticket === null || ticket === '') {
    // User landed here without an OAuth handoff — bounce them to the start.
    redirect(303, '/signup');
  }

  const response = await fetch(
    `${API_BASE}/auth/oauth/microsoft/signup-ticket/${encodeURIComponent(ticket)}`,
  );

  // 404 = ticket unknown/expired; 400 = malformed id (tampered URL).
  // Both collapse to the same UX: restart the OAuth flow from /signup.
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
};

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

function setAuthCookies(cookies: Cookies, access: string, refresh: string): void {
  cookies.set('accessToken', access, {
    ...ACCESS_COOKIE_OPTIONS,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  cookies.set('refreshToken', refresh, {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
  // userRole is readable by client JS (not httpOnly) — the router uses it
  // to pick the correct dashboard layout. OAuth signup always creates root.
  cookies.set('userRole', 'root', {
    ...ACCESS_COOKIE_OPTIONS,
    httpOnly: false,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
}

export const actions: Actions = {
  default: async ({ request, fetch, cookies }) => {
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

      setAuthCookies(cookies, body.data.accessToken, body.data.refreshToken);

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
