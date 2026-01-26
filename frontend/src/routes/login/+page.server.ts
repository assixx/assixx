/**
 * Login Page - Server Actions & Load
 * @module login/+page.server
 *
 * - Load: Redirects already-authenticated users to their dashboard
 * - Actions: Handles login form submission server-side to set httpOnly cookies
 *
 * This enables SSR pages to access the auth token via cookies.
 */
import { fail, redirect, type Cookies } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { Actions, PageServerLoad } from './$types';

const log = createLogger('Login');

/** API base URL for server-side fetching */
const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

/** Cookie options for access token */
const ACCESS_COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
};

/**
 * Cookie options for refresh token - STRICTER than access token
 * sameSite: 'strict' - Better CSRF protection
 * path: '/api/v2/auth' - Only sent to auth endpoints (minimizes exposure)
 */
const REFRESH_COOKIE_OPTIONS = {
  path: '/api/v2/auth',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
};

/** Access token expiry: 30 minutes */
const ACCESS_TOKEN_MAX_AGE = 30 * 60;

/** Refresh token expiry: 7 days */
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60;

type UserRole = 'root' | 'admin' | 'employee';

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

/**
 * Set authentication cookies after successful login.
 *
 * SECURITY: refreshToken uses stricter options (sameSite: strict, limited path)
 * to protect the long-lived token from CSRF attacks.
 */
function setAuthCookies(cookies: Cookies, data: LoginResponseData): void {
  // Access token - available everywhere for API calls
  cookies.set('accessToken', data.accessToken, {
    ...ACCESS_COOKIE_OPTIONS,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  // Refresh token - stricter settings, only for auth endpoints
  cookies.set('refreshToken', data.refreshToken, {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });

  // User role - not httpOnly so client JS can read it
  cookies.set('userRole', data.user.role, {
    ...ACCESS_COOKIE_OPTIONS,
    httpOnly: false,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
}

/** Get redirect path based on user role */
function getRedirectPath(role: UserRole): string {
  const paths: Record<UserRole, string> = {
    root: '/root-dashboard',
    admin: '/admin-dashboard',
    employee: '/employee-dashboard',
  };
  return paths[role];
}

/** API response for /users/me */
interface MeResponse {
  success?: boolean;
  data?: { role: UserRole };
  role?: UserRole;
}

/** Clear all auth cookies */
function clearAuthCookies(cookies: Cookies): void {
  cookies.delete('accessToken', { path: '/' });
  cookies.delete('refreshToken', { path: '/api/v2/auth' });
  cookies.delete('userRole', { path: '/' });
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
export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('accessToken');

  if (token === undefined || token === '') {
    return {};
  }

  try {
    const response = await fetch(`${API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
  } catch (err) {
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
    return fail(429, { error: 'Zu viele Anmeldeversuche. Bitte warten Sie.', email });
  }
  return fail(401, { error: result.error?.message ?? 'Login fehlgeschlagen', email });
}

export const actions: Actions = {
  default: async ({ request, cookies, fetch }) => {
    const formData = await request.formData();
    const email = formData.get('email');
    const password = formData.get('password');

    if (!isValidStringField(email) || !isValidStringField(password)) {
      const emailValue = typeof email === 'string' ? email : '';
      return fail(400, { error: 'E-Mail und Passwort sind erforderlich', email: emailValue });
    }

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

      setAuthCookies(cookies, result.data);

      return {
        success: true,
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        user: result.data.user,
        redirectTo: getRedirectPath(result.data.user.role),
      };
    } catch (err) {
      log.error({ err }, 'Server error');
      return fail(500, { error: 'Ein Serverfehler ist aufgetreten', email });
    }
  },
};
