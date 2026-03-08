/**
 * Manage Teams - Server-Side Data Loading
 * @module manage-teams/+page.server
 *
 * SSR: Loads teams + reference data (departments, admins, employees, assets) in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { Team, Department, Admin, TeamMember, Asset } from './_lib/types';

const log = createLogger('ManageTeams');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

async function apiFetch<T>(
  endpoint: string,
  token: string,
  fetchFn: typeof fetch,
): Promise<T | null> {
  try {
    const response = await fetchFn(`${API_BASE}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      log.error({ status: response.status, endpoint }, 'API error');
      return null;
    }

    const json = (await response.json()) as ApiResponse<T>;
    if ('success' in json && json.success === true) {
      return json.data ?? null;
    }
    if ('data' in json && json.data !== undefined) {
      return json.data;
    }
    return json as unknown as T;
  } catch (err: unknown) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
}

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Parallel fetch: teams + all reference data (admin + root as potential team leads)
  const [
    teamsData,
    departmentsData,
    adminsData,
    rootsData,
    employeesData,
    assetsData,
  ] = await Promise.all([
    apiFetch<Team[]>('/teams', token, fetch),
    apiFetch<Department[]>('/departments', token, fetch),
    apiFetch<Admin[]>('/users?role=admin', token, fetch),
    apiFetch<Admin[]>('/users?role=root', token, fetch),
    apiFetch<TeamMember[]>('/users?role=employee', token, fetch),
    apiFetch<Asset[]>('/assets', token, fetch),
  ]);

  const teams = Array.isArray(teamsData) ? teamsData : [];
  const departments = Array.isArray(departmentsData) ? departmentsData : [];
  const admins = [
    ...(Array.isArray(adminsData) ? adminsData : []),
    ...(Array.isArray(rootsData) ? rootsData : []),
  ];
  const employees = Array.isArray(employeesData) ? employeesData : [];
  const assets = Array.isArray(assetsData) ? assetsData : [];

  return {
    teams,
    departments,
    admins,
    employees,
    assets,
  };
};
