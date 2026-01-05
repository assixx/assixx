// =============================================================================
// SHIFTS - AUTOFILL LOGIC
// Based on: frontend/src/scripts/shifts/autofill.ts
// =============================================================================

import type { Employee, ShiftType } from './types';
import { validateEmployeeAvailability, checkDuplicateShiftAssignment } from './validation';
import { getShiftLabel } from './utils';

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
function getDaysToFill(excludeDay: string, skipWeekends: boolean = true): string[] {
  const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const weekDays = skipWeekends
    ? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
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
  const date = weekDates[dayIndex];
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
    return { valid: false, reason: availabilityResult.message ?? 'Nicht verfügbar' };
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

/**
 * Perform autofill for all weekdays
 * Assigns the same employee to the same shift type for all weekdays
 *
 * @param employeeId - The employee ID to assign
 * @param employee - The full employee object
 * @param assignedDay - The day that was already assigned (to skip)
 * @param shiftType - The shift type to assign
 * @param weekDates - Array of 7 dates for the current week
 * @param config - Autofill configuration
 * @param getShiftEmployees - Function to get current shift assignments
 * @param existingAssignments - Current weekly shift assignments (Map<date, Map<shiftType, employeeIds[]>>)
 * @param onAssign - Callback to perform the actual assignment
 * @returns AutofillResult with count and details
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
  // Skip if autofill disabled or already in progress
  if (!config.enabled || isAutofilling) {
    return { filled: 0, skipped: 0, details: [] };
  }

  isAutofilling = true;
  const daysToFill = getDaysToFill(assignedDay, config.skipWeekends);
  const details: AutofillDayResult[] = [];
  let filledCount = 0;
  let skippedCount = 0;

  console.info(
    '[SHIFTS AUTOFILL] Starting autofill for employee:',
    employeeId,
    'Shift:',
    shiftType,
  );

  for (const dayName of daysToFill) {
    const validation = validateAutofillDay(
      dayName,
      weekDates,
      shiftType,
      employee,
      getShiftEmployees,
      existingAssignments,
    );

    if (!validation.valid) {
      console.info('[SHIFTS AUTOFILL] Skipping', dayName, '-', validation.reason);
      details.push({
        date: getDateForDay(weekDates, dayName),
        day: dayName,
        success: false,
        reason: validation.reason,
      });
      skippedCount++;
      continue;
    }

    // Perform the assignment via callback
    console.info('[SHIFTS AUTOFILL] Assigning', dayName, 'for employee:', employeeId);
    onAssign(validation.date, shiftType, employeeId);
    details.push({
      date: validation.date,
      day: dayName,
      success: true,
    });
    filledCount++;
  }

  isAutofilling = false;

  if (filledCount > 0) {
    const shiftName = getShiftLabel(shiftType);
    console.info(`[SHIFTS AUTOFILL] Completed: ${filledCount} days filled with ${shiftName}`);
  }

  return {
    filled: filledCount,
    skipped: skippedCount,
    details,
  };
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
