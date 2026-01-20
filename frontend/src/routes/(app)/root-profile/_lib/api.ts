/**
 * Root Profile - API Functions
 * @module root-profile/_lib/api
 */

import { getApiClient } from '$lib/utils/api-client';
import { getProfilePictureUrl } from '$lib/utils/avatar-helpers';
import { createLogger } from '$lib/utils/logger';
import { fetchCurrentUser as fetchSharedUser } from '$lib/utils/user-service';

import { PICTURE_CONSTRAINTS } from './constants';

import type {
  UserProfile,
  ApprovalItem,
  ProfileUpdatePayload,
  PasswordChangePayload,
} from './types';

const log = createLogger('RootProfileApi');

const apiClient = getApiClient();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type-safe extraction of array data from various API response formats
 * Handles: T[], { data: T[] }, { [key]: T[] }
 */
function extractArrayFromResponse<T>(result: unknown, key?: string): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }

  if (result === null || typeof result !== 'object') {
    return [];
  }

  const obj = result as Record<string, unknown>;

  // { [key]: T[] } - e.g. { approvals: ApprovalItem[] }

  if (key !== undefined && Array.isArray(obj[key])) {
    return obj[key] as T[];
  }

  // { data: T[] }
  if (Array.isArray(obj.data)) {
    return obj.data as T[];
  }

  return [];
}

// =============================================================================
// LOAD FUNCTIONS
// =============================================================================

/**
 * Load user profile data
 * DELEGATES to shared user service (prevents duplicate /users/me calls)
 * @returns User profile or null on error
 */
export async function loadProfile(): Promise<{
  user: UserProfile | null;
  error: string | null;
}> {
  try {
    const result = await fetchSharedUser();
    return { user: result.user as UserProfile | null, error: null };
  } catch (err) {
    log.error({ err }, 'Error loading profile');
    return {
      user: null,
      error: err instanceof Error ? err.message : 'Fehler beim Laden des Profils',
    };
  }
}

/**
 * Load profile picture from user data (SSR source of truth)
 * @param userPicture - Profile picture URL from user data
 * @returns Absolute URL path or null
 */
export function loadProfilePicture(userPicture?: string): string | null {
  // Use user's profile picture directly from SSR data - no caching
  // Caching was removed because it caused profile pictures to be shared
  // across different users (all profiles used same localStorage key)
  if (userPicture !== undefined && userPicture !== '') {
    return getProfilePictureUrl(userPicture);
  }

  return null;
}

/**
 * Load pending tenant deletion approvals
 * @returns Array of approval items
 */
export async function loadPendingApprovals(): Promise<ApprovalItem[]> {
  try {
    const result: unknown = await apiClient.get('/root/deletion-approvals/pending');
    return extractArrayFromResponse<ApprovalItem>(result, 'approvals');
  } catch (err) {
    log.warn({ err }, 'Could not load approvals');
    return [];
  }
}

/**
 * Save profile changes
 * @param payload - Profile update data
 */
export async function saveProfile(payload: ProfileUpdatePayload): Promise<void> {
  await apiClient.put('/users/me', payload);
}

/**
 * Upload profile picture
 * @param file - Image file to upload
 * @returns New profile picture URL or null
 */
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

/**
 * Remove profile picture
 */
export async function removeProfilePicture(): Promise<void> {
  await apiClient.delete('/users/me/profile-picture');
}

/**
 * Change user password
 * @param payload - Password change data
 */
export async function changePassword(payload: PasswordChangePayload): Promise<void> {
  await apiClient.put('/users/me/password', payload);
}

/**
 * Approve tenant deletion request
 * @param id - Approval queue ID
 */
export async function approveRequest(id: number): Promise<void> {
  await apiClient.post(`/root/deletion-approvals/${id}/approve`);
}

/**
 * Reject tenant deletion request
 * @param id - Approval queue ID
 */
export async function rejectRequest(id: number): Promise<void> {
  await apiClient.post(`/root/deletion-approvals/${id}/reject`);
}

/**
 * Parse JWT token to get user role
 * @param token - JWT token string
 */
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
