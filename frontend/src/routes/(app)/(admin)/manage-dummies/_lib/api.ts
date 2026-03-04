// =============================================================================
// Manage Dummies — API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';

import type {
  CreateDummyPayload,
  DummyUser,
  PaginatedDummies,
  Team,
  UpdateDummyPayload,
} from './types';

const log = createLogger('DummyUsersApi');
const apiClient = getApiClient();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Type-safe extraction of paginated dummies from API response */
function extractPaginated(result: unknown): PaginatedDummies {
  if (result === null || typeof result !== 'object') {
    return {
      data: [],
      pagination: { currentPage: 1, totalPages: 1, totalItems: 0 },
    };
  }
  const obj = result as Record<string, unknown>;
  const data = Array.isArray(obj.data) ? (obj.data as DummyUser[]) : [];
  const pag =
    typeof obj.pagination === 'object' && obj.pagination !== null ?
      (obj.pagination as PaginatedDummies['pagination'])
    : { currentPage: 1, totalPages: 1, totalItems: 0 };
  return { data, pagination: pag };
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
// CORE CRUD
// =============================================================================

/** Create a new dummy user */
export async function createDummy(
  payload: CreateDummyPayload,
): Promise<DummyUser> {
  return await apiClient.post<DummyUser>('/dummy-users', payload);
}

/** Fetch paginated list of dummy users */
export async function listDummies(
  page = 1,
  limit = 20,
  filters: { isActive?: number | 'all'; search?: string } = {},
): Promise<PaginatedDummies> {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));

  if (filters.isActive !== undefined && filters.isActive !== 'all') {
    params.set('isActive', String(filters.isActive));
  }
  if (filters.search !== undefined && filters.search !== '') {
    params.set('search', filters.search);
  }

  const result: unknown = await apiClient.get(
    `/dummy-users?${params.toString()}`,
  );
  return extractPaginated(result);
}

/** Fetch a single dummy user by UUID */
export async function getDummy(uuid: string): Promise<DummyUser> {
  return await apiClient.get<DummyUser>(`/dummy-users/${uuid}`);
}

/** Update a dummy user */
export async function updateDummy(
  uuid: string,
  payload: UpdateDummyPayload,
): Promise<DummyUser> {
  return await apiClient.put<DummyUser>(`/dummy-users/${uuid}`, payload);
}

/** Soft-delete a dummy user (is_active=4) */
export async function deleteDummy(uuid: string): Promise<void> {
  await apiClient.delete(`/dummy-users/${uuid}`);
}

// =============================================================================
// TEAMS
// =============================================================================

/** Fetch all teams for team multi-select */
export async function loadTeams(): Promise<Team[]> {
  const result: unknown = await apiClient.get('/teams');
  return extractArray<Team>(result);
}

// =============================================================================
// ERROR HELPERS
// =============================================================================

/** Log API error with context */
export function logApiError(context: string, err: unknown): void {
  log.error({ err }, `DummyUsers API error: ${context}`);
}
