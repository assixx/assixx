/**
 * Company Settings - Type Definitions
 * @module company-settings/_lib/types
 */

/** Deletion status values */
export type DeletionStatus =
  | 'pending_approval'
  | 'approved'
  | 'cooling_off'
  | 'scheduled'
  | 'completed'
  | 'cancelled';

/** Toast notification type */
export type ToastType = 'success' | 'error' | 'info' | 'warning';

/** Deletion status data from API */
export interface DeletionStatusData {
  queueId: number;
  tenantId: number;
  status: DeletionStatus;
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

/** Deletion queue response from API */
export interface DeletionQueueResponse {
  queueId: number;
  tenantId: number;
  scheduledDate?: string;
  message?: string;
  approvalRequired?: boolean;
}

/** Wrapped API response variant */
export interface DeletionStatusResponse {
  data?: DeletionStatusData;
}

/** Root users API response */
export interface RootUsersResponse {
  users?: { id: number }[];
}

/** JWT payload structure */
export interface JwtPayload {
  role: string;
  [key: string]: unknown;
}

/** Shift time definition from API */
export interface ShiftTimeData {
  shiftKey: string;
  label: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
  isActive: number;
}
