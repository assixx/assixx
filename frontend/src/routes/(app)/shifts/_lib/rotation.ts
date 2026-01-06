// =============================================================================
// SHIFTS - ROTATION UTILITIES
// Based on: frontend/src/scripts/shifts/rotation.ts
// Adapted for Svelte 5 (no DOM manipulation)
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import type { RotationPattern, Employee, RotationHistoryEntryAPI, ShiftType } from './types';

const apiClient = getApiClient();

// =============================================================================
// TYPES
// =============================================================================

/**
 * Shift group type for rotation assignments
 */
export type ShiftGroup = 'F' | 'S' | 'N';

/**
 * Rotation form values
 */
export interface RotationFormValues {
  pattern: 'weekly' | 'biweekly' | 'monthly' | '';
  startDate: string;
  endDate: string;
  skipSaturday: boolean;
  skipSunday: boolean;
  nightShiftStatic: boolean;
}

/**
 * Rotation assignment
 */
export interface RotationAssignment {
  userId: number;
  group: ShiftGroup;
}

/**
 * Shift groups mapping
 */
export interface ShiftGroups {
  F: number[];
  S: number[];
  N: number[];
}

// =============================================================================
// API FUNCTIONS (Additional to api.ts)
// =============================================================================

/**
 * Check if rotation pattern exists for a team
 */
export async function checkRotationPatternExists(teamId: number | null): Promise<boolean> {
  if (teamId === null || teamId === 0) return false;

  try {
    const response = await apiClient.get<{ patterns?: RotationPattern[] }>(
      `/shifts/rotation/patterns?team_id=${teamId}&active=true`,
    );
    return (response.patterns?.length ?? 0) > 0;
  } catch (error) {
    console.error('[ROTATION] Error checking rotation pattern:', error);
    return false;
  }
}

/**
 * Load existing pattern for a team
 */
export async function loadExistingPattern(teamId: number): Promise<RotationPattern | null> {
  try {
    const response = await apiClient.get<{ patterns?: RotationPattern[] }>(
      `/shifts/rotation/patterns?team_id=${teamId}&active=true`,
    );
    return response.patterns?.[0] ?? null;
  } catch (error) {
    console.error('[ROTATION] Error loading existing pattern:', error);
    return null;
  }
}

/**
 * Load a specific pattern by ID
 */
export async function loadPatternById(patternId: number): Promise<RotationPattern | null> {
  try {
    const response = await apiClient.get<{ pattern?: RotationPattern }>(
      `/shifts/rotation/patterns/${patternId}`,
    );
    return response.pattern ?? null;
  } catch (error) {
    console.error('[ROTATION] Error loading pattern by ID:', error);
    return null;
  }
}

/**
 * Load rotation history for a date range
 */
export async function loadRotationHistory(
  startDate: string,
  endDate: string,
  teamId?: number | null,
): Promise<RotationHistoryEntryAPI[]> {
  try {
    let url = `/shifts/rotation/history?start_date=${startDate}&end_date=${endDate}`;
    if (teamId !== null && teamId !== undefined) {
      url += `&team_id=${teamId}`;
    }

    const response = await apiClient.get<{ history?: RotationHistoryEntryAPI[] }>(url);
    return response.history ?? [];
  } catch (error) {
    console.error('[ROTATION] Error loading rotation history:', error);
    return [];
  }
}

// =============================================================================
// PATTERN TYPE MAPPING
// =============================================================================

/**
 * Map pattern type to API value
 */
export function mapPatternTypeToAPI(selectValue: string): 'alternate_fs' | 'fixed_n' {
  const patternTypeMap = new Map<string, 'alternate_fs' | 'fixed_n'>([
    ['weekly', 'alternate_fs'],
    ['biweekly', 'fixed_n'],
    ['monthly', 'fixed_n'],
  ]);
  return patternTypeMap.get(selectValue) ?? 'alternate_fs';
}

/**
 * Map API pattern type to select value
 */
export function mapAPIPatternToSelect(
  patternType: string,
  patternConfig?: Record<string, unknown>,
): 'weekly' | 'biweekly' | 'monthly' {
  if (patternType === 'alternate_fs') {
    return 'weekly';
  }
  if (patternType === 'fixed_n') {
    const cycleWeeks = patternConfig?.cycleWeeks;
    if (typeof cycleWeeks === 'number' && cycleWeeks >= 4) {
      return 'monthly';
    }
    return 'biweekly';
  }
  return 'weekly';
}

// =============================================================================
// SHIFT TYPE CONVERSION
// =============================================================================

/**
 * Convert database shift type to frontend format
 */
export function convertShiftTypeFromDB(dbShiftType: string): ShiftType {
  if (dbShiftType === 'F') return 'early';
  if (dbShiftType === 'S') return 'late';
  if (dbShiftType === 'N') return 'night';
  return dbShiftType as ShiftType;
}

/**
 * Convert frontend shift type to API format
 */
export function convertShiftTypeToAPI(frontendType: string): ShiftGroup {
  if (frontendType === 'early') return 'F';
  if (frontendType === 'late') return 'S';
  if (frontendType === 'night') return 'N';
  return frontendType as ShiftGroup;
}

// =============================================================================
// DATE HELPERS
// =============================================================================

/**
 * Get next Monday from a date
 */
export function getNextMonday(date: Date): Date {
  const result = new Date(date);
  const dayOfWeek = result.getDay();
  const daysUntilMonday = dayOfWeek === 1 ? 7 : dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  result.setDate(result.getDate() + daysUntilMonday);
  return result;
}

/**
 * Get second Friday after a given date
 */
export function getSecondFridayAfter(date: Date): Date {
  const result = new Date(date);
  const dayOfWeek = result.getDay();
  const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 12 - dayOfWeek;
  result.setDate(result.getDate() + daysUntilFriday);
  result.setDate(result.getDate() + 7);
  return result;
}

/**
 * Calculate default end date by adding weeks to start date
 */
export function calculateDefaultEndDate(startDate: string, weeks: number): string {
  const start = new Date(startDate);
  start.setDate(start.getDate() + weeks * 7);
  return start.toISOString().split('T')[0] ?? startDate;
}

/**
 * Get cycle length in weeks based on pattern type
 */
export function getCycleLengthWeeks(pattern: string): number {
  if (pattern === 'weekly') return 1;
  if (pattern === 'monthly') return 4;
  return 2; // Default for biweekly
}

/**
 * Get Monday of the week containing a date
 */
export function getMondayOfWeek(date: Date): Date {
  const result = new Date(date);
  const dayOfWeek = result.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  result.setDate(result.getDate() + diff);
  return result;
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate rotation form values
 */
export function validateRotationForm(formValues: RotationFormValues): {
  valid: boolean;
  error?: string;
} {
  if (formValues.pattern === '') {
    return { valid: false, error: 'Bitte wählen Sie ein Rotationsmuster' };
  }

  if (formValues.startDate === '') {
    return { valid: false, error: 'Bitte wählen Sie ein Startdatum' };
  }

  return { valid: true };
}

// =============================================================================
// PATTERN DATA BUILDING
// =============================================================================

/**
 * Build rotation pattern data for API
 */
export function buildRotationPatternData(
  teamId: number,
  formValues: RotationFormValues,
  shiftGroups: ShiftGroups,
): {
  name: string;
  patternType: 'alternate_fs' | 'fixed_n';
  patternConfig: Record<string, unknown>;
  cycleLengthWeeks: number;
  startsAt: string;
  endsAt?: string;
  teamId: number;
} {
  const patternData: {
    name: string;
    patternType: 'alternate_fs' | 'fixed_n';
    patternConfig: Record<string, unknown>;
    cycleLengthWeeks: number;
    startsAt: string;
    endsAt?: string;
    teamId: number;
  } = {
    name: `Team-Rotation ${teamId}`,
    patternType: mapPatternTypeToAPI(formValues.pattern),
    patternConfig: {
      skipSaturday: formValues.skipSaturday,
      skipSunday: formValues.skipSunday,
      nightShiftStatic: formValues.nightShiftStatic,
      shiftGroups,
    },
    cycleLengthWeeks: getCycleLengthWeeks(formValues.pattern),
    startsAt: formValues.startDate,
    teamId,
  };

  if (formValues.endDate !== '') {
    patternData.endsAt = formValues.endDate;
  }

  return patternData;
}

// =============================================================================
// ROTATION HISTORY CONVERSION
// =============================================================================

/**
 * Convert rotation history to legacy shift format
 */
export function convertRotationToLegacyShifts(
  history: RotationHistoryEntryAPI[],
  employees: Employee[],
): {
  date: string;
  shiftType: ShiftType;
  employeeId: number;
  firstName: string;
  lastName: string;
  username: string;
}[] {
  return history.map((h) => {
    const employee = employees.find((e) => e.id === h.userId);
    const shiftType = convertShiftTypeFromDB(h.shiftType);

    return {
      date: h.shiftDate,
      shiftType,
      employeeId: h.userId,
      firstName: employee?.firstName ?? '',
      lastName: employee?.lastName ?? '',
      username: employee?.username ?? '',
    };
  });
}

// =============================================================================
// PATTERN INFO TEXT
// =============================================================================

/**
 * Get info text for rotation pattern
 */
export function getRotationPatternInfo(pattern: string): string | undefined {
  switch (pattern) {
    case 'weekly':
      return (
        'Frühschicht und Spätschicht wechseln sich <strong>wöchentlich</strong> ab. ' +
        'Mit "Nachtschicht konstant" bleibt N immer gleich besetzt (nur F ↔ S alternieren).'
      );
    case 'biweekly':
      return (
        'Frühschicht und Spätschicht wechseln sich <strong>alle 2 Wochen</strong> ab. ' +
        'Mit "Nachtschicht konstant" bleibt N immer gleich besetzt (nur F ↔ S alternieren).'
      );
    case 'monthly':
      return (
        'Frühschicht und Spätschicht wechseln sich <strong>alle 4 Wochen</strong> ab. ' +
        'Mit "Nachtschicht konstant" bleibt N immer gleich besetzt (nur F ↔ S alternieren).'
      );
    default:
      return undefined;
  }
}

// =============================================================================
// DEFAULT FORM VALUES
// =============================================================================

/**
 * Get default rotation form values
 */
export function getDefaultRotationFormValues(): RotationFormValues {
  const today = new Date();
  const nextMonday = getNextMonday(today);
  const secondFriday = getSecondFridayAfter(nextMonday);

  return {
    pattern: '',
    startDate: nextMonday.toISOString().split('T')[0] ?? '',
    endDate: secondFriday.toISOString().split('T')[0] ?? '',
    skipSaturday: false,
    skipSunday: false,
    nightShiftStatic: true,
  };
}

// =============================================================================
// EMPLOYEE FILTERING FOR ROTATION
// =============================================================================

/**
 * Filter employees for rotation modal (active and in selected team)
 */
export function filterEmployeesForRotation(
  employees: Employee[],
  teamId: number | null,
): Employee[] {
  return employees.filter((emp) => {
    if (emp.isActive !== 1) return false;
    if (teamId !== null && teamId !== 0) {
      return emp.teamId === teamId;
    }
    return true;
  });
}
