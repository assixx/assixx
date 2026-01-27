// =============================================================================
// SHIFTS - AUTOFILL LOGIC
// Based on: frontend/src/scripts/shifts/autofill.ts
// =============================================================================

import {
  validateEmployeeAvailability,
  checkDuplicateShiftAssignment,
} from './validation';

import type { Employee, ShiftType } from './types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Autofill configuration
 */
export interface AutofillConfig {
  enabled: boolean;
  skipWeekends: boolean;
}

/**
 * Autofill result for a single day
 */
export interface AutofillDayResult {
  date: string;
  day: string;
  success: boolean;
  reason?: string;
}

/**
 * Complete autofill result
 */
export interface AutofillResult {
  filled: number;
  skipped: number;
  details: AutofillDayResult[];
}

// =============================================================================
// AUTOFILL STATE
// =============================================================================

/** Flag to prevent recursive autofill */
let isAutofilling = false;

// =============================================================================
// AUTOFILL HELPERS
// =============================================================================

/**
 * Get weekdays to fill (excluding the already assigned day)
 */
function getDaysToFill(
  excludeDay: string,
  skipWeekends: boolean = true,
): string[] {
  const allDays = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];
  const weekDays =
    skipWeekends ?
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    : allDays;
  return weekDays.filter((day) => day !== excludeDay);
}

/**
 * Convert day name to day index (0 = Monday, 6 = Sunday)
 */
function dayNameToIndex(dayName: string): number {
  const dayMap = new Map<string, number>([
    ['monday', 0],
    ['tuesday', 1],
    ['wednesday', 2],
    ['thursday', 3],
    ['friday', 4],
    ['saturday', 5],
    ['sunday', 6],
  ]);
  return dayMap.get(dayName) ?? 0;
}

/**
 * Get the date string for a specific day in the week
 */
function getDateForDay(weekDates: Date[], dayName: string): string {
  const dayIndex = dayNameToIndex(dayName);
  const date = weekDates.at(dayIndex);
  if (date === undefined) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// =============================================================================
// AUTOFILL VALIDATION
// =============================================================================

/**
 * Validate if autofill can proceed for a given day
 * Returns { valid: true, date } or { valid: false, reason }
 */
export function validateAutofillDay(
  dayName: string,
  weekDates: Date[],
  shiftType: ShiftType,
  employee: Employee,
  getShiftEmployees: (date: string, shiftType: string) => number[],
  existingAssignments: Map<string, Map<string, number[]>>,
): { valid: false; reason: string } | { valid: true; date: string } {
  const date = getDateForDay(weekDates, dayName);
  if (date === '') {
    return { valid: false, reason: 'Ungültiger Tag' };
  }

  // Check if already has an employee assigned in the current session
  const dayShifts = existingAssignments.get(date);
  const currentEmployees = dayShifts?.get(shiftType) ?? [];
  if (currentEmployees.length > 0) {
    return { valid: false, reason: 'Schicht bereits besetzt' };
  }

  // Check availability
  const availabilityResult = validateEmployeeAvailability(employee, date);
  if (!availabilityResult.valid) {
    return {
      valid: false,
      reason: availabilityResult.message ?? 'Nicht verfügbar',
    };
  }

  // Check for duplicate shift (employee already assigned to another shift on same day)
  const duplicateResult = checkDuplicateShiftAssignment(
    employee,
    date,
    shiftType,
    getShiftEmployees,
  );
  if (!duplicateResult.valid) {
    return { valid: false, reason: 'Doppelschicht nicht erlaubt' };
  }

  return { valid: true, date };
}

// =============================================================================
// MAIN AUTOFILL FUNCTION
// =============================================================================

interface ProcessDayParams {
  dayName: string;
  employeeId: number;
  employee: Employee;
  shiftType: ShiftType;
  weekDates: Date[];
  getShiftEmployees: (date: string, shiftType: string) => number[];
  existingAssignments: Map<string, Map<string, number[]>>;
  onAssign: (date: string, shiftType: ShiftType, employeeId: number) => void;
}

/**
 * Process autofill for a single day
 * @returns AutofillDayResult with success status and optional reason
 */
function processSingleDay(params: ProcessDayParams): AutofillDayResult {
  const {
    dayName,
    employeeId,
    employee,
    shiftType,
    weekDates,
    getShiftEmployees,
  } = params;
  const { existingAssignments, onAssign } = params;

  const validation = validateAutofillDay(
    dayName,
    weekDates,
    shiftType,
    employee,
    getShiftEmployees,
    existingAssignments,
  );

  if (!validation.valid) {
    return {
      date: getDateForDay(weekDates, dayName),
      day: dayName,
      success: false,
      reason: validation.reason,
    };
  }

  onAssign(validation.date, shiftType, employeeId);
  return { date: validation.date, day: dayName, success: true };
}

/**
 * Perform autofill for all weekdays
 * Assigns the same employee to the same shift type for all weekdays
 */
export function performAutofill(
  employeeId: number,
  employee: Employee,
  assignedDay: string,
  shiftType: ShiftType,
  weekDates: Date[],
  config: AutofillConfig,
  getShiftEmployees: (date: string, shiftType: string) => number[],
  existingAssignments: Map<string, Map<string, number[]>>,
  onAssign: (date: string, shiftType: ShiftType, employeeId: number) => void,
): AutofillResult {
  if (!config.enabled || isAutofilling) {
    return { filled: 0, skipped: 0, details: [] };
  }

  isAutofilling = true;

  const daysToFill = getDaysToFill(assignedDay, config.skipWeekends);
  const baseParams = {
    employeeId,
    employee,
    shiftType,
    weekDates,
    getShiftEmployees,
    existingAssignments,
    onAssign,
  };
  const details = daysToFill.map((dayName) =>
    processSingleDay({ dayName, ...baseParams }),
  );

  const filledCount = details.filter((d) => d.success).length;
  const skippedCount = details.filter((d) => !d.success).length;

  isAutofilling = false;

  return { filled: filledCount, skipped: skippedCount, details };
}

/**
 * Check if autofill is currently in progress
 */
export function isAutofillInProgress(): boolean {
  return isAutofilling;
}

/**
 * Reset autofill state (for testing/cleanup)
 */
export function resetAutofillState(): void {
  isAutofilling = false;
}
