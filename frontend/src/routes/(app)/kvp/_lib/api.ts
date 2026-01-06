// =============================================================================
// KVP - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
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
import { base } from '$app/paths';
import { goto } from '$app/navigation';

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
  goto(`${base}/login?session=expired`);
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
    console.info('[KVP API] User data loaded:', result.user);
    return result.user as User | null;
  } catch (err) {
    console.error('[KVP API] Error fetching user:', err);
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
    const categories = await apiClient.get<KvpCategory[]>(API_ENDPOINTS.KVP_CATEGORIES);
    console.info('[KVP API] Categories loaded:', categories.length);
    return categories;
  } catch (err) {
    console.error('[KVP API] Error loading categories:', err);
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
    const departments = Array.isArray(response) ? response : (response.data ?? []);
    console.info('[KVP API] Departments loaded:', departments.length);
    return departments;
  } catch (err) {
    console.error('[KVP API] Error loading departments:', err);
    return [];
  }
}

/**
 * Load teams
 */
export async function loadTeams(): Promise<Team[]> {
  try {
    const response = await apiClient.get<PaginatedResponse<Team> | Team[]>(API_ENDPOINTS.TEAMS);
    const teams = Array.isArray(response) ? response : (response.data ?? []);
    console.info('[KVP API] Teams loaded:', teams.length);
    return teams;
  } catch (err) {
    console.error('[KVP API] Error loading teams:', err);
    return [];
  }
}

// =============================================================================
// SUGGESTIONS
// =============================================================================

/**
 * Build query params for suggestions API
 */
function buildSuggestionParams(
  filter: KvpFilter,
  statusFilter: string,
  categoryFilter: string,
  departmentFilter: string,
  searchQuery: string,
): URLSearchParams {
  const params = new URLSearchParams({ filter });

  if (statusFilter !== '') params.append('status', statusFilter);
  if (categoryFilter !== '') params.append('categoryId', categoryFilter);
  if (departmentFilter !== '') params.append('departmentId', departmentFilter);
  if (searchQuery !== '') params.append('search', searchQuery);
  if (filter === 'archived') params.append('includeArchived', 'true');

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

    console.info('[KVP API] Suggestions loaded:', response.suggestions?.length ?? 0);
    return response.suggestions ?? [];
  } catch (err) {
    console.error('[KVP API] Error fetching suggestions:', err);
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
    console.info('[KVP API] Suggestion created:', response.id);
    return { success: true, id: response.id };
  } catch (err) {
    console.error('[KVP API] Error creating suggestion:', err);
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

    console.info('[KVP API] Uploading photos:', photos.length, 'for suggestion', suggestionId);
    await apiClient.upload(API_ENDPOINTS.KVP_ATTACHMENTS(suggestionId), formData);

    return { success: true };
  } catch (err) {
    console.error('[KVP API] Error uploading photos:', err);
    const message = err instanceof Error ? err.message : 'Fehler beim Hochladen der Fotos';
    return { success: false, error: message };
  }
}

/**
 * Share suggestion company-wide
 */
export async function shareSuggestion(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.post(API_ENDPOINTS.KVP_SHARE(id), {});
    console.info('[KVP API] Suggestion shared:', id);
    return { success: true };
  } catch (err) {
    console.error('[KVP API] Error sharing suggestion:', err);
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
    await apiClient.post(API_ENDPOINTS.KVP_UNSHARE(id), {});
    console.info('[KVP API] Suggestion unshared:', id);
    return { success: true };
  } catch (err) {
    console.error('[KVP API] Error unsharing suggestion:', err);
    checkSessionExpired(err);

    const message = err instanceof Error ? err.message : 'Fehler beim Rueckgaengigmachen';
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

    console.info('[KVP API] Statistics loaded');
    return stats;
  } catch (err) {
    console.error('[KVP API] Error fetching statistics:', err);
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
    console.error('[KVP API] Error finding user team:', err);
    return null;
  }
}
