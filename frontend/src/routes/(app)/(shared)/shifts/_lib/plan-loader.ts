// =============================================================================
// SHIFTS - PLAN LOADING & STATE SYNCHRONIZATION
// Extracted from +page.svelte for modularity
// =============================================================================

import { tick } from 'svelte';

import {
  fetchMachineAvailability,
  fetchTpmMaintenanceDates,
  fetchShiftPlan,
  fetchRotationHistory,
  fetchRotationPatternById,
  fetchTeamMembers,
} from './api';
import {
  processShiftPlanResponse,
  processRotationHistory,
  getWeekDateBounds,
  loadPatternFromHistory,
  convertTeamMembersToEmployees,
  type ProcessedShiftData,
  type ProcessedRotationData,
} from './data-loader';
import { shiftsState } from './state.svelte';

import type { RotationPatternType, TpmMaintenanceEvent } from './types';

// =============================================================================
// NAVIGATION HELPER
// =============================================================================

/** Navigate to the week containing a given date string */
export function navigateToWeekContainingDate(dateStr: string): void {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  shiftsState.setCurrentWeek(monday);
}

// =============================================================================
// ROTATION TOGGLE SYNC
// =============================================================================

/**
 * Sync rotation toggles based on current pattern type and shift data.
 * Sets standard/custom rotation toggles without opening modals.
 */
export function syncRotationToggles(): void {
  const patternType = shiftsState.currentPatternType;
  const hasShiftData = shiftsState.weeklyShifts.size > 0;

  // Standard toggle ON when: hasShiftData AND (alternate_fs OR fixed_n)
  const isStandard =
    hasShiftData &&
    (patternType === 'alternate_fs' || patternType === 'fixed_n');
  // Custom toggle ON when: hasShiftData AND custom
  const isCustom = hasShiftData && patternType === 'custom';

  shiftsState.setStandardRotationEnabledDirect(isStandard);
  shiftsState.setCustomRotationEnabledDirect(isCustom);
}

// =============================================================================
// DATA FETCHING & PROCESSING
// =============================================================================

/** Fetch shift plan and rotation history, then process both */
async function fetchAndProcessShiftData(startDate: string, endDate: string) {
  const [planResponse, rotationHistory] = await Promise.all([
    fetchShiftPlan(startDate, endDate, {
      teamId: shiftsState.selectedContext.teamId,
      departmentId: shiftsState.selectedContext.departmentId,
      areaId: shiftsState.selectedContext.areaId,
      machineId: shiftsState.selectedContext.machineId,
    }),
    fetchRotationHistory(
      startDate,
      endDate,
      shiftsState.selectedContext.teamId,
    ),
  ]);

  const planData = processShiftPlanResponse(planResponse);
  const rotationData = processRotationHistory(
    rotationHistory,
    planData.weeklyShifts,
    planData.shiftDetails,
    shiftsState.employees,
  );

  return { planResponse, rotationHistory, planData, rotationData };
}

/** Apply processed shift data to state (batched updates) */
function applyShiftPlanState(
  planData: ProcessedShiftData,
  rotationData: ProcessedRotationData,
  patternId: number | null,
  patternType: RotationPatternType | null,
): void {
  const hasAnyShiftData = rotationData.weeklyShifts.size > 0;
  const shouldLock = hasAnyShiftData && !shiftsState.isEditMode;

  shiftsState.setCurrentPlanId(planData.planId);
  shiftsState.setCurrentShiftNotes(planData.shiftNotes);
  shiftsState.setWeeklyNotes(planData.shiftNotes);
  shiftsState.setWeeklyShifts(rotationData.weeklyShifts);
  shiftsState.setShiftDetails(rotationData.shiftDetails);
  shiftsState.setRotationHistoryMap(rotationData.rotationHistoryMap);
  shiftsState.setCurrentPatternId(patternId);
  shiftsState.setCurrentPatternType(patternType);
  shiftsState.setIsPlanLocked(shouldLock);
  if (shouldLock) shiftsState.setIsEditMode(false);

  syncRotationToggles();
}

// =============================================================================
// MAIN LOAD FUNCTION
// =============================================================================

/** Load the full shift plan for the current week and context */
export async function loadShiftPlan(): Promise<void> {
  if (shiftsState.selectedContext.teamId === null) return;

  shiftsState.setIsLoading(true);
  await tick(); // Force DOM update BEFORE API calls

  const { startDate, endDate } = getWeekDateBounds(shiftsState.currentWeek);

  try {
    const teamId = shiftsState.selectedContext.teamId;
    const machineId = shiftsState.selectedContext.machineId;

    const [members, { planResponse, rotationHistory, planData, rotationData }] =
      await Promise.all([
        fetchTeamMembers(teamId, startDate, endDate),
        fetchAndProcessShiftData(startDate, endDate),
      ]);

    // Update employees with fresh availability data for this week
    shiftsState.setEmployees(convertTeamMembersToEmployees(members));

    // Load machine availability + TPM events for the displayed week (if a machine is selected)
    if (machineId !== null && machineId !== 0) {
      const emptyTpmMap = new Map<string, TpmMaintenanceEvent[]>();
      const [availEntries, tpmEvents] = await Promise.all([
        fetchMachineAvailability(machineId, startDate, endDate),
        shiftsState.showTpmEvents ?
          fetchTpmMaintenanceDates(machineId, startDate, endDate)
        : Promise.resolve(emptyTpmMap),
      ]);
      shiftsState.setMachineAvailability(availEntries);
      shiftsState.setTpmEvents(tpmEvents);
    } else {
      shiftsState.clearMachineAvailability();
      shiftsState.clearTpmEvents();
    }

    // Load pattern type from rotation history
    const { patternId, patternType } = await loadPatternFromHistory(
      rotationHistory,
      fetchRotationPatternById,
    );

    // Apply all state updates
    applyShiftPlanState(planData, rotationData, patternId, patternType);

    // Clear if nothing loaded
    if (planResponse === null && rotationHistory.length === 0) {
      shiftsState.clearShiftData();
    }
  } finally {
    shiftsState.setIsLoading(false);
  }
}
