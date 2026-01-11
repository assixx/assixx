/**
 * Root Dashboard - Server-Side Data Loading
 * @module root-dashboard/+page.server
 *
 * SSR Performance: Fetches dashboard stats + activity logs in parallel.
 * Employee number check uses parent() layout data.
 */
import { redirect } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';
import type { DashboardData, ActivityLog, LogsApiResponse } from './_lib/types';

/** API base URL for server-side fetching */
const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

/** API response wrapper type */
interface ApiResponse<T> {
  success?: boolean;
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
    if ('data' in json && json.data !== undefined) {
      return json.data;
    }

    // Direct response (no wrapper)
    return json as unknown as T;
  } catch (error) {
    console.error(`[SSR] Fetch error for ${endpoint}:`, error);
    return null;
  }
}

/**
 * Process logs API response - handles multiple response formats
 */
function processLogsResponse(logsData: LogsApiResponse | null): ActivityLog[] {
  if (logsData === null) {
    return [];
  }
  if ('data' in logsData && logsData.data?.logs) {
    return logsData.data.logs;
  }
  if ('logs' in logsData && Array.isArray(logsData.logs)) {
    return logsData.logs;
  }
  if (Array.isArray(logsData)) {
    return logsData as unknown as ActivityLog[];
  }
  return [];
}

/**
 * Check if employee number modal should be shown
 */
function shouldShowEmployeeModal(employeeNumber: string | null | undefined): boolean {
  if (employeeNumber === null || employeeNumber === undefined) {
    return false;
  }
  return employeeNumber.startsWith('TEMP-') || employeeNumber.startsWith('TEMP_');
}

/**
 * Server-side load function
 *
 * PERFORMANCE: Dashboard stats + activity logs fetched IN PARALLEL
 * Employee number check uses layout data (via parent())
 */
export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  // 1. Get auth token from httpOnly cookie
  const token = cookies.get('accessToken');

  if (token === undefined) {
    redirect(302, '/login');
  }

  // 2. Get parent layout data (user for employee number check)
  const parentData = await parent();

  // 3. Fetch dashboard data and logs IN PARALLEL
  const [dashboardData, logsData] = await Promise.all([
    apiFetch<DashboardData>('/root/dashboard', token, fetch),
    apiFetch<LogsApiResponse>('/logs?limit=5', token, fetch),
  ]);

  // 4. Process dashboard data
  const stats: DashboardData = dashboardData ?? {
    adminCount: 0,
    employeeCount: 0,
    totalUsers: 0,
  };

  // 5. Process logs response (handles both wrapper formats)
  const activityLogs = processLogsResponse(logsData);

  // 6. Check if employee number modal should be shown
  // Uses user data from layout (no extra API call)
  const showEmployeeModal = shouldShowEmployeeModal(parentData.user?.employeeNumber);

  // 7. Return typed data for +page.svelte
  return {
    stats,
    activityLogs,
    showEmployeeModal,
  };
};
