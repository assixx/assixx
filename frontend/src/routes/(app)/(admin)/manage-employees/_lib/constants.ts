// =============================================================================
// MANAGE EMPLOYEES - CONSTANTS
// =============================================================================

import type { AvailabilityOption } from './types';

export { STATUS_BADGE_CLASSES, STATUS_LABELS } from '@assixx/shared/constants';

// Re-export shared availability constants (single source of truth)
export {
  AVAILABILITY_BADGE_CLASSES,
  AVAILABILITY_ICONS,
  AVAILABILITY_LABELS,
  AVAILABILITY_STATUS_LABELS,
  AVAILABILITY_STATUS_OPTIONS,
} from '$lib/availability/constants';

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
  'Anlagenbediener',
  'Lagerarbeiter',
  'Qualitätsprüfer',
  'Schichtleiter',
  'Wartungstechniker',
  'Sonstiges',
] as const;

/**
 * Availability status options with labels (legacy alias)
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
  PASSWORD_HINT:
    'Min. 8 Zeichen. Enthält Großbuchstaben, Kleinbuchstaben und Zahlen.',
  EMPLOYEE_NUMBER_HINT: 'Max. 10 Zeichen (Buchstaben, Zahlen, Bindestrich)',
  TEAM_MULTISELECT_HINT: 'Strg/Cmd + Klick für Mehrfachauswahl',
  STATUS_HINT: 'Inaktive/Archivierte Mitarbeiter können sich nicht anmelden',
  TEAM_INFO:
    'Mitarbeiter werden Teams zugewiesen. Abteilung und Bereich werden automatisch vom Team vererbt.',

  // Danger zone - Role upgrade
  UPGRADE_TITLE: 'Gefahrenzone',
  UPGRADE_DESCRIPTION:
    'Stuft diesen Mitarbeiter dauerhaft zum Administrator hoch. Der Mitarbeiter erhält Zugriff auf Admin-Funktionen und verschwindet aus der Mitarbeiterliste.',
  UPGRADE_BUTTON: 'Zu Admin hochstufen',
  UPGRADE_CONFIRM_MESSAGE:
    'Sind Sie sicher? Der Mitarbeiter wird sofort zum Administrator hochgestuft und erscheint künftig in der Admin-Verwaltung.',
  UPGRADE_CONFIRM_BUTTON: 'Ja, hochstufen',
  UPGRADE_SUCCESS: 'Mitarbeiter wurde zum Administrator hochgestuft',
  UPGRADE_ERROR: 'Fehler beim Hochstufen',
  UPGRADE_UNAUTHORIZED:
    'Sie sind nicht berechtigt, Rollen zu ändern. Nur Root oder Admin mit Vollzugriff.',
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
