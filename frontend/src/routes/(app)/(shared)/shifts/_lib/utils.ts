// =============================================================================
// SHIFTS - UTILITY FUNCTIONS
// Based on: frontend/src/scripts/shifts/utils.ts
// =============================================================================

import { DEFAULT_SHIFT_TIMES, SHIFT_TYPE_FROM_API } from './constants';

import type {
  AvailabilityEntry,
  Employee,
  AvailabilityStatus,
  ShiftType,
  ShiftTimeApiResponse,
  ShiftTimesMap,
} from './types';

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
function formatDateGerman(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}.${month}.${year}`;
}

/**
 * Get the ISO week number for a date
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
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

// =============================================================================
// SHIFT TIMES MAP (API → display format conversion)
// =============================================================================

/**
 * Build a ShiftTimesMap from API response.
 * Creates entries for both canonical keys (early/late/night) AND
 * legacy API keys (F/S/N) for backwards compatibility.
 */
export function buildShiftTimesMap(apiResponse: ShiftTimeApiResponse[]): ShiftTimesMap {
  const map: ShiftTimesMap = {};
  const keyToLegacy: Partial<Record<string, string>> = {
    early: 'F',
    late: 'S',
    night: 'N',
  };

  for (const entry of apiResponse) {
    const info = {
      start: entry.startTime,
      end: entry.endTime,
      label: entry.label,
    };
    map[entry.shiftKey] = info;
    const legacy = keyToLegacy[entry.shiftKey];
    if (legacy !== undefined) {
      map[legacy] = info;
    }
  }

  return map;
}

// =============================================================================
// SHIFT TYPE UTILITIES
// =============================================================================

/**
 * Get shift time info by type. Uses dynamic map if provided, falls back to defaults.
 */
export function getShiftTimeInfo(
  shiftType: string,
  shiftTimesMap?: ShiftTimesMap,
): {
  start: string;
  end: string;
  label: string;
} {
  if (shiftTimesMap !== undefined && shiftType in shiftTimesMap) {
    return shiftTimesMap[shiftType];
  }
  if (shiftType in DEFAULT_SHIFT_TIMES) {
    return DEFAULT_SHIFT_TIMES[shiftType as keyof typeof DEFAULT_SHIFT_TIMES];
  }
  return { start: '08:00', end: '17:00', label: shiftType };
}

/**
 * Get shift label by type
 */
export function getShiftLabel(shiftType: string, shiftTimesMap?: ShiftTimesMap): string {
  return getShiftTimeInfo(shiftType, shiftTimesMap).label;
}

/**
 * Convert database shift type to frontend format (F -> early)
 */
export function convertShiftTypeFromDB(dbShiftType: string): ShiftType {
  if (dbShiftType in SHIFT_TYPE_FROM_API) {
    return SHIFT_TYPE_FROM_API[dbShiftType as keyof typeof SHIFT_TYPE_FROM_API] as ShiftType;
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
  return fullName === '' ? employee.username : fullName;
}

/**
 * Check if a single availability entry covers a given date
 */
function isDateInAvailabilityEntry(entry: AvailabilityEntry, date: Date): boolean {
  if (entry.startDate === undefined || entry.endDate === undefined) {
    return true; // No dates = status applies indefinitely
  }

  const checkDate = new Date(date);
  checkDate.setUTCHours(0, 0, 0, 0);

  const startDate = new Date(entry.startDate);
  startDate.setUTCHours(0, 0, 0, 0);

  const endDate = new Date(entry.endDate);
  endDate.setUTCHours(23, 59, 59, 999);

  return checkDate >= startDate && checkDate <= endDate;
}

/**
 * Get effective availability status for an employee on a specific date.
 * Checks ALL availability entries — returns the first matching non-available status.
 */
function getEffectiveAvailability(employee: Employee, date: Date): AvailabilityStatus {
  const entries = employee.availabilities;
  if (entries === undefined || entries.length === 0) {
    return 'available';
  }

  for (const entry of entries) {
    if (isDateInAvailabilityEntry(entry, date)) {
      return entry.status;
    }
  }

  return 'available';
}

/**
 * Format availability period as "DD.MM.YYYY - DD.MM.YYYY"
 * Returns null if no dates are set
 */
export function formatAvailabilityPeriod(startDate?: string, endDate?: string): string | null {
  if (startDate === undefined && endDate === undefined) return null;

  const formatStr = (dateStr?: string): string => {
    if (dateStr === undefined || dateStr === '') return '?';
    const date = new Date(dateStr);
    return formatDateGerman(date);
  };

  return `${formatStr(startDate)} - ${formatStr(endDate)}`;
}

/**
 * Get effective availability for the current week (for CSS class - draggability).
 * Returns unavailable status ONLY if ALL days in the week are unavailable.
 * If at least one day is available, returns 'available' (employee can be scheduled).
 */
export function getEffectiveAvailabilityForWeek(
  employee: Employee,
  weekDates: Date[],
): AvailabilityStatus {
  const entries = employee.availabilities;
  if (entries === undefined || entries.length === 0) {
    return 'available';
  }

  // Check if ALL days in the week are unavailable
  // If at least one day is available, employee should be draggable
  let lastUnavailableStatus: AvailabilityStatus = 'available';
  for (const date of weekDates) {
    const status = getEffectiveAvailability(employee, date);
    if (status === 'available') {
      return 'available';
    }
    lastUnavailableStatus = status;
  }

  return lastUnavailableStatus;
}

/**
 * Get ALL overlapping unavailability entries for the week (for badge display).
 * Returns array of entries that overlap with any day in the week.
 */
export function getOverlappingUnavailabilities(
  employee: Employee,
  weekDates: Date[],
): AvailabilityEntry[] {
  const entries = employee.availabilities;
  if (entries === undefined || entries.length === 0) {
    return [];
  }

  const overlapping: AvailabilityEntry[] = [];
  for (const entry of entries) {
    for (const date of weekDates) {
      if (isDateInAvailabilityEntry(entry, date)) {
        overlapping.push(entry);
        break; // Entry overlaps — no need to check more days for this entry
      }
    }
  }

  return overlapping;
}
