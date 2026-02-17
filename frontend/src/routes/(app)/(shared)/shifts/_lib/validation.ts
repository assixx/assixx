// =============================================================================
// SHIFTS - VALIDATION FUNCTIONS
// Availability checks, duplicate detection, assignment guards
// =============================================================================

import type { Employee } from './types';

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
// DATE HELPERS (internal)
// =============================================================================

/**
 * Parse a date string as date-only (ignoring any time component)
 * This avoids timezone issues when parsing ISO strings
 */
function parseDateOnly(dateStr: string): Date {
  // Extract just the date part (YYYY-MM-DD) in case of ISO string with time
  // String.split() always returns at least one element (original string if separator not found)
  const datePart = dateStr.split('T')[0];
  const parts = datePart.split('-');
  const year = Number.parseInt(parts[0] ?? '0', 10);
  const month = Number.parseInt(parts[1] ?? '1', 10) - 1; // JS months are 0-indexed
  const day = Number.parseInt(parts[2] ?? '1', 10);
  // Create date in LOCAL timezone at midnight
  return new Date(year, month, day, 0, 0, 0, 0);
}

/**
 * Parse an optional date string, returning null if empty or undefined
 */
function parseOptionalDate(dateStr: string | undefined): Date | null {
  if (dateStr === undefined || dateStr === '') {
    return null;
  }
  return parseDateOnly(dateStr);
}

/**
 * Check if a date falls within a date range [start, end] inclusive
 * Null boundaries are treated as unbounded (infinity)
 */
function isDateInRange(
  checkDate: Date,
  start: Date | null,
  end: Date | null,
): boolean {
  const afterStart = start === null || checkDate >= start;
  const beforeEnd = end === null || checkDate <= end;
  return afterStart && beforeEnd;
}

// =============================================================================
// AVAILABILITY VALIDATION
// =============================================================================

/**
 * Find the availability status that blocks an employee on a given date
 */
function findBlockingStatus(
  employee: Employee,
  dateString: string,
): string | null {
  const entries = employee.availabilities;
  if (entries === undefined || entries.length === 0) {
    return null;
  }

  const checkDate = parseDateOnly(dateString);

  for (const entry of entries) {
    const start = parseOptionalDate(entry.startDate);
    const end = parseOptionalDate(entry.endDate);

    if (start === null && end === null) {
      return entry.status;
    }

    if (isDateInRange(checkDate, start, end)) {
      return entry.status;
    }
  }

  return null;
}

/**
 * Validate employee availability for shift assignment.
 * Checks ALL availability entries for the given date.
 */
export function validateEmployeeAvailability(
  employee: Employee,
  date: string,
): ValidationResult {
  const blockingStatus = findBlockingStatus(employee, date);

  if (blockingStatus !== null) {
    const fullName =
      `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim();
    const employeeName = fullName !== '' ? fullName : employee.username;

    const statusMessages = new Map<string, string>([
      ['vacation', 'im Urlaub'],
      ['sick', 'krankgemeldet'],
      ['training', 'in Schulung'],
      ['unavailable', 'nicht verfügbar'],
      ['other', 'anderweitig abwesend'],
    ]);

    const statusText = statusMessages.get(blockingStatus) ?? blockingStatus;
    return {
      valid: false,
      message: `${employeeName} ist an diesem Tag ${statusText}`,
    };
  }
  return { valid: true };
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
      const fullName =
        `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim();
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
