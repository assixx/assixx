/**
 * Blackboard Utilities
 * Helper functions for formatting, parsing, and display
 */

import type { Priority, OrgLevel, EntryColor } from './types';
import {
  PRIORITY_LABELS,
  PRIORITY_BADGE_CLASSES,
  ORG_LEVEL_LABELS,
  ORG_LEVEL_BADGE_CLASSES,
  SORT_OPTIONS,
} from './constants';

// ============================================================================
// Date Formatting
// ============================================================================

/**
 * Format date string to German locale
 */
export function formatDate(dateString: string | undefined | null): string {
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
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

/**
 * Parse content that may be a Buffer object from API
 */
export function parseContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (typeof content !== 'object' || content === null) {
    return String(content);
  }

  // Handle Buffer object from API
  if (
    'type' in content &&
    (content as { type: string }).type === 'Buffer' &&
    'data' in content &&
    Array.isArray((content as { data: unknown[] }).data)
  ) {
    return String.fromCharCode(...(content as { data: number[] }).data);
  }

  return JSON.stringify(content);
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
 * Get sticky note color CSS class
 */
export function getColorClass(color: EntryColor): string {
  return `sticky-note--${color}`;
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
 * Format file size to human readable
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i] ?? 'Bytes'}`;
}

/**
 * Get file icon class based on mime type
 */
export function getFileIconClass(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'fa-image';
  if (mimeType === 'application/pdf') return 'fa-file-pdf';
  return 'fa-file';
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate entry form data
 */
export function validateEntryForm(data: { title: string; content: string }): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (data.title.trim() === '') {
    errors.push('Titel ist erforderlich');
  }

  if (data.content.trim() === '') {
    errors.push('Inhalt ist erforderlich');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Auth Utilities
// ============================================================================

/**
 * Check if user can modify entry (edit/delete)
 * Only admin or root can modify entries
 */
export function canModifyEntry(userRole: string | undefined): boolean {
  return userRole === 'admin' || userRole === 'root';
}

// ============================================================================
// Local Storage Utilities
// ============================================================================

const ZOOM_STORAGE_KEY = 'blackboard-zoom';

/**
 * Get saved zoom level from localStorage
 */
export function getSavedZoom(defaultValue: number): number {
  if (typeof localStorage === 'undefined') return defaultValue;

  const saved = localStorage.getItem(ZOOM_STORAGE_KEY);
  if (saved === null || saved === '') return defaultValue;

  const parsed = parseInt(saved, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Save zoom level to localStorage
 */
export function saveZoom(value: number): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(ZOOM_STORAGE_KEY, String(value));
}
