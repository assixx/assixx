// =============================================================================
// KVP - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';
import { checkSessionExpired } from '$lib/utils/session-expired.js';
import { fetchCurrentUser as fetchSharedUser } from '$lib/utils/user-service';

import { API_ENDPOINTS } from './constants';

import type {
  User,
  KvpSuggestion,
  KvpCategory,
  Department,
  Team,
  KvpStats,
  KvpFormData,
  SuggestionsResponse,
  PaginatedResponse,
  KvpFilter,
  UserTeamWithAssets,
} from './types';

const log = createLogger('KvpApi');

const apiClient = getApiClient();

// =============================================================================
// USER DATA
// =============================================================================

/**
 * Fetch current user data
 * DELEGATES to shared user service (prevents duplicate /users/me calls)
 */
export async function fetchUserData(): Promise<User | null> {
  try {
    const result = await fetchSharedUser();
    return result.user;
  } catch (err: unknown) {
    log.error({ err }, 'Error fetching user');
    checkSessionExpired(err);
    return null;
  }
}

// =============================================================================
// CATEGORIES
// =============================================================================

/**
 * Load KVP categories
 */
export async function loadCategories(): Promise<KvpCategory[]> {
  try {
    return await apiClient.get<KvpCategory[]>(API_ENDPOINTS.KVP_CATEGORIES);
  } catch (err: unknown) {
    log.error({ err }, 'Error loading categories');
    return [];
  }
}

// =============================================================================
// DEPARTMENTS & TEAMS
// =============================================================================

/**
 * Load departments
 */
export async function loadDepartments(): Promise<Department[]> {
  try {
    const response = await apiClient.get<PaginatedResponse<Department> | Department[]>(
      API_ENDPOINTS.DEPARTMENTS,
    );
    return Array.isArray(response) ? response : response.data;
  } catch (err: unknown) {
    log.error({ err }, 'Error loading departments');
    return [];
  }
}

/**
 * Load teams
 */
export async function loadTeams(): Promise<Team[]> {
  try {
    const response = await apiClient.get<PaginatedResponse<Team> | Team[]>(API_ENDPOINTS.TEAMS);
    return Array.isArray(response) ? response : response.data;
  } catch (err: unknown) {
    log.error({ err }, 'Error loading teams');
    return [];
  }
}

// =============================================================================
// SUGGESTIONS
// =============================================================================

/** Parse a source:id category filter value into params */
function appendCategoryParam(params: URLSearchParams, value: string): void {
  if (value === '') return;

  if (!value.includes(':')) {
    params.append('categoryId', value);
    return;
  }

  const [source, id] = value.split(':');
  const key = source === 'custom' ? 'customCategoryId' : 'categoryId';
  params.append(key, id);
}

/**
 * Build query params for suggestions API
 * Maps frontend filter values to backend API parameters
 */
function buildSuggestionParams(
  filter: KvpFilter,
  statusFilter: string,
  categoryFilter: string,
  departmentFilter: string,
  teamFilter: string,
  assetFilter: string,
  searchQuery: string,
): URLSearchParams {
  const params = new URLSearchParams();

  // Map filter to backend orgLevel parameter
  const orgLevelFilters = ['team', 'asset', 'department', 'area', 'company'];
  if (orgLevelFilters.includes(filter)) {
    params.append('orgLevel', filter);
  }

  if (filter === 'mine') {
    params.append('mineOnly', 'true');
  }

  if (filter === 'archived') {
    params.append('status', 'archived');
  } else if (statusFilter !== '') {
    params.append('status', statusFilter);
  }

  appendCategoryParam(params, categoryFilter);
  if (departmentFilter !== '') params.append('departmentId', departmentFilter);
  if (teamFilter !== '') params.append('teamId', teamFilter);
  if (assetFilter !== '') params.append('assetId', assetFilter);
  if (searchQuery !== '') params.append('search', searchQuery);

  return params;
}

/**
 * Fetch suggestions with filters
 */
export async function fetchSuggestions(
  filter: KvpFilter,
  statusFilter: string,
  categoryFilter: string,
  departmentFilter: string,
  teamFilter: string,
  assetFilter: string,
  searchQuery: string,
): Promise<KvpSuggestion[]> {
  try {
    const params = buildSuggestionParams(
      filter,
      statusFilter,
      categoryFilter,
      departmentFilter,
      teamFilter,
      assetFilter,
      searchQuery,
    );

    const response = await apiClient.get<SuggestionsResponse>(`${API_ENDPOINTS.KVP}?${params}`);

    return response.suggestions;
  } catch (err: unknown) {
    log.error({ err }, 'Error fetching suggestions');
    checkSessionExpired(err);
    throw err;
  }
}

/**
 * Create new suggestion
 */
export async function createSuggestion(
  data: KvpFormData,
): Promise<{ success: boolean; id?: number; error?: string }> {
  try {
    const response = await apiClient.post<{ id: number }>(API_ENDPOINTS.KVP, data);
    return { success: true, id: response.id };
  } catch (err: unknown) {
    log.error({ err }, 'Error creating suggestion');
    checkSessionExpired(err);

    const message = err instanceof Error ? err.message : 'Fehler beim Erstellen des Vorschlags';
    return { success: false, error: message };
  }
}

/**
 * Upload photos for suggestion
 */
export async function uploadPhotos(
  suggestionId: number,
  photos: File[],
): Promise<{ success: boolean; error?: string }> {
  try {
    const formData = new FormData();
    photos.forEach((photo) => {
      formData.append('files', photo);
    });

    await apiClient.upload(API_ENDPOINTS.kvpAttachments(suggestionId), formData);

    return { success: true };
  } catch (err: unknown) {
    log.error({ err }, 'Error uploading photos');
    const message = err instanceof Error ? err.message : 'Fehler beim Hochladen der Fotos';
    return { success: false, error: message };
  }
}

/**
 * Share suggestion company-wide
 */
export async function shareSuggestion(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.post(API_ENDPOINTS.kvpShare(id), {});
    return { success: true };
  } catch (err: unknown) {
    log.error({ err }, 'Error sharing suggestion');
    checkSessionExpired(err);

    const message = err instanceof Error ? err.message : 'Fehler beim Teilen des Vorschlags';
    return { success: false, error: message };
  }
}

/**
 * Unshare suggestion
 */
export async function unshareSuggestion(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.post(API_ENDPOINTS.kvpUnshare(id), {});
    return { success: true };
  } catch (err: unknown) {
    log.error({ err }, 'Error unsharing suggestion');
    checkSessionExpired(err);

    const message = err instanceof Error ? err.message : 'Fehler beim rückgängigmachen';
    return { success: false, error: message };
  }
}

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Fetch dashboard statistics
 */
export async function fetchStatistics(): Promise<KvpStats | null> {
  try {
    return await apiClient.get<KvpStats>(API_ENDPOINTS.KVP_STATS);
  } catch (err: unknown) {
    log.error({ err }, 'Error fetching statistics');
    checkSessionExpired(err);
    return null;
  }
}

// =============================================================================
// USER ORGANIZATIONS (teams + assets)
// =============================================================================

/**
 * Load user's teams with their assigned assets
 */
export async function loadMyOrganizations(): Promise<UserTeamWithAssets[]> {
  try {
    return await apiClient.get<UserTeamWithAssets[]>(API_ENDPOINTS.KVP_MY_ORGANIZATIONS);
  } catch (err: unknown) {
    log.error({ err }, 'Error loading user organizations');
    checkSessionExpired(err);
    return [];
  }
}

// =============================================================================
// TEAM VALIDATION
// =============================================================================

/**
 * Find team where user is lead
 */
export async function findUserTeamAsLead(userId: number): Promise<Team | null> {
  try {
    const teams = await loadTeams();
    const userTeam = teams.find(
      (team) =>
        team.team_lead_id === userId ||
        team.teamLeadId === userId ||
        team.leaderId === userId ||
        team.teamDeputyLeadId === userId,
    );
    return userTeam ?? null;
  } catch (err: unknown) {
    log.error({ err }, 'Error finding user team');
    return null;
  }
}
