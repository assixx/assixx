/**
 * Manage Admins - Server-Side Data Loading
 * @module manage-admins/+page.server
 *
 * SSR: Loads admins + areas + departments in parallel.
 */
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Admin, Area, Department } from './_lib/types';

const API_BASE = process.env['API_URL'] ?? 'http://localhost:3000/api/v2';

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

  // Parallel fetch: admins + areas + departments
  const [adminsData, areasData, departmentsData] = await Promise.all([
    apiFetch<Admin[]>('/users?role=admin', token, fetch),
    apiFetch<Area[]>('/areas', token, fetch),
    apiFetch<Department[]>('/departments', token, fetch),
  ]);

  const admins = Array.isArray(adminsData) ? adminsData : [];
  const areas = Array.isArray(areasData) ? areasData : [];
  const departments = Array.isArray(departmentsData) ? departmentsData : [];

  const duration = (performance.now() - startTime).toFixed(1);
  console.info(`[SSR] manage-admins loaded in ${duration}ms (3 parallel API calls)`);

  return {
    admins,
    areas,
    departments,
  };
};
