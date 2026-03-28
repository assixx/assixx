// =============================================================================
// MANAGE ADMINS - CONSTANTS
// =============================================================================

import {
  DEFAULT_HIERARCHY_LABELS,
  type HierarchyLabels,
  type PositionOption,
} from '$lib/types/hierarchy-labels';

import type { FormIsActiveStatus } from './types';

export { STATUS_BADGE_CLASSES, STATUS_LABELS } from '@assixx/shared/constants';

// Re-export shared availability constants
export {
  AVAILABILITY_BADGE_CLASSES,
  AVAILABILITY_ICONS,
  AVAILABILITY_LABELS,
  AVAILABILITY_STATUS_LABELS,
  AVAILABILITY_STATUS_OPTIONS,
} from '$lib/availability/constants';

/**
 * Position options for admin selection dropdown
 */
export const POSITION_OPTIONS: readonly PositionOption[] = [
  { id: '', name: 'area_lead', roleCategory: 'admin' },
  { id: '', name: 'department_lead', roleCategory: 'admin' },
  { id: '', name: 'Personalleiter', roleCategory: 'admin' },
  { id: '', name: 'Geschäftsführer', roleCategory: 'admin' },
  { id: '', name: 'Werksleiter', roleCategory: 'admin' },
  { id: '', name: 'Produktionsleiter', roleCategory: 'admin' },
  { id: '', name: 'Qualitätsleiter', roleCategory: 'admin' },
  { id: '', name: 'IT-Leiter', roleCategory: 'admin' },
  { id: '', name: 'Vertriebsleiter', roleCategory: 'admin' },
  { id: '', name: 'Mitarbeiter', roleCategory: 'admin' },
] as const;

/**
 * Position display name mapping (lowercase key -> display value)
 */
/**
 * Position display name mapping (lowercase key -> display value).
 * Lead positions (area_lead, department_lead) are NOT in this map —
 * they are resolved dynamically via resolvePositionDisplay() using hierarchy labels.
 */
export const POSITION_DISPLAY_MAP: Record<string, string> = {
  personalleiter: 'Personalleiter',
  geschäftsführer: 'Geschäftsführer',
  werksleiter: 'Werksleiter',
  produktionsleiter: 'Produktionsleiter',
  qualitätsleiter: 'Qualitätsleiter',
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
 * Status options for dropdown (excludes deleted)
 */
export const STATUS_OPTIONS: {
  value: FormIsActiveStatus;
  label: string;
  class: string;
}[] = [
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

/** Static messages that don't depend on hierarchy labels */
const STATIC_MESSAGES = {
  PAGE_TITLE: 'Admin-Verwaltung - Assixx',
  PAGE_HEADING: 'Admin-Verwaltung',
  PAGE_DESCRIPTION: 'Übersicht aller Administratoren des Systems',
  MODAL_ADD_TITLE: 'Neuen Administrator hinzufügen',
  MODAL_EDIT_TITLE: 'Admin bearbeiten',
  MODAL_DELETE_TITLE: 'Administrator löschen',
  MODAL_DELETE_CONFIRM_TITLE: 'Endgültig löschen?',
  LABEL_FIRST_NAME: 'Vorname',
  LABEL_LAST_NAME: 'Nachname',
  LABEL_EMAIL: 'E-Mail',
  LABEL_EMAIL_CONFIRM: 'E-Mail wiederholen',
  LABEL_PASSWORD: 'Passwort',
  LABEL_PASSWORD_CONFIRM: 'Passwort wiederholen',
  LABEL_EMPLOYEE_NUMBER: 'Personalnummer',
  LABEL_POSITION: 'Position',
  LABEL_NOTES: 'Zusätzliche Infos',
  LABEL_STATUS: 'Status',
  BTN_SAVE: 'Speichern',
  BTN_CANCEL: 'Abbrechen',
  BTN_DELETE: 'Löschen',
  BTN_DELETE_FINAL: 'Endgültig löschen',
  BTN_RETRY: 'Erneut versuchen',
  BTN_ADD_ADMIN: 'Administrator hinzufügen',
  FILTER_ACTIVE: 'Aktive',
  FILTER_INACTIVE: 'Inaktive',
  FILTER_ARCHIVED: 'Archiviert',
  FILTER_ALL: 'Alle',
  SEARCH_PLACEHOLDER: 'Administratoren suchen...',
  SEARCH_NO_RESULTS: 'Keine Administratoren gefunden für',
  SEARCH_MORE_RESULTS: 'weitere Ergebnisse in Tabelle',
  EMPTY_TITLE: 'Keine Administratoren gefunden',
  EMPTY_DESCRIPTION: 'Erstellen Sie Ihren ersten Administrator, um das System zu verwalten.',
  LOADING_ADMINS: 'Administratoren werden geladen...',
  SUCCESS_CREATED: 'Administrator erfolgreich erstellt',
  SUCCESS_UPDATED: 'Administrator erfolgreich aktualisiert',
  SUCCESS_DELETED: 'Administrator erfolgreich gelöscht',
  ERROR_EMAIL_MISMATCH: 'E-Mail-Adressen stimmen nicht überein',
  ERROR_PASSWORD_MISMATCH: 'Passwörter stimmen nicht überein',
  ERROR_POSITION_REQUIRED: 'Bitte wählen Sie eine Position aus',
  ERROR_EMPLOYEE_NUMBER_REQUIRED: 'Bitte geben Sie eine Personalnummer ein',
  ERROR_SAVE_FAILED: 'Fehler beim Speichern',
  ERROR_DELETE_FAILED: 'Fehler beim Löschen',
  HINT_PASSWORD:
    'Min. 12 Zeichen, max. 72 Zeichen. Enthält 3 von 4: Großbuchstaben, Kleinbuchstaben, Zahlen, Sonderzeichen (!@#$%^&*)',
  HINT_EMPLOYEE_NUMBER: 'Max. 10 Zeichen (Buchstaben, Zahlen, Bindestrich)',
  HINT_MULTISELECT: 'Strg/Cmd + Klick für Mehrfachauswahl',
  HINT_STATUS: 'Inaktive/Archivierte Administratoren können sich nicht anmelden',
  DELETE_CONFIRM_MESSAGE: 'Möchten Sie diesen Administrator wirklich löschen?',
  DELETE_FINAL_WARNING: 'ACHTUNG: Diese Aktion kann nicht rückgängig gemacht werden!',
  DELETE_FINAL_INFO: 'Der Administrator wird unwiderruflich aus dem System entfernt.',
  BADGE_ALL: 'Alle',
  BADGE_NONE: 'Keine',
  BADGE_INHERITED: 'Vererbt',
  BADGE_FULL_ACCESS_TITLE: 'Voller Zugriff auf alle',
  UPGRADE_TITLE: 'Gefahrenzone',
  UPGRADE_DESCRIPTION:
    'Stuft diesen Administrator dauerhaft zum Root-Benutzer hoch. Root-Benutzer haben uneingeschränkten Systemzugriff.',
  UPGRADE_BUTTON: 'Zu Root hochstufen',
  UPGRADE_CONFIRM_MESSAGE:
    'Sind Sie sicher? Der Administrator wird sofort zum Root-Benutzer hochgestuft und erhält uneingeschränkten Systemzugriff.',
  UPGRADE_CONFIRM_BUTTON: 'Ja, hochstufen',
  UPGRADE_SUCCESS: 'Administrator wurde zum Root-Benutzer hochgestuft',
  UPGRADE_ERROR: 'Fehler beim Hochstufen',
  UPGRADE_UNAUTHORIZED:
    'Sie sind nicht berechtigt, Rollen zu ändern. Nur Root-Benutzer dürfen Admins hochstufen.',
  DOWNGRADE_DESCRIPTION:
    'Stuft diesen Administrator dauerhaft zum Mitarbeiter herunter. Alle Admin-Berechtigungen gehen verloren.',
  DOWNGRADE_BUTTON: 'Zu Mitarbeiter herunterstufen',
  DOWNGRADE_CONFIRM_MESSAGE:
    'Sind Sie sicher? Der Administrator verliert sofort alle Admin-Berechtigungen und wird zum Mitarbeiter heruntergestuft.',
  DOWNGRADE_CONFIRM_BUTTON: 'Ja, herunterstufen',
  DOWNGRADE_SUCCESS: 'Administrator wurde zum Mitarbeiter heruntergestuft',
  DOWNGRADE_ERROR: 'Fehler beim Herunterstufen',
  TH_ID: 'ID',
  TH_NAME: 'Name',
  TH_EMAIL: 'E-Mail',
  TH_EMPLOYEE_NUMBER: 'Personalnummer',
  TH_POSITION: 'Position',
  TH_STATUS: 'Status',
  TH_AVAILABILITY: 'Verfügbarkeit',
  TH_PLANNED: 'Geplant',
  TH_ADDITIONAL_INFO: 'Zusätzliche Infos',
  TH_ABSENCE_NOTES: 'Abwesenheitsnotiz',
  TH_ACTIONS: 'Aktionen',
};

/**
 * UI Messages — factory with dynamic hierarchy labels.
 * Entity-specific strings use labels, compound words are neutralized (A4).
 */
export function createMessages(labels: HierarchyLabels) {
  return {
    ...STATIC_MESSAGES,
    LABEL_AREAS: labels.area,
    LABEL_DEPARTMENTS: `Zusätzliche ${labels.department}`,
    LABEL_TEAMS: labels.team,
    HINT_AREAS: `${labels.area} vererben Zugriff auf zugehörige ${labels.department}.`,
    HINT_DEPARTMENTS: `Nur ${labels.department}, die nicht bereits durch ${labels.area} abgedeckt sind.`,
    HINT_TEAMS: `${labels.team} werden automatisch vererbt: Admin mit entsprechender Berechtigung sieht alle zugehörigen ${labels.team}.`,
    FULL_ACCESS_LABEL: `Zugriff auf alle ${labels.area}/${labels.department}`,
    FULL_ACCESS_WARNING: `Wenn aktiviert, hat der Admin Vollzugriff auf ALLE ${labels.area} und ${labels.department}`,
    BADGE_NO_AREAS: `Keine ${labels.area} zugewiesen`,
    BADGE_NO_DEPARTMENTS: `Keine ${labels.department} zugewiesen`,
    BADGE_NO_TEAMS: `Keine ${labels.team} zugewiesen`,
    TH_AREAS: labels.area,
    TH_DEPARTMENTS: labels.department,
    TH_TEAMS: labels.team,
  };
}

/** Message type for component props */
export type AdminMessages = ReturnType<typeof createMessages>;

/** Default messages (used in non-Svelte contexts) */
export const MESSAGES = createMessages(DEFAULT_HIERARCHY_LABELS);

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
  positionIds: [] as string[],
  notes: '',
  isActive: 1 as FormIsActiveStatus,
  hasFullAccess: false,
  areaIds: [] as number[],
  departmentIds: [] as number[],
};
