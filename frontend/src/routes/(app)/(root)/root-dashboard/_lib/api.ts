/**
 * Root Dashboard - API Functions
 * @module root-dashboard/_lib/api
 */

import { getApiClient, ApiError } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';
import { fetchCurrentUser as fetchSharedUser } from '$lib/utils/user-service';

import { API_ENDPOINTS, MESSAGES } from './constants';
import { isTemporaryEmployeeNumber } from './utils';

import type { DashboardData, ActivityLog, UserData, LogsApiResponse } from './types';

const log = createLogger('RootDashboardApi');

const apiClient = getApiClient();

/** Load dashboard data from API */
export async function loadDashboardData(): Promise<{
  data: DashboardData | null;
  error: string | null;
  unauthorized: boolean;
}> {
  try {
    const data = await apiClient.get<DashboardData>(API_ENDPOINTS.dashboard);
    return { data, error: null, unauthorized: false };
  } catch (err: unknown) {
    log.error({ err }, 'Error loading dashboard');

    // Handle session expired / unauthorized
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return { data: null, error: null, unauthorized: true };
    }

    return {
      data: null,
      error: err instanceof Error ? err.message : MESSAGES.genericError,
      unauthorized: false,
    };
  }
}

/** Load activity logs from API */
export async function loadActivityLogs(): Promise<ActivityLog[]> {
  try {
    const result = await apiClient.get<LogsApiResponse>(API_ENDPOINTS.logs);
    return result.data?.logs ?? result.logs ?? [];
  } catch (err: unknown) {
    log.error({ err }, 'Error loading logs');
    return [];
  }
}

/**
 * Check if user has temporary employee number.
 * Delegates to shared user service (prevents duplicate /users/me calls)
 */
export async function checkEmployeeNumber(): Promise<{
  userData: UserData | null;
  showModal: boolean;
}> {
  try {
    const result = await fetchSharedUser();
    const userData = result.user as UserData | null;

    if (userData === null) {
      return { userData: null, showModal: false };
    }

    const employeeNumber = userData.employeeNumber ?? '';
    const showModal = isTemporaryEmployeeNumber(employeeNumber);

    return { userData, showModal };
  } catch (err: unknown) {
    log.error({ err }, 'Error checking employee number');
    return { userData: null, showModal: false };
  }
}

/** Save employee number */
export async function saveEmployeeNumber(employeeNumber: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  try {
    await apiClient.patch(API_ENDPOINTS.userMe, { employeeNumber });
    return { success: true, error: null };
  } catch (err: unknown) {
    log.error({ err }, 'Error saving employee number');
    return {
      success: false,
      error: err instanceof Error ? err.message : MESSAGES.employeeNumberSaveError,
    };
  }
}
