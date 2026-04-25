/**
 * Employee Dashboard - Server-Side Data Loading
 * @module employee-dashboard/+page.server
 *
 * SSR Performance: Fetches dashboard data server-side in parallel.
 * User data comes from parent layout (single /users/me call).
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { buildLoginUrl } from '$lib/utils/build-apex-url';

import { LIST_LIMITS, CALENDAR_MONTHS_AHEAD } from './_lib/constants';

import type { PageServerLoad } from './$types';
import type { Document, CalendarEvent, BlackboardEntry } from './_lib/types';

/**
 * Build date range for calendar events query
 */
function buildCalendarDateRange(): {
  startISO: string;
  endISO: string;
  today: Date;
} {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const futureDate = new Date(today);
  futureDate.setUTCMonth(futureDate.getUTCMonth() + CALENDAR_MONTHS_AHEAD);
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
export const load: PageServerLoad = async ({ cookies, fetch, parent, url }) => {
  // 1. Get auth token from httpOnly cookie
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, buildLoginUrl('session-expired', undefined, url));
  }

  // 2. Get user from parent layout - check access rights
  const parentData = await parent();
  const user = parentData.user;
  const allowedRoles = ['employee', 'admin', 'root'];
  if (user === null || !allowedRoles.includes(user.role)) {
    redirect(302, buildLoginUrl('session-expired', undefined, url));
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
