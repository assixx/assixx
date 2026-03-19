// =============================================================================
// MANAGE HALLS - CONSTANTS
// =============================================================================

import {
  DEFAULT_HIERARCHY_LABELS,
  type HierarchyLabels,
} from '$lib/types/hierarchy-labels';

import type { FormIsActiveStatus } from './types';

export { STATUS_BADGE_CLASSES, STATUS_LABELS } from '@assixx/shared/constants';

/** Static messages that don't depend on hierarchy labels */
const STATIC_MESSAGES = {
  DELETE_CONFIRM_TITLE: 'Endgültig löschen?',
  DELETE_CONFIRM_WARNING: 'Diese Aktion kann nicht rückgängig gemacht werden!',
  moreResults: (count: number) => `${count} weitere Ergebnisse in Tabelle`,
  LABEL_NAME: 'Name',
  LABEL_DESCRIPTION: 'Beschreibung',
  LABEL_STATUS: 'Status',
  TH_NAME: 'Name',
  TH_DESCRIPTION: 'Beschreibung',
  TH_STATUS: 'Status',
  TH_ACTIONS: 'Aktionen',
  FILTER_ACTIVE: 'Aktive',
  FILTER_INACTIVE: 'Inaktive',
  FILTER_ARCHIVED: 'Archiviert',
  FILTER_ALL: 'Alle',
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
    PAGE_TITLE: `${labels.hall} — Verwaltung - Assixx`,
    PAGE_HEADING: `${labels.hall} — Übersicht`,
    PAGE_DESCRIPTION: `${labels.hall} erstellen und verwalten`,
    LOADING: `${labels.hall} werden geladen...`,
    NO_HALLS_FOUND: `Keine ${labels.hall} gefunden`,
    CREATE_FIRST_HALL: 'Erste erstellen',
    MODAL_TITLE_ADD: 'Hinzufügen',
    MODAL_TITLE_EDIT: 'Bearbeiten',
    DELETE_TITLE: 'Löschen',
    DELETE_CONFIRM_MESSAGE: 'Wird unwiderruflich aus dem System entfernt.',
    SEARCH_PLACEHOLDER: `${labels.hall} suchen...`,
    SEARCH_NO_RESULTS: `Keine ${labels.hall} gefunden für`,
    STATUS_HINT: `Inaktive/Archivierte ${labels.hall} werden nicht angezeigt`,
    BTN_ADD_HALL: 'Hinzufügen',
    LABEL_AREA: labels.area,
    NO_AREA: 'Nicht zugewiesen',
    TH_AREA: labels.area,
    TH_DEPARTMENTS: labels.department,
  };
}

/** Message type for component props */
export type HallMessages = ReturnType<typeof createMessages>;

/** Default messages (used in non-Svelte contexts) */
export const MESSAGES = createMessages(DEFAULT_HIERARCHY_LABELS);

export const API_ENDPOINTS = {
  HALLS: '/halls',
  hall: (id: number) => `/halls/${id}`,
  AREAS: '/areas',
} as const;

export const FORM_DEFAULTS: {
  name: string;
  description: string;
  areaId: number | null;
  isActive: FormIsActiveStatus;
} = {
  name: '',
  description: '',
  areaId: null,
  isActive: 1,
};
