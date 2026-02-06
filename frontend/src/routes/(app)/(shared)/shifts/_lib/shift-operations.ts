// =============================================================================
// SHIFTS - SHIFT OPERATIONS (Pure functions)
// Operations for modifying shift assignments
// =============================================================================

import { SvelteMap } from 'svelte/reactivity';

import type { WeeklyShiftsMap, ShiftDetailData, Employee } from './types';

/** Deep copy weekly shifts map for reactivity */
export function cloneWeeklyShifts(
  source: WeeklyShiftsMap,
): SvelteMap<string, Map<string, number[]>> {
  const result = new SvelteMap<string, Map<string, number[]>>();
  for (const [d, dayShifts] of source.entries()) {
    const newDayShifts = new SvelteMap<string, number[]>();
    for (const [shift, emps] of dayShifts.entries())
      newDayShifts.set(shift, [...emps]);
    result.set(d, newDayShifts);
  }
  return result;
}

/** Clone shift details map */
export function cloneShiftDetails(
  source: Map<string, ShiftDetailData>,
): SvelteMap<string, ShiftDetailData> {
  const result = new SvelteMap<string, ShiftDetailData>();
  for (const [k, v] of source.entries()) result.set(k, { ...v });
  return result;
}

/** Add employee to a shift, returns new weeklyShifts map */
export function addAssignment(
  weeklyShifts: WeeklyShiftsMap,
  date: string,
  shiftType: string,
  employeeId: number,
): WeeklyShiftsMap {
  const ws = cloneWeeklyShifts(weeklyShifts);
  if (!ws.has(date)) ws.set(date, new SvelteMap());
  const day = ws.get(date);
  if (day !== undefined) {
    const cur = day.get(shiftType) ?? [];
    if (!cur.includes(employeeId)) day.set(shiftType, [...cur, employeeId]);
  }
  return ws;
}

/** Remove employee from a shift, returns updated maps */
export function removeAssignment(
  weeklyShifts: WeeklyShiftsMap,
  shiftDetails: Map<string, ShiftDetailData>,
  date: string,
  shiftType: string,
  employeeId: number,
): {
  weeklyShifts: WeeklyShiftsMap;
  shiftDetails: Map<string, ShiftDetailData>;
} {
  const ws = cloneWeeklyShifts(weeklyShifts);
  const day = ws.get(date);
  if (day !== undefined) {
    const upd = (day.get(shiftType) ?? []).filter((id) => id !== employeeId);
    if (upd.length > 0) day.set(shiftType, upd);
    else day.delete(shiftType);
    if (day.size === 0) ws.delete(date);
  }
  const det = cloneShiftDetails(shiftDetails);
  det.delete(`${date}_${shiftType}_${employeeId}`);
  return { weeklyShifts: ws, shiftDetails: det };
}

/** Create shift detail entry, returns new shiftDetails map */
export function createShiftDetail(
  shiftDetails: Map<string, ShiftDetailData>,
  date: string,
  shiftType: string,
  employee: Employee,
): Map<string, ShiftDetailData> {
  const newDetails = new SvelteMap(shiftDetails);
  newDetails.set(`${date}_${shiftType}_${employee.id}`, {
    employeeId: employee.id,
    firstName: employee.firstName ?? '',
    lastName: employee.lastName ?? '',
    username: employee.username,
    date,
    shiftType,
  });
  return newDetails;
}
