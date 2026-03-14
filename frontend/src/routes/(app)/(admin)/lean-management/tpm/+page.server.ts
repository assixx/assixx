/**
 * TPM Admin Dashboard - Server-Side Data Loading
 * @module lean-management/tpm/+page.server
 *
 * SSR: Loads maintenance plans + color config in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type {
  TpmPlan,
  TpmColorConfigEntry,
  IntervalMatrixEntry,
  PaginatedResponse,
} from './_lib/types';

/** Extract plans array from the paginated API response */
function extractPlans(raw: Record<string, unknown> | null): {
  plans: TpmPlan[];
  total: number;
} {
  if (raw === null) return { plans: [], total: 0 };

  const items = Array.isArray(raw.data) ? raw.data : raw.items;
  const plans = Array.isArray(items) ? (items as TpmPlan[]) : [];
  const total = typeof raw.total === 'number' ? raw.total : 0;

  return { plans, total };
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const { activeAddons } = await parent();
  requireAddon(activeAddons, 'tpm');

  const plansResult = await apiFetchWithPermission<PaginatedResponse<TpmPlan>>(
    '/tpm/plans?page=1&limit=20',
    token,
    fetch,
  );

  if (plansResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      plans: [] as TpmPlan[],
      totalPlans: 0,
      colors: [] as TpmColorConfigEntry[],
      intervalMatrix: [] as IntervalMatrixEntry[],
    };
  }

  const [colorsData, matrixData] = await Promise.all([
    apiFetch<TpmColorConfigEntry[]>('/tpm/config/colors', token, fetch),
    apiFetch<IntervalMatrixEntry[]>('/tpm/plans/interval-matrix', token, fetch),
  ]);

  const { plans, total: totalPlans } = extractPlans(
    plansResult.data as Record<string, unknown> | null,
  );

  return {
    permissionDenied: false as const,
    plans,
    totalPlans,
    colors: Array.isArray(colorsData) ? colorsData : [],
    intervalMatrix: Array.isArray(matrixData) ? matrixData : [],
  };
};
