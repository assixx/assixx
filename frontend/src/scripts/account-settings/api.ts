/**
 * Account Settings API Layer
 * Handles all API communication for tenant deletion workflow
 */

import { fetchWithAuth } from '../auth/index.js';
import type { DeletionQueueResponse, RootUsersResponse } from './types.js';

/**
 * Check if deletion data indicates an active deletion request
 * API v2 format: { success: true, data: [...] } or { success: true, data: { queueId, ... } }
 */
function hasActiveDeletion(data: unknown): boolean {
  if (data === null || data === undefined) return false;

  // API v2 wrapped response
  if (typeof data === 'object' && 'data' in data) {
    const response = data as { data: unknown };
    const innerData = response.data;

    // Check if data is array with items
    if (Array.isArray(innerData)) return innerData.length > 0;

    // Check if data has queueId
    if (typeof innerData === 'object' && innerData !== null && 'queueId' in innerData) {
      return true;
    }
  }

  return false;
}

/**
 * Check for pending tenant deletion status
 * @returns Promise<boolean> - True if pending deletion exists
 */
export async function checkDeletionStatus(): Promise<boolean> {
  try {
    const endpoint = '/api/v2/root/tenant/deletion-status';
    const response = await fetchWithAuth(endpoint);

    if (!response.ok) return false;

    const data = (await response.json()) as unknown;
    return hasActiveDeletion(data);
  } catch {
    // Silent fail - no pending deletion found
    console.info('No pending deletion found');
    return false;
  }
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

  const result = (await response.json()) as { success: boolean; data: DeletionQueueResponse };

  // API v2 wraps response in { success: true, data: {...} }
  return result.data;
}
