// =============================================================================
// KVP-DETAIL - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import { fetchCurrentUser as fetchSharedUser } from '$lib/utils/user-service';
import { getAuthToken } from '$lib/utils/auth';
import { API_ENDPOINTS, SHARE_LEVEL_TEXT } from './constants';
import type {
  User,
  KvpSuggestion,
  Comment,
  Attachment,
  Department,
  Team,
  Area,
  OrgLevel,
  KvpStatus,
} from './types';
import { base } from '$app/paths';
import { goto } from '$app/navigation';

const apiClient = getApiClient();

// =============================================================================
// SESSION HANDLING
// =============================================================================

function isSessionExpiredError(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === 'SESSION_EXPIRED'
  );
}

export function handleSessionExpired(): void {
  goto(`${base}/login?session=expired`);
}

function checkSessionExpired(err: unknown): boolean {
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
    console.info('[KVP-DETAIL API] User data loaded');
    return result.user as User | null;
  } catch (err) {
    console.error('[KVP-DETAIL API] Error fetching user:', err);
    checkSessionExpired(err);
    return null;
  }
}

// =============================================================================
// SUGGESTION
// =============================================================================

export async function fetchSuggestion(idOrUuid: string): Promise<KvpSuggestion | null> {
  try {
    const suggestion = await apiClient.get<KvpSuggestion>(API_ENDPOINTS.KVP_BY_ID(idOrUuid));
    console.info('[KVP-DETAIL API] Suggestion loaded:', suggestion.uuid);
    return suggestion;
  } catch (err) {
    console.error('[KVP-DETAIL API] Error fetching suggestion:', err);
    checkSessionExpired(err);
    return null;
  }
}

export async function updateSuggestionStatus(
  idOrUuid: string,
  status: KvpStatus,
  rejectionReason?: string,
): Promise<{ success: boolean; suggestion?: KvpSuggestion; error?: string }> {
  try {
    const data: { status: KvpStatus; rejectionReason?: string } = { status };
    if (rejectionReason !== undefined) {
      data.rejectionReason = rejectionReason;
    }

    // API client returns the suggestion directly (already unwrapped from { success, data } envelope)
    const suggestion = await apiClient.put<KvpSuggestion>(API_ENDPOINTS.KVP_BY_ID(idOrUuid), data);
    console.info('[KVP-DETAIL API] Status updated to:', status);
    return { success: true, suggestion };
  } catch (err) {
    console.error('[KVP-DETAIL API] Error updating status:', err);
    checkSessionExpired(err);
    const message = err instanceof Error ? err.message : 'Fehler beim Aktualisieren des Status';
    return { success: false, error: message };
  }
}

export async function archiveSuggestion(
  idOrUuid: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.delete(API_ENDPOINTS.KVP_BY_ID(idOrUuid));
    console.info('[KVP-DETAIL API] Suggestion archived');
    return { success: true };
  } catch (err) {
    console.error('[KVP-DETAIL API] Error archiving suggestion:', err);
    checkSessionExpired(err);
    const message = err instanceof Error ? err.message : 'Fehler beim Archivieren';
    return { success: false, error: message };
  }
}

// =============================================================================
// SHARE/UNSHARE
// =============================================================================

export async function shareSuggestion(
  idOrUuid: string,
  orgLevel: OrgLevel,
  orgId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.put(API_ENDPOINTS.KVP_SHARE(idOrUuid), { orgLevel, orgId });
    console.info('[KVP-DETAIL API] Suggestion shared at:', orgLevel);
    return { success: true };
  } catch (err) {
    console.error('[KVP-DETAIL API] Error sharing suggestion:', err);
    checkSessionExpired(err);
    const message = err instanceof Error ? err.message : 'Fehler beim Teilen';
    return { success: false, error: message };
  }
}

export async function unshareSuggestion(
  idOrUuid: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.post(API_ENDPOINTS.KVP_UNSHARE(idOrUuid), {});
    console.info('[KVP-DETAIL API] Suggestion unshared');
    return { success: true };
  } catch (err) {
    console.error('[KVP-DETAIL API] Error unsharing suggestion:', err);
    checkSessionExpired(err);
    const message = err instanceof Error ? err.message : 'Fehler beim Rueckgaengigmachen';
    return { success: false, error: message };
  }
}

export function getShareLevelText(orgLevel: OrgLevel): string {
  return SHARE_LEVEL_TEXT[orgLevel] ?? orgLevel;
}

// =============================================================================
// COMMENTS
// =============================================================================

export async function fetchComments(idOrUuid: string): Promise<Comment[]> {
  try {
    const comments = await apiClient.get<Comment[]>(API_ENDPOINTS.KVP_COMMENTS(idOrUuid));
    console.info('[KVP-DETAIL API] Comments loaded:', comments.length);
    return comments;
  } catch (err) {
    console.error('[KVP-DETAIL API] Error fetching comments:', err);
    return [];
  }
}

export async function addComment(
  idOrUuid: string,
  comment: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.post(API_ENDPOINTS.KVP_COMMENTS(idOrUuid), { comment });
    console.info('[KVP-DETAIL API] Comment added');
    return { success: true };
  } catch (err) {
    console.error('[KVP-DETAIL API] Error adding comment:', err);
    checkSessionExpired(err);
    const message = err instanceof Error ? err.message : 'Fehler beim Hinzufuegen des Kommentars';
    return { success: false, error: message };
  }
}

// =============================================================================
// ATTACHMENTS
// =============================================================================

export async function fetchAttachments(idOrUuid: string): Promise<Attachment[]> {
  try {
    const attachments = await apiClient.get<Attachment[]>(API_ENDPOINTS.KVP_ATTACHMENTS(idOrUuid));
    console.info('[KVP-DETAIL API] Attachments loaded:', attachments.length);
    return attachments;
  } catch (err) {
    console.error('[KVP-DETAIL API] Error fetching attachments:', err);
    return [];
  }
}

export function downloadAttachment(fileUuid: string): void {
  const token = getAuthToken();
  if (token === null || token === '') {
    console.error('[KVP-DETAIL API] Not authenticated for download');
    return;
  }
  const url = `/api/v2${API_ENDPOINTS.ATTACHMENT_DOWNLOAD(fileUuid)}?token=${encodeURIComponent(token)}`;
  window.open(url, '_blank');
}

export function getAttachmentPreviewUrl(fileUuid: string): string {
  const token = getAuthToken();
  if (token === null || token === '') {
    return '';
  }
  return `/api/v2${API_ENDPOINTS.ATTACHMENT_DOWNLOAD(fileUuid)}?token=${encodeURIComponent(token)}`;
}

// =============================================================================
// ORGANIZATION DATA (for share modal)
// =============================================================================

export async function fetchDepartments(): Promise<Department[]> {
  try {
    const departments = await apiClient.get<Department[]>(API_ENDPOINTS.DEPARTMENTS);
    return Array.isArray(departments) ? departments : [];
  } catch (err) {
    console.error('[KVP-DETAIL API] Error fetching departments:', err);
    return [];
  }
}

export async function fetchTeams(): Promise<Team[]> {
  try {
    const teams = await apiClient.get<Team[]>(API_ENDPOINTS.TEAMS);
    return Array.isArray(teams) ? teams : [];
  } catch (err) {
    console.error('[KVP-DETAIL API] Error fetching teams:', err);
    return [];
  }
}

export async function fetchAreas(): Promise<Area[]> {
  try {
    const areas = await apiClient.get<Area[]>(API_ENDPOINTS.AREAS);
    return Array.isArray(areas) ? areas : [];
  } catch (err) {
    console.error('[KVP-DETAIL API] Error fetching areas:', err);
    return [];
  }
}
