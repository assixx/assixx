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
} as const;
