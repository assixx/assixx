/**
 * Employee Profile - API Functions
 * @module employee-profile/_lib/api
 */

import { getApiClient } from '$lib/utils/api-client';
import type { PasswordChangePayload, PictureUploadResponse } from './types';
import { STORAGE_KEYS, PICTURE_CONSTRAINTS } from './constants';

const apiClient = getApiClient();

/**
 * Load profile picture from cache or user data
 * @param userPicture - Profile picture URL from user data
 */
export function loadProfilePicture(userPicture?: string): string | null {
  // Check localStorage cache first
  const cached = localStorage.getItem(STORAGE_KEYS.profilePictureCache);
  if (cached !== null && cached !== 'null' && cached !== '') {
    return cached;
  }

  // Use user's profile picture if available
  if (userPicture !== undefined && userPicture !== '') {
    localStorage.setItem(STORAGE_KEYS.profilePictureCache, userPicture);
    return userPicture;
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

  const result = await apiClient.upload('/users/me/profile-picture', formData);

  let newUrl: string | null = null;

  if (typeof result === 'string') {
    newUrl = result;
  } else if (result !== null && typeof result === 'object') {
    const response = result as PictureUploadResponse;
    newUrl = response.url ?? response.profilePicture ?? null;
  }

  if (newUrl !== null && newUrl !== '') {
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
