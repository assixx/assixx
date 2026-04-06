// =============================================================================
// KVP-DETAIL - CONSTANTS
// =============================================================================

import { DEFAULT_HIERARCHY_LABELS, type HierarchyLabels } from '$lib/types/hierarchy-labels';

import type { KvpStatus, KvpPriority, OrgLevel } from './types';

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  kvpById: (id: string) => `/kvp/${id}`,
  kvpComments: (id: string) => `/kvp/${id}/comments`,
  kvpAttachments: (id: string) => `/kvp/${id}/attachments`,
  kvpShare: (id: string) => `/kvp/${id}/share`,
  kvpUnshare: (id: string) => `/kvp/${id}/unshare`,
  kvpArchive: (id: string) => `/kvp/${id}/archive`,
  kvpUnarchive: (id: string) => `/kvp/${id}/unarchive`,
  kvpConfirm: (uuid: string) => `/kvp/${uuid}/confirm`,
  kvpRequestApproval: (id: string) => `/kvp/${id}/request-approval`,
  attachmentDownload: (fileUuid: string) => `/kvp/attachments/${fileUuid}/download`,
  departments: '/departments',
  teams: '/teams',
  areas: '/areas',
  userMe: '/users/me',
} as const;

/**
 * Status badge CSS classes (Design System)
 */
export const STATUS_BADGE_CLASSES: Record<KvpStatus, string> = {
  new: 'badge--kvp-new',
  in_review: 'badge--kvp-in-review',
  approved: 'badge--kvp-approved',
  implemented: 'badge--kvp-implemented',
  rejected: 'badge--kvp-rejected',
  archived: 'badge--kvp-archived',
  restored: 'badge--kvp-restored',
} as const;

/**
 * Status display text (German)
 */
export const STATUS_TEXT: Record<KvpStatus, string> = {
  new: 'Offen',
  in_review: 'In Prüfung',
  approved: 'Genehmigt',
  implemented: 'Umgesetzt',
  rejected: 'Abgelehnt',
  archived: 'Archiviert',
  restored: 'Wiederhergestellt',
} as const;

/**
 * Priority badge CSS classes (Design System)
 */
export const PRIORITY_BADGE_CLASSES: Record<KvpPriority, string> = {
  low: 'badge--priority-low',
  normal: 'badge--priority-normal',
  high: 'badge--priority-high',
  urgent: 'badge--priority-urgent',
} as const;

/**
 * Priority display text (German)
 */
export const PRIORITY_TEXT: Record<KvpPriority, string> = {
  low: 'Niedrig',
  normal: 'Normal',
  high: 'Hoch',
  urgent: 'Dringend',
} as const;

/**
 * Visibility badge CSS classes (Design System)
 */
export const VISIBILITY_BADGE_CLASSES: Record<OrgLevel, string> = {
  team: 'badge--visibility-team',
  asset: 'badge--visibility-team',
  department: 'badge--visibility-department',
  area: 'badge--visibility-area',
  company: 'badge--visibility-company',
} as const;

/**
 * Factory: Visibility info by org level with dynamic hierarchy labels
 */
export function createVisibilityInfo(
  labels: HierarchyLabels,
): Record<OrgLevel, { icon: string; text: string }> {
  return {
    company: { icon: 'fa-globe', text: 'Firmenweit' },
    department: { icon: 'fa-building', text: labels.department },
    area: { icon: 'fa-sitemap', text: labels.area },
    team: { icon: 'fa-users', text: 'Team' },
    asset: { icon: 'fa-cog', text: labels.asset },
  };
}

/**
 * Factory: Share level text with dynamic hierarchy labels
 */
function createShareLevelText(labels: HierarchyLabels): Record<OrgLevel, string> {
  return {
    company: 'Firmenebene',
    department: `${labels.department}-Ebene`,
    area: `${labels.area}-Ebene`,
    team: 'Teamebene',
    asset: `${labels.asset}-Ebene`,
  };
}

/** Backward-compatible static export */
export const SHARE_LEVEL_TEXT: Record<OrgLevel, string> =
  createShareLevelText(DEFAULT_HIERARCHY_LABELS);

/**
 * Status options for admin dropdown
 */
export const STATUS_OPTIONS: { value: KvpStatus; label: string }[] = [
  { value: 'new', label: 'Offen' },
  { value: 'in_review', label: 'In Prüfung' },
  { value: 'approved', label: 'Genehmigt' },
  { value: 'implemented', label: 'Umgesetzt' },
  { value: 'rejected', label: 'Abgelehnt' },
] as const;

/**
 * Get filtered status options when approval config exists for KVP.
 * Returns available transitions based on current status + approval workflow rules.
 * Without approval config: returns all STATUS_OPTIONS (backward compat).
 */
export function getApprovalStatusOptions(
  currentStatus: KvpStatus,
  hasApprovalConfig: boolean,
): { value: KvpStatus; label: string }[] {
  if (!hasApprovalConfig) {
    return [...STATUS_OPTIONS];
  }

  switch (currentStatus) {
    case 'new':
    case 'restored':
      return [{ value: 'rejected', label: 'Abgelehnt' }];
    case 'approved':
      return [{ value: 'implemented', label: 'Umgesetzt' }];
    default:
      // in_review, rejected, implemented, archived → LOCKED
      return [];
  }
}

/**
 * Image file types for photo gallery
 */
export const IMAGE_FILE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;
