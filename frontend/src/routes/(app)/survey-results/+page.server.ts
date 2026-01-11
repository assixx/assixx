/**
 * Survey Results - Server-Side Data Loading
 * @module survey-results/+page.server
 *
 * SSR: Loads survey details, questions, statistics, and responses in parallel.
 */
import { redirect, error } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';
import type {
  Survey,
  SurveyQuestion,
  SurveyStatistics,
  SurveyResponseWithUser,
} from './_lib/types';

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
  } catch (err) {
    console.error(`[SSR] Fetch error for ${endpoint}:`, err);
    return null;
  }
}

export const load: PageServerLoad = async ({ cookies, fetch, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Get surveyId from URL search params
  const surveyId = url.searchParams.get('surveyId');
  if (surveyId === null || surveyId === '') {
    error(400, 'Keine Umfrage-ID angegeben');
  }

  // Parallel fetch: survey details + questions + statistics + responses
  const [surveyData, questionsData, statisticsData, responsesData] = await Promise.all([
    apiFetch<Survey>(`/surveys/${surveyId}`, token, fetch),
    apiFetch<SurveyQuestion[]>(`/surveys/${surveyId}/questions`, token, fetch),
    apiFetch<SurveyStatistics>(`/surveys/${surveyId}/statistics`, token, fetch),
    apiFetch<SurveyResponseWithUser[]>(`/surveys/${surveyId}/responses`, token, fetch),
  ]);

  if (!surveyData) {
    error(404, 'Umfrage nicht gefunden');
  }

  // Safe fallbacks
  const questions = Array.isArray(questionsData) ? questionsData : [];
  const responses = Array.isArray(responsesData) ? responsesData : [];

  return {
    surveyId,
    survey: surveyData,
    questions,
    statistics: statisticsData,
    responses,
  };
};
