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
} from '../../_lib/types';

const log = createLogger('TpmPlanDetail');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
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

  // Always load machines for the dropdown
  const machinesData = await apiFetch<Machine[]>('/machines', token, fetch);
  const machines = Array.isArray(machinesData) ? machinesData : [];

  if (isCreateMode) {
    return {
      isCreateMode: true,
      plan: null,
      timeEstimates: [],
      machines,
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

  const timeEstimates = Array.isArray(estimatesData) ? estimatesData : [];

  return {
    isCreateMode: false,
    plan: planData,
    timeEstimates,
    machines,
  };
};
