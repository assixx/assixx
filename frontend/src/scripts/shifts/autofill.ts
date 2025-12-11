/**
 * Autofill Logic for Shift Planning System
 * Handles automatic filling of shift assignments across weekdays
 *
 * @module shifts/autofill
 */

import type { Employee } from './types';
import { showSuccessAlert } from '../utils/alerts';
import {
  getAutofillConfig,
  getEmployees,
  getWeeklyShifts,
  getShiftDetails,
  isAdmin as getIsAdmin,
  getCurrentPlanId,
} from './state';
import { validateEmployeeAvailability, checkDuplicateShiftAssignment } from './validation';
import { updateShiftCellContent, getShiftName } from './ui';
import { CSS_SELECTORS } from './constants';

// ============== AUTOFILL STATE ==============

/** Flag to prevent recursive autofill */
let isAutofilling = false;

// ============== AUTOFILL HELPERS ==============

/**
 * Get weekdays to fill (excluding the already assigned day)
 */
function getDaysToFill(excludeDay: string): string[] {
  const weekDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  return weekDays.filter((day) => day !== excludeDay);
}

/**
 * Get employees assigned to a shift on a specific date
 * Helper function for validation
 */
function getShiftEmployeesForDate(date: string, shiftType: string): number[] {
  const weeklyShifts = getWeeklyShifts();
  const dayShifts = weeklyShifts.get(date);
  if (dayShifts === undefined) return [];
  return dayShifts.get(shiftType) ?? [];
}

// ============== AUTOFILL VALIDATION ==============

/**
 * Validate if autofill can proceed for a given cell
 * Returns { valid: true, employee, date } or { valid: false }
 */
function validateAutofillCell(
  cell: HTMLElement,
  weekDay: string,
  shiftType: string,
  employeeId: number,
): { valid: false } | { valid: true; employee: Employee; date: string } {
  const date = cell.dataset['date'];
  if (date === undefined) {
    return { valid: false };
  }

  // Check if already has an employee assigned
  if (cell.querySelector('.employee-card') !== null) {
    console.info('[SHIFTS AUTOFILL] Skipping', weekDay, '- already has employee');
    return { valid: false };
  }

  // Get employee
  const employee = getEmployees().find((e) => e.id === employeeId);
  if (employee === undefined) {
    return { valid: false };
  }

  // Check availability
  if (!validateEmployeeAvailability(employee, date).valid) {
    console.info('[SHIFTS AUTOFILL] Skipping', weekDay, '- employee not available');
    return { valid: false };
  }

  // Check for duplicate shift
  if (!checkDuplicateShiftAssignment(employee, date, shiftType, getShiftEmployeesForDate).valid) {
    console.info('[SHIFTS AUTOFILL] Skipping', weekDay, '- would create duplicate shift');
    return { valid: false };
  }

  return { valid: true, employee, date };
}

// ============== AUTOFILL SINGLE DAY ==============

/**
 * Fill a single day with the employee assignment
 * Returns true if filled, false if skipped
 */
function autofillSingleDay(weekDay: string, shiftType: string, employeeId: number): boolean {
  const cell = document.querySelector<HTMLElement>(`.shift-cell[data-day="${weekDay}"][data-shift="${shiftType}"]`);
  if (cell === null) {
    return false;
  }

  const validation = validateAutofillCell(cell, weekDay, shiftType, employeeId);
  if (!validation.valid) {
    return false;
  }

  const { employee, date } = validation;
  console.info('[SHIFTS AUTOFILL] Assigning', weekDay, 'for employee:', employeeId);

  // Add to local state
  const weeklyShifts = getWeeklyShifts();
  if (!weeklyShifts.has(date)) {
    weeklyShifts.set(date, new Map());
  }
  const dayShifts = weeklyShifts.get(date);
  if (dayShifts !== undefined) {
    const currentEmployees = dayShifts.get(shiftType) ?? [];
    if (!currentEmployees.includes(employeeId)) {
      currentEmployees.push(employeeId);
      dayShifts.set(shiftType, currentEmployees);
    }
  }

  // Add to shift details
  const shiftDetails = getShiftDetails();
  const detailKey = `${date}_${shiftType}_${String(employeeId)}`;
  shiftDetails.set(detailKey, {
    employeeId,
    firstName: employee.firstName ?? '',
    lastName: employee.lastName ?? '',
    username: employee.username,
    date,
    shiftType,
  });

  // Update cell content
  const assignmentDiv = cell.querySelector(CSS_SELECTORS.EMPLOYEE_ASSIGNMENT);
  if (assignmentDiv !== null) {
    const updatedEmployees = dayShifts?.get(shiftType) ?? [employeeId];
    updateShiftCellContent(
      assignmentDiv,
      updatedEmployees,
      getEmployees(),
      shiftDetails,
      date,
      shiftType,
      getIsAdmin(),
      true,
      getCurrentPlanId(),
    );
  }

  return true;
}

// ============== MAIN AUTOFILL FUNCTION ==============

/**
 * Perform autofill for all weekdays
 * Assigns the same employee to the same shift type for all weekdays
 */
export function performAutofill(employeeId: number, assignedDay: string, shiftType: string): void {
  const autofillConfig = getAutofillConfig();
  if (!autofillConfig.enabled || isAutofilling) {
    return;
  }

  isAutofilling = true;
  const daysToFill = getDaysToFill(assignedDay);
  console.info('[SHIFTS AUTOFILL] Filling week for employee:', employeeId, 'Shift type:', shiftType);

  let filledCount = 0;
  for (const weekDay of daysToFill) {
    if (autofillSingleDay(weekDay, shiftType, employeeId)) {
      filledCount++;
    }
  }

  isAutofilling = false;

  if (filledCount > 0) {
    const shiftName = getShiftName(shiftType);
    showSuccessAlert(`Autofill: ${String(filledCount)} weitere Tage mit ${shiftName} ausgefüllt`);
  }
}
