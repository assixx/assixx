/**
 * Logs Page API
 * API calls for system logs and exports
 *
 * @see ADR-009 Central Audit Logging
 */

import { getApiClient } from '$lib/utils/api-client';

import { LOGS_PER_PAGE, TIMERANGE_DAYS_MAP } from './constants';
import { shouldIncludeFilter, calculateStartDate } from './utils';

import type {
  LogEntry,
  PaginationInfo,
  LogsApiResponse,
  DeleteLogsBody,
  ExportLogsParams,
} from './types';

// ============================================================================
// API Client
// ============================================================================

const apiClient = getApiClient();

// ============================================================================
// Fetch Logs
// ============================================================================

export interface FetchLogsParams {
  offset: number;
  filterUser: string;
  filterAction: string;
  filterEntity: string;
  filterTimerange: string;
}

export interface FetchLogsResult {
  logs: LogEntry[];
  pagination: PaginationInfo;
}

/**
 * Load logs with filters and pagination
 */
export async function fetchLogs(params: FetchLogsParams): Promise<FetchLogsResult> {
  const { offset, filterUser, filterAction, filterEntity, filterTimerange } = params;

  const searchParams = new URLSearchParams({
    limit: LOGS_PER_PAGE.toString(),
    offset: offset.toString(),
  });

  // Add search filter
  if (filterUser !== '') {
    searchParams.append('search', filterUser);
  }

  // Add action filter
  if (shouldIncludeFilter(filterAction)) {
    searchParams.append('action', filterAction);
  }

  // Add entity type filter
  if (shouldIncludeFilter(filterEntity)) {
    searchParams.append('entityType', filterEntity);
  }

  // Add date range filters
  if (shouldIncludeFilter(filterTimerange)) {
    const startDate = calculateStartDate(filterTimerange);
    if (startDate !== '') {
      searchParams.append('startDate', startDate);
      searchParams.append('endDate', new Date().toISOString());
    }
  }

  const response: LogsApiResponse = await apiClient.get(`/logs?${searchParams.toString()}`);

  return {
    logs: response.logs ?? [],
    pagination: response.pagination ?? {
      limit: LOGS_PER_PAGE,
      offset: 0,
      total: 0,
      hasMore: false,
    },
  };
}

// ============================================================================
// Delete Logs
// ============================================================================

export interface DeleteLogsParams {
  password: string;
  filterUser: string;
  filterAction: string;
  filterEntity: string;
  filterTimerange: string;
}

/**
 * Delete logs matching the current filters
 */
export async function deleteLogs(params: DeleteLogsParams): Promise<void> {
  const { password, filterUser, filterAction, filterEntity, filterTimerange } = params;

  const body: DeleteLogsBody = {
    confirmPassword: password,
  };

  let hasFilters = false;

  // Add search filter
  if (filterUser !== '') {
    body.search = filterUser;
    hasFilters = true;
  }

  // Add action filter
  if (shouldIncludeFilter(filterAction)) {
    body.action = filterAction;
    hasFilters = true;
  }

  // Add entity type filter
  if (shouldIncludeFilter(filterEntity)) {
    body.entityType = filterEntity;
    hasFilters = true;
  }

  // Add date range as olderThanDays
  if (shouldIncludeFilter(filterTimerange)) {
    const days = TIMERANGE_DAYS_MAP[filterTimerange];
    if (days !== undefined) {
      body.olderThanDays = days;
      hasFilters = true;
    }
  }

  // If no specific filters, delete all logs
  if (!hasFilters) {
    body.olderThanDays = 0;
  }

  await apiClient.delete('/logs', body);
}

// ============================================================================
// Export Logs (ADR-009)
// ============================================================================

/** Error thrown when rate limited */
export class RateLimitError extends Error {
  retryAfter: number;

  constructor(retryAfter: number) {
    super('Rate limited');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/** API error response structure */
interface ApiErrorResponse {
  error?: { message?: string };
  message?: string;
}

/**
 * Build export query parameters.
 */
function buildExportParams(params: ExportLogsParams): URLSearchParams {
  const { dateFrom, dateTo, format, source, action, userId, entityType } = params;

  const searchParams = new URLSearchParams({
    dateFrom,
    dateTo,
    format,
    source,
  });

  if (action !== undefined && action !== 'all') {
    searchParams.append('action', action);
  }
  if (userId !== undefined) {
    searchParams.append('userId', userId.toString());
  }
  if (entityType !== undefined && entityType !== 'all') {
    searchParams.append('entityType', entityType);
  }

  return searchParams;
}

/**
 * Extract filename from Content-Disposition header.
 */
function extractFilename(response: Response, defaultExt: string): string {
  const contentDisposition = response.headers.get('Content-Disposition');
  const defaultFilename = `audit-logs-export.${defaultExt}`;

  if (contentDisposition === null) return defaultFilename;

  const match = /filename="([^"]+)"/.exec(contentDisposition);
  return match?.[1] ?? defaultFilename;
}

/**
 * Trigger file download via blob URL.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export logs as a downloadable file.
 *
 * Note: This bypasses the standard API client because we need to handle
 * the raw blob response for file download.
 *
 * Rate Limit: 1 export per minute (returns 429 with Retry-After header)
 *
 * @throws {RateLimitError} When rate limited (contains retryAfter in seconds)
 * @throws {Error} When export fails
 */
export async function exportLogs(params: ExportLogsParams): Promise<void> {
  const searchParams = buildExportParams(params);

  const response = await fetch(`/api/v2/logs/export?${searchParams.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (response.status === 429) {
    const retryAfter = Number.parseInt(response.headers.get('Retry-After') ?? '60', 10);
    throw new RateLimitError(retryAfter);
  }

  if (!response.ok) {
    const errorData: ApiErrorResponse = await response
      .json()
      .then((data: unknown): ApiErrorResponse => {
        if (typeof data === 'object' && data !== null) {
          return data;
        }
        return { message: 'Export failed' };
      })
      .catch((): ApiErrorResponse => ({ message: 'Export failed' }));
    const message = errorData.error?.message ?? errorData.message ?? 'Export failed';
    throw new Error(message);
  }

  const filename = extractFilename(response, params.format);
  const blob = await response.blob();
  downloadBlob(blob, filename);
}

/**
 * Calculate default date range for export (last 30 days).
 */
export function getDefaultExportDateRange(): {
  dateFrom: string;
  dateTo: string;
} {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return {
    dateFrom: thirtyDaysAgo.toISOString().split('T')[0] ?? '',
    dateTo: now.toISOString().split('T')[0] ?? '',
  };
}

/**
 * Calculate date range from a quick timerange preset.
 *
 * @param minutes - Duration in minutes to go back from now
 */
export function getExportDateRangeFromMinutes(minutes: number): {
  dateFrom: string;
  dateTo: string;
} {
  const now = new Date();
  const past = new Date(now.getTime() - minutes * 60 * 1000);

  return {
    dateFrom: past.toISOString().split('T')[0] ?? '',
    dateTo: now.toISOString().split('T')[0] ?? '',
  };
}
