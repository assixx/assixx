// =============================================================================
// MANAGE DEPARTMENTS - CONSTANTS
// =============================================================================

import type { IsActiveStatus, FormIsActiveStatus } from './types';

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
 * Dependency labels for force delete message
 */
export const DEPENDENCY_LABELS: Record<string, string> = {
  users: 'Benutzer',
  teams: 'Teams',
  machines: 'Maschinen',
  shifts: 'Schichten',
  shiftPlans: 'Schichtpläne',
  kvpSuggestions: 'KVP-Vorschläge',
  documents: 'Dokumente',
  calendarEvents: 'Kalendereinträge',
  surveyAssignments: 'Umfragen',
  adminPermissions: 'Admin-Berechtigungen',
};

/**
 * UI Messages for i18n preparation
 */
export const MESSAGES = {
  // Page
  PAGE_TITLE: 'Abteilungsverwaltung - Assixx',
  PAGE_HEADING: 'Abteilungsübersicht',
  PAGE_DESCRIPTION: 'Abteilungen erstellen und verwalten',

  // Loading
  LOADING: 'Abteilungen werden geladen...',

  // Empty states
  NO_DEPARTMENTS_FOUND: 'Keine Abteilungen gefunden',
  CREATE_FIRST_DEPARTMENT: 'Erstellen Sie Ihre erste Abteilung',

  // Modal titles
  MODAL_TITLE_ADD: 'Neue Abteilung',
  MODAL_TITLE_EDIT: 'Abteilung bearbeiten',

  // Delete
  DELETE_TITLE: 'Abteilung löschen',
  DELETE_QUESTION: 'Möchten Sie diese Abteilung wirklich löschen?',
  DELETE_CONFIRM_TITLE: 'Endgültig löschen?',
  DELETE_CONFIRM_WARNING: 'Diese Aktion kann nicht rückgängig gemacht werden!',
  DELETE_CONFIRM_MESSAGE:
    'Die Abteilung wird unwiderruflich entfernt. Alle zugehörigen Teams und Mitarbeiter werden neu zugeordnet.',

  // Force delete
  FORCE_DELETE_TITLE: 'Abteilung hat Abhängigkeiten',
  FORCE_DELETE_MESSAGE: (totalDeps: number, depList: string) => {
    const element = totalDeps === 1 ? 'Element' : 'Elementen';
    return `Diese Abteilung wird von ${totalDeps} ${element} verwendet (${depList}). Möchten Sie die Abteilung trotzdem löschen? Alle Zuordnungen werden automatisch entfernt.`;
  },

  // Search
  SEARCH_PLACEHOLDER: 'Abteilungen suchen...',
  SEARCH_NO_RESULTS: 'Keine Abteilungen gefunden für',
  MORE_RESULTS: (count: number) => `${count} weitere Ergebnisse in Tabelle`,

  // Form labels
  LABEL_NAME: 'Name',
  LABEL_DESCRIPTION: 'Beschreibung',
  LABEL_AREA: 'Bereich (Area)',
  LABEL_DEPARTMENT_LEAD: 'Abteilungsleiter',
  LABEL_STATUS: 'Status',

  // Form placeholders
  NO_AREA: 'Kein Bereich',
  NO_DEPARTMENT_LEAD: 'Kein Abteilungsleiter',

  // Form hints
  DEPARTMENT_LEAD_HINT: 'Nur Administratoren können als Abteilungsleiter zugewiesen werden.',
  STATUS_HINT: 'Inaktive/Archivierte Abteilungen werden nicht angezeigt',

  // Table headers
  TH_NAME: 'Name',
  TH_DESCRIPTION: 'Beschreibung',
  TH_STATUS: 'Status',
  TH_AREA: 'Bereich',
  TH_DEPARTMENT_LEAD: 'Abteilungsleiter',
  TH_TEAMS: 'Teams',
  TH_ACTIONS: 'Aktionen',

  // Filter labels
  FILTER_ACTIVE: 'Aktive',
  FILTER_INACTIVE: 'Inaktive',
  FILTER_ARCHIVED: 'Archiviert',
  FILTER_ALL: 'Alle',

  // Buttons
  BTN_ADD_DEPARTMENT: 'Abteilung hinzufügen',
  BTN_SAVE: 'Speichern',
  BTN_CANCEL: 'Abbrechen',
  BTN_DELETE: 'Löschen',
  BTN_DELETE_FINAL: 'Endgültig löschen',
  BTN_RETRY: 'Erneut versuchen',

  // Validation
  VALIDATION_NAME_REQUIRED: 'Bitte geben Sie einen Namen ein',

  // API errors
  ERROR_LOADING: 'Ein Fehler ist aufgetreten',
  ERROR_SAVING: 'Fehler beim Speichern',
  ERROR_DELETING: 'Fehler beim Löschen',
} as const;

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  DEPARTMENTS: '/departments',
  DEPARTMENT: (id: number) => `/departments/${id}`,
  DEPARTMENT_FORCE_DELETE: (id: number) => `/departments/${id}?force=true`,
  AREAS: '/areas',
  USERS_ADMIN: '/users?role=admin',
  USERS_ROOT: '/users?role=root',
} as const;

/**
 * Form default values
 */
export const FORM_DEFAULTS: {
  name: string;
  description: string;
  areaId: number | null;
  departmentLeadId: number | null;
  isActive: FormIsActiveStatus;
} = {
  name: '',
  description: '',
  areaId: null,
  departmentLeadId: null,
  isActive: 1,
};
