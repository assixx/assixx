/**
 * Manage Departments - Server-Side Data Loading
 * @module manage-departments/+page.server
 *
 * SSR: Loads departments + areas + potential leads in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { Department, Area, AdminUser } from './_lib/types';

const log = createLogger('ManageDepartments');

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
      log.error({ status: response.status, endpoint }, 'API error');
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
  } catch (err: unknown) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
}

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Parallel fetch: departments + areas + leader candidates (admin/root with position=Abteilungsleiter)
  const [departmentsData, areasData, adminsData, rootsData] = await Promise.all(
    [
      apiFetch<Department[]>('/departments', token, fetch),
      apiFetch<Area[]>('/areas', token, fetch),
      apiFetch<AdminUser[]>(
        '/users?role=admin&isActive=1&position=department_lead',
        token,
        fetch,
      ),
      apiFetch<AdminUser[]>(
        '/users?role=root&isActive=1&position=department_lead',
        token,
        fetch,
      ),
    ],
  );

  const departments = Array.isArray(departmentsData) ? departmentsData : [];
  const areas = Array.isArray(areasData) ? areasData : [];
  const admins = Array.isArray(adminsData) ? adminsData : [];
  const roots = Array.isArray(rootsData) ? rootsData : [];
  const departmentLeads = [...admins, ...roots];

  return {
    departments,
    areas,
    departmentLeads,
  };
};
