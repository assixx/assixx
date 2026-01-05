// =============================================================================
// SHIFTS - DATA LOADING & PROCESSING
// Pure functions for processing shift plan and rotation data
// =============================================================================

import type { Employee, ShiftDetailData, TeamMember, AvailabilityStatus } from './types';
import { convertShiftTypeFromDB } from './utils';

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
  shifts: Array<{
    date: string;
    type: string;
    userId: number;
    user?: {
      firstName: string;
      lastName: string;
      username: string;
    };
  }>;
}

export interface RotationHistoryEntry {
  id: number;
  shiftDate: string;
  shiftType: string;
  userId: number;
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

    if (!weeklyShifts.has(dateKey)) {
      weeklyShifts.set(dateKey, new Map());
    }

    const dayShifts = weeklyShifts.get(dateKey)!;
    if (!dayShifts.has(shiftType)) {
      dayShifts.set(shiftType, []);
    }

    dayShifts.get(shiftType)!.push(shift.userId);

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
    // Normalize date format: API returns "2025-12-08T00:00:00.000Z", we need "2025-12-08"
    const dateKey = entry.shiftDate.includes('T')
      ? (entry.shiftDate.split('T')[0] ?? entry.shiftDate)
      : entry.shiftDate;
    const shiftType = convertShiftTypeFromDB(entry.shiftType);
    const employeeId = entry.userId;

    // Store rotation history ID for later deletion
    const historyKey = `${dateKey}_${shiftType}_${String(employeeId)}`;
    rotationHistoryMap.set(historyKey, entry.id);

    // Add to weeklyShifts (MERGE, not replace!)
    if (!weeklyShifts.has(dateKey)) {
      weeklyShifts.set(dateKey, new Map());
    }
    const dayShifts = weeklyShifts.get(dateKey)!;
    if (!dayShifts.has(shiftType)) {
      dayShifts.set(shiftType, []);
    }
    const shiftEmployees = dayShifts.get(shiftType)!;
    if (!shiftEmployees.includes(employeeId)) {
      shiftEmployees.push(employeeId);
    }

    // Add to shiftDetails for employee display info
    const employee = employees.find((e) => e.id === employeeId);
    const detailKey = `${dateKey}_${shiftType}_${String(employeeId)}`;
    shiftDetails.set(detailKey, {
      employeeId,
      firstName: employee?.firstName ?? '',
      lastName: employee?.lastName ?? '',
      username: employee?.username ?? '',
      date: dateKey,
      shiftType,
      isRotationShift: true,
    });
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

/**
 * Build shift assignments from weeklyShifts Map for saving
 */
export function buildShiftSaveData(
  weeklyShifts: Map<string, Map<string, number[]>>,
  shiftTimes: Record<string, { start: string; end: string }>,
): ShiftSaveData[] {
  const shifts: ShiftSaveData[] = [];

  for (const [dateKey, dayShifts] of weeklyShifts.entries()) {
    for (const [shiftType, employeeIds] of dayShifts.entries()) {
      const shiftTime = shiftTimes[shiftType];
      for (const userId of employeeIds) {
        shifts.push({
          userId,
          date: dateKey,
          type: shiftType,
          startTime: shiftTime?.start ?? '06:00',
          endTime: shiftTime?.end ?? '14:00',
        });
      }
    }
  }

  return shifts;
}
