/**
 * TPM Plan Detail - Server-Side Data Loading
 * @module lean-management/tpm/plan/[uuid]/+page.server
 *
 * SSR: Handles both create (uuid='new') and edit modes.
 * Edit mode loads plan data, assets, and time estimates in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type {
  TpmPlan,
  TpmTimeEstimate,
  Asset,
  TpmArea,
  TpmDepartment,
  IntervalColorConfigEntry,
} from '../../_lib/types';

/** Paginated plan list shape (only the data array is needed) */
interface PlanListData {
  data: TpmPlan[];
}

/** Safely coerce nullable API result to array */
function safeArray<T>(data: T[] | null): T[] {
  return Array.isArray(data) ? data : [];
}

/** Extract asset UUIDs from paginated plan list */
function extractAssetUuids(plansData: PlanListData | null): string[] {
  return (
    plansData?.data
      .map((p: TpmPlan) => p.assetUuid)
      .filter(
        (uuid: string | undefined): uuid is string => uuid !== undefined,
      ) ?? []
  );
}

/** Load shared org data (assets, areas, departments, interval colors) */
async function loadOrgData(
  token: string,
  fetchFn: typeof fetch,
): Promise<{
  assets: Asset[];
  areas: TpmArea[];
  departments: TpmDepartment[];
  intervalColors: IntervalColorConfigEntry[];
}> {
  const [a, ar, d, ic] = await Promise.all([
    apiFetch<Asset[]>('/assets', token, fetchFn),
    apiFetch<TpmArea[]>('/areas', token, fetchFn),
    apiFetch<TpmDepartment[]>('/departments', token, fetchFn),
    apiFetch<IntervalColorConfigEntry[]>(
      '/tpm/config/interval-colors',
      token,
      fetchFn,
    ),
  ]);
  return {
    assets: safeArray(a),
    areas: safeArray(ar),
    departments: safeArray(d),
    intervalColors: safeArray(ic),
  };
}

export const load: PageServerLoad = async ({
  params,
  cookies,
  fetch,
  parent,
}) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const { activeAddons } = await parent();
  requireAddon(activeAddons, 'tpm');

  const isCreateMode = params.uuid === 'new';
  const shared = await loadOrgData(token, fetch);

  if (isCreateMode) {
    const plansData = await apiFetch<PlanListData>(
      '/tpm/plans?page=1&limit=500',
      token,
      fetch,
    );
    return {
      isCreateMode: true,
      plan: null,
      timeEstimates: [],
      ...shared,
      assetUuidsWithPlans: extractAssetUuids(plansData),
    };
  }

  const [planData, estimatesData] = await Promise.all([
    apiFetch<TpmPlan>(`/tpm/plans/${params.uuid}`, token, fetch),
    apiFetch<TpmTimeEstimate[]>(
      `/tpm/plans/${params.uuid}/time-estimates`,
      token,
      fetch,
    ),
  ]);
  if (planData === null) redirect(302, '/lean-management/tpm');

  return {
    isCreateMode: false,
    plan: planData,
    timeEstimates: safeArray(estimatesData),
    ...shared,
  };
};
