/**
 * Employee Profile - Server-Side Data Loading
 * @module employee-profile/+page.server
 *
 * SSR: Loads employee user profile data.
 * Note: Employee profile is readonly except for password.
 * Access: employee role (or admin/root viewing as employee)
 */
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { EmployeeProfile } from './_lib/types';

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

async function apiFetch<T>(
  endpoint: string,
  token: string,
  fetchFn: typeof fetch,
): Promise<T | null> {
  try {
    const response = await fetchFn(`${API_BASE}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[SSR] API error ${response.status} for ${endpoint}`);
      return null;
    }

    const json = (await response.json()) as ApiResponse<T>;
    if ('success' in json && json.success === true) {
      return json.data ?? null;
    }
    if ('data' in json && json.data !== undefined) {
      return json.data;
    }
    return json as unknown as T;
  } catch (error) {
    console.error(`[SSR] Fetch error for ${endpoint}:`, error);
    return null;
  }
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const startTime = performance.now();

  const token = cookies.get('accessToken');
  if (!token) {
    redirect(302, '/login');
  }

  // Get user from parent layout
  // Allow: employee, admin, root (admin/root can view as employee via role switch)
  const parentData = await parent();
  const allowedRoles = ['employee', 'admin', 'root'];
  if (!parentData.user || !allowedRoles.includes(parentData.user.role)) {
    redirect(302, '/login');
  }

  // Fetch employee profile data
  const profileData = await apiFetch<EmployeeProfile>('/users/me', token, fetch);

  const duration = (performance.now() - startTime).toFixed(1);
  console.info(`[SSR] employee-profile loaded in ${duration}ms`);

  return {
    profile: profileData,
  };
};
