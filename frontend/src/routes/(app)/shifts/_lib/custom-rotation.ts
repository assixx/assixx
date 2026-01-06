// =============================================================================
// SHIFTS - CUSTOM ROTATION (2-Week Shift Planning)
// Based on: frontend/src/scripts/shifts/custom-rotation.ts
// Adapted for Svelte 5 (no DOM manipulation, pure logic)
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import type { ShiftType } from './types';

const apiClient = getApiClient();

// =============================================================================
// TYPES (from custom-rotation-types.ts)
// =============================================================================

/**
 * Shift group for employee assignment (F = Früh, S = Spät, N = Nacht)
 */
export type ShiftGroup = 'F' | 'S' | 'N';

/**
 * Employee assignment to starting shift group
 */
export interface EmployeeAssignment {
  userId: number;
  userName: string;
  startGroup: ShiftGroup;
}

/**
 * Special rule: nth weekday free (e.g., every 4th Sunday free)
 */
export interface NthWeekdayFreeRule {
  type: 'nth_weekday_free';
  name: string;
  weekday: number; // 0-6 (0 = Sunday)
  n: number; // 1-5 (e.g., 4 = "every 4th")
}

/**
 * Day schedule structure
 */
export interface DaySchedule {
  early: number[]; // User IDs for early shift
  late: number[]; // User IDs for late shift
  night: number[]; // User IDs for night shift
  free: number[]; // User IDs marked as free
}

/**
 * Week data structure
 */
export interface WeekData {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

/**
 * Backend-compatible pattern types
 */
export type BackendPatternType = 'alternate_fs' | 'fixed_n' | 'custom';

/**
 * Custom rotation pattern configuration
 */
export interface CustomRotationPatternConfig {
  // Grid pattern data
  customPattern?: {
    week1: WeekData;
    week2: WeekData;
    week3?: WeekData;
    week4?: WeekData;
  };
  rotationType?: 'forward' | 'backward';
  shiftDuration?: number; // days per shift type

  // Shift block algorithm configuration
  shiftBlockLength?: number; // Days per shift block (e.g., 10)
  freeDays?: number; // Free days between shifts (e.g., 2)
  startShift?: ShiftType; // Starting shift
  shiftSequence?: ShiftType[]; // Rotation order (e.g., ['early', 'late', 'night'])
  specialRules?: NthWeekdayFreeRule[]; // Optional special rules
}

/**
 * Custom rotation pattern
 */
export interface CustomRotationPattern {
  name: string;
  patternType: 'auto-detect' | BackendPatternType;
  cycleLengthWeeks: number;
  employeeCount?: number;
  patternConfig: CustomRotationPatternConfig;
  startsAt: string;
  endsAt?: string;
  teamId?: number;
}

/**
 * Generate rotation request to backend
 */
export interface GenerateRotationRequest {
  config: {
    shiftBlockLength: number;
    freeDays: number;
    startShift: ShiftType;
    shiftSequence: ShiftType[];
    specialRules?: NthWeekdayFreeRule[];
  };
  assignments: EmployeeAssignment[];
  startDate: string;
  endDate: string;
  teamId?: number;
  departmentId?: number;
}

/**
 * Pattern template for UI display
 */
export interface PatternTemplate {
  id: string;
  name: string;
  description: string;
  employeeCount: number;
  cycleWeeks: number;
  preview: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Predefined Pattern Templates
 */
export const PATTERN_TEMPLATES: PatternTemplate[] = [
  {
    id: 'auto-detect',
    name: 'Automatische Mustererkennung',
    description:
      'System erkennt das Schichtmuster automatisch aus den ersten 2 Wochen und wiederholt es für den gewählten Zeitraum',
    employeeCount: 0,
    cycleWeeks: 2,
    preview: 'Woche 1 + 2 im Grid ausfüllen → Muster wird automatisch wiederholt',
  },
];

/**
 * Day names for iteration
 */
export const DAY_NAMES = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

/**
 * Weekday names in German
 */
export const WEEKDAY_NAMES_DE = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
] as const;

// =============================================================================
// FORM HELPERS
// =============================================================================

/**
 * Default custom rotation form values
 */
export interface CustomRotationFormValues {
  shiftBlockLength: number;
  freeDays: number;
  startShift: ShiftType;
  shiftSequence: 'early-late-night' | 'night-late-early';
  startDate: string;
  endDate: string;
  nthWeekdayFreeEnabled: boolean;
  nthValue: number;
  weekdayValue: number;
}

/**
 * Get default custom rotation form values
 */
export function getDefaultCustomRotationFormValues(): CustomRotationFormValues {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0] ?? '';
  const endOfKW1 = getEndOfFirstWeekNextYear(today);

  return {
    shiftBlockLength: 10,
    freeDays: 2,
    startShift: 'early',
    shiftSequence: 'early-late-night',
    startDate: todayStr,
    endDate: endOfKW1.toISOString().split('T')[0] ?? '',
    nthWeekdayFreeEnabled: false,
    nthValue: 4,
    weekdayValue: 0, // Sunday
  };
}

/**
 * Get end of first week (Sunday) of next year
 */
export function getEndOfFirstWeekNextYear(fromDate: Date): Date {
  const nextYear = fromDate.getFullYear() + 1;
  // Find first Thursday of next year (determines KW1)
  const jan1 = new Date(nextYear, 0, 1);
  const dayOfWeek = jan1.getDay() === 0 ? 7 : jan1.getDay(); // Sunday = 7
  const daysToThursday = (4 - dayOfWeek + 7) % 7 === 0 ? 7 : (4 - dayOfWeek + 7) % 7;
  const firstThursday = new Date(nextYear, 0, 1 + daysToThursday);

  // Go to Sunday of that week
  const sundayKW1 = new Date(firstThursday);
  sundayKW1.setDate(firstThursday.getDate() + (7 - firstThursday.getDay()));

  return sundayKW1;
}

/**
 * Parse shift sequence string into array
 */
export function parseShiftSequence(value: string): ShiftType[] {
  if (value === 'night-late-early') {
    return ['night', 'late', 'early'];
  }
  return ['early', 'late', 'night']; // Default forward rotation
}

/**
 * Collect special rules from form values
 */
export function collectSpecialRules(formValues: CustomRotationFormValues): NthWeekdayFreeRule[] {
  const rules: NthWeekdayFreeRule[] = [];

  if (formValues.nthWeekdayFreeEnabled) {
    const weekdayName = WEEKDAY_NAMES_DE[formValues.weekdayValue] ?? 'Tag';

    rules.push({
      type: 'nth_weekday_free',
      name: `Jeder ${formValues.nthValue}. ${weekdayName} frei`,
      weekday: formValues.weekdayValue,
      n: formValues.nthValue,
    });
  }

  return rules;
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate custom rotation form
 */
export function validateCustomRotationForm(formValues: CustomRotationFormValues): {
  valid: boolean;
  error?: string;
} {
  if (formValues.shiftBlockLength < 1 || formValues.shiftBlockLength > 30) {
    return { valid: false, error: 'Schichtblock-Länge muss zwischen 1 und 30 Tagen liegen' };
  }

  if (formValues.freeDays < 0 || formValues.freeDays > 7) {
    return { valid: false, error: 'Freie Tage müssen zwischen 0 und 7 liegen' };
  }

  if (formValues.startDate === '') {
    return { valid: false, error: 'Bitte wählen Sie ein Startdatum' };
  }

  if (formValues.endDate === '') {
    return { valid: false, error: 'Bitte wählen Sie ein Enddatum' };
  }

  const startDate = new Date(formValues.startDate);
  const endDate = new Date(formValues.endDate);

  if (endDate < startDate) {
    return { valid: false, error: 'Enddatum muss nach dem Startdatum liegen' };
  }

  return { valid: true };
}

/**
 * Validate employee assignments
 */
export function validateEmployeeAssignments(assignments: EmployeeAssignment[]): {
  valid: boolean;
  error?: string;
} {
  if (assignments.length === 0) {
    return {
      valid: false,
      error: 'Bitte weisen Sie mindestens einem Mitarbeiter eine Schichtgruppe zu',
    };
  }

  // Check for duplicate users
  const userIds = assignments.map((a) => a.userId);
  const uniqueUserIds = new Set(userIds);
  if (userIds.length !== uniqueUserIds.size) {
    return {
      valid: false,
      error: 'Ein Mitarbeiter kann nur einer Schichtgruppe zugewiesen werden',
    };
  }

  return { valid: true };
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Generate custom rotation via API
 */
export async function generateCustomRotation(
  request: GenerateRotationRequest,
): Promise<{ success: boolean; shiftsGenerated?: number; error?: string }> {
  try {
    const response = await apiClient.post<{ shiftsGenerated: number }>(
      '/shifts/rotation/generate-custom',
      request,
    );
    return { success: true, shiftsGenerated: response.shiftsGenerated };
  } catch (error) {
    console.error('[CUSTOM ROTATION] Error generating rotation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Fehler beim Generieren der Rotation',
    };
  }
}

/**
 * Build generate rotation request from form values and assignments
 */
export function buildGenerateRotationRequest(
  formValues: CustomRotationFormValues,
  assignments: EmployeeAssignment[],
  teamId?: number,
  departmentId?: number,
): GenerateRotationRequest {
  const specialRules = collectSpecialRules(formValues);

  return {
    config: {
      shiftBlockLength: formValues.shiftBlockLength,
      freeDays: formValues.freeDays,
      startShift: formValues.startShift,
      shiftSequence: parseShiftSequence(formValues.shiftSequence),
      specialRules: specialRules.length > 0 ? specialRules : undefined,
    },
    assignments,
    startDate: formValues.startDate,
    endDate: formValues.endDate,
    teamId,
    departmentId,
  };
}

// =============================================================================
// STATE HELPERS
// =============================================================================

/**
 * Create empty day schedule
 */
export function createEmptyDaySchedule(): DaySchedule {
  return {
    early: [],
    late: [],
    night: [],
    free: [],
  };
}

/**
 * Create empty week data
 */
export function createEmptyWeekData(): WeekData {
  return {
    monday: createEmptyDaySchedule(),
    tuesday: createEmptyDaySchedule(),
    wednesday: createEmptyDaySchedule(),
    thursday: createEmptyDaySchedule(),
    friday: createEmptyDaySchedule(),
    saturday: createEmptyDaySchedule(),
    sunday: createEmptyDaySchedule(),
  };
}

/**
 * Convert shift group to shift type
 */
export function shiftGroupToType(group: ShiftGroup): ShiftType {
  if (group === 'F') return 'early';
  if (group === 'S') return 'late';
  return 'night';
}

/**
 * Convert shift type to shift group
 */
export function shiftTypeToGroup(type: ShiftType): ShiftGroup {
  if (type === 'early') return 'F';
  if (type === 'late') return 'S';
  return 'N';
}
