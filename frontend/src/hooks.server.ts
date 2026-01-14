/**
 * SvelteKit Server Hooks
 *
 * - Role-Based Access Control (RBAC) - SECURITY CRITICAL
 * - Sentry error tracking integration
 * - Pino request logging (to Loki)
 * - HTML Minification for Production Builds
 *
 * @see https://kit.svelte.dev/docs/hooks#server-hooks
 * @see https://docs.sentry.io/platforms/javascript/guides/sveltekit/
 */
import * as Sentry from '@sentry/sveltekit';
import { redirect, type Handle, type HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { minify } from 'html-minifier-terser';

import { dev } from '$app/environment';

import { createLogger } from '$lib/utils/logger';

/** Logger instance for hooks */
const log = createLogger('hooks.server');

// ============================================================================
// RBAC - Role-Based Access Control
// ============================================================================

/** User role type - matches backend UserRole enum */
type UserRole = 'root' | 'admin' | 'employee';

/** API base URL for server-side fetching */
const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

/**
 * Route → Required roles mapping
 *
 * IMPORTANT: Routes not listed here allow ALL authenticated users.
 * Keep this list updated when adding new admin/root routes!
 */
const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  // ROOT ONLY - System administration
  '/root-dashboard': ['root'],
  '/root-profile': ['root'],
  '/manage-root': ['root'],
  '/logs': ['root'],

  // ADMIN + ROOT - Tenant management
  '/admin-dashboard': ['admin', 'root'],
  '/admin-profile': ['admin', 'root'],
  '/manage-employees': ['admin', 'root'],
  '/manage-admins': ['admin', 'root'],
  '/manage-teams': ['admin', 'root'],
  '/manage-departments': ['admin', 'root'],
  '/manage-areas': ['admin', 'root'],
  '/manage-machines': ['admin', 'root'],
  '/features': ['admin', 'root'],
  '/survey-admin': ['admin', 'root'],
  '/survey-results': ['admin', 'root'],
  '/shifts': ['admin', 'root'],
  '/storage-upgrade': ['admin', 'root'],
  '/tenant-deletion-status': ['admin', 'root'],
};

/** Public routes - no authentication required */
const PUBLIC_ROUTES = ['/', '/login', '/signup', '/tenant-deletion-approve', '/rate-limit'];

/** Routes to skip RBAC check (internal, assets, API proxy) */
const SKIP_ROUTES_PREFIXES = ['/_app/', '/favicon', '/api/', '/sentry-tunnel', '/health'];

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

/** Check if path should skip RBAC */
function shouldSkipRbac(pathname: string): boolean {
  if (SKIP_ROUTES_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  if (PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))) {
    return true;
  }
  return false;
}

/** Find required roles for a path */
function getRequiredRoles(pathname: string): UserRole[] | null {
  // Check exact match using Object.hasOwn for proper type narrowing
  if (Object.hasOwn(ROUTE_PERMISSIONS, pathname)) {
    return ROUTE_PERMISSIONS[pathname];
  }

  // Check prefix match for dynamic routes
  for (const [route, roles] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname.startsWith(route + '/')) {
      return roles;
    }
  }

  return null;
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
 * Role-Based Access Control Hook
 *
 * SECURITY: This is the first line of defense!
 * Checks user role BEFORE page load and redirects if unauthorized.
 */
const rbacHandle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;

  // Skip routes that don't need RBAC
  if (shouldSkipRbac(pathname)) {
    return await resolve(event);
  }

  // Check for auth token
  const token = event.cookies.get('accessToken');
  if (token === undefined || token === '') {
    log.debug({ pathname }, 'RBAC: No token, redirecting to login');
    redirect(302, '/login');
  }

  // Check if route requires specific roles
  const requiredRoles = getRequiredRoles(pathname);
  if (requiredRoles === null) {
    return await resolve(event);
  }

  // Verify user role - capture locals reference before async operation
  const locals = event.locals;

  try {
    const userData = await fetchUserData(token);

    if (userData === null) {
      log.warn({ pathname }, 'RBAC: Failed to fetch user data');
      event.cookies.delete('accessToken', { path: '/' });
      event.cookies.delete('refreshToken', { path: '/api/v2/auth' });
      redirect(302, '/login');
    }

    // Store user in locals (reference captured before await)
    locals.user = userData;

    // Check permission
    if (!requiredRoles.includes(userData.role)) {
      log.warn(
        { pathname, userRole: userData.role, requiredRoles },
        `RBAC: Access denied - ${userData.role} tried to access ${pathname}`,
      );
      redirect(302, '/permission-denied');
    }

    log.debug({ pathname, userRole: userData.role }, 'RBAC: Access granted');
  } catch (err) {
    if (isRedirectError(err)) {
      throw err;
    }
    log.error({ err, pathname }, 'RBAC: Error checking permissions');
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
  } catch (err) {
    const duration = Date.now() - start;
    log.error({ method, pathname, duration, err }, `${method} ${pathname} ERROR ${duration}ms`);
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
 * Order: Sentry → RBAC → Logging → Minification
 */
export const handle: Handle = sequence(
  Sentry.sentryHandle(),
  rbacHandle,
  requestLoggingHandle,
  htmlMinificationHandle,
);

export const handleError: HandleServerError = Sentry.handleErrorWithSentry();
