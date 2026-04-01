/**
 * TPM Mängelgrafik — Server-Side Data Loading
 *
 * Loads plan info + aggregated defect stats per calendar week.
 * Access: Root | Admin (scoped) | Employee Team-Lead
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { assertTeamLevelAccess } from '$lib/server/manage-page-access';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type { DefectChartData, TpmPlan } from '../../../_lib/types';

export const load: PageServerLoad = async ({ cookies, fetch, parent, params, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') redirect(302, '/login');

  const parentData = await parent();
  assertTeamLevelAccess(parentData.orgScope, {
    role: parentData.user?.role,
    pathname: url.pathname,
  });
  requireAddon(parentData.activeAddons, 'tpm');

  const { uuid: planUuid } = params;
  const year = Number(url.searchParams.get('year')) || new Date().getFullYear();

  const [planResult, chartData] = await Promise.all([
    apiFetchWithPermission<TpmPlan>(`/tpm/plans/${planUuid}`, token, fetch),
    apiFetch<DefectChartData>(`/tpm/plans/${planUuid}/defect-stats?year=${year}`, token, fetch),
  ]);

  if (planResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      plan: null,
      chartData: null,
      year,
      error: null,
    };
  }

  const plan = planResult.data;
  const user = parentData.user;
  if (!user) redirect(302, '/login');

  return {
    permissionDenied: false as const,
    plan,
    chartData: chartData ?? null,
    year,
    error: plan === null ? 'Wartungsplan nicht gefunden' : null,
  };
};
