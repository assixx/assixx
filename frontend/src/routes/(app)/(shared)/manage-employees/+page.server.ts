/**
 * Manage Employees - Server-Side Data Loading (Scope-Filtered)
 * @module manage-employees/+page.server
 *
 * SSR: Loads employees + teams in parallel for instant page render.
 * Access: Root (all) | Admin (scoped) | Employee Team-Lead (own team members)
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { assertTeamLevelAccess } from '$lib/server/manage-page-access';

import type { PageServerLoad } from './$types';
import type { Employee, Team } from './_lib/types';

export const load: PageServerLoad = async ({ cookies, fetch, parent, url }) => {
  const { user, orgScope } = await parent();
  assertTeamLevelAccess(orgScope, { role: user?.role, pathname: url.pathname });

  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Permission check: first fetch detects 403 (ADR-020 pattern)
  const empResult = await apiFetchWithPermission<Employee[]>('/users?role=employee', token, fetch);
  if (empResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      employees: [] as Employee[],
      teams: [] as Team[],
      positionOptions: [] as string[],
    };
  }

  // Parallel fetch remaining data (permission confirmed)
  const [teamsData, positionsData] = await Promise.all([
    apiFetch<Team[]>('/teams', token, fetch),
    apiFetch<{ name: string; roleCategory: string }[]>(
      '/organigram/positions?roleCategory=employee',
      token,
      fetch,
    ),
  ]);

  const employees =
    Array.isArray(empResult.data) ?
      empResult.data.filter((u: Employee) => u.role === 'employee')
    : [];

  return {
    permissionDenied: false as const,
    employees,
    teams: Array.isArray(teamsData) ? teamsData : [],
    positionOptions:
      Array.isArray(positionsData) ? positionsData.map((p: { name: string }) => p.name) : [],
  };
};
