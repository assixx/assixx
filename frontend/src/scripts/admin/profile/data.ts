/**
 * Admin Profile Management - Data Layer
 * API calls, state management, and profile operations
 */

import { ApiClient } from '../../../utils/api-client';
import { loadUserInfo as loadUserInfoFromCache } from '../../auth/index';
import type { AdminProfile, PasswordChangeData } from './types';

// ===== API CLIENT =====
export const apiClient = ApiClient.getInstance();

// ===== DATA EXTRACTION HELPERS =====

/**
 * Extract user data from API response
 * API v2 returns camelCase (via dbToApi transformation)
 */
export function extractUserData(data: unknown): AdminProfile {
  const responseData = (data as { data?: unknown; user?: unknown }).data ?? (data as { user?: unknown }).user ?? data;
  const user = responseData as Partial<AdminProfile>;

  return {
    id: user.id ?? 0,
    email: user.email ?? '',
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    profilePicture: user.profilePicture ?? '',
    role: 'admin',
    tenantId: user.tenantId ?? 0,
    isActive: user.isActive ?? true,
    position: user.position ?? '',
    companyName: user.companyName ?? '',
    createdAt: user.createdAt ?? '',
    updatedAt: user.updatedAt ?? '',
  };
}

// ===== PROFILE API CALLS =====

/**
 * Load current user profile
 * OPTIMIZATION: Uses cached data from auth/index.ts to prevent duplicate API calls
 */
export async function handleLoadProfile(): Promise<AdminProfile> {
  console.info('[AdminProfile] Loading profile from cache...');

  // Use cached user data from auth.js (300s cache)
  // This prevents duplicate /api/v2/users/me calls (UnifiedNav already fetches this)
  const response = await loadUserInfoFromCache();

  console.info('[AdminProfile] Cached user data:', response);
  const userData = extractUserData(response);
  console.info('[AdminProfile] Extracted user data:', userData);

  return userData;
}

/**
 * Change user password
 */
export async function handleChangePassword(data: PasswordChangeData): Promise<void> {
  console.info('[AdminProfile] Changing password...');

  await apiClient.request('/users/me/password', {
    method: 'PUT',
    body: JSON.stringify(data),
  });

  console.info('[AdminProfile] Password changed successfully');
}

/**
 * Upload profile picture
 */
export async function handleUploadProfilePicture(file: File): Promise<string> {
  console.info('[AdminProfile] Uploading profile picture...');

  const formData = new FormData();
  formData.append('profilePicture', file);

  // Backend returns full user object with profile_picture field (snake_case)
  const response = await apiClient.request<AdminProfile>('/users/me/profile-picture', {
    method: 'POST',
    body: formData,
  });

  console.info('[AdminProfile] Profile picture uploaded successfully');

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
  console.info('[AdminProfile] Removing profile picture...');

  await apiClient.request('/users/me/profile-picture', {
    method: 'DELETE',
  });

  console.info('[AdminProfile] Profile picture removed successfully');
}
