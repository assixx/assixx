/**
 * Logs Page - Server-Side Data Loading
 * @module logs/+page.server
 *
 * SSR: Loads initial logs with default pagination.
 * Filters and pagination changes happen client-side.
 */
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { LogEntry, PaginationInfo } from './_lib/types';
import { LOGS_PER_PAGE } from './_lib/constants';

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface LogsApiResponse {
  success?: boolean;
  data?: {
    logs?: LogEntry[];
    pagination?: PaginationInfo;
  };
  logs?: LogEntry[];
  pagination?: PaginationInfo;
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const startTime = performance.now();

  const token = cookies.get('accessToken');
  if (!token) {
    redirect(302, '/login');
  }

  // Only root users can access logs
  const parentData = await parent();
  if (parentData.user?.role !== 'root') {
    redirect(302, '/login');
  }

  try {
    const response = await fetch(`${API_BASE}/logs?limit=${LOGS_PER_PAGE}&offset=0`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[SSR] API error ${response.status} for /logs`);
      return {
        logs: [],
        pagination: {
          limit: LOGS_PER_PAGE,
          offset: 0,
          total: 0,
          hasMore: false,
        },
      };
    }

    const json = (await response.json()) as LogsApiResponse;

    // Handle different response formats
    let logs: LogEntry[] = [];
    let pagination: PaginationInfo = {
      limit: LOGS_PER_PAGE,
      offset: 0,
      total: 0,
      hasMore: false,
    };

    if (json.data !== undefined) {
      logs = json.data.logs ?? [];
      pagination = json.data.pagination ?? pagination;
    } else {
      logs = json.logs ?? [];
      pagination = json.pagination ?? pagination;
    }

    const duration = (performance.now() - startTime).toFixed(1);
    console.info(`[SSR] logs loaded in ${duration}ms (${logs.length} entries)`);

    return {
      logs,
      pagination,
    };
  } catch (error) {
    console.error(`[SSR] Fetch error for /logs:`, error);
    return {
      logs: [],
      pagination: {
        limit: LOGS_PER_PAGE,
        offset: 0,
        total: 0,
        hasMore: false,
      },
    };
  }
};
