/**
 * Manage Surveys - Server-Side Data Loading
 * @module manage-surveys/+page.server
 *
 * SSR: Loads surveys, templates, and org data in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';
import { buildLoginUrl } from '$lib/utils/build-apex-url';

import { canManageSurveys } from '../../_lib/navigation-config';

import type { PageServerLoad } from './$types';
import type { Survey, SurveyTemplate, Department, Team, Area, UserRole } from './_lib/types';

/** Ensures API data is a safe array (guards against null/unexpected shapes) */
function toSafeArray<T>(data: T[] | null): T[] {
  return Array.isArray(data) ? data : [];
}

interface CurrentUser {
  userId: number;
  role: UserRole;
  hasFullAccess: boolean;
}

function buildCurrentUser(
  user: { id?: number; role?: string; hasFullAccess?: boolean } | null,
): CurrentUser {
  return {
    userId: user?.id ?? 0,
    role: (user?.role ?? 'employee') as UserRole,
    hasFullAccess: user?.hasFullAccess ?? false,
  };
}

async function loadSurveyData(token: string, fetchFn: typeof fetch) {
  const surveysResult = await apiFetchWithPermission<Survey[]>('/surveys', token, fetchFn);

  if (surveysResult.permissionDenied) {
    return { denied: true as const } as const;
  }

  const [templates, departments, teams, areas] = await Promise.all([
    apiFetch<SurveyTemplate[]>('/surveys/templates', token, fetchFn),
    apiFetch<Department[]>('/departments', token, fetchFn),
    apiFetch<Team[]>('/teams', token, fetchFn),
    apiFetch<Area[]>('/areas', token, fetchFn),
  ]);

  return {
    denied: false as const,
    surveys: surveysResult.data,
    templates,
    departments,
    teams,
    areas,
  };
}

export const load: PageServerLoad = async ({ cookies, fetch, parent, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '')
    redirect(302, buildLoginUrl('session-expired', undefined, url));

  const { user, activeAddons, orgScope } = await parent();
  requireAddon(activeAddons, 'surveys');

  // Defense-in-depth: block direct URL access for users who can't manage surveys.
  if (!canManageSurveys(user?.role, user?.hasFullAccess === true, orgScope.isAnyLead)) {
    redirect(302, '/surveys');
  }

  const result = await loadSurveyData(token, fetch);

  if (result.denied) {
    return {
      permissionDenied: true as const,
      surveys: [] as Survey[],
      templates: [] as SurveyTemplate[],
      departments: [] as Department[],
      teams: [] as Team[],
      areas: [] as Area[],
      currentUser: buildCurrentUser(user),
    };
  }

  return {
    permissionDenied: false as const,
    surveys: toSafeArray(result.surveys),
    templates: toSafeArray(result.templates),
    departments: toSafeArray(result.departments),
    teams: toSafeArray(result.teams),
    areas: toSafeArray(result.areas),
    currentUser: buildCurrentUser(user),
  };
};
