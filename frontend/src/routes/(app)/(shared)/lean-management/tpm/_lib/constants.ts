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
} as const;
