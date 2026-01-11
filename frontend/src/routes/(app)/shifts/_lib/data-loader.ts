// =============================================================================
// SHIFTS - DATA LOADING & PROCESSING
// Pure functions for processing shift plan and rotation data
// =============================================================================

import { convertShiftTypeFromDB, getWeekStart, formatDate } from './utils';

import type {
  Employee,
  ShiftDetailData,
  TeamMember,
  AvailabilityStatus,
  RotationPatternType,
} from './types';

// =============================================================================
// TEAM MEMBER CONVERSION
// =============================================================================

/**
 * Convert team members to employees format (filters to employees only)
 */
export function convertTeamMembersToEmployees(members: TeamMember[]): Employee[] {
  return members
    .filter((member) => member.userRole === 'employee')
    .map((member) => ({
      id: member.id,
      username: member.username,
      firstName: member.firstName,
      lastName: member.lastName,
      email: '',
      role: 'employee' as const,
      tenantId: 0,
      isActive: 1 as const,
      createdAt: '',
      updatedAt: '',
      availabilityStatus: member.availabilityStatus,
      availabilityStart: member.availabilityStart,
      availabilityEnd: member.availabilityEnd,
    }));
}

/** SSR team member structure (from +page.server.ts) */
export interface SSRTeamMember {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  availabilityStatus?: string;
  availabilityStart?: string;
  availabilityEnd?: string;
}

/** Valid availability status values for type guard */
const VALID_AVAILABILITY_STATUSES: AvailabilityStatus[] = [
  'available',
  'vacation',
  'sick',
  'unavailable',
  'training',
  'other',
];

/** Type guard for AvailabilityStatus */
function isValidAvailabilityStatus(value: string | undefined): value is AvailabilityStatus {
  return value !== undefined && VALID_AVAILABILITY_STATUSES.includes(value as AvailabilityStatus);
}

/**
 * Convert SSR team members to employees format (no role filtering - SSR already filtered)
 */
export function convertSSRTeamMembersToEmployees(members: SSRTeamMember[]): Employee[] {
  return members.map((m) => ({
    id: m.id,
    username: m.username,
    firstName: m.firstName,
    lastName: m.lastName,
    email: '',
    role: 'employee' as const,
    tenantId: 0,
    isActive: 1 as const,
    createdAt: '',
    updatedAt: '',
    availabilityStatus: isValidAvailabilityStatus(m.availabilityStatus)
      ? m.availabilityStatus
      : undefined,
    availabilityStart: m.availabilityStart,
    availabilityEnd: m.availabilityEnd,
  }));
}

// =============================================================================
// TYPES
// =============================================================================

export interface ProcessedShiftData {
  weeklyShifts: Map<string, Map<string, number[]>>;
  shiftDetails: Map<string, ShiftDetailData>;
  planId: number | null;
  shiftNotes: string;
  isPlanLocked: boolean;
}

export interface ProcessedRotationData {
  weeklyShifts: Map<string, Map<string, number[]>>;
  shiftDetails: Map<string, ShiftDetailData>;
  rotationHistoryMap: Map<string, number>;
}

export interface ShiftPlanResponse {
  plan?: {
    id: number;
    shiftNotes?: string;
  };
  shifts: {
    date: string;
    type: string;
    userId: number;
    user?: {
      firstName: string;
      lastName: string;
      username: string;
    };
  }[];
}

export interface RotationHistoryEntry {
  id: number;
  shiftDate: string;
  shiftType: string;
  userId: number;
  patternId?: number;
}

// =============================================================================
// SHIFT PLAN PROCESSING
// =============================================================================

/**
 * Process shift plan response into weekly shifts map and details
 */
export function processShiftPlanResponse(
  planResponse: ShiftPlanResponse | null,
): ProcessedShiftData {
  const weeklyShifts = new Map<string, Map<string, number[]>>();
  const shiftDetails = new Map<string, ShiftDetailData>();

  if (planResponse === null) {
    return {
      weeklyShifts,
      shiftDetails,
      planId: null,
      shiftNotes: '',
      isPlanLocked: false,
    };
  }

  // Process shift data into weekly shifts map
  for (const shift of planResponse.shifts) {
    const dateKey = shift.date;
    const shiftType = shift.type.toLowerCase();

    let dayShifts = weeklyShifts.get(dateKey);
    if (dayShifts === undefined) {
      dayShifts = new Map();
      weeklyShifts.set(dateKey, dayShifts);
    }

    let shiftEmployees = dayShifts.get(shiftType);
    if (shiftEmployees === undefined) {
      shiftEmployees = [];
      dayShifts.set(shiftType, shiftEmployees);
    }

    shiftEmployees.push(shift.userId);

    // Store shift details
    if (shift.user !== undefined) {
      const detailKey = `${dateKey}_${shiftType}_${shift.userId}`;
      shiftDetails.set(detailKey, {
        employeeId: shift.userId,
        firstName: shift.user.firstName,
        lastName: shift.user.lastName,
        username: shift.user.username,
        date: dateKey,
        shiftType,
      });
    }
  }

  return {
    weeklyShifts,
    shiftDetails,
    planId: planResponse.plan?.id ?? null,
    shiftNotes: planResponse.plan?.shiftNotes ?? '',
    isPlanLocked: planResponse.plan !== undefined,
  };
}

// =============================================================================
// ROTATION HISTORY PROCESSING
// =============================================================================

/**
 * Normalize date format from API (removes time portion if present)
 */
function normalizeDateKey(shiftDate: string): string {
  if (shiftDate.includes('T')) {
    return shiftDate.split('T')[0] ?? shiftDate;
  }
  return shiftDate;
}

/**
 * Ensure a day entry exists in weeklyShifts map and return shift employees array
 */
function ensureShiftEntry(
  weeklyShifts: Map<string, Map<string, number[]>>,
  dateKey: string,
  shiftType: string,
): number[] {
  let dayShifts = weeklyShifts.get(dateKey);
  if (dayShifts === undefined) {
    dayShifts = new Map();
    weeklyShifts.set(dateKey, dayShifts);
  }

  let shiftEmployees = dayShifts.get(shiftType);
  if (shiftEmployees === undefined) {
    shiftEmployees = [];
    dayShifts.set(shiftType, shiftEmployees);
  }

  return shiftEmployees;
}

/**
 * Create shift detail data for an employee
 */
function createShiftDetail(
  employeeId: number,
  dateKey: string,
  shiftType: string,
  employees: Employee[],
): ShiftDetailData {
  const employee = employees.find((e) => e.id === employeeId);
  return {
    employeeId,
    firstName: employee?.firstName ?? '',
    lastName: employee?.lastName ?? '',
    username: employee?.username ?? '',
    date: dateKey,
    shiftType,
    isRotationShift: true,
  };
}

/**
 * Process rotation history and merge into existing weekly shifts
 */
export function processRotationHistory(
  rotationHistory: RotationHistoryEntry[],
  existingWeeklyShifts: Map<string, Map<string, number[]>>,
  existingShiftDetails: Map<string, ShiftDetailData>,
  employees: Employee[],
): ProcessedRotationData {
  // Clone existing maps for immutability
  const weeklyShifts = new Map(existingWeeklyShifts);
  const shiftDetails = new Map(existingShiftDetails);
  const rotationHistoryMap = new Map<string, number>();

  for (const entry of rotationHistory) {
    const dateKey = normalizeDateKey(entry.shiftDate);
    const shiftType = convertShiftTypeFromDB(entry.shiftType);
    const employeeId = entry.userId;

    // Store rotation history ID for later deletion
    const historyKey = `${dateKey}_${shiftType}_${String(employeeId)}`;
    rotationHistoryMap.set(historyKey, entry.id);

    // Add to weeklyShifts (MERGE, not replace!)
    const shiftEmployees = ensureShiftEntry(weeklyShifts, dateKey, shiftType);
    if (!shiftEmployees.includes(employeeId)) {
      shiftEmployees.push(employeeId);
    }

    // Add to shiftDetails for employee display info
    const detailKey = `${dateKey}_${shiftType}_${String(employeeId)}`;
    shiftDetails.set(detailKey, createShiftDetail(employeeId, dateKey, shiftType, employees));
  }

  return {
    weeklyShifts,
    shiftDetails,
    rotationHistoryMap,
  };
}

// =============================================================================
// SAVE DATA PREPARATION
// =============================================================================

export interface ShiftSaveData {
  userId: number;
  date: string;
  type: string;
  startTime: string;
  endTime: string;
}

export interface ShiftPlanSaveData {
  teamId: number;
  departmentId?: number;
  machineId?: number;
  areaId?: number;
  startDate: string;
  endDate: string;
  name: string;
  shiftNotes: string;
  shifts: ShiftSaveData[];
}

/** Default shift times if not configured */
const DEFAULT_SHIFT_TIMES = { start: '06:00', end: '14:00' } as const;

/**
 * Build shift assignments from weeklyShifts Map for saving
 */
export function buildShiftSaveData(
  weeklyShifts: Map<string, Map<string, number[]>>,
  shiftTimes: Partial<Record<string, { start: string; end: string }>>,
): ShiftSaveData[] {
  const shifts: ShiftSaveData[] = [];

  for (const [dateKey, dayShifts] of weeklyShifts.entries()) {
    for (const [shiftType, employeeIds] of dayShifts.entries()) {
      // shiftType comes from our own Map iteration, not user input - safe access

      const times = shiftTimes[shiftType] ?? DEFAULT_SHIFT_TIMES;
      for (const userId of employeeIds) {
        shifts.push({
          userId,
          date: dateKey,
          type: shiftType,
          startTime: times.start,
          endTime: times.end,
        });
      }
    }
  }

  return shifts;
}

// =============================================================================
// WEEK DATE CALCULATION
// =============================================================================

export interface WeekDateBounds {
  startDate: string;
  endDate: string;
}

/**
 * Calculate week start and end dates from a reference date
 */
export function getWeekDateBounds(currentWeek: Date): WeekDateBounds {
  const weekStart = getWeekStart(currentWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return {
    startDate: formatDate(weekStart),
    endDate: formatDate(weekEnd),
  };
}

// =============================================================================
// PATTERN LOADING FROM HISTORY
// =============================================================================

export interface PatternInfo {
  patternId: number | null;
  patternType: RotationPatternType | null;
}

/**
 * Load pattern type from rotation history if exists
 */
export async function loadPatternFromHistory(
  rotationHistory: RotationHistoryEntry[],
  fetchPatternById: (id: number) => Promise<{ id: number; patternType: string } | null>,
): Promise<PatternInfo> {
  if (rotationHistory.length === 0) {
    return { patternId: null, patternType: null };
  }

  const firstEntry = rotationHistory[0];
  if (!('patternId' in firstEntry) || firstEntry.patternId === undefined) {
    return { patternId: null, patternType: null };
  }

  const pattern = await fetchPatternById(firstEntry.patternId);
  if (pattern === null) {
    return { patternId: null, patternType: null };
  }

  return {
    patternId: pattern.id,
    patternType: pattern.patternType as PatternInfo['patternType'],
  };
}
