/**
 * TPM Plan Detail - Server-Side Data Loading
 * @module lean-management/tpm/plan/[uuid]/+page.server
 *
 * SSR: Handles both create (uuid='new') and edit modes.
 * Edit mode loads plan data, assets, and time estimates in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { requireAddon } from '$lib/utils/addon-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type {
  TpmPlan,
  TpmTimeEstimate,
  Asset,
  TpmArea,
  TpmDepartment,
  IntervalColorConfigEntry,
} from '../../_lib/types';

const log = createLogger('TpmPlanDetail');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

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

async function apiFetch<T>(
  endpoint: string,
  token: string,
  fetchFn: typeof fetch,
): Promise<T | null> {
  try {
    const response = await fetchFn(`${API_BASE}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      log.error({ status: response.status, endpoint }, 'API error');
      return null;
    }

    const json = (await response.json()) as ApiResponse<T>;
    if ('success' in json && json.success === true) {
      return json.data ?? null;
    }
    if ('data' in json && json.data !== undefined) {
      return json.data;
    }
    return json as unknown as T;
  } catch (err: unknown) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
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
