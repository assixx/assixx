// =============================================================================
// SHIFTS - CONSTANTS
// Based on: frontend/src/scripts/shifts/constants.ts
// =============================================================================

/**
 * Error messages (German)
 */
export const ERROR_MESSAGES = {
  SHIFT_ASSIGNMENT_FAILED: 'Fehler beim Zuweisen der Schicht',
  NO_DEPARTMENT_SELECTED: 'Bitte wählen Sie zuerst eine Abteilung aus',
  NO_TEAM_SELECTED: 'Bitte wählen Sie zuerst ein Team aus',
  INVALID_HIERARCHY: 'Ungültige Auswahl-Hierarchie',
  LOAD_FAILED: 'Fehler beim Laden der Daten',
  SAVE_FAILED: 'Fehler beim Speichern',
} as const;

/**
 * Success messages (German)
 */
export const SUCCESS_MESSAGES = {
  SHIFT_ASSIGNED: 'Schicht erfolgreich zugewiesen',
  SCHEDULE_SAVED: 'Schichtplan erfolgreich gespeichert!',
  SCHEDULE_UPDATED: 'Schichtplan wurde aktualisiert',
  SCHEDULE_RESET: 'Schichtplan wurde zurückgesetzt',
  PLAN_DELETED: 'Schichtplan wurde aus der Datenbank gelöscht',
} as const;

/**
 * Shift time mappings
 */
export const SHIFT_TIMES = {
  early: { start: '06:00', end: '14:00', label: 'Frühschicht' },
  late: { start: '14:00', end: '22:00', label: 'Spätschicht' },
  night: { start: '22:00', end: '06:00', label: 'Nachtschicht' },
  F: { start: '06:00', end: '14:00', label: 'Frühschicht' },
  S: { start: '14:00', end: '22:00', label: 'Spätschicht' },
  N: { start: '22:00', end: '06:00', label: 'Nachtschicht' },
} as const;

/**
 * Shift type conversion map (frontend to API)
 */
export const SHIFT_TYPE_TO_API = {
  early: 'F',
  late: 'S',
  night: 'N',
} as const;

/**
 * Shift type conversion map (API to frontend)
 */
export const SHIFT_TYPE_FROM_API = {
  F: 'early',
  S: 'late',
  N: 'night',
} as const;

/**
 * Day names (short, German)
 */
export const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

/**
 * Full day names (German)
 */
export const FULL_DAY_NAMES = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
] as const;

/**
 * Admin roles that can edit shifts
 */
export const ADMIN_ROLES = ['admin', 'root', 'manager', 'team_lead'] as const;

/**
 * Dropdown placeholder texts (German)
 */
export const DROPDOWN_PLACEHOLDERS = {
  AREA: 'Bereich wählen...',
  DEPARTMENT: 'Abteilung wählen...',
  MACHINE: 'Maschine wählen...',
  TEAM: 'Team wählen...',
  AWAIT_AREA: 'Erst Bereich wählen...',
  AWAIT_DEPARTMENT: 'Erst Abteilung wählen...',
  AWAIT_MACHINE: 'Erst Maschine wählen...',
} as const;

/**
 * Shift types array (for iteration)
 */
export const SHIFT_TYPES = ['early', 'late', 'night'] as const;

/**
 * Availability status labels (German)
 */
export const AVAILABILITY_LABELS = {
  available: 'Verfügbar',
  vacation: 'Urlaub',
  sick: 'Krank',
  unavailable: 'Nicht verfügbar',
  training: 'Schulung',
  other: 'Sonstiges',
} as const;

/**
 * Availability status icons
 */
export const AVAILABILITY_ICONS = {
  available: 'fa-check-circle',
  vacation: 'fa-plane',
  sick: 'fa-notes-medical',
  unavailable: 'fa-ban',
  training: 'fa-graduation-cap',
  other: 'fa-clock',
} as const;

/**
 * Availability status colors (CSS classes)
 */
export const AVAILABILITY_COLORS = {
  available: 'badge--success',
  vacation: 'badge--warning',
  sick: 'badge--danger',
  unavailable: 'badge--error',
  training: 'badge--info',
  other: 'badge--dark',
} as const;

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  SHIFTS_CONTEXT: 'shifts_context',
  ACTIVE_ROLE: 'activeRole',
} as const;
