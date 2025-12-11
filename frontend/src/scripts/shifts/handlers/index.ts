/**
 * Handler Exports for Shift Planning System
 * Re-exports all handlers from sub-modules
 *
 * @module shifts/handlers
 */

export {
  handleDropdownChange,
  setRenderWeekCallback as setDropdownRenderWeekCallback,
  setSaveContextCallback,
} from './dropdown';

export { handleShiftDrop, handleRemoveShiftAction, validateShiftAssignmentDrop } from './shift-actions';

export {
  handleSaveSchedule,
  handleResetSchedule,
  handleDiscardWeek,
  handleDiscardTeamPlan,
  setRenderWeekCallback as setSaveDiscardRenderWeekCallback,
  setApplyLockStateCallback as setSaveDiscardApplyLockStateCallback,
} from './save-discard';

export { loadFavoriteWithDropdowns, setFavoritesSaveContextCallback } from './favorites';
