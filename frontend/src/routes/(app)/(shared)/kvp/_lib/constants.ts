// =============================================================================
// KVP - CONSTANTS
// =============================================================================

import { DEFAULT_HIERARCHY_LABELS, type HierarchyLabels } from '$lib/types/hierarchy-labels';

import type { KvpStatus, KvpPriority, OrgLevel, KvpFilter } from './types';

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  KVP: '/kvp',
  KVP_MY_ORGANIZATIONS: '/kvp/my-organizations',
  kvpById: (id: number) => `/kvp/${id}`,
  kvpShare: (id: number) => `/kvp/${id}/share`,
  kvpUnshare: (id: number) => `/kvp/${id}/unshare`,
  kvpAttachments: (id: number) => `/kvp/${id}/attachments`,
  KVP_CATEGORIES: '/kvp/categories',
  KVP_STATS: '/kvp/dashboard/stats',
  // GET /kvp/participants/options — server-side search for chip dropdown.
  // Hard cap 50/type, RLS-scoped to tenant. See ADR-045 §"Annotation only".
  KVP_PARTICIPANT_OPTIONS: '/kvp/participants/options',
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

/** Filter option shape */
interface FilterOption {
  readonly value: KvpFilter;
  readonly label: string;
  readonly icon: string;
  readonly title: string;
  readonly showBadge: boolean;
}

/** Static filter options (no hierarchy labels needed) */
const STATIC_FILTER_OPTIONS: FilterOption[] = [
  {
    value: 'all',
    label: 'Alle',
    icon: 'fa-list',
    title: 'Alle Vorschläge',
    showBadge: true,
  },
  {
    value: 'mine',
    label: 'Meine',
    icon: 'fa-user',
    title: 'Meine Vorschläge',
    showBadge: true,
  },
  {
    value: 'team',
    label: 'Team',
    icon: 'fa-users',
    title: 'Team Vorschläge',
    showBadge: true,
  },
];

/** Static filter options (trailing group) */
const STATIC_FILTER_OPTIONS_TAIL: FilterOption[] = [
  {
    value: 'company',
    label: 'Firmenweit',
    icon: 'fa-globe',
    title: 'Firmenweite Vorschläge',
    showBadge: true,
  },
  {
    value: 'manage',
    label: 'Verwalten',
    icon: 'fa-tasks',
    title: 'Verwaltung',
    showBadge: false,
  },
  {
    value: 'archived',
    label: 'Archiv',
    icon: 'fa-archive',
    title: 'Archivierte Vorschläge',
    showBadge: true,
  },
];

/** Factory: Filter toggle options with dynamic hierarchy labels */
export function createFilterOptions(labels: HierarchyLabels): readonly FilterOption[] {
  return [
    ...STATIC_FILTER_OPTIONS,
    {
      value: 'asset',
      label: labels.asset,
      icon: 'fa-cog',
      title: `${labels.asset}-Vorschläge`,
      showBadge: true,
    },
    {
      value: 'department',
      label: labels.department,
      icon: 'fa-building',
      title: `${labels.department}-Vorschläge`,
      showBadge: true,
    },
    ...STATIC_FILTER_OPTIONS_TAIL,
  ];
}

/** Backward-compatible static export */
export const FILTER_OPTIONS: readonly FilterOption[] =
  createFilterOptions(DEFAULT_HIERARCHY_LABELS);

/**
 * Status filter options for dropdown
 */
export const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Alle Status' },
  { value: 'new', label: 'Offen' },
  { value: 'in_review', label: 'In Prüfung' },
  { value: 'approved', label: 'Genehmigt' },
  { value: 'implemented', label: 'Umgesetzt' },
  { value: 'rejected', label: 'Abgelehnt' },
  { value: 'restored', label: 'Wiederhergestellt' },
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
 * Max file upload settings
 */
export const UPLOAD_CONFIG = {
  MAX_FILES: 5,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png'],
} as const;
