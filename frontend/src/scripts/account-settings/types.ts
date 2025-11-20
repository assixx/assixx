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
