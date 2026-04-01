/**
 * Work Orders (Admin) — Server-Side Data Loading
 * @module shared/work-orders/admin/+page.server
 *
 * SSR: Loads all work orders, stats, and eligible users in parallel.
 * Addon guard: requires 'work_orders' addon active for tenant.
 * Scope guard: Root | Admin (scoped) | Employee Team-Lead (ADR-036 pattern).
 * Deputies inherit lead scope when tenant toggle is ON.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { assertTeamLevelAccess } from '$lib/server/manage-page-access';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type {
  EligibleUser,
  PaginatedResponse,
  WorkOrderListItem,
  WorkOrderStats,
} from '../_lib/types';

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

export const load: PageServerLoad = async ({ cookies, fetch, parent, url }) => {
  const { user, orgScope, activeAddons } = await parent();
  assertTeamLevelAccess(orgScope, { role: user?.role, pathname: url.pathname });

  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  requireAddon(activeAddons, 'work_orders');

  const [workOrdersResult, statsData, eligibleUsersData] = await Promise.all([
    apiFetchWithPermission<PaginatedResponse<WorkOrderListItem>>(
      '/work-orders?page=1&limit=20',
      token,
      fetch,
    ),
    apiFetch<WorkOrderStats>('/work-orders/stats', token, fetch),
    apiFetch<EligibleUser[]>('/work-orders/eligible-users', token, fetch),
  ]);

  if (workOrdersResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      workOrders: emptyPage(),
      stats: emptyStats(),
      eligibleUsers: [] as EligibleUser[],
    };
  }

  return {
    permissionDenied: false as const,
    workOrders: workOrdersResult.data ?? emptyPage(),
    stats: statsData ?? emptyStats(),
    eligibleUsers: Array.isArray(eligibleUsersData) ? eligibleUsersData : [],
  };
};
