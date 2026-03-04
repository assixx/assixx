// =============================================================================
// Manage Dummies — CONSTANTS
// =============================================================================

import type { DummyFormData } from './types';

// =============================================================================
// STATUS LABELS & STYLING
// =============================================================================

/** is_active value → German label */
export const IS_ACTIVE_LABELS: Record<number, string> = {
  0: 'Inaktiv',
  1: 'Aktiv',
  3: 'Archiviert',
  4: 'Gelöscht',
};

/** is_active value → badge CSS class */
export const IS_ACTIVE_BADGE_CLASSES: Record<number, string> = {
  0: 'badge--secondary',
  1: 'badge--success',
  3: 'badge--warning',
  4: 'badge--danger',
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
  { value: 1, label: 'Aktiv', icon: 'fa-check-circle' },
  { value: 0, label: 'Inaktiv', icon: 'fa-times-circle' },
  { value: 3, label: 'Archiviert', icon: 'fa-archive' },
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
  isActive: 1,
};

// =============================================================================
// UI MESSAGES (German)
// =============================================================================

export const MESSAGES = {
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

// =============================================================================
// PASSWORD STRENGTH
// =============================================================================

/** Minimum password length for dummies */
export const MIN_PASSWORD_LENGTH = 12;

/** Password strength levels */
export const PASSWORD_STRENGTH_LABELS: Record<number, string> = {
  0: 'Sehr schwach',
  1: 'Schwach',
  2: 'Mittel',
  3: 'Stark',
  4: 'Sehr stark',
};

export const PASSWORD_STRENGTH_COLORS: Record<number, string> = {
  0: 'var(--color-danger)',
  1: 'var(--color-danger)',
  2: 'var(--color-warning)',
  3: 'var(--color-success)',
  4: 'var(--color-success)',
};
