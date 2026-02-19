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
} from './types';

const log = createLogger('TpmApi');
const apiClient = getApiClient();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Type-safe extraction of paginated data from API response */
function extractPaginated<T>(result: unknown): PaginatedResponse<T> {
  if (result !== null && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    return {
      items: Array.isArray(obj.items) ? (obj.items as T[]) : [],
      total: typeof obj.total === 'number' ? obj.total : 0,
      page: typeof obj.page === 'number' ? obj.page : 1,
      limit: typeof obj.limit === 'number' ? obj.limit : 20,
    };
  }
  return { items: [], total: 0, page: 1, limit: 20 };
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

/** Soft-delete a maintenance plan */
export async function deletePlan(
  planUuid: string,
): Promise<{ message: string }> {
  return await apiClient.delete<{ message: string }>(`/tpm/plans/${planUuid}`);
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
