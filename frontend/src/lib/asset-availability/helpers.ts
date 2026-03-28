// =============================================================================
// SHARED MACHINE AVAILABILITY HELPERS
// =============================================================================
// Used by asset availability history pages

import {
  MACHINE_AVAILABILITY_BADGE_CLASSES,
  MACHINE_AVAILABILITY_ICONS,
  MACHINE_AVAILABILITY_LABELS,
} from './constants';

import type { AssetAvailabilityStatus } from './constants';

/**
 * Format date string to German locale format (DD.MM.YYYY)
 */
export function formatDate(dateStr: string | null): string {
  if (dateStr === null || dateStr === '') return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format datetime string to German locale format with time (DD.MM.YYYY HH:MM)
 */
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

/**
 * Format date string for HTML date input (YYYY-MM-DD)
 */
export function formatDateForInput(dateStr: string | null): string {
  if (dateStr === null || dateStr === '') return '';
  return dateStr.split('T')[0];
}

/**
 * Get human-readable text for asset availability status
 */
export function getStatusText(status: string): string {
  if (status in MACHINE_AVAILABILITY_LABELS) {
    return MACHINE_AVAILABILITY_LABELS[status as AssetAvailabilityStatus];
  }
  return status;
}

/**
 * Get CSS badge class for asset availability status
 */
export function getStatusClass(status: string): string {
  if (status in MACHINE_AVAILABILITY_BADGE_CLASSES) {
    return MACHINE_AVAILABILITY_BADGE_CLASSES[status as AssetAvailabilityStatus];
  }
  return 'badge--secondary';
}

/**
 * Get Font Awesome icon class for asset availability status
 */
export function getStatusIcon(status: string): string {
  if (status in MACHINE_AVAILABILITY_ICONS) {
    return MACHINE_AVAILABILITY_ICONS[status as AssetAvailabilityStatus];
  }
  return 'fa-question-circle';
}

/**
 * Truncate long text with ellipsis
 */
export function truncateText(text: string | null, maxLength: number = 50): string {
  if (text === null || text === '') return '-';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
