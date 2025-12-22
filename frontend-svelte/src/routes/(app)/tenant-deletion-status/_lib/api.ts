/**
 * Tenant Deletion Status - API Functions
 * @module tenant-deletion-status/_lib/api
 */

import { getApiClient } from '$lib/utils/api-client';
import type { DeletionStatusItem, ApiResponse, ApiError } from './types';

const apiClient = getApiClient();

/**
 * Load deletion status from API
 * @returns Array of deletion status items
 */
export async function loadDeletionStatus(): Promise<{
  data: DeletionStatusItem[];
  error: string | null;
}> {
  try {
    const result = (await apiClient.get('/root/tenant/deletion-status')) as
      | DeletionStatusItem
      | DeletionStatusItem[]
      | ApiResponse<DeletionStatusItem | DeletionStatusItem[]>
      | null;

    if (result === null) {
      return { data: [], error: null };
    }

    // Handle wrapped response
    const data = 'data' in result && result.data !== undefined ? result.data : result;

    if (Array.isArray(data)) {
      return { data, error: null };
    } else if (typeof data === 'object' && data !== null && 'queueId' in data) {
      return { data: [data as DeletionStatusItem], error: null };
    }

    return { data: [], error: null };
  } catch (err) {
    // 404 means no deletion found - not an error
    const errorObj = err as ApiError;
    const isNotFound =
      errorObj.error === 'NOT_FOUND' || errorObj.message?.includes('No active deletion found');

    if (isNotFound) {
      return { data: [], error: null };
    }

    console.error('[TenantDeletion] Error loading status:', err);
    return {
      data: [],
      error: err instanceof Error ? err.message : 'Fehler beim Laden des Status',
    };
  }
}

/**
 * Reject a deletion request
 * @param queueId - Queue ID to reject
 * @param reason - Rejection reason
 */
export async function rejectDeletion(queueId: number, reason: string): Promise<void> {
  await apiClient.post(`/root/deletion-approvals/${queueId}/reject`, { reason });
}

/**
 * Cancel the current user's deletion request
 */
export async function cancelDeletion(): Promise<void> {
  await apiClient.post('/root/tenant/cancel-deletion', {});
}

/**
 * Emergency stop a deletion process
 * @param queueId - Queue ID to stop
 * @param reason - Optional reason (defaults to standard message)
 */
export async function emergencyStop(queueId: number, reason?: string): Promise<void> {
  await apiClient.post(`/root/deletion-queue/${queueId}/emergency-stop`, {
    reason: reason ?? 'Emergency Stop durch Root-User aktiviert',
  });
}

/**
 * Parse JWT token to extract user info
 * @param token - JWT token string
 * @returns User ID and role, or null if invalid
 */
export function parseJwtToken(token: string): { id: number; role: string } | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { id: payload.id, role: payload.role };
  } catch {
    return null;
  }
}
