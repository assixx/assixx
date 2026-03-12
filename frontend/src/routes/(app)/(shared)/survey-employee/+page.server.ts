/**
 * Survey Employee - Server-Side Data Loading
 * @module survey-employee/+page.server
 *
 * SSR: Loads surveys and checks response status for each.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type { Survey, SurveyResponse, SurveyWithStatus } from './_lib/types';

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const { activeAddons } = await parent();
  requireAddon(activeAddons, 'surveys');

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
