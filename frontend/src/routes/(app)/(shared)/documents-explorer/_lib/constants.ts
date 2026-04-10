// =============================================================================
// DOCUMENTS EXPLORER - CONSTANTS
// =============================================================================

import { DEFAULT_HIERARCHY_LABELS, type HierarchyLabels } from '$lib/types/hierarchy-labels';

import type { DocumentCategory, SortOption, CategoryMapping, AccessScope } from './types';

/** SVG icons for folder categories */
const FOLDER_ICONS: Record<DocumentCategory, string> = {
  all: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>`,
  personal: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>`,
  team: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>`,
  department: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>`,
  company: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>`,
  payroll: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
  blackboard: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>`,
  chat: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>`,
};

/** Static folder labels (non-hierarchy) */
const STATIC_FOLDER_LABELS: Partial<Record<DocumentCategory, string>> = {
  all: 'Alle Dokumente',
  personal: 'Persönlich',
  company: 'Firma',
  payroll: 'Gehaltsabrechnungen',
  blackboard: 'Schwarzes Brett',
  chat: 'Chat Anhänge',
};

/** Factory: folder definitions with dynamic hierarchy labels */
function createFolderDefinitions(labels: HierarchyLabels) {
  const dynamicLabels: Record<DocumentCategory, string> = {
    ...STATIC_FOLDER_LABELS,
    team: `${labels.team} Dokumente`,
    department: labels.department,
  } as Record<DocumentCategory, string>;

  return (
    ['all', 'personal', 'team', 'department', 'company', 'payroll', 'blackboard', 'chat'] as const
  ).map((cat: DocumentCategory) => ({
    category: cat,
    label: dynamicLabels[cat],
    icon: FOLDER_ICONS[cat],
  }));
}

/** Backward-compatible static export */
export const FOLDER_DEFINITIONS = createFolderDefinitions(DEFAULT_HIERARCHY_LABELS);

/**
 * Sort options for toolbar dropdown
 */
export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Neueste zuerst' },
  { value: 'oldest', label: 'Älteste zuerst' },
  { value: 'name', label: 'Nach Name' },
  { value: 'size', label: 'Nach Größe' },
];

/**
 * Sort option labels for display (matches Legacy exactly)
 */
export const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Neueste zuerst',
  oldest: 'Älteste zuerst',
  name: 'Nach Name',
  size: 'Nach Größe',
};

/** Factory: category labels with dynamic hierarchy labels */
function createCategoryLabels(labels: HierarchyLabels): Record<DocumentCategory, string> {
  return {
    all: 'Alle Dokumente',
    personal: 'Persönliche Dokumente',
    team: `${labels.team} Dokumente`,
    department: labels.department,
    company: 'Firma',
    payroll: 'Gehaltsabrechnungen',
    blackboard: 'Schwarzes Brett',
    chat: 'Chat Anhänge',
  };
}

/** Backward-compatible static export */
export const CATEGORY_LABELS: Record<DocumentCategory, string> =
  createCategoryLabels(DEFAULT_HIERARCHY_LABELS);

/**
 * DB category value labels (for display in table)
 */
export const DB_CATEGORY_LABELS: Record<string, string> = {
  general: 'Allgemein',
  work: 'Arbeit',
  personal: 'Persönlich',
  salary: 'Gehalt',
  blackboard: 'Schwarzes Brett',
  chat: 'Chat',
};

/**
 * Category mapping for upload - maps user-facing category to database fields
 */
export const CATEGORY_MAPPINGS: Record<string, CategoryMapping> = {
  company: {
    accessScope: 'company' as AccessScope,
    categoryValue: 'general',
  },
  department: {
    accessScope: 'department' as AccessScope,
    requiresField: 'departmentId',
    categoryValue: 'work',
  },
  team: {
    accessScope: 'team' as AccessScope,
    requiresField: 'teamId',
    categoryValue: 'work',
  },
  personal: {
    accessScope: 'personal' as AccessScope,
    categoryValue: 'personal',
  },
  payroll: {
    accessScope: 'payroll' as AccessScope,
    requiresPayrollPeriod: true,
    categoryValue: 'salary',
  },
};

/** Factory: upload category options with dynamic hierarchy labels */
function createUploadCategoryOptions(labels: HierarchyLabels): {
  value: string;
  label: string;
  icon: string;
}[] {
  return [
    { value: 'company', label: 'Firmenweit', icon: 'fas fa-building' },
    { value: 'department', label: labels.department, icon: 'fas fa-users' },
    { value: 'team', label: labels.team, icon: 'fas fa-user-friends' },
    { value: 'personal', label: 'Persönlich', icon: 'fas fa-user' },
    { value: 'payroll', label: 'Gehaltsabrechnung', icon: 'fas fa-euro-sign' },
  ];
}

/** Backward-compatible static export */
export const UPLOAD_CATEGORY_OPTIONS = createUploadCategoryOptions(DEFAULT_HIERARCHY_LABELS);

/**
 * Allowed file types for upload
 */
export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
];

/**
 * Maximum file size in bytes (5MB)
 */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

const BASE_MESSAGES = {
  // Page titles
  PAGE_TITLE: 'Dokumente - Assixx',

  // Loading states
  LOADING_DOCUMENTS: 'Dokumente werden geladen...',

  // Empty states
  EMPTY_TITLE: 'Keine Dokumente',
  EMPTY_DESCRIPTION: 'In diesem Ordner befinden sich noch keine Dokumente.',

  // Error states
  ERROR_LOAD_FAILED: 'Fehler beim Laden der Dokumente',
  ERROR_NETWORK: 'Keine Verbindung zum Server',
  ERROR_UPLOAD_FAILED: 'Fehler beim Hochladen',

  // Search
  SEARCH_PLACEHOLDER: 'Dokumente durchsuchen...',

  // Upload modal
  UPLOAD_TITLE: 'Dokument hochladen',
  UPLOAD_DRAG_DROP: 'Datei hierher ziehen oder klicken',
  UPLOAD_FILE_TYPES: 'PDF, Word, Excel, JPG, PNG (max. 5 MB)',
  UPLOAD_CATEGORY_PLACEHOLDER: 'Kategorie wählen',
  UPLOAD_SUBMIT: 'Hochladen',
  UPLOAD_CANCEL: 'Abbrechen',
  UPLOAD_SUCCESS: 'Dokument erfolgreich hochgeladen!',
  UPLOAD_PROGRESS: 'Wird hochgeladen...',

  // Upload validation
  UPLOAD_NO_FILE: 'Bitte wählen Sie eine Datei aus!',
  UPLOAD_NO_CATEGORY: 'Bitte wählen Sie eine Kategorie aus!',
  UPLOAD_FILE_TOO_LARGE: 'Datei ist zu groß! Maximale Größe: 5 MB',
  UPLOAD_INVALID_TYPE: 'Nur PDF, Word, Excel, JPG und PNG Dateien sind erlaubt!',
  UPLOAD_NO_TEAM: 'Sie müssen einem Team zugeordnet sein, um Team-Dokumente hochzuladen!',
  UPLOAD_NO_DEPARTMENT:
    'Sie müssen einer Abteilung zugeordnet sein, um Abteilungs-Dokumente hochzuladen!',
  UPLOAD_SELECT_PAYROLL_PERIOD: 'Bitte wählen Sie Jahr und Monat für die Gehaltsabrechnung!',

  // Preview modal
  PREVIEW_TITLE: 'Vorschau',
  PREVIEW_DOWNLOAD: 'Herunterladen',
  PREVIEW_CLOSE: 'Schließen',
  PREVIEW_NO_PREVIEW: 'Vorschau nicht verfügbar',
  PREVIEW_NO_PREVIEW_DESC: 'Für diesen Dateityp ist keine Vorschau verfügbar.',

  // Document actions
  ACTION_DOWNLOAD: 'Herunterladen',
  ACTION_DELETE: 'Löschen',
  ACTION_MOVE: 'Verschieben',
  ACTION_DELETE_COMING: 'Löschen-Funktion folgt noch',
  ACTION_MOVE_COMING: 'Verschieben-Funktion folgt noch',

  // Table headers
  TH_NAME: 'Name',
  TH_CATEGORY: 'Kategorie',
  TH_TAGS: 'Tags',
  TH_SIZE: 'Größe',
  TH_DATE: 'Datum',
  TH_ACTIONS: 'Aktionen',

  // Chat folders
  CHAT_BACK_TO_FOLDERS: 'Zurück zur Ordner-Übersicht',
  CHAT_CONVERSATION: 'Chat-Konversation',
  CHAT_FILES_COUNT: 'Dateien',

  // Buttons
  BTN_RETRY: 'Erneut versuchen',
  BTN_UPLOAD: 'Hochladen',

  // Auth
  AUTH_NOT_LOGGED_IN: 'Nicht angemeldet',
  AUTH_REDIRECT_MESSAGE: 'Sie werden in 3 Sekunden zur Login-Seite weitergeleitet...',
} as const;

/** Factory: documents messages with dynamic hierarchy labels */
function createDocumentsMessages(labels: HierarchyLabels) {
  return {
    ...BASE_MESSAGES,
    UPLOAD_NO_TEAM: `Sie müssen einem ${labels.team} zugeordnet sein, um ${labels.team}-Dokumente hochzuladen!`,
    UPLOAD_NO_DEPARTMENT: `Sie müssen einer ${labels.department} zugeordnet sein, um ${labels.department}-Dokumente hochzuladen!`,
  };
}

/** Backward-compatible static export */
export const MESSAGES = createDocumentsMessages(DEFAULT_HIERARCHY_LABELS);

/**
 * Minimum rows to display in list view (for striped appearance)
 */
export const MIN_LIST_ROWS = 20;
