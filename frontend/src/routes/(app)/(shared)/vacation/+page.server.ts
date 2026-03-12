/**
 * Vacation — Server-Side Data Loading
 * @module vacation/+page.server
 *
 * SSR: Loads my requests, incoming requests, and balance in parallel.
 * Determines canApprove based on role or incoming request count.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type {
  PaginatedResult,
  VacationBalance,
  VacationRequest,
} from './_lib/types';

/** Empty paginated result fallback */
function emptyPage<T>(): PaginatedResult<T> {
  return { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const parentData = await parent();
  requireAddon(parentData.activeAddons, 'vacation');
  const user = parentData.user;

  if (user === null) {
    redirect(302, '/login');
  }

  const currentYear = new Date().getFullYear();
  const queryParams = `?page=1&limit=10&year=${currentYear}`;

  // Parallel fetch: my requests + incoming requests + balance + unread notification IDs
  const [myRequestsData, incomingRequestsData, balanceData, unreadIdsData] =
    await Promise.all([
      apiFetch<PaginatedResult<VacationRequest>>(
        `/vacation/requests${queryParams}`,
        token,
        fetch,
      ),
      apiFetch<PaginatedResult<VacationRequest>>(
        `/vacation/requests/incoming${queryParams}`,
        token,
        fetch,
      ),
      apiFetch<VacationBalance>(
        `/vacation/entitlements/me?year=${currentYear}`,
        token,
        fetch,
      ),
      apiFetch<string[]>('/vacation/notifications/unread-ids', token, fetch),
    ]);

  const myRequests = myRequestsData ?? emptyPage<VacationRequest>();
  const incomingRequests = incomingRequestsData ?? emptyPage<VacationRequest>();

  // canApprove: admin/root always, or employee with incoming requests (team lead)
  const canApprove =
    user.role === 'admin' || user.role === 'root' || incomingRequests.total > 0;

  return {
    myRequests,
    incomingRequests,
    balance: balanceData,
    currentYear,
    userRole: user.role,
    userId: user.id,
    canApprove,
    /** Request IDs with unread vacation notifications (for "Neu" badges) */
    unreadRequestIds: unreadIdsData ?? [],
  };
};
