// =============================================================================
// Manage Dummies — CONSTANTS
// =============================================================================

import { IS_ACTIVE, STATUS_LABELS } from '@assixx/shared/constants';

import { DEFAULT_HIERARCHY_LABELS, type HierarchyLabels } from '$lib/types/hierarchy-labels';

import type { DummyFormData } from './types';

// =============================================================================
// STATUS LABELS & STYLING
// =============================================================================

/** is_active value → German label (re-export from shared) */
export const IS_ACTIVE_LABELS: Record<number, string> = STATUS_LABELS;

/** is_active value → badge CSS class (dummies use custom styling) */
export const IS_ACTIVE_BADGE_CLASSES: Record<number, string> = {
  [IS_ACTIVE.INACTIVE]: 'badge--secondary',
  [IS_ACTIVE.ACTIVE]: 'badge--success',
  [IS_ACTIVE.ARCHIVED]: 'badge--warning',
  [IS_ACTIVE.DELETED]: 'badge--danger',
};

// =============================================================================
// FILTER OPTIONS
// =============================================================================

/** Status filter options for toggle group */
export const STATUS_FILTER_OPTIONS: {
  value: number | 'all';
  label: string;
  icon: string;
}[] = [
  { value: 'all', label: 'Alle', icon: 'fa-list' },
  { value: IS_ACTIVE.ACTIVE, label: 'Aktiv', icon: 'fa-check-circle' },
  { value: IS_ACTIVE.INACTIVE, label: 'Inaktiv', icon: 'fa-times-circle' },
  { value: IS_ACTIVE.ARCHIVED, label: 'Archiviert', icon: 'fa-archive' },
];

// =============================================================================
// FORM DEFAULTS
// =============================================================================

/** Default form values for create modal */
export const FORM_DEFAULTS: DummyFormData = {
  displayName: '',
  password: '',
  passwordConfirm: '',
  teamIds: [],
  isActive: IS_ACTIVE.ACTIVE,
};

// =============================================================================
// UI MESSAGES (German)
// =============================================================================

const BASE_MESSAGES = {
  // Page
  PAGE_TITLE: 'Dummy-Benutzer verwalten - Assixx',
  HEADING: 'Dummy-Benutzer',
  HEADING_SUBTITLE: 'Anonyme Kiosk-Accounts für Firmen-Displays',

  // Buttons
  BTN_CREATE: 'Neuer Dummy',
  BTN_SAVE: 'Speichern',
  BTN_CANCEL: 'Abbrechen',
  BTN_DELETE: 'Löschen',
  BTN_EDIT: 'Bearbeiten',

  // Table headers
  COL_DESIGNATION: 'Bezeichnung',
  COL_EMAIL: 'Email',
  COL_EMPLOYEE_NR: 'Nr.',
  COL_TEAMS: 'Teams',
  COL_AREAS: 'Bereiche',
  COL_DEPARTMENTS: 'Abteilungen',
  COL_STATUS: 'Status',
  COL_ACTIONS: 'Aktionen',

  // Form labels
  FORM_DISPLAY_NAME: 'Bezeichnung',
  FORM_DISPLAY_NAME_PH: 'z.B. Halle 1 Display',
  FORM_PASSWORD: 'Passwort',
  FORM_PASSWORD_PH: 'Mindestens 12 Zeichen',
  FORM_PASSWORD_CONFIRM: 'Passwort bestätigen',
  FORM_PASSWORD_CONFIRM_PH: 'Passwort wiederholen',
  FORM_EMAIL: 'Email (automatisch)',
  FORM_EMPLOYEE_NR: 'Personalnummer (automatisch)',
  FORM_TEAMS: 'Team-Zuordnung',
  FORM_STATUS: 'Status',

  // Modal titles
  MODAL_CREATE: 'Neuer Dummy-Benutzer',
  MODAL_EDIT: 'Dummy-Benutzer bearbeiten',

  // Validation
  VALIDATION_DISPLAY_NAME_REQUIRED: 'Bezeichnung ist erforderlich',
  VALIDATION_DISPLAY_NAME_TOO_LONG: 'Bezeichnung darf max. 100 Zeichen haben',
  VALIDATION_PASSWORD_REQUIRED: 'Passwort ist erforderlich',
  VALIDATION_PASSWORD_TOO_SHORT: 'Passwort muss mind. 12 Zeichen haben',
  VALIDATION_PASSWORD_MISMATCH: 'Passwörter stimmen nicht überein',

  // Delete
  DELETE_CONFIRM_TITLE: 'Dummy löschen?',
  DELETE_CONFIRM_TEXT: 'Möchten Sie diesen Dummy-Benutzer wirklich löschen?',
  DELETE_CONFIRM_FINAL: 'Wirklich unwiderruflich löschen?',

  // Success
  SUCCESS_CREATED: 'Dummy-Benutzer wurde erstellt',
  SUCCESS_UPDATED: 'Dummy-Benutzer wurde aktualisiert',
  SUCCESS_DELETED: 'Dummy-Benutzer wurde gelöscht',

  // Error
  ERROR_LOAD: 'Fehler beim Laden der Dummy-Benutzer',
  ERROR_CREATE: 'Fehler beim Erstellen',
  ERROR_UPDATE: 'Fehler beim Aktualisieren',
  ERROR_DELETE: 'Fehler beim Löschen',

  // Empty state
  EMPTY_TITLE: 'Keine Dummy-Benutzer',
  EMPTY_DESCRIPTION: 'Noch keine Dummy-Benutzer angelegt.',

  // Search
  SEARCH_PH: 'Bezeichnung oder Email suchen...',

  // Loading
  LOADING: 'Dummy-Benutzer werden geladen...',
} as const;

/** Factory: dummy messages with dynamic hierarchy labels */
export function createDummyMessages(labels: HierarchyLabels) {
  return {
    ...BASE_MESSAGES,
    COL_TEAMS: labels.team,
    COL_AREAS: labels.area,
    COL_DEPARTMENTS: labels.department,
  };
}

/** Backward-compatible static export */
export const MESSAGES = createDummyMessages(DEFAULT_HIERARCHY_LABELS);

// =============================================================================
// PASSWORD STRENGTH
// =============================================================================

/** Minimum password length for dummies */
export const MIN_PASSWORD_LENGTH = 12;
