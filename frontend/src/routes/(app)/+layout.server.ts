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

import { DEFAULT_HIERARCHY_LABELS } from '$lib/types/hierarchy-labels';
import { createLogger } from '$lib/utils/logger';

import type { HierarchyLabels } from '$lib/types/hierarchy-labels';
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
  /** Unread vacation notifications (new requests for approvers, responses for requesters) */
  vacation: { count: number };
  /** Unread TPM notifications (maintenance due, overdue, approval required) */
  tpm: { count: number };
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

/** Parse theme setting from response (graceful fallback to null) */
async function parseThemeSetting(
  response: Response | null,
): Promise<'dark' | 'light' | null> {
  if (response?.ok !== true) return null;
  const json = (await response.json()) as ApiResponse<{ settingValue: string }>;
  const value = json.data?.settingValue;
  if (value === 'dark' || value === 'light') return value;
  return null;
}

/** Feature data from /features/my-features endpoint */
interface FeatureWithTenantInfo {
  code: string;
  tenantFeature?: { isActive: boolean };
}

/**
 * Parse active feature codes from /features/my-features response.
 * Returns string[] of active feature codes (e.g., ['blackboard', 'calendar', 'chat']).
 * Graceful fallback to empty array on error.
 */
async function parseActiveFeatures(
  response: Response | null,
): Promise<string[]> {
  if (response?.ok !== true) return [];
  try {
    const json = (await response.json()) as ApiResponse<
      FeatureWithTenantInfo[]
    >;
    const features = json.data ?? [];
    return features
      .filter((f) => f.tenantFeature?.isActive === true)
      .map((f) => f.code);
  } catch {
    return [];
  }
}

/** Parse hierarchy labels from response (graceful fallback to defaults) */
async function parseHierarchyLabels(
  response: Response | null,
): Promise<HierarchyLabels> {
  if (response?.ok !== true) return DEFAULT_HIERARCHY_LABELS;
  try {
    const json = (await response.json()) as ApiResponse<HierarchyLabels>;
    const data = json.data;
    if (
      data !== undefined &&
      typeof data.hall === 'string' &&
      typeof data.area === 'string' &&
      typeof data.department === 'string' &&
      typeof data.team === 'string' &&
      typeof data.asset === 'string'
    ) {
      return data;
    }
    return DEFAULT_HIERARCHY_LABELS;
  } catch {
    return DEFAULT_HIERARCHY_LABELS;
  }
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
  theme: null,
  activeFeatures: [] as string[],
  hierarchyLabels: DEFAULT_HIERARCHY_LABELS,
} as const;

/** Build authenticated response from user data, counts, theme, features, and labels */
async function buildAuthenticatedResponse(
  userData: UserData,
  countsResponse: Response | null,
  themeResponse: Response | null,
  featuresResponse: Response | null,
  labelsResponse: Response | null,
) {
  return {
    user: mapUserData(userData),
    tenant: userData.tenant ?? null,
    isAuthenticated: true,
    dashboardCounts: await parseDashboardCounts(countsResponse),
    theme: await parseThemeSetting(themeResponse),
    activeFeatures: await parseActiveFeatures(featuresResponse),
    hierarchyLabels: await parseHierarchyLabels(labelsResponse),
  };
}

/** Fetch dashboard counts, theme, active features, and hierarchy labels in parallel (when RBAC user is available) */
async function fetchCountsThemeFeaturesAndLabels(
  fetchFn: typeof fetch,
  headers: Record<string, string>,
): Promise<{
  countsResponse: Response | null;
  themeResponse: Response | null;
  featuresResponse: Response | null;
  labelsResponse: Response | null;
}> {
  const [countsResponse, themeResponse, featuresResponse, labelsResponse] =
    await Promise.all([
      fetchFn(`${API_BASE}/dashboard/counts`, { headers }).catch(() => null),
      fetchFn(`${API_BASE}/settings/user/theme`, { headers }).catch(() => null),
      fetchFn(`${API_BASE}/features/my-features`, { headers }).catch(
        () => null,
      ),
      fetchFn(`${API_BASE}/organigram/hierarchy-labels`, { headers }).catch(
        () => null,
      ),
    ]);
  return { countsResponse, themeResponse, featuresResponse, labelsResponse };
}

/** Fetch user data, dashboard counts, theme, active features, and hierarchy labels in parallel */
async function fetchUserCountsThemeFeaturesAndLabels(
  fetchFn: typeof fetch,
  headers: Record<string, string>,
): Promise<{
  userResponse: Response;
  countsResponse: Response | null;
  themeResponse: Response | null;
  featuresResponse: Response | null;
  labelsResponse: Response | null;
}> {
  const [
    userResponse,
    countsResponse,
    themeResponse,
    featuresResponse,
    labelsResponse,
  ] = await Promise.all([
    fetchFn(`${API_BASE}/users/me`, { headers }),
    fetchFn(`${API_BASE}/dashboard/counts`, { headers }).catch(() => null),
    fetchFn(`${API_BASE}/settings/user/theme`, { headers }).catch(() => null),
    fetchFn(`${API_BASE}/features/my-features`, { headers }).catch(() => null),
    fetchFn(`${API_BASE}/organigram/hierarchy-labels`, { headers }).catch(
      () => null,
    ),
  ]);
  return {
    userResponse,
    countsResponse,
    themeResponse,
    featuresResponse,
    labelsResponse,
  };
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
    // FAST PATH: Reuse user from RBAC hook - fetch counts, theme, features + labels in parallel
    const fetchStart = performance.now();
    const { countsResponse, themeResponse, featuresResponse, labelsResponse } =
      await fetchCountsThemeFeaturesAndLabels(fetch, headers);
    const fetchTime = Math.round(performance.now() - fetchStart);
    const totalTime = Math.round(performance.now() - startTime);

    log.debug(
      { userId: rbacUser.id, fetchTime, totalTime, path: url.pathname },
      `⚡ FAST PATH: RBAC user reused, /counts + /theme + /features + /labels fetched in parallel (${fetchTime}ms, total: ${totalTime}ms)`,
    );

    return await buildAuthenticatedResponse(
      rbacUser,
      countsResponse,
      themeResponse,
      featuresResponse,
      labelsResponse,
    );
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
  const {
    userResponse,
    countsResponse,
    themeResponse,
    featuresResponse,
    labelsResponse,
  } = await fetchUserCountsThemeFeaturesAndLabels(fetchFn, headers);
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
  log.debug(
    { fetchTime, totalTime, path: pathname },
    `🐢 SLOW PATH complete: /users/me + /counts + /theme + /features + /labels fetched (${fetchTime}ms, total: ${totalTime}ms)`,
  );

  return await buildAuthenticatedResponse(
    userData,
    countsResponse,
    themeResponse,
    featuresResponse,
    labelsResponse,
  );
}
