// =============================================================================
// MANAGE MACHINES - CONSTANTS
// =============================================================================

import {
  DEFAULT_HIERARCHY_LABELS,
  type HierarchyLabels,
} from '$lib/types/hierarchy-labels';

import type { AssetStatus, AssetType } from './types';

/**
 * Asset type options with display labels
 */
export const MACHINE_TYPE_OPTIONS: { value: AssetType; label: string }[] = [
  { value: 'production', label: 'Produktion' },
  { value: 'packaging', label: 'Verpackung' },
  { value: 'quality_control', label: 'Qualitätskontrolle' },
  { value: 'logistics', label: 'Logistik' },
  { value: 'utility', label: 'Versorgung' },
  { value: 'other', label: 'Sonstiges' },
];

/**
 * Asset type display mapping
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
 * Asset status badge CSS class mapping
 */
export const STATUS_BADGE_CLASSES: Record<AssetStatus, string> = {
  operational: 'badge--success',
  maintenance: 'badge--warning',
  repair: 'badge--danger',
  standby: 'badge--info',
  decommissioned: 'badge--error',
};

/**
 * Asset status label mapping (German)
 */
export const STATUS_LABELS: Record<AssetStatus, string> = {
  operational: 'Betriebsbereit',
  maintenance: 'In Wartung',
  repair: 'In Reparatur',
  standby: 'Standby',
  decommissioned: 'Außer Betrieb',
};

/**
 * Status options for dropdown
 */
export const STATUS_OPTIONS: {
  value: AssetStatus;
  label: string;
  class: string;
}[] = [
  { value: 'operational', label: 'Betriebsbereit', class: 'badge--success' },
  { value: 'maintenance', label: 'In Wartung', class: 'badge--warning' },
  { value: 'repair', label: 'In Reparatur', class: 'badge--danger' },
  { value: 'standby', label: 'Standby', class: 'badge--info' },
  { value: 'decommissioned', label: 'Außer Betrieb', class: 'badge--error' },
];

/** Static messages that don't depend on hierarchy labels */
const STATIC_MESSAGES = {
  // Modal titles (neutralized per A4)
  MODAL_ADD_TITLE: 'Hinzufügen',
  MODAL_EDIT_TITLE: 'Bearbeiten',
  MODAL_DELETE_TITLE: 'Löschen',
  MODAL_DELETE_CONFIRM_TITLE: 'Endgültig löschen?',

  // Labels (entity-neutral)
  LABEL_NAME: 'Name',
  LABEL_MODEL: 'Modell',
  LABEL_MANUFACTURER: 'Hersteller',
  LABEL_SERIAL: 'Seriennummer',
  LABEL_TYPE: 'Typ',
  LABEL_STATUS: 'Status',
  LABEL_HOURS: 'Betriebsstunden',
  LABEL_NEXT_MAINTENANCE: 'Nächste Wartung',

  // Dropdown placeholders (entity-neutral)
  PLACEHOLDER_TYPE: 'Typ wählen',

  // Buttons
  BTN_SAVE: 'Speichern',
  BTN_CANCEL: 'Abbrechen',
  BTN_DELETE: 'Löschen',
  BTN_DELETE_FINAL: 'Endgültig löschen',
  BTN_RETRY: 'Erneut versuchen',
  BTN_ADD: 'Hinzufügen',

  // Status filter buttons
  FILTER_ALL: 'Alle',
  FILTER_OPERATIONAL: 'Betriebsbereit',
  FILTER_MAINTENANCE: 'Wartung',
  FILTER_REPAIR: 'Reparatur',
  FILTER_STANDBY: 'Stillstand',
  FILTER_CLEANING: 'Reinigung',
  FILTER_OTHER: 'Sonstiges',

  // Search
  SEARCH_PLACEHOLDER: 'Name, Modell, Hersteller...',

  // Validation (neutralized)
  ERROR_NAME_REQUIRED: 'Bitte geben Sie einen Namen ein',
  ERROR_SAVE_FAILED: 'Fehler beim Speichern',
  ERROR_DELETE_FAILED: 'Fehler beim Löschen',
  ERROR_LOAD_FAILED: 'Fehler beim Laden',
  ERROR_NETWORK: 'Netzwerkfehler beim Laden',

  // Delete confirmation (neutralized)
  DELETE_CONFIRM_MESSAGE: 'Möchten Sie diesen Eintrag wirklich löschen?',
  DELETE_FINAL_WARNING:
    'ACHTUNG: Diese Aktion kann nicht rückgängig gemacht werden!',
  DELETE_FINAL_INFO: 'Der Eintrag wird unwiderruflich aus dem System entfernt.',

  // Success messages (neutralized)
  SUCCESS_CREATED: 'Erfolgreich erstellt',
  SUCCESS_UPDATED: 'Erfolgreich aktualisiert',
  SUCCESS_DELETED: 'Erfolgreich gelöscht',

  // Table headers (entity-neutral)
  TH_ID: 'ID',
  TH_NAME: 'Name',
  TH_MODEL: 'Modell',
  TH_MANUFACTURER: 'Hersteller',
  TH_STATUS: 'Status',
  TH_HOURS: 'Betriebsstunden',
  TH_MAINTENANCE: 'Nächste Wartung',
  TH_NEXT_ABSENCE: 'Nächste Abwesenheit',
  TH_ACTIONS: 'Aktionen',
};

/**
 * UI Messages — factory with dynamic hierarchy labels.
 * Entity-specific strings use labels, compound words are neutralized (A4).
 */
export function createMessages(labels: HierarchyLabels) {
  return {
    ...STATIC_MESSAGES,

    // Page
    PAGE_TITLE: `${labels.asset} verwalten - Assixx`,
    PAGE_HEADING: `${labels.asset} — Übersicht`,
    PAGE_DESCRIPTION: `${labels.asset} verwalten`,

    // Labels (FK-references)
    LABEL_DEPARTMENT: labels.department,
    LABEL_AREA: labels.area,
    LABEL_TEAMS: labels.team,

    // Dropdown placeholders (dynamic)
    PLACEHOLDER_DEPARTMENT: `Keine ${labels.department}`,
    PLACEHOLDER_AREA: `Keine ${labels.area}`,
    PLACEHOLDER_TEAMS: `Keine ${labels.team} zugewiesen`,
    PLACEHOLDER_SELECT_AREA_FIRST: `Bitte zuerst ${labels.area} wählen`,
    PLACEHOLDER_SELECT_DEPT_FIRST: `Bitte zuerst ${labels.department} wählen`,
    PLACEHOLDER_NO_TEAMS_AVAILABLE: `Keine ${labels.team} verfügbar`,

    // Search
    SEARCH_NO_RESULTS: `Keine ${labels.asset} gefunden`,

    // Empty state
    EMPTY_TITLE: `Keine ${labels.asset} gefunden`,
    EMPTY_DESCRIPTION: 'Erstellen Sie den ersten Eintrag',
    EMPTY_OPERATIONAL: `Keine betriebsbereiten ${labels.asset}`,
    EMPTY_MAINTENANCE: `Keine ${labels.asset} in Wartung`,
    EMPTY_REPAIR: `Keine ${labels.asset} in Reparatur`,
    EMPTY_STANDBY: `Keine ${labels.asset} im Stillstand`,
    EMPTY_CLEANING: `Keine ${labels.asset} in Reinigung`,
    EMPTY_OTHER: `Keine ${labels.asset} unter Sonstiges`,
    EMPTY_FILTER_DESC: `Es gibt aktuell keine ${labels.asset} in dieser Kategorie.`,

    // Loading
    LOADING: `${labels.asset} werden geladen...`,

    // Table headers (FK-references)
    TH_AREA: labels.area,
    TH_DEPARTMENT: labels.department,
    TH_TEAMS: labels.team,

    // Teams display
    teamsSelected: (count: number) =>
      count <= 2 ? '' : `${count} ${labels.team} ausgewählt`,
  };
}

/** Message type for component props */
export type AssetMessages = ReturnType<typeof createMessages>;

/** Default messages (used in non-Svelte contexts) */
export const MESSAGES = createMessages(DEFAULT_HIERARCHY_LABELS);

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
  assetType: '' as string,
  status: 'operational' as AssetStatus,
  operatingHours: null as number | null,
  nextMaintenance: '',
};
