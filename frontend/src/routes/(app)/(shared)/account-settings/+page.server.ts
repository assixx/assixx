/**
 * Account Settings - Server-Side Data Loading
 * @module account-settings/+page.server
 *
 * SSR: Loads deletion status for the current tenant.
 */
import { redirect } from '@sveltejs/kit';

import {
  API_BASE,
  extractResponseData,
  type ServerApiResponse,
} from '$lib/server/api-fetch';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { DeletionStatusData, ShiftTimeData } from './_lib/types';

const log = createLogger('AccountSettings');

/**
 * Check if data represents an empty nested response.
 * API sometimes returns: {success: true, data: {data: null, message: "..."}}
 */
function isEmptyNestedResponse(data: unknown): boolean {
  if (data === null || typeof data !== 'object') {
    return false;
  }
  return 'data' in data && (data as { data: unknown }).data === null;
}

/**
 * Custom apiFetch for account-settings: silently returns null on 404
 * and filters out empty nested responses.
 */
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
      if (response.status === 404) return null;
      log.error({ status: response.status, endpoint }, 'API error');
      return null;
    }

    const json = (await response.json()) as ServerApiResponse<T>;
    const data = extractResponseData(json);

    if (isEmptyNestedResponse(data)) {
      return null;
    }

    return data;
  } catch (err: unknown) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Get user from parent layout - only root can access
  const parentData = await parent();
  if (parentData.user?.role !== 'root') {
    redirect(302, '/dashboard');
  }

  const activeAddons: string[] =
    (parentData as { activeAddons?: string[] }).activeAddons ?? [];
  const shiftPlanningEnabled = activeAddons.includes('shift_planning');

  // Only fetch shift times if the addon is enabled — avoids 403
  const [deletionStatus, shiftTimes] = await Promise.all([
    apiFetch<DeletionStatusData>('/root/tenant/deletion-status', token, fetch),
    shiftPlanningEnabled ?
      apiFetch<ShiftTimeData[]>('/shift-times', token, fetch)
    : Promise.resolve(null),
  ]);

  return {
    pendingDeletion: deletionStatus,
    shiftTimes: shiftTimes ?? [],
    shiftPlanningEnabled,
  };
};
