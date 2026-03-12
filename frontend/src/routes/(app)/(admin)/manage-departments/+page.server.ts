/**
 * Manage Departments - Server-Side Data Loading
 * @module manage-departments/+page.server
 *
 * SSR: Loads departments + areas + potential leads in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';

import type { PageServerLoad } from './$types';
import type { Department, Area, AdminUser } from './_lib/types';

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
