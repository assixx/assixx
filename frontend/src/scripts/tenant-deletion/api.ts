/**
 * API functions for Tenant Deletion Status
 *
 * All API calls related to tenant deletion management
 */

import { ApiClient } from '../../utils/api-client';
import type { DeletionStatusItem } from './types';

// Get singleton API client instance
const apiClient = ApiClient.getInstance();

/**
 * Error response structure from API
 */
interface ApiError {
  error?: string;
  message?: string;
}

/**
 * API response with optional data field
 */
interface ApiResponse {
  data?: unknown;
}

/**
 * Load deletion status from API
 *
 * Handles both single object and array responses from the API.
 * Returns empty array if no deletion requests found (404).
 *
 * @returns Array of deletion status items
 * @throws Error for actual API errors (not 404)
 */
export async function loadDeletionStatus(): Promise<DeletionStatusItem[]> {
  try {
    const response = await apiClient.request<ApiResponse>('/root/tenant/deletion-status', {
      method: 'GET',
    });

    // Handle both single object and array responses
    const data = response.data ?? response;

    if (Array.isArray(data)) {
      return data as DeletionStatusItem[];
    }

    if (typeof data === 'object') {
      // Single object response - wrap in array
      return [data as DeletionStatusItem];
    }

    return [];
  } catch (error: unknown) {
    const apiError = error as ApiError;

    // Check if it's a 404 (no deletion found) - return empty array
    const isNotFound =
      apiError.error === 'NOT_FOUND' || apiError.message?.includes('No active deletion found') === true;

    if (isNotFound) {
      return [];
    }

    // Re-throw actual errors
    throw error;
  }
}

/**
 * Approve a deletion request
 *
 * Requires two-person principle: approver must be different from requester.
 * Starts the 30-day grace period after approval.
 *
 * @param queueId - The deletion queue ID to approve
 * @param password - Current user's password for verification
 * @throws Error if approval fails or password is invalid
 */
export async function approveDeletion(queueId: number, password: string): Promise<void> {
  await apiClient.request(`/root/deletion-approvals/${queueId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });
}

/**
 * Reject a deletion request
 *
 * @param queueId - The deletion queue ID to reject
 * @param reason - Reason for rejection (required)
 * @throws Error if rejection fails
 */
export async function rejectDeletion(queueId: number, reason: string): Promise<void> {
  await apiClient.request(`/root/deletion-approvals/${queueId}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });
}

/**
 * Cancel a deletion request
 *
 * Only the requester can cancel their own deletion request.
 *
 * @throws Error if cancellation fails
 */
export async function cancelDeletion(): Promise<void> {
  await apiClient.request('/root/tenant/cancel-deletion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
}

/**
 * Emergency stop a deletion process
 *
 * Available for all root users. Stops the deletion immediately
 * and reactivates the tenant.
 *
 * @param queueId - The deletion queue ID to stop
 * @param reason - Reason for emergency stop (optional)
 * @throws Error if emergency stop fails
 */
export async function emergencyStop(queueId: number, reason?: string): Promise<void> {
  await apiClient.request(`/root/deletion-queue/${queueId}/emergency-stop`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reason: reason ?? 'Emergency Stop durch Root-User aktiviert',
    }),
  });
}
