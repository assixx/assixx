// =============================================================================
// SHIFTS - PLAN LOADING & STATE SYNCHRONIZATION
// Extracted from +page.svelte for modularity
// =============================================================================

import { tick } from 'svelte';

import {
  fetchAssetAvailability,
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

import type { RotationPatternType } from './types';

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
      assetId: shiftsState.selectedContext.assetId,
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

/** Apply optional fetch results (asset availability + TPM events) to state */
function applyOptionalFetchResults(
  assetAvail: Awaited<ReturnType<typeof fetchAssetAvailability>> | null,
  tpmEvents: Awaited<ReturnType<typeof fetchTpmMaintenanceDates>> | null,
): void {
  if (assetAvail !== null) {
    shiftsState.setAssetAvailability(assetAvail);
  } else {
    shiftsState.clearAssetAvailability();
  }

  if (tpmEvents !== null) {
    shiftsState.setTpmEvents(tpmEvents);
  } else {
    shiftsState.clearTpmEvents();
  }
}

/** Apply processed shift data to state (batched updates) */
function applyShiftPlanState(
  planData: ProcessedShiftData,
  rotationData: ProcessedRotationData,
  patternId: number | null,
  patternType: RotationPatternType | null,
  preserveTpmToggle: boolean,
): void {
  const hasAnyShiftData = rotationData.weeklyShifts.size > 0;
  const shouldLock = hasAnyShiftData && !shiftsState.isEditMode;

  shiftsState.setCurrentPlanId(planData.planId);
  shiftsState.setCurrentShiftNotes(planData.shiftNotes);
  shiftsState.setWeeklyNotes(planData.shiftNotes);
  if (!preserveTpmToggle) {
    shiftsState.setShowTpmEvents(planData.isTpmMode);
  }
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

/**
 * Load the full shift plan for the current week and context.
 * All independent API calls run in parallel to prevent FOUC.
 *
 * @param preserveTpmToggle - When true, keeps the current TPM toggle state
 *   instead of overwriting it from the saved plan. Used when the user
 *   explicitly toggles TPM mode ON (the plan may not have been saved yet).
 */
export async function loadShiftPlan(preserveTpmToggle = false): Promise<void> {
  if (shiftsState.selectedContext.teamId === null) return;

  shiftsState.setIsLoading(true);
  await tick(); // Force DOM update BEFORE API calls

  const { startDate, endDate } = getWeekDateBounds(shiftsState.currentWeek);

  try {
    const teamId = shiftsState.selectedContext.teamId;
    const assetId = shiftsState.selectedContext.assetId;
    const hasAsset = assetId !== null && assetId !== 0;
    // On fresh load (!preserveTpmToggle), always fetch TPM data because
    // the saved plan may have isTpmMode=true — we don't know yet.
    // On week navigation (preserveTpmToggle=true), respect the current toggle.
    const wantTpm = preserveTpmToggle ? shiftsState.showTpmEvents : true;

    // ALL independent fetches in parallel — no waterfall
    const [members, shiftResult, assetAvail, tpmEvents] = await Promise.all([
      fetchTeamMembers(teamId, startDate, endDate),
      fetchAndProcessShiftData(startDate, endDate),
      hasAsset ?
        fetchAssetAvailability(assetId, startDate, endDate)
      : Promise.resolve(null),
      wantTpm ?
        fetchTpmMaintenanceDates(assetId, startDate, endDate)
      : Promise.resolve(null),
    ]);

    const { planResponse, rotationHistory, planData, rotationData } =
      shiftResult;

    // Pattern detection depends on rotationHistory — must be sequential
    const { patternId, patternType } = await loadPatternFromHistory(
      rotationHistory,
      fetchRotationPatternById,
    );

    // --- Batch all state updates in one render frame ---
    shiftsState.setEmployees(convertTeamMembersToEmployees(members));
    applyOptionalFetchResults(assetAvail, tpmEvents);

    applyShiftPlanState(
      planData,
      rotationData,
      patternId,
      patternType,
      preserveTpmToggle,
    );

    // Clear if nothing loaded
    if (planResponse === null && rotationHistory.length === 0) {
      shiftsState.clearShiftData();
    }
  } finally {
    shiftsState.setIsLoading(false);
  }
}
