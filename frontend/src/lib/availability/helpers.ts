// =============================================================================
// SHARED AVAILABILITY HELPERS
// =============================================================================
// Used by availability history pages across manage-employees, manage-admins, manage-root

import {
  AVAILABILITY_BADGE_CLASSES,
  AVAILABILITY_ICONS,
  AVAILABILITY_LABELS,
} from './constants';

import type { AvailabilityStatus } from '@assixx/shared';

/** Format date string to German locale format (DD.MM.YYYY) */
export function formatDate(dateStr: string | null): string {
  if (dateStr === null || dateStr === '') return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Format datetime string to German locale format with time (DD.MM.YYYY HH:MM) */
export function formatDateTime(dateStr: string | null): string {
  if (dateStr === null || dateStr === '') return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format date string for HTML date input (YYYY-MM-DD) */
export function formatDateForInput(dateStr: string | null): string {
  if (dateStr === null || dateStr === '') return '';
  return dateStr.split('T')[0];
}

/** Get human-readable text for availability status */
export function getStatusText(status: string): string {
  if (status in AVAILABILITY_LABELS) {
    return AVAILABILITY_LABELS[status as AvailabilityStatus];
  }
  return status;
}

/** Get CSS badge class for availability status */
export function getStatusClass(status: string): string {
  if (status in AVAILABILITY_BADGE_CLASSES) {
    return AVAILABILITY_BADGE_CLASSES[status as AvailabilityStatus];
  }
  return 'badge--secondary';
}

/** Get Font Awesome icon class for availability status */
export function getStatusIcon(status: string): string {
  if (status in AVAILABILITY_ICONS) {
    return AVAILABILITY_ICONS[status as AvailabilityStatus];
  }
  return 'fa-question-circle';
}

/** Truncate long text with ellipsis */
export function truncateText(
  text: string | null,
  maxLength: number = 50,
): string {
  if (text === null || text === '') return '-';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
