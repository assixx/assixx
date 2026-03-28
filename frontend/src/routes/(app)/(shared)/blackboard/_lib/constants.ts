/**
 * Blackboard Constants
 * Labels, Options, and Configuration values
 */

import { DEFAULT_HIERARCHY_LABELS, type HierarchyLabels } from '$lib/types/hierarchy-labels';

import type { Priority, OrgLevel, EntryColor } from './types';

// ============================================================================
// Zoom Configuration
// ============================================================================

export const ZOOM_CONFIG = {
  DEFAULT: 100,
  MIN: 50,
  MAX: 120,
  STEP: 10,
} as const;

// ============================================================================
// Pagination
// ============================================================================

export const ENTRIES_PER_PAGE = 12;

// ============================================================================
// Priority Labels & Classes
// ============================================================================

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Niedrig',
  medium: 'Normal',
  high: 'Hoch',
  urgent: 'Dringend',
};

export const PRIORITY_BADGE_CLASSES: Record<Priority, string> = {
  low: 'sticky-note__badge--priority-low',
  medium: 'sticky-note__badge--priority-medium',
  high: 'sticky-note__badge--priority-high',
  urgent: 'sticky-note__badge--priority-urgent',
};

export interface PriorityOption {
  value: Priority;
  label: string;
}

export const PRIORITY_OPTIONS: PriorityOption[] = [
  { value: 'low', label: 'Niedrig' },
  { value: 'medium', label: 'Normal' },
  { value: 'high', label: 'Hoch' },
  { value: 'urgent', label: 'Dringend' },
];

// ============================================================================
// Org Level Labels & Classes
// ============================================================================

/** Factory: org level labels from dynamic hierarchy labels */
export function createOrgLevelLabels(labels: HierarchyLabels): Record<OrgLevel, string> {
  return {
    company: 'Firma',
    department: labels.department,
    team: labels.team,
    area: labels.area,
  };
}

/** Default org level labels (backward-compatible) */
export const ORG_LEVEL_LABELS: Record<OrgLevel, string> =
  createOrgLevelLabels(DEFAULT_HIERARCHY_LABELS);

export const ORG_LEVEL_BADGE_CLASSES: Record<OrgLevel, string> = {
  company: 'sticky-note__badge--org-company',
  department: 'sticky-note__badge--org-department',
  team: 'sticky-note__badge--org-team',
  area: 'sticky-note__badge--org-area',
};

// ============================================================================
// Color Options
// ============================================================================

export interface ColorOption {
  value: EntryColor;
  label: string;
}

export const COLOR_OPTIONS: ColorOption[] = [
  { value: 'yellow', label: 'Gelb' },
  { value: 'pink', label: 'Pink' },
  { value: 'blue', label: 'Blau' },
  { value: 'green', label: 'Grün' },
  { value: 'orange', label: 'Orange' },
];

// ============================================================================
// Sort Options
// ============================================================================

export interface SortOption {
  value: string;
  label: string;
}

export const SORT_OPTIONS: SortOption[] = [
  { value: 'created_at|DESC', label: 'Neueste zuerst' },
  { value: 'created_at|ASC', label: 'Älteste zuerst' },
  { value: 'priority|DESC', label: 'Nach Priorität' },
];

// ============================================================================
// Level Filter Options
// ============================================================================

export interface LevelFilterOption {
  value: 'all' | OrgLevel;
  label: string;
  icon: string;
}

/** Factory: level filter options from dynamic hierarchy labels */
export function createLevelFilterOptions(labels: HierarchyLabels): LevelFilterOption[] {
  return [
    { value: 'all', label: 'Alle', icon: 'fa-globe' },
    { value: 'company', label: 'Firma', icon: 'fa-building' },
    { value: 'area', label: labels.area, icon: 'fa-map-marked-alt' },
    { value: 'department', label: labels.department, icon: 'fa-sitemap' },
    { value: 'team', label: labels.team, icon: 'fa-users' },
  ];
}

/** Default level filter options (backward-compatible) */
export const LEVEL_FILTER_OPTIONS: LevelFilterOption[] =
  createLevelFilterOptions(DEFAULT_HIERARCHY_LABELS);

// ============================================================================
// Form Defaults
// ============================================================================

export const FORM_DEFAULTS = {
  priority: 'medium' as Priority,
  color: 'yellow' as EntryColor,
  companyWide: false,
} as const;

// ============================================================================
// UI Messages
// ============================================================================

export const MESSAGES = {
  LOADING: 'Einträge werden geladen...',
  NO_ENTRIES: 'Keine Einträge gefunden',
  CREATE_FIRST: 'Ersten Eintrag erstellen',
  ERROR_LOADING: 'Ein Fehler ist aufgetreten',
  RETRY: 'Erneut versuchen',
  MODAL_TITLE_CREATE: 'Neuer Eintrag',
  MODAL_TITLE_EDIT: 'Eintrag bearbeiten',
  DELETE_CONFIRM_TITLE: 'Eintrag löschen?',
  DELETE_CONFIRM_MESSAGE: 'Möchten Sie diesen Eintrag wirklich löschen?',
  DELETE_FINAL_TITLE: 'Endgültig löschen?',
  DELETE_FINAL_MESSAGE: 'Diese Aktion kann nicht rückgängig gemacht werden!',
  SAVE_ERROR: 'Fehler beim Speichern',
  DELETE_ERROR: 'Fehler beim Löschen',
  MULTI_SELECT_HINT: 'Strg/Cmd + Klick für Mehrfachauswahl',
  COMPANY_WIDE_WARNING: 'Wenn aktiviert, sehen ALLE Mitarbeiter der Firma diesen Eintrag',
} as const;

// ============================================================================
// File Upload Config
// ============================================================================

export const FILE_UPLOAD_CONFIG = {
  MAX_FILES: 5,
  MAX_SIZE_MB: 10,
  ACCEPTED_TYPES: '.pdf,.jpg,.jpeg,.png,.gif',
  ACCEPTED_MIME_TYPES: ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'],
} as const;
