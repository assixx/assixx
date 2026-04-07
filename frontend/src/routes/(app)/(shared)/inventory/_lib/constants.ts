// =============================================================================
// INVENTORY - CONSTANTS
// =============================================================================

import type { InventoryItemStatus } from './types';

export { STATUS_BADGE_CLASSES, STATUS_LABELS } from '@assixx/shared/constants';

// ── Item Status Labels (German) ────────────────────────────────

export const ITEM_STATUS_LABELS: Record<InventoryItemStatus, string> = {
  operational: 'In Betrieb',
  defective: 'Defekt',
  repair: 'In Reparatur',
  maintenance: 'In Wartung',
  decommissioned: 'Stillgelegt',
  removed: 'Entfernt',
  stored: 'Eingelagert',
};

export const ITEM_STATUS_BADGE_CLASSES: Record<InventoryItemStatus, string> = {
  operational: 'badge--success',
  defective: 'badge--error',
  repair: 'badge--warning',
  maintenance: 'badge--info',
  decommissioned: 'badge--secondary',
  removed: 'badge--secondary',
  stored: 'badge--info',
};

export const ITEM_STATUS_ICONS: Record<InventoryItemStatus, string> = {
  operational: 'fa-check-circle',
  defective: 'fa-exclamation-triangle',
  repair: 'fa-wrench',
  maintenance: 'fa-tools',
  decommissioned: 'fa-ban',
  removed: 'fa-trash-alt',
  stored: 'fa-box',
};

// ── Code Digits Dropdown Options ──────────────────────────────

export const CODE_DIGIT_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 2, label: '2 (01-99)' },
  { value: 3, label: '3 (001-999)' },
  { value: 4, label: '4 (0001-9999)' },
  { value: 5, label: '5 (00001-99999)' },
];

// ── List Icon Picker ──────────────────────────────────────────

export const DEFAULT_LIST_ICON = 'fa-box';

export const LIST_ICON_OPTIONS: readonly { icon: string; label: string }[] = [
  { icon: 'fa-box', label: 'Allgemein' },
  { icon: 'fa-truck', label: 'Fahrzeuge' },
  { icon: 'fa-toolbox', label: 'Werkzeug' },
  { icon: 'fa-screwdriver-wrench', label: 'Geräte' },
  { icon: 'fa-sign-hanging', label: 'Kräne' },
  { icon: 'fa-stairs', label: 'Steigtechnik' },
  { icon: 'fa-door-closed', label: 'Tore' },
  { icon: 'fa-warehouse', label: 'Regale' },
  { icon: 'fa-hard-hat', label: 'Schutzausrüstung' },
  { icon: 'fa-fire-extinguisher', label: 'Brandschutz' },
  { icon: 'fa-gauge-high', label: 'Messgeräte' },
];

// ── Messages ───────────────────────────────────────────────────

export const MESSAGES = {
  PAGE_TITLE: 'Inventar',
  PAGE_DESCRIPTION: 'Betriebsmittel-Inventarlisten verwalten',
  LOADING: 'Listen werden geladen...',
  NO_LISTS_FOUND: 'Keine Inventarlisten gefunden',
  CREATE_FIRST_LIST: 'Erstellen Sie die erste Inventarliste',
  BTN_ADD: 'Neue Liste',
  MODAL_TITLE_ADD: 'Neue Inventarliste',
  MODAL_TITLE_EDIT: 'Inventarliste bearbeiten',
  SUCCESS_CREATED: 'Inventarliste erfolgreich erstellt',
  SUCCESS_UPDATED: 'Inventarliste erfolgreich aktualisiert',
  SUCCESS_DELETED: 'Inventarliste erfolgreich gelöscht',
  ERROR_SAVING: 'Fehler beim Speichern der Inventarliste',
  ERROR_DELETING: 'Fehler beim Löschen der Inventarliste',
  DELETE_CONFIRM_TITLE: 'Inventarliste löschen?',
  DELETE_CONFIRM_MESSAGE:
    'Alle zugehörigen Gegenstände, Fotos und Custom Fields werden ebenfalls gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.',
  SEARCH_PLACEHOLDER: 'Listen durchsuchen...',
  SEARCH_NO_RESULTS: 'Keine Listen gefunden für',
  FILTER_ACTIVE_TITLE: 'Aktive Listen',
  FILTER_INACTIVE_TITLE: 'Inaktive Listen',
  FILTER_ARCHIVED_TITLE: 'Archivierte Listen',
  FILTER_ALL_TITLE: 'Alle Listen',
  ITEMS_SINGULAR: 'Gegenstand',
  ITEMS_PLURAL: 'Gegenstände',
  NO_CATEGORY: 'Keine Kategorie',
  LABEL_TITLE: 'Titel',
  LABEL_DESCRIPTION: 'Beschreibung',
  LABEL_CATEGORY: 'Kategorie',
  LABEL_CODE_PREFIX: 'Code-Prefix',
  LABEL_CODE_SEPARATOR: 'Trennzeichen',
  LABEL_CODE_DIGITS: 'Ziffernanzahl',
  LABEL_ICON: 'Icon',
  HINT_CODE_PREFIX: '2-5 Großbuchstaben, z.B. KRN',
  HINT_CODE_EXAMPLE: 'Beispiel-Code',
} as const;

// ── API Endpoints ──────────────────────────────────────────────

export const API_ENDPOINTS = {
  LISTS: '/inventory/lists',
  list: (id: string) => `/inventory/lists/${id}`,
  CATEGORIES: '/inventory/categories',
  ITEMS: '/inventory/items',
  item: (uuid: string) => `/inventory/items/${uuid}`,
  listFields: (listId: string) => `/inventory/lists/${listId}/fields`,
  field: (fieldId: string) => `/inventory/fields/${fieldId}`,
  itemPhotos: (uuid: string) => `/inventory/items/${uuid}/photos`,
} as const;

// ── Form Defaults ──────────────────────────────────────────────

export const FORM_DEFAULTS = {
  title: '',
  description: '',
  category: '',
  codePrefix: '',
  codeSeparator: '-',
  codeDigits: 3,
  icon: DEFAULT_LIST_ICON,
  isActive: 1 as const,
};
