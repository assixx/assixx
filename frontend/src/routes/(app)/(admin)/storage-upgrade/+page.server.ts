/**
 * Storage Upgrade - Server-Side Data Loading
 * @module storage-upgrade/+page.server
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';

const log = createLogger('StorageUpgrade');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

/** API response wrapper */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { message: string };
}

/** Current plan response */
interface CurrentPlanResponse {
  plan?: {
    code?: string;
    name?: string;
  };
}

/** Addons response */
interface AddonsResponse {
  storageGb?: number;
}

/** Fetch helper with auth and error handling */
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
    return 'success' in json && json.success ?
        (json.data ?? null)
      : (json as unknown as T);
  } catch (err) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
}

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  // 1. Auth check
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // 2. Parallel fetch plan and addons data
  const [currentPlan, addons] = await Promise.all([
    apiFetch<CurrentPlanResponse>('/plans/current', token, fetch),
    apiFetch<AddonsResponse>('/plans/addons', token, fetch),
  ]);

  // 3. Calculate storage info
  const storageGb = addons?.storageGb ?? 5;
  const planCode = currentPlan?.plan?.code ?? 'basic';

  // 4. Return typed data
  return {
    title: 'Speicher erweitern',
    storageInfo: {
      used: 0, // TODO: Get actual used storage from backend
      total: storageGb * 1024 * 1024 * 1024, // Convert GB to bytes
      percentage: 0,
      plan: planCode,
    },
  };
};
