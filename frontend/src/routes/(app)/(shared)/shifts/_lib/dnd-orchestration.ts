// =============================================================================
// SHIFTS - DRAG & DROP ORCHESTRATION
// Extracted from +page.svelte for modularity
// =============================================================================

import { showSuccessAlert, showErrorAlert, showWarningAlert } from '$lib/utils/alerts';
import { createLogger } from '$lib/utils/logger';

import { performAutofill } from './autofill';
import { getEmployeeIdFromDrag } from './drag-drop';
import {
  handleDragOverEvent,
  handleDragEnterEvent,
  handleDragLeaveEvent,
  handleDragStartEvent,
  handleDragEndEvent,
  validateDropOperation,
  addEmployeeToShiftMap,
  buildShiftDetail,
  type DropValidationResult,
} from './handlers';
import { shiftsState } from './state.svelte';
import { getWeekDates, getEmployeeDisplayName, getShiftLabel } from './utils';

import type { Employee, ShiftType } from './types';

const log = createLogger('ShiftsDnD');

// =============================================================================
// BASIC DRAG HANDLERS
// =============================================================================

/** Start drag - set data and check edit permission */
export function handleDragStart(event: DragEvent, employeeId: number): void {
  handleDragStartEvent(
    event,
    employeeId,
    !shiftsState.canEditShifts || (shiftsState.currentPlanId !== null && !shiftsState.isEditMode),
    () => {
      shiftsState.setIsDragging(true);
    },
  );
}

/** End drag - cleanup */
export function handleDragEnd(): void {
  handleDragEndEvent(() => {
    shiftsState.setIsDragging(false);
  });
}

/** Drag over - allow drop if editable */
export function handleDragOver(event: DragEvent): void {
  handleDragOverEvent(event, shiftsState.canEditShifts);
}

/** Drag enter - add visual feedback */
export function handleDragEnter(event: DragEvent): void {
  handleDragEnterEvent(event, shiftsState.canEditShifts);
}

/** Drag leave - remove visual feedback */
export function handleDragLeave(event: DragEvent): void {
  handleDragLeaveEvent(event);
}

// =============================================================================
// DROP HELPERS (private)
// =============================================================================

/** Display validation feedback to user */
function showValidationFeedback(validation: DropValidationResult): void {
  if (validation.warning !== undefined) {
    showWarningAlert(validation.warning);
  } else if (validation.error !== undefined) {
    showErrorAlert(validation.error);
  }
}

/** Perform shift assignment and update state */
function assignEmployeeToShift(
  employeeId: number,
  employee: Employee,
  dateKey: string,
  shiftType: string,
): void {
  const updatedShifts = addEmployeeToShiftMap(
    dateKey,
    shiftType,
    employeeId,
    shiftsState.weeklyShifts,
  );
  shiftsState.setWeeklyShifts(updatedShifts);

  const detailKey = `${dateKey}_${shiftType}_${employeeId}`;
  const newDetails = new Map(shiftsState.shiftDetails);
  newDetails.set(detailKey, buildShiftDetail(employee, dateKey, shiftType));
  shiftsState.setShiftDetails(newDetails);
}

/** Handle autofill execution after initial drop assignment */
function executeAutofill(
  employeeId: number,
  employee: Employee,
  dayName: string,
  shiftType: ShiftType,
  shiftLabel: string,
): void {
  const addAssignment = (date: string, shift: ShiftType, empId: number) => {
    const shifts = shiftsState.weeklyShifts;
    let dayShifts = shifts.get(date);
    if (dayShifts === undefined) {
      dayShifts = new Map<string, number[]>();
      shifts.set(date, dayShifts);
    }
    let empsInShift = dayShifts.get(shift);
    if (empsInShift === undefined) {
      empsInShift = [];
      dayShifts.set(shift, empsInShift);
    }
    if (!empsInShift.includes(empId)) empsInShift.push(empId);

    const emp = shiftsState.getEmployeeById(empId);
    if (emp !== undefined) {
      const details = new Map(shiftsState.shiftDetails);
      details.set(`${date}_${shift}_${empId}`, buildShiftDetail(emp, date, shift));
      shiftsState.setShiftDetails(details);
    }
  };

  const weekDates = getWeekDates(shiftsState.currentWeek);
  const autofillResult = performAutofill(
    employeeId,
    employee,
    dayName,
    shiftType,
    weekDates,
    shiftsState.autofillConfig,
    shiftsState.getShiftEmployees,
    shiftsState.weeklyShifts,
    addAssignment,
  );

  shiftsState.setWeeklyShifts(new Map(shiftsState.weeklyShifts));

  if (autofillResult.filled > 0) {
    showSuccessAlert(
      `Autofill: ${autofillResult.filled} weitere Tage mit ${shiftLabel} ausgefüllt`,
    );
  }
}

// =============================================================================
// DROP & REMOVE
// =============================================================================

/** Handle drop event - validate and assign employee to shift */
export function handleDrop(event: DragEvent, dateKey: string, shiftType: string): void {
  event.preventDefault();
  shiftsState.setIsDragging(false);

  const target = event.target as HTMLElement;
  const shiftCell = target.closest<HTMLElement>('.shift-cell');
  shiftCell?.classList.remove('drag-over');

  if (!shiftsState.canEditShifts) return;

  const employeeId = getEmployeeIdFromDrag(event.dataTransfer);
  if (employeeId === null) return;

  const validation = validateDropOperation(
    employeeId,
    dateKey,
    shiftType,
    shiftsState.employees,
    shiftsState.getShiftEmployees,
  );

  if (!validation.valid) {
    showValidationFeedback(validation);
    return;
  }

  const employee = shiftsState.getEmployeeById(employeeId);
  if (employee === undefined) {
    log.error({ employeeId }, 'Employee not found on drop');
    return;
  }

  assignEmployeeToShift(employeeId, employee, dateKey, shiftType);

  const employeeName = getEmployeeDisplayName(employee);
  const shiftLabel = getShiftLabel(shiftType as ShiftType);
  showSuccessAlert(`${employeeName} zur ${shiftLabel} hinzugefügt`);

  const dayName = shiftCell?.dataset.day;
  if (dayName !== undefined && shiftsState.autofillConfig.enabled) {
    executeAutofill(employeeId, employee, dayName, shiftType as ShiftType, shiftLabel);
  }
}

/** Remove employee from shift and show confirmation */
export function removeEmployeeFromShift(
  dateKey: string,
  shiftType: string,
  employeeId: number,
): void {
  shiftsState.removeShiftAssignment(dateKey, shiftType, employeeId);
  showSuccessAlert('Schicht-Zuweisung entfernt');
}
