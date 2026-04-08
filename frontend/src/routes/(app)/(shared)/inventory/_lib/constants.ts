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

// ── Tag Defaults ──────────────────────────────────────────────

/** Fallback icon for tags created inline (no explicit icon picker) */
export const DEFAULT_TAG_ICON = 'fa-tag';

/** Hard cap matching backend MAX_TAGS_PER_LIST */
export const MAX_TAGS_PER_LIST = 10;

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
  LABEL_TITLE: 'Titel',
  LABEL_DESCRIPTION: 'Beschreibung',
  LABEL_TAGS: 'Tags',
  LABEL_CODE_PREFIX: 'Code-Prefix',
  LABEL_CODE_SEPARATOR: 'Trennzeichen',
  LABEL_CODE_DIGITS: 'Ziffernanzahl',
  LABEL_ICON: 'Icon',
  HINT_CODE_PREFIX: '2-5 Großbuchstaben, z.B. KRN',
  HINT_CODE_EXAMPLE: 'Beispiel-Code',
  TAGS_PLACEHOLDER: 'Tag suchen oder neu erstellen…',
  TAGS_NO_TAGS: 'Noch keine Tags angelegt',
  TAGS_CREATE_HINT: 'Enter zum Erstellen',
  TAGS_MAX_REACHED: `Maximal ${String(10)} Tags pro Liste`,
  TAGS_MANAGE_BTN: 'Tags verwalten',
  TAGS_MANAGE_TITLE: 'Tags verwalten',
  TAGS_FILTER_LABEL: 'Nach Tags filtern',
  TAGS_FILTER_ALL: 'Alle Tags',
  TAGS_FILTER_NONE: 'Filter zurücksetzen',
  TAG_DELETE_CONFIRM: 'Tag wirklich löschen? Er wird aus allen Listen entfernt.',
  TAG_RENAME_DUPLICATE: 'Ein Tag mit diesem Namen existiert bereits',
  TAG_SUCCESS_CREATED: 'Tag erstellt',
  TAG_SUCCESS_UPDATED: 'Tag aktualisiert',
  TAG_SUCCESS_DELETED: 'Tag gelöscht',
  TAG_ERROR_SAVING: 'Fehler beim Speichern des Tags',
  TAG_ERROR_DELETING: 'Fehler beim Löschen des Tags',
} as const;

// ── API Endpoints ──────────────────────────────────────────────

export const API_ENDPOINTS = {
  LISTS: '/inventory/lists',
  list: (id: string) => `/inventory/lists/${id}`,
  TAGS: '/inventory/tags',
  tag: (id: string) => `/inventory/tags/${id}`,
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
  codePrefix: '',
  codeSeparator: '-',
  codeDigits: 3,
  icon: DEFAULT_LIST_ICON,
  isActive: 1 as const,
  tagIds: [] as string[],
};
