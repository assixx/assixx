// =============================================================================
// KVP - UTILITY FUNCTIONS
// =============================================================================

import {
  STATUS_BADGE_CLASSES,
  STATUS_TEXT,
  PRIORITY_BADGE_CLASSES,
  PRIORITY_TEXT,
  VISIBILITY_BADGE_CLASSES,
  VISIBILITY_INFO,
  UPLOAD_CONFIG,
} from './constants';

import type { KvpSuggestion, KvpStatus, KvpPriority, OrgLevel } from './types';

/**
 * Get status badge CSS class
 */
export function getStatusBadgeClass(status: KvpStatus): string {
  return STATUS_BADGE_CLASSES[status];
}

/**
 * Get status display text
 */
export function getStatusText(status: KvpStatus): string {
  return STATUS_TEXT[status];
}

/**
 * Get priority badge CSS class
 */
export function getPriorityBadgeClass(priority: KvpPriority): string {
  return PRIORITY_BADGE_CLASSES[priority];
}

/**
 * Get priority display text
 */
export function getPriorityText(priority: KvpPriority): string {
  return PRIORITY_TEXT[priority];
}

/**
 * Get visibility badge CSS class
 */
export function getVisibilityBadgeClass(orgLevel: OrgLevel): string {
  return VISIBILITY_BADGE_CLASSES[orgLevel];
}

/**
 * Get visibility info (icon + text) for suggestion
 * Shows "Privat" for non-shared, org-level name for shared
 */
export function getVisibilityInfo(suggestion: KvpSuggestion): { icon: string; text: string } {
  // If not shared (private)
  if (!suggestion.isShared) {
    return { icon: 'fa-lock', text: 'Nur Team' };
  }

  // If shared, show org level info (Record guarantees all OrgLevel keys exist)
  const info = VISIBILITY_INFO[suggestion.orgLevel];

  // Use specific name if available (check for empty string)
  let text = info.text;
  if (suggestion.orgLevel === 'department' && suggestion.departmentName !== '') {
    text = suggestion.departmentName;
  } else if (
    suggestion.orgLevel === 'area' &&
    suggestion.areaName !== undefined &&
    suggestion.areaName !== ''
  ) {
    text = suggestion.areaName;
  } else if (
    suggestion.orgLevel === 'team' &&
    suggestion.teamName !== undefined &&
    suggestion.teamName !== ''
  ) {
    text = suggestion.teamName;
  }

  return { icon: info.icon, text };
}

/**
 * Format date for display (German locale)
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('de-DE');
}

/**
 * Format currency for display (German locale)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

/**
 * Escape HTML for safe rendering
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Validate photo file
 */
export function validatePhotoFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes: readonly string[] = UPLOAD_CONFIG.ALLOWED_TYPES;
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Nur JPG und PNG Dateien sind erlaubt' };
  }

  if (file.size > UPLOAD_CONFIG.MAX_FILE_SIZE) {
    return { valid: false, error: 'Datei ist zu gross (max. 10MB)' };
  }

  return { valid: true };
}

/**
 * Read file as data URL for preview
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Debounce function for search input
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Check if user can share suggestion (admin only, department level)
 */
export function canShareSuggestion(suggestion: KvpSuggestion, effectiveRole: string): boolean {
  return (
    (effectiveRole === 'admin' || effectiveRole === 'root') && suggestion.orgLevel === 'department'
  );
}

/**
 * Check if user can unshare suggestion
 * Allows unsharing for any shared suggestion (department, area, company)
 * - Admin/Root can always unshare
 * - Original sharer can unshare their own shares
 */
export function canUnshareSuggestion(
  suggestion: KvpSuggestion,
  effectiveRole: string,
  currentUserId: number | undefined,
): boolean {
  // Must be shared and not at team level (team is default, not "shared")
  if (!suggestion.isShared || suggestion.orgLevel === 'team') {
    return false;
  }

  // Admin/Root can always unshare, or the person who shared it
  return (
    effectiveRole === 'admin' || effectiveRole === 'root' || suggestion.sharedBy === currentUserId
  );
}

/**
 * Get shared by info text
 */
export function getSharedByInfo(suggestion: KvpSuggestion): string {
  if (suggestion.sharedByName !== undefined && suggestion.sharedByName !== '') {
    return ` - Geteilt von ${suggestion.sharedByName}`;
  }
  return '';
}

/**
 * Get attachment count text
 */
export function getAttachmentText(count: number | undefined): string {
  if (count === undefined || count === 0) return '';
  return `${count} Foto${count > 1 ? 's' : ''}`;
}
