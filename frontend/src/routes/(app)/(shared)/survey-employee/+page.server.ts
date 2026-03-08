/**
 * Survey Employee - Server-Side Data Loading
 * @module survey-employee/+page.server
 *
 * SSR: Loads surveys and checks response status for each.
 */
import { redirect } from '@sveltejs/kit';

import { requireFeature } from '$lib/utils/feature-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { Survey, SurveyResponse, SurveyWithStatus } from './_lib/types';

const log = createLogger('SurveyEmployee');

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
      // 404 means no response exists yet (expected)
      if (response.status === 404) return null;
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

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const { activeFeatures } = await parent();
  requireFeature(activeFeatures, 'surveys');

  // Load all surveys, filter to only active/completed (employees don't see draft/paused/archived)
  const surveysData = await apiFetch<Survey[]>('/surveys', token, fetch);
  const allSurveys = Array.isArray(surveysData) ? surveysData : [];
  const surveys = allSurveys.filter(
    (s) => s.status === 'active' || s.status === 'completed',
  );

  // Then check response status for each survey in parallel
  const surveysWithStatus: SurveyWithStatus[] = await Promise.all(
    surveys.map(async (survey) => {
      const responseData = await apiFetch<SurveyResponse | null>(
        `/surveys/${survey.id}/my-response`,
        token,
        fetch,
      );

      // If response has an 'id', user has responded
      const hasResponded =
        responseData !== null &&
        typeof responseData === 'object' &&
        'id' in responseData;

      return {
        ...survey,
        hasResponded,
        responseData: hasResponded ? responseData : undefined,
      };
    }),
  );

  return {
    surveys: surveysWithStatus,
  };
};
