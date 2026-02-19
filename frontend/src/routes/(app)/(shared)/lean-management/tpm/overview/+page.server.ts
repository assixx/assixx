/**
 * TPM Employee Overview — Server-Side Data Loading
 * @module shared/lean-management/tpm/+page.server
 *
 * SSR: Loads employee-visible maintenance plans, board data per plan,
 * and color config in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { requireFeature } from '$lib/utils/feature-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type {
  TpmPlan,
  TpmCard,
  TpmColorConfigEntry,
  MachineWithTpmStatus,
  StatusCounts,
} from '../_lib/types';

const log = createLogger('TpmEmployee');

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

/** Count card statuses from a list of cards */
function countStatuses(cards: TpmCard[]): StatusCounts {
  let green = 0;
  let red = 0;
  let yellow = 0;
  let overdue = 0;

  for (const card of cards) {
    if (card.status === 'green') green++;
    else if (card.status === 'red') red++;
    else if (card.status === 'yellow') yellow++;
    else overdue++;
  }

  return { green, red, yellow, overdue, total: cards.length };
}

/** Extract plans from paginated API response */
function extractPlans(raw: unknown): TpmPlan[] {
  if (raw === null || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.data)) return obj.data as TpmPlan[];
  if (Array.isArray(obj.items)) return obj.items as TpmPlan[];
  return [];
}

/** Extract cards from paginated API response */
function extractCards(raw: unknown): TpmCard[] {
  if (raw === null || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.data)) return obj.data as TpmCard[];
  if (Array.isArray(obj.items)) return obj.items as TpmCard[];
  return [];
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const parentData = await parent();
  requireFeature(parentData.activeFeatures, 'tpm');

  // Phase 1: Fetch plans + colors in parallel
  const [plansRaw, colorsData] = await Promise.all([
    apiFetch<unknown>('/tpm/plans?page=1&limit=50', token, fetch),
    apiFetch<TpmColorConfigEntry[]>('/tpm/config/colors', token, fetch),
  ]);

  const plans = extractPlans(plansRaw);
  const colors = Array.isArray(colorsData) ? colorsData : [];

  // Phase 2: Fetch board data (cards) for each plan in parallel
  const boardPromises = plans.map((plan: TpmPlan) =>
    apiFetch<unknown>(
      `/tpm/plans/${plan.uuid}/board?page=1&limit=200`,
      token,
      fetch,
    ),
  );
  const boardResults = await Promise.all(boardPromises);

  // Build machine-with-status list
  const machines: MachineWithTpmStatus[] = plans.map(
    (plan: TpmPlan, idx: number) => {
      const cards = extractCards(boardResults[idx]);
      return {
        plan,
        statusCounts: countStatuses(cards),
        cards,
      };
    },
  );

  return { machines, colors };
};
