/**
 * Logs Page API
 * API calls for system logs
 */

import { getApiClient } from '$lib/utils/api-client';
import type { LogEntry, PaginationInfo, LogsApiResponse, DeleteLogsBody } from './types';
import { LOGS_PER_PAGE, TIMERANGE_DAYS_MAP } from './constants';
import { shouldIncludeFilter, calculateStartDate } from './utils';

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
