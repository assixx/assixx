// =============================================================================
// MANAGE DEPARTMENTS - CONSTANTS
// =============================================================================

import {
  DEFAULT_HIERARCHY_LABELS,
  resolvePositionDisplay,
  type HierarchyLabels,
} from '$lib/types/hierarchy-labels';

import type { FormIsActiveStatus } from './types';

export { STATUS_BADGE_CLASSES, STATUS_LABELS } from '@assixx/shared/constants';

/**
 * Dependency labels for force delete message.
 * Teams and assets use dynamic hierarchy labels.
 */
export function createDependencyLabels(labels: HierarchyLabels): Record<string, string> {
  return {
    users: 'Benutzer',
    teams: labels.team,
    assets: labels.asset,
    shifts: 'Schichten',
    shiftPlans: 'Schichtpläne',
    kvpSuggestions: 'KVP-Vorschläge',
    documents: 'Dokumente',
    calendarEvents: 'Kalendereinträge',
    surveyAssignments: 'Umfragen',
    adminPermissions: 'Admin-Berechtigungen',
  };
}

/** Static messages that don't depend on hierarchy labels */
const STATIC_MESSAGES = {
  CREATE_FIRST_DEPARTMENT: 'Erstellen Sie den ersten Eintrag',
  MODAL_TITLE_ADD: 'Hinzufügen',
  MODAL_TITLE_EDIT: 'Bearbeiten',
  DELETE_TITLE: 'Löschen',
  DELETE_QUESTION: 'Möchten Sie diesen Eintrag wirklich löschen?',
  DELETE_CONFIRM_TITLE: 'Endgültig löschen?',
  DELETE_CONFIRM_WARNING: 'Diese Aktion kann nicht rückgängig gemacht werden!',
  DELETE_CONFIRM_MESSAGE:
    'Der Eintrag wird unwiderruflich entfernt. Alle Zuordnungen werden automatisch aktualisiert.',
  FORCE_DELETE_TITLE: 'Abhängigkeiten vorhanden',
  forceDeleteMessage(totalDeps: number, depList: string): string {
    const element = totalDeps === 1 ? 'Element' : 'Elementen';
    return `Dieser Eintrag wird von ${totalDeps} ${element} verwendet (${depList}). Möchten Sie ihn trotzdem löschen? Alle Zuordnungen werden automatisch entfernt.`;
  },
  moreResults(count: number): string {
    return `${count} weitere Ergebnisse in Tabelle`;
  },
  LABEL_NAME: 'Name',
  LABEL_DESCRIPTION: 'Beschreibung',
  LABEL_DEPARTMENT_LEAD: 'Leiter',
  LABEL_STATUS: 'Status',
  NO_AREA: 'Keine Zuordnung',
  NO_DEPARTMENT_LEAD: 'Kein Leiter',
  DEPARTMENT_LEAD_HINT:
    'Nur Admins/Root mit der entsprechenden Leiter-Position stehen zur Auswahl. Zuweisung über die Admin-Verwaltung.',
  TH_NAME: 'Name',
  TH_DESCRIPTION: 'Beschreibung',
  TH_STATUS: 'Status',
  TH_DEPARTMENT_LEAD: 'Leiter',
  TH_ACTIONS: 'Aktionen',
  FILTER_ACTIVE: 'Aktive',
  FILTER_INACTIVE: 'Inaktive',
  FILTER_ARCHIVED: 'Archiviert',
  FILTER_ALL: 'Alle',
  BTN_ADD_DEPARTMENT: 'Hinzufügen',
  BTN_SAVE: 'Speichern',
  BTN_CANCEL: 'Abbrechen',
  BTN_DELETE: 'Löschen',
  BTN_DELETE_FINAL: 'Endgültig löschen',
  BTN_RETRY: 'Erneut versuchen',
  VALIDATION_NAME_REQUIRED: 'Bitte geben Sie einen Namen ein',
  ERROR_LOADING: 'Ein Fehler ist aufgetreten',
  ERROR_SAVING: 'Fehler beim Speichern',
  ERROR_DELETING: 'Fehler beim Löschen',
};

/**
 * UI Messages — factory with dynamic hierarchy labels.
 * Entity-specific strings use labels, compound words are neutralized (A4).
 */
export function createMessages(labels: HierarchyLabels) {
  return {
    ...STATIC_MESSAGES,
    DEPARTMENT_LEAD_POSITION: resolvePositionDisplay('department_lead', labels),
    PAGE_TITLE: `${labels.department} — Verwaltung`,
    PAGE_HEADING: `${labels.department} — Übersicht`,
    PAGE_DESCRIPTION: `${labels.department} erstellen und verwalten`,
    LOADING: `${labels.department} werden geladen...`,
    NO_DEPARTMENTS_FOUND: `Keine ${labels.department} gefunden`,
    SEARCH_PLACEHOLDER: `${labels.department} suchen...`,
    SEARCH_NO_RESULTS: `Keine ${labels.department} gefunden für`,
    LABEL_AREA: labels.area,
    STATUS_HINT: `Inaktive/Archivierte ${labels.department} werden nicht angezeigt`,
    TH_AREA: labels.area,
    TH_TEAMS: labels.team,
    LABEL_HALLS: labels.hall,
    LABEL_HALLS_DIRECT: `Zusätzliche ${labels.hall}`,
    /**
     * Phrase `automatisch zugeordnet (Quelle: X)` — avoids German case-conflict
     * when labels.area is the plural-only nominative (e.g. "Bereiche" / "Hallen").
     * Function so the ${areaName} can be interpolated at render time.
     */
    hallsInheritedInfo(count: number, areaName: string): string {
      return `${count.toString()} ${count === 1 ? labels.hall.replace(/n$/, '') : labels.hall} automatisch zugeordnet — Quelle: ${areaName}.`;
    },
    HALLS_INHERITED_HINT: `Änderungen erfolgen über die ${labels.area}-Verwaltung.`,
    HALLS_HINT_DIRECT: `Optional — nur relevant, wenn die Abteilung mehrere ${labels.area} nutzt.`,
    NO_DIRECT_HALLS_AVAILABLE: `Keine weiteren ${labels.hall} verfügbar.`,
    TH_HALLS: labels.hall,
    FILTER_ACTIVE_TITLE: `Aktive ${labels.department}`,
    FILTER_INACTIVE_TITLE: `Inaktive ${labels.department}`,
    FILTER_ARCHIVED_TITLE: `Archivierte ${labels.department}`,
    FILTER_ALL_TITLE: `Alle ${labels.department}`,
  };
}

/** Message type for component props */
export type DepartmentMessages = ReturnType<typeof createMessages>;

/** Default messages (used in non-Svelte contexts) */
export const MESSAGES = createMessages(DEFAULT_HIERARCHY_LABELS);

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  DEPARTMENTS: '/departments',
  department(id: number): string {
    return `/departments/${id}`;
  },
  departmentForceDelete(id: number): string {
    return `/departments/${id}?force=true`;
  },
  departmentHalls(id: number): string {
    return `/departments/${id}/halls`;
  },
  AREAS: '/areas',
  HALLS: '/halls',
  USERS_ADMIN: '/users?role=admin&isActive=1&position=department_lead',
  USERS_ROOT: '/users?role=root&isActive=1&position=department_lead',
} as const;

/**
 * Form default values.
 * Only cross-area halls are form-editable (directHallIds) — area-inherited
 * halls are not part of the mutable form state.
 */
export const FORM_DEFAULTS: {
  name: string;
  description: string;
  areaId: number | null;
  departmentLeadId: number | null;
  departmentDeputyLeadId: number | null;
  directHallIds: number[];
  isActive: FormIsActiveStatus;
} = {
  name: '',
  description: '',
  areaId: null,
  departmentLeadId: null,
  departmentDeputyLeadId: null,
  directHallIds: [],
  isActive: 1,
};
