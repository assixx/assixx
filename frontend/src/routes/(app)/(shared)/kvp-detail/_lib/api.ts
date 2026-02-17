// =============================================================================
// KVP-DETAIL - API FUNCTIONS
// =============================================================================

import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';
import { fetchCurrentUser as fetchSharedUser } from '$lib/utils/user-service';

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
  PaginatedComments,
} from './types';

const log = createLogger('KvpDetailApi');

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
  void goto(resolve('/login?session=expired', {}));
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
    return result.user as User | null;
  } catch (err) {
    log.error({ err }, 'Error fetching user');
    checkSessionExpired(err);
    return null;
  }
}

// =============================================================================
// SUGGESTION
// =============================================================================

export async function fetchSuggestion(
  idOrUuid: string,
): Promise<KvpSuggestion | null> {
  try {
    return await apiClient.get<KvpSuggestion>(API_ENDPOINTS.kvpById(idOrUuid));
  } catch (err) {
    log.error({ err }, 'Error fetching suggestion');
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
    const suggestion = await apiClient.put<KvpSuggestion>(
      API_ENDPOINTS.kvpById(idOrUuid),
      data,
    );
    return { success: true, suggestion };
  } catch (err) {
    log.error({ err }, 'Error updating status');
    checkSessionExpired(err);
    const message =
      err instanceof Error ?
        err.message
      : 'Fehler beim Aktualisieren des Status';
    return { success: false, error: message };
  }
}

export async function archiveSuggestion(
  idOrUuid: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.post(API_ENDPOINTS.kvpArchive(idOrUuid), {});
    return { success: true };
  } catch (err) {
    log.error({ err }, 'Error archiving suggestion');
    checkSessionExpired(err);
    const message =
      err instanceof Error ? err.message : 'Fehler beim Archivieren';
    return { success: false, error: message };
  }
}

/**
 * Unarchive (restore) a suggestion
 */
export async function unarchiveSuggestion(
  idOrUuid: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.post(API_ENDPOINTS.kvpUnarchive(idOrUuid), {});
    return { success: true };
  } catch (err) {
    log.error({ err }, 'Error unarchiving suggestion');
    checkSessionExpired(err);
    const message =
      err instanceof Error ? err.message : 'Fehler beim Wiederherstellen';
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
    await apiClient.put(API_ENDPOINTS.kvpShare(idOrUuid), { orgLevel, orgId });
    return { success: true };
  } catch (err) {
    log.error({ err }, 'Error sharing suggestion');
    checkSessionExpired(err);
    const message = err instanceof Error ? err.message : 'Fehler beim Teilen';
    return { success: false, error: message };
  }
}

export async function unshareSuggestion(
  idOrUuid: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.post(API_ENDPOINTS.kvpUnshare(idOrUuid), {});
    return { success: true };
  } catch (err) {
    log.error({ err }, 'Error unsharing suggestion');
    checkSessionExpired(err);
    const message =
      err instanceof Error ? err.message : 'Fehler beim rückgängigmachen';
    return { success: false, error: message };
  }
}

export function getShareLevelText(orgLevel: OrgLevel): string {
  return SHARE_LEVEL_TEXT[orgLevel];
}

// =============================================================================
// COMMENTS
// =============================================================================

export async function fetchComments(
  idOrUuid: string,
  limit: number = 20,
  offset: number = 0,
): Promise<PaginatedComments> {
  try {
    return await apiClient.get<PaginatedComments>(
      `${API_ENDPOINTS.kvpComments(idOrUuid)}?limit=${limit}&offset=${offset}`,
    );
  } catch (err) {
    log.error({ err }, 'Error fetching comments');
    return { comments: [], total: 0, hasMore: false };
  }
}

export async function fetchReplies(commentId: number): Promise<Comment[]> {
  try {
    return await apiClient.get<Comment[]>(`/kvp/comments/${commentId}/replies`);
  } catch (err) {
    log.error({ err }, 'Error fetching replies');
    return [];
  }
}

export async function addComment(
  idOrUuid: string,
  comment: string,
  parentId?: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.post(API_ENDPOINTS.kvpComments(idOrUuid), {
      comment,
      ...(parentId !== undefined ? { parentId } : {}),
    });
    return { success: true };
  } catch (err) {
    log.error({ err }, 'Error adding comment');
    checkSessionExpired(err);
    const message =
      err instanceof Error ?
        err.message
      : 'Fehler beim Hinzufügen des Kommentars';
    return { success: false, error: message };
  }
}

// =============================================================================
// ATTACHMENTS
// =============================================================================

export async function fetchAttachments(
  idOrUuid: string,
): Promise<Attachment[]> {
  try {
    return await apiClient.get<Attachment[]>(
      API_ENDPOINTS.kvpAttachments(idOrUuid),
    );
  } catch (err) {
    log.error({ err }, 'Error fetching attachments');
    return [];
  }
}

export function downloadAttachment(fileUuid: string): void {
  // Cookie-based auth: accessToken cookie sent automatically on same-origin request
  // No token in URL = no token in logs/history
  const url = `/api/v2${API_ENDPOINTS.attachmentDownload(fileUuid)}`;
  window.open(url, '_blank');
}

export function getAttachmentPreviewUrl(fileUuid: string): string {
  // Cookie-based auth: accessToken cookie sent automatically on same-origin request
  return `/api/v2${API_ENDPOINTS.attachmentDownload(fileUuid)}`;
}

// =============================================================================
// READ CONFIRMATION (Pattern 2: Individual Decrement/Increment)
// =============================================================================

/**
 * Mark a suggestion as read (confirmed) by current user
 */
export async function confirmSuggestion(
  uuid: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.post(API_ENDPOINTS.kvpConfirm(uuid), {});
    return { success: true };
  } catch (err) {
    log.error({ err }, 'Error confirming suggestion');
    checkSessionExpired(err);
    const message =
      err instanceof Error ? err.message : 'Fehler beim Markieren als gelesen';
    return { success: false, error: message };
  }
}

/**
 * Mark a suggestion as unread (remove confirmation) by current user
 */
export async function unconfirmSuggestion(
  uuid: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.delete(API_ENDPOINTS.kvpConfirm(uuid));
    return { success: true };
  } catch (err) {
    log.error({ err }, 'Error unconfirming suggestion');
    checkSessionExpired(err);
    const message =
      err instanceof Error ?
        err.message
      : 'Fehler beim Markieren als ungelesen';
    return { success: false, error: message };
  }
}

// =============================================================================
// ORGANIZATION DATA (for share modal)
// =============================================================================

export async function fetchDepartments(): Promise<Department[]> {
  try {
    const departments = await apiClient.get<Department[]>(
      API_ENDPOINTS.departments,
    );
    return Array.isArray(departments) ? departments : [];
  } catch (err) {
    log.error({ err }, 'Error fetching departments');
    return [];
  }
}

export async function fetchTeams(): Promise<Team[]> {
  try {
    const teams = await apiClient.get<Team[]>(API_ENDPOINTS.teams);
    return Array.isArray(teams) ? teams : [];
  } catch (err) {
    log.error({ err }, 'Error fetching teams');
    return [];
  }
}

export async function fetchAreas(): Promise<Area[]> {
  try {
    const areas = await apiClient.get<Area[]>(API_ENDPOINTS.areas);
    return Array.isArray(areas) ? areas : [];
  } catch (err) {
    log.error({ err }, 'Error fetching areas');
    return [];
  }
}
