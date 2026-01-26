// =============================================================================
// KVP - API FUNCTIONS
// =============================================================================

import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';
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
} from './types';

const log = createLogger('KvpApi');

const apiClient = getApiClient();

// =============================================================================
// SESSION HANDLING
// =============================================================================

/**
 * Check if error is a session expired error
 */
function isSessionExpiredError(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === 'SESSION_EXPIRED'
  );
}

/**
 * Handle session expired error
 */
export function handleSessionExpired(): void {
  void goto(resolve('/login?session=expired', {}));
}

/**
 * Check for session expired and redirect
 */
export function checkSessionExpired(err: unknown): boolean {
  if (isSessionExpiredError(err)) {
    handleSessionExpired();
    return true;
  }
  return false;
}

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
    return result.user as User | null;
  } catch (err) {
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
  } catch (err) {
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
  } catch (err) {
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
  } catch (err) {
    log.error({ err }, 'Error loading teams');
    return [];
  }
}

// =============================================================================
// SUGGESTIONS
// =============================================================================

/**
 * Build query params for suggestions API
 * Maps frontend filter values to backend API parameters
 */
function buildSuggestionParams(
  filter: KvpFilter,
  statusFilter: string,
  categoryFilter: string,
  departmentFilter: string,
  searchQuery: string,
): URLSearchParams {
  const params = new URLSearchParams();

  // Map filter to backend orgLevel parameter
  // Backend expects: orgLevel = 'team' | 'department' | 'area' | 'company'
  const orgLevelFilters = ['team', 'department', 'area', 'company'];
  if (orgLevelFilters.includes(filter)) {
    params.append('orgLevel', filter);
  }

  // Handle "mine" filter - show only current user's submissions
  if (filter === 'mine') {
    params.append('mineOnly', 'true');
  }

  // Handle archived filter
  if (filter === 'archived') {
    params.append('status', 'archived');
  } else if (statusFilter !== '') {
    params.append('status', statusFilter);
  }

  if (categoryFilter !== '') params.append('categoryId', categoryFilter);
  if (departmentFilter !== '') params.append('departmentId', departmentFilter);
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
  searchQuery: string,
): Promise<KvpSuggestion[]> {
  try {
    const params = buildSuggestionParams(
      filter,
      statusFilter,
      categoryFilter,
      departmentFilter,
      searchQuery,
    );

    const response = await apiClient.get<SuggestionsResponse>(`${API_ENDPOINTS.KVP}?${params}`);

    return response.suggestions;
  } catch (err) {
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
  } catch (err) {
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
  } catch (err) {
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
  } catch (err) {
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
  } catch (err) {
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
    const rawData = await apiClient.get<KvpStats>(API_ENDPOINTS.KVP_STATS);

    // Normalize response format
    const stats: KvpStats = rawData.company
      ? rawData
      : {
          company: {
            total: rawData.total ?? 0,
            byStatus: rawData.byStatus ?? {},
            totalSavings: rawData.totalSavings ?? 0,
          },
        };

    return stats;
  } catch (err) {
    log.error({ err }, 'Error fetching statistics');
    checkSessionExpired(err);
    return null;
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
        team.team_lead_id === userId || team.teamLeadId === userId || team.leaderId === userId,
    );
    return userTeam ?? null;
  } catch (err) {
    log.error({ err }, 'Error finding user team');
    return null;
  }
}
