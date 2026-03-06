/**
 * TPM Admin Dashboard - Server-Side Data Loading
 * @module lean-management/tpm/+page.server
 *
 * SSR: Loads maintenance plans + color config in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type {
  TpmPlan,
  TpmColorConfigEntry,
  IntervalMatrixEntry,
  PaginatedResponse,
} from './_lib/types';

const log = createLogger('TpmDashboard');

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
  } catch (err) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
}

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

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const [plansData, colorsData, matrixData] = await Promise.all([
    apiFetch<PaginatedResponse<TpmPlan>>(
      '/tpm/plans?page=1&limit=20',
      token,
      fetch,
    ),
    apiFetch<TpmColorConfigEntry[]>('/tpm/config/colors', token, fetch),
    apiFetch<IntervalMatrixEntry[]>('/tpm/plans/interval-matrix', token, fetch),
  ]);

  const { plans, total: totalPlans } = extractPlans(
    plansData as Record<string, unknown> | null,
  );
  const colors = Array.isArray(colorsData) ? colorsData : [];
  const intervalMatrix = Array.isArray(matrixData) ? matrixData : [];

  return {
    plans,
    totalPlans,
    colors,
    intervalMatrix,
  };
};
