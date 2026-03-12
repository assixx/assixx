/**
 * TPM Employee Overview — Server-Side Data Loading
 * @module shared/lean-management/tpm/+page.server
 *
 * SSR: Loads employee-visible maintenance plans, board data per plan,
 * and color config in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type {
  TpmPlan,
  TpmCard,
  TpmColorConfigEntry,
  AssetWithTpmStatus,
  StatusCounts,
} from '../_lib/types';

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
  requireAddon(parentData.activeAddons, 'tpm');

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

  // Build asset-with-status list
  const assets: AssetWithTpmStatus[] = plans.map(
    (plan: TpmPlan, idx: number) => {
      const cards = extractCards(boardResults[idx]);
      return {
        plan,
        statusCounts: countStatuses(cards),
        cards,
      };
    },
  );

  return { assets, colors };
};
