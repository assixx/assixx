/**
 * Vacation Rules — Server-Side Data Loading
 * @module vacation/rules/+page.server
 *
 * SSR: Loads blackouts, staffing rules, and settings in parallel.
 * Admin/root only (enforced by (admin) layout guard).
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type {
  OrgArea,
  OrgDepartment,
  OrgTeam,
  VacationBlackout,
  VacationSettings,
  VacationStaffingRule,
} from './_lib/types';

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const { activeAddons } = await parent();
  requireAddon(activeAddons, 'vacation');

  const currentYear = new Date().getFullYear();

  const [
    blackoutsData,
    staffingRulesData,
    settingsData,
    areasData,
    departmentsData,
    teamsData,
  ] = await Promise.all([
    apiFetch<VacationBlackout[]>(
      `/vacation/blackouts?year=${currentYear}`,
      token,
      fetch,
    ),
    apiFetch<VacationStaffingRule[]>('/vacation/staffing-rules', token, fetch),
    apiFetch<VacationSettings>('/vacation/settings', token, fetch),
    apiFetch<OrgArea[]>('/areas', token, fetch),
    apiFetch<OrgDepartment[]>('/departments', token, fetch),
    apiFetch<OrgTeam[]>('/teams', token, fetch),
  ]);

  return {
    blackouts: blackoutsData ?? [],
    staffingRules: staffingRulesData ?? [],
    settings: settingsData,
    areas: areasData ?? [],
    departments: departmentsData ?? [],
    teams: teamsData ?? [],
    currentYear,
  };
};
