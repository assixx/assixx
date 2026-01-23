// =============================================================================
// KVP-DETAIL - CONSTANTS
// =============================================================================

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
  department: 'badge--visibility-department',
  area: 'badge--visibility-area',
  company: 'badge--visibility-company',
} as const;

/**
 * Visibility info by org level
 */
export const VISIBILITY_INFO: Record<OrgLevel, { icon: string; text: string }> = {
  company: { icon: 'fa-globe', text: 'Firmenweit' },
  department: { icon: 'fa-building', text: 'Abteilung' },
  area: { icon: 'fa-sitemap', text: 'Bereich' },
  team: { icon: 'fa-users', text: 'Team' },
} as const;

/**
 * Share level text (German)
 */
export const SHARE_LEVEL_TEXT: Record<OrgLevel, string> = {
  company: 'Firmenebene',
  department: 'Abteilungsebene',
  area: 'Bereichsebene',
  team: 'Teamebene',
} as const;

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
 * Image file types for photo gallery
 */
export const IMAGE_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'] as const;
