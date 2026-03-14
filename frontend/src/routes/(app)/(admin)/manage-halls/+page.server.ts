/**
 * Manage Halls - Server-Side Data Loading
 * @module manage-halls/+page.server
 *
 * SSR: Loads halls + areas in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';

import type { PageServerLoad } from './$types';
import type { Hall, Area } from './_lib/types';

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const [hallsData, areasData] = await Promise.all([
    apiFetch<Hall[]>('/halls', token, fetch),
    apiFetch<Area[]>('/areas', token, fetch),
  ]);

  const halls = Array.isArray(hallsData) ? hallsData : [];
  const areas = Array.isArray(areasData) ? areasData : [];

  return {
    halls,
    areas,
  };
};
