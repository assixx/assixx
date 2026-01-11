/**
 * Logs Page Constants
 * Configuration, labels, and dropdown options
 */

import type { DropdownOption } from './types';

// ============================================================================
// Pagination Config
// ============================================================================

export const LOGS_PER_PAGE = 50;

// ============================================================================
// Action Dropdown Options
// ============================================================================

export const ACTION_OPTIONS: DropdownOption[] = [
  { value: 'all', text: 'Alle Aktionen' },
  { value: 'login', text: 'Anmeldung' },
  { value: 'logout', text: 'Abmeldung' },
  { value: 'create', text: 'Erstellt' },
  { value: 'update', text: 'Aktualisiert' },
  { value: 'delete', text: 'Gelöscht' },
  { value: 'upload', text: 'Hochgeladen' },
  { value: 'download', text: 'Heruntergeladen' },
  { value: 'view', text: 'Angesehen' },
  { value: 'assign', text: 'Zugewiesen' },
  { value: 'unassign', text: 'Entfernt' },
  { value: 'kvp_created', text: 'KVP Erstellt' },
  { value: 'kvp_shared', text: 'KVP Geteilt' },
  { value: 'survey_created', text: 'Umfrage Erstellt' },
  { value: 'survey_updated', text: 'Umfrage Aktualisiert' },
  { value: 'survey_deleted', text: 'Umfrage Gelöscht' },
  { value: 'survey_submitted', text: 'Umfrage Beantwortet' },
  { value: 'survey_viewed', text: 'Umfrage Angesehen' },
  { value: 'survey_exported', text: 'Umfrage Exportiert' },
];

// ============================================================================
// Entity Type Dropdown Options
// ============================================================================

export const ENTITY_OPTIONS: DropdownOption[] = [
  { value: 'all', text: 'Alle Typen' },
  { value: 'user', text: 'Benutzer' },
  { value: 'admin', text: 'Administrator' },
  { value: 'department', text: 'Abteilung' },
  { value: 'document', text: 'Dokument' },
  { value: 'blackboard', text: 'Schwarzes Brett' },
  { value: 'logs', text: 'Logs' },
  { value: 'tenant', text: 'Tenant' },
  { value: 'survey', text: 'Umfrage' },
  { value: 'team', text: 'Team' },
  { value: 'task', text: 'Aufgabe' },
  { value: 'kvp_suggestion', text: 'KVP-Vorschlag' },
];

// ============================================================================
// Timerange Dropdown Options
// ============================================================================

export const TIMERANGE_OPTIONS: DropdownOption[] = [
  { value: 'all', text: 'Alle Zeit' },
  { value: 'today', text: 'Heute' },
  { value: 'yesterday', text: 'Gestern' },
  { value: 'week', text: 'Letzte 7 Tage' },
  { value: 'month', text: 'Letzter Monat' },
  { value: '3months', text: 'Letzte 3 Monate' },
  { value: '6months', text: 'Letzte 6 Monate' },
  { value: 'year', text: 'Letztes Jahr' },
];

// ============================================================================
// Action Labels (for display in table)
// ============================================================================

export const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Erstellt',
  UPDATE: 'Aktualisiert',
  DELETE: 'Gelöscht',
  LOGIN: 'Anmeldung',
  LOGOUT: 'Abmeldung',
  SHARE: 'Geteilt',
  ARCHIVE: 'Archiviert',
  RESTORE: 'Wiederhergestellt',
  EXPORT: 'Exportiert',
  IMPORT: 'Importiert',
  EMAIL_SENT: 'E-Mail',
  PASSWORD_CHANGE: 'Passwort',
  ROLE_CHANGE: 'Rolle',
};

// ============================================================================
// Role Labels
// ============================================================================

export const ROLE_LABELS: Record<string, string> = {
  root: 'Root',
  admin: 'Admin',
  employee: 'Mitarbeiter',
};

// ============================================================================
// Role Badge Classes
// ============================================================================

export const ROLE_BADGE_CLASSES: Record<string, string> = {
  root: 'badge--danger',
  admin: 'badge--warning',
  employee: 'badge--info',
};

// ============================================================================
// Timerange to Days Mapping (for delete API)
// ============================================================================

export const TIMERANGE_DAYS_MAP: Partial<Record<string, number>> = {
  today: 0,
  week: 7,
  month: 30,
};

// ============================================================================
// UI Messages
// ============================================================================

export const MESSAGES = {
  LOADING: 'Logs werden geladen...',
  ERROR_LOADING: 'Fehler beim Laden der Logs',
  ERROR_DELETING: 'Fehler beim Löschen der Logs',
  EMPTY_STATE_TITLE: 'Keine Logs gefunden',
  EMPTY_STATE_DESCRIPTION: 'Versuche andere Filterkriterien',
  DELETE_MODAL_TITLE: 'Gefilterte Logs löschen',
  DELETE_WARNING: 'Diese Aktion kann NICHT rückgängig gemacht werden!',
  DELETE_CONFIRM_LABEL: 'Geben Sie LÖSCHEN zur Bestätigung ein:',
  DELETE_PASSWORD_LABEL: 'Root-Passwort zur Bestätigung',
  DELETE_PASSWORD_HINT: 'Erforderlich für Löschung von Audit-Logs',
  NO_FILTERS_WARNING: 'Keine spezifischen Filter aktiv (ALLE Logs werden gelöscht!)',
  DELETE_BUTTON_DISABLED_TITLE: 'Bitte "Filter anwenden" klicken um Logs zu löschen',
} as const;
