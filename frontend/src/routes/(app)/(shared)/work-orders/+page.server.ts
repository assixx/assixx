/**
 * Work Orders (Employee) — Server-Side Data Loading
 * @module shared/work-orders/+page.server
 *
 * SSR: Loads employee's assigned work orders (first page) + stats.
 * Addon guard: requires 'work_orders' addon active for tenant.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type { PaginatedResponse, WorkOrderListItem, WorkOrderStats } from './_lib/types';

/** Empty paginated result fallback */
function emptyPage(): PaginatedResponse<WorkOrderListItem> {
  return { items: [], total: 0, page: 1, pageSize: 20 };
}

function emptyStats(): WorkOrderStats {
  return {
    open: 0,
    inProgress: 0,
    completed: 0,
    verified: 0,
    total: 0,
    overdue: 0,
  };
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const parentData = await parent();
  requireAddon(parentData.activeAddons, 'work_orders');

  const [workOrdersResult, statsData] = await Promise.all([
    apiFetchWithPermission<PaginatedResponse<WorkOrderListItem>>(
      '/work-orders/my?page=1&limit=20',
      token,
      fetch,
    ),
    apiFetch<WorkOrderStats>('/work-orders/my/stats', token, fetch),
  ]);

  if (workOrdersResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      workOrders: emptyPage(),
      stats: emptyStats(),
    };
  }

  return {
    permissionDenied: false as const,
    workOrders: workOrdersResult.data ?? emptyPage(),
    stats: statsData ?? emptyStats(),
  };
};
