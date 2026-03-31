/**
 * TPM Plan Defects (Gesamtmängelliste) — Server-Side Data Loading
 *
 * Loads plan info + all defects across all cards for that plan (paginated).
 * [uuid] = plan UUID (linked from PlanOverview action column)
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type { PlanDefectWithContext, TpmPlan } from '../../../_lib/types';

interface PaginatedApiResponse<T> {
  success?: boolean;
  data?: T[];
  total?: number;
  page?: number;
  pageSize?: number;
}

function extractDefects(raw: unknown): {
  defects: PlanDefectWithContext[];
  total: number;
} {
  if (raw === null || typeof raw !== 'object') {
    return { defects: [], total: 0 };
  }
  const obj = raw as PaginatedApiResponse<PlanDefectWithContext>;
  return {
    defects: Array.isArray(obj.data) ? obj.data : [],
    total: obj.total ?? 0,
  };
}

export const load: PageServerLoad = async ({ cookies, fetch, parent, params }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') redirect(302, '/login');

  const parentData = await parent();
  requireAddon(parentData.activeAddons, 'tpm');

  const { uuid: planUuid } = params;

  const [planResult, defectsRaw] = await Promise.all([
    apiFetchWithPermission<TpmPlan>(`/tpm/plans/${planUuid}`, token, fetch),
    apiFetch<unknown>(`/tpm/plans/${planUuid}/defects?page=1&limit=50`, token, fetch),
  ]);

  if (planResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      plan: null,
      defects: [] as PlanDefectWithContext[],
      total: 0,
      error: null,
      userRole: 'employee',
    };
  }

  const plan = planResult.data;
  const { defects, total } = extractDefects(defectsRaw);

  const user = parentData.user;
  if (!user) redirect(302, '/login');

  return {
    permissionDenied: false as const,
    plan,
    defects,
    total,
    error: plan === null ? 'Wartungsplan nicht gefunden' : null,
    userRole: user.role as string,
  };
};
