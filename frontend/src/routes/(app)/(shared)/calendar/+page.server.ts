/**
 * Calendar - Server-Side Data Loading
 * @module calendar/+page.server
 *
 * SSR: Loads upcoming events + organization data (for dropdowns) in parallel.
 * Note: The calendar events themselves are fetched dynamically by the Calendar component.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type { CalendarEvent, Department, Team, Area, User } from './_lib/types';

/** Safe array fallback - returns empty array if data is not an array */
function toArray<T>(data: T[] | null): T[] {
  return Array.isArray(data) ? data : [];
}

/**
 * Unwrap calendar events from API response.
 * Calendar endpoints may return `{ events: [...] }` instead of a plain array
 * when the shared apiFetch extracts the `data` envelope.
 */
function unwrapEvents(data: unknown): CalendarEvent[] {
  if (Array.isArray(data)) return data as CalendarEvent[];
  if (data !== null && typeof data === 'object' && 'events' in data) {
    const wrapped = data as { events: unknown };
    if (Array.isArray(wrapped.events)) return wrapped.events as CalendarEvent[];
  }
  return [];
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Get user from parent layout FIRST to check role
  const parentData = await parent();
  requireAddon(parentData.activeAddons, 'calendar');
  const userRole = parentData.user?.role;
  const canFetchUsers = userRole === 'admin' || userRole === 'root';

  // Parallel fetch: upcoming events + organization data
  // Note: /users only for admin/root (employees get 403)
  // apiFetchWithPermission for /calendar/dashboard to detect 403 (permission denied vs empty data)
  const [
    dashboardResult,
    recentlyAddedData,
    departmentsData,
    teamsData,
    areasData,
    usersData,
  ] = await Promise.all([
    apiFetchWithPermission<CalendarEvent[]>(
      '/calendar/dashboard',
      token,
      fetch,
    ),
    apiFetch<CalendarEvent[]>('/calendar/recently-added', token, fetch),
    apiFetch<Department[]>('/departments', token, fetch),
    apiFetch<Team[]>('/teams', token, fetch),
    apiFetch<Area[]>('/areas', token, fetch),
    canFetchUsers ?
      apiFetch<User[]>('/users', token, fetch)
    : Promise.resolve(null),
  ]);

  if (dashboardResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      upcomingEvents: [] as CalendarEvent[],
      recentlyAddedEvents: [] as CalendarEvent[],
      departments: [] as Department[],
      teams: [] as Team[],
      areas: [] as Area[],
      users: [] as User[],
      currentUser: parentData.user,
    };
  }

  return {
    permissionDenied: false as const,
    upcomingEvents: unwrapEvents(dashboardResult.data),
    recentlyAddedEvents: unwrapEvents(recentlyAddedData),
    departments: toArray(departmentsData),
    teams: toArray(teamsData),
    areas: toArray(areasData),
    users: toArray(usersData),
    currentUser: parentData.user,
  };
};
