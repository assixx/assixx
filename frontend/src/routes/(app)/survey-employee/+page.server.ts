/**
 * Survey Employee - Server-Side Data Loading
 * @module survey-employee/+page.server
 *
 * SSR: Loads surveys and checks response status for each.
 */
import { redirect } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';
import type { Survey, SurveyResponse, SurveyWithStatus } from './_lib/types';

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
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // First, load all surveys
  const surveysData = await apiFetch<Survey[]>('/surveys', token, fetch);
  const surveys = Array.isArray(surveysData) ? surveysData : [];

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
        responseData !== null && typeof responseData === 'object' && 'id' in responseData;

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
