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

/** Extract permission fields with safe defaults */
function extractPermissions(
  raw: AdminPermissions | null | undefined,
): Pick<Admin, 'areas' | 'departments' | 'leadAreas' | 'leadDepartments' | 'hasFullAccess'> {
  const p = raw ?? {};
  return {
    areas: p.areas ?? [],
    departments: p.departments ?? [],
    leadAreas: p.leadAreas ?? [],
    leadDepartments: p.leadDepartments ?? [],
    hasFullAccess: p.hasFullAccess ?? false,
  };
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

  return { ...admin, ...extractPermissions(permsData) };
}

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Parallel fetch: admins + areas + departments + positions
  const [adminsData, areasData, departmentsData, positionsData] = await Promise.all([
    apiFetch<Admin[]>('/users?role=admin', token, fetch),
    apiFetch<Area[]>('/areas', token, fetch),
    apiFetch<Department[]>('/departments', token, fetch),
    apiFetch<{ name: string; roleCategory: string }[]>('/organigram/positions', token, fetch),
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
    positionOptions:
      Array.isArray(positionsData) ?
        positionsData
          .filter((p: { roleCategory: string }) => p.roleCategory !== 'root')
          .map((p: { name: string; roleCategory: string }) => ({
            name: p.name,
            roleCategory: p.roleCategory,
          }))
      : [],
  };
};
