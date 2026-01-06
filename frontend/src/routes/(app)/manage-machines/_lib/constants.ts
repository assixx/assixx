// =============================================================================
// MANAGE MACHINES - CONSTANTS
// =============================================================================

import type { MachineStatus, MachineType } from './types';

/**
 * Machine type options with display labels
 */
export const MACHINE_TYPE_OPTIONS: { value: MachineType; label: string }[] = [
  { value: 'production', label: 'Produktion' },
  { value: 'packaging', label: 'Verpackung' },
  { value: 'quality_control', label: 'Qualitätskontrolle' },
  { value: 'logistics', label: 'Logistik' },
  { value: 'utility', label: 'Versorgung' },
  { value: 'other', label: 'Sonstiges' },
];

/**
 * Machine type display mapping
 */
export const MACHINE_TYPE_LABELS: Record<string, string> = {
  production: 'Produktion',
  packaging: 'Verpackung',
  quality_control: 'Qualitätskontrolle',
  logistics: 'Logistik',
  utility: 'Versorgung',
  other: 'Sonstiges',
};

/**
 * Machine status badge CSS class mapping
 */
export const STATUS_BADGE_CLASSES: Record<MachineStatus, string> = {
  operational: 'badge--success',
  maintenance: 'badge--warning',
  repair: 'badge--danger',
  standby: 'badge--info',
  decommissioned: 'badge--error',
};

/**
 * Machine status label mapping (German)
 */
export const STATUS_LABELS: Record<MachineStatus, string> = {
  operational: 'Betriebsbereit',
  maintenance: 'In Wartung',
  repair: 'In Reparatur',
  standby: 'Standby',
  decommissioned: 'Außer Betrieb',
};

/**
 * Status options for dropdown
 */
export const STATUS_OPTIONS: { value: MachineStatus; label: string; class: string }[] = [
  { value: 'operational', label: 'Betriebsbereit', class: 'badge--success' },
  { value: 'maintenance', label: 'In Wartung', class: 'badge--warning' },
  { value: 'repair', label: 'In Reparatur', class: 'badge--danger' },
  { value: 'standby', label: 'Standby', class: 'badge--info' },
  { value: 'decommissioned', label: 'Außer Betrieb', class: 'badge--error' },
];

/**
 * UI Messages (German) - Prepared for i18n
 */
export const MESSAGES = {
  // Page titles
  PAGE_TITLE: 'Maschinen verwalten - Assixx',
  PAGE_HEADING: 'Maschinenübersicht',
  PAGE_DESCRIPTION: 'Alle Maschinen verwalten und bearbeiten',

  // Modal titles
  MODAL_ADD_TITLE: 'Neue Maschine',
  MODAL_EDIT_TITLE: 'Maschine bearbeiten',
  MODAL_DELETE_TITLE: 'Maschine löschen',
  MODAL_DELETE_CONFIRM_TITLE: 'Endgültig löschen?',

  // Labels
  LABEL_NAME: 'Name',
  LABEL_MODEL: 'Modell',
  LABEL_MANUFACTURER: 'Hersteller',
  LABEL_SERIAL: 'Seriennummer',
  LABEL_DEPARTMENT: 'Abteilung',
  LABEL_AREA: 'Bereich',
  LABEL_TEAMS: 'Teams',
  LABEL_TYPE: 'Maschinentyp',
  LABEL_STATUS: 'Status',
  LABEL_HOURS: 'Betriebsstunden',
  LABEL_NEXT_MAINTENANCE: 'Nächste Wartung',

  // Dropdown placeholders
  PLACEHOLDER_DEPARTMENT: 'Keine Abteilung',
  PLACEHOLDER_AREA: 'Kein Bereich',
  PLACEHOLDER_TYPE: 'Maschinentyp wählen',
  PLACEHOLDER_TEAMS: 'Keine Teams zugewiesen',
  PLACEHOLDER_SELECT_AREA_FIRST: 'Bitte zuerst Bereich wählen',
  PLACEHOLDER_SELECT_DEPT_FIRST: 'Bitte zuerst Abteilung wählen',
  PLACEHOLDER_NO_TEAMS_AVAILABLE: 'Keine Teams verfügbar',

  // Buttons
  BTN_SAVE: 'Speichern',
  BTN_CANCEL: 'Abbrechen',
  BTN_DELETE: 'Löschen',
  BTN_DELETE_FINAL: 'Endgültig löschen',
  BTN_RETRY: 'Erneut versuchen',
  BTN_ADD_MACHINE: 'Maschine hinzufügen',

  // Status filter buttons
  FILTER_ALL: 'Alle',
  FILTER_OPERATIONAL: 'Betriebsbereit',
  FILTER_MAINTENANCE: 'In Wartung',
  FILTER_REPAIR: 'In Reparatur',

  // Search
  SEARCH_PLACEHOLDER: 'Name, Modell, Hersteller...',
  SEARCH_NO_RESULTS: 'Keine Maschinen gefunden',

  // Empty state
  EMPTY_TITLE: 'Keine Maschinen gefunden',
  EMPTY_DESCRIPTION: 'Fügen Sie Ihre erste Maschine hinzu, um die Verwaltung zu starten.',

  // Empty state by filter
  EMPTY_OPERATIONAL: 'Keine betriebsbereiten Maschinen',
  EMPTY_MAINTENANCE: 'Keine Maschinen in Wartung',
  EMPTY_REPAIR: 'Keine Maschinen in Reparatur',
  EMPTY_FILTER_DESC: 'Es gibt aktuell keine Maschinen in dieser Kategorie.',

  // Loading
  LOADING_MACHINES: 'Maschinen werden geladen...',

  // Validation errors
  ERROR_NAME_REQUIRED: 'Bitte geben Sie einen Maschinennamen ein',
  ERROR_SAVE_FAILED: 'Fehler beim Speichern der Maschine',
  ERROR_DELETE_FAILED: 'Fehler beim Löschen der Maschine',
  ERROR_LOAD_FAILED: 'Fehler beim Laden der Maschinen',
  ERROR_NETWORK: 'Netzwerkfehler beim Laden der Maschinen',

  // Delete confirmation
  DELETE_CONFIRM_MESSAGE: 'Möchten Sie diese Maschine wirklich löschen?',
  DELETE_FINAL_WARNING: 'ACHTUNG: Diese Aktion kann nicht rückgängig gemacht werden!',
  DELETE_FINAL_INFO: 'Die Maschine wird unwiderruflich aus dem System entfernt.',

  // Success messages
  SUCCESS_CREATED: 'Maschine erfolgreich erstellt',
  SUCCESS_UPDATED: 'Maschine erfolgreich aktualisiert',
  SUCCESS_DELETED: 'Maschine gelöscht',

  // Table headers
  TH_ID: 'ID',
  TH_NAME: 'Name',
  TH_MODEL: 'Modell',
  TH_MANUFACTURER: 'Hersteller',
  TH_AREA: 'Bereich',
  TH_DEPARTMENT: 'Abteilung',
  TH_TEAMS: 'Teams',
  TH_STATUS: 'Status',
  TH_HOURS: 'Betriebsstunden',
  TH_MAINTENANCE: 'Nächste Wartung',
  TH_ACTIONS: 'Aktionen',

  // Teams display
  TEAMS_SELECTED: (count: number) => (count <= 2 ? '' : `${count} Teams ausgewählt`),
} as const;

/**
 * Default values for form reset
 */
export const FORM_DEFAULTS = {
  name: '',
  model: '',
  manufacturer: '',
  serialNumber: '',
  departmentId: null as number | null,
  areaId: null as number | null,
  teamIds: [] as number[],
  machineType: '' as string,
  status: 'operational' as MachineStatus,
  operatingHours: null as number | null,
  nextMaintenance: '',
};
