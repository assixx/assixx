/**
 * Manage Employees - Server-Side Data Loading
 * @module manage-employees/+page.server
 *
 * SSR: Loads employees + teams in parallel for instant page render.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';

import type { PageServerLoad } from './$types';
import type { Employee, Team } from './_lib/types';

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Parallel fetch: employees + teams + position options
  const [employeesData, teamsData, posOptData] = await Promise.all([
    apiFetch<Employee[]>('/users?role=employee', token, fetch),
    apiFetch<Team[]>('/teams', token, fetch),
    apiFetch<{ employee: string[] }>(
      '/organigram/position-options',
      token,
      fetch,
    ),
  ]);

  const employees =
    Array.isArray(employeesData) ?
      employeesData.filter((u) => u.role === 'employee')
    : [];
  const teams = Array.isArray(teamsData) ? teamsData : [];

  return {
    employees,
    teams,
    positionOptions: posOptData?.employee ?? [],
  };
};
