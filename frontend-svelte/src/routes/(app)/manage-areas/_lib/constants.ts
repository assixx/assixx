// =============================================================================
// MANAGE AREAS - CONSTANTS
// =============================================================================

import type { IsActiveStatus, AreaType, TypeOption, FormIsActiveStatus } from './types';

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
 * UI Messages for i18n preparation
 */
export const MESSAGES = {
  // Page
  PAGE_TITLE: 'Bereichsübersicht',
  PAGE_DESCRIPTION: 'Bereiche und Standorte verwalten',

  // Loading
  LOADING: 'Bereiche werden geladen...',

  // Empty states
  NO_AREAS_FOUND: 'Keine Bereiche gefunden',
  CREATE_FIRST_AREA: 'Erstellen Sie Ihren ersten Bereich',

  // Modal titles
  MODAL_TITLE_ADD: 'Neuer Bereich',
  MODAL_TITLE_EDIT: 'Bereich bearbeiten',

  // Delete
  DELETE_TITLE: 'Bereich löschen',
  DELETE_CONFIRM_TITLE: 'Endgültig löschen?',
  DELETE_CONFIRM_WARNING: 'Diese Aktion kann nicht rückgängig gemacht werden!',
  DELETE_CONFIRM_MESSAGE: 'Der Bereich wird unwiderruflich aus dem System entfernt.',

  // Force delete
  FORCE_DELETE_TITLE: 'Bereich hat Abhängigkeiten',
  FORCE_DELETE_DEFAULT_MESSAGE:
    'Dieser Bereich wird von anderen Elementen verwendet. Möchten Sie den Bereich trotzdem löschen? Alle Zuordnungen werden entfernt.',

  // Search
  SEARCH_PLACEHOLDER: 'Bereiche suchen...',
  SEARCH_NO_RESULTS: 'Keine Bereiche gefunden für',
  MORE_RESULTS: (count: number) => `${count} weitere Ergebnisse in Tabelle`,

  // Form labels
  LABEL_NAME: 'Name',
  LABEL_DESCRIPTION: 'Beschreibung',
  LABEL_AREA_LEAD: 'Bereichsleiter',
  LABEL_TYPE: 'Typ',
  LABEL_CAPACITY: 'Kapazität',
  LABEL_ADDRESS: 'Adresse',
  LABEL_DEPARTMENTS: 'Abteilungen zuweisen',
  LABEL_STATUS: 'Status',

  // Placeholders
  PLACEHOLDER_NAME: 'Bereichsname eingeben',
  PLACEHOLDER_DESCRIPTION: 'Optionale Beschreibung',
  PLACEHOLDER_CAPACITY: 'z.B. 50',
  PLACEHOLDER_ADDRESS: 'Straße, PLZ, Ort',

  // Area lead
  NO_AREA_LEAD: 'Kein Bereichsleiter',
  AREA_LEAD_HINT: 'Nur Administratoren können als Bereichsleiter zugewiesen werden.',

  // Departments
  DEPARTMENTS_HINT:
    'Strg/Cmd + Klick für Mehrfachauswahl. Ausgewählte Abteilungen werden diesem Bereich zugeordnet.',
  NO_DEPARTMENTS: 'Keine',
  ONE_DEPARTMENT: '1 Abteilung',
  MULTIPLE_DEPARTMENTS: (count: number) => `${count} Abteilungen`,

  // Status
  STATUS_HINT: 'Inaktive/Archivierte Bereiche werden nicht angezeigt',

  // Buttons
  BTN_ADD_AREA: 'Bereich hinzufügen',
  BTN_SAVE: 'Speichern',
  BTN_CANCEL: 'Abbrechen',
  BTN_DELETE: 'Löschen',
  BTN_DELETE_FINAL: 'Endgültig löschen',

  // Filter labels
  FILTER_ACTIVE: 'Aktive',
  FILTER_INACTIVE: 'Inaktive',
  FILTER_ARCHIVED: 'Archiviert',
  FILTER_ALL: 'Alle',

  // Table headers
  TH_NAME: 'Name',
  TH_DESCRIPTION: 'Beschreibung',
  TH_AREA_LEAD: 'Bereichsleiter',
  TH_TYPE: 'Typ',
  TH_CAPACITY: 'Kapazität',
  TH_ADDRESS: 'Adresse',
  TH_DEPARTMENTS: 'Abteilungen',
  TH_STATUS: 'Status',
  TH_ACTIONS: 'Aktionen',

  // API errors
  ERROR_LOADING: 'Fehler beim Laden der Bereiche',
  ERROR_SAVING: 'Fehler beim Speichern',
  ERROR_DELETING: 'Fehler beim Löschen',
} as const;

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  AREAS: '/areas',
  AREA: (id: number) => `/areas/${id}`,
  AREA_FORCE_DELETE: (id: number) => `/areas/${id}?force=true`,
  USERS_ADMIN: '/users?role=admin',
  USERS_ROOT: '/users?role=root',
  DEPARTMENTS: '/departments',
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
  isActive: FormIsActiveStatus;
} = {
  name: '',
  description: '',
  areaLeadId: null,
  type: 'other',
  capacity: null,
  address: '',
  departmentIds: [],
  isActive: 1,
};
