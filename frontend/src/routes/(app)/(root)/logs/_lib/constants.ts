/**
 * Logs Page Constants
 * Configuration, labels, and dropdown options
 */

import { DEFAULT_HIERARCHY_LABELS, type HierarchyLabels } from '$lib/types/hierarchy-labels';

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

/** Factory: entity type options with dynamic hierarchy labels */
export function createEntityOptions(labels: HierarchyLabels): DropdownOption[] {
  return [
    { value: 'all', text: 'Alle Typen' },
    { value: 'user', text: 'Benutzer' },
    { value: 'admin', text: 'Administrator' },
    { value: 'department', text: labels.department },
    { value: 'document', text: 'Dokument' },
    { value: 'blackboard', text: 'Schwarzes Brett' },
    { value: 'calendar', text: 'Kalender' },
    { value: 'asset', text: labels.asset },
    { value: 'shift', text: 'Schicht' },
    { value: 'logs', text: 'Logs' },
    { value: 'tenant', text: 'Tenant' },
    { value: 'survey', text: 'Umfrage' },
    { value: 'team', text: labels.team },
    { value: 'task', text: 'Aufgabe' },
    { value: 'kvp_suggestion', text: 'KVP-Vorschlag' },
  ];
}

/** Backward-compatible static export */
export const ENTITY_OPTIONS = createEntityOptions(DEFAULT_HIERARCHY_LABELS);

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
  DELETE_SUCCESS: 'Logs wurden erfolgreich gelöscht',
  EMPTY_STATE_TITLE: 'Keine Logs gefunden',
  EMPTY_STATE_DESCRIPTION: 'Versuche andere Filterkriterien',
  DELETE_MODAL_TITLE: 'Gefilterte Logs löschen',
  DELETE_WARNING: 'Diese Aktion kann NICHT rückgängig gemacht werden!',
  DELETE_CONFIRM_LABEL: 'Geben Sie LÖSCHEN zur Bestätigung ein:',
  DELETE_PASSWORD_LABEL: 'Root-Passwort zur Bestätigung',
  DELETE_PASSWORD_HINT: 'Erforderlich für Löschung von Audit-Logs',
  NO_FILTERS_WARNING: 'Keine spezifischen Filter aktiv (ALLE Logs werden gelöscht!)',
  DELETE_BUTTON_DISABLED_TITLE: 'Bitte "Filter anwenden" klicken um Logs zu löschen',
  // Export Messages
  EXPORT_LOADING: 'Export wird erstellt...',
  EXPORT_ERROR: 'Fehler beim Export',
  EXPORT_RATE_LIMITED: 'Bitte warten Sie vor dem nächsten Export',
  EXPORT_SUCCESS: 'Export erfolgreich heruntergeladen',
} as const;

// ============================================================================
// Export Configuration (ADR-009)
// ============================================================================

/** Export format dropdown options */
export const EXPORT_FORMAT_OPTIONS: DropdownOption[] = [
  { value: 'csv', text: 'CSV (Excel-kompatibel)' },
  { value: 'json', text: 'JSON' },
  { value: 'txt', text: 'TXT (Lesbar)' },
];

/** Export source dropdown options */
export const EXPORT_SOURCE_OPTIONS: DropdownOption[] = [
  { value: 'all', text: 'Alle Quellen' },
  { value: 'audit_trail', text: 'Audit Trail (API-Logs)' },
  { value: 'root_logs', text: 'System-Logs (Admin)' },
];

/** Default export date range (last 30 days) */
export const DEFAULT_EXPORT_DAYS = 30;

/** Maximum export date range (365 days - enforced by backend) */
export const MAX_EXPORT_DAYS = 365;

/** Rate limit duration in milliseconds (1 minute) */
export const EXPORT_RATE_LIMIT_MS = 60000;

/** Quick timerange option interface */
interface QuickTimerangeOption {
  readonly value: string;
  readonly text: string;
  readonly minutes: number;
}

/** Quick timerange presets for export date filter */
export const EXPORT_QUICK_TIMERANGE_OPTIONS: readonly QuickTimerangeOption[] = [
  { value: '5min', text: '5 Min', minutes: 5 },
  { value: '15min', text: '15 Min', minutes: 15 },
  { value: '1hour', text: '1 Std', minutes: 60 },
  { value: '24hours', text: '24 Std', minutes: 1440 },
  { value: '3days', text: '3 Tage', minutes: 4320 },
  { value: '1week', text: '1 Woche', minutes: 10080 },
] as const;
