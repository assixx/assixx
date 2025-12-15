/**
 * Account Settings Types
 * Type definitions for tenant deletion workflow
 */

/**
 * Deletion queue response from API v2 (camelCase only)
 */
export interface DeletionQueueResponse {
  queueId: number;
  tenantId: number;
  scheduledDate?: string;
  message?: string;
  approvalRequired?: boolean;
}

/**
 * Root users response from API v2
 * Note: /root/users endpoint returns { users: [...] } directly
 */
export interface RootUsersResponse {
  users: RootUser[];
}

/**
 * Root user data
 */
export interface RootUser {
  id: number;
  username: string;
  email: string;
  role: 'root';
}

/**
 * Action handler function type
 */
export type ActionHandler = (target: HTMLElement) => void;

/**
 * Modal data for deletion status
 */
export interface DeletionStatusModalData {
  queueId: number | string;
  tenantId: number | string;
}

/**
 * Full deletion status data from API v2
 * Used for displaying pending deletion banner on page load
 */
export interface DeletionStatusData {
  queueId: number;
  tenantId: number;
  status: 'pending_approval' | 'approved' | 'cooling_off' | 'scheduled' | 'completed' | 'cancelled';
  requestedBy: number;
  requestedAt: string;
  coolingOffHours: number;
  canCancel: boolean;
  canApprove: boolean;
  requestedByName?: string;
  approvedBy?: number;
  approvedAt?: string;
  scheduledDeletionDate?: string;
}
