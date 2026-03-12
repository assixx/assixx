/**
 * Survey Admin - Server-Side Data Loading
 * @module survey-admin/+page.server
 *
 * SSR: Loads surveys, templates, and org data in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type {
  Survey,
  SurveyTemplate,
  Department,
  Team,
  Area,
} from './_lib/types';

/** Ensures API data is a safe array (guards against null/unexpected shapes) */
function toSafeArray<T>(data: T[] | null): T[] {
  return Array.isArray(data) ? data : [];
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Get user data from parent layout (no extra fetch needed)
  const { user, activeAddons } = await parent();
  requireAddon(activeAddons, 'surveys');

  // Parallel fetch: surveys + templates + org data
  const [surveysData, templatesData, departmentsData, teamsData, areasData] =
    await Promise.all([
      apiFetch<Survey[]>('/surveys', token, fetch),
      apiFetch<SurveyTemplate[]>('/surveys/templates', token, fetch),
      apiFetch<Department[]>('/departments', token, fetch),
      apiFetch<Team[]>('/teams', token, fetch),
      apiFetch<Area[]>('/areas', token, fetch),
    ]);

  // Safe fallbacks
  const surveys = toSafeArray(surveysData);
  const templates = toSafeArray(templatesData);
  const departments = toSafeArray(departmentsData);
  const teams = toSafeArray(teamsData);
  const areas = toSafeArray(areasData);

  return {
    surveys,
    templates,
    departments,
    teams,
    areas,
    currentUser: {
      userId: user?.id ?? 0,
      role: user?.role ?? 'employee',
      hasFullAccess: user?.hasFullAccess ?? false,
    },
  };
};
