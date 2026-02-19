// =============================================================================
// TPM (Total Productive Maintenance) - CONSTANTS
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

/** Pagination defaults */
export const DEFAULT_PAGE_SIZE = 20;

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
  TH_MACHINE: 'Maschine',
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
  SEARCH_PLACEHOLDER: 'Maschine, Planname...',

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

  // Plan form labels
  LABEL_MACHINE: 'Maschine',
  LABEL_PLAN_NAME: 'Planname',
  LABEL_WEEKDAY: 'Basis-Wochentag',
  LABEL_REPEAT_EVERY: 'Wiederholung',
  LABEL_TIME: 'Uhrzeit',
  LABEL_SHIFT_REQUIRED: 'Schichtplan erforderlich',
  LABEL_NOTES: 'Notizen',

  // Plan form placeholders
  PH_MACHINE: 'Maschine auswählen...',
  PH_PLAN_NAME: 'z.B. Wartungsplan Presse P17',
  PH_REPEAT: 'Jede(n)',
  PH_TIME: 'HH:MM',
  PH_NOTES: 'Optionale Bemerkungen zum Wartungsplan...',

  // Plan form help text
  HELP_WEEKDAY: 'An welchem Wochentag soll die Wartung stattfinden?',
  HELP_REPEAT:
    'Alle X Wochen wiederholen (1 = jede Woche, 2 = alle 2 Wochen, etc.)',
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
  ERROR_MACHINE_HAS_PLAN:
    'Diese Maschine hat bereits einen aktiven Wartungsplan',
  ERROR_MACHINES_LOAD: 'Fehler beim Laden der Maschinen',

  // Slot assistant
  SLOT_TITLE: 'Verfügbare Zeitfenster',
  SLOT_DESCRIPTION: 'Zeigt freie und belegte Tage für die Maschine',
  SLOT_AVAILABLE: 'Verfügbar',
  SLOT_UNAVAILABLE: 'Belegt',
  SLOT_NO_SHIFT: 'Kein Schichtplan',
  SLOT_DOWNTIME: 'Maschinenstillstand',
  SLOT_TPM_EXISTING: 'Bestehende Wartung',
  SLOT_LOADING: 'Verfügbarkeit wird geprüft...',
  SLOT_STATS: 'verfügbare Tage von',

  // Employee assignment
  EMPLOYEE_TITLE: 'Team-Verfügbarkeit',
  EMPLOYEE_DESCRIPTION: 'Mitarbeiter im Maschinen-Team und ihre Verfügbarkeit',
  EMPLOYEE_AVAILABLE: 'Verfügbar',
  EMPLOYEE_UNAVAILABLE: 'Nicht verfügbar',
  EMPLOYEE_EMPTY: 'Kein Team zugewiesen',
  EMPLOYEE_LOADING: 'Team wird geladen...',

  // Time estimates
  TIME_EST_TITLE: 'Zeitschätzungen',
  TIME_EST_STAFF: 'Mitarbeiter',
  TIME_EST_PREP: 'Vorbereitung',
  TIME_EST_EXEC: 'Durchführung',
  TIME_EST_FOLLOW: 'Nachbereitung',
  TIME_EST_TOTAL: 'Gesamt',
  TIME_EST_MINUTES: 'Min.',

  // Plan table (machine × interval matrix)
  PLAN_TABLE_TITLE: 'Maschinen & Intervalle',
  PLAN_TABLE_EMPTY: 'Keine aktiven Wartungspläne vorhanden',
  PLAN_TABLE_MACHINE_COL: 'Maschine',
} as const;
