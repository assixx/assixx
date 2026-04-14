/**
 * Surveys - Server-Side Data Loading
 * @module surveys/+page.server
 *
 * SSR: Loads surveys and checks response status for each.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
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

  // Permission-aware fetch for primary endpoint
  const surveysResult = await apiFetchWithPermission<Survey[]>('/surveys', token, fetch);

  // 403 on primary endpoint → user lacks addon permission
  if (surveysResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      surveys: [] as SurveyWithStatus[],
    };
  }

  // Filter to only active/completed (employees don't see draft/paused/archived)
  const allSurveys = Array.isArray(surveysResult.data) ? surveysResult.data : [];
  const surveys = allSurveys.filter((s) => s.status === 'active' || s.status === 'completed');

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
    permissionDenied: false as const,
    surveys: surveysWithStatus,
  };
};
