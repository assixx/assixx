// =============================================================================
// SHIFTS - UTILITY FUNCTIONS
// Based on: frontend/src/scripts/shifts/utils.ts
// =============================================================================

import {
  SHIFT_TIMES,
  SHIFT_TYPE_TO_API,
  SHIFT_TYPE_FROM_API,
} from './constants';

import type { Employee, AvailabilityStatus, ShiftType } from './types';

// =============================================================================
// DATE UTILITIES
// =============================================================================

/**
 * Get the Monday of the week for a given date
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/**
 * Get the Sunday of the week for a given date
 */
export function getWeekEnd(date: Date): Date {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return weekEnd;
}

/**
 * Format a date as YYYY-MM-DD (API format)
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a date as DD.MM.YYYY (German format)
 */
export function formatDateGerman(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}.${month}.${year}`;
}

/**
 * Format a date as DD.MM. (short German format)
 */
export function formatDateShort(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.`;
}

/**
 * Get the ISO week number for a date
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() !== 0 ? d.getUTCDay() : 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Get short day name in German
 */
export function getDayName(date: Date): string {
  return date.toLocaleDateString('de-DE', { weekday: 'short' });
}

/**
 * Format week range for display (KW X - DD.MM.YYYY bis DD.MM.YYYY)
 */
export function formatWeekRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const weekNumber = getWeekNumber(weekStart);
  const startStr = formatDateGerman(weekStart);
  const endStr = formatDateGerman(weekEnd);

  return `KW ${weekNumber} - ${startStr} bis ${endStr}`;
}

/**
 * Get array of 7 dates for a week starting from the given date
 */
export function getWeekDates(weekStart: Date): Date[] {
  const dates: Date[] = [];
  const start = getWeekStart(weekStart);

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date);
  }

  return dates;
}

/**
 * Add weeks to a date
 */
export function addWeeks(date: Date, weeks: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + weeks * 7);
  return result;
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Parse a date string and return a Date object
 */
export function parseDate(dateString: string): Date {
  return new Date(dateString);
}

// =============================================================================
// SHIFT TYPE UTILITIES
// =============================================================================

/**
 * Get shift time info by type
 */
export function getShiftTimeInfo(shiftType: string): {
  start: string;
  end: string;
  label: string;
} {
  if (shiftType in SHIFT_TIMES) {
    return SHIFT_TIMES[shiftType as keyof typeof SHIFT_TIMES];
  }
  return { start: '08:00', end: '17:00', label: shiftType };
}

/**
 * Get the start time for a shift type
 */
export function getShiftStartTime(shiftType: string): string {
  return getShiftTimeInfo(shiftType).start;
}

/**
 * Get the end time for a shift type
 */
export function getShiftEndTime(shiftType: string): string {
  return getShiftTimeInfo(shiftType).end;
}

/**
 * Get the display string for a shift time (e.g., "06:00 - 14:00")
 */
export function getShiftTimeDisplay(shiftType: string): string {
  const info = getShiftTimeInfo(shiftType);
  return `${info.start} - ${info.end}`;
}

/**
 * Get shift label by type
 */
export function getShiftLabel(shiftType: string): string {
  return getShiftTimeInfo(shiftType).label;
}

/**
 * Convert frontend shift type to API format (early -> F)
 */
export function convertShiftTypeForAPI(frontendType: string): string {
  if (frontendType in SHIFT_TYPE_TO_API) {
    return SHIFT_TYPE_TO_API[frontendType as keyof typeof SHIFT_TYPE_TO_API];
  }
  return frontendType;
}

/**
 * Convert database shift type to frontend format (F -> early)
 */
export function convertShiftTypeFromDB(dbShiftType: string): ShiftType {
  if (dbShiftType in SHIFT_TYPE_FROM_API) {
    return SHIFT_TYPE_FROM_API[
      dbShiftType as keyof typeof SHIFT_TYPE_FROM_API
    ] as ShiftType;
  }
  return dbShiftType as ShiftType;
}

// =============================================================================
// EMPLOYEE UTILITIES
// =============================================================================

/**
 * Get display name for an employee
 */
export function getEmployeeDisplayName(employee: Employee): string {
  const firstName = employee.firstName ?? '';
  const lastName = employee.lastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName !== '' ? fullName : employee.username;
}

/**
 * Get effective availability status for an employee on a specific date
 */
export function getEffectiveAvailability(
  employee: Employee,
  date: Date,
): AvailabilityStatus {
  if (
    employee.availabilityStatus === undefined ||
    employee.availabilityStatus === 'available'
  ) {
    return 'available';
  }

  // Check if absence period is defined
  if (
    employee.availabilityStart === undefined ||
    employee.availabilityEnd === undefined
  ) {
    return employee.availabilityStatus;
  }

  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  const startDate = new Date(employee.availabilityStart);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(employee.availabilityEnd);
  endDate.setHours(23, 59, 59, 999);

  // Check if date is within absence period
  if (checkDate >= startDate && checkDate <= endDate) {
    return employee.availabilityStatus;
  }

  return 'available';
}

/**
 * Format availability period as "DD.MM.YYYY - DD.MM.YYYY"
 * Returns null if no dates are set
 */
export function formatAvailabilityPeriod(
  startDate?: string,
  endDate?: string,
): string | null {
  if (startDate === undefined && endDate === undefined) return null;

  const formatStr = (dateStr?: string): string => {
    if (dateStr === undefined || dateStr === '') return '?';
    const date = new Date(dateStr);
    return formatDateGerman(date);
  };

  return `${formatStr(startDate)} - ${formatStr(endDate)}`;
}

/**
 * Get effective availability for the current week (for CSS class - draggability)
 * Returns unavailable status ONLY if ALL days in the week are unavailable.
 * If at least one day is available, returns 'available' (employee can be scheduled).
 */
export function getEffectiveAvailabilityForWeek(
  employee: Employee,
  weekDates: Date[],
): AvailabilityStatus {
  // If no availability status or explicitly available, return available
  if (
    employee.availabilityStatus === undefined ||
    employee.availabilityStatus === 'available'
  ) {
    return 'available';
  }

  // Check if absence period is defined
  if (
    employee.availabilityStart === undefined ||
    employee.availabilityEnd === undefined
  ) {
    return employee.availabilityStatus;
  }

  // Check if ALL days in the week are unavailable
  // If at least one day is available, employee should be draggable
  for (const date of weekDates) {
    const status = getEffectiveAvailability(employee, date);
    if (status === 'available') {
      return 'available'; // At least one day available → employee is available for this week
    }
  }

  // All days are unavailable
  return employee.availabilityStatus;
}

/**
 * Check if employee has ANY unavailability overlapping with the week (for badge display)
 * Returns the unavailability status if ANY day overlaps, otherwise 'available'.
 */
export function getOverlappingUnavailability(
  employee: Employee,
  weekDates: Date[],
): AvailabilityStatus {
  // If no availability status or explicitly available, return available
  if (
    employee.availabilityStatus === undefined ||
    employee.availabilityStatus === 'available'
  ) {
    return 'available';
  }

  // Check if absence period is defined
  if (
    employee.availabilityStart === undefined ||
    employee.availabilityEnd === undefined
  ) {
    return employee.availabilityStatus;
  }

  // Check if ANY day in the week overlaps with absence (for showing badge)
  for (const date of weekDates) {
    const status = getEffectiveAvailability(employee, date);
    if (status !== 'available') {
      return status; // At least one day unavailable → show badge
    }
  }

  return 'available';
}

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * Check if a value is a non-null number (valid ID)
 */
export function isValidId(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && value !== 0;
}

/**
 * Check if a string is non-empty
 */
export function isNonEmpty(value: string | null | undefined): value is string {
  return value !== null && value !== undefined && value !== '';
}

// =============================================================================
// STRING UTILITIES
// =============================================================================

/**
 * Capitalize first letter of a string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
