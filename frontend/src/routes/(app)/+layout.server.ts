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

/**
 * Layout server load function
 *
 * RUNS ONCE per navigation - data is shared with ALL child pages.
 * Child pages can access via `data.user` or `await parent()` in their load functions.
 */
export const load: LayoutServerLoad = async ({ cookies, fetch, url }) => {
  const token = cookies.get('accessToken');
  const hasToken = token !== undefined && token !== '';

  // Handle unauthenticated requests
  if (!hasToken && !isPublicPath(url.pathname)) {
    redirect(302, '/login');
  }

  if (!hasToken) {
    return { user: null, tenant: null, isAuthenticated: false };
  }

  // Fetch user data from API
  try {
    const response = await fetch(`${API_BASE}/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      log.warn({ status: response.status }, '/users/me failed');
      cookies.delete('accessToken', { path: '/' });
      // refreshToken has path '/api/v2/auth' - must match to delete
      cookies.delete('refreshToken', { path: '/api/v2/auth' });
      redirect(302, '/login');
    }

    const json = (await response.json()) as ApiResponse<UserData>;
    const userData = extractUserData(json);

    if (userData === undefined) {
      log.error('No user data in response');
      redirect(302, '/login');
    }

    return {
      user: mapUserData(userData),
      tenant: userData.tenant ?? null,
      isAuthenticated: true,
    };
  } catch (err) {
    log.error({ err }, 'Error loading user');
    redirect(302, '/login');
  }
};
