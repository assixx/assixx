// =============================================================================
// MANAGE TEAMS - CONSTANTS
// =============================================================================

export { STATUS_BADGE_CLASSES, STATUS_LABELS } from '@assixx/shared/constants';

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
  forceDeleteMessage: (count: number) =>
    `Das Team hat ${count} Mitglieder. Möchten Sie das Team trotzdem löschen? Alle Mitglieder werden automatisch aus dem Team entfernt.`,

  // Search
  SEARCH_PLACEHOLDER: 'Teams suchen...',
  SEARCH_NO_RESULTS: 'Keine Teams gefunden für',

  // Form defaults
  NO_DEPARTMENT: 'Keine Abteilung',
  NO_LEADER: 'Kein Team-Leiter',
  NO_MEMBERS: 'Keine Mitglieder zugewiesen',
  NO_MACHINES: 'Keine Anlagen zugewiesen',
  NO_EMPLOYEES_AVAILABLE: 'Keine Mitarbeiter verfügbar',
  NO_MACHINES_AVAILABLE: 'Keine Anlagen verfügbar',

  // Form hints
  STATUS_HINT: 'Inaktive/Archivierte Teams werden nicht angezeigt',
} as const;

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  TEAMS: '/teams',
  team: (id: number) => `/teams/${id}`,
  teamMembers: (teamId: number) => `/teams/${teamId}/members`,
  teamMember: (teamId: number, userId: number) =>
    `/teams/${teamId}/members/${userId}`,
  teamAssets: (teamId: number) => `/teams/${teamId}/assets`,
  teamAsset: (teamId: number, assetId: number) =>
    `/teams/${teamId}/assets/${assetId}`,
  DEPARTMENTS: '/departments',
  ADMINS: '/users?role=admin',
  ROOT_USERS: '/users?role=root',
  EMPLOYEES: '/users?role=employee',
  MACHINES: '/assets',
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
  assetIds: number[];
  isActive: 1;
} = {
  name: '',
  description: '',
  departmentId: null,
  leaderId: null,
  memberIds: [],
  assetIds: [],
  isActive: 1,
};
