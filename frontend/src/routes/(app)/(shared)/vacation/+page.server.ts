/**
 * Vacation — Server-Side Data Loading
 * @module vacation/+page.server
 *
 * SSR: Loads my requests, incoming requests, and balance in parallel.
 * Determines canApprove based on role or incoming request count.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';
import { buildLoginUrl } from '$lib/utils/build-apex-url';

import type { PageServerLoad } from './$types';
import type { PaginatedResult, VacationBalance, VacationRequest } from './_lib/types';

/** Empty paginated result fallback */
function emptyPage<T>(): PaginatedResult<T> {
  return { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
}

/** Fetch all vacation data in parallel */
async function fetchVacationData(token: string, fetchFn: typeof fetch, currentYear: number) {
  const queryParams = `?page=1&limit=10&year=${currentYear}`;
  return await Promise.all([
    apiFetchWithPermission<PaginatedResult<VacationRequest>>(
      `/vacation/requests${queryParams}`,
      token,
      fetchFn,
    ),
    apiFetch<PaginatedResult<VacationRequest>>(
      `/vacation/requests/incoming${queryParams}`,
      token,
      fetchFn,
    ),
    apiFetch<VacationBalance>(`/vacation/entitlements/me?year=${currentYear}`, token, fetchFn),
    apiFetch<string[]>('/vacation/notifications/unread-ids', token, fetchFn),
  ]);
}

export const load: PageServerLoad = async ({ cookies, fetch, parent, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, buildLoginUrl('session-expired', undefined, url));
  }

  const parentData = await parent();
  requireAddon(parentData.activeAddons, 'vacation');
  const user = parentData.user;

  if (user === null) {
    redirect(302, buildLoginUrl('session-expired', undefined, url));
  }

  const currentYear = new Date().getFullYear();
  const [myRequestsResult, incomingRequestsData, balanceData, unreadIdsData] =
    await fetchVacationData(token, fetch, currentYear);

  if (myRequestsResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      myRequests: emptyPage<VacationRequest>(),
      incomingRequests: emptyPage<VacationRequest>(),
      balance: null,
      currentYear,
      userRole: user.role,
      userId: user.id,
      canApprove: false,
      unreadRequestIds: [] as string[],
    };
  }

  const myRequests = myRequestsResult.data ?? emptyPage<VacationRequest>();
  const incomingRequests = incomingRequestsData ?? emptyPage<VacationRequest>();
  const canApprove = user.role === 'admin' || user.role === 'root' || incomingRequests.total > 0;

  return {
    permissionDenied: false as const,
    myRequests,
    incomingRequests,
    balance: balanceData,
    currentYear,
    userRole: user.role,
    userId: user.id,
    canApprove,
    unreadRequestIds: unreadIdsData ?? [],
  };
};
