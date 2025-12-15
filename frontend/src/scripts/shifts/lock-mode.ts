/**
 * Lock Mode Management for Shift Planning System
 * Handles edit mode, lock state, and rotation toggle synchronization
 *
 * @module shifts/lock-mode
 */

import { showInfo } from '../auth/index';
import { $$id } from '../../utils/dom-utils';
import {
  getCurrentPlanId,
  getCurrentPatternType,
  getWeeklyShifts,
  isAdmin as getIsAdmin,
  isEditMode as getIsEditMode,
  setIsEditMode,
  setIsPlanLocked,
} from './state';
import { lockShiftPlan, unlockShiftPlan, updateButtonVisibility } from './ui';
import { DOM_IDS } from './constants';

// ============== TYPES ==============

/** Callback for saving schedule */
export type SaveScheduleCallback = () => Promise<void>;

// Store callback reference (set by index.ts)
let saveScheduleCallback: SaveScheduleCallback | null = null;

/**
 * Register the save schedule callback
 * Called from index.ts to avoid circular imports
 */
export function setSaveScheduleCallback(callback: SaveScheduleCallback): void {
  saveScheduleCallback = callback;
}

// ============== EDIT MODE ==============

/**
 * Toggle edit mode for existing plans
 * When enabled: unlocks UI, allows drag & drop, shows update button
 * When disabled: locks UI, prevents changes, shows edit button
 */
export function toggleEditMode(enable: boolean): void {
  setIsEditMode(enable);
  setIsPlanLocked(!enable);

  if (enable) {
    unlockShiftPlan();
    showInfo('Bearbeitungsmodus aktiviert');
  } else {
    lockShiftPlan();
    showInfo('Bearbeitungsmodus beendet');
  }

  applyButtonVisibility();
}

// ============== ROTATION TOGGLE SYNC ==============

/**
 * Synchronize rotation toggles based on current pattern type and lock state
 * - Sets the correct toggle checked based on pattern type AND hasShiftData
 * - Toggle should only be ON if pattern type matches AND data exists for current week
 * - Disables toggles when locked, enables when in edit mode
 */
export function syncRotationToggles(isLocked: boolean): void {
  const patternType = getCurrentPatternType();
  const weeklyShifts = getWeeklyShifts();
  const hasShiftData = weeklyShifts.size > 0;
  const standardToggle = $$id(DOM_IDS.SHIFT_ROTATION) as HTMLInputElement | null;
  const customToggle = $$id('shift-custom-rotation') as HTMLInputElement | null;

  console.info('[TOGGLE SYNC] patternType:', patternType, 'isLocked:', isLocked, 'hasShiftData:', hasShiftData);

  // Set toggle checked state based on pattern type AND hasShiftData
  // Toggle should only be ON if pattern matches AND data exists for this week
  if (standardToggle !== null) {
    // Standard = alternate_fs or fixed_n, but only if data exists
    const isStandard = hasShiftData && (patternType === 'alternate_fs' || patternType === 'fixed_n');
    standardToggle.checked = isStandard;
    standardToggle.disabled = isLocked;
    console.info('[TOGGLE SYNC] Standard toggle:', isStandard ? 'ON' : 'OFF', 'disabled:', isLocked);
  }

  if (customToggle !== null) {
    // Custom = custom pattern type, but only if data exists
    const isCustom = hasShiftData && patternType === 'custom';
    customToggle.checked = isCustom;
    customToggle.disabled = isLocked;
    console.info('[TOGGLE SYNC] Custom toggle:', isCustom ? 'ON' : 'OFF', 'disabled:', isLocked);
  }
}

// ============== LOCK STATE ==============

/**
 * Apply lock state and button visibility based on current plan state
 * Called after loading plan data or changing edit mode
 *
 * Lock is triggered when:
 * - A shift plan exists (currentPlanId !== null) OR
 * - Rotation history has data (weeklyShifts.size > 0)
 */
export function applyPlanLockState(): void {
  const currentPlanId = getCurrentPlanId();
  const isEditMode = getIsEditMode();
  const weeklyShifts = getWeeklyShifts();

  // Check if we have ANY shift data (from plan OR rotation history)
  const hasShiftData = currentPlanId !== null || weeklyShifts.size > 0;

  console.info(
    '[LOCK STATE] planId:',
    currentPlanId,
    'editMode:',
    isEditMode,
    'shiftsSize:',
    weeklyShifts.size,
    'hasData:',
    hasShiftData,
  );

  // Determine if plan should be locked
  const shouldLock = hasShiftData && !isEditMode;

  // Lock if we have shift data and not in edit mode
  if (shouldLock) {
    setIsPlanLocked(true);
    lockShiftPlan();
    console.info('[LOCK STATE] → LOCKING');
  } else {
    setIsPlanLocked(false);
    // Always unlock when not locking (edit mode OR no data)
    unlockShiftPlan();
    console.info('[LOCK STATE] → UNLOCKING');
  }

  // Sync rotation toggles (disabled when locked, checked based on pattern type)
  syncRotationToggles(shouldLock);

  // Update button visibility
  applyButtonVisibility();
}

/**
 * Apply button visibility based on current state
 * Wraps the ui.ts updateButtonVisibility with callbacks
 *
 * Shows "Bearbeiten" button when shift data exists (from plan OR rotation)
 */
export function applyButtonVisibility(): void {
  const isAdmin = getIsAdmin();
  const currentPlanId = getCurrentPlanId();
  const isEditMode = getIsEditMode();
  const weeklyShifts = getWeeklyShifts();

  // Only update if admin
  if (!isAdmin) return;

  // Check if we have ANY shift data (from plan OR rotation history)
  const hasShiftData = currentPlanId !== null || weeklyShifts.size > 0;

  updateButtonVisibility(
    isAdmin,
    hasShiftData,
    isEditMode,
    // onEditClick callback
    () => {
      toggleEditMode(true);
    },
    // onUpdateClick callback
    () => {
      if (saveScheduleCallback !== null) {
        void saveScheduleCallback();
      }
    },
  );
}
