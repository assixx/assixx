// =============================================================================
// TPM Employee View — CONSTANTS
// =============================================================================

import type { CardStatus, IntervalType } from './types';

/** Interval type colors for Gesamtansicht headers */
export const INTERVAL_COLORS: Record<IntervalType, string> = {
  daily: '#4CAF50',
  weekly: '#8BC34A',
  monthly: '#5bb5f5',
  quarterly: '#b6a5a5',
  semi_annual: '#ee6969',
  annual: '#d0ae49',
  custom: '#ff9800',
};

/** Zoom configuration for zoomable views */
export const ZOOM_CONFIG = {
  DEFAULT: 100,
  MIN: 50,
  MAX: 150,
  STEP: 1,
} as const;

/** Interval type display labels (German) */
export const INTERVAL_LABELS: Record<IntervalType, string> = {
  daily: 'Täglich',
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  quarterly: 'Vierteljährlich',
  semi_annual: 'Halbjährlich',
  annual: 'Jährlich',
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
  BTN_MANAGE_CARDS: 'Karten verwalten',
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
  EXEC_DATE: 'Ausführungsdatum',
  EXEC_NO_ISSUES: 'Ohne Beanstandung',
  EXEC_NO_ISSUES_HINT: 'Wartung ohne Probleme/Vorkommnisse durchgeführt',
  EXEC_DURATION: 'Tatsächliche Dauer',
  EXEC_DURATION_UNIT: 'Min.',
  EXEC_STAFF: 'Beteiligte MA',
  EXEC_SOLL: 'SOLL',
  EXEC_DOCUMENTATION: 'Bemerkungen / Auffälligkeiten',
  EXEC_DOCUMENTATION_PH: 'Vorkommnisse, Auffälligkeiten, Anmerkungen...',
  EXEC_DOCUMENTATION_HINT:
    'Bei Beanstandungen ist die Dokumentation erforderlich.',
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

  // Execution History
  HISTORY_PAGE_TITLE: 'Wartungsverlauf',
  HISTORY_HEADING: 'Wartungsverlauf',
  HISTORY_BACK: 'Zurück zum Board',
  HISTORY_COUNT: 'Durchführungen',
  HISTORY_COL_DATE: 'Datum',
  HISTORY_COL_PERSON: 'Durchgeführt von',
  HISTORY_COL_STATUS: 'Freigabe',
  HISTORY_COL_PHOTOS: 'Fotos',
  HISTORY_EMPTY_TITLE: 'Keine Durchführungen',
  HISTORY_EMPTY_DESC:
    'Für diese Karte wurden noch keine Wartungen dokumentiert.',
  HISTORY_ERROR: 'Fehler beim Laden des Wartungsverlaufs',
  HISTORY_DOCUMENTATION: 'Dokumentation',
  HISTORY_NO_DOCUMENTATION: 'Keine Bemerkungen',
  HISTORY_APPROVAL_BY: 'Freigabe von',
  HISTORY_APPROVAL_NOTE: 'Kommentar',
  HISTORY_PHOTOS_LOADING: 'Fotos werden geladen...',
  HISTORY_PHOTOS_ERROR: 'Fehler beim Laden der Fotos',

  // Approval Status Labels
  APPROVAL_STATUS_NONE: 'Keine',
  APPROVAL_STATUS_PENDING: 'Ausstehend',
  APPROVAL_STATUS_APPROVED: 'Freigegeben',
  APPROVAL_STATUS_REJECTED: 'Abgelehnt',

  // Gesamtansicht
  BTN_GESAMTANSICHT: 'Gesamtansicht',
  GESAMTANSICHT_TITLE: 'TPM Gesamtansicht',
  GESAMTANSICHT_PAGE_TITLE: 'TPM Gesamtansicht - Assixx',
  GESAMTANSICHT_SLIDER_LABEL: 'Anzahl Termine',
  GESAMTANSICHT_LOADING: 'Gesamtansicht wird geladen...',
  GESAMTANSICHT_EMPTY: 'Keine aktiven Wartungspläne vorhanden',
  GESAMTANSICHT_TH_MACHINE: 'Anlage',
  GESAMTANSICHT_TH_TIME: 'Uhrzeit',
  GESAMTANSICHT_TH_STAFF: 'Anzahl Mitarbeiter',
  GESAMTANSICHT_TH_PREP: 'Vorbereitung',
  GESAMTANSICHT_TH_EXEC: 'Durchführung',
  GESAMTANSICHT_TH_FOLLOW: 'Nachbereitung',
  BTN_BACK_TO_OVERVIEW: 'Zurück zur Übersicht',

  // Zoom controls
  ZOOM_IN: 'Vergrößern',
  ZOOM_OUT: 'Verkleinern',
  ZOOM_FULLSCREEN: 'Vollbild',

  // Locations
  LOCATIONS_PAGE_TITLE: 'TPM Standorte - Assixx',
  LOCATIONS_HEADING: 'Standorte',
  LOCATIONS_DESCRIPTION:
    'Strukturierte Standortbeschreibungen für diesen Wartungsplan',
  LOCATIONS_EMPTY_TITLE: 'Keine Standorte',
  LOCATIONS_EMPTY_DESC:
    'Es wurden noch keine Standorte für diesen Wartungsplan angelegt.',
  LOCATIONS_ADD: 'Standort hinzufügen',
  LOCATIONS_EDIT: 'Bearbeiten',
  LOCATIONS_DELETE: 'Löschen',
  LOCATIONS_DELETE_CONFIRM: 'Standort wirklich löschen?',
  LOCATIONS_POSITION: 'Position',
  LOCATIONS_TITLE: 'Titel',
  LOCATIONS_DESC_LABEL: 'Beschreibung',
  LOCATIONS_DESC_PH: 'Kurze Beschreibung des Standorts...',
  LOCATIONS_PHOTO: 'Foto',
  LOCATIONS_PHOTO_UPLOAD: 'Foto hochladen',
  LOCATIONS_PHOTO_REMOVE: 'Foto entfernen',
  LOCATIONS_PHOTO_HINT:
    'Zeigt wo sich der Standort an der Maschine befindet (max. 5 MB)',
  LOCATIONS_SAVE: 'Speichern',
  LOCATIONS_SAVING: 'Wird gespeichert...',
  LOCATIONS_SUCCESS_CREATE: 'Standort erfolgreich erstellt',
  LOCATIONS_SUCCESS_UPDATE: 'Standort erfolgreich aktualisiert',
  LOCATIONS_SUCCESS_DELETE: 'Standort erfolgreich gelöscht',
  LOCATIONS_ERROR_LOAD: 'Fehler beim Laden der Standorte',
  LOCATIONS_ERROR_SAVE: 'Fehler beim Speichern des Standorts',
  LOCATIONS_ERROR_DELETE: 'Fehler beim Löschen des Standorts',
  LOCATIONS_BACK: 'Zurück zum Board',
  LOCATIONS_CANCEL: 'Abbrechen',
  BTN_LOCATIONS: 'Standorte',

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
