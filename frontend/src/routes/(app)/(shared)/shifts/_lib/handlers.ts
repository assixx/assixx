// =============================================================================
// SHIFTS - EVENT HANDLERS
// Based on: frontend/src/scripts/shifts/handlers/*.ts
// Adapted for Svelte 5 (pure functions for use in components)
// =============================================================================

import { performAutofill, type AutofillConfig, type AutofillResult } from './autofill';
import { getDropTargetData, getEmployeeIdFromDrag } from './drag-drop';
import {
  validateEmployeeAvailability,
  checkDuplicateShiftAssignment,
  checkAlreadyAssigned,
} from './validation';

import type { Employee, ShiftType, SelectedContext } from './types';

// =============================================================================
// SHIFT ASSIGNMENT HANDLERS
// =============================================================================

/**
 * Result of shift assignment validation
 */
export interface ShiftAssignmentValidationResult {
  valid: boolean;
  error?: string;
  employee?: Employee;
}

/**
 * Validate shift assignment before executing
 */
export function validateShiftAssignment(
  employeeId: number,
  date: string,
  shiftType: ShiftType,
  employees: Employee[],
  getShiftEmployees: (date: string, shiftType: string) => number[],
): ShiftAssignmentValidationResult {
  // Find employee
  const employee = employees.find((e) => e.id === employeeId);
  if (employee === undefined) {
    return { valid: false, error: 'Mitarbeiter nicht gefunden' };
  }

  // Check if already assigned to this shift
  const alreadyAssigned = checkAlreadyAssigned(employeeId, date, shiftType, getShiftEmployees);
  if (!alreadyAssigned.valid) {
    return { valid: false, error: alreadyAssigned.message };
  }

  // Check availability
  const availability = validateEmployeeAvailability(employee, date);
  if (!availability.valid) {
    return { valid: false, error: availability.message };
  }

  // Check for duplicate shift on same day
  const duplicate = checkDuplicateShiftAssignment(employee, date, shiftType, getShiftEmployees);
  if (!duplicate.valid) {
    return { valid: false, error: duplicate.message };
  }

  return { valid: true, employee };
}

/**
 * Result of shift assignment
 */
export interface ShiftAssignmentResult {
  success: boolean;
  error?: string;
  autofillResult?: AutofillResult;
}

/**
 * Handle shift assignment with optional autofill
 */
export function handleShiftAssignment(
  employeeId: number,
  date: string,
  shiftType: ShiftType,
  day: string,
  employees: Employee[],
  weekDates: Date[],
  weeklyShifts: Map<string, Map<string, number[]>>,
  autofillConfig: AutofillConfig,
  getShiftEmployees: (date: string, shiftType: string) => number[],
  onAssign: (date: string, shiftType: ShiftType, employeeId: number) => void,
): ShiftAssignmentResult {
  // Validate first
  const validation = validateShiftAssignment(
    employeeId,
    date,
    shiftType,
    employees,
    getShiftEmployees,
  );

  if (!validation.valid || validation.employee === undefined) {
    return { success: false, error: validation.error };
  }

  // Perform the assignment
  onAssign(date, shiftType, employeeId);

  // Perform autofill if enabled
  let autofillResult: AutofillResult | undefined;
  if (autofillConfig.enabled) {
    autofillResult = performAutofill(
      employeeId,
      validation.employee,
      day,
      shiftType,
      weekDates,
      autofillConfig,
      getShiftEmployees,
      weeklyShifts,
      onAssign,
    );
  }

  return { success: true, autofillResult };
}

// =============================================================================
// SHIFT REMOVAL HANDLERS
// =============================================================================

/**
 * Handle shift removal
 */
export function handleShiftRemoval(
  employeeId: number,
  date: string,
  shiftType: ShiftType,
  onRemove: (date: string, shiftType: ShiftType, employeeId: number) => void,
): void {
  onRemove(date, shiftType, employeeId);
}

// =============================================================================
// DROP HANDLERS
// =============================================================================

/**
 * Handle drop event on shift cell
 */
export function handleShiftCellDrop(
  e: DragEvent,
  employees: Employee[],
  weekDates: Date[],
  weeklyShifts: Map<string, Map<string, number[]>>,
  autofillConfig: AutofillConfig,
  getShiftEmployees: (date: string, shiftType: string) => number[],
  onAssign: (date: string, shiftType: ShiftType, employeeId: number) => void,
  onError: (message: string) => void,
): ShiftAssignmentResult | null {
  e.preventDefault();

  const target = e.target as HTMLElement;
  const shiftCell = target.closest<HTMLElement>('.shift-cell');

  if (shiftCell === null) {
    return null;
  }

  shiftCell.classList.remove('drag-over');

  const employeeId = getEmployeeIdFromDrag(e.dataTransfer);
  const dropData = getDropTargetData(shiftCell);

  if (employeeId === null || dropData === null) {
    return null;
  }

  const result = handleShiftAssignment(
    employeeId,
    dropData.date,
    dropData.shiftType as ShiftType,
    dropData.day,
    employees,
    weekDates,
    weeklyShifts,
    autofillConfig,
    getShiftEmployees,
    onAssign,
  );

  if (!result.success && result.error !== undefined) {
    onError(result.error);
  }

  return result;
}

// =============================================================================
// SAVE/DISCARD HANDLERS
// =============================================================================

/**
 * Prepare save data for shift plan
 */
export function prepareSaveData(
  context: SelectedContext,
  weeklyShifts: Map<string, Map<string, number[]>>,
  notes: string,
  currentPlanId: number | null,
): {
  planData: {
    departmentId: number | null;
    teamId: number | null;
    assetId: number | null;
    areaId: number | null;
    notes: string;
    shifts: { date: string; shiftType: string; userIds: number[] }[];
  };
  isUpdate: boolean;
} {
  const shifts: { date: string; shiftType: string; userIds: number[] }[] = [];

  weeklyShifts.forEach((dayShifts, date) => {
    dayShifts.forEach((userIds, shiftType) => {
      if (userIds.length > 0) {
        shifts.push({
          date,
          shiftType,
          userIds,
        });
      }
    });
  });

  return {
    planData: {
      departmentId: context.departmentId,
      teamId: context.teamId,
      assetId: context.assetId,
      areaId: context.areaId,
      notes,
      shifts,
    },
    isUpdate: currentPlanId !== null,
  };
}

/**
 * Compare two number arrays for equality (order-independent)
 */
function areUserIdsEqual(current: number[], original: number[]): boolean {
  if (current.length !== original.length) return false;

  const sortedCurrent = [...current].sort((a, b) => a - b);
  const sortedOriginal = [...original].sort((a, b) => a - b);

  // Compare sorted arrays as strings to avoid dynamic index access warnings
  return sortedCurrent.join(',') === sortedOriginal.join(',');
}

/**
 * Compare two day shift maps for equality
 */
function areDayShiftsEqual(
  dayShifts: Map<string, number[]>,
  originalDayShifts: Map<string, number[]>,
): boolean {
  if (dayShifts.size !== originalDayShifts.size) return false;

  for (const [shiftType, userIds] of dayShifts) {
    const originalUserIds = originalDayShifts.get(shiftType);
    if (originalUserIds === undefined) return false;
    if (!areUserIdsEqual(userIds, originalUserIds)) return false;
  }

  return true;
}

/**
 * Check if there are unsaved changes
 */
export function hasUnsavedChanges(
  weeklyShifts: Map<string, Map<string, number[]>>,
  originalWeeklyShifts: Map<string, Map<string, number[]>> | null,
): boolean {
  if (originalWeeklyShifts === null) {
    return weeklyShifts.size > 0;
  }

  if (weeklyShifts.size !== originalWeeklyShifts.size) return true;

  for (const [date, dayShifts] of weeklyShifts) {
    const originalDayShifts = originalWeeklyShifts.get(date);
    if (originalDayShifts === undefined) return true;
    if (!areDayShiftsEqual(dayShifts, originalDayShifts)) return true;
  }

  return false;
}

// =============================================================================
// LOCK MODE HANDLERS
// =============================================================================

/**
 * Handle lock/unlock toggle
 */
export function handleLockModeToggle(
  isLocked: boolean,
  onToggle: (newLockState: boolean) => void,
): void {
  onToggle(!isLocked);
}

// =============================================================================
// WEEK NAVIGATION HANDLERS
// =============================================================================

/**
 * Handle week navigation
 */
export function handleWeekNavigation(
  currentWeek: Date,
  direction: 'prev' | 'next' | 'today',
  onWeekChange: (newWeek: Date) => void,
): void {
  let newWeek: Date;

  if (direction === 'today') {
    // Navigate to current week
    newWeek = new Date();
    const dayOfWeek = newWeek.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    newWeek.setDate(newWeek.getDate() + diff);
  } else if (direction === 'prev') {
    newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() - 7);
  } else {
    newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + 7);
  }

  onWeekChange(newWeek);
}

// =============================================================================
// DROPDOWN HANDLERS
// =============================================================================

/**
 * Handle dropdown option selection
 */
export function handleDropdownSelect(
  item: { id: number; name: string },
  onSelect: (id: number, name: string) => void,
  closeDropdown: () => void,
): void {
  onSelect(item.id, item.name);
  closeDropdown();
}

/**
 * Handle click outside for closing dropdowns
 */
export function handleClickOutside(
  event: MouseEvent,
  dropdownContainers: HTMLElement[],
  closeAllDropdowns: () => void,
): void {
  const target = event.target as Node;

  for (const container of dropdownContainers) {
    if (container.contains(target)) {
      return; // Click was inside a dropdown
    }
  }

  closeAllDropdowns();
}

// =============================================================================
// DRAG EVENT HANDLERS (Pure DOM manipulation)
// =============================================================================

/**
 * Handle dragover event - prevent default to allow drop
 */
export function handleDragOverEvent(event: DragEvent, canEdit: boolean): void {
  if (!canEdit) return;
  event.preventDefault();
}

/**
 * Handle dragenter event - add visual feedback
 */
export function handleDragEnterEvent(event: DragEvent, canEdit: boolean): void {
  if (!canEdit) return;
  event.preventDefault();

  const target = event.target as HTMLElement;
  const shiftCell = target.closest('.shift-cell');
  if (shiftCell !== null) {
    shiftCell.classList.add('drag-over');
  }
}

/**
 * Handle dragleave event - remove visual feedback
 */
export function handleDragLeaveEvent(event: DragEvent): void {
  const target = event.target as HTMLElement;
  const shiftCell = target.closest('.shift-cell');
  if (shiftCell === null) return;

  // Check if we're leaving to a child element (don't remove class)
  const relatedTarget = event.relatedTarget as HTMLElement | null;
  if (relatedTarget !== null && shiftCell.contains(relatedTarget)) {
    return;
  }

  shiftCell.classList.remove('drag-over');
}

/**
 * Handle dragstart event - set drag data
 */
export function handleDragStartEvent(
  event: DragEvent,
  employeeId: number,
  isLocked: boolean,
  onDragStart: () => void,
): void {
  if (isLocked) {
    event.preventDefault();
    return;
  }

  event.dataTransfer?.setData('text/plain', String(employeeId));
  onDragStart();
}

/**
 * Handle dragend event - cleanup
 */
export function handleDragEndEvent(onDragEnd: () => void): void {
  onDragEnd();
}

// =============================================================================
// SHIFT GRID HELPERS
// =============================================================================

/**
 * Check if any employee in a shift cell is from rotation history
 */
export function checkRotationShifts(
  dateKey: string,
  shiftType: string,
  employeeIds: number[],
  rotationHistoryMap: Map<string, unknown>,
): boolean {
  if (rotationHistoryMap.size === 0) return false;
  return employeeIds.some((empId) => {
    const historyKey = `${dateKey}_${shiftType}_${empId}`;
    return rotationHistoryMap.has(historyKey);
  });
}

/**
 * Get employees assigned to a specific shift
 */
export function getShiftEmployeesFromMap(
  dateKey: string,
  shiftType: string,
  weeklyShifts: Map<string, Map<string, number[]>>,
): number[] {
  const dayShifts = weeklyShifts.get(dateKey);
  if (dayShifts === undefined) return [];
  return dayShifts.get(shiftType) ?? [];
}

/**
 * Remove employee from a shift in the weekly shifts map
 * Returns a new map (immutable update)
 */
export function removeEmployeeFromShiftMap(
  dateKey: string,
  shiftType: string,
  employeeId: number,
  weeklyShifts: Map<string, Map<string, number[]>>,
): Map<string, Map<string, number[]>> {
  const newShifts = new Map(weeklyShifts);
  const dayShifts = newShifts.get(dateKey);

  if (dayShifts === undefined) return newShifts;

  const shiftEmployees = dayShifts.get(shiftType);
  if (shiftEmployees === undefined) return newShifts;

  const filteredEmployees = shiftEmployees.filter((id) => id !== employeeId);

  const newDayShifts = new Map(dayShifts);
  newDayShifts.set(shiftType, filteredEmployees);
  newShifts.set(dateKey, newDayShifts);

  return newShifts;
}

// =============================================================================
// DROP VALIDATION & ASSIGNMENT
// =============================================================================

/**
 * Result of drop validation
 */
export interface DropValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

/**
 * Validate drop operation before assignment
 */
export function validateDropOperation(
  employeeId: number,
  dateKey: string,
  shiftType: string,
  employees: Employee[],
  getShiftEmployees: (date: string, shiftType: string) => number[],
): DropValidationResult {
  // Find employee
  const employee = employees.find((e) => e.id === employeeId);
  if (employee === undefined) {
    return { valid: false, error: 'Mitarbeiter nicht gefunden' };
  }

  // 1. Check if employee is available on this date
  const availabilityResult = validateEmployeeAvailability(employee, dateKey);
  if (!availabilityResult.valid) {
    return {
      valid: false,
      error: availabilityResult.message ?? 'Mitarbeiter nicht verfügbar',
    };
  }

  // 2. Check if employee is already assigned to another shift on the same day (Doppelschicht!)
  const duplicateResult = checkDuplicateShiftAssignment(
    employee,
    dateKey,
    shiftType,
    getShiftEmployees,
  );
  if (!duplicateResult.valid) {
    return {
      valid: false,
      error: duplicateResult.message ?? 'Doppelschicht nicht erlaubt',
    };
  }

  // 3. Check if employee is already assigned to THIS shift
  const currentEmployeesForShift = getShiftEmployees(dateKey, shiftType);
  if (currentEmployeesForShift.includes(employeeId)) {
    return {
      valid: false,
      warning: 'Mitarbeiter ist bereits dieser Schicht zugewiesen',
    };
  }

  return { valid: true };
}

/**
 * Add employee to shift in weeklyShifts map (immutable - DEEP COPY for Svelte reactivity)
 */
export function addEmployeeToShiftMap(
  dateKey: string,
  shiftType: string,
  employeeId: number,
  weeklyShifts: Map<string, Map<string, number[]>>,
): Map<string, Map<string, number[]>> {
  // DEEP COPY: Create new outer Map with deep-copied inner Maps
  const newShifts = new Map<string, Map<string, number[]>>();
  for (const [date, dayShifts] of weeklyShifts.entries()) {
    const newDayShifts = new Map<string, number[]>();
    for (const [shift, employees] of dayShifts.entries()) {
      newDayShifts.set(shift, [...employees]); // Copy array
    }
    newShifts.set(date, newDayShifts);
  }

  // Ensure dayShifts map exists for this date
  let dayShifts = newShifts.get(dateKey);
  if (dayShifts === undefined) {
    dayShifts = new Map();
    newShifts.set(dateKey, dayShifts);
  }

  // Ensure employees array exists for this shift type
  let shiftEmployees = dayShifts.get(shiftType);
  if (shiftEmployees === undefined) {
    shiftEmployees = [];
    dayShifts.set(shiftType, shiftEmployees);
  }

  // Add employee if not already assigned
  if (!shiftEmployees.includes(employeeId)) {
    shiftEmployees.push(employeeId);
  }

  return newShifts;
}

/**
 * Create shift detail entry
 */
export interface ShiftDetailEntry {
  employeeId: number;
  firstName: string;
  lastName: string;
  username: string;
  date: string;
  shiftType: string;
  isRotationShift?: boolean;
}

/**
 * Build shift detail from employee
 */
export function buildShiftDetail(
  employee: Employee,
  dateKey: string,
  shiftType: string,
): ShiftDetailEntry {
  return {
    employeeId: employee.id,
    firstName: employee.firstName ?? '',
    lastName: employee.lastName ?? '',
    username: employee.username,
    date: dateKey,
    shiftType,
  };
}
