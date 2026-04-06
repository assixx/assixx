// =============================================================================
// KVP - UTILITY FUNCTIONS
// =============================================================================

import { DEFAULT_HIERARCHY_LABELS, type HierarchyLabels } from '$lib/types/hierarchy-labels';

import {
  STATUS_BADGE_CLASSES,
  STATUS_TEXT,
  PRIORITY_BADGE_CLASSES,
  PRIORITY_TEXT,
  VISIBILITY_BADGE_CLASSES,
  createVisibilityInfo,
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
 * Shows org names from junction table when available, falls back to orgLevel
 */
export function getVisibilityInfo(
  suggestion: KvpSuggestion,
  labels: HierarchyLabels = DEFAULT_HIERARCHY_LABELS,
): {
  icon: string;
  text: string;
} {
  return getOrgLevelVisibility(suggestion, labels);
}

/** Visibility from orgLevel + orgId on the main record */
function getOrgLevelVisibility(
  suggestion: KvpSuggestion,
  labels: HierarchyLabels,
): {
  icon: string;
  text: string;
} {
  if (!suggestion.isShared) {
    return { icon: 'fa-lock', text: 'Nur Team' };
  }

  const visibilityInfo = createVisibilityInfo(labels);
  const info = visibilityInfo[suggestion.orgLevel];
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
 * Check if icon string is a FontAwesome name (ASCII lowercase + hyphens)
 * vs an emoji (Unicode characters).
 * Global categories use emojis, custom categories use FA names.
 */
export function isFaIcon(icon: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(icon);
}

/**
 * Validate photo file
 */
export function validatePhotoFile(file: File): {
  valid: boolean;
  error?: string;
} {
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
