// =============================================================================
// SHIFTS STATE - SHIFT DATA MODULE
// Weekly shifts, shift details, notes
// Decomposed: notes | core state | operations | composition
// =============================================================================

import { addAssignment, createShiftDetail, removeAssignment } from './shift-operations';

import type { Employee, ShiftDetailData, WeeklyShiftsMap } from './types';

function createNotesState() {
  let currentShiftNotes = $state('');
  let weeklyNotes = $state('');

  return {
    get currentShiftNotes() {
      return currentShiftNotes;
    },
    get weeklyNotes() {
      return weeklyNotes;
    },
    setCurrentShiftNotes: (notes: string) => {
      currentShiftNotes = notes;
    },
    setWeeklyNotes: (notes: string) => {
      weeklyNotes = notes;
    },
    clear: () => {
      currentShiftNotes = '';
      weeklyNotes = '';
    },
  };
}

function createCoreShiftState() {
  let weeklyShifts = $state(new Map<string, Map<string, number[]>>());
  let shiftDetails = $state(new Map<string, ShiftDetailData>());

  return {
    get weeklyShifts() {
      return weeklyShifts;
    },
    get shiftDetails() {
      return shiftDetails;
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
    clear: () => {
      weeklyShifts = new Map<string, Map<string, number[]>>();
      shiftDetails = new Map<string, ShiftDetailData>();
    },
  };
}

function createShiftOperations(core: ReturnType<typeof createCoreShiftState>) {
  return {
    getShiftEmployees: (date: string, shiftType: string): number[] => {
      const dayShifts = core.weeklyShifts.get(date);
      return dayShifts === undefined ? [] : (dayShifts.get(shiftType) ?? []);
    },

    addShiftAssignment: (date: string, shiftType: string, employeeId: number) => {
      core.setWeeklyShifts(addAssignment(core.weeklyShifts, date, shiftType, employeeId));
    },

    removeShiftAssignment: (date: string, shiftType: string, employeeId: number) => {
      const result = removeAssignment(
        core.weeklyShifts,
        core.shiftDetails,
        date,
        shiftType,
        employeeId,
      );
      core.setWeeklyShifts(result.weeklyShifts);
      core.setShiftDetails(result.shiftDetails);
    },

    addShiftDetail: (date: string, shiftType: string, employeeId: number, employee: Employee) => {
      core.setShiftDetails(createShiftDetail(core.shiftDetails, date, shiftType, employee));
    },
  };
}

function createShiftDataState() {
  const core = createCoreShiftState();
  const notes = createNotesState();
  const ops = createShiftOperations(core);

  const clearAll = (): void => {
    core.clear();
    notes.clear();
  };

  return {
    get weeklyShifts() {
      return core.weeklyShifts;
    },
    get shiftDetails() {
      return core.shiftDetails;
    },
    get currentShiftNotes() {
      return notes.currentShiftNotes;
    },
    get weeklyNotes() {
      return notes.weeklyNotes;
    },
    get hasShiftData() {
      return core.hasShiftData;
    },
    setWeeklyShifts: core.setWeeklyShifts,
    setShiftDetails: core.setShiftDetails,
    setCurrentShiftNotes: notes.setCurrentShiftNotes,
    setWeeklyNotes: notes.setWeeklyNotes,
    getShiftEmployees: ops.getShiftEmployees,
    addShiftAssignment: ops.addShiftAssignment,
    removeShiftAssignment: ops.removeShiftAssignment,
    addShiftDetail: ops.addShiftDetail,
    clearShiftData: clearAll,
    reset: clearAll,
  };
}

export const shiftDataState = createShiftDataState();
