// =============================================================================
// MANAGE EMPLOYEES - CONSTANTS
// =============================================================================

import type { AvailabilityOption, AvailabilityStatus, IsActiveStatus } from './types';

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
  3: 'badge--secondary',
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
 */
export const AVAILABILITY_BADGE_CLASSES: Record<AvailabilityStatus, string> = {
  available: 'badge--success',
  vacation: 'badge--info',
  sick: 'badge--warning',
  unavailable: 'badge--error',
  training: 'badge--primary',
  other: 'badge--secondary',
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
 * API Endpoints
 */
export const API_ENDPOINTS = {
  EMPLOYEES: '/api/v2/users?role=employee',
  TEAMS: '/api/v2/teams',
  USER: (id: number) => `/api/v2/users/${id}`,
  USERS: '/api/v2/users',
  TEAM_MEMBERS: (teamId: number) => `/api/v2/teams/${teamId}/members`,
} as const;

/**
 * Form default values
 */
export const FORM_DEFAULTS = {
  isActive: 1 as const,
  availabilityStatus: 'available' as const,
  role: 'employee' as const,
};
