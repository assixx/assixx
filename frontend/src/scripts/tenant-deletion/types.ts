/**
 * Types and Interfaces for Tenant Deletion Status
 *
 * Shared type definitions used across tenant deletion modules
 */

/**
 * Status values for deletion requests
 * Maps to database enum and UI display
 */
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

/**
 * Main deletion status item from API v2
 * Uses camelCase only (no snake_case legacy support)
 */
export interface DeletionStatusItem {
  // Identifiers
  queueId: number;
  tenantId: number;

  // Status
  status: DeletionStatus;

  // Requester info
  requestedBy: number;
  requestedByName?: string;

  // Timestamps
  requestedAt: string;
  approvedBy?: number;
  approvedAt?: string;
  scheduledFor?: string;

  // Reason and error
  reason?: string;
  errorMessage?: string;

  // Configuration
  coolingOffHours: number;

  // Permissions (from API)
  canCancel: boolean;
  canApprove: boolean;
}

/**
 * Timeline item for deletion process visualization
 */
export interface TimelineItem {
  icon: string;
  title: string;
  date: Date | null;
  completed: boolean;
}

/**
 * Status text mapping for German UI
 */
export const STATUS_TEXT_MAP: Record<DeletionStatus, string> = {
  pending: 'Genehmigung ausstehend',
  pending_approval: 'Genehmigung ausstehend',
  approved: 'Genehmigt - 30 Tage Grace Period',
  queued: 'In Warteschlange (30 Tage Grace Period)',
  processing: 'In Bearbeitung',
  executing: 'Wird ausgeführt',
  completed: 'Abgeschlossen',
  failed: 'Fehlgeschlagen',
  cancelled: 'Abgebrochen',
  stopped: 'Gestoppt',
};

/**
 * Badge class mapping for status display
 * Uses Design System badge variants
 */
export const STATUS_BADGE_CLASS: Record<DeletionStatus, string> = {
  pending: 'badge--pending',
  pending_approval: 'badge--pending',
  approved: 'badge--approved',
  queued: 'badge--queued',
  processing: 'badge--processing',
  executing: 'badge--processing',
  completed: 'badge--completed',
  failed: 'badge--failed',
  cancelled: 'badge--cancelled',
  stopped: 'badge--stopped',
};

/**
 * Window interface extension for global handlers
 * Used for backward compatibility during migration
 */
export interface WindowWithDeletionHandlers extends Window {
  approveDeletion?: (queueId: number) => Promise<void>;
  rejectDeletion?: (queueId: number) => Promise<void>;
  cancelDeletion?: (queueId: number) => Promise<void>;
  emergencyStop?: (queueId: number) => Promise<void>;
}
