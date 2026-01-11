// =============================================================================
// MANAGE ROOT - API FUNCTIONS
// =============================================================================

import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

import { getApiClient } from '$lib/utils/api-client';

import { API_ENDPOINTS } from './constants';

import type { RootUser, RootUserPayload, RootUsersApiResponse, FormIsActiveStatus } from './types';

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
  void goto(`${resolve('/login', {})}?session=expired`);
}

/**
 * Extract user ID from JWT token
 * @param token - JWT token string
 * @returns User ID or null if invalid
 */
function extractIdFromToken(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }
    const parsed: unknown = JSON.parse(atob(parts[1]));
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    if (!('id' in parsed)) {
      return null;
    }
    const id = (parsed as { id: unknown }).id;
    return typeof id === 'number' ? id : null;
  } catch {
    return null;
  }
}

/**
 * Get current user ID from localStorage/token
 */
export function getCurrentUserId(): number | null {
  const userId = localStorage.getItem('userId');
  if (userId !== null && userId !== '') {
    return Number.parseInt(userId, 10);
  }

  // Fallback: decode from token
  const token = localStorage.getItem('accessToken');
  if (token !== null && token !== '') {
    return extractIdFromToken(token);
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
    const result = await apiClient.get<RootUsersApiResponse>(API_ENDPOINTS.USERS);

    if (result.success === true && result.data?.users !== undefined) {
      // Exclude current user
      const users = result.data.users.filter((u: RootUser): boolean => u.id !== currentUserId);
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
    notes: formData.notes !== '' ? formData.notes : undefined,
    isActive: formData.isActive,
  };

  if (formData.employeeNumber !== '') {
    payload.employeeNumber = formData.employeeNumber;
  }

  if (!isEditMode) {
    payload.password = formData.password;
    payload.username = formData.email.split('@')[0]?.replace(/[^\w-]/g, '_') ?? formData.email;
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
    await apiClient.delete(API_ENDPOINTS.user(userId));
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

  if (token === null || userRole !== 'root') {
    void goto(resolve('/login', {}));
    return false;
  }
  return true;
}
