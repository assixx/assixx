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

  const canEditShifts = $derived.by(() => {
    if (userState.effectiveRole === 'root') return true;
    if (userState.effectiveRole === 'admin' && userState.hasFullAccess)
      return true;
    const ctx = contextState.selectedContext;
    if (
      ctx.teamLeaderId !== null &&
      userState.currentUserId !== null &&
      ctx.teamLeaderId === userState.currentUserId
    ) {
      return true;
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
  setUser: userState.setUser,
  updateEffectiveRole: userState.updateEffectiveRole,
  setHasFullAccess: userState.setHasFullAccess,

  // Data state
  get areas() {
    return dataState.areas;
  },
  get departments() {
    return dataState.departments;
  },
  get machines() {
    return dataState.machines;
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
  setMachines: dataState.setMachines,
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
  getMachineById: dataState.getMachineById,
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
  setWeeklyShifts: shiftDataState.setWeeklyShifts,
  setShiftDetails: shiftDataState.setShiftDetails,
  setCurrentShiftNotes: shiftDataState.setCurrentShiftNotes,
  setWeeklyNotes: shiftDataState.setWeeklyNotes,
  getShiftEmployees: shiftDataState.getShiftEmployees,
  addShiftAssignment: shiftDataState.addShiftAssignment,
  removeShiftAssignment: shiftDataState.removeShiftAssignment,
  addShiftDetail(
    date: string,
    shiftType: string,
    employeeId: number,
    employee: Employee,
  ) {
    shiftDataState.addShiftDetail(date, shiftType, employeeId, employee);
  },

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
  setSelectedContext: contextState.setSelectedContext,
  resetSelectedContext: contextState.resetSelectedContext,
  setCurrentPlanId: contextState.setCurrentPlanId,
  setCurrentPatternId: contextState.setCurrentPatternId,
  setCurrentPatternType: contextState.setCurrentPatternType,
  isHierarchyValid: contextState.isHierarchyValid,

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
  setStandardRotationEnabledDirect:
    rotationState.setStandardRotationEnabledDirect,
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
  get machineDropdownOpen() {
    return dropdownState.machineDropdownOpen;
  },
  get teamDropdownOpen() {
    return dropdownState.teamDropdownOpen;
  },
  toggleAreaDropdown: dropdownState.toggleAreaDropdown,
  toggleDepartmentDropdown: dropdownState.toggleDepartmentDropdown,
  toggleMachineDropdown: dropdownState.toggleMachineDropdown,
  toggleTeamDropdown: dropdownState.toggleTeamDropdown,
  closeAllDropdowns: dropdownState.closeAllDropdowns,

  // Derived state (cross-module)
  get isAdmin() {
    return derivedState.isAdmin;
  },
  get isEmployee() {
    return derivedState.isEmployee;
  },
  get canEditShifts() {
    return derivedState.canEditShifts;
  },

  // Global operations
  clearShiftData,
  reset,
};
