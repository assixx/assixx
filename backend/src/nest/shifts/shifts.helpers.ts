/**
 * Shifts Helpers
 *
 * Pure functions for shift data transformation.
 * No dependency injection, no database calls.
 */
import { dbToApi } from '../../utils/field-mapper.js';
import type { DbShiftRow, ShiftResponse } from './shifts.types.js';

/**
 * Extracts HH:MM time string from a DateTime value
 */
export function parseTimeFromDateTime(
  dateTimeValue: string | Date | undefined,
): string | undefined {
  if (dateTimeValue === undefined) return undefined;
  try {
    const dateTime = new Date(dateTimeValue);
    if (Number.isNaN(dateTime.getTime())) return undefined;
    const hours = dateTime.getHours().toString().padStart(2, '0');
    const minutes = dateTime.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return undefined;
  }
}

/**
 * Formats a Date value to YYYY-MM-DD string
 */
export function parseDateToString(
  dateValue: string | Date | undefined,
): string | undefined {
  if (dateValue === undefined) return undefined;
  try {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString().split('T')[0];
  } catch {
    return undefined;
  }
}

/**
 * Builds a full timestamp from date and time strings for PostgreSQL
 * @param dateStr - Date in YYYY-MM-DD format (or ISO string)
 * @param timeStr - Time in HH:MM format
 * @param defaultTime - Fallback time used when timeStr is empty/invalid
 */
export function buildTimestamp(
  dateStr: unknown,
  timeStr: unknown,
  defaultTime?: string,
): string | null {
  if (typeof dateStr !== 'string' || dateStr === '') return null;
  const datePart: string = dateStr.split('T')[0] ?? dateStr;
  if (typeof timeStr === 'string' && timeStr !== '') {
    const timePart: string = timeStr;
    return `${datePart}T${timePart}:00`;
  }
  if (defaultTime !== undefined && defaultTime !== '') {
    const defTime: string = defaultTime;
    return `${datePart}T${defTime}:00`;
  }
  return null;
}

/**
 * Converts time fields in dbData to full timestamps using the provided date
 */
export function convertTimeFieldsToTimestamps(
  dbData: Record<string, unknown>,
  dateForTimestamp: string,
): void {
  const startTime = dbData['start_time'];
  if (startTime !== undefined) {
    const builtTime = buildTimestamp(dateForTimestamp, startTime);
    if (builtTime !== null) dbData['start_time'] = builtTime;
  }
  const endTime = dbData['end_time'];
  if (endTime !== undefined) {
    const builtTime = buildTimestamp(dateForTimestamp, endTime);
    if (builtTime !== null) dbData['end_time'] = builtTime;
  }
}

/**
 * Converts a DB shift row to API response format
 */
export function dbShiftToApi(dbShift: DbShiftRow): ShiftResponse {
  const apiShift = dbToApi(
    dbShift as unknown as Record<string, unknown>,
  ) as ShiftResponse;
  const startTime = parseTimeFromDateTime(dbShift.start_time);
  if (startTime !== undefined && startTime !== '') {
    apiShift.startTime = startTime;
  }
  const endTime = parseTimeFromDateTime(dbShift.end_time);
  if (endTime !== undefined && endTime !== '') {
    apiShift.endTime = endTime;
  }
  const formattedDate = parseDateToString(dbShift.date);
  if (formattedDate !== undefined && formattedDate !== '') {
    apiShift.date = formattedDate;
  }
  // Add nested user object for frontend compatibility
  // user_id is always defined (required field in DbShiftRow)
  apiShift['user'] = {
    id: dbShift.user_id,
    username: dbShift.user_name ?? '',
    firstName: dbShift.first_name ?? '',
    lastName: dbShift.last_name ?? '',
  };
  return apiShift;
}

/**
 * Calculates total working hours from start/end time minus breaks
 */
export function calculateHours(
  startTime: string,
  endTime: string,
  breakMinutes?: number,
): number {
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);
  const diffMs = end.getTime() - start.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const breakHours = (breakMinutes ?? 0) / 60;
  return Math.round((diffHours - breakHours) * 100) / 100;
}
