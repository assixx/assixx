// =============================================================================
// TPM (Total Productive Maintenance) - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';

import type {
  TpmPlan,
  TpmCard,
  PaginatedResponse,
  TpmColorConfigEntry,
  TpmEscalationConfig,
  TpmCardTemplate,
  TpmCardExecution,
  TpmTimeEstimate,
  Machine,
  SlotAvailabilityResult,
  CreatePlanPayload,
  UpdatePlanPayload,
  CreateTimeEstimatePayload,
  CreateCardPayload,
  UpdateCardPayload,
  CheckDuplicatePayload,
  DuplicateCheckResult,
} from './types';

const log = createLogger('TpmApi');
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

/** Type-safe extraction of paginated data from API response.
 *  Backend returns { data: T[], total, page, pageSize } after unwrap. */
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
// PLANS
// =============================================================================

/** Fetch paginated list of maintenance plans */
export async function fetchPlans(
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<TpmPlan>> {
  const result: unknown = await apiClient.get(
    `/tpm/plans?page=${page}&limit=${limit}`,
  );
  return extractPaginated<TpmPlan>(result);
}

/** Fetch single maintenance plan by UUID */
export async function fetchPlan(planUuid: string): Promise<TpmPlan> {
  return await apiClient.get<TpmPlan>(`/tpm/plans/${planUuid}`);
}

/** Create a new maintenance plan */
export async function createPlan(payload: CreatePlanPayload): Promise<TpmPlan> {
  return await apiClient.post<TpmPlan>('/tpm/plans', payload);
}

/** Update an existing maintenance plan */
export async function updatePlan(
  planUuid: string,
  payload: UpdatePlanPayload,
): Promise<TpmPlan> {
  return await apiClient.patch<TpmPlan>(`/tpm/plans/${planUuid}`, payload);
}

/** Soft-delete a maintenance plan */
export async function deletePlan(
  planUuid: string,
): Promise<{ message: string }> {
  return await apiClient.delete<{ message: string }>(`/tpm/plans/${planUuid}`);
}

// =============================================================================
// MACHINES
// =============================================================================

/** Fetch list of machines (for plan creation dropdown) */
export async function fetchMachines(): Promise<Machine[]> {
  const result: unknown = await apiClient.get('/machines');
  if (Array.isArray(result)) return result as Machine[];
  if (result !== null && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as Machine[];
  }
  return [];
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

/** Set (UPSERT) a time estimate for a plan */
export async function setTimeEstimate(
  planUuid: string,
  payload: CreateTimeEstimatePayload,
): Promise<TpmTimeEstimate> {
  return await apiClient.post<TpmTimeEstimate>(
    `/tpm/plans/${planUuid}/time-estimates`,
    payload,
  );
}

// =============================================================================
// SLOT ASSISTANT
// =============================================================================

/** Fetch available slots for a plan's machine */
export async function fetchAvailableSlots(
  planUuid: string,
  startDate: string,
  endDate: string,
): Promise<SlotAvailabilityResult | null> {
  try {
    return await apiClient.get<SlotAvailabilityResult>(
      `/tpm/plans/${planUuid}/available-slots?startDate=${startDate}&endDate=${endDate}`,
    );
  } catch (err: unknown) {
    log.error({ err }, 'Error loading available slots');
    return null;
  }
}

// =============================================================================
// CARDS
// =============================================================================

/** Fetch paginated list of cards with optional filters */
export async function fetchCards(
  filters: {
    planUuid?: string;
    machineUuid?: string;
    status?: string;
    intervalType?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<PaginatedResponse<TpmCard>> {
  const params = new URLSearchParams();
  if (filters.planUuid !== undefined) params.set('planUuid', filters.planUuid);
  if (filters.machineUuid !== undefined)
    params.set('machineUuid', filters.machineUuid);
  if (filters.status !== undefined) params.set('status', filters.status);
  if (filters.intervalType !== undefined)
    params.set('intervalType', filters.intervalType);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 20));

  const queryString = params.toString();
  const result: unknown = await apiClient.get(`/tpm/cards?${queryString}`);
  return extractPaginated<TpmCard>(result);
}

/** Fetch board data (cards for a specific plan) */
export async function fetchBoardData(
  planUuid: string,
  page = 1,
  limit = 50,
): Promise<PaginatedResponse<TpmCard>> {
  const result: unknown = await apiClient.get(
    `/tpm/plans/${planUuid}/board?page=${page}&limit=${limit}`,
  );
  return extractPaginated<TpmCard>(result);
}

/** Fetch single card by UUID */
export async function fetchCard(cardUuid: string): Promise<TpmCard> {
  return await apiClient.get<TpmCard>(`/tpm/cards/${cardUuid}`);
}

/** Create a new card */
export async function createCard(payload: CreateCardPayload): Promise<TpmCard> {
  return await apiClient.post<TpmCard>('/tpm/cards', payload);
}

/** Update an existing card */
export async function updateCard(
  cardUuid: string,
  payload: UpdateCardPayload,
): Promise<TpmCard> {
  return await apiClient.patch<TpmCard>(`/tpm/cards/${cardUuid}`, payload);
}

/** Soft-delete a card */
export async function deleteCard(
  cardUuid: string,
): Promise<{ message: string }> {
  return await apiClient.delete<{ message: string }>(`/tpm/cards/${cardUuid}`);
}

/** Check for potential duplicate cards */
export async function checkDuplicate(
  payload: CheckDuplicatePayload,
): Promise<DuplicateCheckResult> {
  return await apiClient.post<DuplicateCheckResult>(
    '/tpm/cards/check-duplicate',
    payload,
  );
}

// =============================================================================
// EXECUTIONS
// =============================================================================

/** Fetch pending approval executions */
export async function fetchPendingApprovals(
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<TpmCardExecution>> {
  const result: unknown = await apiClient.get(
    `/tpm/executions/pending-approvals?page=${page}&limit=${limit}`,
  );
  return extractPaginated<TpmCardExecution>(result);
}

// =============================================================================
// CONFIG
// =============================================================================

/** Fetch color configuration */
export async function fetchColors(): Promise<TpmColorConfigEntry[]> {
  const result: unknown = await apiClient.get('/tpm/config/colors');
  return extractArray<TpmColorConfigEntry>(result);
}

/** Fetch escalation configuration */
export async function fetchEscalationConfig(): Promise<TpmEscalationConfig> {
  return await apiClient.get<TpmEscalationConfig>('/tpm/config/escalation');
}

/** Fetch card templates */
export async function fetchTemplates(): Promise<TpmCardTemplate[]> {
  const result: unknown = await apiClient.get('/tpm/config/templates');
  return extractArray<TpmCardTemplate>(result);
}

// =============================================================================
// ERROR HELPERS
// =============================================================================

/** Check if error indicates session expired */
export function isSessionExpiredError(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === 'SESSION_EXPIRED'
  );
}

/** Log API error with context */
export function logApiError(context: string, err: unknown): void {
  log.error({ err }, `TPM API error: ${context}`);
}
