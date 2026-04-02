// =============================================================================
// TPM (Total Productive Maintenance) - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import { extractArray } from '$lib/utils/api-response';
import { createLogger } from '$lib/utils/logger';

import type {
  TpmPlan,
  TpmCard,
  TpmPlanAssignment,
  PaginatedResponse,
  TpmColorConfigEntry,
  TpmEscalationConfig,
  TpmCardExecution,
  TpmTimeEstimate,
  Asset,
  SlotAvailabilityResult,
  ScheduleProjectionResult,
  AssetTeamAvailabilityResult,
  CreatePlanPayload,
  UpdatePlanPayload,
  CreateTimeEstimatePayload,
  CreateCardPayload,
  UpdateCardPayload,
  CheckDuplicatePayload,
  DuplicateCheckResult,
  UpdateColorPayload,
  UpdateIntervalColorPayload,
  IntervalColorConfigEntry,
  CategoryColorConfigEntry,
  UpdateCategoryColorPayload,
  UpdateEscalationPayload,
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

// =============================================================================
// PLANS
// =============================================================================

/** Fetch paginated list of maintenance plans */
export async function fetchPlans(page = 1, limit = 20): Promise<PaginatedResponse<TpmPlan>> {
  const result: unknown = await apiClient.get(`/tpm/plans?page=${page}&limit=${limit}`);
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
export async function updatePlan(planUuid: string, payload: UpdatePlanPayload): Promise<TpmPlan> {
  return await apiClient.patch<TpmPlan>(`/tpm/plans/${planUuid}`, payload);
}

/** Soft-delete a maintenance plan */
export async function deletePlan(planUuid: string): Promise<{ message: string }> {
  return await apiClient.delete<{ message: string }>(`/tpm/plans/${planUuid}`);
}

/** Archive a maintenance plan (is_active = 3) */
export async function archivePlan(planUuid: string): Promise<boolean> {
  try {
    await apiClient.post(`/tpm/plans/${planUuid}/archive`, {});
    return true;
  } catch {
    return false;
  }
}

/** Unarchive/restore a maintenance plan (is_active = 1) */
export async function unarchivePlan(planUuid: string): Promise<boolean> {
  try {
    await apiClient.post(`/tpm/plans/${planUuid}/unarchive`, {});
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// MACHINES
// =============================================================================

/** Fetch list of assets (for plan creation dropdown) */
export async function fetchAssets(): Promise<Asset[]> {
  const result: unknown = await apiClient.get('/assets');
  if (Array.isArray(result)) return result as Asset[];
  if (result !== null && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as Asset[];
  }
  return [];
}

// =============================================================================
// TIME ESTIMATES
// =============================================================================

/** Fetch time estimates for a plan */
export async function fetchTimeEstimates(planUuid: string): Promise<TpmTimeEstimate[]> {
  const result: unknown = await apiClient.get(`/tpm/plans/${planUuid}/time-estimates`);
  return extractArray<TpmTimeEstimate>(result);
}

/** Set (UPSERT) a time estimate for a plan */
export async function setTimeEstimate(
  planUuid: string,
  payload: CreateTimeEstimatePayload,
): Promise<TpmTimeEstimate> {
  return await apiClient.post<TpmTimeEstimate>(`/tpm/plans/${planUuid}/time-estimates`, payload);
}

// =============================================================================
// SLOT ASSISTANT
// =============================================================================

/** Fetch available slots for a plan's asset */
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

/** Fetch available slots by asset UUID (no plan needed, for create mode) */
export async function fetchAvailableSlotsByAsset(
  assetUuid: string,
  startDate: string,
  endDate: string,
): Promise<SlotAvailabilityResult | null> {
  try {
    const params = new URLSearchParams({ assetUuid, startDate, endDate });
    return await apiClient.get<SlotAvailabilityResult>(
      `/tpm/plans/available-slots?${params.toString()}`,
    );
  } catch (err: unknown) {
    log.error({ err }, 'Error loading available slots by asset');
    return null;
  }
}

// =============================================================================
// SCHEDULE PROJECTION
// =============================================================================

/** Fetch projected maintenance schedules across all active plans (max 3650 days) */
export async function fetchScheduleProjection(
  startDate: string,
  endDate: string,
  excludePlanUuid?: string,
): Promise<ScheduleProjectionResult | null> {
  try {
    const params = new URLSearchParams({ startDate, endDate });
    if (excludePlanUuid !== undefined) {
      params.set('excludePlanUuid', excludePlanUuid);
    }
    return await apiClient.get<ScheduleProjectionResult>(
      `/tpm/plans/schedule-projection?${params.toString()}`,
    );
  } catch (err: unknown) {
    log.error({ err }, 'Error loading schedule projection');
    return null;
  }
}

// =============================================================================
// TEAM AVAILABILITY
// =============================================================================

/** Fetch team member availability for a plan's asset */
export async function fetchTeamAvailability(
  planUuid: string,
): Promise<AssetTeamAvailabilityResult | null> {
  try {
    return await apiClient.get<AssetTeamAvailabilityResult>(
      `/tpm/plans/${planUuid}/team-availability`,
    );
  } catch (err: unknown) {
    log.error({ err }, 'Error loading team availability');
    return null;
  }
}

// =============================================================================
// PLAN ASSIGNMENTS
// =============================================================================

/** Fetch assignments for a plan in a date range */
export async function fetchPlanAssignments(
  planUuid: string,
  startDate: string,
  endDate: string,
): Promise<TpmPlanAssignment[]> {
  try {
    const params = new URLSearchParams({ startDate, endDate });
    const result: unknown = await apiClient.get(
      `/tpm/plans/${planUuid}/assignments?${params.toString()}`,
    );
    return extractArray<TpmPlanAssignment>(result);
  } catch (err: unknown) {
    log.error({ err }, 'Error loading plan assignments');
    return [];
  }
}

/** Set (replace) assignments for a plan on a specific date */
export async function setPlanAssignments(
  planUuid: string,
  userIds: number[],
  scheduledDate: string,
): Promise<TpmPlanAssignment[]> {
  const result: unknown = await apiClient.post(`/tpm/plans/${planUuid}/assignments`, {
    userIds,
    scheduledDate,
  });
  return extractArray<TpmPlanAssignment>(result);
}

// =============================================================================
// CARDS
// =============================================================================

/** Fetch paginated list of cards with optional filters */
export async function fetchCards(
  filters: {
    planUuid?: string;
    assetUuid?: string;
    status?: string;
    intervalType?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<PaginatedResponse<TpmCard>> {
  const params = new URLSearchParams();
  if (filters.planUuid !== undefined) params.set('planUuid', filters.planUuid);
  if (filters.assetUuid !== undefined) params.set('assetUuid', filters.assetUuid);
  if (filters.status !== undefined) params.set('status', filters.status);
  if (filters.intervalType !== undefined) params.set('intervalType', filters.intervalType);
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
export async function updateCard(cardUuid: string, payload: UpdateCardPayload): Promise<TpmCard> {
  return await apiClient.patch<TpmCard>(`/tpm/cards/${cardUuid}`, payload);
}

/** Soft-delete a card */
export async function deleteCard(cardUuid: string): Promise<{ message: string }> {
  return await apiClient.delete<{ message: string }>(`/tpm/cards/${cardUuid}`);
}

/** Check for potential duplicate cards */
export async function checkDuplicate(
  payload: CheckDuplicatePayload,
): Promise<DuplicateCheckResult> {
  return await apiClient.post<DuplicateCheckResult>('/tpm/cards/check-duplicate', payload);
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

/** Update a single color config entry */
export async function updateColor(payload: UpdateColorPayload): Promise<TpmColorConfigEntry> {
  return await apiClient.patch<TpmColorConfigEntry>('/tpm/config/colors', payload);
}

/** Reset all card status colors to defaults */
export async function resetColors(): Promise<TpmColorConfigEntry[]> {
  const result: unknown = await apiClient.post('/tpm/config/colors/reset', {});
  return extractArray<TpmColorConfigEntry>(result);
}

/** Reset a single status color to its default */
export async function resetSingleColor(statusKey: string): Promise<TpmColorConfigEntry> {
  return await apiClient.delete<TpmColorConfigEntry>(`/tpm/config/colors/${statusKey}`);
}

/** Fetch interval color configuration */
export async function fetchIntervalColors(): Promise<IntervalColorConfigEntry[]> {
  const result: unknown = await apiClient.get('/tpm/config/interval-colors');
  return extractArray<IntervalColorConfigEntry>(result);
}

/** Update a single interval color config entry */
export async function updateIntervalColor(
  payload: UpdateIntervalColorPayload,
): Promise<IntervalColorConfigEntry> {
  return await apiClient.patch<IntervalColorConfigEntry>('/tpm/config/interval-colors', payload);
}

/** Reset all interval colors to defaults */
export async function resetIntervalColors(): Promise<IntervalColorConfigEntry[]> {
  const result: unknown = await apiClient.post('/tpm/config/interval-colors/reset', {});
  return extractArray<IntervalColorConfigEntry>(result);
}

/** Reset a single interval color to its default */
export async function resetSingleIntervalColor(
  intervalKey: string,
): Promise<IntervalColorConfigEntry> {
  return await apiClient.delete<IntervalColorConfigEntry>(
    `/tpm/config/interval-colors/${intervalKey}`,
  );
}

// =============================================================================
// CATEGORY COLORS
// =============================================================================

/** Fetch category color configuration */
export async function fetchCategoryColors(): Promise<CategoryColorConfigEntry[]> {
  const result: unknown = await apiClient.get('/tpm/config/category-colors');
  return extractArray<CategoryColorConfigEntry>(result);
}

/** Update a single category color config entry */
export async function updateCategoryColor(
  payload: UpdateCategoryColorPayload,
): Promise<CategoryColorConfigEntry> {
  return await apiClient.patch<CategoryColorConfigEntry>('/tpm/config/category-colors', payload);
}

/** Reset all category colors (remove custom colors) */
export async function resetCategoryColors(): Promise<CategoryColorConfigEntry[]> {
  const result: unknown = await apiClient.post('/tpm/config/category-colors/reset', {});
  return extractArray<CategoryColorConfigEntry>(result);
}

/** Reset a single category color (remove custom color) */
export async function resetSingleCategoryColor(
  categoryKey: string,
): Promise<CategoryColorConfigEntry> {
  return await apiClient.delete<CategoryColorConfigEntry>(
    `/tpm/config/category-colors/${categoryKey}`,
  );
}

/** Update escalation configuration */
export async function updateEscalation(
  payload: UpdateEscalationPayload,
): Promise<TpmEscalationConfig> {
  return await apiClient.patch<TpmEscalationConfig>('/tpm/config/escalation', payload);
}

// =============================================================================
// ERROR HELPERS
// =============================================================================

/** Log API error with context */
export function logApiError(context: string, err: unknown): void {
  log.error({ err }, `TPM API error: ${context}`);
}
