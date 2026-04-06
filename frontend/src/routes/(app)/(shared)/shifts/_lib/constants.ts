// =============================================================================
// SHIFTS - CONSTANTS
// Based on: frontend/src/scripts/shifts/constants.ts
// =============================================================================

import { DEFAULT_HIERARCHY_LABELS, type HierarchyLabels } from '$lib/types/hierarchy-labels';

/**
 * Static error messages (label-independent)
 */
const STATIC_ERROR_MESSAGES = {
  SHIFT_ASSIGNMENT_FAILED: 'Fehler beim Zuweisen der Schicht',
  NO_TEAM_SELECTED: 'Bitte wählen Sie zuerst ein Team aus',
  INVALID_HIERARCHY: 'Ungültige Auswahl-Hierarchie',
  LOAD_FAILED: 'Fehler beim Laden der Daten',
  SAVE_FAILED: 'Fehler beim Speichern',
} as const;

/** Error messages factory with dynamic hierarchy labels */
function createErrorMessages(labels: HierarchyLabels) {
  return {
    ...STATIC_ERROR_MESSAGES,
    NO_DEPARTMENT_SELECTED: `Bitte wählen Sie zuerst eine ${labels.department} aus`,
  };
}

/** Error messages type for component props */
export type ShiftErrorMessages = ReturnType<typeof createErrorMessages>;

/** Default error messages (backward-compatible static export) */
export const ERROR_MESSAGES = createErrorMessages(DEFAULT_HIERARCHY_LABELS);

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
 * Static dropdown placeholder texts (label-independent)
 */
const STATIC_DROPDOWN_PLACEHOLDERS = {
  AREA: 'Bereich wählen...',
  TEAM: 'Team wählen...',
  AWAIT_AREA: 'Erst Bereich wählen...',
  AWAIT_TEAM: 'Erst Team wählen...',
} as const;

/** Dropdown placeholders factory with dynamic hierarchy labels */
export function createDropdownPlaceholders(labels: HierarchyLabels) {
  return {
    ...STATIC_DROPDOWN_PLACEHOLDERS,
    DEPARTMENT: `${labels.department} wählen...`,
    MACHINE: `${labels.asset} wählen...`,
    AWAIT_DEPARTMENT: `Erst ${labels.department} wählen...`,
  };
}

/** Dropdown placeholders type for component props */
export type ShiftDropdownPlaceholders = ReturnType<typeof createDropdownPlaceholders>;

/** Default dropdown placeholders (backward-compatible static export) */
export const DROPDOWN_PLACEHOLDERS = createDropdownPlaceholders(DEFAULT_HIERARCHY_LABELS);

/**
 * Shift types array (for iteration)
 */
export const SHIFT_TYPES = ['early', 'late', 'night'] as const;

export { AVAILABILITY_LABELS, AVAILABILITY_ICONS } from '@assixx/shared/constants';
export { AVAILABILITY_BADGE_CLASSES as AVAILABILITY_COLORS } from '@assixx/shared/constants';

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  SHIFTS_CONTEXT: 'shifts_context',
  ACTIVE_ROLE: 'activeRole',
} as const;
