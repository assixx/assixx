// =============================================================================
// Work Orders — CONSTANTS
// =============================================================================

import type {
  WorkOrderPriority,
  WorkOrderSourceType,
  WorkOrderStatus,
} from './types';

// =============================================================================
// STATUS LABELS & STYLING
// =============================================================================

/** Status display labels (German) */
export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  completed: 'Abgeschlossen',
  verified: 'Verifiziert',
};

/** Status badge CSS classes (design system) */
export const STATUS_BADGE_CLASSES: Record<WorkOrderStatus, string> = {
  open: 'badge--info',
  in_progress: 'badge--warning',
  completed: 'badge--success',
  verified: 'badge--primary',
};

/** Status icons (FontAwesome) */
export const STATUS_ICONS: Record<WorkOrderStatus, string> = {
  open: 'fa-circle',
  in_progress: 'fa-spinner',
  completed: 'fa-check-circle',
  verified: 'fa-shield-check',
};

// =============================================================================
// PRIORITY LABELS & STYLING
// =============================================================================

/** Priority display labels (German) */
export const PRIORITY_LABELS: Record<WorkOrderPriority, string> = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
};

/** Priority badge CSS classes */
export const PRIORITY_BADGE_CLASSES: Record<WorkOrderPriority, string> = {
  low: 'badge--secondary',
  medium: 'badge--info',
  high: 'badge--danger',
};

/** Priority icons (FontAwesome) */
export const PRIORITY_ICONS: Record<WorkOrderPriority, string> = {
  low: 'fa-arrow-down',
  medium: 'fa-minus',
  high: 'fa-arrow-up',
};

// =============================================================================
// SOURCE TYPE LABELS
// =============================================================================

/** Source type display labels (German) */
export const SOURCE_TYPE_LABELS: Record<WorkOrderSourceType, string> = {
  tpm_defect: 'TPM-Mangel',
  manual: 'Manuell',
};

// =============================================================================
// STATUS TRANSITION LABELS
// =============================================================================

/** Button labels for status transitions (German) */
export const STATUS_TRANSITION_LABELS: Record<string, string> = {
  'open→in_progress': 'Arbeit beginnen',
  'open→completed': 'Sofort erledigt',
  'in_progress→completed': 'Als erledigt melden',
  'completed→verified': 'Verifizieren',
  'completed→in_progress': 'Zurückweisen',
  'verified→completed': 'Verifikation zurücknehmen',
};

// =============================================================================
// FILTER OPTIONS (for dropdowns)
// =============================================================================

/** Status filter options including "all" */
export const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Alle Status' },
  { value: 'open', label: 'Offen' },
  { value: 'in_progress', label: 'In Bearbeitung' },
  { value: 'completed', label: 'Abgeschlossen' },
  { value: 'verified', label: 'Verifiziert' },
];

/** Priority filter options including "all" */
export const PRIORITY_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Alle Prioritäten' },
  { value: 'high', label: 'Hoch' },
  { value: 'medium', label: 'Mittel' },
  { value: 'low', label: 'Niedrig' },
];

// =============================================================================
// UI MESSAGES (German)
// =============================================================================

/** Centralized German UI strings */
export const MESSAGES = {
  // Page titles
  PAGE_TITLE_EMPLOYEE: 'Meine Arbeitsaufträge - Assixx',
  PAGE_TITLE_ADMIN: 'Alle Arbeitsaufträge - Assixx',
  PAGE_TITLE_DETAIL: 'Auftragsdetail - Assixx',

  // Headings
  HEADING_EMPLOYEE: 'Meine Arbeitsaufträge',
  HEADING_ADMIN: 'Alle Arbeitsaufträge',
  HEADING_DETAIL: 'Auftragsdetail',

  // Stats
  STAT_OPEN: 'Offen',
  STAT_IN_PROGRESS: 'In Bearbeitung',
  STAT_COMPLETED: 'Abgeschlossen',
  STAT_VERIFIED: 'Verifiziert',
  STAT_TOTAL: 'Gesamt',
  STAT_OVERDUE: 'Überfällig',

  // Buttons
  BTN_CREATE: 'Auftrag erstellen',
  BTN_EDIT: 'Bearbeiten',
  BTN_DELETE: 'Löschen',
  BTN_SAVE: 'Speichern',
  BTN_CANCEL: 'Abbrechen',
  BTN_BACK: 'Zurück',
  BTN_ASSIGN: 'Zuweisen',
  BTN_VERIFY: 'Verifizieren',
  BTN_VIEW_DETAIL: 'Details anzeigen',

  // Work order list
  LIST_COL_TITLE: 'Titel',
  LIST_COL_STATUS: 'Status',
  LIST_COL_PRIORITY: 'Priorität',
  LIST_COL_ASSIGNEES: 'Zugewiesen an',
  LIST_COL_DUE_DATE: 'Fällig am',
  LIST_COL_CREATED: 'Erstellt am',
  LIST_COL_SOURCE: 'Quelle',
  LIST_COL_ACTIONS: 'Aktionen',

  // Detail view
  DETAIL_TITLE: 'Titel',
  DETAIL_DESCRIPTION: 'Beschreibung',
  DETAIL_NO_DESCRIPTION: 'Keine Beschreibung vorhanden',
  DETAIL_STATUS: 'Status',
  DETAIL_PRIORITY: 'Priorität',
  DETAIL_SOURCE: 'Quelle',
  DETAIL_DUE_DATE: 'Fälligkeitsdatum',
  DETAIL_NO_DUE_DATE: 'Kein Fälligkeitsdatum',
  DETAIL_CREATED_BY: 'Erstellt von',
  DETAIL_CREATED_AT: 'Erstellt am',
  DETAIL_COMPLETED_AT: 'Abgeschlossen am',
  DETAIL_VERIFIED_AT: 'Verifiziert am',
  DETAIL_VERIFIED_BY: 'Verifiziert von',

  // Assignees
  ASSIGNEES_HEADING: 'Zugewiesene Mitarbeiter',
  ASSIGNEES_EMPTY: 'Keine Mitarbeiter zugewiesen',
  ASSIGNEES_ADD: 'Mitarbeiter zuweisen',
  ASSIGNEES_REMOVE: 'Zuweisung entfernen',
  ASSIGNEES_REMOVE_CONFIRM: 'Zuweisung wirklich entfernen?',
  ASSIGNEES_SELECT: 'Mitarbeiter auswählen',
  ASSIGNEES_SUCCESS_ADD: 'Mitarbeiter erfolgreich zugewiesen',
  ASSIGNEES_SUCCESS_REMOVE: 'Zuweisung erfolgreich entfernt',
  ASSIGNEES_ERROR_ADD: 'Fehler beim Zuweisen',
  ASSIGNEES_ERROR_REMOVE: 'Fehler beim Entfernen der Zuweisung',

  // Comments
  COMMENTS_HEADING: 'Kommentare',
  COMMENTS_EMPTY: 'Noch keine Kommentare',
  COMMENTS_ADD_PH: 'Kommentar schreiben...',
  COMMENTS_SUBMIT: 'Kommentar senden',
  COMMENTS_SUBMITTING: 'Wird gesendet...',
  COMMENTS_SUCCESS: 'Kommentar hinzugefügt',
  COMMENTS_ERROR: 'Fehler beim Senden des Kommentars',
  COMMENTS_STATUS_CHANGE: 'Statusänderung',
  COMMENTS_REPLY: 'Antworten',
  COMMENTS_REPLY_PH: 'Antwort schreiben...',
  COMMENTS_REPLY_SUCCESS: 'Antwort hinzugefügt',
  COMMENTS_REPLY_ERROR: 'Fehler beim Hinzufügen der Antwort',
  COMMENTS_REPLY_CANCEL: 'Abbrechen',
  COMMENTS_LOADING_MORE: 'Weitere Kommentare laden...',

  // Photos
  PHOTOS_HEADING: 'Fotos',
  PHOTOS_EMPTY: 'Keine Fotos vorhanden',
  PHOTOS_ADD: 'Foto hinzufügen',
  PHOTOS_MAX_REACHED: 'Maximum von 10 Fotos erreicht',
  PHOTOS_MAX_SIZE: 'Max. 5 MB pro Foto',
  PHOTOS_UPLOADING: 'Wird hochgeladen...',
  PHOTOS_SUCCESS: 'Foto erfolgreich hochgeladen',
  PHOTOS_ERROR: 'Fehler beim Hochladen',
  PHOTOS_TOO_LARGE: 'Datei ist größer als 5 MB',
  PHOTOS_INVALID_TYPE: 'Nur Bilder (JPG, PNG, WebP) erlaubt',
  PHOTOS_DELETE_CONFIRM: 'Foto wirklich löschen?',
  PHOTOS_DELETE_SUCCESS: 'Foto gelöscht',
  PHOTOS_DELETE_ERROR: 'Fehler beim Löschen',
  PHOTOS_DELETING: 'Wird gelöscht...',

  // Create/Edit modal
  MODAL_CREATE_TITLE: 'Neuen Arbeitsauftrag erstellen',
  MODAL_EDIT_TITLE: 'Arbeitsauftrag bearbeiten',
  MODAL_FIELD_TITLE: 'Titel',
  MODAL_FIELD_TITLE_PH: 'Kurze Beschreibung des Auftrags...',
  MODAL_FIELD_DESCRIPTION: 'Beschreibung',
  MODAL_FIELD_DESCRIPTION_PH: 'Detaillierte Arbeitsanweisung...',
  MODAL_FIELD_PRIORITY: 'Priorität',
  MODAL_FIELD_DUE_DATE: 'Fälligkeitsdatum',
  MODAL_FIELD_ASSIGNEES: 'Zugewiesene Mitarbeiter',
  MODAL_SAVING: 'Wird gespeichert...',

  // Delete confirmation
  DELETE_CONFIRM_TITLE: 'Arbeitsauftrag löschen?',
  DELETE_CONFIRM_TEXT:
    'Möchten Sie diesen Arbeitsauftrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
  DELETE_SUCCESS: 'Arbeitsauftrag erfolgreich gelöscht',
  DELETE_ERROR: 'Fehler beim Löschen',

  // Success messages
  SUCCESS_CREATED: 'Arbeitsauftrag erfolgreich erstellt',
  SUCCESS_UPDATED: 'Arbeitsauftrag erfolgreich aktualisiert',
  SUCCESS_STATUS: 'Status erfolgreich geändert',

  // Error messages
  ERROR_LOAD: 'Fehler beim Laden der Arbeitsaufträge',
  ERROR_CREATE: 'Fehler beim Erstellen des Arbeitsauftrags',
  ERROR_UPDATE: 'Fehler beim Aktualisieren des Arbeitsauftrags',
  ERROR_STATUS: 'Fehler beim Ändern des Status',
  ERROR_STATS: 'Fehler beim Laden der Statistiken',

  // Empty states
  EMPTY_TITLE: 'Keine Arbeitsaufträge',
  EMPTY_DESCRIPTION_EMPLOYEE:
    'Ihnen sind aktuell keine Arbeitsaufträge zugewiesen.',
  EMPTY_DESCRIPTION_ADMIN: 'Es wurden noch keine Arbeitsaufträge erstellt.',

  // Loading
  LOADING: 'Arbeitsaufträge werden geladen...',

  // Pagination
  PAGINATION_SHOWING: 'Zeige',
  PAGINATION_OF: 'von',
  PAGINATION_ENTRIES: 'Einträgen',
} as const;
