// =============================================================================
// MANAGE TEAMS - CONSTANTS
// =============================================================================

import {
  DEFAULT_HIERARCHY_LABELS,
  resolvePositionDisplay,
  type HierarchyLabels,
} from '$lib/types/hierarchy-labels';

export { STATUS_BADGE_CLASSES, STATUS_LABELS } from '@assixx/shared/constants';

/** Static messages that don't depend on hierarchy labels */
const STATIC_MESSAGES = {
  CREATE_FIRST_TEAM: 'Erstellen Sie den ersten Eintrag',
  MODAL_TITLE_ADD: 'Hinzufügen',
  MODAL_TITLE_EDIT: 'Bearbeiten',
  DELETE_TITLE: 'Löschen',
  DELETE_CONFIRM_TITLE: 'Endgültig löschen?',
  DELETE_CONFIRM_MESSAGE:
    'Diese Aktion kann nicht rückgängig gemacht werden! Der Eintrag wird unwiderruflich aus dem System entfernt.',
  FORCE_DELETE_TITLE: 'Abhängigkeiten vorhanden',
  forceDeleteMessage: (count: number) =>
    `Der Eintrag hat ${count} Mitglieder. Möchten Sie ihn trotzdem löschen? Alle Mitglieder werden automatisch entfernt.`,
  ERROR_LOADING: 'Ein Fehler ist aufgetreten',
  ERROR_SAVING: 'Fehler beim Speichern',
  ERROR_DELETING: 'Fehler beim Löschen',
  NO_LEADER: 'Kein Leiter',
  NO_MEMBERS: 'Keine Mitglieder zugewiesen',
  NO_EMPLOYEES_AVAILABLE: 'Keine Mitarbeiter verfügbar',
  SUCCESS_CREATED: 'Erfolgreich erstellt',
  SUCCESS_UPDATED: 'Erfolgreich aktualisiert',
  SUCCESS_DELETED: 'Erfolgreich gelöscht',
  BTN_ADD: 'Hinzufügen',
  moreResults: (count: number) => `${count} weitere Ergebnisse in Tabelle`,
};

/**
 * UI Messages — factory with dynamic hierarchy labels.
 * Entity-specific strings use labels, compound words are neutralized (A4).
 */
export function createMessages(labels: HierarchyLabels) {
  return {
    ...STATIC_MESSAGES,
    TEAM_LEAD_POSITION: resolvePositionDisplay('team_lead', labels),
    PAGE_TITLE: `${labels.team} — Übersicht`,
    PAGE_DESCRIPTION: `${labels.team} verwalten`,
    LOADING: `${labels.team} werden geladen...`,
    NO_TEAMS_FOUND: `Keine ${labels.team} gefunden`,
    SEARCH_PLACEHOLDER: `${labels.team} suchen...`,
    SEARCH_NO_RESULTS: `Keine ${labels.team} gefunden für`,
    NO_DEPARTMENT: `Keine ${labels.department}`,
    NO_MACHINES: `Keine ${labels.asset} zugewiesen`,
    NO_MACHINES_AVAILABLE: `Keine ${labels.asset} verfügbar`,
    STATUS_HINT: `Inaktive/Archivierte ${labels.team} werden nicht angezeigt`,
    FILTER_ACTIVE_TITLE: `Aktive ${labels.team}`,
    FILTER_INACTIVE_TITLE: `Inaktive ${labels.team}`,
    FILTER_ARCHIVED_TITLE: `Archivierte ${labels.team}`,
    FILTER_ALL_TITLE: `Alle ${labels.team}`,
    TH_DEPARTMENT: labels.department,
    TH_ASSETS: labels.asset,
    LABEL_DEPARTMENT: labels.department,
    LABEL_ASSETS: `Zugewiesene ${labels.asset}`,
    HALL_INFO_NO_DEPARTMENT: `${labels.hall}-Auswahl benötigt ${labels.department}-Zuordnung.`,
    HALL_INFO_NO_HALLS: `Keine ${labels.hall}-Zuordnung im gewählten Eintrag.`,
    HALL_INFO_AUTO_ASSIGNED: 'Automatisch zugewiesen.',
  };
}

/** Message type for component props */
export type TeamMessages = ReturnType<typeof createMessages>;

/** Default messages (used in non-Svelte contexts) */
export const MESSAGES = createMessages(DEFAULT_HIERARCHY_LABELS);

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  TEAMS: '/teams',
  team: (id: number) => `/teams/${id}`,
  teamMembers: (teamId: number) => `/teams/${teamId}/members`,
  teamMember: (teamId: number, userId: number) => `/teams/${teamId}/members/${userId}`,
  teamAssets: (teamId: number) => `/teams/${teamId}/assets`,
  teamAsset: (teamId: number, assetId: number) => `/teams/${teamId}/assets/${assetId}`,
  DEPARTMENTS: '/departments',
  LEADER_CANDIDATES: '/users?isActive=1&position=team_lead',
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
