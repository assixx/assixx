/**
 * Root Dashboard - Constants
 * @module root-dashboard/_lib/constants
 */

import type { ActionType, UserRole } from './types';

/** Action labels (German) */
export const ACTION_LABELS: Record<ActionType | string, string> = {
  create: 'Erstellt',
  update: 'Aktualisiert',
  delete: 'Gelöscht',
  login: 'Anmeldung',
  logout: 'Abmeldung',
  view: 'Angesehen',
  assign: 'Zugewiesen',
  unassign: 'Entfernt',
  role_switch_to_root: 'Wechsel zu Root',
  role_switch_to_admin: 'Wechsel zu Admin',
  role_switch_to_employee: 'Wechsel zu Mitarbeiter',
  role_switch_root_to_admin: 'Root → Admin',
} as const;

/** Action badge CSS classes */
export const ACTION_BADGE_CLASSES: Record<ActionType | string, string> = {
  create: 'create',
  update: 'update',
  delete: 'delete',
  login: 'login',
  logout: 'logout',
  view: 'info',
  assign: 'success',
  unassign: 'danger',
  role_switch_to_root: 'info',
  role_switch_to_admin: 'info',
  role_switch_to_employee: 'info',
  role_switch_root_to_admin: 'info',
} as const;

/** Role labels (German) */
export const ROLE_LABELS: Record<UserRole | string, string> = {
  root: 'Root',
  admin: 'Admin',
  employee: 'Mitarbeiter',
} as const;

/** Role badge CSS classes */
export const ROLE_BADGE_CLASSES: Record<UserRole | string, string> = {
  root: 'danger',
  admin: 'warning',
  employee: 'info',
} as const;

/** Employee number validation */
export const EMPLOYEE_NUMBER = {
  maxLength: 10,
  pattern: '[A-Za-z0-9\\-]{1,10}',
  validCharsRegex: /[^-0-9A-Za-z]/g,
  tempPrefixes: ['TEMP-', 'TEMP_'],
} as const;

/** API endpoints */
export const API_ENDPOINTS = {
  dashboard: '/api/v2/root/dashboard',
  logs: '/api/v2/logs?limit=5',
  userMe: '/api/v2/users/me',
} as const;

/** LocalStorage keys */
export const STORAGE_KEYS = {
  accessToken: 'accessToken',
} as const;

/** UI Messages (German) */
export const MESSAGES = {
  // Errors
  dashboardLoadError: 'Fehler beim Laden des Dashboards',
  logsLoadError: 'Fehler beim Laden der Aktivitäten',
  saveError: 'Fehler beim Speichern',
  employeeNumberSaveError: 'Fehler beim Speichern der Personalnummer',
  genericError: 'Ein Fehler ist aufgetreten',

  // Validation
  employeeNumberRequired: 'Bitte geben Sie eine gültige Personalnummer ein.',

  // UI
  loading: 'Laden...',
  saving: 'Speichern...',
  noActivities: 'Keine kürzlichen Aktivitäten',
} as const;
