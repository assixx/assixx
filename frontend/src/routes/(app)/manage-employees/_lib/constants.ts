// =============================================================================
// MANAGE EMPLOYEES - CONSTANTS
// =============================================================================

import type { AvailabilityOption, AvailabilityStatus, IsActiveStatus } from './types';

/**
 * Default badge class for neutral/no-data states
 */
export const DEFAULT_BADGE_CLASS = 'badge--secondary';

/**
 * Info badge class for informational states (teams, departments, areas)
 */
export const INFO_BADGE_CLASS = 'badge--info';

/**
 * Position options for employees
 */
export const POSITION_OPTIONS: readonly string[] = [
  'Produktionsmitarbeiter',
  'Maschinenbediener',
  'Lagerarbeiter',
  'Qualitätsprüfer',
  'Schichtleiter',
  'Wartungstechniker',
  'Sonstiges',
] as const;

/**
 * Availability status options with labels
 */
export const AVAILABILITY_OPTIONS: readonly AvailabilityOption[] = [
  { value: 'available', label: 'Verfügbar' },
  { value: 'vacation', label: 'Urlaub' },
  { value: 'sick', label: 'Krank' },
  { value: 'unavailable', label: 'Nicht verfügbar' },
  { value: 'training', label: 'Schulung' },
  { value: 'other', label: 'Sonstiges' },
] as const;

/**
 * Status badge CSS classes mapping
 */
export const STATUS_BADGE_CLASSES: Record<IsActiveStatus, string> = {
  1: 'badge--success',
  0: 'badge--warning',
  3: DEFAULT_BADGE_CLASS,
  4: 'badge--error',
};

/**
 * Status labels for display
 */
export const STATUS_LABELS: Record<IsActiveStatus, string> = {
  1: 'Aktiv',
  0: 'Inaktiv',
  3: 'Archiviert',
  4: 'Gelöscht',
};

/**
 * Availability status badge classes
 * IMPORTANT: Must match shifts/_lib/constants.ts AVAILABILITY_COLORS for consistency!
 */
export const AVAILABILITY_BADGE_CLASSES: Record<AvailabilityStatus, string> = {
  available: 'badge--success',
  vacation: 'badge--warning',
  sick: 'badge--danger',
  unavailable: 'badge--error',
  training: 'badge--info',
  other: 'badge--dark',
};

/**
 * Availability status icons (FontAwesome classes)
 * IMPORTANT: Must match shifts/_lib/constants.ts AVAILABILITY_ICONS for consistency!
 */
export const AVAILABILITY_ICONS: Record<AvailabilityStatus, string> = {
  available: 'fa-check-circle',
  vacation: 'fa-plane',
  sick: 'fa-notes-medical',
  unavailable: 'fa-ban',
  training: 'fa-graduation-cap',
  other: 'fa-clock',
};

/**
 * Availability status labels
 */
export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  available: 'Verfügbar',
  vacation: 'Urlaub',
  sick: 'Krank',
  unavailable: 'Nicht verfügbar',
  training: 'Schulung',
  other: 'Sonstiges',
};

/**
 * Availability status labels for planned availability display
 * (Alias for AVAILABILITY_LABELS - used in getPlannedAvailability)
 */
export const AVAILABILITY_STATUS_LABELS: Record<AvailabilityStatus, string> = {
  available: 'Verfügbar',
  vacation: 'Urlaub',
  sick: 'Krank',
  unavailable: 'Nicht verfügbar',
  training: 'Schulung',
  other: 'Sonstiges',
};

/**
 * Availability status options for select dropdown
 */
export const AVAILABILITY_STATUS_OPTIONS: { value: AvailabilityStatus; label: string }[] = [
  { value: 'available', label: 'Verfügbar' },
  { value: 'vacation', label: 'Urlaub' },
  { value: 'sick', label: 'Krank' },
  { value: 'unavailable', label: 'Nicht verfügbar' },
  { value: 'training', label: 'Schulung' },
  { value: 'other', label: 'Sonstiges' },
];

/**
 * Password strength labels
 */
export const PASSWORD_STRENGTH_LABELS: readonly string[] = [
  'Sehr schwach',
  'Schwach',
  'Mittel',
  'Stark',
  'Sehr stark',
] as const;

/**
 * Password crack time estimates
 */
export const PASSWORD_CRACK_TIMES: readonly string[] = [
  'sofort',
  'Minuten',
  'Stunden',
  'Tage',
  'Jahre',
] as const;

/**
 * UI Messages
 */
export const MESSAGES = {
  // Loading
  LOADING_EMPLOYEES: 'Mitarbeiter werden geladen...',

  // Empty states
  NO_EMPLOYEES_FOUND: 'Keine Mitarbeiter gefunden',
  CREATE_FIRST_EMPLOYEE: 'Erstellen Sie Ihren ersten Mitarbeiter',

  // Modal titles
  MODAL_TITLE_ADD: 'Neuer Mitarbeiter',
  MODAL_TITLE_EDIT: 'Mitarbeiter bearbeiten',

  // Validation errors
  EMAIL_MISMATCH: 'E-Mail-Adressen stimmen nicht überein',
  PASSWORD_MISMATCH: 'Passwörter stimmen nicht überein',

  // API errors
  ERROR_LOADING: 'Ein Fehler ist aufgetreten',
  ERROR_SAVING: 'Fehler beim Speichern',
  ERROR_DELETING: 'Fehler beim Löschen',

  // Delete confirmation
  DELETE_TITLE: 'Mitarbeiter löschen',
  DELETE_CONFIRM_TITLE: 'Endgültig löschen?',
  DELETE_CONFIRM_MESSAGE:
    'Diese Aktion kann nicht rückgängig gemacht werden! Der Mitarbeiter wird unwiderruflich aus dem System entfernt.',

  // Badge defaults
  NO_TEAM: 'Kein Team',
  NO_TEAM_TITLE: 'Keinem Team zugewiesen',

  // Search
  SEARCH_PLACEHOLDER: 'Mitarbeiter suchen...',
  SEARCH_NO_RESULTS: 'Keine Mitarbeiter gefunden für',
  SEARCH_MORE_RESULTS: 'weitere Ergebnisse in Tabelle',

  // Form hints
  EMAIL_HINT: 'Wird auch als Benutzername verwendet',
  PASSWORD_HINT: 'Min. 8 Zeichen. Enthält Großbuchstaben, Kleinbuchstaben und Zahlen.',
  EMPLOYEE_NUMBER_HINT: 'Max. 10 Zeichen (Buchstaben, Zahlen, Bindestrich)',
  TEAM_MULTISELECT_HINT: 'Strg/Cmd + Klick für Mehrfachauswahl',
  STATUS_HINT: 'Inaktive/Archivierte Mitarbeiter können sich nicht anmelden',
  TEAM_INFO:
    'Mitarbeiter werden Teams zugewiesen. Abteilung und Bereich werden automatisch vom Team vererbt.',
} as const;

/**
 * API Endpoints (relative to /api/v2 base)
 */
export const API_ENDPOINTS = {
  EMPLOYEES: '/users?role=employee',
  TEAMS: '/teams',
  user: (id: number) => `/users/${id}`,
  USERS: '/users',
  teamMembers: (teamId: number) => `/teams/${teamId}/members`,
} as const;

/**
 * Form default values
 */
export const FORM_DEFAULTS = {
  isActive: 1 as const,
  availabilityStatus: 'available' as const,
  role: 'employee' as const,
};
