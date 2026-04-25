// =============================================================================
// SHIFTS - PAGE ACTIONS
// Admin actions, favorites, custom rotation handlers
// Extracted from +page.svelte for modularity
// =============================================================================

import { invalidateAll, goto } from '$app/navigation';
import { resolve } from '$app/paths';

import { DEFAULT_HIERARCHY_LABELS, type HierarchyLabels } from '$lib/types/hierarchy-labels';
import {
  showSuccessAlert,
  showErrorAlert,
  showWarningAlert,
  showConfirm,
  showConfirmDanger,
  showConfirmWarning,
} from '$lib/utils/alerts';
import { createLogger } from '$lib/utils/logger';
import { checkSessionExpired } from '$lib/utils/session-expired';

import {
  saveSchedule,
  discardWeek,
  discardTeamPlan,
  discardYearPlan,
  deleteFavoriteById,
  addToFavorites,
} from './admin-actions';
import {
  fetchDepartments,
  fetchAssets,
  fetchTeams,
  fetchTeamMembers,
  generateRotationFromConfig,
} from './api';
import { getOrCreateDraft } from './api-shift-handover';
import { convertTeamMembersToEmployees, getWeekDateBounds } from './data-loader';
import { loadShiftPlan, navigateToWeekContainingDate } from './plan-loader';
import { buildAlgorithmConfig, buildRotationAssignments } from './rotation';
import { type createHandoverState, type HandoverContext, shiftsState } from './state.svelte';

import type { ShiftTimesMap, ShiftFavorite, CustomRotationConfig } from './types';

type HandoverState = ReturnType<typeof createHandoverState>;

const log = createLogger('ShiftsActions');

// =============================================================================
// UNSAVED CHANGES GUARD
// =============================================================================

/**
 * Gate für Aktionen, die den aktuellen weeklyShifts-State überschreiben würden
 * (Wochen-Nav, Filter-Change, Route-Leave). Fragt den User per Warning-Modal,
 * wenn isDirty === true — sonst fährt er still durch.
 *
 * WHY: Drag-and-Drop mutiert weeklyShifts lokal. Ohne Guard wirft jede
 * Reload-Aktion (loadShiftPlan) die Änderungen weg — der User verliert Arbeit.
 * Baseline-Tracking via captureSnapshot() nach Load + Save (siehe ADR-011 +
 * state-shifts.svelte.ts isDirty).
 *
 * Returns: true = fortfahren, false = abbrechen
 */
export async function ensureDiscardConfirmed(): Promise<boolean> {
  if (!shiftsState.isDirty) return true;
  return await showConfirmWarning(
    'Sie haben ungespeicherte Schichtzuweisungen. Fortfahren ohne zu speichern? Änderungen gehen verloren.',
    'Ungespeicherte Änderungen',
  );
}

// =============================================================================
// SCHEDULE ACTIONS
// =============================================================================

/** Reset schedule - exit edit mode or clear data */
export async function handleResetSchedule(): Promise<void> {
  if (shiftsState.isEditMode) {
    shiftsState.setIsEditMode(false);
    await loadShiftPlan();
  } else {
    shiftsState.clearShiftData();
  }
}

/** Save the current shift schedule */
export async function handleSaveSchedule(shiftTimesMap?: ShiftTimesMap): Promise<void> {
  shiftsState.setIsLoading(true);
  try {
    const result = await saveSchedule({
      weeklyShifts: shiftsState.weeklyShifts,
      weeklyNotes: shiftsState.weeklyNotes,
      currentWeek: shiftsState.currentWeek,
      currentPlanId: shiftsState.currentPlanId,
      selectedContext: shiftsState.selectedContext,
      teams: shiftsState.teams,
      shiftTimesMap,
    });
    if (shiftsState.currentPlanId === null && result.planId !== undefined)
      shiftsState.setCurrentPlanId(result.planId);
    shiftsState.setIsPlanLocked(true);
    shiftsState.setIsEditMode(false);
    // Gespeicherter Stand ist die neue Baseline — isDirty wird wieder false.
    // Siehe ADR-011 + state-shifts.svelte.ts für die Snapshot-Semantik.
    shiftsState.captureSnapshot();
    showSuccessAlert('Schichtplan erfolgreich gespeichert!');
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      'code' in error &&
      'details' in error &&
      (error as unknown as { code: string }).code === 'VALIDATION_ERROR' &&
      Array.isArray((error as unknown as { details: unknown }).details)
    ) {
      const details = (error as unknown as { details: { message: string }[] }).details;
      const messages = details.map((d) => d.message).join(', ');
      showErrorAlert(messages);
    } else {
      const message =
        error instanceof Error ? error.message : 'Fehler beim Speichern des Schichtplans.';
      showErrorAlert(message);
    }
  } finally {
    shiftsState.setIsLoading(false);
  }
}

// =============================================================================
// DISCARD ACTIONS
// =============================================================================

/** Discard all shifts for the current week */
export async function handleDiscardWeek(): Promise<void> {
  const confirmed = await showConfirmDanger(
    'Möchten Sie wirklich alle Schichten dieser Woche löschen?\n\n⚠️ Die Daten sind unwiderruflich weg!',
    'Woche verwerfen',
  );
  if (!confirmed) return;
  const teamId = shiftsState.selectedContext.teamId;
  if (teamId === null) return;
  shiftsState.setIsLoading(true);
  try {
    await discardWeek({ teamId, currentWeek: shiftsState.currentWeek });
    shiftsState.setIsEditMode(false);
    shiftsState.clearShiftData();
    await loadShiftPlan();
  } catch {
    showErrorAlert('Fehler beim Verwerfen der Woche.');
  } finally {
    shiftsState.setIsLoading(false);
  }
}

/** Discard a specific rotation pattern */
export async function handleDiscardTeamPlan(): Promise<void> {
  const teamId = shiftsState.selectedContext.teamId;
  const patternId = shiftsState.currentPatternId;

  if (teamId === null || patternId === null) {
    showWarningAlert('Kein Rotationsmuster zum Löschen vorhanden.');
    return;
  }

  const confirmed = await showConfirmDanger(
    'Möchten Sie dieses Rotationsmuster löschen?\n\n⚠️ Alle zugehörigen Schichten werden unwiderruflich gelöscht!\n\nAndere Rotationsmuster bleiben erhalten.',
    'Rotationsmuster löschen',
  );
  if (!confirmed) return;

  shiftsState.setIsLoading(true);
  try {
    await discardTeamPlan({ teamId, patternId });
    shiftsState.clearShiftData();
    shiftsState.setCurrentPlanId(null);
    shiftsState.setCurrentPatternId(null);
    shiftsState.setCurrentPatternType(null);
    shiftsState.setIsEditMode(false);
    shiftsState.setIsPlanLocked(false);
  } catch {
    showErrorAlert('Fehler beim Verwerfen des Rotationsmusters.');
  } finally {
    shiftsState.setIsLoading(false);
  }
}

/** Discard all rotation plans for the current team */
export async function handleDiscardYearPlan(): Promise<void> {
  const teamId = shiftsState.selectedContext.teamId;
  if (teamId === null) {
    showWarningAlert('Kein Team ausgewählt.');
    return;
  }

  const currentYear = new Date().getFullYear();
  const confirmed = await showConfirmDanger(
    `⚠️ ACHTUNG: KOMPLETTER RESET!\n\nSie löschen ALLE Rotationspläne für dieses Team.\n\n` +
      `Dies betrifft ALLE Schichten des Teams für ${currentYear}!\n\n` +
      `Andere Teams sind NICHT betroffen.\n\n` +
      `Diese Aktion kann NICHT rückgängig gemacht werden!`,
    `Kompletten Plan löschen (${currentYear})`,
  );
  if (!confirmed) return;

  shiftsState.setIsLoading(true);
  try {
    await discardYearPlan({ teamId });
    shiftsState.clearShiftData();
    shiftsState.setCurrentPlanId(null);
    shiftsState.setCurrentPatternId(null);
    shiftsState.setCurrentPatternType(null);
    shiftsState.setIsEditMode(false);
    shiftsState.setIsPlanLocked(false);
    showSuccessAlert('Alle Rotationspläne wurden gelöscht.');
  } catch {
    showErrorAlert('Fehler beim Löschen der Rotationspläne.');
  } finally {
    shiftsState.setIsLoading(false);
  }
}

// =============================================================================
// FAVORITES
// =============================================================================

/** Delete a favorite */
export async function handleDeleteFavorite(favoriteId: number, event: MouseEvent): Promise<void> {
  event.stopPropagation();
  if (!(await showConfirm('Möchten Sie diesen Favoriten wirklich löschen?'))) return;
  try {
    await deleteFavoriteById(favoriteId);
    await invalidateAll();
    showSuccessAlert('Favorit wurde gelöscht.');
  } catch {
    showErrorAlert('Fehler beim Löschen des Favoriten.');
  }
}

/** Add current context to favorites */
export async function handleAddToFavorites(
  labels: HierarchyLabels = DEFAULT_HIERARCHY_LABELS,
): Promise<void> {
  const { areaId, departmentId, teamId } = shiftsState.selectedContext;
  if (areaId === null || departmentId === null || teamId === null) {
    showWarningAlert(
      `Bitte wählen Sie zuerst ${labels.area}, ${labels.department} und ${labels.team} aus.`,
    );
    return;
  }
  try {
    const newFavorite = await addToFavorites({
      selectedContext: shiftsState.selectedContext,
      areas: shiftsState.areas,
      departments: shiftsState.departments,
      assets: shiftsState.assets,
      teams: shiftsState.teams,
    });
    if (newFavorite !== null) {
      await invalidateAll();
      showSuccessAlert(`Favorit erfolgreich gespeichert!`);
    } else {
      showErrorAlert('Fehler beim Laden der Daten.');
    }
  } catch {
    showErrorAlert('Fehler beim Speichern des Favoriten.');
  }
}

/** Handle favorite click - load favorite's context */
export async function handleFavoriteClick(favorite: ShiftFavorite): Promise<void> {
  const { startDate, endDate } = getWeekDateBounds(shiftsState.currentWeek);

  const [depts, machs, tms, members] = await Promise.all([
    fetchDepartments(favorite.areaId),
    fetchAssets(favorite.teamId),
    fetchTeams(favorite.departmentId),
    fetchTeamMembers(favorite.teamId, startDate, endDate),
  ]);

  shiftsState.setDepartments(depts);
  shiftsState.setAssets(machs);
  shiftsState.setTeams(tms);

  const teamLeaderId = tms.find((t) => t.id === favorite.teamId)?.leaderId ?? null;
  shiftsState.setSelectedContext({
    areaId: favorite.areaId,
    departmentId: favorite.departmentId,
    assetId: favorite.assetId,
    teamId: favorite.teamId,
    teamLeaderId,
  });

  shiftsState.setEmployees(convertTeamMembersToEmployees(members));
  shiftsState.setShowPlanningUI(true);
  await loadShiftPlan();
}

// =============================================================================
// CUSTOM ROTATION
// =============================================================================

/** Handle custom rotation generation */
export async function handleCustomRotationGenerate(config: CustomRotationConfig): Promise<void> {
  const teamId = shiftsState.selectedContext.teamId;
  const departmentId = shiftsState.selectedContext.departmentId;
  if (teamId === null) {
    showErrorAlert('Kein Team ausgewählt');
    return;
  }

  try {
    const algorithmConfig = buildAlgorithmConfig(config);
    const assignments = buildRotationAssignments(
      config.employeeAssignments,
      shiftsState.getEmployeeById,
    );

    if (assignments.length === 0) {
      showErrorAlert('Bitte weisen Sie mindestens einem Mitarbeiter eine Schichtgruppe zu.');
      return;
    }

    const result = await generateRotationFromConfig({
      config: algorithmConfig,
      assignments,
      startDate: config.startDate,
      endDate: config.endDate,
      teamId,
      departmentId: departmentId ?? undefined,
    });

    shiftsState.setShowCustomRotationModal(false);
    showSuccessAlert(`Custom Rotation erstellt! ${result.shiftsCreated} Schichten generiert.`);
    navigateToWeekContainingDate(config.startDate);
    void loadShiftPlan();
  } catch (error: unknown) {
    log.error({ err: error }, 'Custom rotation error');
    showErrorAlert(error instanceof Error ? error.message : 'Fehler bei der Custom Rotation');
  }
}

// =============================================================================
// SHIFT-HANDOVER OPEN/CREATE
// =============================================================================

/**
 * Open or create a shift-handover entry for a given grid cell.
 *
 * Behaviour by cell state:
 *   - entry exists                            → /shift-handover/${uuid}
 *   - no entry, writable (assignee OR manager) → POST /shift-handover/entries
 *                                                 (idempotent `getOrCreateDraft`),
 *                                                 then nav to detail page;
 *                                                 4xx → toast with backend's
 *                                                 German reason from
 *                                                 WRITE_DENIED_MESSAGES.
 *   - no entry, read-only peek                → warning toast, no nav
 *
 * Spec Deviation #11 (supersedes #9, 2026-04-25): replaces the previous
 * server-load trampoline `/shift-handover/new?team&date&slot` + URL-param
 * toast bridge with direct client-side POST. Matches the canonical pattern
 * used across the codebase (Blackboard / KVP / Surveys / TPM). Eliminates
 * the router-init `replaceState` race + the dedupe bug that swallowed
 * repeat-toasts on subsequent clicks with the same denial reason.
 *
 * Sync wrapper around an async IIFE so the grid's `onhandoverClick` prop
 * (typed `(ctx) => void`) accepts this handler without `no-misused-promises`
 * complaints.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §Spec Deviations #11
 * @see docs/infrastructure/adr/ADR-052-shift-handover-protocol.md
 */
export function handleHandoverOpen(
  ctx: HandoverContext,
  handover: HandoverState,
  canManage: boolean,
): void {
  const teamId = shiftsState.selectedContext.teamId;
  if (teamId === null) return;

  const existingId = handover.lookupEntryId(ctx.shiftDate, ctx.shiftKey);
  if (existingId !== null) {
    void goto(resolve(`/shift-handover/${existingId}`));
    return;
  }

  const empIds = shiftsState.getShiftEmployees(ctx.shiftDate, ctx.shiftKey);
  const isAssignee = empIds.includes(shiftsState.currentUserId ?? -1);
  if (!canManage && !isAssignee) {
    showWarningAlert('Für diese Schicht wurde keine Übergabe angelegt.');
    return;
  }

  void (async () => {
    try {
      const entry = await getOrCreateDraft(teamId, ctx.shiftDate, ctx.shiftKey);
      void goto(resolve(`/shift-handover/${entry.id}`));
    } catch (err: unknown) {
      if (checkSessionExpired(err)) return;
      showErrorAlert(err instanceof Error ? err.message : 'Übergabe konnte nicht angelegt werden.');
    }
  })();
}
