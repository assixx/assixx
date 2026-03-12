/**
 * TPM Card Management - Server-Side Data Loading
 * @module lean-management/tpm/cards/[uuid]/+page.server
 *
 * SSR: The [uuid] param is the plan UUID.
 * Loads plan context, cards for that plan, and available templates.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type { TpmPlan, TpmCard, PaginatedResponse } from '../../_lib/types';

/** Subset of TpmLocation needed for card form dropdown + photo preview */
interface LocationOption {
  uuid: string;
  positionNumber: number;
  title: string;
  photoPath: string | null;
}

/** Extract cards + total from paginated API response */
function extractCards(raw: unknown): { cards: TpmCard[]; totalCards: number } {
  const result = raw as Record<string, unknown> | null;
  if (result === null || typeof result !== 'object') {
    return { cards: [], totalCards: 0 };
  }
  const items = result.data ?? result.items;
  return {
    cards: Array.isArray(items) ? (items as TpmCard[]) : [],
    totalCards: typeof result.total === 'number' ? result.total : 0,
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

  const planUuid = params.uuid;

  // Load plan + cards + locations in parallel
  const [planData, cardsData, locationsData] = await Promise.all([
    apiFetch<TpmPlan>(`/tpm/plans/${planUuid}`, token, fetch),
    apiFetch<PaginatedResponse<TpmCard>>(
      `/tpm/cards?planUuid=${planUuid}&page=1&limit=50`,
      token,
      fetch,
    ),
    apiFetch<LocationOption[]>(
      `/tpm/locations?planUuid=${planUuid}`,
      token,
      fetch,
    ),
  ]);

  if (planData === null) {
    redirect(302, '/lean-management/tpm');
  }

  const { cards, totalCards } = extractCards(cardsData);
  const locations = Array.isArray(locationsData) ? locationsData : [];

  return {
    plan: planData,
    cards,
    totalCards,
    locations,
    planUuid,
  };
};
