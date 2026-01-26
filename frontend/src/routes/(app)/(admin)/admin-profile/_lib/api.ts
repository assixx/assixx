/**
 * Admin Profile - API Functions
 * @module admin-profile/_lib/api
 */

import { getApiClient } from '$lib/utils/api-client';
import { getProfilePictureUrl } from '$lib/utils/avatar-helpers';

import { PICTURE_CONSTRAINTS } from './constants';

import type { PasswordChangePayload, PictureUploadResponse } from './types';

const apiClient = getApiClient();

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

  const result = await apiClient.upload<PictureUploadResponse | string>(
    '/users/me/profile-picture',
    formData,
  );

  let newUrl: string | null = null;

  if (typeof result === 'string') {
    newUrl = result;
  } else if (typeof result === 'object') {
    newUrl = result.url ?? result.profilePicture ?? null;
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
