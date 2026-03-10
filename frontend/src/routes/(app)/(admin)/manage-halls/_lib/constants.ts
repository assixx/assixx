// =============================================================================
// MANAGE HALLS - CONSTANTS
// =============================================================================

import type { FormIsActiveStatus } from './types';

export { STATUS_BADGE_CLASSES, STATUS_LABELS } from '@assixx/shared/constants';

export const MESSAGES = {
  PAGE_TITLE: 'Hallenverwaltung - Assixx',
  PAGE_HEADING: 'Hallenübersicht',
  PAGE_DESCRIPTION: 'Hallen erstellen und verwalten',

  LOADING: 'Hallen werden geladen...',

  NO_HALLS_FOUND: 'Keine Hallen gefunden',
  CREATE_FIRST_HALL: 'Erstellen Sie Ihre erste Halle',

  MODAL_TITLE_ADD: 'Neue Halle',
  MODAL_TITLE_EDIT: 'Halle bearbeiten',

  DELETE_TITLE: 'Halle löschen',
  DELETE_CONFIRM_TITLE: 'Endgültig löschen?',
  DELETE_CONFIRM_WARNING: 'Diese Aktion kann nicht rückgängig gemacht werden!',
  DELETE_CONFIRM_MESSAGE:
    'Die Halle wird unwiderruflich aus dem System entfernt.',

  SEARCH_PLACEHOLDER: 'Hallen suchen...',
  SEARCH_NO_RESULTS: 'Keine Hallen gefunden für',
  moreResults(count: number): string {
    return `${count} weitere Ergebnisse in Tabelle`;
  },

  LABEL_NAME: 'Name',
  LABEL_DESCRIPTION: 'Beschreibung',
  LABEL_AREA: 'Bereich (Area)',
  LABEL_STATUS: 'Status',

  NO_AREA: 'Kein Bereich',

  STATUS_HINT: 'Inaktive/Archivierte Hallen werden nicht angezeigt',

  TH_NAME: 'Name',
  TH_DESCRIPTION: 'Beschreibung',
  TH_STATUS: 'Status',
  TH_AREA: 'Bereich',
  TH_ACTIONS: 'Aktionen',

  FILTER_ACTIVE: 'Aktive',
  FILTER_INACTIVE: 'Inaktive',
  FILTER_ARCHIVED: 'Archiviert',
  FILTER_ALL: 'Alle',

  BTN_ADD_HALL: 'Halle hinzufügen',
  BTN_SAVE: 'Speichern',
  BTN_CANCEL: 'Abbrechen',
  BTN_DELETE: 'Löschen',
  BTN_DELETE_FINAL: 'Endgültig löschen',
  BTN_RETRY: 'Erneut versuchen',

  VALIDATION_NAME_REQUIRED: 'Bitte geben Sie einen Namen ein',

  ERROR_LOADING: 'Ein Fehler ist aufgetreten',
  ERROR_SAVING: 'Fehler beim Speichern',
  ERROR_DELETING: 'Fehler beim Löschen',
} as const;

export const API_ENDPOINTS = {
  HALLS: '/halls',
  hall(id: number): string {
    return `/halls/${id}`;
  },
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
