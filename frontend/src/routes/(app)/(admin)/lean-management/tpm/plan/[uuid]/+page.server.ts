/**
 * TPM Plan Detail - Server-Side Data Loading
 * @module lean-management/tpm/plan/[uuid]/+page.server
 *
 * SSR: Handles both create (uuid='new') and edit modes.
 * Edit mode loads plan data, machines, and time estimates in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type {
  TpmPlan,
  TpmTimeEstimate,
  Machine,
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

/** Extract machine UUIDs from paginated plan list */
function extractMachineUuids(plansData: PlanListData | null): string[] {
  return (
    plansData?.data
      .map((p: TpmPlan) => p.machineUuid)
      .filter(
        (uuid: string | undefined): uuid is string => uuid !== undefined,
      ) ?? []
  );
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

export const load: PageServerLoad = async ({ params, cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const isCreateMode = params.uuid === 'new';

  // Load machines + areas + departments + interval colors in parallel
  const [machinesData, areasData, departmentsData, intervalColorsData] =
    await Promise.all([
      apiFetch<Machine[]>('/machines', token, fetch),
      apiFetch<TpmArea[]>('/areas', token, fetch),
      apiFetch<TpmDepartment[]>('/departments', token, fetch),
      apiFetch<IntervalColorConfigEntry[]>(
        '/tpm/config/interval-colors',
        token,
        fetch,
      ),
    ]);
  const machines = safeArray(machinesData);
  const areas = safeArray(areasData);
  const departments = safeArray(departmentsData);

  if (isCreateMode) {
    // Fetch active plans to determine which machines already have a TPM plan
    const plansData = await apiFetch<PlanListData>(
      '/tpm/plans?page=1&limit=500',
      token,
      fetch,
    );
    const machineUuidsWithPlans = extractMachineUuids(plansData);

    return {
      isCreateMode: true,
      plan: null,
      timeEstimates: [],
      machines,
      areas,
      departments,
      machineUuidsWithPlans,
      intervalColors: safeArray(intervalColorsData),
    };
  }

  // Edit mode: load plan + time estimates in parallel
  const [planData, estimatesData] = await Promise.all([
    apiFetch<TpmPlan>(`/tpm/plans/${params.uuid}`, token, fetch),
    apiFetch<TpmTimeEstimate[]>(
      `/tpm/plans/${params.uuid}/time-estimates`,
      token,
      fetch,
    ),
  ]);

  if (planData === null) {
    redirect(302, '/lean-management/tpm');
  }

  const timeEstimates = safeArray(estimatesData);

  return {
    isCreateMode: false,
    plan: planData,
    timeEstimates,
    machines,
    areas,
    departments,
    intervalColors: safeArray(intervalColorsData),
  };
};
