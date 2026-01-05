/**
 * Root Dashboard - API Functions
 * @module root-dashboard/_lib/api
 */

import type { DashboardData, ActivityLog, UserData, LogsApiResponse, ApiResponse } from './types';
import { API_ENDPOINTS, STORAGE_KEYS, MESSAGES } from './constants';
import { isTemporaryEmployeeNumber } from './utils';
import { fetchCurrentUser as fetchSharedUser } from '$lib/utils/user-service';

/**
 * Get access token from localStorage
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.accessToken);
}

/**
 * Remove access token from localStorage
 */
export function removeAccessToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEYS.accessToken);
  }
}

/**
 * Load dashboard data from API
 * @returns Dashboard data or error
 */
export async function loadDashboardData(): Promise<{
  data: DashboardData | null;
  error: string | null;
  unauthorized: boolean;
}> {
  const token = getAccessToken();
  if (!token) {
    return { data: null, error: null, unauthorized: true };
  }

  try {
    const response = await fetch(API_ENDPOINTS.dashboard, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        removeAccessToken();
        return { data: null, error: null, unauthorized: true };
      }
      throw new Error(MESSAGES.dashboardLoadError);
    }

    const result = (await response.json()) as ApiResponse<DashboardData> | DashboardData;
    const data = 'data' in result && result.data ? result.data : (result as DashboardData);

    return { data, error: null, unauthorized: false };
  } catch (err) {
    console.error('Error loading dashboard:', err);
    return {
      data: null,
      error: err instanceof Error ? err.message : MESSAGES.genericError,
      unauthorized: false,
    };
  }
}

/**
 * Load activity logs from API
 * @returns Array of activity logs
 */
export async function loadActivityLogs(): Promise<ActivityLog[]> {
  const token = getAccessToken();
  if (!token) return [];

  try {
    const response = await fetch(API_ENDPOINTS.logs, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(MESSAGES.logsLoadError);
    }

    const result = (await response.json()) as LogsApiResponse;
    return result.data?.logs ?? result.logs ?? [];
  } catch (err) {
    console.error('Error loading logs:', err);
    return [];
  }
}

/**
 * Check if user has temporary employee number
 * DELEGATES to shared user service (prevents duplicate /users/me calls)
 * @returns Object with user data and whether modal should be shown
 */
export async function checkEmployeeNumber(): Promise<{
  userData: UserData | null;
  showModal: boolean;
}> {
  const token = getAccessToken();
  if (!token) {
    return { userData: null, showModal: false };
  }

  try {
    const result = await fetchSharedUser();
    const userData = result.user as UserData | null;

    if (userData === null) {
      return { userData: null, showModal: false };
    }

    const employeeNumber = userData?.employeeNumber ?? '';
    const showModal = isTemporaryEmployeeNumber(employeeNumber);

    return { userData, showModal };
  } catch (err) {
    console.error('Error checking employee number:', err);
    return { userData: null, showModal: false };
  }
}

/**
 * Save employee number
 * @param employeeNumber - New employee number
 * @returns Success status
 */
export async function saveEmployeeNumber(employeeNumber: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, error: MESSAGES.genericError };
  }

  try {
    const response = await fetch(API_ENDPOINTS.userMe, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        employeeNumber,
      }),
    });

    if (!response.ok) {
      throw new Error(MESSAGES.saveError);
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('Error saving employee number:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : MESSAGES.employeeNumberSaveError,
    };
  }
}
