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
import type { LayoutServerLoad } from './$types';

/** API base URL for server-side fetching */
const API_BASE = process.env['API_URL'] ?? 'http://localhost:3000/api/v2';

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

/**
 * Layout server load function
 *
 * RUNS ONCE per navigation - data is shared with ALL child pages.
 * Child pages can access via `data.user` or `await parent()` in their load functions.
 */
export const load: LayoutServerLoad = async ({ cookies, fetch, url }) => {
  const startTime = performance.now();

  // 1. Get auth token from httpOnly cookie
  const token = cookies.get('accessToken');

  // 2. Skip auth for public routes (login, signup, etc.)
  const publicPaths = ['/login', '/signup', '/tenant-deletion-approve'];
  const isPublicPath = publicPaths.some((path) => url.pathname.startsWith(path));

  if (!token && !isPublicPath) {
    // No token and not a public page - redirect to login
    console.info('[SSR Layout] No accessToken cookie, redirecting to login');
    redirect(302, '/login');
  }

  // 3. If no token (public page), return minimal data
  if (!token) {
    return {
      user: null,
      tenant: null,
      isAuthenticated: false,
    };
  }

  // 4. Fetch user data from API
  try {
    const response = await fetch(`${API_BASE}/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Token invalid or expired - redirect to login
      console.warn('[SSR Layout] /users/me failed with status', response.status);

      // Clear invalid cookie
      cookies.delete('accessToken', { path: '/' });
      cookies.delete('refreshToken', { path: '/' });

      redirect(302, '/login');
    }

    const json = (await response.json()) as ApiResponse<UserData & { tenant?: TenantData }>;

    // Handle wrapped response
    const userData = 'success' in json && json.success ? json.data : (json as unknown as UserData);

    if (!userData) {
      console.error('[SSR Layout] No user data in response');
      redirect(302, '/login');
    }

    const duration = (performance.now() - startTime).toFixed(1);
    console.info(`[SSR Layout] User loaded in ${duration}ms: ${userData.email}`);

    // 5. Return user and tenant data for all child pages
    return {
      user: {
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        employeeNumber: userData.employeeNumber,
        profilePicture: userData.profilePicture,
        position: userData.position,
        tenantId: userData.tenantId,
        // Team assignment fields (inherited from primary team)
        teamIds: userData.teamIds,
        teamNames: userData.teamNames,
        teamDepartmentId: userData.teamDepartmentId,
        teamDepartmentName: userData.teamDepartmentName,
        teamAreaId: userData.teamAreaId,
        teamAreaName: userData.teamAreaName,
      },
      tenant: userData.tenant ?? null,
      isAuthenticated: true,
    };
  } catch (error) {
    console.error('[SSR Layout] Error loading user:', error);

    // On error, redirect to login
    redirect(302, '/login');
  }
};
