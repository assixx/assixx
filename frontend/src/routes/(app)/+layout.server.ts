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

import { API_BASE } from '$lib/server/api-fetch';
import { DEFAULT_HIERARCHY_LABELS } from '$lib/types/hierarchy-labels';
import { DEFAULT_ORG_SCOPE } from '$lib/types/organizational-scope';
import { createLogger } from '$lib/utils/logger';

import type { HierarchyLabels } from '$lib/types/hierarchy-labels';
import type { OrganizationalScope } from '$lib/types/organizational-scope';
import type { LayoutServerLoad } from './$types';

const log = createLogger('AppLayout');

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
  // Lead/Deputy names per org level (from primary team's chain)
  teamLeadName?: string | null;
  teamDeputyLeadName?: string | null;
  departmentLeadName?: string | null;
  departmentDeputyLeadName?: string | null;
  areaLeadName?: string | null;
  areaDeputyLeadName?: string | null;
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
    teamLeadName: userData.teamLeadName,
    teamDeputyLeadName: userData.teamDeputyLeadName,
    departmentLeadName: userData.departmentLeadName,
    departmentDeputyLeadName: userData.departmentDeputyLeadName,
    areaLeadName: userData.areaLeadName,
    areaDeputyLeadName: userData.areaDeputyLeadName,
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
async function parseDashboardCounts(response: Response | null): Promise<DashboardCounts | null> {
  if (response?.ok !== true) return null;
  const json = (await response.json()) as ApiResponse<DashboardCounts>;
  return json.data ?? null;
}

/** Parse theme setting from response (graceful fallback to null) */
async function parseThemeSetting(response: Response | null): Promise<'dark' | 'light' | null> {
  if (response?.ok !== true) return null;
  const json = (await response.json()) as ApiResponse<{ settingValue: string }>;
  const value = json.data?.settingValue;
  if (value === 'dark' || value === 'light') return value;
  return null;
}

/** Addon data from /addons/my-addons endpoint */
interface AddonWithTenantInfo {
  code: string;
  tenantStatus?: { isActive: boolean };
}

/**
 * Parse active addon codes from /addons/my-addons response.
 * Returns string[] of active addon codes (e.g., ['blackboard', 'calendar', 'chat']).
 * Core addons always have tenantStatus.isActive === true.
 * Graceful fallback to empty array on error.
 */
async function parseActiveAddons(response: Response | null): Promise<string[]> {
  if (response?.ok !== true) return [];
  try {
    const json = (await response.json()) as ApiResponse<AddonWithTenantInfo[]>;
    const addons = json.data ?? [];
    return addons.filter((a) => a.tenantStatus?.isActive === true).map((a) => a.code);
  } catch {
    return [];
  }
}

/** Parse hierarchy labels from response (graceful fallback to defaults) */
async function parseHierarchyLabels(response: Response | null): Promise<HierarchyLabels> {
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

/** Parse org scope from response (graceful fallback to default) */
async function parseOrgScope(response: Response | null): Promise<OrganizationalScope> {
  if (response?.ok !== true) return DEFAULT_ORG_SCOPE;
  try {
    const json = (await response.json()) as ApiResponse<OrganizationalScope>;
    return json.data ?? DEFAULT_ORG_SCOPE;
  } catch {
    return DEFAULT_ORG_SCOPE;
  }
}

/** Clear auth cookies and redirect to login */
function clearAuthAndRedirect(cookies: Parameters<LayoutServerLoad>[0]['cookies']): never {
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
  activeAddons: [] as string[],
  hierarchyLabels: DEFAULT_HIERARCHY_LABELS,
  orgScope: DEFAULT_ORG_SCOPE,
} as const;

/** Build authenticated response from user data, counts, theme, addons, and labels */
async function buildAuthenticatedResponse(
  userData: UserData,
  countsResponse: Response | null,
  themeResponse: Response | null,
  addonsResponse: Response | null,
  labelsResponse: Response | null,
  scopeResponse: Response | null,
) {
  return {
    user: mapUserData(userData),
    tenant: userData.tenant ?? null,
    isAuthenticated: true,
    dashboardCounts: await parseDashboardCounts(countsResponse),
    theme: await parseThemeSetting(themeResponse),
    activeAddons: await parseActiveAddons(addonsResponse),
    hierarchyLabels: await parseHierarchyLabels(labelsResponse),
    orgScope: await parseOrgScope(scopeResponse),
  };
}

/** Fetch dashboard counts, theme, active addons, and hierarchy labels in parallel (when RBAC user is available) */
async function fetchCountsThemeAddonsAndLabels(
  fetchFn: typeof fetch,
  headers: Record<string, string>,
): Promise<{
  countsResponse: Response | null;
  themeResponse: Response | null;
  addonsResponse: Response | null;
  labelsResponse: Response | null;
  scopeResponse: Response | null;
}> {
  const [countsResponse, themeResponse, addonsResponse, labelsResponse, scopeResponse] =
    await Promise.all([
      fetchFn(`${API_BASE}/dashboard/counts`, { headers }).catch(() => null),
      fetchFn(`${API_BASE}/settings/user/theme`, { headers }).catch(() => null),
      fetchFn(`${API_BASE}/addons/my-addons`, { headers }).catch(() => null),
      fetchFn(`${API_BASE}/organigram/hierarchy-labels`, { headers }).catch(() => null),
      fetchFn(`${API_BASE}/users/me/org-scope`, { headers }).catch(() => null),
    ]);
  return {
    countsResponse,
    themeResponse,
    addonsResponse,
    labelsResponse,
    scopeResponse,
  };
}

/** Fetch user data, dashboard counts, theme, active addons, and hierarchy labels in parallel */
async function fetchUserCountsThemeAddonsAndLabels(
  fetchFn: typeof fetch,
  headers: Record<string, string>,
): Promise<{
  userResponse: Response;
  countsResponse: Response | null;
  themeResponse: Response | null;
  addonsResponse: Response | null;
  labelsResponse: Response | null;
  scopeResponse: Response | null;
}> {
  const [
    userResponse,
    countsResponse,
    themeResponse,
    addonsResponse,
    labelsResponse,
    scopeResponse,
  ] = await Promise.all([
    fetchFn(`${API_BASE}/users/me`, { headers }),
    fetchFn(`${API_BASE}/dashboard/counts`, { headers }).catch(() => null),
    fetchFn(`${API_BASE}/settings/user/theme`, { headers }).catch(() => null),
    fetchFn(`${API_BASE}/addons/my-addons`, { headers }).catch(() => null),
    fetchFn(`${API_BASE}/organigram/hierarchy-labels`, { headers }).catch(() => null),
    fetchFn(`${API_BASE}/users/me/org-scope`, { headers }).catch(() => null),
  ]);
  return {
    userResponse,
    countsResponse,
    themeResponse,
    addonsResponse,
    labelsResponse,
    scopeResponse,
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
export const load: LayoutServerLoad = async ({ cookies, fetch, url, locals }) => {
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
    // FAST PATH: Reuse user from RBAC hook - fetch counts, theme, addons + labels in parallel
    const fetchStart = performance.now();
    const { countsResponse, themeResponse, addonsResponse, labelsResponse, scopeResponse } =
      await fetchCountsThemeAddonsAndLabels(fetch, headers);
    const fetchTime = Math.round(performance.now() - fetchStart);
    const totalTime = Math.round(performance.now() - startTime);

    log.debug(
      { userId: rbacUser.id, fetchTime, totalTime, path: url.pathname },
      `⚡ FAST PATH: RBAC user reused, /counts + /theme + /addons + /labels fetched in parallel (${fetchTime}ms, total: ${totalTime}ms)`,
    );

    return await buildAuthenticatedResponse(
      rbacUser,
      countsResponse,
      themeResponse,
      addonsResponse,
      labelsResponse,
      scopeResponse,
    );
  }

  // SLOW PATH: RBAC hook didn't set user - fetch both in parallel
  log.warn({ pathname: url.pathname }, '🐢 SLOW PATH: No RBAC user, fetching /users/me + /counts');
  return await loadUserWithFetch(cookies, fetch, headers, startTime, url.pathname);
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
    addonsResponse,
    labelsResponse,
    scopeResponse,
  } = await fetchUserCountsThemeAddonsAndLabels(fetchFn, headers);
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
    `🐢 SLOW PATH complete: /users/me + /counts + /theme + /addons + /labels fetched (${fetchTime}ms, total: ${totalTime}ms)`,
  );

  return await buildAuthenticatedResponse(
    userData,
    countsResponse,
    themeResponse,
    addonsResponse,
    labelsResponse,
    scopeResponse,
  );
}
