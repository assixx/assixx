/**
 * Utility Functions for Shift Planning System
 * Pure functions with no side effects
 */

// Constants not needed - using switch statements for type safety

// ============== DATE UTILITIES ==============

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
 * Format a date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(year)}-${month}-${day}`;
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
 * Format a date key for Map storage (YYYY-MM-DD)
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${String(year)}-${month}-${day}`;
}

/**
 * Get the ISO week number for a date
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
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
 * Format a week range for display (KW X - DD.MM.YYYY bis DD.MM.YYYY)
 */
export function formatWeekRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const weekNumber = getWeekNumber(weekStart);
  const startStr = formatDateGerman(weekStart);
  const endStr = formatDateGerman(weekEnd);

  return `KW ${String(weekNumber)} - ${startStr} bis ${endStr}`;
}

/**
 * Format a date string for display (DD.MM.)
 */
export function formatDateForDisplay(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.`;
}

/**
 * Parse a date string and return a Date object
 */
export function parseDate(dateString: string): Date {
  return new Date(dateString);
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
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ============== SHIFT TYPE UTILITIES ==============

/**
 * Get the start time for a shift type
 */
export function getShiftStartTime(shiftType: string): string {
  switch (shiftType) {
    case 'early':
      return '06:00';
    case 'late':
      return '14:00';
    case 'night':
      return '22:00';
    default:
      return '08:00';
  }
}

/**
 * Get the end time for a shift type
 */
export function getShiftEndTime(shiftType: string): string {
  switch (shiftType) {
    case 'early':
      return '14:00';
    case 'late':
      return '22:00';
    case 'night':
      return '06:00';
    default:
      return '17:00';
  }
}

/**
 * Get the display string for a shift time (e.g., "06:00 - 14:00")
 */
export function getShiftTimeDisplay(shiftType: string): string {
  const validShiftTypes = ['early', 'late', 'night'] as const;
  if (!validShiftTypes.includes(shiftType as (typeof validShiftTypes)[number])) {
    return 'Ganztags';
  }

  const displays: Record<(typeof validShiftTypes)[number], string> = {
    early: '06:00 - 14:00',
    late: '14:00 - 22:00',
    night: '22:00 - 06:00',
  };
  return displays[shiftType as (typeof validShiftTypes)[number]];
}

/**
 * Convert frontend shift type to API format (early -> F)
 */
export function convertShiftTypeForAPI(frontendType: string): string {
  switch (frontendType) {
    case 'early':
      return 'F';
    case 'late':
      return 'S';
    case 'night':
      return 'N';
    default:
      return frontendType;
  }
}

/**
 * Convert database shift type to frontend format (F -> early)
 */
export function convertShiftTypeFromDB(dbShiftType: string): string {
  switch (dbShiftType) {
    case 'F':
      return 'early';
    case 'S':
      return 'late';
    case 'N':
      return 'night';
    default:
      return dbShiftType;
  }
}

/**
 * Get shift label by type
 */
export function getShiftLabel(shiftType: string): string {
  const labels = new Map<string, string>([
    ['early', 'Frühschicht'],
    ['late', 'Spätschicht'],
    ['night', 'Nachtschicht'],
    ['F', 'Frühschicht'],
    ['S', 'Spätschicht'],
    ['N', 'Nachtschicht'],
  ]);
  return labels.get(shiftType) ?? shiftType;
}

// ============== STRING UTILITIES ==============

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

// ============== NUMBER UTILITIES ==============

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ============== VALIDATION UTILITIES ==============

/**
 * Check if a value is a non-null number
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

// ============== OBJECT UTILITIES ==============

/**
 * Convert null to undefined (for optional properties)
 */
export function nullToUndefined<T>(value: T | null): T | undefined {
  return value ?? undefined;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

// ============== WEEK UTILITIES ==============

/**
 * Format date for API (YYYY-MM-DD) - alias for formatDate
 */
export function formatDateForApi(date: Date): string {
  return formatDate(date);
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
 * Get shift time range by type
 */
export function getShiftTimeRange(shiftType: string): { start: string; end: string } {
  switch (shiftType) {
    case 'early':
    case 'F':
      return { start: '06:00', end: '14:00' };
    case 'late':
    case 'S':
      return { start: '14:00', end: '22:00' };
    case 'night':
    case 'N':
      return { start: '22:00', end: '06:00' };
    default:
      return { start: '08:00', end: '17:00' };
  }
}
