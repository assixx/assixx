/**
 * Logs Page - Server-Side Data Loading
 * @module logs/+page.server
 *
 * SSR: Loads initial logs with default pagination.
 * Filters and pagination changes happen client-side.
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import { LOGS_PER_PAGE } from './_lib/constants';

import type { PageServerLoad } from './$types';
import type { LogEntry, PaginationInfo } from './_lib/types';

const log = createLogger('Logs');

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

/** Default empty response for error cases */
function getEmptyResponse(): { logs: LogEntry[]; pagination: PaginationInfo } {
  return {
    logs: [],
    pagination: { limit: LOGS_PER_PAGE, offset: 0, total: 0, hasMore: false },
  };
}

/** Parse API response handling different formats */
function parseLogsResponse(json: LogsApiResponse): {
  logs: LogEntry[];
  pagination: PaginationInfo;
} {
  const defaultPagination: PaginationInfo = {
    limit: LOGS_PER_PAGE,
    offset: 0,
    total: 0,
    hasMore: false,
  };

  if (json.data !== undefined) {
    return {
      logs: json.data.logs ?? [],
      pagination: json.data.pagination ?? defaultPagination,
    };
  }

  return {
    logs: json.logs ?? [],
    pagination: json.pagination ?? defaultPagination,
  };
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined) {
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
      log.error({ status: response.status, endpoint: '/logs' }, 'API error');
      return getEmptyResponse();
    }

    const json = (await response.json()) as LogsApiResponse;
    return parseLogsResponse(json);
  } catch (err: unknown) {
    log.error({ err, endpoint: '/logs' }, 'Fetch error');
    return getEmptyResponse();
  }
};
