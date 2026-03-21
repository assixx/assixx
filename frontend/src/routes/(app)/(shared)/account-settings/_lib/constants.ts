/**
 * Account Settings - Constants
 * @module account-settings/_lib/constants
 */

import type { DeletionStatus } from './types';

/** Status labels (German) */
export const STATUS_LABELS: Record<DeletionStatus, string> = {
  pending_approval: 'Warte auf Genehmigung',
  approved: 'Genehmigt',
  cooling_off: 'In Nachfrist',
  scheduled: 'Geplant',
  completed: 'Abgeschlossen',
  cancelled: 'Abgebrochen',
} as const;

/** Deletion confirmation text */
export const DELETE_CONFIRMATION_TEXT = 'LÖSCHEN';

/** Minimum reason length */
export const MIN_REASON_LENGTH = 10;

/** Minimum required root users for deletion */
export const MIN_ROOT_USERS = 2;

/** UI Messages (German) */
export const MESSAGES = {
  // Deletion
  deletionRequested:
    'Löschanfrage erfolgreich eingereicht! Genehmigung von zweitem Root-Benutzer erforderlich.',
  deletionError: 'Fehler beim Löschen des Tenants',
  noPendingDeletion: 'Keine ausstehende Löschung gefunden',
  defaultReason: 'Keine Angabe',

  // Root User Check
  notEnoughRootUsers: (count: number): string => {
    const userText = count === 1 ? 'Es gibt nur 1 Root-Benutzer' : 'Es gibt keine Root-Benutzer';
    return `Tenant-Löschung nicht möglich: ${userText}. Um den Tenant zu löschen, erstellen Sie bitte mindestens einen weiteren Root-Benutzer (Zwei-Personen-Prinzip).`;
  },

  // Form
  reasonTooShort: (length: number): string => `Mindestens 10 Zeichen erforderlich (${length}/10)`,
  characterCount: (length: number): string => `${length} Zeichen`,
} as const;

/** Shift time configuration messages */
export const SHIFT_MESSAGES = {
  saved: 'Schichtzeiten erfolgreich gespeichert!',
  saveError: 'Fehler beim Speichern der Schichtzeiten',
  reset: 'Schichtzeiten auf Standardwerte zurückgesetzt!',
  resetError: 'Fehler beim Zurücksetzen der Schichtzeiten',
  loadError: 'Fehler beim Laden der Schichtzeiten',
} as const;

/** Shift key display info */
export const SHIFT_KEY_INFO: Record<string, { icon: string; colorClass: string }> = {
  early: { icon: 'fa-sun', colorClass: 'shift-early' },
  late: { icon: 'fa-cloud-sun', colorClass: 'shift-late' },
  night: { icon: 'fa-moon', colorClass: 'shift-night' },
} as const;

/** LocalStorage keys */
export const STORAGE_KEYS = {
  accessToken: 'accessToken',
} as const;
