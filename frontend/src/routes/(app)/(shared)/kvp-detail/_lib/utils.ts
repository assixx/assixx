// =============================================================================
// KVP-DETAIL - UTILITY FUNCTIONS
// =============================================================================

import {
  STATUS_BADGE_CLASSES,
  STATUS_TEXT,
  PRIORITY_BADGE_CLASSES,
  PRIORITY_TEXT,
  VISIBILITY_BADGE_CLASSES,
  VISIBILITY_INFO,
  IMAGE_FILE_TYPES,
} from './constants';

import type {
  KvpSuggestion,
  KvpStatus,
  KvpPriority,
  OrgLevel,
  Attachment,
} from './types';

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
export function getVisibilityInfo(suggestion: KvpSuggestion): {
  icon: string;
  text: string;
} {
  // Junction table organizations take priority (new multi-team/asset flow)
  if (
    suggestion.organizations !== undefined &&
    suggestion.organizations.length > 0
  ) {
    return getOrganizationsVisibility(suggestion);
  }

  // Legacy fallback: single orgLevel/orgId
  return getLegacyVisibility(suggestion);
}

/** Visibility from junction table organizations */
function getOrganizationsVisibility(suggestion: KvpSuggestion): {
  icon: string;
  text: string;
} {
  const orgs = suggestion.organizations ?? [];
  const teams = orgs.filter((o) => o.orgType === 'team');
  const assets = orgs.filter((o) => o.orgType === 'asset');

  const parts: string[] = [];
  for (const t of teams) {
    parts.push(t.orgName ?? `Team ${t.orgId}`);
  }
  for (const m of assets) {
    parts.push(m.orgName ?? `Anlage ${m.orgId}`);
  }

  if (parts.length > 0) {
    const icon =
      assets.length > 0 && teams.length === 0 ? 'fa-cog' : 'fa-users';
    return { icon, text: parts.join(', ') };
  }

  return { icon: 'fa-lock', text: 'Keine Zuordnung' };
}

/** Legacy visibility from single orgLevel field */
function getLegacyVisibility(suggestion: KvpSuggestion): {
  icon: string;
  text: string;
} {
  if (!suggestion.isShared) {
    return { icon: 'fa-lock', text: 'Nur Team' };
  }

  const info = VISIBILITY_INFO[suggestion.orgLevel];
  let text = info.text;

  if (
    suggestion.orgLevel === 'department' &&
    suggestion.departmentName !== ''
  ) {
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
 * Format date with time for display (German locale)
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
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Check if suggestion has financial info
 */
export function hasFinancialInfo(suggestion: KvpSuggestion): boolean {
  const hasEstimatedCost =
    suggestion.estimatedCost !== undefined && suggestion.estimatedCost !== 0;
  const hasActualSavings =
    suggestion.actualSavings !== undefined && suggestion.actualSavings !== 0;
  return hasEstimatedCost || hasActualSavings;
}

/**
 * Check if suggestion has implementation date
 */
export function hasImplementationDate(suggestion: KvpSuggestion): boolean {
  return (
    suggestion.status === 'implemented' &&
    suggestion.implementationDate !== undefined &&
    suggestion.implementationDate !== ''
  );
}

/**
 * Check if user is admin or root
 */
export function isUserAdmin(role: string): boolean {
  return role === 'admin' || role === 'root';
}

/**
 * Check if attachment is an image
 */
export function isImageAttachment(attachment: Attachment): boolean {
  return IMAGE_FILE_TYPES.includes(
    attachment.fileType as (typeof IMAGE_FILE_TYPES)[number],
  );
}

/**
 * Split attachments into photos and other files
 */
export function splitAttachments(attachments: Attachment[]): {
  photos: Attachment[];
  otherFiles: Attachment[];
} {
  const photos = attachments.filter(isImageAttachment);
  const otherFiles = attachments.filter((att) => !isImageAttachment(att));
  return { photos, otherFiles };
}

/**
 * Get file icon class based on file type
 */
export function getFileIconClass(fileType: string): string {
  if (fileType.includes('pdf')) return 'fa-file-pdf';
  if (fileType.includes('word') || fileType.includes('document'))
    return 'fa-file-word';
  if (fileType.includes('excel') || fileType.includes('spreadsheet'))
    return 'fa-file-excel';
  if (fileType.includes('image')) return 'fa-file-image';
  return 'fa-file';
}

/**
 * Get shared by info text
 */
export function getSharedByInfo(suggestion: KvpSuggestion): string {
  if (
    suggestion.orgLevel === 'company' &&
    suggestion.sharedByName !== undefined &&
    suggestion.sharedByName !== ''
  ) {
    const dateStr =
      suggestion.sharedAt !== undefined && suggestion.sharedAt !== '' ?
        ` am ${formatDate(suggestion.sharedAt)}`
      : '';
    return ` von ${suggestion.sharedByName}${dateStr}`;
  }
  return '';
}

/**
 * Check if user can update status
 */
export function canUpdateStatus(userRole: string): boolean {
  return userRole === 'admin' || userRole === 'root';
}

/**
 * Check if user can share suggestion
 * Admin/Root can share when the suggestion is not yet shared.
 * Once shared, use "unshare" first before re-sharing at a different level.
 */
export function canShareSuggestion(
  suggestion: KvpSuggestion,
  userRole: string,
): boolean {
  return (userRole === 'admin' || userRole === 'root') && !suggestion.isShared;
}

/**
 * Check if user can unshare suggestion
 * Allows unsharing for any shared suggestion (team, department, area, company)
 * - Admin/Root can always unshare
 * - Original sharer can unshare their own shares
 */
export function canUnshareSuggestion(
  suggestion: KvpSuggestion,
  userRole: string,
  userId: number | undefined,
): boolean {
  if (!suggestion.isShared) {
    return false;
  }

  // Admin/Root can always unshare, or the person who shared it
  return (
    userRole === 'admin' ||
    userRole === 'root' ||
    suggestion.sharedBy === userId
  );
}

/**
 * Check if user can archive suggestion (must be admin/root AND not already archived)
 */
export function canArchiveSuggestion(
  userRole: string,
  status: string,
): boolean {
  return (userRole === 'admin' || userRole === 'root') && status !== 'archived';
}

/**
 * Check if user can unarchive (restore) suggestion (must be admin/root AND archived)
 */
export function canUnarchiveSuggestion(
  userRole: string,
  status: string,
): boolean {
  return (userRole === 'admin' || userRole === 'root') && status === 'archived';
}

/**
 * Check if user can add comments
 */
export function canAddComments(userRole: string): boolean {
  return userRole === 'admin' || userRole === 'root';
}
