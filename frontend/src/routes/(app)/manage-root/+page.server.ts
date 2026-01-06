/**
 * Manage Root Users - Server-Side Data Loading
 * @module manage-root/+page.server
 *
 * SSR: Loads root users for management.
 */
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { RootUser } from './_lib/types';

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

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const startTime = performance.now();

  const token = cookies.get('accessToken');
  if (!token) {
    redirect(302, '/login');
  }

  // Fetch root users
  const rootUsersData = await apiFetch<RootUser[]>('/users?role=root', token, fetch);
  const rootUsers = Array.isArray(rootUsersData) ? rootUsersData : [];

  const duration = (performance.now() - startTime).toFixed(1);
  console.info(`[SSR] manage-root loaded in ${duration}ms (1 API call)`);

  return {
    rootUsers,
  };
};
