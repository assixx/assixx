/**
 * Manage Areas - Server-Side Data Loading (Scope-Filtered)
 * @module manage-areas/+page.server
 *
 * SSR: Loads areas + departments + potential leads in parallel.
 * Access: Root (all) | Admin (scoped) — NO Employee access (D1=NEIN)
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { assertAdminLevelAccess } from '$lib/server/manage-page-access';
import { buildLoginUrl } from '$lib/utils/build-apex-url';

import type { PageServerLoad } from './$types';
import type { Area, Department, Hall, AdminUser } from './_lib/types';

export const load: PageServerLoad = async ({ cookies, fetch, parent, url }) => {
  const { user, orgScope } = await parent();
  assertAdminLevelAccess(orgScope, {
    role: user?.role,
    pathname: url.pathname,
  });

  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, buildLoginUrl('session-expired', undefined, url));
  }

  // Permission check: first fetch detects 403 (ADR-020 pattern)
  const areasResult = await apiFetchWithPermission<Area[]>('/areas', token, fetch);
  if (areasResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      areas: [] as Area[],
      departments: [] as Department[],
      halls: [] as Hall[],
      areaLeads: [] as AdminUser[],
    };
  }

  // Parallel fetch remaining data (permission confirmed)
  const [departmentsData, hallsData, adminsData, rootsData] = await Promise.all([
    apiFetch<Department[]>('/departments', token, fetch),
    apiFetch<Hall[]>('/halls', token, fetch),
    apiFetch<AdminUser[]>('/users?role=admin&isActive=1&position=area_lead', token, fetch),
    apiFetch<AdminUser[]>('/users?role=root&isActive=1&position=area_lead', token, fetch),
  ]);

  const areas = Array.isArray(areasResult.data) ? areasResult.data : [];
  const departments = Array.isArray(departmentsData) ? departmentsData : [];
  const halls = Array.isArray(hallsData) ? hallsData : [];
  const admins = Array.isArray(adminsData) ? adminsData : [];
  const roots = Array.isArray(rootsData) ? rootsData : [];
  const areaLeads = [...admins, ...roots];

  return {
    permissionDenied: false as const,
    areas,
    departments,
    halls,
    areaLeads,
  };
};
