/**
 * Week Rendering for Shift Planning System
 * Handles rendering the weekly shift grid
 *
 * @module shifts/week-renderer
 */

import {
  getCurrentWeek,
  getSelectedContext,
  getWeeklyShifts,
  getShiftDetails,
  getEmployees,
  isAdmin as getIsAdmin,
  isEditMode as getIsEditMode,
  getCurrentPlanId,
  setCurrentPatternType,
  isContextComplete,
  clearShiftData,
  getCurrentShiftNotes,
} from './state';
import { fetchShiftPlan } from './api';
import { updateShiftCellContent, updateDayHeader, resetLockState } from './ui';
import { formatDateForApi, getWeekDates } from './utils';
import { CSS_SELECTORS, DOM_IDS } from './constants';
import { $$id } from '../../utils/dom-utils';
import { loadRotationHistory, loadExistingPattern, loadPatternById } from './rotation';
import { processShiftPlanData, processRotationHistoryData } from './data-processing';

// ============== TYPES ==============

/** Callback for applying lock state after render */
export type ApplyLockStateCallback = () => void;

// Store callback reference (set by index.ts)
let applyLockStateCallback: ApplyLockStateCallback | null = null;

/**
 * Register the lock state callback
 * Called from index.ts to avoid circular imports
 */
export function setApplyLockStateCallback(callback: ApplyLockStateCallback): void {
  applyLockStateCallback = callback;
}

// ============== HELPER FUNCTIONS ==============

/**
 * Update the notes textarea with current week's notes
 */
function updateNotesTextarea(): void {
  const notesTextarea = $$id(DOM_IDS.WEEKLY_NOTES) as HTMLTextAreaElement | null;
  if (notesTextarea !== null) {
    notesTextarea.value = getCurrentShiftNotes();
  }
}

/**
 * Determine and set pattern type from rotation history or fallback to active pattern
 */
async function determinePatternType(rotationHistory: { patternId?: number }[], teamId: number): Promise<void> {
  // If history exists, try to get pattern type from the actual pattern used
  if (rotationHistory.length > 0) {
    const firstEntry = rotationHistory[0];
    if (firstEntry?.patternId !== undefined) {
      const pattern = await loadPatternById(firstEntry.patternId);
      if (pattern !== null) {
        setCurrentPatternType(pattern.patternType);
        console.info('[LOAD] Pattern type from history patternId:', firstEntry.patternId, '→', pattern.patternType);
        return;
      }
    }
  }

  // Fallback: load any active pattern for the team
  const existingPattern = await loadExistingPattern(teamId);
  if (existingPattern !== null) {
    setCurrentPatternType(existingPattern.patternType);
    console.info('[LOAD] Pattern type fallback:', existingPattern.patternType);
  } else {
    setCurrentPatternType(null);
    console.info('[LOAD] No pattern found');
  }
}

// ============== WEEK RENDERING ==============

/**
 * Render the current week view
 */
export async function renderCurrentWeek(): Promise<void> {
  const currentWeek = getCurrentWeek();
  const weekDates = getWeekDates(currentWeek);

  // Update week display header (always show current week info)
  updateWeekDisplay(weekDates);

  // Skip full render if no team selected yet
  // Data only loads when: favorite clicked OR all 4 filters selected
  if (!isContextComplete()) {
    return;
  }

  // Load shift data for the week
  await loadWeekShifts(weekDates);

  // Reset lock state cache BEFORE rendering new cells
  resetLockState();

  // Render shift cells
  renderShiftCells(weekDates);

  // Apply lock state and button visibility via callback
  if (applyLockStateCallback !== null) {
    applyLockStateCallback();
  }
}

/**
 * Update the week display header
 */
export function updateWeekDisplay(weekDates: Date[]): void {
  const firstDay = weekDates[0];
  const lastDay = weekDates[6];

  if (firstDay === undefined || lastDay === undefined) return;

  const weekLabel = document.getElementById('currentWeekInfo');
  if (weekLabel !== null) {
    const formatDateFull = (d: Date): string => {
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      return `${day}.${month}.${year}`;
    };
    const weekNum = getWeekNumber(firstDay);
    weekLabel.textContent = `KW ${String(weekNum)} - ${formatDateFull(firstDay)} bis ${formatDateFull(lastDay)}`;
  }

  // Update day headers (skip first one which is the "Schicht" label)
  const dayHeaders = document.querySelectorAll('.schedule-header .day-header');
  dayHeaders.forEach((header, index) => {
    // Skip first header (index 0) which is the "Schicht" label column
    if (index === 0) return;

    // weekDates[0] = Monday, so we need weekDates[index - 1]
    const date = weekDates.at(index - 1);
    if (date !== undefined) {
      updateDayHeader(header, date);
    }
  });
}

/**
 * Load shifts for the given week
 * Fetches both regular shift plan AND rotation history, merging results
 */
export async function loadWeekShifts(weekDates: Date[]): Promise<void> {
  const firstDay = weekDates[0];
  const lastDay = weekDates[6];

  if (firstDay === undefined || lastDay === undefined) return;

  // Clear previous week's data before loading new week
  // This resets currentPlanId, weeklyShifts, shiftDetails, etc.
  clearShiftData();

  const startDate = formatDateForApi(firstDay);
  const endDate = formatDateForApi(lastDay);
  const context = getSelectedContext();

  // Fetch regular shift plan
  const shiftPlan = await fetchShiftPlan(startDate, endDate, {
    departmentId: context.departmentId,
    teamId: context.teamId,
    machineId: context.machineId,
    areaId: context.areaId,
  });

  if (shiftPlan !== null) {
    processShiftPlanData(shiftPlan);
  }

  // Also load rotation history and pattern type if team is selected
  if (context.teamId !== null) {
    console.info('[LOAD] Fetching rotation history for team:', context.teamId, 'dates:', startDate, 'to', endDate);
    const rotationHistory = await loadRotationHistory(startDate, endDate, context.teamId);

    console.info('[LOAD] Rotation history API returned:', rotationHistory.length, 'entries');
    if (rotationHistory.length > 0) {
      console.info('[LOAD] First entry:', JSON.stringify(rotationHistory[0]));
      processRotationHistoryData(rotationHistory);
    }

    // Determine pattern type from history or fallback to active pattern
    await determinePatternType(rotationHistory, context.teamId);
  } else {
    setCurrentPatternType(null);
  }

  // Update notes textarea with loaded data
  updateNotesTextarea();

  // DEBUG: Final state after all processing
  const finalWeeklyShifts = getWeeklyShifts();
  console.info('[LOAD COMPLETE] Final weeklyShifts Map size:', finalWeeklyShifts.size);
  finalWeeklyShifts.forEach((dayShifts, dateKey) => {
    const shifts = Object.fromEntries(dayShifts.entries());
    console.info('[LOAD COMPLETE] Date:', dateKey, 'Shifts:', JSON.stringify(shifts));
  });
}

/**
 * Render all shift cells for the week
 */
export function renderShiftCells(weekDates: Date[]): void {
  const shiftTypes = ['early', 'late', 'night'];
  // Map dayIndex (0-6) to day name as used in HTML (monday-sunday)
  const dayIndexToName = new Map<number, string>([
    [0, 'monday'],
    [1, 'tuesday'],
    [2, 'wednesday'],
    [3, 'thursday'],
    [4, 'friday'],
    [5, 'saturday'],
    [6, 'sunday'],
  ]);
  const weeklyShifts = getWeeklyShifts();
  const shiftDetails = getShiftDetails();
  const employees = getEmployees();
  const isAdmin = getIsAdmin();
  const isEditMode = getIsEditMode();
  const currentPlanId = getCurrentPlanId();

  // DEBUG: Log week dates mapping
  console.info(
    '[RENDER DEBUG] Week dates:',
    weekDates.map((d, i) => ({
      index: i,
      dayName: dayIndexToName.get(i),
      date: formatDateForApi(d),
      localDate: d.toLocaleDateString('de-DE'),
    })),
  );

  // DEBUG: Log weeklyShifts Map content
  console.info('[RENDER DEBUG] weeklyShifts Map size:', weeklyShifts.size);
  weeklyShifts.forEach((dayShifts, dateKey) => {
    const shifts = Object.fromEntries(dayShifts.entries());
    console.info('[RENDER DEBUG] Date:', dateKey, 'Shifts:', shifts);
  });

  weekDates.forEach((date, dayIndex) => {
    const dateKey = formatDateForApi(date);
    const dayName = dayIndexToName.get(dayIndex);
    if (dayName === undefined) return;

    shiftTypes.forEach((shiftType) => {
      // HTML uses day names (monday, tuesday, etc.), not numbers
      const cellSelector = `.shift-cell[data-day="${dayName}"][data-shift="${shiftType}"]`;
      const cell = document.querySelector<HTMLElement>(cellSelector);

      if (cell === null) return;

      // Set data-date attribute for drag-drop functionality
      cell.dataset['date'] = dateKey;

      const assignmentDiv = cell.querySelector(CSS_SELECTORS.EMPLOYEE_ASSIGNMENT);
      if (assignmentDiv === null) return;

      // Get employees for this shift
      const dayShifts = weeklyShifts.get(dateKey);
      const employeeIds = dayShifts?.get(shiftType) ?? [];

      // Update cell content
      updateShiftCellContent(
        assignmentDiv,
        employeeIds,
        employees,
        shiftDetails,
        dateKey,
        shiftType,
        isAdmin,
        isEditMode,
        currentPlanId,
      );
    });
  });
}

// ============== UTILITY FUNCTIONS ==============

/**
 * Get ISO week number
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
