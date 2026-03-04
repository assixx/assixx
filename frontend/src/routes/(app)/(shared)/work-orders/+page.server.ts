/**
 * Work Orders (Employee) — Server-Side Data Loading
 * @module shared/work-orders/+page.server
 *
 * SSR: Loads employee's assigned work orders (first page).
 * Feature guard: requires 'work_orders' feature active for tenant.
 */
import { redirect } from '@sveltejs/kit';

import { requireFeature } from '$lib/utils/feature-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { PaginatedResponse, WorkOrderListItem } from './_lib/types';

const log = createLogger('WorkOrders');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

/**
 * Extract data from API response.
 * Handles: { success: true, data: T } | { data: T } | T
 */
function extractResponseData<T>(json: ApiResponse<T>): T | null {
  if ('success' in json && json.success === true) {
    return json.data ?? null;
  }
  if ('data' in json && json.data !== undefined) {
    return json.data;
  }
  return json as unknown as T;
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
    return extractResponseData(json);
  } catch (err) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
}

/** Empty paginated result fallback */
function emptyPage(): PaginatedResponse<WorkOrderListItem> {
  return { items: [], total: 0, page: 1, pageSize: 20 };
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const parentData = await parent();
  requireFeature(parentData.activeFeatures, 'work_orders');

  const workOrdersData = await apiFetch<PaginatedResponse<WorkOrderListItem>>(
    '/work-orders/my?page=1&limit=20',
    token,
    fetch,
  );

  return {
    workOrders: workOrdersData ?? emptyPage(),
  };
};
