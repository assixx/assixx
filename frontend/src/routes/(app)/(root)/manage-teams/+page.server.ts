/**
 * Manage Teams - Server-Side Data Loading (ROOT ONLY)
 * @module manage-teams/+page.server
 *
 * SSR: Loads teams + reference data (departments, leader candidates, employees, assets) in parallel.
 * Team leaders can be any active user (root, admin, employee) — leadership is organizational, not a system role.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { Team, Department, Admin, TeamMember, Asset } from './_lib/types';

const log = createLogger('ManageTeams');

function toArray<T>(
  data: T | null,
): T extends readonly (infer U)[] ? U[] : T[] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any -- generic array normalization
  return (Array.isArray(data) ? data : []) as any;
}

export const load: PageServerLoad = async ({ cookies, fetch, parent, url }) => {
  const { user } = await parent();

  if (user?.role !== 'root') {
    log.warn(
      { pathname: url.pathname, userRole: user?.role },
      'RBAC(manage-teams): Root-only page, access denied',
    );
    redirect(302, '/permission-denied');
  }

  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Parallel fetch: all active users as leader candidates (any role can lead a team)
  const [
    teamsData,
    departmentsData,
    leaderCandidatesData,
    employeesData,
    assetsData,
  ] = await Promise.all([
    apiFetch<Team[]>('/teams', token, fetch),
    apiFetch<Department[]>('/departments', token, fetch),
    apiFetch<Admin[]>('/users?isActive=1&position=team_lead', token, fetch),
    apiFetch<TeamMember[]>('/users?role=employee', token, fetch),
    apiFetch<Asset[]>('/assets', token, fetch),
  ]);

  return {
    teams: toArray(teamsData),
    departments: toArray(departmentsData),
    leaders: toArray(leaderCandidatesData),
    employees: toArray(employeesData),
    assets: toArray(assetsData),
  };
};
