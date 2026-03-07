/**
 * Work Orders (Admin) — Server-Side Data Loading
 * @module shared/work-orders/admin/+page.server
 *
 * SSR: Loads all work orders, stats, and eligible users in parallel.
 * Feature guard: requires 'work_orders' feature active for tenant.
 * Role guard: explicit check (not under (admin) layout group due to route conflict).
 */
import { redirect } from '@sveltejs/kit';

import { requireFeature } from '$lib/utils/feature-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type {
  EligibleUser,
  PaginatedResponse,
  WorkOrderListItem,
  WorkOrderStats,
} from '../_lib/types';

const log = createLogger('WorkOrdersAdmin');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

/** Roles allowed to access the admin work orders view */
const ALLOWED_ROLES: ReadonlySet<string> = new Set(['admin', 'root']);

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
  } catch (err: unknown) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
}

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
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const parentData = await parent();

  // Role guard — replicate (admin) layout behavior
  const user = parentData.user;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defense-in-depth: parent guarantees user, but security checks must not rely on upstream alone
  if (user === null || user === undefined) {
    log.warn({ pathname: url.pathname }, 'RBAC: No user data');
    redirect(302, '/login');
  }
  if (!ALLOWED_ROLES.has(user.role)) {
    log.warn(
      { pathname: url.pathname, userRole: user.role },
      'RBAC: Access denied to admin work orders',
    );
    redirect(302, '/permission-denied');
  }

  requireFeature(parentData.activeFeatures, 'work_orders');

  const [workOrdersData, statsData, eligibleUsersData] = await Promise.all([
    apiFetch<PaginatedResponse<WorkOrderListItem>>(
      '/work-orders?page=1&limit=20',
      token,
      fetch,
    ),
    apiFetch<WorkOrderStats>('/work-orders/stats', token, fetch),
    apiFetch<EligibleUser[]>('/work-orders/eligible-users', token, fetch),
  ]);

  return {
    workOrders: workOrdersData ?? emptyPage(),
    stats: statsData ?? emptyStats(),
    eligibleUsers: Array.isArray(eligibleUsersData) ? eligibleUsersData : [],
  };
};
