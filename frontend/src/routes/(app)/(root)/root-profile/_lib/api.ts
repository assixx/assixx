/**
 * Root Profile - API Functions
 * @module root-profile/_lib/api
 */

import { getApiClient } from '$lib/utils/api-client';
import { extractArray } from '$lib/utils/api-response';
import { getProfilePictureUrl } from '$lib/utils/avatar-helpers';
import { createLogger } from '$lib/utils/logger';
import { fetchCurrentUser as fetchSharedUser } from '$lib/utils/user-service';

import { PICTURE_CONSTRAINTS } from './constants';

import type {
  UserProfile,
  ApprovalItem,
  ProfileUpdatePayload,
  PasswordChangePayload,
  SelfTerminationRequest,
} from './types';

const log = createLogger('RootProfileApi');

const apiClient = getApiClient();

// =============================================================================
// LOAD FUNCTIONS
// =============================================================================

/**
 * Load user profile data.
 * Delegates to shared user service (prevents duplicate /users/me calls)
 */
export async function loadProfile(): Promise<{
  user: UserProfile | null;
  error: string | null;
}> {
  try {
    const result = await fetchSharedUser();
    return { user: result.user as UserProfile | null, error: null };
  } catch (err: unknown) {
    log.error({ err }, 'Error loading profile');
    return {
      user: null,
      error: err instanceof Error ? err.message : 'Fehler beim Laden des Profils',
    };
  }
}

/** Load profile picture from user data (SSR source of truth) */
export function loadProfilePicture(userPicture?: string): string | null {
  // Use user's profile picture directly from SSR data - no caching
  // Caching was removed because it caused profile pictures to be shared
  // across different users (all profiles used same localStorage key)
  if (userPicture !== undefined && userPicture !== '') {
    return getProfilePictureUrl(userPicture);
  }

  return null;
}

/** Load pending tenant deletion approvals */
export async function loadPendingApprovals(): Promise<ApprovalItem[]> {
  try {
    const result: unknown = await apiClient.get('/root/deletion-approvals/pending');
    return extractArray<ApprovalItem>(result, 'approvals');
  } catch (err: unknown) {
    log.warn({ err }, 'Could not load approvals');
    return [];
  }
}

/** Save profile changes */
export async function saveProfile(payload: ProfileUpdatePayload): Promise<void> {
  await apiClient.put('/users/me', payload);
}

/** Upload profile picture */
export async function uploadProfilePicture(file: File): Promise<string | null> {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('INVALID_TYPE');
  }

  // Validate file size
  if (file.size > PICTURE_CONSTRAINTS.maxSizeBytes) {
    throw new Error('FILE_TOO_LARGE');
  }

  const formData = new FormData();
  formData.append('profilePicture', file);

  const result: unknown = await apiClient.upload('/users/me/profile-picture', formData);

  let newUrl: string | null = null;

  if (typeof result === 'string') {
    newUrl = result;
  } else if (result !== null && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if (typeof obj.url === 'string') {
      newUrl = obj.url;
    } else if (typeof obj.profilePicture === 'string') {
      newUrl = obj.profilePicture;
    }
  }

  return newUrl;
}

/** Remove profile picture */
export async function removeProfilePicture(): Promise<void> {
  await apiClient.delete('/users/me/profile-picture');
}

/** Change user password */
export async function changePassword(payload: PasswordChangePayload): Promise<void> {
  await apiClient.put('/users/me/password', payload);
}

/**
 * Call backend logout to revoke tokens and clear HttpOnly cookies
 * Used after password change to force re-login on all sessions
 */
export async function logoutAllSessions(): Promise<void> {
  await apiClient.post('/auth/logout');
}

/** Approve tenant deletion request */
export async function approveRequest(id: number): Promise<void> {
  await apiClient.post(`/root/deletion-approvals/${id}/approve`);
}

/** Reject tenant deletion request */
export async function rejectRequest(id: number): Promise<void> {
  await apiClient.post(`/root/deletion-approvals/${id}/reject`);
}

// =============================================================================
// SELF-TERMINATION (FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN §5.1)
// Backend: backend/src/nest/root/root-self-termination.controller.ts (6 routes)
// Step 5.1 needs only 3: GET own pending, POST request, DELETE cancel.
// Approve / reject / list-peer endpoints belong to Step 5.3 (manage-approvals).
// =============================================================================

/**
 * Get the actor's currently pending self-termination request, or null.
 * Backend GET `/users/me/self-termination-request` returns the row or null;
 * `apiClient.get()` unwraps the {success,data} envelope. We narrow `unknown`
 * defensively because Zod validation lives only on the backend (ADR-030).
 */
export async function getMyPendingSelfTermination(): Promise<SelfTerminationRequest | null> {
  const result: unknown = await apiClient.get('/users/me/self-termination-request');
  if (result === null) return null;
  if (typeof result === 'object' && 'id' in result && 'status' in result) {
    return result as SelfTerminationRequest;
  }
  return null;
}

/**
 * Create a new self-termination request. Throws ApiError on backend rejection
 * (412 LAST_ROOT_PROTECTION, 409 ALREADY_PENDING / COOLDOWN_ACTIVE) — caller
 * inspects `error.code` + `error.message` (D10: cooldownEndsAt is embedded as
 * ISO inside the message body, not a top-level field).
 */
export async function requestSelfTermination(
  reason: string | null,
): Promise<SelfTerminationRequest> {
  const result: unknown = await apiClient.post('/users/me/self-termination-request', {
    reason: reason ?? undefined,
  });
  return result as SelfTerminationRequest;
}

/**
 * Cancel the actor's own pending request. Backend returns 204 No Content —
 * `apiClient.delete` resolves to undefined.
 */
export async function cancelOwnSelfTermination(): Promise<void> {
  await apiClient.delete('/users/me/self-termination-request');
}

/** Parse JWT token to get user role */
export function parseJwtRole(token: string): string | null {
  try {
    const payload: unknown = JSON.parse(atob(token.split('.')[1]));
    if (payload !== null && typeof payload === 'object') {
      const obj = payload as Record<string, unknown>;
      if (typeof obj.role === 'string') {
        return obj.role;
      }
    }
    return null;
  } catch {
    return null;
  }
}
