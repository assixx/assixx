/**
 * Manage Areas - Server-Side Data Loading
 * @module manage-areas/+page.server
 *
 * SSR: Loads areas + departments + potential leads in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';

import type { PageServerLoad } from './$types';
import type { Area, Department, Hall, AdminUser } from './_lib/types';

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Parallel fetch: areas + departments + halls + leader candidates (admin/root with position=Bereichsleiter)
  const [areasData, departmentsData, hallsData, adminsData, rootsData] =
    await Promise.all([
      apiFetch<Area[]>('/areas', token, fetch),
      apiFetch<Department[]>('/departments', token, fetch),
      apiFetch<Hall[]>('/halls', token, fetch),
      apiFetch<AdminUser[]>(
        '/users?role=admin&isActive=1&position=area_lead',
        token,
        fetch,
      ),
      apiFetch<AdminUser[]>(
        '/users?role=root&isActive=1&position=area_lead',
        token,
        fetch,
      ),
    ]);

  const areas = Array.isArray(areasData) ? areasData : [];
  const departments = Array.isArray(departmentsData) ? departmentsData : [];
  const halls = Array.isArray(hallsData) ? hallsData : [];
  const admins = Array.isArray(adminsData) ? adminsData : [];
  const roots = Array.isArray(rootsData) ? rootsData : [];
  const areaLeads = [...admins, ...roots];

  return {
    areas,
    departments,
    halls,
    areaLeads,
  };
};
