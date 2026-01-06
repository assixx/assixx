/**
 * Blackboard Detail API
 * API functions specific to the detail view
 */

import type {
  DetailEntry,
  Comment,
  Attachment,
  CurrentUser,
  FullEntryResponse,
  MeResponse,
} from './types';

// ============================================================================
// Helper Functions
// ============================================================================

function getToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

function createHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// ============================================================================
// Entry API
// ============================================================================

/**
 * Fetch full entry with comments and attachments
 */
export async function fetchFullEntry(
  uuid: string,
): Promise<{ entry: DetailEntry; comments: Comment[]; attachments: Attachment[] } | null> {
  const token = getToken();
  if (!token) return null;

  const response = await fetch(`/api/v2/blackboard/entries/${uuid}/full`, {
    headers: createHeaders(token),
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`HTTP ${response.status}`);
  }

  const result: FullEntryResponse = await response.json();

  if (!result.success) {
    throw new Error(result.error?.message ?? 'Fehler beim Laden');
  }

  return {
    entry: result.data.entry,
    comments: result.data.comments ?? [],
    attachments: result.data.attachments ?? [],
  };
}

/**
 * Load current user info
 */
export async function loadCurrentUser(): Promise<CurrentUser | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const response = await fetch('/api/v2/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return null;

    const result: MeResponse = await response.json();
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
  const token = getToken();
  if (!token) return false;

  try {
    const response = await fetch(`/api/v2/blackboard/entries/${uuid}/confirm`, {
      method: 'POST',
      headers: createHeaders(token),
      body: JSON.stringify({}),
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Unconfirm entry (mark as unread)
 */
export async function unconfirmEntry(uuid: string): Promise<boolean> {
  const token = getToken();
  if (!token) return false;

  try {
    const response = await fetch(`/api/v2/blackboard/entries/${uuid}/confirm`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// Comment API
// ============================================================================

/**
 * Add comment to entry
 */
export async function addComment(uuid: string, comment: string): Promise<boolean> {
  const token = getToken();
  if (!token) return false;

  try {
    const response = await fetch(`/api/v2/blackboard/entries/${uuid}/comments`, {
      method: 'POST',
      headers: createHeaders(token),
      body: JSON.stringify({ comment: comment.trim() }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// Admin Actions API
// ============================================================================

/**
 * Archive entry (admin only)
 */
export async function archiveEntry(uuid: string): Promise<boolean> {
  const token = getToken();
  if (!token) return false;

  try {
    const response = await fetch(`/api/v2/blackboard/entries/${uuid}/archive`, {
      method: 'PATCH',
      headers: createHeaders(token),
    });

    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// Attachment Helper
// ============================================================================

/**
 * Build download URL with auth token
 */
export function buildDownloadUrl(fileUuid: string): string {
  const token = getToken() ?? '';
  return `/api/v2/blackboard/attachments/${fileUuid}/download?token=${encodeURIComponent(token)}`;
}
