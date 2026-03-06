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
 * Default shift time mappings (fallback when API data unavailable).
 * Tenant-specific times are loaded from /shift-times API.
 */
export const DEFAULT_SHIFT_TIMES = {
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
  MACHINE: 'Anlage wählen...',
  TEAM: 'Team wählen...',
  AWAIT_AREA: 'Erst Bereich wählen...',
  AWAIT_DEPARTMENT: 'Erst Abteilung wählen...',
  AWAIT_TEAM: 'Erst Team wählen...',
} as const;

/**
 * Shift types array (for iteration)
 */
export const SHIFT_TYPES = ['early', 'late', 'night'] as const;

export {
  AVAILABILITY_LABELS,
  AVAILABILITY_ICONS,
} from '@assixx/shared/constants';
export { AVAILABILITY_BADGE_CLASSES as AVAILABILITY_COLORS } from '@assixx/shared/constants';

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  SHIFTS_CONTEXT: 'shifts_context',
  ACTIVE_ROLE: 'activeRole',
} as const;

/**
 * TPM interval type (mirrors tpm/_lib/types.ts — kept local to avoid
 * fragile cross-route imports that break eslint-plugin-svelte type resolution).
 */
export type TpmIntervalType =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'semi_annual'
  | 'annual'
  | 'custom';

/** TPM interval color defaults (fallback when tenant has no DB overrides) */
export const INTERVAL_COLORS: Record<TpmIntervalType, string> = {
  daily: '#4CAF50',
  weekly: '#8BC34A',
  monthly: '#5bb5f5',
  quarterly: '#b0b0b0',
  semi_annual: '#f5a0a0',
  annual: '#c8b88a',
  custom: '#FF9800',
} as const;

/** TPM interval short labels for compact badges */
export const INTERVAL_SHORT_LABELS: Record<TpmIntervalType, string> = {
  daily: 'T',
  weekly: 'W',
  monthly: 'M',
  quarterly: 'VJ',
  semi_annual: 'HJ',
  annual: 'J',
  custom: 'BD',
} as const;

/** TPM interval full labels (German) */
export const INTERVAL_LABELS: Record<TpmIntervalType, string> = {
  daily: 'Täglich',
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  quarterly: 'Vierteljährlich',
  semi_annual: 'Halbjährlich',
  annual: 'Jährlich',
  custom: 'Benutzerdefiniert',
} as const;
