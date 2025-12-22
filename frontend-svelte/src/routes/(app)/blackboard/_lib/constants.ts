/**
 * Blackboard Constants
 * Labels, Options, and Configuration values
 */

import type { Priority, OrgLevel, EntryColor } from './types';

// ============================================================================
// Zoom Configuration
// ============================================================================

export const ZOOM_CONFIG = {
  DEFAULT: 100,
  MIN: 50,
  MAX: 150,
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

// ============================================================================
// Org Level Labels & Classes
// ============================================================================

export const ORG_LEVEL_LABELS: Record<OrgLevel, string> = {
  company: 'Firma',
  department: 'Abteilung',
  team: 'Team',
  area: 'Bereich',
};

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

export const LEVEL_FILTER_OPTIONS: LevelFilterOption[] = [
  { value: 'all', label: 'Alle', icon: 'fa-globe' },
  { value: 'company', label: 'Firma', icon: 'fa-building' },
  { value: 'department', label: 'Abteilung', icon: 'fa-sitemap' },
  { value: 'team', label: 'Team', icon: 'fa-users' },
  { value: 'area', label: 'Bereich', icon: 'fa-map-marked-alt' },
];

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
