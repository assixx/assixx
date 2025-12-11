/**
 * Data Processing for Shift Planning System
 * Pure functions for transforming shift data
 *
 * @module shifts/data-processing
 */

import type { Employee, ShiftDetailData } from './types';
import {
  getWeeklyShifts,
  getShiftDetails,
  getEmployees,
  setWeeklyShifts,
  setShiftDetails,
  setCurrentPlanId,
  setCurrentShiftNotes,
  setRotationHistoryMap,
} from './state';
import { getShiftTimeRange } from './utils';

// ============== INTERFACES ==============

/** Shift data structure for API */
export interface ShiftEntry {
  userId: number;
  date: string;
  type: string;
  startTime: string;
  endTime: string;
}

/** Plan data structure for API */
export interface PlanData {
  startDate: string;
  endDate: string;
  areaId?: number;
  departmentId?: number;
  teamId?: number;
  machineId?: number;
  name: string;
  shiftNotes?: string;
  shifts: ShiftEntry[];
}

/** Rotation history entry from API */
export interface RotationHistoryEntry {
  id: number;
  shiftDate: string;
  shiftType: string;
  userId: number;
  status: string;
}

/** Shift plan data from API */
export interface ShiftPlanData {
  id?: number;
  planId?: number;
  plan?: { id: number; shiftNotes?: string };
  shiftNotes?: string;
  shifts: {
    id?: number;
    userId: number;
    date: string;
    type: string;
    user?: {
      id: number;
      firstName: string;
      lastName: string;
      username: string;
    };
  }[];
}

// ============== CONVERSION FUNCTIONS ==============

/**
 * Convert rotation shift type (F/S/N) to UI format (early/late/night)
 */
export function convertRotationShiftType(dbType: string): string {
  if (dbType === 'F') return 'early';
  if (dbType === 'S') return 'late';
  if (dbType === 'N') return 'night';
  return dbType.toLowerCase();
}

// ============== DATA COLLECTION ==============

/**
 * Collect shifts from weekly shift map into flat array
 */
export function collectShiftsFromWeeklyMap(weeklyShifts: Map<string, Map<string, number[]>>): ShiftEntry[] {
  const shifts: ShiftEntry[] = [];
  weeklyShifts.forEach((dayShifts, dateKey) => {
    dayShifts.forEach((employeeIds, shiftType) => {
      const timeRange = getShiftTimeRange(shiftType);
      employeeIds.forEach((userId) => {
        shifts.push({
          userId,
          date: dateKey,
          type: shiftType,
          startTime: timeRange.start,
          endTime: timeRange.end,
        });
      });
    });
  });
  return shifts;
}

/**
 * Build plan data object with optional context fields
 */
export function buildPlanData(
  startDate: string,
  endDate: string,
  planName: string,
  shifts: ShiftEntry[],
  context: { areaId: number | null; departmentId: number | null; teamId: number | null; machineId: number | null },
  shiftNotes?: string,
): PlanData {
  const planData: PlanData = { startDate, endDate, name: planName, shifts };
  if (context.areaId !== null) planData.areaId = context.areaId;
  if (context.departmentId !== null) planData.departmentId = context.departmentId;
  if (context.teamId !== null) planData.teamId = context.teamId;
  if (context.machineId !== null) planData.machineId = context.machineId;
  // Only include shiftNotes if it's not empty
  if (shiftNotes !== undefined && shiftNotes.trim() !== '') {
    planData.shiftNotes = shiftNotes.trim();
  }
  return planData;
}

// ============== DATA PROCESSING ==============

/**
 * Process rotation history data and merge into weeklyShifts
 * Also stores history IDs for single-entry deletion support
 */
export function processRotationHistoryData(history: RotationHistoryEntry[]): void {
  const weeklyShifts = getWeeklyShifts();
  const employees = getEmployees();
  const rotationHistoryMap = new Map<string, number>();

  console.info('[SHIFTS] Processing rotation history, employees available:', employees.length);

  history.forEach((entry) => {
    // Normalize date format: API returns ISO string "2025-12-08T00:00:00.000Z", we need "2025-12-08"
    const dateKey = entry.shiftDate.split('T')[0] ?? entry.shiftDate;
    const shiftType = convertRotationShiftType(entry.shiftType);
    const employeeId = entry.userId;

    console.info('[SHIFTS] Processing entry:', { dateKey, shiftType, employeeId });

    // Store rotation history ID for later deletion
    // Key format: `${date}_${shiftType}_${userId}`
    const historyKey = `${dateKey}_${shiftType}_${String(employeeId)}`;
    rotationHistoryMap.set(historyKey, entry.id);

    // Add to weeklyShifts
    if (!weeklyShifts.has(dateKey)) {
      weeklyShifts.set(dateKey, new Map());
    }
    const dayShifts = weeklyShifts.get(dateKey);
    if (dayShifts !== undefined) {
      if (!dayShifts.has(shiftType)) {
        dayShifts.set(shiftType, []);
      }
      const shiftEmployees = dayShifts.get(shiftType);
      if (shiftEmployees !== undefined && !shiftEmployees.includes(employeeId)) {
        shiftEmployees.push(employeeId);
      }
    }

    // Add to shiftDetails for employee display info
    const employee = employees.find((e) => e.id === employeeId);
    const detailKey = `${dateKey}_${shiftType}_${String(employeeId)}`;
    const shiftDetails = getShiftDetails();
    shiftDetails.set(detailKey, {
      employeeId,
      firstName: employee?.firstName ?? '',
      lastName: employee?.lastName ?? '',
      username: employee?.username ?? '',
      date: dateKey,
      shiftType,
      isRotationShift: true, // Mark as from rotation
    });
  });

  // Update state
  setWeeklyShifts(weeklyShifts);
  setRotationHistoryMap(rotationHistoryMap);

  // DEBUG: Log final state after processing rotation history
  console.info('[ROTATION DEBUG] After processing, weeklyShifts size:', weeklyShifts.size);
  weeklyShifts.forEach((dayShifts, dateKey) => {
    const shifts = Object.fromEntries(dayShifts.entries());
    console.info('[ROTATION DEBUG] Date:', dateKey, 'Shifts:', shifts);
  });
}

/**
 * Process shift plan data from API
 */
export function processShiftPlanData(shiftPlan: ShiftPlanData): void {
  const weeklyShifts = new Map<string, Map<string, number[]>>();
  const shiftDetails = new Map<string, ShiftDetailData>();

  const planId = shiftPlan.planId ?? shiftPlan.plan?.id ?? shiftPlan.id;
  if (planId !== undefined) {
    setCurrentPlanId(planId);
  }

  // Store shift notes from the plan (could be on plan object or root level)
  const shiftNotes = shiftPlan.shiftNotes ?? shiftPlan.plan?.shiftNotes ?? '';
  setCurrentShiftNotes(shiftNotes);

  shiftPlan.shifts.forEach((shift) => {
    // Normalize date to YYYY-MM-DD format (API may return ISO string like "2025-12-08T00:00:00.000Z")
    const dateKey = shift.date.includes('T') ? (shift.date.split('T')[0] ?? shift.date) : shift.date;
    const shiftType = shift.type;
    const employeeId = shift.userId;

    // Add to weeklyShifts
    if (!weeklyShifts.has(dateKey)) {
      weeklyShifts.set(dateKey, new Map());
    }
    const dayShifts = weeklyShifts.get(dateKey);
    if (dayShifts !== undefined) {
      if (!dayShifts.has(shiftType)) {
        dayShifts.set(shiftType, []);
      }
      const shiftEmployees = dayShifts.get(shiftType);
      if (shiftEmployees !== undefined && !shiftEmployees.includes(employeeId)) {
        shiftEmployees.push(employeeId);
      }
    }

    // Add to shiftDetails
    const detailKey = `${dateKey}_${shiftType}_${String(employeeId)}`;
    shiftDetails.set(detailKey, {
      employeeId,
      firstName: shift.user?.firstName ?? '',
      lastName: shift.user?.lastName ?? '',
      username: shift.user?.username ?? '',
      date: dateKey,
      shiftType,
    });
  });

  setWeeklyShifts(weeklyShifts);
  setShiftDetails(shiftDetails);
}

// ============== HELPER FUNCTIONS ==============

/**
 * Get employees assigned to a shift on a specific date
 */
export function getShiftEmployeesForDate(date: string, shiftType: string): number[] {
  const weeklyShifts = getWeeklyShifts();
  const dayShifts = weeklyShifts.get(date);
  if (dayShifts === undefined) return [];
  return dayShifts.get(shiftType) ?? [];
}

/**
 * Add employee to shift in local state (for immediate UI update after drop)
 */
export function addEmployeeToShift(date: string, shiftType: string, employeeId: number, employee: Employee): void {
  const weeklyShifts = getWeeklyShifts();

  // Ensure the day exists
  if (!weeklyShifts.has(date)) {
    weeklyShifts.set(date, new Map());
  }

  const dayShifts = weeklyShifts.get(date);
  if (dayShifts !== undefined) {
    const currentEmployees = dayShifts.get(shiftType) ?? [];
    // Only add if not already present
    if (!currentEmployees.includes(employeeId)) {
      currentEmployees.push(employeeId);
      dayShifts.set(shiftType, currentEmployees);
    }
  }

  // Add employee details for correct rendering
  const shiftDetails = getShiftDetails();
  const detailKey = `${date}_${shiftType}_${String(employeeId)}`;
  shiftDetails.set(detailKey, {
    employeeId,
    firstName: employee.firstName ?? '',
    lastName: employee.lastName ?? '',
    username: employee.username,
    date,
    shiftType,
  });
}

/**
 * Remove employee from shift in local state
 */
export function removeEmployeeFromShift(date: string, shiftType: string, employeeId: number): void {
  const weeklyShifts = getWeeklyShifts();
  const dayShifts = weeklyShifts.get(date);

  if (dayShifts !== undefined) {
    const currentEmployees = dayShifts.get(shiftType) ?? [];
    const filtered = currentEmployees.filter((id) => id !== employeeId);
    dayShifts.set(shiftType, filtered);
  }

  // Remove from shift details
  const shiftDetails = getShiftDetails();
  const detailKey = `${date}_${shiftType}_${String(employeeId)}`;
  shiftDetails.delete(detailKey);
}
