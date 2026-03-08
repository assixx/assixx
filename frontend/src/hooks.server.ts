/**
 * SvelteKit Server Hooks
 *
 * - Authentication Gate - Validates tokens for all non-public routes
 * - Sentry error tracking integration
 * - Pino request logging (to Loki)
 * - HTML Minification for Production Builds
 *
 * SECURITY: Authorization (role checks) is handled by route group layouts.
 * This hook only handles Authentication (token validation + user data fetch).
 * @see ADR-012: Frontend Route Security Groups
 * @see https://kit.svelte.dev/docs/hooks#server-hooks
 * @see https://docs.sentry.io/platforms/javascript/guides/sveltekit/
 */
import * as Sentry from '@sentry/sveltekit';
import { redirect, type Handle, type HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { minify } from 'html-minifier-terser';

import { dev } from '$app/environment';

import { createLogger } from '$lib/utils/logger';

import type { UserRole } from '@assixx/shared';

/** Logger instance for hooks */
const log = createLogger('hooks.server');

// ============================================================================
// Authentication Gate
// ============================================================================

/** API base URL for server-side fetching */
const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

/** Public routes - no authentication required */
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/tenant-deletion-approve',
  '/rate-limit',
];

/** Routes to skip authentication check (internal, assets, API proxy) */
const SKIP_ROUTES_PREFIXES = [
  '/_app/',
  '/favicon',
  '/api/',
  '/sentry-tunnel',
  '/health',
];

/** User data structure from API */
interface UserData {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  tenantId: number;
  hasFullAccess?: boolean;
}

/** API response wrapper type */
interface ApiUserResponse {
  success?: boolean;
  data?: UserData;
  id?: number;
  email?: string;
  role?: UserRole;
  tenantId?: number;
  firstName?: string;
  lastName?: string;
  hasFullAccess?: boolean;
}

/** Check if path should skip authentication */
function shouldSkipAuth(pathname: string): boolean {
  if (SKIP_ROUTES_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  if (
    PUBLIC_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + '/'),
    )
  ) {
    return true;
  }
  return false;
}

/** Extract user data from API response */
function extractUserData(json: ApiUserResponse): UserData | null {
  if (json.data !== undefined) {
    return json.data;
  }

  if (json.role !== undefined) {
    return {
      id: json.id ?? 0,
      email: json.email ?? '',
      firstName: json.firstName,
      lastName: json.lastName,
      role: json.role,
      tenantId: json.tenantId ?? 0,
      hasFullAccess: json.hasFullAccess,
    };
  }

  return null;
}

/** Fetch user data from API */
async function fetchUserData(token: string): Promise<UserData | null> {
  const response = await fetch(`${API_BASE}/users/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    return null;
  }

  const json = (await response.json()) as ApiUserResponse;
  return extractUserData(json);
}

/** Check if error is a redirect (SvelteKit uses throw for redirects) */
function isRedirectError(err: unknown): boolean {
  if (err instanceof Response) return true;
  if (typeof err === 'object' && err !== null && 'status' in err) {
    return (err as { status: number }).status === 302;
  }
  return false;
}

/**
 * Authentication Hook
 *
 * SECURITY: Validates auth token and fetches user data for all protected routes.
 * Authorization (role checks) is handled by route group layouts.
 * @see ADR-012: Frontend Route Security Groups
 */
const authHandle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;

  // Skip routes that don't need authentication
  if (shouldSkipAuth(pathname)) {
    return await resolve(event);
  }

  // Check for auth token
  const token = event.cookies.get('accessToken');
  if (token === undefined || token === '') {
    log.debug({ pathname }, 'Auth: No token, redirecting to login');
    redirect(302, '/login');
  }

  // Fetch user data for downstream layouts (FAST PATH optimization)
  const locals = event.locals;

  try {
    const userData = await fetchUserData(token);

    if (userData === null) {
      log.warn({ pathname }, 'Auth: Failed to fetch user data');
      event.cookies.delete('accessToken', { path: '/' });
      event.cookies.delete('refreshToken', { path: '/api/v2/auth' });
      redirect(302, '/login');
    }

    // Store user in locals — group layouts access via parent()
    locals.user = userData;

    // Dummy-User Whitelist — restrict to read-only display pages
    if (userData.role === 'dummy') {
      const DUMMY_ALLOWED_PREFIXES = [
        '/blackboard',
        '/calendar',
        '/lean-management/tpm',
      ] as const;

      const isAllowed = DUMMY_ALLOWED_PREFIXES.some((prefix: string) =>
        pathname.startsWith(prefix),
      );
      if (!isAllowed) {
        log.warn(
          { pathname },
          'Auth: Dummy blocked, redirecting to /blackboard',
        );
        redirect(302, '/blackboard');
      }
    }

    log.debug(
      { pathname, userRole: userData.role },
      'Auth: User authenticated',
    );
  } catch (err: unknown) {
    if (isRedirectError(err)) {
      throw err;
    }
    log.error({ err, pathname }, 'Auth: Error during authentication');
    redirect(302, '/login');
  }

  return await resolve(event);
};

// ============================================================================
// Request Logging
// ============================================================================

/**
 * Request logging handle
 * Logs all SSR requests with timing for observability
 */
const requestLoggingHandle: Handle = async ({ event, resolve }) => {
  const start = Date.now();
  const { method } = event.request;
  const pathname = event.url.pathname;

  if (
    pathname.startsWith('/_app/') ||
    pathname.startsWith('/favicon') ||
    pathname === '/sentry-tunnel'
  ) {
    return await resolve(event);
  }

  try {
    const response = await resolve(event);
    const duration = Date.now() - start;

    log.info(
      {
        method,
        pathname,
        status: response.status,
        duration,
        userAgent: event.request.headers.get('user-agent')?.substring(0, 100),
      },
      `${method} ${pathname} ${response.status} ${duration}ms`,
    );

    return response;
  } catch (err: unknown) {
    const duration = Date.now() - start;
    log.error(
      { method, pathname, duration, err },
      `${method} ${pathname} ERROR ${duration}ms`,
    );
    throw err;
  }
};

// ============================================================================
// HTML Minification
// ============================================================================

const minificationOptions = {
  collapseWhitespace: true,
  conservativeCollapse: true,
  html5: true,
  collapseBooleanAttributes: true,
  removeAttributeQuotes: true,
  removeOptionalTags: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  minifyCSS: true,
  minifyJS: true,
  removeComments: false,
  ignoreCustomComments: [/^#/],
  decodeEntities: true,
  sortAttributes: true,
  sortClassName: true,
};

const htmlMinificationHandle: Handle = async ({ event, resolve }) => {
  if (dev) {
    return await resolve(event);
  }

  let pageHtml = '';

  return await resolve(event, {
    transformPageChunk: async ({ html, done }) => {
      pageHtml += html;
      if (done) {
        return await minify(pageHtml, minificationOptions);
      }
      return undefined;
    },
  });
};

// ============================================================================
// Export Combined Hooks
// ============================================================================

/**
 * Combined handle hook
 *
 * Order: Sentry → Auth → Logging → Minification
 * Authorization is handled by route group layouts (@see ADR-012)
 */
export const handle: Handle = sequence(
  Sentry.sentryHandle(),
  authHandle,
  requestLoggingHandle,
  htmlMinificationHandle,
);

export const handleError: HandleServerError = Sentry.handleErrorWithSentry();
