/**
 * TPM Card Detail — Server-Side Data Loading
 *
 * Loads card info + colors + time estimates for a single card.
 * [uuid] = card UUID (linked from KamishibaiCard on the board)
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
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

export const load: PageServerLoad = async ({ cookies, fetch, parent, params }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') redirect(302, '/login');

  const parentData = await parent();
  requireAddon(parentData.activeAddons, 'tpm');

  const { uuid: cardUuid } = params;

  // Step 1: Fetch card (permission-aware) + colors + employees in parallel
  const [cardResult, colorsRaw, employeesRaw] = await Promise.all([
    apiFetchWithPermission<TpmCard>(`/tpm/cards/${cardUuid}`, token, fetch),
    apiFetch<unknown>('/tpm/config/colors', token, fetch),
    apiFetch<unknown>('/tpm/executions/eligible-participants', token, fetch),
  ]);

  if (cardResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      card: null,
      colors: [] as TpmColorConfigEntry[],
      timeEstimates: [] as TpmTimeEstimate[],
      locations: [] as TpmLocation[],
      employees: [] as TpmEmployee[],
      error: null,
    };
  }

  const card = cardResult.data;
  const colors = extractArray<TpmColorConfigEntry>(colorsRaw);
  const employees = extractArray<TpmEmployee>(employeesRaw);

  // Step 2: If card exists and has planUuid, fetch time estimates + locations
  let timeEstimates: TpmTimeEstimate[] = [];
  let locations: TpmLocation[] = [];
  if (card?.planUuid !== undefined) {
    const [estimatesRaw, locationsRaw] = await Promise.all([
      apiFetch<unknown>(`/tpm/plans/${card.planUuid}/time-estimates`, token, fetch),
      apiFetch<unknown>(`/tpm/locations?planUuid=${card.planUuid}`, token, fetch),
    ]);
    timeEstimates = extractArray<TpmTimeEstimate>(estimatesRaw);
    locations = extractArray<TpmLocation>(locationsRaw);
  }

  return {
    permissionDenied: false as const,
    card,
    colors,
    timeEstimates,
    locations,
    employees,
    error: card === null ? 'Karte nicht gefunden' : null,
  };
};
