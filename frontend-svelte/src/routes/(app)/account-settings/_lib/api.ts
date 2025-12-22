/**
 * Account Settings - API Functions
 * @module account-settings/_lib/api
 */

import { getApiClient } from '$lib/utils/api-client';
import type {
  DeletionStatusData,
  DeletionQueueResponse,
  DeletionStatusResponse,
  RootUsersResponse,
  JwtPayload,
} from './types';
import { STORAGE_KEYS, MESSAGES } from './constants';

const apiClient = getApiClient();

/**
 * Parse JWT token to extract payload
 * @param token - JWT token string
 * @returns Parsed payload or null
 */
export function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Get access token from localStorage
 * @returns Token or null
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.accessToken);
}

/**
 * Check if user is authenticated and has root role
 * @returns Object with auth status and role
 */
export function checkAuthRole(): { isAuthenticated: boolean; role: string | null } {
  const token = getAccessToken();
  if (!token) {
    return { isAuthenticated: false, role: null };
  }

  const payload = parseJwtPayload(token);
  if (!payload) {
    return { isAuthenticated: false, role: null };
  }

  return { isAuthenticated: true, role: payload.role };
}

/**
 * Load pending deletion status
 * @returns Deletion status data or null
 */
export async function loadDeletionStatus(): Promise<DeletionStatusData | null> {
  try {
    const result = (await apiClient.get('/root/tenant/deletion-status')) as
      | DeletionStatusData
      | DeletionStatusResponse
      | null;

    if (result === null) {
      return null;
    }

    // Handle wrapped response
    if ('data' in result && result.data && 'queueId' in result.data) {
      return result.data;
    }

    if ('queueId' in result) {
      return result as DeletionStatusData;
    }

    return null;
  } catch {
    // No pending deletion - this is expected in most cases
    console.info('[AccountSettings] ' + MESSAGES.noPendingDeletion);
    return null;
  }
}

/**
 * Get count of root users in tenant
 * @returns Number of root users
 */
export async function getRootUserCount(): Promise<number> {
  try {
    const result = (await apiClient.get('/root/users')) as
      | Array<{ id: number }>
      | RootUsersResponse;

    if (Array.isArray(result)) {
      return result.length;
    }

    if ('users' in result && Array.isArray(result.users)) {
      return result.users.length;
    }

    return 0;
  } catch (err) {
    console.error('[AccountSettings] Error fetching root users:', err);
    return 0;
  }
}

/**
 * Delete tenant (initiates deletion request)
 * @param reason - Deletion reason
 * @returns Deletion queue response
 */
export async function deleteTenant(reason: string): Promise<DeletionQueueResponse> {
  const result = (await apiClient.delete('/root/tenants/current', {
    reason: reason || MESSAGES.defaultReason,
  })) as DeletionQueueResponse;
  return result;
}
