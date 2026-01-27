/**
 * Survey Results - Server-Side Data Loading
 * @module survey-results/+page.server
 *
 * SSR: Loads survey details, questions, statistics, and responses in parallel.
 */
import { redirect, error } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type {
  Survey,
  SurveyQuestion,
  SurveyStatistics,
  SurveyResponseWithUser,
} from './_lib/types';

const log = createLogger('SurveyResults');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

/** Extract typed data from the standard API response envelope */
function parseApiResponse<T>(json: ApiResponse<T>): T | null {
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
      if (response.status === 404) return null;
      log.error({ status: response.status, endpoint }, 'API error');
      return null;
    }

    const json = (await response.json()) as ApiResponse<T>;
    return parseApiResponse(json);
  } catch (err) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
}

/** Fetch survey with management permission check, throws on 403/404 */
async function fetchSurveyWithPermission(
  surveyId: string,
  token: string,
  fetchFn: typeof fetch,
): Promise<Survey> {
  const response = await fetchFn(
    `${API_BASE}/surveys/${surveyId}?manage=true`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );

  if (response.status === 403) {
    error(403, 'Keine Berechtigung für diese Umfrage-Ergebnisse');
  }

  if (!response.ok) {
    error(404, 'Umfrage nicht gefunden');
  }

  const json = (await response.json()) as ApiResponse<Survey>;
  const surveyData = parseApiResponse(json);

  if (surveyData === null) {
    error(404, 'Umfrage nicht gefunden');
  }

  return surveyData;
}

export const load: PageServerLoad = async ({ cookies, fetch, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const surveyId = url.searchParams.get('surveyId');
  if (surveyId === null || surveyId === '') {
    error(400, 'Keine Umfrage-ID angegeben');
  }

  // Step 1: Fetch survey with management permission check
  const surveyData = await fetchSurveyWithPermission(surveyId, token, fetch);

  // Step 2: Parallel fetch remaining data (statistics, questions, responses)
  const [questionsData, statisticsData, responsesData] = await Promise.all([
    apiFetch<SurveyQuestion[]>(`/surveys/${surveyId}/questions`, token, fetch),
    apiFetch<SurveyStatistics>(`/surveys/${surveyId}/statistics`, token, fetch),
    apiFetch<{ responses: SurveyResponseWithUser[]; total: number }>(
      `/surveys/${surveyId}/responses`,
      token,
      fetch,
    ),
  ]);

  // Safe fallbacks
  const questions = Array.isArray(questionsData) ? questionsData : [];
  const responses =
    Array.isArray(responsesData?.responses) ? responsesData.responses : [];

  return {
    surveyId,
    survey: surveyData,
    questions,
    statistics: statisticsData,
    responses,
  };
};
