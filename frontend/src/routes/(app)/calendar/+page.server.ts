/**
 * Calendar - Server-Side Data Loading
 * @module calendar/+page.server
 *
 * SSR: Loads upcoming events + organization data (for dropdowns) in parallel.
 * Note: The calendar events themselves are fetched dynamically by the Calendar component.
 */
import { redirect } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';
import type { CalendarEvent, Department, Team, Area, User } from './_lib/types';

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
      console.error(`[SSR] API error ${response.status} for ${endpoint}`);
      return null;
    }

    const json = (await response.json()) as ApiResponse<T>;
    return extractResponseData(json);
  } catch (error) {
    console.error(`[SSR] Fetch error for ${endpoint}:`, error);
    return null;
  }
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Parallel fetch: upcoming events + organization data for dropdowns
  const [upcomingEventsData, departmentsData, teamsData, areasData, usersData] = await Promise.all([
    apiFetch<CalendarEvent[]>('/calendar/dashboard', token, fetch),
    apiFetch<Department[]>('/departments', token, fetch),
    apiFetch<Team[]>('/teams', token, fetch),
    apiFetch<Area[]>('/areas', token, fetch),
    apiFetch<User[]>('/users', token, fetch),
  ]);

  // Get user from parent layout
  const parentData = await parent();

  // Safe fallbacks
  const upcomingEvents = Array.isArray(upcomingEventsData) ? upcomingEventsData : [];
  const departments = Array.isArray(departmentsData) ? departmentsData : [];
  const teams = Array.isArray(teamsData) ? teamsData : [];
  const areas = Array.isArray(areasData) ? areasData : [];
  const users = Array.isArray(usersData) ? usersData : [];

  return {
    upcomingEvents,
    departments,
    teams,
    areas,
    users,
    currentUser: parentData.user,
  };
};
