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
import { LIST_LIMITS, CALENDAR_MONTHS_AHEAD } from './_lib/constants';

/** API base URL for server-side fetching */
const API_BASE = process.env['API_URL'] ?? 'http://localhost:3000/api/v2';

/** API response wrapper type */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { message: string };
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
    if ('success' in json && json.success === true) {
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
 * Server-side load function
 *
 * PERFORMANCE: All API calls run IN PARALLEL via Promise.all
 * SECURITY: Token read from httpOnly cookie (set by backend on login)
 */
export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const startTime = performance.now();

  // 1. Get auth token from httpOnly cookie
  const token = cookies.get('accessToken');

  if (!token) {
    console.info('[SSR] No accessToken cookie, redirecting to login');
    redirect(302, '/login');
  }

  // 2. Build date range for calendar events
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const futureDate = new Date(today);
  futureDate.setMonth(futureDate.getMonth() + CALENDAR_MONTHS_AHEAD);
  const startISO = today.toISOString();
  const endISO = futureDate.toISOString();

  // 3. Fetch ALL data in PARALLEL (single Promise.all = single network round-trip)
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

  // 4. Process responses with safe fallbacks
  const employees = Array.isArray(usersData) ? usersData : [];

  const rawDocs = documentsData;
  const documents = rawDocs
    ? 'documents' in rawDocs
      ? (rawDocs.documents ?? [])
      : Array.isArray(rawDocs)
        ? rawDocs
        : []
    : [];

  const departments = Array.isArray(departmentsData) ? departmentsData : [];
  const teams = Array.isArray(teamsData) ? teamsData : [];

  // Process calendar events
  const rawEvents = eventsData;
  const allEvents = rawEvents
    ? 'events' in rawEvents
      ? (rawEvents.events ?? [])
      : Array.isArray(rawEvents)
        ? rawEvents
        : []
    : [];

  const upcomingEvents = allEvents
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

  const blackboardEntries = Array.isArray(blackboardData) ? blackboardData : [];

  // 5. Build stats
  const stats: DashboardStats = {
    employeeCount: employees.length,
    documentCount: documents.length,
    departmentCount: departments.length,
    teamCount: teams.length,
  };

  // 6. Log performance
  const duration = (performance.now() - startTime).toFixed(1);
  console.info(`[SSR] admin-dashboard loaded in ${duration}ms (6 parallel API calls)`);

  // 7. Return typed data for +page.svelte
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
