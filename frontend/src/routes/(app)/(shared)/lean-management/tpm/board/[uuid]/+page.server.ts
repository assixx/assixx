/**
 * TPM Kamishibai Board — Server-Side Data Loading
 * Loads plan + all cards + colors in parallel.
 * [uuid] = plan UUID (linked from employee asset overview)
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type {
  TpmPlan,
  TpmCard,
  TpmColorConfigEntry,
  IntervalColorConfigEntry,
  CategoryColorConfigEntry,
} from '../../_lib/types';

function extractCards(raw: unknown): TpmCard[] {
  if (raw === null || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.data)) return obj.data as TpmCard[];
  if (Array.isArray(obj.items)) return obj.items as TpmCard[];
  return [];
}

async function fetchBoardData(
  token: string,
  fetchFn: typeof fetch,
  planUuid: string,
) {
  return await Promise.all([
    apiFetchWithPermission<TpmPlan>(`/tpm/plans/${planUuid}`, token, fetchFn),
    apiFetch<unknown>(
      `/tpm/plans/${planUuid}/board?page=1&limit=200`,
      token,
      fetchFn,
    ),
    apiFetch<TpmColorConfigEntry[]>('/tpm/config/colors', token, fetchFn),
    apiFetch<IntervalColorConfigEntry[]>(
      '/tpm/config/interval-colors',
      token,
      fetchFn,
    ),
    apiFetch<CategoryColorConfigEntry[]>(
      '/tpm/config/category-colors',
      token,
      fetchFn,
    ),
  ]);
}

function buildBoardDeniedResponse(planUuid: string) {
  return {
    permissionDenied: true as const,
    planUuid,
    plan: null,
    cards: [] as TpmCard[],
    colors: [] as TpmColorConfigEntry[],
    intervalColors: [] as IntervalColorConfigEntry[],
    categoryColors: [] as CategoryColorConfigEntry[],
    userRole: 'employee',
  };
}

export const load: PageServerLoad = async ({
  cookies,
  fetch,
  parent,
  params,
}) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') redirect(302, '/login');

  const parentData = await parent();
  requireAddon(parentData.activeAddons, 'tpm');

  const { uuid: planUuid } = params;
  const [
    planResult,
    boardRaw,
    colorsData,
    intervalColorsData,
    categoryColorsData,
  ] = await fetchBoardData(token, fetch, planUuid);

  if (planResult.permissionDenied) {
    return buildBoardDeniedResponse(planUuid);
  }

  return {
    permissionDenied: false as const,
    planUuid,
    plan: planResult.data,
    cards: extractCards(boardRaw),
    colors: Array.isArray(colorsData) ? colorsData : [],
    intervalColors: Array.isArray(intervalColorsData) ? intervalColorsData : [],
    categoryColors: Array.isArray(categoryColorsData) ? categoryColorsData : [],
    userRole: parentData.user?.role ?? 'employee',
  };
};
