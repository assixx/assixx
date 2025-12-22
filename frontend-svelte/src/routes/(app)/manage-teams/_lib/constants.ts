// =============================================================================
// MANAGE TEAMS - CONSTANTS
// =============================================================================

import type { IsActiveStatus } from './types';

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
 * UI Messages
 */
export const MESSAGES = {
  // Loading
  LOADING_TEAMS: 'Teams werden geladen...',

  // Empty states
  NO_TEAMS_FOUND: 'Keine Teams gefunden',
  CREATE_FIRST_TEAM: 'Fügen Sie Ihr erstes Team hinzu',

  // Modal titles
  MODAL_TITLE_ADD: 'Neues Team',
  MODAL_TITLE_EDIT: 'Team bearbeiten',

  // API errors
  ERROR_LOADING: 'Ein Fehler ist aufgetreten',
  ERROR_SAVING: 'Fehler beim Speichern',
  ERROR_DELETING: 'Fehler beim Löschen',

  // Delete confirmation
  DELETE_TITLE: 'Team löschen',
  DELETE_CONFIRM_TITLE: 'Endgültig löschen?',
  DELETE_CONFIRM_MESSAGE:
    'Diese Aktion kann nicht rückgängig gemacht werden! Das Team wird unwiderruflich aus dem System entfernt.',

  // Force delete
  FORCE_DELETE_TITLE: 'Team hat Mitglieder',
  FORCE_DELETE_MESSAGE: (count: number) =>
    `Das Team hat ${count} Mitglieder. Möchten Sie das Team trotzdem löschen? Alle Mitglieder werden automatisch aus dem Team entfernt.`,

  // Search
  SEARCH_PLACEHOLDER: 'Teams suchen...',
  SEARCH_NO_RESULTS: 'Keine Teams gefunden für',

  // Form defaults
  NO_DEPARTMENT: 'Keine Abteilung',
  NO_LEADER: 'Kein Team-Leiter',
  NO_MEMBERS: 'Keine Mitglieder zugewiesen',
  NO_MACHINES: 'Keine Maschinen zugewiesen',
  NO_EMPLOYEES_AVAILABLE: 'Keine Mitarbeiter verfügbar',
  NO_MACHINES_AVAILABLE: 'Keine Maschinen verfügbar',

  // Form hints
  STATUS_HINT: 'Inaktive/Archivierte Teams werden nicht angezeigt',
} as const;

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  TEAMS: '/teams',
  TEAM: (id: number) => `/teams/${id}`,
  TEAM_MEMBERS: (teamId: number) => `/teams/${teamId}/members`,
  TEAM_MEMBER: (teamId: number, userId: number) => `/teams/${teamId}/members/${userId}`,
  TEAM_MACHINES: (teamId: number) => `/teams/${teamId}/machines`,
  TEAM_MACHINE: (teamId: number, machineId: number) => `/teams/${teamId}/machines/${machineId}`,
  DEPARTMENTS: '/departments',
  ADMINS: '/users?role=admin',
  EMPLOYEES: '/users?role=employee',
  MACHINES: '/machines',
} as const;

/**
 * Form default values
 */
export const FORM_DEFAULTS: {
  name: string;
  description: string;
  departmentId: null;
  leaderId: null;
  memberIds: number[];
  machineIds: number[];
  isActive: 1;
} = {
  name: '',
  description: '',
  departmentId: null,
  leaderId: null,
  memberIds: [],
  machineIds: [],
  isActive: 1,
};
