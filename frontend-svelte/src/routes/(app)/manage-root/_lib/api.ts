// =============================================================================
// MANAGE ROOT - API FUNCTIONS
// =============================================================================

import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { getApiClient } from '$lib/utils/api-client';
import type { RootUser, RootUserPayload, RootUsersApiResponse, FormIsActiveStatus } from './types';
import { API_ENDPOINTS } from './constants';

const apiClient = getApiClient();

/**
 * Check if error is a session expired error
 */
function isSessionExpiredError(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === 'SESSION_EXPIRED'
  );
}

/**
 * Handle session expired error
 */
export function handleSessionExpired(): void {
  goto(`${base}/login?session=expired`);
}

/**
 * Get current user ID from localStorage/token
 */
export function getCurrentUserId(): number | null {
  const userId = localStorage.getItem('userId');
  if (userId) {
    return parseInt(userId, 10);
  }

  // Fallback: decode from token
  const token = localStorage.getItem('accessToken');
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.id ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Load root users from API
 * @returns Root users array (excluding current user)
 */
export async function loadRootUsers(): Promise<{
  users: RootUser[];
  error: string | null;
}> {
  try {
    const currentUserId = getCurrentUserId();
    const result = (await apiClient.get(API_ENDPOINTS.USERS)) as RootUsersApiResponse;

    if (result.success && result.data?.users) {
      // Exclude current user
      const users = result.data.users.filter((u) => u.id !== currentUserId);
      return { users, error: null };
    }
    return { users: [], error: null };
  } catch (err) {
    console.error('[ManageRoot] Error loading users:', err);

    if (isSessionExpiredError(err)) {
      handleSessionExpired();
      return { users: [], error: null };
    }

    return {
      users: [],
      error: err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten',
    };
  }
}

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
    email: formData.email,
    position: formData.position,
    notes: formData.notes || undefined,
    isActive: formData.isActive,
  };

  if (formData.employeeNumber) {
    payload.employeeNumber = formData.employeeNumber;
  }

  if (!isEditMode) {
    payload.password = formData.password;
    payload.username = formData.email.split('@')[0]?.replace(/[^\w-]/g, '_') ?? formData.email;
  } else if (formData.password && formData.password.length >= 8) {
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
      await apiClient.put(API_ENDPOINTS.USER(editId), payload);
    } else {
      await apiClient.post(API_ENDPOINTS.USERS, payload);
    }
    return { success: true, error: null };
  } catch (err) {
    console.error('[ManageRoot] Error saving user:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Fehler beim Speichern',
    };
  }
}

/**
 * Delete root user
 */
export async function deleteRootUser(
  userId: number,
): Promise<{ success: boolean; error: string | null }> {
  try {
    await apiClient.delete(API_ENDPOINTS.USER(userId));
    return { success: true, error: null };
  } catch (err) {
    console.error('[ManageRoot] Error deleting user:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Fehler beim Löschen',
    };
  }
}

/**
 * Check session and redirect if invalid
 */
export function checkSession(): boolean {
  const token = localStorage.getItem('accessToken');
  const userRole = localStorage.getItem('userRole');

  if (!token || userRole !== 'root') {
    goto(`${base}/login`);
    return false;
  }
  return true;
}
