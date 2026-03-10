// =============================================================================
// MANAGE AREAS - CONSTANTS
// =============================================================================

import {
  DEFAULT_HIERARCHY_LABELS,
  type HierarchyLabels,
} from '$lib/types/hierarchy-labels';

import type { AreaType, TypeOption, FormIsActiveStatus } from './types';

export { STATUS_BADGE_CLASSES, STATUS_LABELS } from '@assixx/shared/constants';

/**
 * Area type labels for display
 */
export const TYPE_LABELS: Record<AreaType, string> = {
  building: 'Gebäude',
  warehouse: 'Lager',
  office: 'Büro',
  production: 'Produktion',
  outdoor: 'Außenbereich',
  other: 'Sonstiges',
};

/**
 * Area type options for dropdown
 */
export const TYPE_OPTIONS: TypeOption[] = [
  { value: 'building', label: 'Gebäude' },
  { value: 'warehouse', label: 'Lager' },
  { value: 'office', label: 'Büro' },
  { value: 'production', label: 'Produktion' },
  { value: 'outdoor', label: 'Außenbereich' },
  { value: 'other', label: 'Sonstiges' },
];

/** Static messages that don't depend on hierarchy labels */
const STATIC_MESSAGES = {
  CREATE_FIRST_AREA: 'Erstellen Sie den ersten Eintrag',
  MODAL_TITLE_ADD: 'Hinzufügen',
  MODAL_TITLE_EDIT: 'Bearbeiten',
  DELETE_TITLE: 'Löschen',
  DELETE_CONFIRM_TITLE: 'Endgültig löschen?',
  DELETE_CONFIRM_WARNING: 'Diese Aktion kann nicht rückgängig gemacht werden!',
  DELETE_CONFIRM_MESSAGE:
    'Der Eintrag wird unwiderruflich aus dem System entfernt.',
  FORCE_DELETE_TITLE: 'Abhängigkeiten vorhanden',
  FORCE_DELETE_DEFAULT_MESSAGE:
    'Dieser Eintrag wird von anderen Elementen verwendet. Möchten Sie ihn trotzdem löschen? Alle Zuordnungen werden entfernt.',
  moreResults: (count: number) => `${count} weitere Ergebnisse in Tabelle`,
  LABEL_NAME: 'Name',
  LABEL_DESCRIPTION: 'Beschreibung',
  LABEL_AREA_LEAD: 'Leiter',
  LABEL_TYPE: 'Typ',
  LABEL_CAPACITY: 'Kapazität',
  LABEL_ADDRESS: 'Adresse',
  LABEL_HALLS: 'Hallen zuweisen',
  LABEL_STATUS: 'Status',
  PLACEHOLDER_NAME: 'Name eingeben',
  PLACEHOLDER_DESCRIPTION: 'Optionale Beschreibung',
  PLACEHOLDER_CAPACITY: 'z.B. 50',
  PLACEHOLDER_ADDRESS: 'Straße, PLZ, Ort',
  NO_AREA_LEAD: 'Kein Leiter',
  AREA_LEAD_HINT: 'Nur Administratoren können als Leiter zugewiesen werden.',
  HALLS_HINT:
    'Strg/Cmd + Klick für Mehrfachauswahl. Ausgewählte Hallen werden zugeordnet.',
  NO_DEPARTMENTS: 'Keine',
  NO_HALLS: 'Keine',
  ONE_HALL: '1 Halle',
  multipleHalls: (count: number) => `${count} Hallen`,
  BTN_ADD_AREA: 'Hinzufügen',
  BTN_SAVE: 'Speichern',
  BTN_CANCEL: 'Abbrechen',
  BTN_DELETE: 'Löschen',
  BTN_DELETE_FINAL: 'Endgültig löschen',
  FILTER_ACTIVE: 'Aktive',
  FILTER_INACTIVE: 'Inaktive',
  FILTER_ARCHIVED: 'Archiviert',
  FILTER_ALL: 'Alle',
  TH_NAME: 'Name',
  TH_DESCRIPTION: 'Beschreibung',
  TH_AREA_LEAD: 'Leiter',
  TH_TYPE: 'Typ',
  TH_CAPACITY: 'Kapazität',
  TH_HALLS: 'Hallen',
  TH_STATUS: 'Status',
  TH_ACTIONS: 'Aktionen',
  ERROR_LOADING: 'Fehler beim Laden',
  ERROR_SAVING: 'Fehler beim Speichern',
  ERROR_DELETING: 'Fehler beim Löschen',
  SUCCESS_CREATED: 'Erfolgreich erstellt',
  SUCCESS_UPDATED: 'Erfolgreich aktualisiert',
  SUCCESS_DELETED: 'Erfolgreich gelöscht',
};

/**
 * UI Messages — factory with dynamic hierarchy labels.
 * Entity-specific strings use labels, compound words are neutralized (A4).
 */
export function createMessages(labels: HierarchyLabels) {
  return {
    ...STATIC_MESSAGES,
    PAGE_TITLE: `${labels.area} — Übersicht`,
    PAGE_DESCRIPTION: `${labels.area} verwalten`,
    LOADING: `${labels.area} werden geladen...`,
    NO_AREAS_FOUND: `Keine ${labels.area} gefunden`,
    SEARCH_PLACEHOLDER: `${labels.area} suchen...`,
    SEARCH_NO_RESULTS: `Keine ${labels.area} gefunden für`,
    LABEL_DEPARTMENTS: `${labels.department} zuweisen`,
    DEPARTMENTS_HINT: `Strg/Cmd + Klick für Mehrfachauswahl. Ausgewählte ${labels.department} werden zugeordnet.`,
    multipleDepartments: (count: number) => `${count} ${labels.department}`,
    STATUS_HINT: `Inaktive/Archivierte ${labels.area} werden nicht angezeigt`,
    FILTER_ACTIVE_TITLE: `Aktive ${labels.area}`,
    FILTER_INACTIVE_TITLE: `Inaktive ${labels.area}`,
    FILTER_ARCHIVED_TITLE: `Archivierte ${labels.area}`,
    FILTER_ALL_TITLE: `Alle ${labels.area}`,
    TH_DEPARTMENTS: labels.department,
  };
}

/** Message type for component props */
export type AreaMessages = ReturnType<typeof createMessages>;

/** Default messages (used in non-Svelte contexts) */
export const MESSAGES = createMessages(DEFAULT_HIERARCHY_LABELS);

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  AREAS: '/areas',
  area: (id: number) => `/areas/${id}`,
  areaForceDelete: (id: number) => `/areas/${id}?force=true`,
  USERS_ADMIN: '/users?role=admin',
  USERS_ROOT: '/users?role=root',
  DEPARTMENTS: '/departments',
  HALLS: '/halls',
  areaHalls: (id: number) => `/areas/${id}/halls`,
  areaDepartments: (id: number) => `/areas/${id}/departments`,
} as const;

/**
 * Form default values
 */
export const FORM_DEFAULTS: {
  name: string;
  description: string;
  areaLeadId: number | null;
  type: AreaType;
  capacity: number | null;
  address: string;
  departmentIds: number[];
  hallIds: number[];
  isActive: FormIsActiveStatus;
} = {
  name: '',
  description: '',
  areaLeadId: null,
  type: 'other',
  capacity: null,
  address: '',
  departmentIds: [],
  hallIds: [],
  isActive: 1,
};
