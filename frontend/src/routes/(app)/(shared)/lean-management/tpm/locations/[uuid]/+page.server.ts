/**
 * TPM Locations — Server-Side Data Loading
 *
 * Loads locations for a plan + plan metadata.
 * [uuid] = plan UUID
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type { TpmLocation, TpmPlan } from '../../_lib/types';

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
