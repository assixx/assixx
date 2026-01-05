/**
 * Employee Dashboard - Server-Side Data Loading
 * @module employee-dashboard/+page.server
 *
 * SSR Performance: Fetches dashboard data server-side in parallel.
 * User data comes from parent layout (single /users/me call).
 */
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Document, CalendarEvent, BlackboardEntry } from './_lib/types';
import { LIST_LIMITS, CALENDAR_MONTHS_AHEAD } from './_lib/constants';

/** API base URL for server-side fetching */
const API_BASE = process.env['API_URL'] ?? 'http://localhost:3000/api/v2';

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
 * SECURITY: Token read from httpOnly cookie
 */
export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const startTime = performance.now();

  // 1. Get auth token from httpOnly cookie
  const token = cookies.get('accessToken');

  if (!token) {
    console.info('[SSR] No accessToken cookie, redirecting to login');
    redirect(302, '/login');
  }

  // 2. Get user from parent layout - check access rights
  const parentData = await parent();
  const user = parentData.user;

  // Allow: employee, admin, or root (admin/root can view as employee via role switch)
  // Note: In SSR we can't check localStorage for activeRole, so we allow all roles
  // that could potentially view the employee dashboard
  const allowedRoles = ['employee', 'admin', 'root'];
  if (!user || !allowedRoles.includes(user.role)) {
    redirect(302, '/login');
  }

  // 3. Build date range for calendar events
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const futureDate = new Date(today);
  futureDate.setMonth(futureDate.getMonth() + CALENDAR_MONTHS_AHEAD);
  const startISO = today.toISOString();
  const endISO = futureDate.toISOString();

  // 4. Fetch dashboard data in PARALLEL
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

  // 5. Process responses with safe fallbacks
  const rawDocs = documentsData;
  const documents = rawDocs
    ? 'documents' in rawDocs
      ? (rawDocs.documents ?? [])
      : Array.isArray(rawDocs)
        ? rawDocs
        : []
    : [];

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

  // 6. Log performance
  const duration = (performance.now() - startTime).toFixed(1);
  console.info(`[SSR] employee-dashboard loaded in ${duration}ms (3 parallel API calls)`);

  // 7. Return typed data for +page.svelte
  return {
    recentDocuments: documents.slice(0, LIST_LIMITS.recentDocuments),
    upcomingEvents,
    blackboardEntries,
  };
};
