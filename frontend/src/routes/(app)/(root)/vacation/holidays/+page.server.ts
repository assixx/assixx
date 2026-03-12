/**
 * Vacation Holidays — Server-Side Data Loading
 * @module vacation/holidays/+page.server
 *
 * SSR: Loads holidays for the current year.
 * Root only (enforced by (root) layout guard).
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type { VacationHoliday } from './_lib/types';

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const { activeAddons } = await parent();
  requireAddon(activeAddons, 'vacation');

  const currentYear = new Date().getFullYear();

  const holidaysData = await apiFetch<VacationHoliday[]>(
    `/vacation/holidays?year=${currentYear}`,
    token,
    fetch,
  );

  return {
    holidays: holidaysData ?? [],
    currentYear,
  };
};
