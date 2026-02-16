// =============================================================================
// MANAGE ROOT - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';

import { API_ENDPOINTS } from './constants';

import type { RootUserPayload, FormIsActiveStatus } from './types';

const log = createLogger('ManageRootApi');

const apiClient = getApiClient();

/**
 * Build root user payload from form data
 */
export function buildRootUserPayload(
  formData: {
    firstName: string;
    lastName: string;
    email: string;
    position: string;
    notes: string;
    employeeNumber: string;
    isActive: FormIsActiveStatus;
    password: string;
  },
  isEditMode: boolean,
): RootUserPayload {
  const payload: RootUserPayload = {
    firstName: formData.firstName,
    lastName: formData.lastName,
    email: formData.email.toLowerCase().trim(),
    position: formData.position,
    notes: formData.notes !== '' ? formData.notes : undefined,
    isActive: formData.isActive,
  };

  if (formData.employeeNumber !== '') {
    payload.employeeNumber = formData.employeeNumber;
  }

  if (!isEditMode) {
    payload.password = formData.password;
    payload.username =
      formData.email
        .toLowerCase()
        .trim()
        .split('@')[0]
        ?.replace(/[^\w-]/g, '_') ?? formData.email.toLowerCase().trim();
  } else if (formData.password !== '' && formData.password.length >= 8) {
    payload.password = formData.password;
  }

  return payload;
}

/**
 * Save root user (create or update)
 */
export async function saveRootUser(
  payload: RootUserPayload,
  editId: number | null,
): Promise<{ success: boolean; error: string | null }> {
  try {
    if (editId !== null) {
      await apiClient.put(API_ENDPOINTS.user(editId), payload);
    } else {
      await apiClient.post(API_ENDPOINTS.USERS, payload);
    }
    return { success: true, error: null };
  } catch (err) {
    log.error({ err }, 'Error saving user');
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Fehler beim Speichern',
    };
  }
}

// =============================================================================
// AVAILABILITY FUNCTIONS
// =============================================================================

/**
 * Update root user availability (quick update via users table)
 * @param userId - Root user ID
 * @param availability - Availability data payload
 */
export async function updateRootAvailability(
  userId: number,
  availability: {
    availabilityStatus: string;
    availabilityStart?: string;
    availabilityEnd?: string;
    availabilityReason?: string;
    availabilityNotes?: string;
  },
): Promise<void> {
  await apiClient.put(`/users/${userId}`, availability);
}

/**
 * Delete root user
 */
export async function deleteRootUser(
  userId: number,
): Promise<{ success: boolean; error: string | null }> {
  try {
    await apiClient.delete(API_ENDPOINTS.user(userId));
    return { success: true, error: null };
  } catch (err) {
    log.error({ err }, 'Error deleting user');
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Fehler beim Löschen',
    };
  }
}
