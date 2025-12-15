/**
 * Shift Action Handlers for Shift Planning System
 * Handles shift drop, remove, and validation
 *
 * @module shifts/handlers/shift-actions
 */

import type { Employee } from '../types';
import { showInfo } from '../../auth/index';
import { showSuccessAlert, showErrorAlert } from '../../utils/alerts';
import {
  getSelectedContext,
  getEmployees,
  getWeeklyShifts,
  getShiftDetails,
  isAdmin as getIsAdmin,
  isEditMode as getIsEditMode,
  getCurrentPlanId,
  getMemberNameById,
  setIsEditMode,
  getRotationHistoryMap,
  addPendingRotationDeletion,
} from '../state';
import { assignShift } from '../api';
import { updateShiftCellContent, getShiftName } from '../ui';
import { CSS_SELECTORS } from '../constants';
import { getShiftDataFromCell } from '../drag-drop';
import { validateEmployeeAvailability, checkDuplicateShiftAssignment } from '../validation';
import { getShiftTimeRange } from '../utils';
import { getShiftEmployeesForDate, addEmployeeToShift, removeEmployeeFromShift } from '../data-processing';
import { performAutofill } from '../autofill';

// ============== VALIDATION ==============

/**
 * Validate shift assignment before API call
 * Returns employee if valid, null if invalid (shows error)
 */
export function validateShiftAssignmentDrop(employeeId: number, date: string, shiftType: string): Employee | null {
  const employee = getEmployees().find((e) => e.id === employeeId);
  if (employee === undefined) {
    showErrorAlert('Mitarbeiter nicht gefunden');
    return null;
  }

  // 1. Check if employee is available on this date
  const availabilityResult = validateEmployeeAvailability(employee, date);
  if (!availabilityResult.valid) {
    showErrorAlert(availabilityResult.message ?? 'Mitarbeiter nicht verfügbar');
    return null;
  }

  // 2. Check if employee is already assigned to another shift on the same day
  const duplicateResult = checkDuplicateShiftAssignment(employee, date, shiftType, getShiftEmployeesForDate);
  if (!duplicateResult.valid) {
    showErrorAlert(duplicateResult.message ?? 'Doppelschicht nicht erlaubt');
    return null;
  }

  // 3. Check if employee is already assigned to THIS shift
  const currentEmployees = getShiftEmployeesForDate(date, shiftType);
  if (currentEmployees.includes(employeeId)) {
    showInfo('Mitarbeiter ist bereits dieser Schicht zugewiesen');
    return null;
  }

  return employee;
}

// ============== SHIFT DROP ==============

/**
 * Handle shift drop
 * Updates local state immediately for instant visual feedback,
 * then syncs with server
 */
export async function handleShiftDrop(employeeId: number, cell: HTMLElement): Promise<void> {
  const shiftData = getShiftDataFromCell(cell);
  const date = shiftData.date;
  const shiftType = shiftData.shift ?? shiftData.shiftType;

  if (date === undefined || shiftType === undefined) {
    showErrorAlert('Ungültige Schichtzelle');
    return;
  }

  // Validate assignment (returns employee if valid, null if invalid)
  const employee = validateShiftAssignmentDrop(employeeId, date, shiftType);
  if (employee === null) {
    return;
  }

  const context = getSelectedContext();
  const timeRange = getShiftTimeRange(shiftType);

  try {
    await assignShift({
      userId: employeeId,
      date,
      type: shiftType,
      departmentId: context.departmentId,
      teamId: context.teamId,
      machineId: context.machineId,
      startTime: timeRange.start,
      endTime: timeRange.end,
    });

    // === IMMEDIATE LOCAL STATE UPDATE ===
    addEmployeeToShift(date, shiftType, employeeId, employee);

    // === IMMEDIATE VISUAL UPDATE OF CELL ===
    const assignmentDiv = cell.querySelector(CSS_SELECTORS.EMPLOYEE_ASSIGNMENT);
    if (assignmentDiv !== null) {
      const weeklyShifts = getWeeklyShifts();
      const dayShifts = weeklyShifts.get(date);
      const updatedEmployees = dayShifts?.get(shiftType) ?? [employeeId];
      updateShiftCellContent(
        assignmentDiv,
        updatedEmployees,
        getEmployees(),
        getShiftDetails(),
        date,
        shiftType,
        getIsAdmin(),
        true, // isEditMode - after drop we are in edit mode
        getCurrentPlanId(),
      );
    }

    showSuccessAlert(`${getMemberNameById(employeeId)} zur ${getShiftName(shiftType)} hinzugefügt`);

    // Mark as edit mode
    setIsEditMode(true);

    // Trigger autofill if enabled (fills the rest of the week with same shift)
    const dayName = cell.dataset['day'];
    if (dayName !== undefined) {
      performAutofill(employeeId, dayName, shiftType);
    }

    // No renderCurrentWeek() needed - state is already updated locally
    // Server sync happens on next load or save
  } catch (error) {
    console.error('[SHIFTS] Failed to assign shift:', error);
    showErrorAlert('Fehler beim Zuweisen der Schicht');
  }
}

// ============== SHIFT REMOVAL ==============

/**
 * Handle removing a shift assignment
 */
export function handleRemoveShiftAction(target: HTMLElement, _event: Event): void {
  const employeeIdStr = target.dataset['employeeId'];
  if (employeeIdStr === undefined) {
    console.warn('[SHIFTS] Remove failed: employeeId is undefined');
    return;
  }

  const cell = target.closest('.shift-cell');
  if (cell === null) {
    console.warn('[SHIFTS] Remove failed: could not find parent .shift-cell');
    return;
  }

  const shiftData = getShiftDataFromCell(cell as HTMLElement);
  const date = shiftData.date;
  const shiftType = shiftData.shift ?? shiftData.shiftType;

  if (date === undefined || shiftType === undefined) {
    console.warn('[SHIFTS] Remove failed: date or shiftType undefined');
    return;
  }

  const employeeId = Number.parseInt(employeeIdStr, 10);

  // Check if this is a rotation history entry and track for deletion on save
  const historyKey = `${date}_${shiftType}_${String(employeeId)}`;
  const rotationHistoryMap = getRotationHistoryMap();
  const historyId = rotationHistoryMap.get(historyKey);
  if (historyId !== undefined) {
    addPendingRotationDeletion(historyId);
    console.info('[SHIFTS] Marked rotation history entry for deletion:', { historyKey, historyId });
  }

  // Remove from local state
  removeEmployeeFromShift(date, shiftType, employeeId);

  // Update cell content
  const assignmentDiv = cell.querySelector(CSS_SELECTORS.EMPLOYEE_ASSIGNMENT);
  if (assignmentDiv !== null) {
    const weeklyShifts = getWeeklyShifts();
    const dayShifts = weeklyShifts.get(date);
    const updatedEmployees = dayShifts?.get(shiftType) ?? [];
    updateShiftCellContent(
      assignmentDiv,
      updatedEmployees,
      getEmployees(),
      getShiftDetails(),
      date,
      shiftType,
      getIsAdmin(),
      getIsEditMode(),
      getCurrentPlanId(),
    );
  }

  showSuccessAlert('Schicht-Zuweisung entfernt');
}
