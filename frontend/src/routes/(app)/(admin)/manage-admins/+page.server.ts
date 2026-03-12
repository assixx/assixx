/**
 * Manage Admins - Server-Side Data Loading
 * @module manage-admins/+page.server
 *
 * SSR: Loads admins + areas + departments in parallel,
 * then enriches each admin with their permissions.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';

import type { PageServerLoad } from './$types';
import type { Admin, AdminPermissions, Area, Department } from './_lib/types';

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

  // Parallel fetch: admins + areas + departments + position options
  const [adminsData, areasData, departmentsData, posOptData] =
    await Promise.all([
      apiFetch<Admin[]>('/users?role=admin', token, fetch),
      apiFetch<Area[]>('/areas', token, fetch),
      apiFetch<Department[]>('/departments', token, fetch),
      apiFetch<{ admin: string[] }>(
        '/organigram/position-options',
        token,
        fetch,
      ),
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
    positionOptions: posOptData?.admin ?? [],
  };
};
