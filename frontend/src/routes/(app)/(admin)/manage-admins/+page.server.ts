/**
 * Manage Admins - Server-Side Data Loading
 * @module manage-admins/+page.server
 *
 * SSR: Loads admins + areas + departments in parallel,
 * then enriches each admin with their permissions.
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { Admin, AdminPermissions, Area, Department } from './_lib/types';

const log = createLogger('ManageAdmins');

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
  } catch (err) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
}

/**
 * Load permissions for a single admin and return new admin object with permissions
 * Returns a NEW object to avoid ESLint require-atomic-updates warnings
 */
async function loadAdminPermissions(
  admin: Admin,
  token: string,
  fetchFn: typeof fetch,
): Promise<Admin> {
  const permsData = await apiFetch<AdminPermissions>(
    `/admin-permissions/${admin.id}`,
    token,
    fetchFn,
  );

  // Return new object with permissions merged (avoids mutation)
  return {
    ...admin,
    areas: permsData?.areas ?? [],
    departments: permsData?.departments ?? [],
    hasFullAccess: permsData?.hasFullAccess ?? false,
  };
}

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Parallel fetch: admins + areas + departments
  const [adminsData, areasData, departmentsData] = await Promise.all([
    apiFetch<Admin[]>('/users?role=admin', token, fetch),
    apiFetch<Area[]>('/areas', token, fetch),
    apiFetch<Department[]>('/departments', token, fetch),
  ]);

  const rawAdmins = Array.isArray(adminsData) ? adminsData : [];
  const areas = Array.isArray(areasData) ? areasData : [];
  const departments = Array.isArray(departmentsData) ? departmentsData : [];

  // Load permissions for each admin in parallel
  const admins = await Promise.all(
    rawAdmins.map((admin) => loadAdminPermissions(admin, token, fetch)),
  );

  return {
    admins,
    areas,
    departments,
  };
};
