// =============================================================================
// SHIFTS STATE - SHIFT DATA MODULE
// Weekly shifts, shift details, notes
// =============================================================================

import { addAssignment, removeAssignment, createShiftDetail } from './shift-operations';

import type { WeeklyShiftsMap, ShiftDetailData, Employee } from './types';

function createShiftDataState() {
  let weeklyShifts = $state<WeeklyShiftsMap>(new Map());
  let shiftDetails = $state<Map<string, ShiftDetailData>>(new Map());
  let currentShiftNotes = $state('');
  let weeklyNotes = $state('');

  const clearCore = (): void => {
    weeklyShifts = new Map();
    shiftDetails = new Map();
    currentShiftNotes = '';
    weeklyNotes = '';
  };

  return {
    get weeklyShifts() {
      return weeklyShifts;
    },
    get shiftDetails() {
      return shiftDetails;
    },
    get currentShiftNotes() {
      return currentShiftNotes;
    },
    get weeklyNotes() {
      return weeklyNotes;
    },
    get hasShiftData() {
      return weeklyShifts.size > 0;
    },

    setWeeklyShifts: (shifts: WeeklyShiftsMap) => {
      weeklyShifts = shifts;
    },
    setShiftDetails: (details: Map<string, ShiftDetailData>) => {
      shiftDetails = details;
    },
    setCurrentShiftNotes: (notes: string) => {
      currentShiftNotes = notes;
    },
    setWeeklyNotes: (notes: string) => {
      weeklyNotes = notes;
    },

    getShiftEmployees: (date: string, shiftType: string): number[] => {
      const dayShifts = weeklyShifts.get(date);
      return dayShifts === undefined ? [] : (dayShifts.get(shiftType) ?? []);
    },

    addShiftAssignment: (date: string, shiftType: string, employeeId: number) => {
      weeklyShifts = addAssignment(weeklyShifts, date, shiftType, employeeId);
    },

    removeShiftAssignment: (date: string, shiftType: string, employeeId: number) => {
      const result = removeAssignment(weeklyShifts, shiftDetails, date, shiftType, employeeId);
      weeklyShifts = result.weeklyShifts;
      shiftDetails = result.shiftDetails;
    },

    addShiftDetail: (date: string, shiftType: string, employeeId: number, employee: Employee) => {
      shiftDetails = createShiftDetail(shiftDetails, date, shiftType, employee);
    },

    clearShiftData: clearCore,

    reset: () => {
      clearCore();
    },
  };
}

export const shiftDataState = createShiftDataState();
