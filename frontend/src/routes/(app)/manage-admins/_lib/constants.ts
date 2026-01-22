// =============================================================================
// MANAGE ADMINS - CONSTANTS
// =============================================================================

import type { IsActiveStatus, FormIsActiveStatus } from './types';

/**
 * Position options for admin selection dropdown
 */
export const POSITION_OPTIONS = [
  'Bereichsleiter',
  'Personalleiter',
  'Geschäftsführer',
  'Werksleiter',
  'Produktionsleiter',
  'Qualitätsleiter',
  'IT-Leiter',
  'Vertriebsleiter',
  'Mitarbeiter',
] as const;

/**
 * Position display name mapping (lowercase key -> display value)
 */
export const POSITION_DISPLAY_MAP: Record<string, string> = {
  bereichsleiter: 'Bereichsleiter',
  personalleiter: 'Personalleiter',
  geschaeftsfuehrer: 'Geschäftsführer',
  werksleiter: 'Werksleiter',
  produktionsleiter: 'Produktionsleiter',
  qualitaetsleiter: 'Qualitätsleiter',
  'it-leiter': 'IT-Leiter',
  vertriebsleiter: 'Vertriebsleiter',
  mitarbeiter: 'Mitarbeiter',
};

/**
 * Badge CSS classes
 */
export const BADGE_CLASS = {
  INFO: 'badge--info',
  PRIMARY: 'badge--primary',
  SECONDARY: 'badge--secondary',
  SUCCESS: 'badge--success',
  WARNING: 'badge--warning',
  ERROR: 'badge--error',
} as const;

/**
 * Status badge CSS class mapping
 */
export const STATUS_BADGE_CLASSES: Record<IsActiveStatus, string> = {
  1: BADGE_CLASS.SUCCESS,
  0: BADGE_CLASS.WARNING,
  3: BADGE_CLASS.SECONDARY,
  4: BADGE_CLASS.ERROR,
};

/**
 * Status label mapping (German)
 */
export const STATUS_LABELS: Record<IsActiveStatus, string> = {
  1: 'Aktiv',
  0: 'Inaktiv',
  3: 'Archiviert',
  4: 'Gelöscht',
};

/**
 * Status options for dropdown (excludes deleted)
 */
export const STATUS_OPTIONS: { value: FormIsActiveStatus; label: string; class: string }[] = [
  { value: 1, label: 'Aktiv', class: 'badge--success' },
  { value: 0, label: 'Inaktiv', class: 'badge--warning' },
  { value: 3, label: 'Archiviert', class: 'badge--secondary' },
];

/**
 * Password strength labels (German)
 */
export const PASSWORD_STRENGTH_LABELS = [
  'Sehr schwach',
  'Schwach',
  'Mittel',
  'Stark',
  'Sehr stark',
] as const;

/**
 * Password crack time labels (German)
 */
export const PASSWORD_CRACK_TIMES = ['sofort', 'Minuten', 'Stunden', 'Tage', 'Jahre'] as const;

/**
 * UI Messages (German) - Prepared for i18n
 */
export const MESSAGES = {
  // Page titles
  PAGE_TITLE: 'Admin-Verwaltung - Assixx',
  PAGE_HEADING: 'Admin-Verwaltung',
  PAGE_DESCRIPTION: 'Übersicht aller Administratoren des Systems',

  // Modal titles
  MODAL_ADD_TITLE: 'Neuen Administrator hinzufügen',
  MODAL_EDIT_TITLE: 'Admin bearbeiten',
  MODAL_DELETE_TITLE: 'Administrator löschen',
  MODAL_DELETE_CONFIRM_TITLE: 'Endgültig löschen?',

  // Labels
  LABEL_FIRST_NAME: 'Vorname',
  LABEL_LAST_NAME: 'Nachname',
  LABEL_EMAIL: 'E-Mail',
  LABEL_EMAIL_CONFIRM: 'E-Mail wiederholen',
  LABEL_PASSWORD: 'Passwort',
  LABEL_PASSWORD_CONFIRM: 'Passwort wiederholen',
  LABEL_EMPLOYEE_NUMBER: 'Personalnummer',
  LABEL_POSITION: 'Position',
  LABEL_NOTES: 'Notizen',
  LABEL_STATUS: 'Status',
  LABEL_AREAS: 'Bereiche (Areas)',
  LABEL_DEPARTMENTS: 'Zusätzliche Abteilungen',
  LABEL_TEAMS: 'Teams',

  // Buttons
  BTN_SAVE: 'Speichern',
  BTN_CANCEL: 'Abbrechen',
  BTN_DELETE: 'Löschen',
  BTN_DELETE_FINAL: 'Endgültig löschen',
  BTN_RETRY: 'Erneut versuchen',
  BTN_ADD_ADMIN: 'Administrator hinzufügen',

  // Status filter buttons
  FILTER_ACTIVE: 'Aktive',
  FILTER_INACTIVE: 'Inaktive',
  FILTER_ARCHIVED: 'Archiviert',
  FILTER_ALL: 'Alle',

  // Search
  SEARCH_PLACEHOLDER: 'Administratoren suchen...',
  SEARCH_NO_RESULTS: 'Keine Administratoren gefunden für',
  SEARCH_MORE_RESULTS: 'weitere Ergebnisse in Tabelle',

  // Empty state
  EMPTY_TITLE: 'Keine Administratoren gefunden',
  EMPTY_DESCRIPTION: 'Erstellen Sie Ihren ersten Administrator, um das System zu verwalten.',

  // Loading
  LOADING_ADMINS: 'Administratoren werden geladen...',

  // Success messages
  SUCCESS_CREATED: 'Administrator erfolgreich erstellt',
  SUCCESS_UPDATED: 'Administrator erfolgreich aktualisiert',
  SUCCESS_DELETED: 'Administrator erfolgreich gelöscht',

  // Validation errors
  ERROR_EMAIL_MISMATCH: 'E-Mail-Adressen stimmen nicht überein',
  ERROR_PASSWORD_MISMATCH: 'Passwörter stimmen nicht überein',
  ERROR_POSITION_REQUIRED: 'Bitte wählen Sie eine Position aus',
  ERROR_EMPLOYEE_NUMBER_REQUIRED: 'Bitte geben Sie eine Personalnummer ein',
  ERROR_SAVE_FAILED: 'Fehler beim Speichern',
  ERROR_DELETE_FAILED: 'Fehler beim Löschen',

  // Tooltips and hints
  HINT_PASSWORD:
    'Min. 12 Zeichen, max. 72 Zeichen. Enthält 3 von 4: Großbuchstaben, Kleinbuchstaben, Zahlen, Sonderzeichen (!@#$%^&*)',
  HINT_EMPLOYEE_NUMBER: 'Max. 10 Zeichen (Buchstaben, Zahlen, Bindestrich)',
  HINT_MULTISELECT: 'Strg/Cmd + Klick für Mehrfachauswahl',
  HINT_AREAS: 'Bereiche vererben Zugriff auf zugehörige Abteilungen.',
  HINT_DEPARTMENTS: 'Nur Abteilungen die nicht bereits durch Bereiche abgedeckt sind.',
  HINT_STATUS: 'Inaktive/Archivierte Administratoren können sich nicht anmelden',
  HINT_TEAMS:
    'Teams werden automatisch vererbt: Admin mit Bereich-/Abteilungs-Berechtigung sieht alle zugehörigen Teams.',

  // Full access warning
  FULL_ACCESS_LABEL: 'Zugriff auf alle Bereiche/Abteilungen',
  FULL_ACCESS_WARNING:
    'Wenn aktiviert, hat der Admin Vollzugriff auf ALLE Bereiche und Abteilungen',

  // Delete confirmation
  DELETE_CONFIRM_MESSAGE: 'Möchten Sie diesen Administrator wirklich löschen?',
  DELETE_FINAL_WARNING: 'ACHTUNG: Diese Aktion kann nicht rückgängig gemacht werden!',
  DELETE_FINAL_INFO: 'Der Administrator wird unwiderruflich aus dem System entfernt.',

  // Organization badges
  BADGE_ALL: 'Alle',
  BADGE_NONE: 'Keine',
  BADGE_INHERITED: 'Vererbt',
  BADGE_FULL_ACCESS_TITLE: 'Voller Zugriff auf alle',
  BADGE_NO_AREAS: 'Keine Bereiche zugewiesen',
  BADGE_NO_DEPARTMENTS: 'Keine Abteilung zugewiesen',
  BADGE_NO_TEAMS: 'Keine Teams zugewiesen',

  // Table headers
  TH_ID: 'ID',
  TH_NAME: 'Name',
  TH_EMAIL: 'E-Mail',
  TH_EMPLOYEE_NUMBER: 'Personalnummer',
  TH_POSITION: 'Position',
  TH_STATUS: 'Status',
  TH_AREAS: 'Bereiche',
  TH_DEPARTMENTS: 'Abteilungen',
  TH_TEAMS: 'Teams',
  TH_ACTIONS: 'Aktionen',
} as const;

/**
 * Default values for form reset
 */
export const FORM_DEFAULTS = {
  firstName: '',
  lastName: '',
  email: '',
  emailConfirm: '',
  password: '',
  passwordConfirm: '',
  employeeNumber: '',
  position: '',
  notes: '',
  isActive: 1 as FormIsActiveStatus,
  hasFullAccess: false,
  areaIds: [] as number[],
  departmentIds: [] as number[],
};
