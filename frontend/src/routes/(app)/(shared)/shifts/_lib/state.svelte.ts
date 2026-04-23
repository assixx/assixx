// =============================================================================
// SHIFTS - REACTIVE STATE (Svelte 5 Runes)
// Main entry point - composes all state modules
// =============================================================================

import { contextState } from './state-context.svelte';
import { dataState } from './state-data.svelte';
import { dropdownState } from './state-dropdowns.svelte';
import { rotationState } from './state-rotation.svelte';
import { shiftDataState } from './state-shifts.svelte';
import { uiState } from './state-ui.svelte';
import { userState } from './state-user.svelte';

import type { Employee } from './types';

/**
 * Derived state that depends on multiple modules
 */
function createDerivedState() {
  const isAdmin = $derived(
    userState.effectiveRole === 'admin' || userState.effectiveRole === 'root',
  );

  const isEmployee = $derived(userState.effectiveRole === 'employee');

  /** Scope-based: user has management responsibility for at least one team */
  const isManager = $derived(userState.orgScope.type !== 'none');

  /** Scope-based: user can edit the currently selected team's shifts */
  const canEditShifts = $derived.by(() => {
    const scope = userState.orgScope;
    if (scope.type === 'full') return true;
    if (scope.type === 'limited') {
      const teamId = contextState.selectedContext.teamId;
      return teamId !== null && scope.teamIds.includes(teamId);
    }
    return false;
  });

  return {
    get isAdmin() {
      return isAdmin;
    },
    get isEmployee() {
      return isEmployee;
    },
    get isManager() {
      return isManager;
    },
    get canEditShifts() {
      return canEditShifts;
    },
  };
}

const derivedState = createDerivedState();

/**
 * Clear all shift-related data (when changing context)
 */
function clearShiftData() {
  shiftDataState.clearShiftData();
  contextState.clearPlanData();
  rotationState.clearRotationData();
}

/**
 * Reset all state to initial values
 */
function reset() {
  userState.reset();
  dataState.reset();
  shiftDataState.reset();
  uiState.reset();
  contextState.reset();
  rotationState.reset();
  dropdownState.reset();
}

/**
 * Unified shifts state - re-exports all modules
 */
export const shiftsState = {
  // User state
  get currentUser() {
    return userState.currentUser;
  },
  get effectiveRole() {
    return userState.effectiveRole;
  },
  get currentUserId() {
    return userState.currentUserId;
  },
  get hasFullAccess() {
    return userState.hasFullAccess;
  },
  get orgScope() {
    return userState.orgScope;
  },
  setUser: userState.setUser,
  updateEffectiveRole: userState.updateEffectiveRole,
  setHasFullAccess: userState.setHasFullAccess,
  setOrgScope: userState.setOrgScope,

  // Data state
  get areas() {
    return dataState.areas;
  },
  get departments() {
    return dataState.departments;
  },
  get assets() {
    return dataState.assets;
  },
  get teams() {
    return dataState.teams;
  },
  get teamLeaders() {
    return dataState.teamLeaders;
  },
  get employees() {
    return dataState.employees;
  },
  get teamMembers() {
    return dataState.teamMembers;
  },
  get selectedEmployee() {
    return dataState.selectedEmployee;
  },
  get employeeTeamInfo() {
    return dataState.employeeTeamInfo;
  },
  get favorites() {
    return dataState.favorites;
  },
  setAreas: dataState.setAreas,
  setDepartments: dataState.setDepartments,
  setAssets: dataState.setAssets,
  setTeams: dataState.setTeams,
  setTeamLeaders: dataState.setTeamLeaders,
  setEmployees: dataState.setEmployees,
  setTeamMembers: dataState.setTeamMembers,
  setSelectedEmployee: dataState.setSelectedEmployee,
  setEmployeeTeamInfo: dataState.setEmployeeTeamInfo,
  setFavorites: dataState.setFavorites,
  getEmployeeById: dataState.getEmployeeById,
  getMemberNameById: dataState.getMemberNameById,
  getAreaById: dataState.getAreaById,
  getDepartmentById: dataState.getDepartmentById,
  getAssetById: dataState.getAssetById,
  getTeamById: dataState.getTeamById,

  // Shift data state
  get weeklyShifts() {
    return shiftDataState.weeklyShifts;
  },
  get shiftDetails() {
    return shiftDataState.shiftDetails;
  },
  get currentShiftNotes() {
    return shiftDataState.currentShiftNotes;
  },
  get weeklyNotes() {
    return shiftDataState.weeklyNotes;
  },
  get hasShiftData() {
    return shiftDataState.hasShiftData;
  },
  // WHY: Dirty-Flag für "Ungespeicherte Änderungen"-Guard. Basiert auf
  // strukturellem Compare zu originalWeeklyShifts (siehe handlers.hasUnsavedChanges).
  get isDirty() {
    return shiftDataState.isDirty;
  },
  setWeeklyShifts: shiftDataState.setWeeklyShifts,
  setShiftDetails: shiftDataState.setShiftDetails,
  setCurrentShiftNotes: shiftDataState.setCurrentShiftNotes,
  setWeeklyNotes: shiftDataState.setWeeklyNotes,
  getShiftEmployees: shiftDataState.getShiftEmployees,
  addShiftAssignment: shiftDataState.addShiftAssignment,
  removeShiftAssignment: shiftDataState.removeShiftAssignment,
  addShiftDetail(date: string, shiftType: string, employeeId: number, employee: Employee) {
    shiftDataState.addShiftDetail(date, shiftType, employeeId, employee);
  },
  captureSnapshot: shiftDataState.captureSnapshot,
  clearSnapshot: shiftDataState.clearSnapshot,

  // UI state
  get isLoading() {
    return uiState.isLoading;
  },
  get isDragging() {
    return uiState.isDragging;
  },
  get isEditMode() {
    return uiState.isEditMode;
  },
  get isPlanLocked() {
    return uiState.isPlanLocked;
  },
  get showPlanningUI() {
    return uiState.showPlanningUI;
  },
  get currentWeek() {
    return uiState.currentWeek;
  },
  setIsLoading: uiState.setIsLoading,
  setIsDragging: uiState.setIsDragging,
  setIsEditMode: uiState.setIsEditMode,
  setIsPlanLocked: uiState.setIsPlanLocked,
  setShowPlanningUI: uiState.setShowPlanningUI,
  setCurrentWeek: uiState.setCurrentWeek,

  // Context state
  get selectedContext() {
    return contextState.selectedContext;
  },
  get currentPlanId() {
    return contextState.currentPlanId;
  },
  get currentPatternId() {
    return contextState.currentPatternId;
  },
  get currentPatternType() {
    return contextState.currentPatternType;
  },
  get isContextComplete() {
    return contextState.isContextComplete;
  },
  get assetAvailabilityMap() {
    return contextState.assetAvailabilityMap;
  },
  setSelectedContext: contextState.setSelectedContext,
  resetSelectedContext: contextState.resetSelectedContext,
  setCurrentPlanId: contextState.setCurrentPlanId,
  setCurrentPatternId: contextState.setCurrentPatternId,
  setCurrentPatternType: contextState.setCurrentPatternType,
  isHierarchyValid: contextState.isHierarchyValid,
  setAssetAvailability: contextState.setAssetAvailability,
  clearAssetAvailability: contextState.clearAssetAvailability,
  // Rotation state
  get autofillConfig() {
    return rotationState.autofillConfig;
  },
  get rotationConfig() {
    return rotationState.rotationConfig;
  },
  get standardRotationEnabled() {
    return rotationState.standardRotationEnabled;
  },
  get customRotationEnabled() {
    return rotationState.customRotationEnabled;
  },
  get showRotationSetupModal() {
    return rotationState.showRotationSetupModal;
  },
  get showCustomRotationModal() {
    return rotationState.showCustomRotationModal;
  },
  get rotationHistoryMap() {
    return rotationState.rotationHistoryMap;
  },
  get pendingRotationDeletions() {
    return rotationState.pendingRotationDeletions;
  },
  setAutofillConfig: rotationState.setAutofillConfig,
  setRotationConfig: rotationState.setRotationConfig,
  setStandardRotationEnabled: rotationState.setStandardRotationEnabled,
  setCustomRotationEnabled: rotationState.setCustomRotationEnabled,
  setStandardRotationEnabledDirect: rotationState.setStandardRotationEnabledDirect,
  setCustomRotationEnabledDirect: rotationState.setCustomRotationEnabledDirect,
  setShowRotationSetupModal: rotationState.setShowRotationSetupModal,
  setShowCustomRotationModal: rotationState.setShowCustomRotationModal,
  setRotationHistoryMap: rotationState.setRotationHistoryMap,
  addPendingRotationDeletion: rotationState.addPendingRotationDeletion,
  clearPendingRotationDeletions: rotationState.clearPendingRotationDeletions,

  // Dropdown state
  get areaDropdownOpen() {
    return dropdownState.areaDropdownOpen;
  },
  get departmentDropdownOpen() {
    return dropdownState.departmentDropdownOpen;
  },
  get assetDropdownOpen() {
    return dropdownState.assetDropdownOpen;
  },
  get teamDropdownOpen() {
    return dropdownState.teamDropdownOpen;
  },
  toggleAreaDropdown: dropdownState.toggleAreaDropdown,
  toggleDepartmentDropdown: dropdownState.toggleDepartmentDropdown,
  toggleAssetDropdown: dropdownState.toggleAssetDropdown,
  toggleTeamDropdown: dropdownState.toggleTeamDropdown,
  closeAllDropdowns: dropdownState.closeAllDropdowns,

  // Derived state (cross-module)
  get isAdmin() {
    return derivedState.isAdmin;
  },
  get isEmployee() {
    return derivedState.isEmployee;
  },
  get isManager() {
    return derivedState.isManager;
  },
  get canEditShifts() {
    return derivedState.canEditShifts;
  },

  // Global operations
  clearShiftData,
  reset,
};

// ──────────────────────────────────────────────────────────────────────────
// Shift-handover passthrough (Plan §5.1) — re-exported from the main state
// barrel so consumer pages (e.g. `+page.svelte`) don't add another module
// to their import graph. Implementation lives in `./state-handover.svelte.ts`
// to keep this file focused on pure shift-planning state.
// ──────────────────────────────────────────────────────────────────────────
export { createHandoverState } from './state-handover.svelte';
export type { HandoverContext } from './shift-handover-types';
