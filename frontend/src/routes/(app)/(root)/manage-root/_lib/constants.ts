// =============================================================================
// MANAGE ROOT - CONSTANTS
// =============================================================================

import {
  DEFAULT_HIERARCHY_LABELS,
  type HierarchyLabels,
  type PositionOption,
} from '$lib/types/hierarchy-labels';

import type { FormIsActiveStatus } from './types';

export { STATUS_BADGE_CLASSES, STATUS_LABELS } from '@assixx/shared/constants';

// Re-export shared availability constants
export {
  AVAILABILITY_BADGE_CLASSES,
  AVAILABILITY_ICONS,
  AVAILABILITY_LABELS,
  AVAILABILITY_STATUS_OPTIONS,
} from '$lib/availability/constants';

/**
 * Position options for root users
 */
export const POSITION_OPTIONS: readonly PositionOption[] = [
  { id: '', name: 'CEO', roleCategory: 'root' },
  { id: '', name: 'CTO', roleCategory: 'root' },
  { id: '', name: 'CFO', roleCategory: 'root' },
  { id: '', name: 'Geschäftsführer', roleCategory: 'root' },
  { id: '', name: 'IT-Administrator', roleCategory: 'root' },
  { id: '', name: 'Systemadministrator', roleCategory: 'root' },
] as const;

/**
 * UI Messages for i18n preparation
 */
const BASE_MESSAGES = {
  // Page
  PAGE_TITLE: 'Root User Verwaltung - Assixx',
  PAGE_HEADING: 'Root User Verwaltung',
  PAGE_DESCRIPTION: 'Übersicht aller Root-Benutzer des Systems',

  // Security
  SECURITY_TITLE: 'Sicherheitshinweis',
  SECURITY_MESSAGE:
    'Vollzugriff auf System. Kritische Aktionen benötigen Zwei-Personen-Genehmigung.',

  // Loading
  LOADING: 'Root-Benutzer werden geladen...',

  // Empty states
  NO_USERS_FOUND: 'Keine Root-Benutzer gefunden',
  CREATE_FIRST_USER: 'Erstellen Sie Ihren ersten Root-Benutzer für vollständigen Systemzugriff.',

  // Modal titles
  MODAL_TITLE_ADD: 'Root-Benutzer hinzufügen',
  MODAL_TITLE_EDIT: 'Root-Benutzer bearbeiten',

  // Delete
  DELETE_TITLE: 'Root-Benutzer löschen',
  DELETE_CONFIRM: 'Möchten Sie diesen Root-Benutzer wirklich löschen?',
  DELETE_FINAL_TITLE: 'Endgültig löschen?',
  DELETE_FINAL_WARNING: 'Diese Aktion kann nicht rückgängig gemacht werden!',
  DELETE_FINAL_MESSAGE: 'Der Root-Benutzer wird unwiderruflich aus dem System entfernt.',

  // Search
  SEARCH_PLACEHOLDER: 'Root-Benutzer suchen...',
  SEARCH_NO_RESULTS: 'Keine Root-Benutzer gefunden für',
  moreResults: (count: number) => `${count} weitere Ergebnisse in Tabelle`,

  // Form
  SELECT_POSITION: 'Position auswählen...',
  NO_POSITION: 'Keine Position',
  EMAIL_USED_AS_USERNAME: 'Wird auch als Benutzername verwendet',
  INACTIVE_HINT: 'Inaktive/Archivierte Root-User können sich nicht anmelden',

  // Cross-root immutability (masterplan §5.2 / ADR-055 — Layer 1 UX hint).
  // Why: the SSR filter at +page.server.ts:39 already excludes the current user
  // and the API filter `?role=root` guarantees every row is another root, so
  // every Delete + Deactivate + Archive op on this page is cross-root by
  // construction. Backend Layer 2 (users.service.deleteUser/archiveUser, wired
  // Session 4) and Layer 4 (DB trigger fn_prevent_cross_root_change, end-to-end
  // tested Sessions 7c + 8 T16/T17/T18) are the real security gates. This
  // string surfaces WHY the buttons are inert so the user does not file a bug.
  CROSS_ROOT_BLOCKED_TOOLTIP: 'Andere Root-Konten können nicht durch Sie geändert werden.',
  CROSS_ROOT_STATUS_LOCKED_HINT:
    'Status ist gesperrt: Andere Root-Konten können nicht durch Sie deaktiviert oder archiviert werden.',

  // Full access info
  FULL_ACCESS_TITLE: 'Vollzugriff auf alle Bereiche',
  FULL_ACCESS_MESSAGE:
    'Root-User haben automatisch Zugriff auf alle Abteilungen und Bereiche des Tenants.',

  // Profile info
  PROFILE_INFO: 'Ihr eigenes Profil wird hier nicht angezeigt. Bearbeiten Sie es über',
  PROFILE_LINK_TEXT: 'Mein Profil',

  // Validation
  EMAILS_NOT_MATCH: 'E-Mail-Adressen stimmen nicht überein',
  PASSWORDS_NOT_MATCH: 'Passwörter stimmen nicht überein',
  SELECT_POSITION_ERROR: 'Bitte wählen Sie eine Position aus',
  EMPLOYEE_NUMBER_REQUIRED: 'Bitte geben Sie eine Personalnummer ein',

  // Success
  SUCCESS_CREATED: 'Root-Benutzer erfolgreich erstellt',
  SUCCESS_UPDATED: 'Root-Benutzer erfolgreich aktualisiert',
  SUCCESS_DELETED: 'Root-Benutzer erfolgreich gelöscht',

  // Table headers - Availability
  TH_AVAILABILITY: 'Verfügbarkeit',
  TH_PLANNED: 'Geplant',
  TH_ADDITIONAL_INFO: 'Zusätzliche Infos',
  TH_ABSENCE_NOTES: 'Abwesenheitsnotiz',

  // API errors
  ERROR_LOADING: 'Ein Fehler ist aufgetreten',
  ERROR_SAVING: 'Fehler beim Speichern',
  ERROR_DELETING: 'Fehler beim Löschen',

  // Password strength
  PASSWORD_VERY_WEAK: 'Sehr schwach',
  PASSWORD_WEAK: 'Schwach',
  PASSWORD_MEDIUM: 'Mittel',
  PASSWORD_STRONG: 'Stark',
  PASSWORD_VERY_STRONG: 'Sehr stark',
} as const;

/** Factory: root messages with dynamic hierarchy labels */
export function createRootMessages(labels: HierarchyLabels) {
  return {
    ...BASE_MESSAGES,
    FULL_ACCESS_TITLE: `Vollzugriff auf alle ${labels.area}`,
    FULL_ACCESS_MESSAGE: `Root-User haben automatisch Zugriff auf alle ${labels.department} und ${labels.area} des Tenants.`,
  };
}

/** Backward-compatible static export */
export const MESSAGES = createRootMessages(DEFAULT_HIERARCHY_LABELS);

/**
 * Password strength labels
 */
export const PASSWORD_STRENGTH_LABELS = [
  MESSAGES.PASSWORD_VERY_WEAK,
  MESSAGES.PASSWORD_WEAK,
  MESSAGES.PASSWORD_MEDIUM,
  MESSAGES.PASSWORD_STRONG,
  MESSAGES.PASSWORD_VERY_STRONG,
] as const;

/**
 * Password crack time estimates
 */
export const PASSWORD_CRACK_TIMES = ['sofort', 'Minuten', 'Stunden', 'Tage', 'Jahre'] as const;

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  USERS: '/root/users',
  user: (id: number) => `/root/users/${id}`,
} as const;

/**
 * Form default values
 */
export const FORM_DEFAULTS: {
  firstName: string;
  lastName: string;
  email: string;
  emailConfirm: string;
  password: string;
  passwordConfirm: string;
  employeeNumber: string;
  positionIds: string[];
  notes: string;
  isActive: FormIsActiveStatus;
} = {
  firstName: '',
  lastName: '',
  email: '',
  emailConfirm: '',
  password: '',
  passwordConfirm: '',
  employeeNumber: '',
  positionIds: [],
  notes: '',
  isActive: 1,
};
