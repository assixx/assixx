/**
 * Survey Admin - Server-Side Data Loading
 * @module survey-admin/+page.server
 *
 * SSR: Loads surveys, templates, and org data in parallel.
 */
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Survey, SurveyTemplate, Department, Team, Area } from './_lib/types';

const API_BASE = process.env['API_URL'] ?? 'http://localhost:3000/api/v2';

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
      console.error(`[SSR] API error ${response.status} for ${endpoint}`);
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
  } catch (error) {
    console.error(`[SSR] Fetch error for ${endpoint}:`, error);
    return null;
  }
}

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const startTime = performance.now();

  const token = cookies.get('accessToken');
  if (!token) {
    redirect(302, '/login');
  }

  // Parallel fetch: surveys + templates + org data
  const [surveysData, templatesData, departmentsData, teamsData, areasData] = await Promise.all([
    apiFetch<Survey[]>('/surveys', token, fetch),
    apiFetch<SurveyTemplate[]>('/surveys/templates', token, fetch),
    apiFetch<Department[]>('/departments', token, fetch),
    apiFetch<Team[]>('/teams', token, fetch),
    apiFetch<Area[]>('/areas', token, fetch),
  ]);

  // Safe fallbacks
  const surveys = Array.isArray(surveysData) ? surveysData : [];
  const templates = Array.isArray(templatesData) ? templatesData : [];
  const departments = Array.isArray(departmentsData) ? departmentsData : [];
  const teams = Array.isArray(teamsData) ? teamsData : [];
  const areas = Array.isArray(areasData) ? areasData : [];

  const duration = (performance.now() - startTime).toFixed(1);
  console.info(`[SSR] survey-admin loaded in ${duration}ms (5 parallel API calls)`);

  return {
    surveys,
    templates,
    departments,
    teams,
    areas,
  };
};
