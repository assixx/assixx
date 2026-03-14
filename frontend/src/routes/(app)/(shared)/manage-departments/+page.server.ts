/**
 * Manage Departments - Server-Side Data Loading (Scope-Filtered)
 * @module manage-departments/+page.server
 *
 * SSR: Loads departments + areas + potential leads in parallel.
 * Access: Root (all) | Admin (scoped) — NO Employee access (D1=NEIN)
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { assertAdminLevelAccess } from '$lib/server/manage-page-access';

import type { PageServerLoad } from './$types';
import type { Department, Area, AdminUser } from './_lib/types';

export const load: PageServerLoad = async ({ cookies, fetch, parent, url }) => {
  const { user, orgScope } = await parent();
  assertAdminLevelAccess(orgScope, {
    role: user?.role,
    pathname: url.pathname,
  });

  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Permission check: first fetch detects 403 (ADR-020 pattern)
  const departmentsResult = await apiFetchWithPermission<Department[]>(
    '/departments',
    token,
    fetch,
  );
  if (departmentsResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      departments: [] as Department[],
      areas: [] as Area[],
      departmentLeads: [] as AdminUser[],
    };
  }

  // Parallel fetch remaining data (permission confirmed)
  const [areasData, adminsData, rootsData] = await Promise.all([
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
  ]);

  const departments =
    Array.isArray(departmentsResult.data) ? departmentsResult.data : [];
  const areas = Array.isArray(areasData) ? areasData : [];
  const admins = Array.isArray(adminsData) ? adminsData : [];
  const roots = Array.isArray(rootsData) ? rootsData : [];
  const departmentLeads = [...admins, ...roots];

  return {
    permissionDenied: false as const,
    departments,
    areas,
    departmentLeads,
  };
};
