/**
 * Availability Helper Functions
 * @module manage-employees/availability/_lib/availability-helpers
 *
 * Shared utility functions for availability history display.
 * Used by both main page and modal components.
 */

import {
  AVAILABILITY_BADGE_CLASSES,
  AVAILABILITY_ICONS,
  AVAILABILITY_LABELS,
} from '$lib/availability/constants';

import type { AvailabilityStatus } from '@assixx/shared';

/**
 * Format date string to German locale format (DD.MM.YYYY)
 * @param dateStr - ISO date string or null
 * @returns Formatted date string or '-'
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
 * @param dateStr - ISO datetime string or null
 * @returns Formatted datetime string or '-'
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
 * @param dateStr - ISO date string or null
 * @returns Date string in YYYY-MM-DD format or empty string
 */
export function formatDateForInput(dateStr: string | null): string {
  if (dateStr === null || dateStr === '') return '';
  return dateStr.split('T')[0];
}

/**
 * Get human-readable text for availability status
 * @param status - Availability status key
 * @returns Localized status label
 */
export function getStatusText(status: string): string {
  if (status in AVAILABILITY_LABELS) {
    return AVAILABILITY_LABELS[status as AvailabilityStatus];
  }
  return status;
}

/**
 * Get CSS badge class for availability status
 * @param status - Availability status key
 * @returns Badge CSS class name
 */
export function getStatusClass(status: string): string {
  if (status in AVAILABILITY_BADGE_CLASSES) {
    return AVAILABILITY_BADGE_CLASSES[status as AvailabilityStatus];
  }
  return 'badge--secondary';
}

/**
 * Get Font Awesome icon class for availability status
 * @param status - Availability status key
 * @returns FA icon class name
 */
export function getStatusIcon(status: string): string {
  if (status in AVAILABILITY_ICONS) {
    return AVAILABILITY_ICONS[status as AvailabilityStatus];
  }
  return 'fa-question-circle';
}

/**
 * Truncate long text with ellipsis
 * @param text - Text to truncate or null
 * @param maxLength - Maximum length before truncation (default: 50)
 * @returns Truncated text or '-' if null/empty
 */
export function truncateText(
  text: string | null,
  maxLength: number = 50,
): string {
  if (text === null || text === '') return '-';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
