/**
 * Account Settings - API Functions
 * @module account-settings/_lib/api
 */

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';

import { STORAGE_KEYS, MESSAGES } from './constants';

import type {
  DeletionStatusData,
  DeletionQueueResponse,
  DeletionStatusResponse,
  RootUsersResponse,
  JwtPayload,
  ShiftTimeData,
} from './types';

const log = createLogger('AccountSettingsApi');

const apiClient = getApiClient();

/** Parse JWT token to extract payload */
export function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }
    const parsed: unknown = JSON.parse(atob(parts[1]));
    if (typeof parsed === 'object' && parsed !== null && 'role' in parsed) {
      return parsed as JwtPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/** Get access token from localStorage */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.accessToken);
}

/** Check if user is authenticated and has root role */
export function checkAuthRole(): {
  isAuthenticated: boolean;
  role: string | null;
} {
  const token = getAccessToken();
  if (token === null || token === '') {
    return { isAuthenticated: false, role: null };
  }

  const payload = parseJwtPayload(token);
  if (payload === null) {
    return { isAuthenticated: false, role: null };
  }

  return { isAuthenticated: true, role: payload.role };
}

/** Load pending deletion status */
export async function loadDeletionStatus(): Promise<DeletionStatusData | null> {
  try {
    const result = await apiClient.get<
      DeletionStatusResponse | DeletionStatusData | null
    >('/root/tenant/deletion-status');

    if (result === null) {
      return null;
    }

    // Handle wrapped response
    if ('data' in result && result.data && 'queueId' in result.data) {
      return result.data;
    }

    if ('queueId' in result) {
      return result;
    }

    return null;
  } catch {
    // No pending deletion - this is expected in most cases
    return null;
  }
}

/** Get count of root users in tenant */
export async function getRootUserCount(): Promise<number> {
  try {
    const result = await apiClient.get<RootUsersResponse | { id: number }[]>(
      '/root/users',
    );

    if (Array.isArray(result)) {
      return result.length;
    }

    if (result.users !== undefined && Array.isArray(result.users)) {
      return result.users.length;
    }

    return 0;
  } catch (err: unknown) {
    log.error({ err }, 'Error fetching root users');
    return 0;
  }
}

/** Delete tenant (initiates deletion request) */
export async function deleteTenant(
  reason: string,
): Promise<DeletionQueueResponse> {
  return await apiClient.delete('/root/tenants/current', {
    reason: reason !== '' ? reason : MESSAGES.defaultReason,
  });
}

// =============================================================================
// Shift Times API
// =============================================================================

/** Load shift times for current tenant */
export async function loadShiftTimes(): Promise<ShiftTimeData[]> {
  try {
    const result = await apiClient.get<ShiftTimeData[]>('/shift-times');
    return Array.isArray(result) ? result : [];
  } catch (err: unknown) {
    log.error({ err }, 'Error fetching shift times');
    return [];
  }
}

/** Save all shift times at once */
export async function saveShiftTimes(
  shiftTimes: {
    shiftKey: string;
    label: string;
    startTime: string;
    endTime: string;
  }[],
): Promise<ShiftTimeData[]> {
  return await apiClient.put<ShiftTimeData[]>('/shift-times', { shiftTimes });
}

/** Reset shift times to system defaults */
export async function resetShiftTimes(): Promise<ShiftTimeData[]> {
  return await apiClient.post<ShiftTimeData[]>('/shift-times/reset', {});
}
