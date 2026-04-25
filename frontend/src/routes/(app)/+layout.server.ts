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
import { buildLoginUrl } from '$lib/utils/build-apex-url';
import { createLogger } from '$lib/utils/logger';

import type { HierarchyLabels } from '$lib/types/hierarchy-labels';
import type { OrganizationalScope } from '$lib/types/organizational-scope';
import type { LayoutServerLoad } from './$types';

const log = createLogger('AppLayout');

/** User data from /users/me endpoint */
interface UserData {
  id: number;
  uuid: string;
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
    uuid: userData.uuid,
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

/**
 * Parse `allow_user_password_change` policy from the security-settings API.
 *
 * Fallback on error = `false` (locked). Rationale: a transient 5xx should not
 * suddenly expose the password-change UI to users whose Root admin locked it.
 * "Fail closed" matches the DB-side default. See ADR-045 Layer-1 gate and
 * user-request 2026-04-20.
 */
async function parseAllowUserPasswordChange(response: Response | null): Promise<boolean> {
  if (response?.ok !== true) return false;
  try {
    const json = (await response.json()) as ApiResponse<{ allowed: boolean }>;
    return json.data?.allowed === true;
  } catch {
    return false;
  }
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

/**
 * Fetch rootCount only when the caller is a root user.
 *
 * Powers the SingleRootWarningBanner in +layout.svelte: if the tenant has
 * exactly one root, the banner urges the user to create a second one
 * (credential-loss guard). For admins/employees we short-circuit with 0 so
 * the banner is never rendered and no /root/* call is made for them.
 *
 * Reuses /root/dashboard (already optimized) rather than introducing a
 * dedicated endpoint — cheap since the backend RBAC guard still blocks
 * non-root callers at the /root/* path anyway.
 */
async function fetchRootCount(
  role: string,
  fetchFn: typeof fetch,
  headers: Record<string, string>,
): Promise<number> {
  if (role !== 'root') return 0;
  try {
    const response = await fetchFn(`${API_BASE}/root/dashboard`, { headers });
    if (!response.ok) return 0;
    const json = (await response.json()) as ApiResponse<{ rootCount?: number }>;
    return json.data?.rootCount ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Fetch tenant verification status (root + admin only — masterplan §5.3 + §0.2.5 #16).
 *
 * Powers the UnverifiedDomainBanner in +layout.svelte and the user-creation
 * form `disabled` guards. When the call fails (network, 5xx) we fall back
 * to `true` (verified) — we'd rather show no banner on a transient outage
 * than scare the user with a "your tenant is unverified" message that may
 * be wrong. The backend's `assertVerified()` gate is the authoritative
 * source: if a non-verified tenant somehow gets `true` here, the very next
 * user-creation attempt still 403s, so this is a UX fallback only.
 *
 * Employees never need this flag (no user-creation UI surfaced to them) —
 * short-circuit with `true` to skip the network call entirely.
 *
 * @see masterplan §5.3 (banner + form guards), §2.7 (endpoint), §0.2.5 #16 (Root+Admin readable)
 */
async function fetchTenantVerified(
  role: string,
  fetchFn: typeof fetch,
  headers: Record<string, string>,
): Promise<boolean> {
  if (role !== 'root' && role !== 'admin') return true;
  try {
    const response = await fetchFn(`${API_BASE}/domains/verification-status`, { headers });
    if (!response.ok) return true;
    const json = (await response.json()) as ApiResponse<{ verified: boolean }>;
    return json.data?.verified ?? true;
  } catch {
    return true;
  }
}

/**
 * Clear auth cookies and redirect to apex login (ADR-050 Amendment 2026-04-22).
 *
 * Fires only when an existing session is being terminated (cookies are about
 * to be deleted) — `session-expired` is the correct semantic. The `url`
 * parameter is the SvelteKit `event.url`, used by `buildLoginUrl` as the SSR
 * fallback when `PUBLIC_APP_URL` is not injected (dev-without-Doppler), so
 * a redirect from `<slug>.localhost:5173` lands on `localhost:5173` instead
 * of the prod hardcoded default.
 */
function clearAuthAndRedirect(
  cookies: Parameters<LayoutServerLoad>[0]['cookies'],
  url: URL,
): never {
  cookies.delete('accessToken', { path: '/' });
  cookies.delete('refreshToken', { path: '/api/v2/auth' });
  redirect(302, buildLoginUrl('session-expired', undefined, url));
}

/**
 * Cookie name for the Single-Root-Warning-Banner dismiss flag.
 *
 * WHY cookie (not sessionStorage, see commit 2026-04-22):
 * sessionStorage is only readable on the client, so SSR always rendered the
 * banner and hydration flipped it off — producing a visible "flash" on every
 * page load for users who had dismissed it. Routing the dismiss state through
 * a cookie lets the server decide *before* rendering whether to emit the
 * banner at all. No HTML flash, no hydration mismatch, no Vite-dev-mode-
 * specific 1s delay after OAuth-Login.
 *
 * NOT HttpOnly: the component must write it from the close-button handler.
 * Value is a boolean UI flag, no secret — XSS surface is irrelevant.
 */
const SINGLE_ROOT_BANNER_DISMISS_COOKIE = 'assixx_single_root_banner_dismissed';

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
  activeRole: null as string | null,
  // Drives SingleRootWarningBanner. 0 for unauthenticated/non-root users —
  // banner only renders when rootCount === 1 (see +layout.svelte).
  rootCount: 0,
  // Drives UnverifiedDomainBanner + user-creation-form guards. Default `true`
  // for unauthenticated paths: the banner only renders when `false` AND user
  // is root/admin, neither condition is met here (see +layout.svelte §5.3).
  tenantVerified: true,
  // Drives the password-change UI in admin/employee-profile.
  // Default `false` on unauthenticated paths — the login page never shows
  // profile forms anyway, so the exact value is irrelevant; `false` matches
  // the server-side default and the fail-closed semantics of the parser.
  allowUserPasswordChange: false,
  // Drives SingleRootWarningBanner visibility. Default `false` on
  // unauthenticated paths — banner is gated by authentication anyway.
  singleRootBannerDismissed: false,
} as const;

/** Build authenticated response from user data, counts, theme, addons, and labels */
async function buildAuthenticatedResponse(
  userData: UserData,
  countsResponse: Response | null,
  themeResponse: Response | null,
  addonsResponse: Response | null,
  labelsResponse: Response | null,
  scopeResponse: Response | null,
  passwordPolicyResponse: Response | null,
  activeRole: string | null,
  rootCount: number,
  tenantVerified: boolean,
  singleRootBannerDismissed: boolean,
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
    activeRole,
    rootCount,
    tenantVerified,
    // Tenant-wide policy: when `false`, admin/employee-profile hide the
    // password-change card. Root bypasses the gate in the backend + UI.
    // See ADR-045 + user-request 2026-04-20.
    allowUserPasswordChange: await parseAllowUserPasswordChange(passwordPolicyResponse),
    // Server-read dismiss flag for the Single-Root-Warning-Banner — see
    // SINGLE_ROOT_BANNER_DISMISS_COOKIE comment. When `true`, the banner
    // is never emitted into the SSR HTML → no flash on hydration.
    singleRootBannerDismissed,
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
  passwordPolicyResponse: Response | null;
}> {
  const [
    countsResponse,
    themeResponse,
    addonsResponse,
    labelsResponse,
    scopeResponse,
    passwordPolicyResponse,
  ] = await Promise.all([
    fetchFn(`${API_BASE}/dashboard/counts`, { headers }).catch(() => null),
    fetchFn(`${API_BASE}/settings/user/theme`, { headers }).catch(() => null),
    fetchFn(`${API_BASE}/addons/my-addons`, { headers }).catch(() => null),
    fetchFn(`${API_BASE}/organigram/hierarchy-labels`, { headers }).catch(() => null),
    fetchFn(`${API_BASE}/users/me/org-scope`, { headers }).catch(() => null),
    // Security policy — fetched in the same parallel batch so it does not
    // add a waterfall step on every navigation.
    fetchFn(`${API_BASE}/security-settings/user-password-change-policy`, { headers }).catch(
      () => null,
    ),
  ]);
  return {
    countsResponse,
    themeResponse,
    addonsResponse,
    labelsResponse,
    scopeResponse,
    passwordPolicyResponse,
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
  passwordPolicyResponse: Response | null;
}> {
  const [
    userResponse,
    countsResponse,
    themeResponse,
    addonsResponse,
    labelsResponse,
    scopeResponse,
    passwordPolicyResponse,
  ] = await Promise.all([
    fetchFn(`${API_BASE}/users/me`, { headers }),
    fetchFn(`${API_BASE}/dashboard/counts`, { headers }).catch(() => null),
    fetchFn(`${API_BASE}/settings/user/theme`, { headers }).catch(() => null),
    fetchFn(`${API_BASE}/addons/my-addons`, { headers }).catch(() => null),
    fetchFn(`${API_BASE}/organigram/hierarchy-labels`, { headers }).catch(() => null),
    fetchFn(`${API_BASE}/users/me/org-scope`, { headers }).catch(() => null),
    fetchFn(`${API_BASE}/security-settings/user-password-change-policy`, { headers }).catch(
      () => null,
    ),
  ]);
  return {
    userResponse,
    countsResponse,
    themeResponse,
    addonsResponse,
    labelsResponse,
    scopeResponse,
    passwordPolicyResponse,
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
    // ADR-050 Amendment 2026-04-22: cross-origin redirect to apex login.
    // Defense-in-depth — hooks.server.ts:authHandle already redirects when
    // the token is missing for a non-public path. When this fires, we don't
    // know whether the user had a session that just died or never logged in,
    // so use a neutral entry (no toast).
    redirect(302, buildLoginUrl(undefined, undefined, url));
  }

  if (!hasToken) {
    return UNAUTHENTICATED_RESPONSE;
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Read activeRole cookie for SSR banner rendering (non-sensitive UI state)
  const activeRole = cookies.get('activeRole') ?? null;

  // SSR-read the Single-Root-Warning-Banner dismiss flag. Used by the layout
  // gate to suppress the banner entirely on the server side when the user
  // dismissed it — no more 1-second Vite-hydration flash (see commit 2026-04-22).
  const singleRootBannerDismissed = cookies.get(SINGLE_ROOT_BANNER_DISMISS_COOKIE) === '1';

  // Check if RBAC hook already fetched user data (saves ~50-80ms!)
  const rbacUser = locals.user as UserData | undefined;

  if (rbacUser !== undefined) {
    return await loadFastPath(
      rbacUser,
      fetch,
      headers,
      startTime,
      url.pathname,
      activeRole,
      singleRootBannerDismissed,
    );
  }

  // SLOW PATH: RBAC hook didn't set user - fetch both in parallel
  log.warn({ pathname: url.pathname }, '🐢 SLOW PATH: No RBAC user, fetching /users/me + /counts');
  return await loadUserWithFetch(
    cookies,
    fetch,
    headers,
    startTime,
    url,
    activeRole,
    singleRootBannerDismissed,
  );
};

/**
 * FAST PATH: Reuse user from RBAC hook - fetch counts, theme, addons + labels
 * in parallel. rootCount + tenantVerified are role-gated (rootCount is
 * root-only, tenantVerified is root+admin per masterplan §0.2.5 #16) and
 * run in the same Promise.all.
 *
 * Extracted from `load()` to keep that handler under the 60-line limit after
 * the singleRootBannerDismissed cookie was added (commit 2026-04-22).
 */
async function loadFastPath(
  rbacUser: UserData,
  fetchFn: typeof fetch,
  headers: Record<string, string>,
  startTime: number,
  pathname: string,
  activeRole: string | null,
  singleRootBannerDismissed: boolean,
) {
  const fetchStart = performance.now();
  const [
    {
      countsResponse,
      themeResponse,
      addonsResponse,
      labelsResponse,
      scopeResponse,
      passwordPolicyResponse,
    },
    rootCount,
    tenantVerified,
  ] = await Promise.all([
    fetchCountsThemeAddonsAndLabels(fetchFn, headers),
    fetchRootCount(rbacUser.role, fetchFn, headers),
    fetchTenantVerified(rbacUser.role, fetchFn, headers),
  ]);
  const fetchTime = Math.round(performance.now() - fetchStart);
  const totalTime = Math.round(performance.now() - startTime);

  log.debug(
    { userId: rbacUser.id, fetchTime, totalTime, path: pathname },
    `⚡ FAST PATH: RBAC user reused, /counts + /theme + /addons + /labels + /verification-status fetched in parallel (${fetchTime}ms, total: ${totalTime}ms)`,
  );

  return await buildAuthenticatedResponse(
    rbacUser,
    countsResponse,
    themeResponse,
    addonsResponse,
    labelsResponse,
    scopeResponse,
    passwordPolicyResponse,
    activeRole,
    rootCount,
    tenantVerified,
    singleRootBannerDismissed,
  );
}

/**
 * Load user via API fetch (slow path when RBAC user not available).
 *
 * `url` is plumbed through so `clearAuthAndRedirect` and the malformed-JSON
 * fallback below can produce ADR-050-compliant apex redirects with the
 * dev-without-Doppler SSR fallback wired correctly.
 */
async function loadUserWithFetch(
  cookies: Parameters<LayoutServerLoad>[0]['cookies'],
  fetchFn: typeof fetch,
  headers: Record<string, string>,
  startTime: number,
  url: URL,
  activeRole: string | null,
  singleRootBannerDismissed: boolean,
) {
  const fetchStart = performance.now();
  const {
    userResponse,
    countsResponse,
    themeResponse,
    addonsResponse,
    labelsResponse,
    scopeResponse,
    passwordPolicyResponse,
  } = await fetchUserCountsThemeAddonsAndLabels(fetchFn, headers);
  const fetchTime = Math.round(performance.now() - fetchStart);

  if (!userResponse.ok) {
    log.warn({ status: userResponse.status }, '/users/me failed');
    clearAuthAndRedirect(cookies, url);
  }

  const userJson = (await userResponse.json()) as ApiResponse<UserData>;
  const userData = extractUserData(userJson);

  if (userData === undefined) {
    log.error('No user data in response');
    // ADR-050 Amendment 2026-04-22: cross-origin redirect to apex login.
    // /users/me succeeded but returned malformed JSON — treat as auth corruption.
    redirect(302, buildLoginUrl('session-expired', undefined, url));
  }

  // Fetch rootCount + tenantVerified AFTER user data arrives — both are
  // role-gated, and the role isn't known until /users/me resolves. Run them
  // in parallel since they hit different endpoints.
  const [rootCount, tenantVerified] = await Promise.all([
    fetchRootCount(userData.role, fetchFn, headers),
    fetchTenantVerified(userData.role, fetchFn, headers),
  ]);

  const totalTime = Math.round(performance.now() - startTime);
  log.debug(
    { fetchTime, totalTime, path: url.pathname },
    `🐢 SLOW PATH complete: /users/me + /counts + /theme + /addons + /labels + /verification-status fetched (${fetchTime}ms, total: ${totalTime}ms)`,
  );

  return await buildAuthenticatedResponse(
    userData,
    countsResponse,
    themeResponse,
    addonsResponse,
    labelsResponse,
    scopeResponse,
    passwordPolicyResponse,
    activeRole,
    rootCount,
    tenantVerified,
    singleRootBannerDismissed,
  );
}
