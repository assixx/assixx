/**
 * Survey Results - Server-Side Data Loading
 * @module survey-results/+page.server
 *
 * SSR: Loads survey details, questions, statistics, and responses in parallel.
 */
import { redirect, error } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type {
  Survey,
  SurveyQuestion,
  SurveyStatistics,
  SurveyResponseWithUser,
} from './_lib/types';

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

  const surveyResult = await apiFetchWithPermission<Survey>(
    `/surveys/${surveyId}?manage=true`,
    token,
    fetch,
  );

  if (surveyResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      surveyId,
      survey: null,
      questions: [] as SurveyQuestion[],
      statistics: null as SurveyStatistics | null,
      responses: [] as SurveyResponseWithUser[],
    };
  }

  if (surveyResult.data === null) {
    error(404, 'Umfrage nicht gefunden');
  }

  const [questionsData, statisticsData, responsesData] = await Promise.all([
    apiFetch<SurveyQuestion[]>(`/surveys/${surveyId}/questions`, token, fetch),
    apiFetch<SurveyStatistics>(`/surveys/${surveyId}/statistics`, token, fetch),
    apiFetch<{ responses: SurveyResponseWithUser[]; total: number }>(
      `/surveys/${surveyId}/responses`,
      token,
      fetch,
    ),
  ]);

  return {
    permissionDenied: false as const,
    surveyId,
    survey: surveyResult.data,
    questions: Array.isArray(questionsData) ? questionsData : [],
    statistics: statisticsData,
    responses: Array.isArray(responsesData?.responses) ? responsesData.responses : [],
  };
};
