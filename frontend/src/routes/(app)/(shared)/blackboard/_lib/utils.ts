/**
 * Blackboard Utilities
 * Helper functions for formatting, parsing, and display
 */

import {
  PRIORITY_LABELS,
  PRIORITY_BADGE_CLASSES,
  ORG_LEVEL_LABELS,
  ORG_LEVEL_BADGE_CLASSES,
  SORT_OPTIONS,
} from './constants';

import type { Priority, OrgLevel } from './types';

// ============================================================================
// Date Formatting
// ============================================================================

/**
 * Format date for display (short version)
 */
export function formatDateShort(dateString: string | undefined | null): string {
  if (dateString === undefined || dateString === null || dateString === '') {
    return '';
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Check if a date is expired (in the past)
 */
export function isExpired(dateString: string | undefined | null): boolean {
  if (dateString === undefined || dateString === null || dateString === '') {
    return false;
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.getTime() < Date.now();
}

// ============================================================================
// Text Formatting
// ============================================================================

/**
 * Truncate text to specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number = 150): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

// ============================================================================
// Label & Class Getters
// ============================================================================

/**
 * Get priority label (German)
 */
export function getPriorityLabel(priority: Priority): string {
  return PRIORITY_LABELS[priority];
}

/**
 * Get priority badge CSS class
 */
export function getPriorityClass(priority: Priority): string {
  return PRIORITY_BADGE_CLASSES[priority];
}

/**
 * Get org level label (German)
 */
export function getOrgLevelLabel(orgLevel: OrgLevel): string {
  return ORG_LEVEL_LABELS[orgLevel];
}

/**
 * Get org level badge CSS class
 */
export function getOrgLevelClass(orgLevel: OrgLevel): string {
  return ORG_LEVEL_BADGE_CLASSES[orgLevel];
}

/**
 * Get sort label from value
 */
export function getSortLabel(value: string): string {
  const option = SORT_OPTIONS.find((opt) => opt.value === value);
  return option?.label ?? 'Sortieren';
}

// ============================================================================
// File Utilities
// ============================================================================

/**
 * Get file icon class based on mime type
 */
export function getFileIconClass(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'fa-image';
  if (mimeType === 'application/pdf') return 'fa-file-pdf';
  return 'fa-file';
}

/**
 * Format file size to human readable
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i] ?? 'Bytes'}`;
}
