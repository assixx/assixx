/**
 * Root Profile - API Functions
 * @module root-profile/_lib/api
 */

import { getApiClient } from '$lib/utils/api-client';
import { fetchCurrentUser as fetchSharedUser } from '$lib/utils/user-service';
import type {
  UserProfile,
  ApprovalItem,
  ProfileUpdatePayload,
  PasswordChangePayload,
  ApprovalsResponse,
  PictureUploadResponse,
} from './types';
import { STORAGE_KEYS, PICTURE_CONSTRAINTS } from './constants';

const apiClient = getApiClient();

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
    console.error('[RootProfile] Error loading profile:', err);
    return {
      user: null,
      error: err instanceof Error ? err.message : 'Fehler beim Laden des Profils',
    };
  }
}

/**
 * Load profile picture from cache or user data
 * @param userPicture - Profile picture URL from user data
 */
export function loadProfilePicture(userPicture?: string): string | null {
  // Check localStorage cache first
  const cached = localStorage.getItem(STORAGE_KEYS.profilePictureCache);
  if (cached && cached !== 'null' && cached !== '') {
    return cached;
  }

  // Use user's profile picture if available
  if (userPicture) {
    localStorage.setItem(STORAGE_KEYS.profilePictureCache, userPicture);
    return userPicture;
  }

  return null;
}

/**
 * Load pending tenant deletion approvals
 * @returns Array of approval items
 */
export async function loadPendingApprovals(): Promise<ApprovalItem[]> {
  try {
    const result = (await apiClient.get('/tenant-deletion/pending-approvals')) as
      | ApprovalItem[]
      | ApprovalsResponse;

    if (Array.isArray(result)) {
      return result;
    } else if ('approvals' in result && Array.isArray(result.approvals)) {
      return result.approvals;
    } else if ('data' in result && Array.isArray(result.data)) {
      return result.data;
    }

    return [];
  } catch (err) {
    console.warn('[RootProfile] Could not load approvals:', err);
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

  const result = (await apiClient.upload('/users/me/profile-picture', formData)) as
    | string
    | PictureUploadResponse;

  let newUrl: string | null = null;

  if (typeof result === 'string') {
    newUrl = result;
  } else if (result && typeof result === 'object') {
    newUrl = result.url ?? result.profilePicture ?? null;
  }

  if (newUrl) {
    localStorage.setItem(STORAGE_KEYS.profilePictureCache, newUrl);
  }

  return newUrl;
}

/**
 * Remove profile picture
 */
export async function removeProfilePicture(): Promise<void> {
  await apiClient.delete('/users/me/profile-picture');
  localStorage.removeItem(STORAGE_KEYS.profilePictureCache);
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
 * @param id - Approval request ID
 */
export async function approveRequest(id: number): Promise<void> {
  await apiClient.post(`/tenant-deletion/${id}/approve`);
}

/**
 * Reject tenant deletion request
 * @param id - Approval request ID
 */
export async function rejectRequest(id: number): Promise<void> {
  await apiClient.post(`/tenant-deletion/${id}/reject`);
}

/**
 * Parse JWT token to get user role
 * @param token - JWT token string
 */
export function parseJwtRole(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role ?? null;
  } catch {
    return null;
  }
}
