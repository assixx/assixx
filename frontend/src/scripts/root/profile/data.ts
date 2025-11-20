/**
 * Root Profile Management - Data Layer
 * API calls, state management, and profile operations
 */

import { ApiClient } from '../../../utils/api-client';
import { loadUserInfo as loadUserInfoFromCache } from '../../auth/index';
import type { RootProfile, DeletionApproval, ProfileUpdateData, PasswordChangeData } from './types';

// ===== API CLIENT =====
export const apiClient = ApiClient.getInstance();

// ===== DATA EXTRACTION HELPERS =====

/**
 * Extract user data from API response
 * API v2 returns camelCase (via dbToApi transformation)
 */
export function extractUserData(data: unknown): RootProfile {
  const responseData = (data as { data?: unknown; user?: unknown }).data ?? (data as { user?: unknown }).user ?? data;
  const user = responseData as Partial<RootProfile>;

  return {
    id: user.id ?? 0,
    email: user.email ?? '',
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    profilePicture: user.profilePicture ?? '',
    role: 'root',
    tenantId: user.tenantId ?? 0,
    isActive: user.isActive ?? true,
    createdAt: user.createdAt ?? '',
    updatedAt: user.updatedAt ?? '',
  };
}

// ===== PROFILE API CALLS =====

/**
 * Load current user profile
 * OPTIMIZATION: Uses cached data from auth/index.ts to prevent duplicate API calls
 */
export async function handleLoadProfile(): Promise<RootProfile> {
  console.info('[RootProfile] Loading profile from cache...');

  // Use cached user data from auth.js (300s cache)
  // This prevents duplicate /api/v2/users/me calls (UnifiedNav already fetches this)
  const response = await loadUserInfoFromCache();

  console.info('[RootProfile] Cached user data:', response);
  const userData = extractUserData(response);
  console.info('[RootProfile] Extracted user data:', userData);

  return userData;
}

/**
 * Update current user profile
 */
export async function handleUpdateProfile(data: ProfileUpdateData): Promise<void> {
  console.info('[RootProfile] Updating profile...', data);

  await apiClient.request('/users/me/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });

  console.info('[RootProfile] Profile updated successfully');
}

/**
 * Change user password
 */
export async function handleChangePassword(data: PasswordChangeData): Promise<void> {
  console.info('[RootProfile] Changing password...');

  await apiClient.request('/users/me/password', {
    method: 'PUT',
    body: JSON.stringify(data),
  });

  console.info('[RootProfile] Password changed successfully');
}

/**
 * Upload profile picture
 */
export async function handleUploadProfilePicture(file: File): Promise<string> {
  console.info('[RootProfile] Uploading profile picture...');

  const formData = new FormData();
  formData.append('profilePicture', file);

  // Backend returns full user object with profile_picture field (snake_case)
  const response = await apiClient.request<RootProfile>('/users/me/profile-picture', {
    method: 'POST',
    body: formData,
  });

  console.info('[RootProfile] Profile picture uploaded successfully');

  // Extract profile picture URL - API v2 returns camelCase via dbToApi()
  const profilePictureUrl = response.profilePicture ?? '';

  if (profilePictureUrl === '') {
    throw new Error('Profile picture URL not found in response');
  }

  return profilePictureUrl;
}

/**
 * Remove profile picture
 */
export async function handleRemoveProfilePicture(): Promise<void> {
  console.info('[RootProfile] Removing profile picture...');

  await apiClient.request('/users/me/profile-picture', {
    method: 'DELETE',
  });

  console.info('[RootProfile] Profile picture removed successfully');
}

// ===== DELETION APPROVALS API CALLS =====

/**
 * Load pending deletion approvals
 */
export async function handleLoadPendingApprovals(): Promise<DeletionApproval[]> {
  console.info('[RootProfile] Loading pending approvals...');

  try {
    const response = await apiClient.request<{ success?: boolean; data?: DeletionApproval[] } | DeletionApproval[]>(
      '/root/deletion-approvals/pending',
      {
        method: 'GET',
      },
    );

    console.info('[RootProfile] Deletion approvals response:', response);

    // Handle both wrapped and unwrapped responses
    let approvals: DeletionApproval[] = [];
    // Runtime validation for API data integrity - backend may return different response formats
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime validation for API data
    if (response !== null && typeof response === 'object') {
      if ('success' in response && 'data' in response && Array.isArray(response.data)) {
        approvals = response.data;
      } else if (Array.isArray(response)) {
        approvals = response;
      }
    }

    console.info('[RootProfile] Processed approvals:', approvals);
    return approvals;
  } catch (error) {
    console.error('[RootProfile] Error loading approvals:', error);
    return [];
  }
}

/**
 * Approve deletion request
 */
export async function handleApproveDeletion(queueId: number): Promise<void> {
  console.info('[RootProfile] Approving deletion for queue ID:', queueId);

  await apiClient.request(`/root/deletion-approvals/${queueId}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

  console.info('[RootProfile] Deletion approved successfully');
}

/**
 * Reject deletion request
 */
export async function handleRejectDeletion(queueId: number, reason: string): Promise<void> {
  console.info('[RootProfile] Rejecting deletion for queue ID:', queueId);

  await apiClient.request(`/root/deletion-approvals/${queueId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });

  console.info('[RootProfile] Deletion rejected successfully');
}
