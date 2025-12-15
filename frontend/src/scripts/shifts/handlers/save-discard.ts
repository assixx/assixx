/**
 * Save and Discard Handlers for Shift Planning System
 * Handles saving, resetting, and discarding shift plans
 *
 * @module shifts/handlers/save-discard
 */

import { showInfo } from '../../auth/index';
import { showSuccessAlert, showErrorAlert, showConfirm, showConfirmDanger } from '../../utils/alerts';
import { $$id } from '../../../utils/dom-utils';
import {
  getCurrentWeek,
  getSelectedContext,
  getWeeklyShifts,
  getCurrentPlanId,
  isEditMode as getIsEditMode,
  setIsEditMode,
  setCurrentPlanId,
  clearShiftData,
  getPendingRotationDeletions,
  clearPendingRotationDeletions,
} from '../state';
import {
  createShiftPlan,
  updateShiftPlan,
  deleteRotationHistoryByWeek,
  deleteRotationHistoryByTeam,
  deleteRotationHistoryEntry,
} from '../api';
import { formatDateForApi, getWeekDates } from '../utils';
import { DOM_IDS } from '../constants';
import { collectShiftsFromWeeklyMap, buildPlanData } from '../data-processing';
import { getWeekNumber } from '../week-renderer';

// ============== TYPES ==============

/** Callback for rendering current week */
export type RenderWeekCallback = () => Promise<void>;

/** Callback for applying lock state */
export type ApplyLockStateCallback = () => void;

// Store callback references (set by index.ts)
let renderWeekCallback: RenderWeekCallback | null = null;
let applyLockStateCallback: ApplyLockStateCallback | null = null;

/**
 * Register the render week callback
 * Called from index.ts to avoid circular imports
 */
export function setRenderWeekCallback(callback: RenderWeekCallback): void {
  renderWeekCallback = callback;
}

/**
 * Register the apply lock state callback
 * Called from index.ts to avoid circular imports
 */
export function setApplyLockStateCallback(callback: ApplyLockStateCallback): void {
  applyLockStateCallback = callback;
}

// ============== HELPER FUNCTIONS ==============

/**
 * Process pending rotation history deletions
 */
async function processPendingRotationDeletions(): Promise<void> {
  const pendingDeletions = getPendingRotationDeletions();
  if (pendingDeletions.size === 0) return;

  console.info('[SHIFTS] Deleting pending rotation history entries:', pendingDeletions.size);
  for (const historyId of pendingDeletions) {
    try {
      await deleteRotationHistoryEntry(historyId);
      console.info('[SHIFTS] Deleted rotation history entry:', historyId);
    } catch (deleteError) {
      console.warn('[SHIFTS] Failed to delete rotation history entry:', historyId, deleteError);
    }
  }
  clearPendingRotationDeletions();
}

/**
 * Save or update shift plan via API
 */
async function saveOrUpdatePlan(planData: ReturnType<typeof buildPlanData>): Promise<void> {
  const currentPlanId = getCurrentPlanId();
  if (currentPlanId !== null) {
    await updateShiftPlan(currentPlanId, planData);
    return;
  }
  if (planData.shifts.length > 0) {
    const result = await createShiftPlan(planData);
    setCurrentPlanId(result.planId);
  }
}

// ============== SAVE HANDLER ==============

/**
 * Handle save schedule
 */
export async function handleSaveSchedule(): Promise<void> {
  if (!getIsEditMode()) {
    showInfo('Keine Änderungen zum Speichern');
    return;
  }

  const confirmed = await showConfirm('Schichtplan speichern?');
  if (!confirmed) return;

  try {
    const weekDates = getWeekDates(getCurrentWeek());
    const firstDay = weekDates[0];
    const lastDay = weekDates[6];
    if (firstDay === undefined || lastDay === undefined) return;

    // Read notes from textarea
    const notesTextarea = $$id(DOM_IDS.WEEKLY_NOTES) as HTMLTextAreaElement | null;
    const shiftNotes = notesTextarea?.value ?? '';

    const shifts = collectShiftsFromWeeklyMap(getWeeklyShifts());
    const planData = buildPlanData(
      formatDateForApi(firstDay),
      formatDateForApi(lastDay),
      `Schichtplan KW ${String(getWeekNumber(firstDay))}`,
      shifts,
      getSelectedContext(),
      shiftNotes,
    );

    await processPendingRotationDeletions();
    await saveOrUpdatePlan(planData);

    setIsEditMode(false);
    showSuccessAlert('Schichtplan erfolgreich gespeichert');

    if (renderWeekCallback !== null) {
      await renderWeekCallback();
    }
    if (applyLockStateCallback !== null) {
      applyLockStateCallback();
    }
  } catch (error) {
    console.error('[SHIFTS] Failed to save schedule:', error);
    showErrorAlert('Fehler beim Speichern des Schichtplans');
  }
}

// ============== RESET HANDLER ==============

/**
 * Handle reset schedule
 */
export async function handleResetSchedule(): Promise<void> {
  const confirmed = await showConfirm('Änderungen verwerfen?');
  if (!confirmed) return;

  clearShiftData();
  setIsEditMode(false);

  if (renderWeekCallback !== null) {
    await renderWeekCallback();
  }

  showInfo('Änderungen wurden verworfen');
}

// ============== DISCARD HANDLERS ==============

/**
 * Handle discarding the current week's shifts
 * Deletes all rotation history entries for the displayed week
 */
export async function handleDiscardWeek(): Promise<void> {
  const context = getSelectedContext();
  if (context.teamId === null) {
    showErrorAlert('Bitte wählen Sie zuerst ein Team aus');
    return;
  }

  const currentWeek = getCurrentWeek();
  const weekDates = getWeekDates(currentWeek);
  const startDate = weekDates[0];
  const endDate = weekDates[6];

  if (startDate === undefined || endDate === undefined) {
    showErrorAlert('Fehler beim Ermitteln der Wochendaten');
    return;
  }

  const startDateStr = formatDateForApi(startDate);
  const endDateStr = formatDateForApi(endDate);

  const confirmed = await showConfirmDanger(
    `Möchten Sie wirklich ALLE Schichten für diese Woche (${startDateStr} bis ${endDateStr}) löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden!`,
    'Woche verwerfen',
  );

  if (!confirmed) return;

  try {
    const result = await deleteRotationHistoryByWeek(context.teamId, startDateStr, endDateStr);
    showSuccessAlert(`${result.historyDeleted} Schichteinträge gelöscht`);

    // Refresh the view
    if (renderWeekCallback !== null) {
      await renderWeekCallback();
    }
  } catch (error) {
    console.error('[SHIFTS] Error discarding week:', error);
    showErrorAlert(error instanceof Error ? error.message : 'Fehler beim Löschen der Wochendaten');
  }
}

/**
 * Handle discarding the entire team's shift plan
 * Deletes ALL rotation data (history, assignments, patterns) for the team
 */
export async function handleDiscardTeamPlan(): Promise<void> {
  const context = getSelectedContext();
  if (context.teamId === null) {
    showErrorAlert('Bitte wählen Sie zuerst ein Team aus');
    return;
  }

  const confirmed = await showConfirmDanger(
    `ACHTUNG: Diese Aktion löscht den KOMPLETTEN Schichtplan für das Team!\n\n` +
      `Folgende Daten werden unwiderruflich gelöscht:\n` +
      `• Alle generierten Schichten\n` +
      `• Alle Mitarbeiter-Zuweisungen\n` +
      `• Alle Rotationsmuster\n\n` +
      `Sind Sie ABSOLUT sicher?`,
    'Team-Plan vollständig verwerfen',
  );

  if (!confirmed) return;

  try {
    const result = await deleteRotationHistoryByTeam(context.teamId);
    showSuccessAlert(
      `Team-Plan gelöscht: ${result.historyDeleted} Schichten, ${result.assignmentsDeleted} Zuweisungen, ${result.patternsDeleted} Muster`,
    );

    // Reset toggles since there's no more data
    const standardToggle = $$id(DOM_IDS.SHIFT_ROTATION) as HTMLInputElement | null;
    const customToggle = $$id('shift-custom-rotation') as HTMLInputElement | null;
    if (standardToggle !== null) standardToggle.checked = false;
    if (customToggle !== null) customToggle.checked = false;

    // Refresh the view
    if (renderWeekCallback !== null) {
      await renderWeekCallback();
    }
  } catch (error) {
    console.error('[SHIFTS] Error discarding team plan:', error);
    showErrorAlert(error instanceof Error ? error.message : 'Fehler beim Löschen des Team-Plans');
  }
}
