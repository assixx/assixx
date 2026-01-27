/**
 * Survey Admin - Server-Side Data Loading
 * @module survey-admin/+page.server
 *
 * SSR: Loads surveys, templates, and org data in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { Survey, SurveyTemplate, Department, Team, Area } from './_lib/types';

const log = createLogger('SurveyAdmin');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

/** Ensures API data is a safe array (guards against null/unexpected shapes) */
function toSafeArray<T>(data: T[] | null): T[] {
  return Array.isArray(data) ? data : [];
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

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Get user data from parent layout (no extra fetch needed)
  const { user } = await parent();

  // Parallel fetch: surveys + templates + org data
  const [surveysData, templatesData, departmentsData, teamsData, areasData] = await Promise.all([
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
      role: (user?.role ?? 'employee'),
      hasFullAccess: user?.hasFullAccess ?? false,
    },
  };
};
