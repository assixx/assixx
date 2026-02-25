// =============================================================================
// TPM Employee View — API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';

import type {
  TpmPlan,
  TpmCard,
  TpmColorConfigEntry,
  TpmExecution,
  TpmExecutionPhoto,
  TpmTimeEstimate,
  CreateExecutionPayload,
  RespondExecutionPayload,
  PaginatedResponse,
  ScheduleProjectionResult,
  IntervalColorConfigEntry,
} from './types';

const log = createLogger('TpmEmployeeApi');
const apiClient = getApiClient();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const EMPTY_PAGE: PaginatedResponse<never> = {
  items: [],
  total: 0,
  page: 1,
  limit: 20,
};

function numberOr(val: unknown, fallback: number): number {
  return typeof val === 'number' ? val : fallback;
}

/** Type-safe extraction of paginated data from API response */
function extractPaginated<T>(result: unknown): PaginatedResponse<T> {
  if (result === null || typeof result !== 'object') return EMPTY_PAGE;
  const obj = result as Record<string, unknown>;
  const items =
    Array.isArray(obj.data) ? (obj.data as T[])
    : Array.isArray(obj.items) ? (obj.items as T[])
    : [];
  return {
    items,
    total: numberOr(obj.total, 0),
    page: numberOr(obj.page, 1),
    limit: numberOr(obj.pageSize ?? obj.limit, 20),
  };
}

/** Type-safe extraction of array data from API response */
function extractArray<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result !== null && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

// =============================================================================
// PLANS (Employee reads only)
// =============================================================================

/** Fetch paginated list of maintenance plans */
export async function fetchPlans(
  page = 1,
  limit = 50,
): Promise<PaginatedResponse<TpmPlan>> {
  const result: unknown = await apiClient.get(
    `/tpm/plans?page=${page}&limit=${limit}`,
  );
  return extractPaginated<TpmPlan>(result);
}

// =============================================================================
// CARDS
// =============================================================================

/** Fetch board data (all cards for a plan's machine) */
export async function fetchBoardData(
  planUuid: string,
  page = 1,
  limit = 100,
): Promise<PaginatedResponse<TpmCard>> {
  const result: unknown = await apiClient.get(
    `/tpm/plans/${planUuid}/board?page=${page}&limit=${limit}`,
  );
  return extractPaginated<TpmCard>(result);
}

// =============================================================================
// CONFIG
// =============================================================================

/** Fetch color configuration */
export async function fetchColors(): Promise<TpmColorConfigEntry[]> {
  const result: unknown = await apiClient.get('/tpm/config/colors');
  return extractArray<TpmColorConfigEntry>(result);
}

// =============================================================================
// SCHEDULE PROJECTION
// =============================================================================

/** Fetch projected maintenance schedules across all active plans */
export async function fetchScheduleProjection(
  startDate: string,
  endDate: string,
): Promise<ScheduleProjectionResult | null> {
  try {
    return await apiClient.get<ScheduleProjectionResult>(
      `/tpm/plans/schedule-projection?startDate=${startDate}&endDate=${endDate}`,
    );
  } catch (err: unknown) {
    log.error({ err }, 'Error loading schedule projection');
    return null;
  }
}

// =============================================================================
// INTERVAL COLORS
// =============================================================================

/** Fetch interval color configuration */
export async function fetchIntervalColors(): Promise<
  IntervalColorConfigEntry[]
> {
  const result: unknown = await apiClient.get('/tpm/config/interval-colors');
  return extractArray<IntervalColorConfigEntry>(result);
}

// =============================================================================
// EXECUTIONS
// =============================================================================

/** Create an execution (mark card as done) */
export async function createExecution(
  payload: CreateExecutionPayload,
): Promise<TpmExecution> {
  return await apiClient.post('/tpm/executions', payload);
}

/** Fetch execution history for a card (paginated) */
export async function fetchCardExecutions(
  cardUuid: string,
  page = 1,
  limit = 50,
): Promise<PaginatedResponse<TpmExecution>> {
  const result: unknown = await apiClient.get(
    `/tpm/cards/${cardUuid}/executions?page=${page}&limit=${limit}`,
  );
  return extractPaginated<TpmExecution>(result);
}

/** Get a single execution */
export async function fetchExecution(
  executionUuid: string,
): Promise<TpmExecution> {
  return await apiClient.get(`/tpm/executions/${executionUuid}`);
}

/** Fetch pending approvals */
export async function fetchPendingApprovals(
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<TpmExecution>> {
  const result: unknown = await apiClient.get(
    `/tpm/executions/pending-approvals?page=${page}&limit=${limit}`,
  );
  return extractPaginated<TpmExecution>(result);
}

/** Respond to execution (approve/reject) */
export async function respondToExecution(
  executionUuid: string,
  payload: RespondExecutionPayload,
): Promise<TpmExecution> {
  return await apiClient.post(
    `/tpm/executions/${executionUuid}/respond`,
    payload,
  );
}

// =============================================================================
// PHOTOS
// =============================================================================

/** Upload a photo to an execution */
export async function uploadPhoto(
  executionUuid: string,
  file: File,
): Promise<TpmExecutionPhoto> {
  const formData = new FormData();
  formData.append('file', file);
  return await apiClient.post(
    `/tpm/executions/${executionUuid}/photos`,
    formData,
  );
}

/** Fetch photos for an execution */
export async function fetchPhotos(
  executionUuid: string,
): Promise<TpmExecutionPhoto[]> {
  const result: unknown = await apiClient.get(
    `/tpm/executions/${executionUuid}/photos`,
  );
  return extractArray<TpmExecutionPhoto>(result);
}

// =============================================================================
// TIME ESTIMATES
// =============================================================================

/** Fetch time estimates for a plan */
export async function fetchTimeEstimates(
  planUuid: string,
): Promise<TpmTimeEstimate[]> {
  const result: unknown = await apiClient.get(
    `/tpm/plans/${planUuid}/time-estimates`,
  );
  return extractArray<TpmTimeEstimate>(result);
}

// =============================================================================
// ERROR HELPERS
// =============================================================================

/** Log API error with context */
export function logApiError(context: string, err: unknown): void {
  log.error({ err }, `TPM Employee API error: ${context}`);
}
