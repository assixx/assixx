/**
 * Manage Assets - Server-Side Data Loading
 * @module manage-assets/+page.server
 *
 * SSR: Loads assets + reference data (departments, areas, teams) in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { Asset, Department, Area, Team } from './_lib/types';

const log = createLogger('ManageAssets');

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
  } catch (err) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
}

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Parallel fetch: assets + reference data
  const [assetsData, departmentsData, areasData, teamsData] = await Promise.all(
    [
      apiFetch<Asset[]>('/assets', token, fetch),
      apiFetch<Department[]>('/departments', token, fetch),
      apiFetch<Area[]>('/areas', token, fetch),
      apiFetch<Team[]>('/teams', token, fetch),
    ],
  );

  const assets = Array.isArray(assetsData) ? assetsData : [];
  const departments = Array.isArray(departmentsData) ? departmentsData : [];
  const areas = Array.isArray(areasData) ? areasData : [];
  const teams = Array.isArray(teamsData) ? teamsData : [];

  return {
    assets,
    departments,
    areas,
    teams,
  };
};
