/**
 * Admin Dashboard - Server-Side Data Loading
 * @module admin-dashboard/+page.server
 *
 * SSR Performance: Fetches ALL dashboard data server-side in parallel.
 * Data is included in initial HTML, eliminating client-side waterfalls.
 *
 * Migration: Replaces client-side onMount fetching from +page.svelte
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';

import { LIST_LIMITS, CALENDAR_MONTHS_AHEAD } from './_lib/constants';

import type { PageServerLoad } from './$types';
import type {
  User,
  Document,
  Department,
  Team,
  CalendarEvent,
  BlackboardEntry,
  DashboardStats,
} from './_lib/types';

/** Build calendar date range for event fetching */
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

/** Extract documents array from various API response shapes */
function extractDocuments(data: { documents?: Document[] } | Document[] | null): Document[] {
  if (!data) return [];
  if ('documents' in data) return data.documents ?? [];
  return Array.isArray(data) ? data : [];
}

/** Extract events array from various API response shapes */
function extractEvents(
  data: { events?: CalendarEvent[] } | CalendarEvent[] | null,
): CalendarEvent[] {
  if (!data) return [];
  if ('events' in data) return data.events ?? [];
  return Array.isArray(data) ? data : [];
}

/** Filter, sort, and limit upcoming events */
function filterUpcomingEvents(events: CalendarEvent[], today: Date): CalendarEvent[] {
  return events
    .filter((event) => {
      if (!event.startTime) return false;
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
 * SECURITY: Token read from httpOnly cookie (set by backend on login)
 */
export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') redirect(302, '/login');

  const { startISO, endISO, today } = buildCalendarDateRange();

  // Fetch ALL data in PARALLEL (single Promise.all = single network round-trip)
  const [usersData, documentsData, departmentsData, teamsData, eventsData, blackboardData] =
    await Promise.all([
      apiFetch<User[]>('/users?role=employee', token, fetch),
      apiFetch<{ documents?: Document[] } | Document[]>('/documents', token, fetch),
      apiFetch<Department[]>('/departments', token, fetch),
      apiFetch<Team[]>('/teams', token, fetch),
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

  // Process responses with safe fallbacks
  const employees = Array.isArray(usersData) ? usersData : [];
  const documents = extractDocuments(documentsData);
  const departments = Array.isArray(departmentsData) ? departmentsData : [];
  const teams = Array.isArray(teamsData) ? teamsData : [];
  const upcomingEvents = filterUpcomingEvents(extractEvents(eventsData), today);
  const blackboardEntries = Array.isArray(blackboardData) ? blackboardData : [];

  const stats: DashboardStats = {
    employeeCount: employees.length,
    documentCount: documents.length,
    departmentCount: departments.length,
    teamCount: teams.length,
  };

  return {
    stats,
    recentEmployees: employees.slice(0, LIST_LIMITS.recentEmployees),
    recentDocuments: documents.slice(0, LIST_LIMITS.recentDocuments),
    departments: departments.slice(0, LIST_LIMITS.departments),
    teams: teams.slice(0, LIST_LIMITS.teams),
    upcomingEvents,
    blackboardEntries,
  };
};
