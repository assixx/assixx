/**
 * Survey Results - Server-Side Data Loading
 * @module survey-results/+page.server
 *
 * SSR: Loads survey details, questions, statistics, and responses in parallel.
 */
import { redirect, error } from '@sveltejs/kit';

import {
  apiFetch,
  API_BASE,
  extractResponseData,
  type ServerApiResponse,
} from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type {
  Survey,
  SurveyQuestion,
  SurveyStatistics,
  SurveyResponseWithUser,
} from './_lib/types';

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

  const json = (await response.json()) as ServerApiResponse<Survey>;
  const surveyData = extractResponseData(json);

  if (surveyData === null) {
    error(404, 'Umfrage nicht gefunden');
  }

  return surveyData;
}

export const load: PageServerLoad = async ({ cookies, fetch, url, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const { activeAddons } = await parent();
  requireAddon(activeAddons, 'surveys');

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
