/**
 * Account Settings - Server-Side Data Loading
 * @module account-settings/+page.server
 *
 * SSR: Loads deletion status for the current tenant.
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { DeletionStatusData } from './_lib/types';

const log = createLogger('AccountSettings');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

/**
 * Extract data from API response, handling multiple response formats.
 * API can return: {success: true, data: T} or {data: T} or T directly.
 */
function extractResponseData<T>(json: ApiResponse<T>): unknown {
  if ('success' in json && json.success === true) {
    return json.data ?? null;
  }
  if ('data' in json && json.data !== undefined) {
    return json.data;
  }
  return json;
}

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

    const json = (await response.json()) as ApiResponse<T>;
    const data = extractResponseData(json);

    if (isEmptyNestedResponse(data)) {
      return null;
    }

    return data as T | null;
  } catch (err) {
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

  // Load pending deletion status
  const deletionStatus = await apiFetch<DeletionStatusData>(
    '/root/tenant/deletion-status',
    token,
    fetch,
  );

  return {
    pendingDeletion: deletionStatus,
  };
};
