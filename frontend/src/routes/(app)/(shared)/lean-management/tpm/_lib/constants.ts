// =============================================================================
// TPM Employee View — CONSTANTS
// =============================================================================

import type { CardStatus, IntervalType } from './types';

/** Interval type display labels (German) */
export const INTERVAL_LABELS: Record<IntervalType, string> = {
  daily: 'Täglich',
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  quarterly: 'Vierteljährlich',
  semi_annual: 'Halbjährlich',
  annual: 'Jährlich',
  long_runner: 'Langzeitplan',
  custom: 'Benutzerdefiniert',
};

/** Card status display labels (German) */
export const CARD_STATUS_LABELS: Record<CardStatus, string> = {
  green: 'Erledigt',
  red: 'Fällig',
  yellow: 'Freigabe ausstehend',
  overdue: 'Überfällig',
};

/** Card status badge CSS classes */
export const CARD_STATUS_BADGE_CLASSES: Record<CardStatus, string> = {
  green: 'badge--success',
  red: 'badge--danger',
  yellow: 'badge--warning',
  overdue: 'badge--error',
};

/** Card role labels (German) */
export const CARD_ROLE_LABELS: Record<string, string> = {
  operator: 'Bediener',
  maintenance: 'Instandhaltung',
};

/** Default Kamishibai board colors */
export const DEFAULT_COLORS: Record<CardStatus, string> = {
  green: '#10b981',
  red: '#ef4444',
  yellow: '#f59e0b',
  overdue: '#8b5cf6',
};

/** Weekday labels (0=Monday, 6=Sunday — ISO format) */
export const WEEKDAY_LABELS: string[] = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
];

/** UI Messages (German) */
export const MESSAGES = {
  PAGE_TITLE: 'TPM Wartung - Assixx',
  PAGE_HEADING: 'TPM Wartung',
  PAGE_DESCRIPTION: 'Ihre zugewiesenen Maschinen und Wartungsaufgaben',

  // Stats
  STAT_MACHINES: 'Zugewiesene Maschinen',
  STAT_OPEN_CARDS: 'Offene Aufgaben',
  STAT_OVERDUE: 'Überfällig',
  STAT_COMPLETED_TODAY: 'Heute erledigt',

  // Buttons
  BTN_VIEW_BOARD: 'Board öffnen',
  BTN_VIEW_DETAILS: 'Details anzeigen',

  // Machine list
  MACHINE_LIST_TITLE: 'Ihre Maschinen',
  MACHINE_COL_NAME: 'Maschine',
  MACHINE_COL_PLAN: 'Wartungsplan',
  MACHINE_COL_STATUS: 'Status',
  MACHINE_COL_NEXT: 'Nächste Wartung',
  MACHINE_COL_ACTIONS: 'Aktionen',

  // Status
  STATUS_ALL_GREEN: 'Alles erledigt',
  STATUS_HAS_OPEN: 'Offene Aufgaben',

  // Empty state
  EMPTY_TITLE: 'Keine Wartungsaufgaben',
  EMPTY_DESCRIPTION:
    'Ihnen sind aktuell keine Maschinen mit TPM-Wartungsplänen zugewiesen.',

  // Loading
  LOADING: 'Wartungsdaten werden geladen...',

  // Errors
  ERROR_LOAD_FAILED: 'Fehler beim Laden der Wartungsdaten',

  // Card Detail Panel
  DETAIL_HEADING: 'Kartendetails',
  DETAIL_CODE: 'Code',
  DETAIL_ROLE: 'Typ',
  DETAIL_INTERVAL: 'Intervall',
  DETAIL_STATUS: 'Status',
  DETAIL_DUE_DATE: 'Fällig am',
  DETAIL_LOCATION: 'Standort',
  DETAIL_DESCRIPTION: 'Beschreibung',
  DETAIL_NO_DESCRIPTION: 'Keine Beschreibung vorhanden',
  DETAIL_LAST_COMPLETED: 'Zuletzt erledigt',
  DETAIL_APPROVAL_REQUIRED: 'Freigabe erforderlich',
  DETAIL_CLOSE: 'Schließen',

  // Execution Form
  EXEC_HEADING: 'Wartung durchführen',
  EXEC_DOCUMENTATION: 'Dokumentation',
  EXEC_DOCUMENTATION_PH: 'Beschreiben Sie die durchgeführte Wartung...',
  EXEC_DOCUMENTATION_HINT:
    'Bei Karten mit Freigabepflicht ist die Dokumentation erforderlich.',
  EXEC_SUBMIT: 'Als erledigt melden',
  EXEC_SUBMITTING: 'Wird gemeldet...',
  EXEC_SUCCESS: 'Wartung erfolgreich gemeldet',
  EXEC_ERROR: 'Fehler beim Melden der Wartung',
  EXEC_CARD_NOT_DUE:
    'Diese Karte ist nicht fällig und kann nicht erledigt werden.',

  // Approval Panel
  APPROVAL_HEADING: 'Freigabe',
  APPROVAL_EXECUTED_BY: 'Durchgeführt von',
  APPROVAL_EXECUTED_ON: 'Durchgeführt am',
  APPROVAL_DOCUMENTATION: 'Dokumentation',
  APPROVAL_NOTE: 'Kommentar',
  APPROVAL_NOTE_PH: 'Begründung bei Ablehnung...',
  APPROVAL_NOTE_REQUIRED: 'Begründung ist bei Ablehnung erforderlich',
  APPROVAL_APPROVE: 'Freigeben',
  APPROVAL_REJECT: 'Ablehnen',
  APPROVAL_APPROVING: 'Wird freigegeben...',
  APPROVAL_REJECTING: 'Wird abgelehnt...',
  APPROVAL_SUCCESS_APPROVED: 'Freigabe erteilt',
  APPROVAL_SUCCESS_REJECTED: 'Freigabe abgelehnt',
  APPROVAL_ERROR: 'Fehler bei der Freigabeaktion',

  // Photo Upload
  PHOTO_HEADING: 'Fotos',
  PHOTO_ADD: 'Foto hinzufügen',
  PHOTO_MAX_REACHED: 'Maximum von 5 Fotos erreicht',
  PHOTO_MAX_SIZE: 'Max. 5 MB pro Foto',
  PHOTO_UPLOADING: 'Wird hochgeladen...',
  PHOTO_ERROR: 'Fehler beim Hochladen',
  PHOTO_TOO_LARGE: 'Datei ist größer als 5 MB',
  PHOTO_INVALID_TYPE: 'Nur Bilder (JPG, PNG, WebP) erlaubt',

  // Time Estimates
  TIME_HEADING: 'Zeitschätzung',
  TIME_STAFF: 'Mitarbeiter',
  TIME_PREP: 'Vorbereitung',
  TIME_EXEC: 'Durchführung',
  TIME_FOLLOW: 'Nachbereitung',
  TIME_TOTAL: 'Gesamt',
  TIME_MINUTES: 'Min.',
  TIME_NO_ESTIMATE: 'Keine Zeitschätzung hinterlegt',
} as const;
