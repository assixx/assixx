/**
 * Tenant Deletion Status - Constants
 * @module tenant-deletion-status/_lib/constants
 */

import type { DeletionStatus } from './types';

/** Status text mapping (German) */
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

/** Badge CSS class mapping */
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

/** Auto-refresh interval in milliseconds */
export const REFRESH_INTERVAL_MS = 60000;

/** Timeline icons mapping */
export const TIMELINE_ICONS = {
  requested: 'fa-plus-circle',
  approved: 'fa-check-circle',
  scheduled: 'fa-calendar-check',
  completed: 'fa-check-double',
} as const;

/** UI Messages (German) */
export const MESSAGES = {
  noRequests: 'Keine Löschanfragen vorhanden',
  noRequestsDescription:
    'Es gibt derzeit keine ausstehenden Tenant-Löschanfragen.',
  loadError: 'Fehler beim Laden des Status',
  rejected: 'Löschung abgelehnt!',
  cancelled: 'Löschanfrage abgebrochen!',
  emergencyStopped: 'EMERGENCY STOP aktiviert! Löschung wurde gestoppt.',
  genericError: 'Ein Fehler ist aufgetreten',
  pendingApproval: 'Ausstehend',
  gracePeriodDefault: '30 Tage ab Genehmigung',
} as const;
