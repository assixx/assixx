/**
 * App Layout - Server-Side Data Loading
 * @module (app)/+layout.server
 *
 * SSR Performance: Loads user/tenant data ONCE for ALL child pages.
 * Auth: Reads httpOnly cookie and redirects to /login if missing.
 *
 * This data is available to ALL pages in the (app) group via:
 * - `data.user` in +page.svelte
 * - `await parent()` in +page.server.ts
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { LayoutServerLoad } from './$types';

const log = createLogger('AppLayout');

/** API base URL for server-side fetching */
const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

/** User data from /users/me endpoint */
interface UserData {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'root' | 'admin' | 'employee';
  employeeNumber?: string;
  profilePicture?: string;
  position?: string;
  tenantId: number;
  tenant?: TenantData;
  hasFullAccess?: boolean;
  // Team assignment fields (inherited from primary team)
  teamIds?: number[];
  teamNames?: string[];
  teamDepartmentId?: number | null;
  teamDepartmentName?: string | null;
  teamAreaId?: number | null;
  teamAreaName?: string | null;
}

/** Tenant data included in user response */
interface TenantData {
  id: number;
  companyName?: string;
}

/** API response wrapper */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { message: string };
}

/** Dashboard counts from /dashboard/counts endpoint */
interface DashboardCounts {
  chat: { totalUnread: number };
  notifications: {
    total: number;
    unread: number;
    byType: Record<string, number>;
  };
  blackboard: { count: number };
  calendar: { count: number };
  documents: { count: number };
  /** KVP unconfirmed count (Pattern 2: Individual read tracking) */
  kvp: { count: number };
  /** Pending surveys count (active surveys not yet responded to by user) */
  surveys: { count: number };
  fetchedAt: string;
}

/** Public paths that don't require authentication */
const PUBLIC_PATHS = ['/login', '/signup', '/tenant-deletion-approve'];

/** Check if path is public (no auth required) */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

/** Map API response to layout user data */
function mapUserData(userData: UserData) {
  return {
    id: userData.id,
    email: userData.email,
    firstName: userData.firstName,
    lastName: userData.lastName,
    role: userData.role,
    employeeNumber: userData.employeeNumber,
    profilePicture: userData.profilePicture,
    position: userData.position,
    tenantId: userData.tenantId,
    hasFullAccess: userData.hasFullAccess ?? false,
    teamIds: userData.teamIds,
    teamNames: userData.teamNames,
    teamDepartmentId: userData.teamDepartmentId,
    teamDepartmentName: userData.teamDepartmentName,
    teamAreaId: userData.teamAreaId,
    teamAreaName: userData.teamAreaName,
  };
}

/** Extract user data from API response (handles wrapped and unwrapped formats) */
function extractUserData(json: ApiResponse<UserData>): UserData | undefined {
  if ('success' in json && json.success) {
    return json.data;
  }
  return json as unknown as UserData;
}

/** Parse dashboard counts from response (graceful fallback to null) */
async function parseDashboardCounts(
  response: Response | null,
): Promise<DashboardCounts | null> {
  if (response?.ok !== true) return null;
  const json = (await response.json()) as ApiResponse<DashboardCounts>;
  return json.data ?? null;
}

/** Clear auth cookies and redirect to login */
function clearAuthAndRedirect(
  cookies: Parameters<LayoutServerLoad>[0]['cookies'],
): never {
  cookies.delete('accessToken', { path: '/' });
  cookies.delete('refreshToken', { path: '/api/v2/auth' });
  redirect(302, '/login');
}

/** Unauthenticated response */
const UNAUTHENTICATED_RESPONSE = {
  user: null,
  tenant: null,
  isAuthenticated: false,
  dashboardCounts: null,
} as const;

/** Build authenticated response from user data and counts */
async function buildAuthenticatedResponse(
  userData: UserData,
  countsResponse: Response | null,
) {
  return {
    user: mapUserData(userData),
    tenant: userData.tenant ?? null,
    isAuthenticated: true,
    dashboardCounts: await parseDashboardCounts(countsResponse),
  };
}

/** Fetch dashboard counts only (when RBAC user is available) */
async function fetchDashboardCountsOnly(
  fetchFn: typeof fetch,
  headers: Record<string, string>,
): Promise<Response | null> {
  return await fetchFn(`${API_BASE}/dashboard/counts`, { headers }).catch(
    () => null,
  );
}

/** Fetch user data and dashboard counts in parallel */
async function fetchUserAndCounts(
  fetchFn: typeof fetch,
  headers: Record<string, string>,
): Promise<{ userResponse: Response; countsResponse: Response | null }> {
  const [userResponse, countsResponse] = await Promise.all([
    fetchFn(`${API_BASE}/users/me`, { headers }),
    fetchFn(`${API_BASE}/dashboard/counts`, { headers }).catch(() => null),
  ]);
  return { userResponse, countsResponse };
}

/**
 * Layout server load function
 *
 * RUNS ONCE per navigation - data is shared with ALL child pages.
 * Child pages can access via `data.user` or `await parent()` in their load functions.
 *
 * PERFORMANCE OPTIMIZATION:
 * - Reuses user data from RBAC hook (locals.user) when available
 * - RBAC hook already fetches /users/me for role-protected routes
 * - Saves ~50-80ms by avoiding duplicate fetch
 */
export const load: LayoutServerLoad = async ({
  cookies,
  fetch,
  url,
  locals,
}) => {
  const startTime = performance.now();
  const token = cookies.get('accessToken');
  const hasToken = token !== undefined && token !== '';

  // Handle unauthenticated requests
  if (!hasToken && !isPublicPath(url.pathname)) {
    redirect(302, '/login');
  }

  if (!hasToken) {
    return UNAUTHENTICATED_RESPONSE;
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Check if RBAC hook already fetched user data (saves ~50-80ms!)
  const rbacUser = locals.user as UserData | undefined;

  if (rbacUser !== undefined) {
    // FAST PATH: Reuse user from RBAC hook - only fetch dashboard counts
    const countsStart = performance.now();
    const countsResponse = await fetchDashboardCountsOnly(fetch, headers);
    const countsTime = Math.round(performance.now() - countsStart);
    const totalTime = Math.round(performance.now() - startTime);

    log.info(
      { userId: rbacUser.id, countsTime, totalTime, path: url.pathname },
      `⚡ FAST PATH: RBAC user reused, only /dashboard/counts fetched (${countsTime}ms, total: ${totalTime}ms)`,
    );

    return await buildAuthenticatedResponse(rbacUser, countsResponse);
  }

  // SLOW PATH: RBAC hook didn't set user - fetch both in parallel
  log.warn(
    { pathname: url.pathname },
    '🐢 SLOW PATH: No RBAC user, fetching /users/me + /counts',
  );
  return await loadUserWithFetch(
    cookies,
    fetch,
    headers,
    startTime,
    url.pathname,
  );
};

/** Load user via API fetch (slow path when RBAC user not available) */
async function loadUserWithFetch(
  cookies: Parameters<LayoutServerLoad>[0]['cookies'],
  fetchFn: typeof fetch,
  headers: Record<string, string>,
  startTime: number,
  pathname: string,
) {
  const fetchStart = performance.now();
  const { userResponse, countsResponse } = await fetchUserAndCounts(
    fetchFn,
    headers,
  );
  const fetchTime = Math.round(performance.now() - fetchStart);

  if (!userResponse.ok) {
    log.warn({ status: userResponse.status }, '/users/me failed');
    clearAuthAndRedirect(cookies);
  }

  const userJson = (await userResponse.json()) as ApiResponse<UserData>;
  const userData = extractUserData(userJson);

  if (userData === undefined) {
    log.error('No user data in response');
    redirect(302, '/login');
  }

  const totalTime = Math.round(performance.now() - startTime);
  log.info(
    { fetchTime, totalTime, path: pathname },
    `🐢 SLOW PATH complete: /users/me + /counts fetched (${fetchTime}ms, total: ${totalTime}ms)`,
  );

  return await buildAuthenticatedResponse(userData, countsResponse);
}
