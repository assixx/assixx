// =============================================================================
// KVP - CONSTANTS
// =============================================================================

import type { KvpStatus, KvpPriority, OrgLevel, KvpFilter } from './types';

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  KVP: '/kvp',
  KVP_BY_ID: (id: number) => `/kvp/${id}`,
  KVP_SHARE: (id: number) => `/kvp/${id}/share`,
  KVP_UNSHARE: (id: number) => `/kvp/${id}/unshare`,
  KVP_ATTACHMENTS: (id: number) => `/kvp/${id}/attachments`,
  KVP_CATEGORIES: '/kvp/categories',
  KVP_STATS: '/kvp/dashboard/stats',
  DEPARTMENTS: '/departments',
  TEAMS: '/teams',
  USER_ME: '/users/me',
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
} as const;

/**
 * Status display text (German)
 */
export const STATUS_TEXT: Record<KvpStatus, string> = {
  new: 'Neu',
  in_review: 'In Prüfung',
  approved: 'Genehmigt',
  implemented: 'Umgesetzt',
  rejected: 'Abgelehnt',
  archived: 'Archiviert',
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
 * Filter toggle options
 */
export const FILTER_OPTIONS: Array<{
  value: KvpFilter;
  label: string;
  icon: string;
  title: string;
  showBadge: boolean;
}> = [
  { value: 'all', label: 'Alle', icon: 'fa-list', title: 'Alle Vorschläge', showBadge: true },
  { value: 'mine', label: 'Meine', icon: 'fa-user', title: 'Meine Vorschläge', showBadge: true },
  { value: 'team', label: 'Team', icon: 'fa-users', title: 'Team Vorschläge', showBadge: true },
  {
    value: 'department',
    label: 'Abteilung',
    icon: 'fa-building',
    title: 'Abteilungs-Vorschläge',
    showBadge: true,
  },
  {
    value: 'company',
    label: 'Firmenweit',
    icon: 'fa-globe',
    title: 'Firmenweite Vorschläge',
    showBadge: true,
  },
  { value: 'manage', label: 'Verwalten', icon: 'fa-tasks', title: 'Verwaltung', showBadge: false },
  {
    value: 'archived',
    label: 'Archiv',
    icon: 'fa-archive',
    title: 'Archivierte Vorschläge',
    showBadge: true,
  },
] as const;

/**
 * Status filter options for dropdown
 */
export const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Alle Status' },
  { value: 'new', label: 'Neu' },
  { value: 'in_review', label: 'In Prüfung' },
  { value: 'approved', label: 'Genehmigt' },
  { value: 'implemented', label: 'Umgesetzt' },
  { value: 'rejected', label: 'Abgelehnt' },
] as const;

/**
 * Priority options for form
 */
export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Niedrig' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Hoch' },
  { value: 'urgent', label: 'Dringend' },
] as const;

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
 * Max file upload settings
 */
export const UPLOAD_CONFIG = {
  MAX_FILES: 5,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png'],
} as const;
