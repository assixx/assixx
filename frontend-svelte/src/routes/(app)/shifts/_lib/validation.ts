// =============================================================================
// SHIFTS - VALIDATION FUNCTIONS
// Based on: frontend/src/scripts/shifts/validation.ts
// =============================================================================

import type {
  SelectedContext,
  Area,
  Department,
  Machine,
  Team,
  Employee,
  AvailabilityStatus,
} from './types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  message?: string;
}

// =============================================================================
// HIERARCHY VALIDATION
// =============================================================================

/**
 * Validate area selection
 */
export function validateAreaSelection(
  areas: Area[],
  selectedAreaId: number | null,
): ValidationResult | null {
  if (areas.length > 0 && (selectedAreaId === null || selectedAreaId === 0)) {
    return { valid: false, message: 'Bitte wählen Sie einen Bereich aus' };
  }
  return null;
}

/**
 * Validate department selection
 */
export function validateDepartmentSelection(
  selectedDepartmentId: number | null,
): ValidationResult | null {
  if (selectedDepartmentId === null || selectedDepartmentId === 0) {
    return { valid: false, message: 'Bitte wählen Sie eine Abteilung aus' };
  }
  return null;
}

/**
 * Validate machine selection and that it belongs to the selected department
 */
export function validateMachineSelection(
  machines: Machine[],
  selectedMachineId: number | null,
  selectedDepartmentId: number | null,
): ValidationResult | null {
  // Machine is optional
  if (selectedMachineId === null || selectedMachineId === 0) {
    return null;
  }

  const machine = machines.find((m) => m.id === selectedMachineId);
  if (machine === undefined) {
    return { valid: false, message: 'Ungültige Maschinen-Auswahl' };
  }
  if (machine.departmentId !== selectedDepartmentId) {
    return { valid: false, message: 'Maschine gehört nicht zur ausgewählten Abteilung' };
  }
  return null;
}

/**
 * Validate team selection and that it belongs to the selected department
 */
export function validateTeamSelection(
  teams: Team[],
  selectedTeamId: number | null,
  selectedDepartmentId: number | null,
): ValidationResult | null {
  // Team is optional for some operations
  if (selectedTeamId === null || selectedTeamId === 0) {
    return null;
  }

  const team = teams.find((t) => t.id === selectedTeamId);
  if (team === undefined) {
    return { valid: false, message: 'Ungültige Team-Auswahl' };
  }
  if (team.departmentId !== selectedDepartmentId) {
    return { valid: false, message: 'Team gehört nicht zur ausgewählten Abteilung' };
  }
  return null;
}

/**
 * Validate that department belongs to selected area
 */
export function validateDepartmentBelongsToArea(
  departments: Department[],
  selectedDepartmentId: number | null,
  selectedAreaId: number | null,
): ValidationResult | null {
  // If no area selected, skip validation
  if (selectedAreaId === null || selectedAreaId === 0) {
    return null;
  }

  const department = departments.find((d) => d.id === selectedDepartmentId);
  if (
    department?.areaId !== undefined &&
    department.areaId !== 0 &&
    department.areaId !== selectedAreaId
  ) {
    return { valid: false, message: 'Abteilung gehört nicht zum ausgewählten Bereich' };
  }
  return null;
}

/**
 * Validate complete hierarchy selection
 */
export function validateHierarchy(
  context: SelectedContext,
  areas: Area[],
  departments: Department[],
  machines: Machine[],
  teams: Team[],
): ValidationResult {
  const validations = [
    validateAreaSelection(areas, context.areaId),
    validateDepartmentSelection(context.departmentId),
    validateMachineSelection(machines, context.machineId, context.departmentId),
    validateTeamSelection(teams, context.teamId, context.departmentId),
    validateDepartmentBelongsToArea(departments, context.departmentId, context.areaId),
  ];

  for (const result of validations) {
    if (result !== null) {
      return result;
    }
  }

  return { valid: true };
}

// =============================================================================
// SAVE PREREQUISITES VALIDATION
// =============================================================================

/**
 * Validate prerequisites for saving a shift plan
 */
export function validateSavePrerequisites(
  isAdmin: boolean,
  selectedDepartmentId: number | null,
): ValidationResult {
  if (!isAdmin) {
    return { valid: false, message: 'Nur Administratoren können Schichtpläne speichern' };
  }

  if (selectedDepartmentId === null || selectedDepartmentId === 0) {
    return { valid: false, message: 'Bitte wählen Sie zuerst eine Abteilung aus' };
  }

  return { valid: true };
}

// =============================================================================
// SHIFT DATA VALIDATION
// =============================================================================

/**
 * Validate shift assignment data
 */
export function validateShiftData(date: string | undefined, shift: string | undefined): boolean {
  if (date === undefined || date === '' || shift === undefined || shift === '') {
    return false;
  }

  // Validate shift type
  const validShiftTypes = ['early', 'late', 'night'];
  if (!validShiftTypes.includes(shift)) {
    return false;
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return false;
  }

  return true;
}

// =============================================================================
// ROTATION VALIDATION
// =============================================================================

/**
 * Validate rotation form input
 */
export function validateRotationInput(formValues: {
  patternName: string;
  patternType: string;
  startDate: string;
  endDate: string;
  cycleLengthWeeks: number;
}): ValidationResult {
  if (formValues.patternName.trim() === '') {
    return { valid: false, message: 'Bitte geben Sie einen Namen für das Muster ein' };
  }

  if (formValues.patternType === '') {
    return { valid: false, message: 'Bitte wählen Sie ein Schichtmuster' };
  }

  if (formValues.startDate === '') {
    return { valid: false, message: 'Bitte wählen Sie ein Startdatum' };
  }

  if (formValues.cycleLengthWeeks < 1 || formValues.cycleLengthWeeks > 52) {
    return { valid: false, message: 'Die Zykluslänge muss zwischen 1 und 52 Wochen liegen' };
  }

  return { valid: true };
}

/**
 * Validate date range for rotation
 */
export function validateDateRange(startDate: string, endDate: string): ValidationResult {
  if (endDate !== '') {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return { valid: false, message: 'Das Enddatum muss nach dem Startdatum liegen' };
    }
  }
  return { valid: true };
}

// =============================================================================
// CONTEXT VALIDATION
// =============================================================================

/**
 * Check if context is complete for shift operations
 */
export function isContextComplete(context: SelectedContext): boolean {
  return context.teamId !== null && context.teamId !== 0;
}

/**
 * Check if department is selected
 */
export function isDepartmentSelected(context: SelectedContext): boolean {
  return context.departmentId !== null && context.departmentId !== 0;
}

/**
 * Check if area is selected
 */
export function isAreaSelected(context: SelectedContext): boolean {
  return context.areaId !== null && context.areaId !== 0;
}

// =============================================================================
// SHIFT ASSIGNMENT VALIDATION
// =============================================================================

/**
 * Validate hierarchy selection for shift operations
 */
export function validateHierarchySelection(
  context: SelectedContext,
  areas: Area[],
  departments: Department[],
  machines: Machine[],
  teams: Team[],
): ValidationResult {
  return validateHierarchy(context, areas, departments, machines, teams);
}

/**
 * Validate shift assignment data
 */
export function validateShiftAssignment(
  date: string | undefined,
  shiftType: string | undefined,
  employeeId: number | undefined,
): ValidationResult {
  if (date === undefined || date === '') {
    return { valid: false, message: 'Datum fehlt' };
  }

  if (shiftType === undefined || shiftType === '') {
    return { valid: false, message: 'Schichttyp fehlt' };
  }

  if (employeeId === undefined || employeeId === 0) {
    return { valid: false, message: 'Mitarbeiter fehlt' };
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return { valid: false, message: 'Ungültiges Datumsformat' };
  }

  // Validate shift type
  const validShiftTypes = ['early', 'late', 'night', 'F', 'S', 'N'];
  if (!validShiftTypes.includes(shiftType)) {
    return { valid: false, message: 'Ungültiger Schichttyp' };
  }

  return { valid: true };
}

// =============================================================================
// AVAILABILITY VALIDATION
// =============================================================================

/**
 * Parse a date string as date-only (ignoring any time component)
 * This avoids timezone issues when parsing ISO strings
 */
function parseDateOnly(dateStr: string): Date {
  // Extract just the date part (YYYY-MM-DD) in case of ISO string with time
  const datePart = dateStr.split('T')[0];
  if (datePart === undefined) {
    return new Date(dateStr);
  }
  const parts = datePart.split('-');
  const year = Number.parseInt(parts[0] ?? '0', 10);
  const month = Number.parseInt(parts[1] ?? '1', 10) - 1; // JS months are 0-indexed
  const day = Number.parseInt(parts[2] ?? '1', 10);
  // Create date in LOCAL timezone at midnight
  return new Date(year, month, day, 0, 0, 0, 0);
}

/**
 * Check if employee is available on a specific date
 * Returns true if available, false if unavailable
 *
 * IMPORTANT: Uses date-only comparison to avoid timezone issues
 */
export function isEmployeeAvailableOnDate(employee: Employee, dateString: string): boolean {
  const rawStatus = employee.availabilityStatus ?? 'available';

  // If status is available, no need to check dates
  if (rawStatus === 'available') {
    return true;
  }

  // If no dates set, use status directly
  const startDateStr = employee.availabilityStart;
  const endDateStr = employee.availabilityEnd;

  if (startDateStr === undefined && endDateStr === undefined) {
    // No dates = status applies indefinitely
    return false;
  }

  // Parse all dates as date-only (ignoring time component)
  const checkDate = parseDateOnly(dateString);

  // Parse start date
  let start: Date | null = null;
  if (startDateStr !== undefined && startDateStr !== '') {
    start = parseDateOnly(startDateStr);
  }

  // Parse end date
  let end: Date | null = null;
  if (endDateStr !== undefined && endDateStr !== '') {
    end = parseDateOnly(endDateStr);
  }

  // Check if date falls within unavailability period [start, end] inclusive
  const afterStart = start === null || checkDate >= start;
  const beforeEnd = end === null || checkDate <= end;
  const isUnavailable = afterStart && beforeEnd;

  // If within unavailability period, employee is NOT available
  if (isUnavailable) {
    return false;
  }

  return true;
}

/**
 * Validate employee availability for shift assignment
 */
export function validateEmployeeAvailability(employee: Employee, date: string): ValidationResult {
  if (!isEmployeeAvailableOnDate(employee, date)) {
    const fullName = `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim();
    const employeeName = fullName !== '' ? fullName : employee.username;
    const status = employee.availabilityStatus ?? 'nicht verfügbar';

    const statusMessages = new Map<string, string>([
      ['vacation', 'im Urlaub'],
      ['sick', 'krankgemeldet'],
      ['training', 'in Schulung'],
      ['unavailable', 'nicht verfügbar'],
      ['other', 'anderweitig abwesend'],
    ]);

    const statusText = statusMessages.get(status) ?? status;
    return {
      valid: false,
      message: `${employeeName} ist an diesem Tag ${statusText}`,
    };
  }
  return { valid: true };
}

// =============================================================================
// WEEK-BASED AVAILABILITY
// =============================================================================

/**
 * Check if employee's unavailability period overlaps with the given week
 * If the unavailability period does NOT overlap with the week, the employee is effectively "available"
 *
 * @param employee - The employee to check
 * @param weekDates - Array of 7 dates representing Monday-Sunday of the week
 * @returns The effective availability status for this week ('available' if no overlap, otherwise the actual status)
 */
export function getEffectiveAvailabilityForWeekValidation(
  employee: Employee,
  weekDates: Date[],
): AvailabilityStatus {
  const rawStatus = employee.availabilityStatus ?? 'available';

  // If status is already available, no calculation needed
  if (rawStatus === 'available') {
    return 'available';
  }

  // If no dates set, status applies indefinitely
  const startDate = employee.availabilityStart;
  const endDate = employee.availabilityEnd;

  if (startDate === undefined && endDate === undefined) {
    return rawStatus;
  }

  // Get week boundaries
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  if (weekStart === undefined || weekEnd === undefined) {
    return rawStatus;
  }

  // Parse unavailability dates
  let unavailStart: Date | null = null;
  if (startDate !== undefined && startDate !== '') {
    unavailStart = new Date(startDate);
    unavailStart.setHours(0, 0, 0, 0);
  }

  let unavailEnd: Date | null = null;
  if (endDate !== undefined && endDate !== '') {
    unavailEnd = new Date(endDate);
    unavailEnd.setHours(23, 59, 59, 999);
  }

  // Normalize week dates
  const weekStartNorm = new Date(weekStart);
  weekStartNorm.setHours(0, 0, 0, 0);

  const weekEndNorm = new Date(weekEnd);
  weekEndNorm.setHours(23, 59, 59, 999);

  // Check for overlap:
  // Periods overlap if: unavailStart <= weekEnd AND unavailEnd >= weekStart
  // (Handling nulls as "infinity" in that direction)

  const unavailStartsBeforeWeekEnds = unavailStart === null || unavailStart <= weekEndNorm;
  const unavailEndsAfterWeekStarts = unavailEnd === null || unavailEnd >= weekStartNorm;

  // If both conditions are true, there IS an overlap → employee is unavailable
  if (unavailStartsBeforeWeekEnds && unavailEndsAfterWeekStarts) {
    return rawStatus;
  }

  // No overlap → employee is effectively available for this week
  return 'available';
}

/**
 * Check if employee has any unavailability during the given week
 * @returns true if unavailable during any part of the week
 */
export function isEmployeeUnavailableInWeek(employee: Employee, weekDates: Date[]): boolean {
  return getEffectiveAvailabilityForWeekValidation(employee, weekDates) !== 'available';
}

// =============================================================================
// DUPLICATE SHIFT VALIDATION
// =============================================================================

/**
 * Get shift name in German
 */
function getShiftNameGerman(shiftType: string): string {
  const shiftNames = new Map<string, string>([
    ['early', 'Frühschicht'],
    ['late', 'Spätschicht'],
    ['night', 'Nachtschicht'],
    ['F', 'Frühschicht'],
    ['S', 'Spätschicht'],
    ['N', 'Nachtschicht'],
  ]);
  return shiftNames.get(shiftType) ?? shiftType;
}

/**
 * Check if employee is already assigned to another shift on the same day
 */
export function checkDuplicateShiftAssignment(
  employee: Employee,
  date: string,
  targetShift: string,
  getShiftEmployees: (date: string, shiftType: string) => number[],
): ValidationResult {
  const shiftTypes = ['early', 'late', 'night'];

  for (const shiftType of shiftTypes) {
    // Skip the target shift
    if (shiftType === targetShift) continue;

    const employees = getShiftEmployees(date, shiftType);
    if (employees.includes(employee.id)) {
      const fullName = `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim();
      const employeeName = fullName !== '' ? fullName : employee.username;
      const shiftName = getShiftNameGerman(shiftType);

      return {
        valid: false,
        message: `Doppelschicht nicht erlaubt! ${employeeName} ist bereits für die ${shiftName} eingeteilt. Ein Mitarbeiter kann nur eine Schicht pro Tag übernehmen.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Check if employee is already assigned to the same shift
 */
export function checkAlreadyAssigned(
  employeeId: number,
  date: string,
  shiftType: string,
  getShiftEmployees: (date: string, shiftType: string) => number[],
): ValidationResult {
  const currentEmployees = getShiftEmployees(date, shiftType);
  if (currentEmployees.includes(employeeId)) {
    return {
      valid: false,
      message: 'Mitarbeiter ist bereits dieser Schicht zugewiesen',
    };
  }
  return { valid: true };
}
