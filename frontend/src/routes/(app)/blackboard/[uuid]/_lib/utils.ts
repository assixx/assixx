/**
 * Blackboard Detail Utilities
 * Helper functions for the detail view
 */

import type { DetailEntry, Attachment } from './types';

// Re-export shared utilities from parent
export { formatDateShort, formatFileSize, getFileIconClass } from '../../_lib/utils';

// ============================================================================
// Date Formatting
// ============================================================================

/**
 * Format date for display (short)
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (dateStr === null || dateStr === undefined || dateStr === '') return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format date and time
 */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (dateStr === null || dateStr === undefined || dateStr === '') return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================================================
// Priority Helpers
// ============================================================================

/**
 * Get priority text (German)
 */
export function getPriorityText(priority: string): string {
  const map: Record<string, string> = {
    low: 'Niedrig',
    medium: 'Mittel',
    high: 'Hoch',
    urgent: 'Dringend',
  };
  return map[priority] ?? priority;
}

/**
 * Get priority badge class
 */
export function getPriorityBadgeClass(priority: string): string {
  const map: Record<string, string> = {
    low: 'badge--priority-low',
    medium: 'badge--priority-normal',
    high: 'badge--priority-high',
    urgent: 'badge--priority-urgent',
  };
  return map[priority] ?? 'badge--priority-normal';
}

// ============================================================================
// Org Level Helpers
// ============================================================================

/** Fallback names for org levels */
const ORG_LEVEL_FALLBACKS: Partial<Record<string, string>> = {
  company: 'Firmenweit',
  department: 'Abteilung',
  team: 'Team',
  area: 'Bereich',
};

/**
 * Get org level text with entry context
 */
export function getOrgLevelText(orgLevel: string, entry: DetailEntry | null): string {
  if (orgLevel === 'company') return 'Firmenweit';

  const dynamicNames: Record<string, string | undefined> = {
    department: entry?.departmentName,
    team: entry?.teamName,
    area: entry?.areaName,
  };

  return dynamicNames[orgLevel] ?? ORG_LEVEL_FALLBACKS[orgLevel] ?? orgLevel;
}

/**
 * Get visibility badge class
 */
export function getVisibilityBadgeClass(orgLevel: string): string {
  const map: Record<string, string> = {
    team: 'badge--visibility-team',
    department: 'badge--visibility-department',
    area: 'badge--visibility-area',
    company: 'badge--visibility-company',
  };
  return map[orgLevel] ?? 'badge--visibility-company';
}

// ============================================================================
// File Helpers
// ============================================================================

/**
 * Get file icon class
 */
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'fas fa-image';
  if (mimeType === 'application/pdf') return 'fas fa-file-pdf';
  if (mimeType.includes('word')) return 'fas fa-file-word';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fas fa-file-excel';
  return 'fas fa-file';
}

/**
 * Get preview file type
 */
export function getPreviewFileType(mimeType: string): 'pdf' | 'image' | 'other' {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  return 'other';
}

// ============================================================================
// Avatar Helper
// ============================================================================

/**
 * Get avatar color from ID (0-9)
 */
export function getAvatarColor(id: number): number {
  return id % 10;
}

// ============================================================================
// Photo/Attachment Filtering
// ============================================================================

const PHOTO_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

/**
 * Filter photos from attachments
 */
export function filterPhotos(attachments: Attachment[]): Attachment[] {
  return attachments.filter((att) => PHOTO_MIME_TYPES.includes(att.mimeType));
}

/**
 * Filter non-photo files from attachments
 */
export function filterOtherFiles(attachments: Attachment[]): Attachment[] {
  return attachments.filter((att) => !PHOTO_MIME_TYPES.includes(att.mimeType));
}
