/**
 * Account Settings API Layer
 * Handles all API communication for tenant deletion workflow
 */

import { fetchWithAuth } from '../auth/index.js';
import type { DeletionQueueResponse, DeletionStatusData, RootUsersResponse } from './types.js';

/**
 * API v2 wrapped response format
 */
interface ApiV2Response<T> {
  success: boolean;
  data: T;
}

/**
 * Extract deletion status data from API response
 * API v2 format: { success: true, data: { queueId, status, ... } }
 * @returns DeletionStatusData if valid, null otherwise
 */
function extractDeletionData(data: unknown): DeletionStatusData | null {
  if (data === null || data === undefined) return null;

  // Handle API v2 wrapped response
  if (typeof data === 'object' && 'data' in data) {
    const response = data as ApiV2Response<unknown>;
    const innerData = response.data;

    // Check if data has queueId (indicates valid deletion status)
    if (typeof innerData === 'object' && innerData !== null && 'queueId' in innerData) {
      return innerData as DeletionStatusData;
    }
  }

  // Handle unwrapped response (direct data object)
  if (typeof data === 'object' && 'queueId' in data) {
    return data as DeletionStatusData;
  }

  return null;
}

/**
 * Get pending tenant deletion status with full data
 * @returns Promise<DeletionStatusData | null> - Full status data or null if none
 */
export async function getDeletionStatus(): Promise<DeletionStatusData | null> {
  try {
    const endpoint = '/api/v2/root/tenant/deletion-status';
    const response = await fetchWithAuth(endpoint);

    if (!response.ok) return null;

    const data = (await response.json()) as unknown;
    return extractDeletionData(data);
  } catch {
    console.info('[AccountSettings] No pending deletion found');
    return null;
  }
}

/**
 * Check for pending tenant deletion status (legacy boolean version)
 * @returns Promise<boolean> - True if pending deletion exists
 * @deprecated Use getDeletionStatus() for full data
 */
export async function checkDeletionStatus(): Promise<boolean> {
  const status = await getDeletionStatus();
  return status !== null;
}

/**
 * Get count of root users in current tenant
 * @returns Promise<number> - Number of root users
 * @throws Error if API request fails
 */
export async function getRootUserCount(): Promise<number> {
  const endpoint = '/api/v2/root/users';
  const response = await fetchWithAuth(endpoint);

  if (!response.ok) {
    throw new Error('Failed to fetch root users');
  }

  const data = (await response.json()) as RootUsersResponse;

  // /root/users endpoint returns { users: [...] } directly
  return Array.isArray(data.users) ? data.users.length : 0;
}

/**
 * Delete the current tenant
 * @param reason - Optional reason for deletion
 * @returns Promise with deletion queue data
 * @throws Error if deletion fails
 */
export async function deleteTenant(reason?: string): Promise<DeletionQueueResponse> {
  const endpoint = '/api/v2/root/tenants/current';
  const response = await fetchWithAuth(endpoint, {
    method: 'DELETE',
    body: JSON.stringify({
      reason: reason ?? 'Keine Angabe',
    }),
  });

  if (!response.ok) {
    const error = (await response.json()) as { error?: string };
    throw new Error(error.error ?? 'Fehler beim Löschen des Tenants');
  }

  // fetchWithAuth uses apiClient which already unwraps the response
  return (await response.json()) as DeletionQueueResponse;
}
