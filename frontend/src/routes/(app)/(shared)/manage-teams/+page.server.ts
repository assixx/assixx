/**
 * Manage Teams - Server-Side Data Loading (Scope-Filtered)
 * @module manage-teams/+page.server
 *
 * SSR: Loads teams + reference data (departments, leader candidates, employees, assets) in parallel.
 * Access: Root (all) | Admin (scoped) | Employee Team-Lead (own teams)
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { assertTeamLevelAccess } from '$lib/server/manage-page-access';

import type { PageServerLoad } from './$types';
import type { Team, Department, Admin, TeamMember, Asset, Hall } from './_lib/types';

function toArray<T>(data: T | null): T extends readonly (infer U)[] ? U[] : T[] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any -- generic array normalization
  return (Array.isArray(data) ? data : []) as any;
}

export const load: PageServerLoad = async ({ cookies, fetch, parent, url }) => {
  const { user, orgScope } = await parent();
  assertTeamLevelAccess(orgScope, { role: user?.role, pathname: url.pathname });

  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Permission check: first fetch detects 403 (ADR-020 pattern)
  const teamsResult = await apiFetchWithPermission<Team[]>('/teams', token, fetch);
  if (teamsResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      teams: [] as Team[],
      departments: [] as Department[],
      leaders: [] as Admin[],
      employees: [] as TeamMember[],
      assets: [] as Asset[],
      halls: [] as Hall[],
    };
  }

  // Parallel fetch remaining data (permission confirmed)
  const [departmentsData, leaderCandidatesData, employeesData, assetsData, hallsData] =
    await Promise.all([
      apiFetch<Department[]>('/departments', token, fetch),
      apiFetch<Admin[]>('/users?isActive=1&position=team_lead', token, fetch),
      apiFetch<TeamMember[]>('/users?role=employee', token, fetch),
      apiFetch<Asset[]>('/assets', token, fetch),
      apiFetch<Hall[]>('/halls', token, fetch),
    ]);

  return {
    permissionDenied: false as const,
    teams: toArray(teamsResult.data),
    departments: toArray(departmentsData),
    leaders: toArray(leaderCandidatesData),
    employees: toArray(employeesData),
    assets: toArray(assetsData),
    halls: toArray(hallsData),
  };
};
