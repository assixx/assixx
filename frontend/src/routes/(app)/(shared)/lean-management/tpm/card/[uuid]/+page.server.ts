/**
 * TPM Card Detail — Server-Side Data Loading
 *
 * Loads card info + colors + time estimates for a single card.
 * [uuid] = card UUID (linked from KamishibaiCard on the board)
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type {
  TpmCard,
  TpmColorConfigEntry,
  TpmEmployee,
  TpmLocation,
  TpmTimeEstimate,
} from '../../_lib/types';

function extractArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw !== null && typeof raw !== 'undefined' && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

export const load: PageServerLoad = async ({
  cookies,
  fetch,
  parent,
  params,
}) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') redirect(302, '/login');

  const parentData = await parent();
  requireAddon(parentData.activeAddons, 'tpm');

  const { uuid: cardUuid } = params;

  // Step 1: Fetch card + colors + employees in parallel
  const [card, colorsRaw, employeesRaw] = await Promise.all([
    apiFetch<TpmCard>(`/tpm/cards/${cardUuid}`, token, fetch),
    apiFetch<unknown>('/tpm/config/colors', token, fetch),
    apiFetch<unknown>('/tpm/executions/eligible-participants', token, fetch),
  ]);

  const colors = extractArray<TpmColorConfigEntry>(colorsRaw);
  const employees = extractArray<TpmEmployee>(employeesRaw);

  // Step 2: If card exists and has planUuid, fetch time estimates + locations
  let timeEstimates: TpmTimeEstimate[] = [];
  let locations: TpmLocation[] = [];
  if (card?.planUuid !== undefined) {
    const [estimatesRaw, locationsRaw] = await Promise.all([
      apiFetch<unknown>(
        `/tpm/plans/${card.planUuid}/time-estimates`,
        token,
        fetch,
      ),
      apiFetch<unknown>(
        `/tpm/locations?planUuid=${card.planUuid}`,
        token,
        fetch,
      ),
    ]);
    timeEstimates = extractArray<TpmTimeEstimate>(estimatesRaw);
    locations = extractArray<TpmLocation>(locationsRaw);
  }

  return {
    card,
    colors,
    timeEstimates,
    locations,
    employees,
    error: card === null ? 'Karte nicht gefunden' : null,
  };
};
