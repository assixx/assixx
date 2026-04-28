// =============================================================================
// SHIFTS STATE - SHIFT DATA MODULE
// Weekly shifts, shift details, notes
// Decomposed: notes | core state | operations | composition
// =============================================================================

import { hasUnsavedChanges } from './handlers';
import { addAssignment, createShiftDetail, removeAssignment } from './shift-operations';

import type { Employee, ShiftDetailData, WeeklyShiftsMap } from './types';

// WHY: Dirty detection for the "unsaved changes" guard (ADR-045-style UX).
// A deep snapshot of the loaded plan is taken after loadShiftPlan() and after a
// successful save; weeklyShifts != snapshot ⇒ isDirty. See
// handlers.ts hasUnsavedChanges() for the structural compare.
function cloneWeeklyShifts(source: WeeklyShiftsMap): WeeklyShiftsMap {
  const copy = new Map<string, Map<string, number[]>>();
  for (const [date, dayShifts] of source) {
    const dayCopy = new Map<string, number[]>();
    for (const [shiftType, userIds] of dayShifts) {
      dayCopy.set(shiftType, [...userIds]);
    }
    copy.set(date, dayCopy);
  }
  return copy;
}

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
  // WHY: Snapshot of the most recently loaded/saved weeklyShifts — reference point
  // for isDirty. null = "never loaded yet" (hasUnsavedChanges → dirty when size > 0).
  let originalWeeklyShifts = $state<WeeklyShiftsMap | null>(null);

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
    get isDirty() {
      return hasUnsavedChanges(weeklyShifts, originalWeeklyShifts);
    },
    setWeeklyShifts: (shifts: WeeklyShiftsMap) => {
      weeklyShifts = shifts;
    },
    setShiftDetails: (details: Map<string, ShiftDetailData>) => {
      shiftDetails = details;
    },
    // Snapshot after loadShiftPlan() / handleSaveSchedule() — promotes the current
    // state to the new baseline. Deep-clone is mandatory (shift-operations does
    // produce fresh top-level Maps, but the inner number[] arrays could be shared
    // — a later splice() call in the drop handler would otherwise also mutate
    // the snapshot and isDirty would falsely report false).
    captureSnapshot: () => {
      originalWeeklyShifts = cloneWeeklyShifts(weeklyShifts);
    },
    clearSnapshot: () => {
      originalWeeklyShifts = null;
    },
    clear: () => {
      weeklyShifts = new Map<string, Map<string, number[]>>();
      shiftDetails = new Map<string, ShiftDetailData>();
      originalWeeklyShifts = null;
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
    get isDirty() {
      return core.isDirty;
    },
    setWeeklyShifts: core.setWeeklyShifts,
    setShiftDetails: core.setShiftDetails,
    setCurrentShiftNotes: notes.setCurrentShiftNotes,
    setWeeklyNotes: notes.setWeeklyNotes,
    getShiftEmployees: ops.getShiftEmployees,
    addShiftAssignment: ops.addShiftAssignment,
    removeShiftAssignment: ops.removeShiftAssignment,
    addShiftDetail: ops.addShiftDetail,
    captureSnapshot: core.captureSnapshot,
    clearSnapshot: core.clearSnapshot,
    clearShiftData: clearAll,
    reset: clearAll,
  };
}

export const shiftDataState = createShiftDataState();
