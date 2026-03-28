/**
 * Manage Assets - Server-Side Data Loading
 * @module manage-assets/+page.server
 *
 * SSR: Loads assets + reference data (departments, areas, teams) in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';

import type { PageServerLoad } from './$types';
import type { Asset, Department, Area, Team } from './_lib/types';

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Parallel fetch: assets + reference data
  const [assetsData, departmentsData, areasData, teamsData] = await Promise.all([
    apiFetch<Asset[]>('/assets', token, fetch),
    apiFetch<Department[]>('/departments', token, fetch),
    apiFetch<Area[]>('/areas', token, fetch),
    apiFetch<Team[]>('/teams', token, fetch),
  ]);

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
