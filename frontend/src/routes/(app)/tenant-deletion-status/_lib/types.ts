/**
 * Tenant Deletion Status - Type Definitions
 * @module tenant-deletion-status/_lib/types
 */

/** Possible deletion process statuses */
export type DeletionStatus =
  | 'pending'
  | 'pending_approval'
  | 'approved'
  | 'queued'
  | 'processing'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'stopped';

/** Deletion status item from API */
export interface DeletionStatusItem {
  queueId: number;
  tenantId: number;
  status: DeletionStatus;
  requestedBy: number;
  requestedByName?: string;
  requestedAt: string;
  approvedBy?: number;
  approvedAt?: string;
  scheduledFor?: string;
  reason?: string;
  errorMessage?: string;
  coolingOffHours: number;
  canCancel: boolean;
  canApprove: boolean;
}

/** Timeline item for status visualization */
export interface TimelineItem {
  icon: string;
  title: string;
  date: Date | null;
  completed: boolean;
}

/** Confirm modal action types */
export type ConfirmModalType = 'cancel' | 'emergency-stop' | 'reject' | null;

/** Toast notification types */
export type ToastType = 'success' | 'error' | 'info' | 'warning';

/** JWT payload structure */
export interface JwtPayload {
  id: number;
  role: string;
  [key: string]: unknown;
}

/** API error structure */
export interface ApiError {
  error?: string;
  message?: string;
}

/** API response wrapper */
export interface ApiResponse<T> {
  data?: T;
}
