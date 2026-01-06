/**
 * Account Settings - Server-Side Data Loading
 * @module account-settings/+page.server
 *
 * SSR: Loads deletion status for the current tenant.
 */
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { DeletionStatusData } from './_lib/types';

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
      // 404 means no pending deletion
      if (response.status === 404) return null;
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

  // Get user from parent layout - only root can access
  const parentData = await parent();
  if (parentData.user?.role !== 'root') {
    redirect(302, '/dashboard');
  }

  // Load pending deletion status
  const deletionStatus = await apiFetch<DeletionStatusData>(
    '/tenant-deletion/status',
    token,
    fetch,
  );

  const duration = (performance.now() - startTime).toFixed(1);
  console.info(`[SSR] account-settings loaded in ${duration}ms`);

  return {
    pendingDeletion: deletionStatus,
  };
};
