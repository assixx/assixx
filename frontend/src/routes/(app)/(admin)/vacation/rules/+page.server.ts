/**
 * Vacation Rules — Server-Side Data Loading
 * @module vacation/rules/+page.server
 *
 * SSR: Loads blackouts, staffing rules, and settings in parallel.
 * Admin/root only (enforced by (admin) layout guard).
 */
import { redirect } from '@sveltejs/kit';

import { requireFeature } from '$lib/utils/feature-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type {
  OrgArea,
  OrgDepartment,
  OrgTeam,
  VacationBlackout,
  VacationSettings,
  VacationStaffingRule,
} from './_lib/types';

const log = createLogger('VacationRules');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

/** Extract data from API response envelope. */
function extractResponseData<T>(json: ApiResponse<T>): T | null {
  if ('success' in json && json.success === true) {
    return json.data ?? null;
  }
  if ('data' in json && json.data !== undefined) {
    return json.data;
  }
  return json as unknown as T;
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
    return extractResponseData(json);
  } catch (err) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const { activeFeatures } = await parent();
  requireFeature(activeFeatures, 'vacation');

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
