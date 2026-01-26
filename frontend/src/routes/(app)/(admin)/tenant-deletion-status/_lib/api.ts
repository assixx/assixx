/**
 * Tenant Deletion Status - API Functions
 * @module tenant-deletion-status/_lib/api
 */

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';

import type { DeletionStatusItem, ApiError } from './types';

const log = createLogger('TenantDeletionStatusApi');

const apiClient = getApiClient();

// =============================================================================
// HELPER FUNCTIONS (reduce cognitive complexity)
// =============================================================================

/**
 * Check if error is a "not found" error (404)
 */
function isNotFoundError(err: unknown): boolean {
  const errorObj = err as ApiError;
  return (
    errorObj.error === 'NOT_FOUND' ||
    (errorObj.message?.includes('No active deletion found') ?? false)
  );
}

/**
 * Extract deletion status items from API response
 */
function parseApiResponse(result: unknown): DeletionStatusItem[] {
  if (result === null) {
    return [];
  }

  // Handle wrapped response { data: [...] }
  const unwrapped = result as { data?: unknown };
  const data = 'data' in unwrapped && unwrapped.data !== undefined ? unwrapped.data : result;

  if (Array.isArray(data)) {
    return data as DeletionStatusItem[];
  }

  // Single item response
  if (typeof data === 'object' && data !== null && 'queueId' in data) {
    return [data as DeletionStatusItem];
  }

  return [];
}

/**
 * Format error message for display
 */
function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Fehler beim Laden des Status';
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Load deletion status from API
 * @returns Array of deletion status items
 */
export async function loadDeletionStatus(): Promise<{
  data: DeletionStatusItem[];
  error: string | null;
}> {
  try {
    const result = await apiClient.get('/root/tenant/deletion-status');
    return { data: parseApiResponse(result), error: null };
  } catch (err) {
    if (isNotFoundError(err)) {
      return { data: [], error: null };
    }

    log.error({ err }, 'Error loading status');
    return { data: [], error: getErrorMessage(err) };
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

/** JWT payload structure */
interface JwtPayload {
  id: number;
  role: string;
}

/**
 * Parse JWT token to extract user info
 * @param token - JWT token string
 * @returns User ID and role, or null if invalid
 */
export function parseJwtToken(token: string): { id: number; role: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const payload = JSON.parse(atob(parts[1])) as JwtPayload;
    return { id: payload.id, role: payload.role };
  } catch {
    return null;
  }
}
