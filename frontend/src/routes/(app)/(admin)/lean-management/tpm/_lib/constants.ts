// =============================================================================
// TPM (Total Productive Maintenance) - CONSTANTS
// =============================================================================

import type { CardCategory, CardStatus, IntervalType } from './types';

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

/** Interval type short labels for compact display (calendar badges) */
export const INTERVAL_SHORT_LABELS: Record<IntervalType, string> = {
  daily: 'T',
  weekly: 'W',
  monthly: 'M',
  quarterly: 'VJ',
  semi_annual: 'HJ',
  annual: 'J',
  custom: 'BD',
};

/** Interval type colors for calendar badges (matching Kamishibai board style) */
export const INTERVAL_COLORS: Record<IntervalType, string> = {
  daily: '#4CAF50',
  weekly: '#8BC34A',
  monthly: '#5bb5f5',
  quarterly: '#b0b0b0',
  semi_annual: '#f5a0a0',
  annual: '#c8b88a',
  custom: '#FF9800',
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

/** Card category labels (German) */
export const CARD_CATEGORY_LABELS: Record<CardCategory, string> = {
  reinigung: 'Reinigung',
  wartung: 'Wartung',
  inspektion: 'Inspektion',
};

/** Card category icons */
export const CARD_CATEGORY_ICONS: Record<CardCategory, string> = {
  reinigung: 'fa-broom',
  wartung: 'fa-tools',
  inspektion: 'fa-search',
};

/** Default Kamishibai board colors */
export const DEFAULT_COLORS: Record<CardStatus, string> = {
  green: '#10b981',
  red: '#ef4444',
  yellow: '#f59e0b',
  overdue: '#8b5cf6',
};

/** Interval types that support plan-level time estimates */
export const ESTIMATE_INTERVALS: IntervalType[] = [
  'monthly',
  'quarterly',
  'semi_annual',
  'annual',
  'custom',
];

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

/** Pagination defaults */
export const DEFAULT_PAGE_SIZE = 20;

/** Zoom configuration for zoomable views (Gesamtansicht etc.) */
export const ZOOM_CONFIG = {
  DEFAULT: 100,
  MIN: 50,
  MAX: 150,
  STEP: 1,
} as const;

/** UI Messages (German) */
export const MESSAGES = {
  // Page titles
  PAGE_TITLE: 'TPM Wartung - Assixx',
  PAGE_HEADING: 'TPM Wartung',
  PAGE_DESCRIPTION: 'Wartungspläne verwalten und überwachen',

  // Stats
  STAT_TOTAL_PLANS: 'Wartungspläne',
  STAT_ACTIVE_PLANS: 'Aktive Pläne',
  STAT_OVERDUE_CARDS: 'Überfällige Karten',
  STAT_NEXT_MAINTENANCE: 'Nächste Wartung',

  // Buttons
  BTN_NEW_PLAN: 'Neuer Plan',
  BTN_CONFIG: 'Konfiguration',
  BTN_EDIT: 'Bearbeiten',
  BTN_DELETE: 'Löschen',
  BTN_VIEW_BOARD: 'Board anzeigen',
  BTN_VIEW_CARDS: 'Karten anzeigen',

  // Table headers
  TH_MACHINE: 'Anlage',
  TH_PLAN_NAME: 'Planname',
  TH_INTERVAL: 'Intervall',
  TH_WEEKDAY: 'Wochentag',
  TH_STATUS: 'Status',
  TH_CREATED: 'Erstellt',
  TH_ACTIONS: 'Aktionen',

  // Filters
  FILTER_ALL: 'Alle',
  FILTER_ACTIVE: 'Aktiv',
  FILTER_ARCHIVED: 'Archiviert',

  // Search
  SEARCH_PLACEHOLDER: 'Anlage, Planname...',

  // Empty state
  EMPTY_TITLE: 'Keine Wartungspläne vorhanden',
  EMPTY_DESCRIPTION:
    'Erstellen Sie einen neuen Wartungsplan, um die TPM-Überwachung zu starten.',
  EMPTY_FILTER_DESC: 'Es gibt aktuell keine Wartungspläne in dieser Kategorie.',

  // Loading
  LOADING: 'Wartungspläne werden geladen...',

  // Next maintenance
  NEXT_MAINTENANCE_TITLE: 'Nächste Wartungen',
  NEXT_MAINTENANCE_EMPTY: 'Keine geplanten Wartungen',

  // Success messages
  SUCCESS_DELETED: 'Wartungsplan gelöscht',

  // Error messages
  ERROR_LOAD_FAILED: 'Fehler beim Laden der Wartungspläne',
  ERROR_DELETE_FAILED: 'Fehler beim Löschen des Wartungsplans',

  // Delete confirmation
  DELETE_CONFIRM_TITLE: 'Wartungsplan löschen',
  DELETE_CONFIRM_MESSAGE:
    'Möchten Sie diesen Wartungsplan wirklich löschen? Alle zugehörigen Karten werden ebenfalls archiviert.',

  // Plan form
  PLAN_CREATE_TITLE: 'Neuen Wartungsplan erstellen',
  PLAN_EDIT_TITLE: 'Wartungsplan bearbeiten',
  PLAN_CREATE_PAGE_TITLE: 'Neuer Wartungsplan - Assixx',
  PLAN_EDIT_PAGE_TITLE: 'Wartungsplan bearbeiten - Assixx',

  // Plan form labels (cascade)
  LABEL_AREA: 'Bereich',
  LABEL_DEPARTMENT: 'Abteilung',
  PH_AREA: 'Bereich auswählen...',
  PH_DEPARTMENT: 'Abteilung auswählen...',
  PH_SELECT_AREA_FIRST: 'Bitte zuerst Bereich wählen',
  PH_SELECT_DEPT_FIRST: 'Bitte zuerst Abteilung wählen',

  // Plan form labels
  LABEL_MACHINE: 'Anlage',
  LABEL_PLAN_NAME: 'Planname',
  LABEL_WEEKDAY: 'Basis-Wochentag',
  LABEL_REPEAT_EVERY: 'Wiederholung',
  LABEL_TIME: 'Uhrzeit',
  LABEL_ALL_DAY: 'Ganztägig',
  LABEL_BUFFER_HOURS: 'Wartungsdauer (Puffer)',
  LABEL_TIME_WINDOW: 'Berechnetes Zeitfenster',
  LABEL_SHIFT_REQUIRED: 'Schichtplan erforderlich',
  LABEL_NOTES: 'Notizen',

  // Plan form placeholders
  PH_MACHINE: 'Anlage auswählen...',
  PH_PLAN_NAME: 'z.B. Wartungsplan Presse P17',
  PH_REPEAT: 'Jeder',
  PH_TIME: 'HH:MM',
  PH_NOTES: 'Optionale Bemerkungen zum Wartungsplan...',

  // Plan form help text
  HELP_WEEKDAY: 'An welchem Wochentag soll die Wartung stattfinden?',
  HELP_REPEAT:
    'Der wievielte Wochentag im Monat (1 = erster, 2 = zweiter, 3 = dritter)',
  HELP_BUFFER_HOURS:
    'Wie lange dauert die Wartung? Definiert das Zeitfenster ab der Startzeit.',
  HELP_BUFFER_FULL_DAY: 'Ganztägig (keine feste Uhrzeit)',
  HELP_SHIFT_REQUIRED:
    'Prüft ob ein Schichtplan für den Wartungszeitraum existiert',

  // Plan form buttons
  BTN_SAVE: 'Speichern',
  BTN_CREATE_PLAN: 'Plan erstellen',
  BTN_CANCEL: 'Abbrechen',
  BTN_BACK_TO_OVERVIEW: 'Zurück zur Übersicht',

  // Plan form success/error
  SUCCESS_PLAN_CREATED: 'Wartungsplan erfolgreich erstellt',
  SUCCESS_PLAN_UPDATED: 'Wartungsplan erfolgreich aktualisiert',
  ERROR_PLAN_CREATE: 'Fehler beim Erstellen des Wartungsplans',
  ERROR_PLAN_UPDATE: 'Fehler beim Aktualisieren des Wartungsplans',
  ERROR_MACHINE_HAS_PLAN: 'Diese Anlage hat bereits einen aktiven Wartungsplan',
  MACHINE_HAS_PLAN: 'TPM Plan existiert',
  ERROR_MACHINES_LOAD: 'Fehler beim Laden der Anlagen',

  // Slot assistant
  SLOT_TITLE: 'Verfügbare Zeitfenster',
  SLOT_DESCRIPTION:
    'Zeigt freie und belegte Tage für die Anlage (bis 365 Tage)',
  SLOT_AVAILABLE: 'Verfügbar',
  SLOT_UNAVAILABLE: 'Belegt',
  SLOT_SCHEDULED: 'Geplanter TPM-Termin',
  SLOT_NO_SHIFT: 'Kein Schichtplan',
  SLOT_TPM_EXISTING: 'Bestehende Wartung',
  SLOT_TPM_SCHEDULE: 'Geplante Wartung',
  SLOT_LOADING: 'Verfügbarkeit wird geprüft...',
  SLOT_STATS: 'verfügbare Tage von',
  SLOT_RANGE_FULL: 'Max. 365 Tage',
  SLOT_RANGE_DETAIL_HINT:
    'Details für die ersten 90 Tage, darüber hinaus nur geplante Termine',
  SLOT_SHOW_WEEKENDS: 'Wochenende anzeigen',
  SLOT_SHOW_ONLY_SCHEDULED: 'Nur geplante Termine',

  // Timeline day view
  TIMELINE_TITLE: 'Tagesübersicht',
  TIMELINE_CLOSE: 'Schließen',
  TIMELINE_FREE: 'Frei',
  TIMELINE_FULL_DAY: 'Ganztägig',
  TIMELINE_NO_DATA: 'Keine geplanten Termine für diesen Tag',

  // Employee assignment
  EMPLOYEE_TITLE: 'Team-Verfügbarkeit',
  EMPLOYEE_DESCRIPTION: 'Mitarbeiter im Anlagen-Team und ihre Verfügbarkeit',
  EMPLOYEE_AVAILABLE: 'Verfügbar',
  EMPLOYEE_UNAVAILABLE: 'Nicht verfügbar',
  EMPLOYEE_EMPTY: 'Kein Team zugewiesen',
  EMPLOYEE_LOADING: 'Team wird geladen...',

  // Time estimates (Plan Form)
  LABEL_TIME_ESTIMATES: 'Zeitschätzungen',
  HELP_TIME_ESTIMATES: 'SOLL-Zeiten pro Wartungsintervall definieren',
  TIME_EST_CREATE_HINT:
    'Zeitschätzungen können nach dem Erstellen des Plans definiert werden',
  TIME_EST_TITLE: 'Zeitschätzungen',
  TIME_EST_STAFF: 'Mitarbeiter',
  TIME_EST_PREP: 'Vorbereitung',
  TIME_EST_EXEC: 'Durchführung',
  TIME_EST_FOLLOW: 'Nachbereitung',
  TIME_EST_TOTAL: 'Gesamt',
  TIME_EST_MINUTES: 'Min.',

  // Card management
  CARD_PAGE_TITLE: 'TPM Karten - Assixx',
  CARD_PAGE_HEADING: 'Karten verwalten',
  CARD_CREATE_TITLE: 'Neue Karte erstellen',
  CARD_EDIT_TITLE: 'Karte bearbeiten',
  CARD_LIST_EMPTY: 'Keine Karten für diesen Plan vorhanden',
  CARD_LIST_EMPTY_FILTER: 'Keine Karten für die gewählten Filter',

  // Card form labels
  LABEL_CARD_ROLE: 'Kartentyp',
  LABEL_INTERVAL_TYPE: 'Intervall',
  LABEL_TITLE: 'Titel',
  LABEL_DESCRIPTION: 'Beschreibung',
  LABEL_LOCATION: 'Standort / Örtlichkeit',
  LABEL_REQUIRES_APPROVAL: 'Freigabe erforderlich',
  LABEL_CUSTOM_INTERVAL_DAYS: 'Intervall (Tage)',

  // Card form placeholders
  PH_TITLE: 'z.B. Sichtprüfung Hydraulik',
  PH_DESCRIPTION: 'Detaillierte Anleitung für die Wartungsaufgabe...',
  PH_LOCATION: 'z.B. Anlagenrückseite, Schaltschrank rechts',
  PH_CUSTOM_DAYS: 'Tage',

  // Card form help text
  HELP_CARD_ROLE:
    'Bediener = tägliche Prüfungen, Instandhaltung = technische Wartung',
  HELP_REQUIRES_APPROVAL:
    'Karte muss nach Erledigung von einem Vorgesetzten freigegeben werden',
  HELP_CUSTOM_INTERVAL:
    'Nur bei benutzerdefiniertem Intervall: Anzahl Tage zwischen Wartungen',
  LABEL_WEEKDAY_OVERRIDE: 'Wochentag (optional)',
  HELP_WEEKDAY_DEFAULT: 'Der Wartungsplan beginnt standardmäßig am',
  HELP_WEEKDAY_OVERRIDE:
    'Optional: Wählen Sie einen anderen Tag für diese wöchentliche Aufgabe.',

  // Card categories
  LABEL_CARD_CATEGORIES: 'Kategorie',
  HELP_CARD_CATEGORIES: 'Welche Art von Tätigkeit? Nur eine Auswahl möglich.',

  // Per-card execution estimate
  LABEL_CARD_EST_EXEC: 'Geschätzte Durchführungszeit',
  HELP_CARD_EST_EXEC:
    'Optional: Wie lange dauert diese Wartungsaufgabe? (in Minuten)',

  // Time estimate in card form (legacy labels kept for Employee view)
  LABEL_TIME_ESTIMATE: 'Zeitschätzung',
  HELP_TIME_ESTIMATE: 'Optional: Geschätzte Dauer für diese Wartungsaufgabe',
  LABEL_TE_STAFF: 'Mitarbeiter',
  LABEL_TE_PREP: 'Vorbereitung',
  LABEL_TE_EXEC: 'Durchführung',
  LABEL_TE_FOLLOW: 'Nachbereitung',
  TE_SUFFIX_MIN: 'Min.',
  TE_SUFFIX_PERSONS: 'Pers.',

  // Card table headers
  TH_CARD_CODE: 'Code',
  TH_CARD_TITLE: 'Titel',
  TH_CARD_ROLE: 'Typ',
  TH_CARD_DUE: 'Fällig',
  TH_CARD_ESTIMATED_TIME: 'SOLL-Zeit',
  TH_CARD_APPROVAL: 'Freigabe',

  // Card form buttons
  BTN_CREATE_CARD: 'Karte erstellen',
  BTN_NEW_CARD: 'Neue Karte',
  BTN_CANCEL_FORM: 'Abbrechen',

  // Card form success/error
  SUCCESS_CARD_CREATED: 'Karte erfolgreich erstellt',
  SUCCESS_CARD_UPDATED: 'Karte erfolgreich aktualisiert',
  SUCCESS_CARD_DELETED: 'Karte gelöscht',
  ERROR_CARD_CREATE: 'Fehler beim Erstellen der Karte',
  ERROR_CARD_UPDATE: 'Fehler beim Aktualisieren der Karte',
  ERROR_CARD_DELETE: 'Fehler beim Löschen der Karte',
  ERROR_CARDS_LOAD: 'Fehler beim Laden der Karten',

  // Card delete confirmation
  CARD_DELETE_TITLE: 'Karte löschen',
  CARD_DELETE_MESSAGE: 'Möchten Sie diese Karte wirklich löschen?',

  // Duplicate warning
  DUPLICATE_TITLE: 'Mögliche Duplikate gefunden',
  DUPLICATE_MESSAGE: 'Es wurden ähnliche Karten für diese Anlage gefunden:',
  DUPLICATE_CONTINUE: 'Trotzdem erstellen',
  DUPLICATE_CANCEL: 'Abbrechen',

  // Card filters
  FILTER_ALL_ROLES: 'Alle Typen',
  FILTER_ALL_INTERVALS: 'Alle Intervalle',
  FILTER_ALL_STATUS: 'Alle Status',

  // Config page
  CONFIG_PAGE_TITLE: 'TPM Konfiguration - Assixx',
  CONFIG_PAGE_HEADING: 'TPM Konfiguration',
  CONFIG_PAGE_DESCRIPTION: 'Farben, Eskalation und Vorlagen konfigurieren',

  // Config tabs
  CONFIG_TAB_COLORS: 'Farben',
  CONFIG_TAB_ESCALATION: 'Eskalation',
  CONFIG_TAB_TEMPLATES: 'Vorlagen',

  // Card status color config
  COLOR_TITLE: 'Status-Farben',
  COLOR_DESCRIPTION: 'Farben für die Kamishibai-Board Status-Anzeige anpassen',
  COLOR_STATUS: 'Status',
  COLOR_HEX: 'Hex-Farbe',
  COLOR_LABEL: 'Bezeichnung',
  COLOR_PREVIEW: 'Vorschau',
  COLOR_RESET: 'Zurücksetzen',
  COLOR_RESET_CONFIRM: 'Alle Farben auf die Standardwerte zurücksetzen?',
  COLOR_SAVE: 'Farbe speichern',
  COLOR_HEX_INVALID: 'Ungültiges Hex-Format (z.B. #10b981)',
  COLOR_LABEL_REQUIRED: 'Bezeichnung ist erforderlich',
  SUCCESS_COLOR_UPDATED: 'Farbe aktualisiert',
  SUCCESS_COLORS_RESET: 'Farben auf Standard zurückgesetzt',
  ERROR_COLOR_UPDATE: 'Fehler beim Aktualisieren der Farbe',
  ERROR_COLOR_RESET: 'Fehler beim Zurücksetzen der Farben',

  // Interval color config
  INTERVAL_COLOR_TITLE: 'Intervall-Farben',
  INTERVAL_COLOR_DESCRIPTION:
    'Farben für die Wartungsintervalle im Kalender und Board anpassen',
  INTERVAL_COLOR_RESET: 'Zurücksetzen',
  INTERVAL_COLOR_RESET_CONFIRM:
    'Alle Intervall-Farben auf die Standardwerte zurücksetzen?',
  SUCCESS_INTERVAL_COLOR_UPDATED: 'Intervall-Farbe aktualisiert',
  SUCCESS_INTERVAL_COLORS_RESET: 'Intervall-Farben auf Standard zurückgesetzt',
  ERROR_INTERVAL_COLOR_UPDATE: 'Fehler beim Aktualisieren der Intervall-Farbe',
  ERROR_INTERVAL_COLOR_RESET: 'Fehler beim Zurücksetzen der Intervall-Farben',

  // Category color config
  CATEGORY_COLOR_TITLE: 'Kategorie-Farben',
  CATEGORY_COLOR_DESCRIPTION:
    'Optionale Farben für Wartungskategorien — überschreibt die Kartenfarbe bei grünem Status',
  CATEGORY_COLOR_RESET: 'Zurücksetzen',
  CATEGORY_COLOR_RESET_CONFIRM:
    'Alle Kategorie-Farben entfernen? Karten zeigen dann wieder die Status-Farbe.',
  CATEGORY_COLOR_NONE: 'Keine Farbe',
  SUCCESS_CATEGORY_COLOR_UPDATED: 'Kategorie-Farbe aktualisiert',
  SUCCESS_CATEGORY_COLORS_RESET: 'Kategorie-Farben zurückgesetzt',
  ERROR_CATEGORY_COLOR_UPDATE: 'Fehler beim Aktualisieren der Kategorie-Farbe',
  ERROR_CATEGORY_COLOR_RESET: 'Fehler beim Zurücksetzen der Kategorie-Farben',

  // Escalation config
  ESCALATION_TITLE: 'Eskalation',
  ESCALATION_DESCRIPTION:
    'Nach wie vielen Stunden werden überfällige Wartungen eskaliert?',
  ESCALATION_HOURS: 'Eskalation nach (Stunden)',
  ESCALATION_HOURS_HELP: 'Wert zwischen 1 und 720 (30 Tage)',
  ESCALATION_NOTIFY_TEAM: 'Teamleiter benachrichtigen',
  ESCALATION_NOTIFY_DEPT: 'Abteilungsleiter benachrichtigen',
  ESCALATION_SAVE: 'Eskalation speichern',
  SUCCESS_ESCALATION_UPDATED: 'Eskalations-Konfiguration aktualisiert',
  ERROR_ESCALATION_UPDATE:
    'Fehler beim Aktualisieren der Eskalations-Konfiguration',
  ERROR_ESCALATION_HOURS_RANGE: 'Stunden müssen zwischen 1 und 720 liegen',

  // Template manager
  TEMPLATE_TITLE: 'Kartenvorlagen',
  TEMPLATE_DESCRIPTION:
    'Vorlagen für die schnelle Erstellung von Wartungskarten',
  TEMPLATE_NAME: 'Name',
  TEMPLATE_DESC: 'Beschreibung',
  TEMPLATE_IS_DEFAULT: 'Standard-Vorlage',
  TEMPLATE_EMPTY: 'Keine Vorlagen vorhanden',
  TEMPLATE_EMPTY_DESC:
    'Erstellen Sie eine Vorlage, um die Kartenerstellung zu beschleunigen.',
  BTN_NEW_TEMPLATE: 'Neue Vorlage',
  BTN_CREATE_TEMPLATE: 'Vorlage erstellen',
  BTN_UPDATE_TEMPLATE: 'Vorlage aktualisieren',
  TEMPLATE_CREATE_TITLE: 'Neue Vorlage erstellen',
  TEMPLATE_EDIT_TITLE: 'Vorlage bearbeiten',
  TEMPLATE_DELETE_TITLE: 'Vorlage löschen',
  TEMPLATE_DELETE_MESSAGE: 'Möchten Sie diese Vorlage wirklich löschen?',
  SUCCESS_TEMPLATE_CREATED: 'Vorlage erstellt',
  SUCCESS_TEMPLATE_UPDATED: 'Vorlage aktualisiert',
  SUCCESS_TEMPLATE_DELETED: 'Vorlage gelöscht',
  ERROR_TEMPLATE_CREATE: 'Fehler beim Erstellen der Vorlage',
  ERROR_TEMPLATE_UPDATE: 'Fehler beim Aktualisieren der Vorlage',
  ERROR_TEMPLATE_DELETE: 'Fehler beim Löschen der Vorlage',
  ERROR_TEMPLATE_NAME_REQUIRED: 'Name ist erforderlich',

  // Placeholders
  PH_TEMPLATE_NAME: 'z.B. Hydraulik-Prüfung',
  PH_TEMPLATE_DESC: 'Optionale Beschreibung der Vorlage...',

  // Gesamtansicht (matrix overview)
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

  // Zoom controls
  ZOOM_IN: 'Vergrößern',
  ZOOM_OUT: 'Verkleinern',
  ZOOM_FULLSCREEN: 'Vollbild',
} as const;
