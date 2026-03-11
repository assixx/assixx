/**
 * TPM Locations — Server-Side Data Loading
 *
 * Loads locations for a plan + plan metadata.
 * [uuid] = plan UUID
 */
import { redirect } from '@sveltejs/kit';

import { requireAddon } from '$lib/utils/addon-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { TpmLocation, TpmPlan } from '../../_lib/types';

const log = createLogger('TpmLocations');

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
  } catch (err: unknown) {
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
  requireAddon(parentData.activeAddons, 'tpm');

  const { uuid: planUuid } = params;

  const [plan, locationsRaw] = await Promise.all([
    apiFetch<TpmPlan>(`/tpm/plans/${planUuid}`, token, fetch),
    apiFetch<unknown>(`/tpm/locations?planUuid=${planUuid}`, token, fetch),
  ]);

  const locations = extractArray<TpmLocation>(locationsRaw);

  const userRole = parentData.user?.role ?? 'employee';

  return {
    plan,
    planUuid,
    locations,
    userRole,
    error: plan === null ? 'Wartungsplan nicht gefunden' : null,
  };
};
