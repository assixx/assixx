/**
 * TPM Card Detail — Server-Side Data Loading
 *
 * Loads card info + colors + time estimates for a single card.
 * [uuid] = card UUID (linked from KamishibaiCard on the board)
 */
import { redirect } from '@sveltejs/kit';

import { requireFeature } from '$lib/utils/feature-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type {
  TpmCard,
  TpmColorConfigEntry,
  TpmEmployee,
  TpmLocation,
  TpmTimeEstimate,
} from '../../_lib/types';

const log = createLogger('TpmCardDetail');

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
    if ('success' in json && json.success === true) return json.data ?? null;
    if ('data' in json && json.data !== undefined) return json.data;
    return json as unknown as T;
  } catch (err) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
}

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
  requireFeature(parentData.activeFeatures, 'tpm');

  const { uuid: cardUuid } = params;

  // Step 1: Fetch card + colors + employees in parallel
  const [card, colorsRaw, employeesRaw] = await Promise.all([
    apiFetch<TpmCard>(`/tpm/cards/${cardUuid}`, token, fetch),
    apiFetch<unknown>('/tpm/config/colors', token, fetch),
    apiFetch<unknown>('/users?role=employee', token, fetch),
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
