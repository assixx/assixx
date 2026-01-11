/**
 * Employee Dashboard - Server-Side Data Loading
 * @module employee-dashboard/+page.server
 *
 * SSR Performance: Fetches dashboard data server-side in parallel.
 * User data comes from parent layout (single /users/me call).
 */
import { redirect } from '@sveltejs/kit';

import { LIST_LIMITS, CALENDAR_MONTHS_AHEAD } from './_lib/constants';

import type { PageServerLoad } from './$types';
import type { Document, CalendarEvent, BlackboardEntry } from './_lib/types';

/** API base URL for server-side fetching */
const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

/** API response wrapper type */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
}

/**
 * Fetch helper with auth and error handling
 */
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

    // Handle both wrapped and unwrapped responses
    if ('success' in json && json.success) {
      return json.data ?? null;
    }

    // Direct response (no wrapper)
    return json as unknown as T;
  } catch (error) {
    console.error(`[SSR] Fetch error for ${endpoint}:`, error);
    return null;
  }
}

/**
 * Build date range for calendar events query
 */
function buildCalendarDateRange(): { startISO: string; endISO: string; today: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const futureDate = new Date(today);
  futureDate.setMonth(futureDate.getMonth() + CALENDAR_MONTHS_AHEAD);
  return {
    startISO: today.toISOString(),
    endISO: futureDate.toISOString(),
    today,
  };
}

/**
 * Extract documents array from API response
 */
function extractDocuments(rawDocs: { documents?: Document[] } | Document[] | null): Document[] {
  if (rawDocs === null) return [];
  if ('documents' in rawDocs) return rawDocs.documents ?? [];
  if (Array.isArray(rawDocs)) return rawDocs;
  return [];
}

/**
 * Extract and filter upcoming events from API response
 */
function extractUpcomingEvents(
  rawEvents: { events?: CalendarEvent[] } | CalendarEvent[] | null,
  today: Date,
): CalendarEvent[] {
  let allEvents: CalendarEvent[] = [];
  if (rawEvents !== null) {
    if ('events' in rawEvents) {
      allEvents = rawEvents.events ?? [];
    } else if (Array.isArray(rawEvents)) {
      allEvents = rawEvents;
    }
  }

  return allEvents
    .filter((event) => {
      if (event.startTime === '') return false;
      try {
        const eventDate = new Date(event.startTime);
        return !Number.isNaN(eventDate.getTime()) && eventDate >= today;
      } catch {
        return false;
      }
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, LIST_LIMITS.upcomingEvents);
}

/**
 * Server-side load function
 *
 * PERFORMANCE: All API calls run IN PARALLEL via Promise.all
 * SECURITY: Token read from httpOnly cookie
 */
export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  // 1. Get auth token from httpOnly cookie
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // 2. Get user from parent layout - check access rights
  const parentData = await parent();
  const user = parentData.user;
  const allowedRoles = ['employee', 'admin', 'root'];
  if (user === null || !allowedRoles.includes(user.role)) {
    redirect(302, '/login');
  }

  // 3. Build date range and fetch dashboard data in PARALLEL
  const { startISO, endISO, today } = buildCalendarDateRange();
  const [documentsData, eventsData, blackboardData] = await Promise.all([
    apiFetch<{ documents?: Document[] } | Document[]>('/documents', token, fetch),
    apiFetch<{ events?: CalendarEvent[] } | CalendarEvent[]>(
      `/calendar/events?startDate=${encodeURIComponent(startISO)}&endDate=${encodeURIComponent(endISO)}&filter=all&limit=10`,
      token,
      fetch,
    ),
    apiFetch<BlackboardEntry[]>(
      `/blackboard/dashboard?limit=${LIST_LIMITS.blackboardEntries}`,
      token,
      fetch,
    ),
  ]);

  // 4. Process responses with helper functions
  const documents = extractDocuments(documentsData);
  const upcomingEvents = extractUpcomingEvents(eventsData, today);
  const blackboardEntries = Array.isArray(blackboardData) ? blackboardData : [];

  // 5. Return data
  return {
    recentDocuments: documents.slice(0, LIST_LIMITS.recentDocuments),
    upcomingEvents,
    blackboardEntries,
  };
};
