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
 * Load profile picture from user data (SSR source of truth).
 * No caching -- caching caused profile pictures to be shared across
 * different users (all profiles used same localStorage key).
 */
export function loadProfilePicture(userPicture?: string): string | null {
  if (userPicture !== undefined && userPicture !== '') {
    return getProfilePictureUrl(userPicture);
  }

  return null;
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
