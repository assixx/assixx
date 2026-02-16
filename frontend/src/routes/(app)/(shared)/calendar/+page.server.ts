/**
 * Calendar - Server-Side Data Loading
 * @module calendar/+page.server
 *
 * SSR: Loads upcoming events + organization data (for dropdowns) in parallel.
 * Note: The calendar events themselves are fetched dynamically by the Calendar component.
 */
import { redirect } from '@sveltejs/kit';

import { requireFeature } from '$lib/utils/feature-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { CalendarEvent, Department, Team, Area, User } from './_lib/types';

const log = createLogger('Calendar');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  events?: T;
}

/**
 * Extract data from various API response formats.
 * Handles: { success: true, data: { events: [...] } } | { success: true, data: T } | { data: T } | T
 */
function extractResponseData<T>(json: ApiResponse<T>): T | null {
  // Format: { success: true, data: { events: [...] } }
  if ('success' in json && json.success === true) {
    if (json.data === undefined || json.data === null) {
      return null;
    }
    const innerData = json.data as unknown as { events?: T };
    if ('events' in innerData) {
      return innerData.events ?? null;
    }
    return json.data;
  }

  // Format: { data: T }
  if ('data' in json && json.data !== undefined) {
    return json.data;
  }

  // Format: T (raw response)
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

/** Safe array fallback - returns empty array if data is not an array */
function toArray<T>(data: T[] | null): T[] {
  return Array.isArray(data) ? data : [];
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Get user from parent layout FIRST to check role
  const parentData = await parent();
  requireFeature(parentData.activeFeatures, 'calendar');
  const userRole = parentData.user?.role;
  const canFetchUsers = userRole === 'admin' || userRole === 'root';

  // Parallel fetch: upcoming events + organization data
  // Note: /users only for admin/root (employees get 403)
  const [
    upcomingEventsData,
    recentlyAddedData,
    departmentsData,
    teamsData,
    areasData,
    usersData,
  ] = await Promise.all([
    apiFetch<CalendarEvent[]>('/calendar/dashboard', token, fetch),
    apiFetch<CalendarEvent[]>('/calendar/recently-added', token, fetch),
    apiFetch<Department[]>('/departments', token, fetch),
    apiFetch<Team[]>('/teams', token, fetch),
    apiFetch<Area[]>('/areas', token, fetch),
    canFetchUsers ?
      apiFetch<User[]>('/users', token, fetch)
    : Promise.resolve(null),
  ]);

  return {
    upcomingEvents: toArray(upcomingEventsData),
    recentlyAddedEvents: toArray(recentlyAddedData),
    departments: toArray(departmentsData),
    teams: toArray(teamsData),
    areas: toArray(areasData),
    users: toArray(usersData),
    currentUser: parentData.user,
  };
};
