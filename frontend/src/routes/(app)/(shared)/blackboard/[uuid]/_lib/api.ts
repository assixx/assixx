/**
 * Blackboard Detail API
 * API functions specific to the detail view
 */

import { getApiClient } from '$lib/utils/api-client';

import type {
  DetailEntry,
  Comment,
  Attachment,
  CurrentUser,
  FullEntryResponse,
  MeResponse,
  PaginatedComments,
} from './types';

const apiClient = getApiClient();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Type guard to check if error is a 404 Not Found response
 */
function isNotFoundError(err: unknown): boolean {
  if (err === null || typeof err !== 'object') return false;
  return 'status' in err && err.status === 404;
}

// ============================================================================
// Entry API
// ============================================================================

/**
 * Fetch full entry with initial comments (paginated) and attachments
 */
export async function fetchFullEntry(uuid: string): Promise<{
  entry: DetailEntry;
  comments: PaginatedComments;
  attachments: Attachment[];
} | null> {
  try {
    const result = await apiClient.get<FullEntryResponse>(
      `/blackboard/entries/${uuid}/full`,
    );

    if (!result.success) {
      throw new Error(result.error?.message ?? 'Fehler beim Laden');
    }

    return {
      entry: result.data.entry,
      comments: result.data.comments ?? {
        comments: [],
        total: 0,
        hasMore: false,
      },
      attachments: result.data.attachments ?? [],
    };
  } catch (err: unknown) {
    if (isNotFoundError(err)) {
      return null;
    }
    throw err;
  }
}

/**
 * Load current user info
 */
export async function loadCurrentUser(): Promise<CurrentUser | null> {
  try {
    const result = await apiClient.get<MeResponse>('/auth/me');
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

// ============================================================================
// Confirmation API
// ============================================================================

/**
 * Confirm entry as read
 */
export async function confirmEntry(uuid: string): Promise<boolean> {
  try {
    await apiClient.post(`/blackboard/entries/${uuid}/confirm`, {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Unconfirm entry (mark as unread)
 */
export async function unconfirmEntry(uuid: string): Promise<boolean> {
  try {
    await apiClient.delete(`/blackboard/entries/${uuid}/confirm`);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Comment API
// ============================================================================

/**
 * Fetch top-level comments with pagination (for lazy loading)
 */
export async function fetchComments(
  uuid: string,
  limit: number = 20,
  offset: number = 0,
): Promise<PaginatedComments> {
  try {
    return await apiClient.get<PaginatedComments>(
      `/blackboard/entries/${uuid}/comments?limit=${limit}&offset=${offset}`,
    );
  } catch {
    return { comments: [], total: 0, hasMore: false };
  }
}

/**
 * Fetch replies for a specific comment
 */
export async function fetchReplies(commentId: number): Promise<Comment[]> {
  try {
    return await apiClient.get<Comment[]>(
      `/blackboard/comments/${commentId}/replies`,
    );
  } catch {
    return [];
  }
}

/**
 * Add comment or reply to entry
 */
export async function addComment(
  uuid: string,
  comment: string,
  parentId?: number,
): Promise<boolean> {
  try {
    await apiClient.post(`/blackboard/entries/${uuid}/comments`, {
      comment: comment.trim(),
      ...(parentId !== undefined ? { parentId } : {}),
    });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Admin Actions API
// ============================================================================

/**
 * Archive entry (admin only)
 * Sets is_active = 3 in database
 */
export async function archiveEntry(uuid: string): Promise<boolean> {
  try {
    await apiClient.post(`/blackboard/entries/${uuid}/archive`, {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Unarchive/restore entry (admin only)
 * Sets is_active = 1 in database
 */
export async function unarchiveEntry(uuid: string): Promise<boolean> {
  try {
    await apiClient.post(`/blackboard/entries/${uuid}/unarchive`, {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete entry
 * Allowed for: root, admin with hasFullAccess, or creator
 * Returns { success: true } or { success: false, error: string }
 */
export async function deleteEntry(
  uuid: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await apiClient.delete(`/blackboard/entries/${uuid}`);
    return { success: true };
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : 'Fehler beim Löschen des Eintrags';
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// Attachment Helper
// ============================================================================

/**
 * Build download URL from the API-provided downloadUrl
 * Cookie-based auth: accessToken cookie sent automatically on same-origin request
 * No token in URL = no token in logs/history
 */
export function buildDownloadUrl(downloadUrl: string): string {
  // The API returns URLs like /api/v2/documents/:id/download
  // Cookie auth is handled automatically by browser on same-origin requests
  return downloadUrl;
}
