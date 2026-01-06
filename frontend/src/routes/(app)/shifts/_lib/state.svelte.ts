// =============================================================================
// SHIFTS - REACTIVE STATE (Svelte 5 Runes)
// Based on: frontend/src/scripts/shifts/state.ts
// =============================================================================

import { SvelteMap } from 'svelte/reactivity';
import type {
  User,
  Employee,
  Area,
  Department,
  Machine,
  Team,
  TeamMember,
  TeamLeader,
  SelectedContext,
  ShiftFavorite,
  ShiftAutofillConfig,
  ShiftRotationConfig,
  ShiftDetailData,
  WeeklyShiftsMap,
  EmployeeTeamInfo,
  RotationPatternType,
} from './types';

/**
 * Shifts State using Svelte 5 Runes
 */
function createShiftsState() {
  // ==========================================================================
  // USER STATE
  // ==========================================================================
  let currentUser = $state<User | null>(null);
  let effectiveRole = $state<string>('employee');
  let currentUserId = $state<number | null>(null);
  let hasFullAccess = $state(false);

  // ==========================================================================
  // WEEK NAVIGATION
  // ==========================================================================
  let currentWeek = $state<Date>(new Date());

  // ==========================================================================
  // HIERARCHY DATA
  // ==========================================================================
  let areas = $state<Area[]>([]);
  let departments = $state<Department[]>([]);
  let machines = $state<Machine[]>([]);
  let teams = $state<Team[]>([]);
  let teamLeaders = $state<TeamLeader[]>([]);

  // ==========================================================================
  // EMPLOYEES
  // ==========================================================================
  let employees = $state<Employee[]>([]);
  let teamMembers = $state<TeamMember[]>([]);
  let selectedEmployee = $state<Employee | null>(null);

  // ==========================================================================
  // SHIFT DATA
  // ==========================================================================
  let weeklyShifts = $state<WeeklyShiftsMap>(new Map());
  let shiftDetails = $state<Map<string, ShiftDetailData>>(new Map());
  let currentShiftNotes = $state('');

  // ==========================================================================
  // SELECTED CONTEXT (hierarchy selection)
  // ==========================================================================
  let selectedContext = $state<SelectedContext>({
    areaId: null,
    departmentId: null,
    machineId: null,
    teamId: null,
    teamLeaderId: null,
  });

  // ==========================================================================
  // PLAN MANAGEMENT
  // ==========================================================================
  let currentPlanId = $state<number | null>(null);
  let currentPatternId = $state<number | null>(null);
  let currentPatternType = $state<RotationPatternType | null>(null);

  // ==========================================================================
  // UI STATE
  // ==========================================================================
  // PERFORMANCE: Start with true to prevent FOUC - initial render shows loading
  // Then API completes → isLoading = false → single transition to full UI
  let isLoading = $state(true);
  let isDragging = $state(false);
  let isEditMode = $state(false);
  let isPlanLocked = $state(false);
  let showPlanningUI = $state(false);

  // ==========================================================================
  // FAVORITES
  // ==========================================================================
  let favorites = $state<ShiftFavorite[]>([]);

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  let autofillConfig = $state<ShiftAutofillConfig>({
    enabled: false,
    fillWeekdays: true,
    skipWeekends: true,
    respectAvailability: true,
  });

  let rotationConfig = $state<ShiftRotationConfig>({
    enabled: false,
    pattern: 'F_S_alternate',
    nightFixed: true,
    autoGenerateWeeks: 4,
  });

  // ==========================================================================
  // EMPLOYEE VIEW (for non-admin employees)
  // ==========================================================================
  let employeeTeamInfo = $state<EmployeeTeamInfo | null>(null);

  // ==========================================================================
  // ROTATION HISTORY TRACKING
  // ==========================================================================
  let rotationHistoryMap = $state<Map<string, number>>(new Map());
  let pendingRotationDeletions = $state<Set<number>>(new Set());

  // ==========================================================================
  // ROTATION MODE STATE (Standard vs Custom)
  // ==========================================================================
  let standardRotationEnabled = $state(false);
  let customRotationEnabled = $state(false);

  // ==========================================================================
  // MODAL STATE
  // ==========================================================================
  let showRotationSetupModal = $state(false);
  let showCustomRotationModal = $state(false);

  // ==========================================================================
  // DROPDOWN STATE (Custom Dropdown open/close)
  // ==========================================================================
  let areaDropdownOpen = $state(false);
  let departmentDropdownOpen = $state(false);
  let machineDropdownOpen = $state(false);
  let teamDropdownOpen = $state(false);

  // ==========================================================================
  // WEEKLY NOTES (Info/Todo Section)
  // ==========================================================================
  let weeklyNotes = $state('');

  // ==========================================================================
  // DERIVED STATE
  // ==========================================================================

  // Is admin or root
  const isAdmin = $derived(effectiveRole === 'admin' || effectiveRole === 'root');

  // Is employee (read-only view)
  const isEmployee = $derived(effectiveRole === 'employee');

  // Can edit shifts (permission check)
  const canEditShifts = $derived.by(() => {
    // Root can always edit
    if (effectiveRole === 'root') return true;

    // Admin with full access can edit all
    if (effectiveRole === 'admin' && hasFullAccess) return true;

    // Team lead of the selected team can edit
    if (
      selectedContext.teamLeaderId !== null &&
      currentUserId !== null &&
      selectedContext.teamLeaderId === currentUserId
    ) {
      return true;
    }

    return false;
  });

  // Is context complete for shift planning
  const isContextComplete = $derived(
    selectedContext.teamId !== null && selectedContext.teamId !== 0,
  );

  // Has any shift data
  const hasShiftData = $derived(weeklyShifts.size > 0);

  // ==========================================================================
  // METHODS
  // ==========================================================================

  function setUser(user: User | null) {
    currentUser = user;
    if (user !== null) {
      currentUserId = user.id;
      setHasFullAccess(user.hasFullAccess === true || user.hasFullAccess === 1);
    }
    updateEffectiveRole();
  }

  function updateEffectiveRole() {
    if (currentUser === null) {
      effectiveRole = 'employee';
      return;
    }

    // Check sessionStorage for role switch
    if (typeof sessionStorage !== 'undefined') {
      const roleSwitch = sessionStorage.getItem('roleSwitch');
      if (
        (currentUser.role === 'admin' || currentUser.role === 'root') &&
        roleSwitch === 'employee'
      ) {
        effectiveRole = 'employee';
        return;
      }
    }

    // Check localStorage for activeRole
    if (typeof localStorage !== 'undefined') {
      const activeRole = localStorage.getItem('activeRole');
      if (activeRole !== null && activeRole !== '' && activeRole !== currentUser.role) {
        effectiveRole = activeRole;
        return;
      }
    }

    effectiveRole = currentUser.role;
  }

  function setCurrentWeek(week: Date) {
    currentWeek = week;
  }

  function setAreas(data: Area[]) {
    areas = data;
  }

  function setDepartments(data: Department[]) {
    departments = data;
  }

  function setMachines(data: Machine[]) {
    machines = data;
  }

  function setTeams(data: Team[]) {
    teams = data;
  }

  function setTeamLeaders(data: TeamLeader[]) {
    teamLeaders = data;
  }

  function setEmployees(data: Employee[]) {
    employees = data;
  }

  function setTeamMembers(data: TeamMember[]) {
    teamMembers = data;
  }

  function setSelectedEmployee(employee: Employee | null) {
    selectedEmployee = employee;
  }

  function setSelectedContext(context: Partial<SelectedContext>) {
    selectedContext = { ...selectedContext, ...context };
  }

  function resetSelectedContext() {
    selectedContext = {
      areaId: null,
      departmentId: null,
      machineId: null,
      teamId: null,
      teamLeaderId: null,
    };
  }

  function setWeeklyShifts(shifts: WeeklyShiftsMap) {
    weeklyShifts = shifts;
  }

  function setShiftDetails(details: Map<string, ShiftDetailData>) {
    shiftDetails = details;
  }

  function setCurrentShiftNotes(notes: string) {
    currentShiftNotes = notes;
  }

  function setCurrentPlanId(planId: number | null) {
    currentPlanId = planId;
  }

  function setCurrentPatternId(patternId: number | null) {
    currentPatternId = patternId;
  }

  function setCurrentPatternType(patternType: RotationPatternType | null) {
    currentPatternType = patternType;
  }

  function setIsLoading(loading: boolean) {
    isLoading = loading;
  }

  function setIsDragging(dragging: boolean) {
    isDragging = dragging;
  }

  function setIsEditMode(editMode: boolean) {
    isEditMode = editMode;
  }

  function setIsPlanLocked(locked: boolean) {
    isPlanLocked = locked;
  }

  function setShowPlanningUI(show: boolean) {
    showPlanningUI = show;
  }

  function setFavorites(data: ShiftFavorite[]) {
    favorites = data;
  }

  function setAutofillConfig(config: Partial<ShiftAutofillConfig>) {
    autofillConfig = { ...autofillConfig, ...config };
  }

  function setRotationConfig(config: Partial<ShiftRotationConfig>) {
    rotationConfig = { ...rotationConfig, ...config };
  }

  function setEmployeeTeamInfo(info: EmployeeTeamInfo | null) {
    employeeTeamInfo = info;
  }

  function setHasFullAccess(access: boolean) {
    hasFullAccess = access;
  }

  function setStandardRotationEnabled(enabled: boolean) {
    standardRotationEnabled = enabled;
    // Disable custom rotation when standard is enabled
    if (enabled) {
      customRotationEnabled = false;
      // Auto-open modal when enabling (wie Legacy: rotation.ts showRotationSetupModal)
      showRotationSetupModal = true;
    }
  }

  function setCustomRotationEnabled(enabled: boolean) {
    customRotationEnabled = enabled;
    // Disable standard rotation when custom is enabled
    if (enabled) {
      standardRotationEnabled = false;
      // Auto-open modal when enabling (wie Legacy: showPatternSelectionModal() in handleCheckboxToggle)
      showCustomRotationModal = true;
    }
  }

  /**
   * Set standard rotation enabled WITHOUT opening modal
   * Used by syncRotationToggles() when loading existing pattern from DB
   */
  function setStandardRotationEnabledDirect(enabled: boolean) {
    standardRotationEnabled = enabled;
    if (enabled) {
      customRotationEnabled = false;
    }
  }

  /**
   * Set custom rotation enabled WITHOUT opening modal
   * Used by syncRotationToggles() when loading existing pattern from DB
   */
  function setCustomRotationEnabledDirect(enabled: boolean) {
    customRotationEnabled = enabled;
    if (enabled) {
      standardRotationEnabled = false;
    }
  }

  function setShowRotationSetupModal(show: boolean) {
    showRotationSetupModal = show;
  }

  function setShowCustomRotationModal(show: boolean) {
    showCustomRotationModal = show;
  }

  function setWeeklyNotes(notes: string) {
    weeklyNotes = notes;
  }

  function toggleAreaDropdown() {
    // Close other dropdowns first
    departmentDropdownOpen = false;
    machineDropdownOpen = false;
    teamDropdownOpen = false;
    areaDropdownOpen = !areaDropdownOpen;
  }

  function toggleDepartmentDropdown() {
    areaDropdownOpen = false;
    machineDropdownOpen = false;
    teamDropdownOpen = false;
    departmentDropdownOpen = !departmentDropdownOpen;
  }

  function toggleMachineDropdown() {
    areaDropdownOpen = false;
    departmentDropdownOpen = false;
    teamDropdownOpen = false;
    machineDropdownOpen = !machineDropdownOpen;
  }

  function toggleTeamDropdown() {
    areaDropdownOpen = false;
    departmentDropdownOpen = false;
    machineDropdownOpen = false;
    teamDropdownOpen = !teamDropdownOpen;
  }

  function closeAllDropdowns() {
    areaDropdownOpen = false;
    departmentDropdownOpen = false;
    machineDropdownOpen = false;
    teamDropdownOpen = false;
  }

  function setRotationHistoryMap(map: Map<string, number>) {
    rotationHistoryMap = map;
  }

  function addPendingRotationDeletion(historyId: number) {
    pendingRotationDeletions = new Set([...pendingRotationDeletions, historyId]);
  }

  function clearPendingRotationDeletions() {
    pendingRotationDeletions = new Set();
  }

  /**
   * Clear all shift data (when changing context)
   */
  function clearShiftData() {
    weeklyShifts = new Map();
    shiftDetails = new Map();
    currentPlanId = null;
    currentShiftNotes = '';
    rotationHistoryMap = new Map();
    pendingRotationDeletions = new Set();
  }

  /**
   * Get employee by ID
   */
  function getEmployeeById(id: number): Employee | undefined {
    return employees.find((emp) => emp.id === id);
  }

  /**
   * Get member name by ID
   */
  function getMemberNameById(userId: number): string {
    const employee = employees.find((emp) => emp.id === userId);
    if (employee !== undefined) {
      const firstName = employee.firstName ?? '';
      const lastName = employee.lastName ?? '';
      if (firstName !== '' || lastName !== '') {
        return `${firstName} ${lastName}`.trim();
      }
      return employee.username !== '' ? employee.username : `User ${userId}`;
    }
    return `User ${userId}`;
  }

  /**
   * Get area by ID
   */
  function getAreaById(id: number): Area | undefined {
    return areas.find((a) => a.id === id);
  }

  /**
   * Get department by ID
   */
  function getDepartmentById(id: number): Department | undefined {
    return departments.find((d) => d.id === id);
  }

  /**
   * Get machine by ID
   */
  function getMachineById(id: number): Machine | undefined {
    return machines.find((m) => m.id === id);
  }

  /**
   * Get team by ID
   */
  function getTeamById(id: number): Team | undefined {
    return teams.find((t) => t.id === id);
  }

  /**
   * Add a shift assignment (DEEP COPY for Svelte reactivity)
   */
  function addShiftAssignment(date: string, shiftType: string, employeeId: number) {
    // Deep copy to ensure reactivity - use SvelteMap for inner maps too
    const newWeeklyShifts = new SvelteMap<string, Map<string, number[]>>();
    for (const [d, oldDayShifts] of weeklyShifts.entries()) {
      const newDayShifts = new SvelteMap<string, number[]>();
      for (const [shift, emps] of oldDayShifts.entries()) {
        newDayShifts.set(shift, [...emps]);
      }
      newWeeklyShifts.set(d, newDayShifts);
    }

    if (!newWeeklyShifts.has(date)) {
      newWeeklyShifts.set(date, new SvelteMap());
    }

    const dayShifts = newWeeklyShifts.get(date);
    if (dayShifts !== undefined) {
      const currentEmployees = dayShifts.get(shiftType) ?? [];
      if (!currentEmployees.includes(employeeId)) {
        dayShifts.set(shiftType, [...currentEmployees, employeeId]);
      }
    }

    weeklyShifts = newWeeklyShifts;
  }

  /**
   * Remove a shift assignment (DEEP COPY for Svelte reactivity)
   */
  function removeShiftAssignment(date: string, shiftType: string, employeeId: number) {
    // Deep copy to ensure reactivity - use SvelteMap for inner maps too
    const newWeeklyShifts = new SvelteMap<string, Map<string, number[]>>();
    for (const [d, oldDayShifts] of weeklyShifts.entries()) {
      const newDayShifts = new SvelteMap<string, number[]>();
      for (const [shift, emps] of oldDayShifts.entries()) {
        newDayShifts.set(shift, [...emps]);
      }
      newWeeklyShifts.set(d, newDayShifts);
    }

    const dayShifts = newWeeklyShifts.get(date);
    if (dayShifts !== undefined) {
      const currentEmployees = dayShifts.get(shiftType) ?? [];
      const updatedEmployees = currentEmployees.filter((id) => id !== employeeId);

      if (updatedEmployees.length > 0) {
        dayShifts.set(shiftType, updatedEmployees);
      } else {
        dayShifts.delete(shiftType);
      }

      // Clean up empty day maps
      if (dayShifts.size === 0) {
        newWeeklyShifts.delete(date);
      }
    }

    weeklyShifts = newWeeklyShifts;

    // Also remove from shiftDetails (deep copy)
    const detailKey = `${date}_${shiftType}_${employeeId}`;
    const newShiftDetails = new SvelteMap<string, ShiftDetailData>();
    for (const [k, v] of shiftDetails.entries()) {
      newShiftDetails.set(k, { ...v });
    }
    newShiftDetails.delete(detailKey);
    shiftDetails = newShiftDetails;
  }

  /**
   * Get employees for a specific shift
   */
  function getShiftEmployees(date: string, shiftType: string): number[] {
    const dayShifts = weeklyShifts.get(date);
    if (dayShifts === undefined) return [];
    return dayShifts.get(shiftType) ?? [];
  }

  /**
   * Add shift detail
   */
  function addShiftDetail(date: string, shiftType: string, employeeId: number, employee: Employee) {
    const detailKey = `${date}_${shiftType}_${employeeId}`;
    const newShiftDetails = new SvelteMap(shiftDetails);
    newShiftDetails.set(detailKey, {
      employeeId,
      firstName: employee.firstName ?? '',
      lastName: employee.lastName ?? '',
      username: employee.username,
      date,
      shiftType,
    });
    shiftDetails = newShiftDetails;
  }

  /**
   * Check if hierarchy is valid
   */
  function isHierarchyValid(): boolean {
    const ctx = selectedContext;
    // Team requires department
    if (ctx.teamId !== null && ctx.teamId !== 0) {
      return ctx.departmentId !== null && ctx.departmentId !== 0;
    }
    return true;
  }

  /**
   * Reset all state
   */
  function reset() {
    currentUser = null;
    effectiveRole = 'employee';
    currentUserId = null;
    hasFullAccess = false;
    currentWeek = new Date();
    areas = [];
    departments = [];
    machines = [];
    teams = [];
    teamLeaders = [];
    employees = [];
    teamMembers = [];
    selectedEmployee = null;
    weeklyShifts = new Map();
    shiftDetails = new Map();
    currentShiftNotes = '';
    selectedContext = {
      areaId: null,
      departmentId: null,
      machineId: null,
      teamId: null,
      teamLeaderId: null,
    };
    currentPlanId = null;
    currentPatternId = null;
    currentPatternType = null;
    isLoading = false;
    isDragging = false;
    isEditMode = false;
    isPlanLocked = false;
    showPlanningUI = false;
    favorites = [];
    autofillConfig = {
      enabled: false,
      fillWeekdays: true,
      skipWeekends: true,
      respectAvailability: true,
    };
    rotationConfig = {
      enabled: false,
      pattern: 'F_S_alternate',
      nightFixed: true,
      autoGenerateWeeks: 4,
    };
    employeeTeamInfo = null;
    rotationHistoryMap = new Map();
    pendingRotationDeletions = new Set();
  }

  return {
    // Getters (reactive)
    get currentUser() {
      return currentUser;
    },
    get effectiveRole() {
      return effectiveRole;
    },
    get currentUserId() {
      return currentUserId;
    },
    get hasFullAccess() {
      return hasFullAccess;
    },
    get currentWeek() {
      return currentWeek;
    },
    get areas() {
      return areas;
    },
    get departments() {
      return departments;
    },
    get machines() {
      return machines;
    },
    get teams() {
      return teams;
    },
    get teamLeaders() {
      return teamLeaders;
    },
    get employees() {
      return employees;
    },
    get teamMembers() {
      return teamMembers;
    },
    get selectedEmployee() {
      return selectedEmployee;
    },
    get weeklyShifts() {
      return weeklyShifts;
    },
    get shiftDetails() {
      return shiftDetails;
    },
    get currentShiftNotes() {
      return currentShiftNotes;
    },
    get selectedContext() {
      return selectedContext;
    },
    get currentPlanId() {
      return currentPlanId;
    },
    get currentPatternId() {
      return currentPatternId;
    },
    get currentPatternType() {
      return currentPatternType;
    },
    get isLoading() {
      return isLoading;
    },
    get isDragging() {
      return isDragging;
    },
    get isEditMode() {
      return isEditMode;
    },
    get isPlanLocked() {
      return isPlanLocked;
    },
    get showPlanningUI() {
      return showPlanningUI;
    },
    get favorites() {
      return favorites;
    },
    get autofillConfig() {
      return autofillConfig;
    },
    get rotationConfig() {
      return rotationConfig;
    },
    get employeeTeamInfo() {
      return employeeTeamInfo;
    },
    get rotationHistoryMap() {
      return rotationHistoryMap;
    },
    get pendingRotationDeletions() {
      return pendingRotationDeletions;
    },
    get standardRotationEnabled() {
      return standardRotationEnabled;
    },
    get customRotationEnabled() {
      return customRotationEnabled;
    },
    get showRotationSetupModal() {
      return showRotationSetupModal;
    },
    get showCustomRotationModal() {
      return showCustomRotationModal;
    },
    get weeklyNotes() {
      return weeklyNotes;
    },
    get areaDropdownOpen() {
      return areaDropdownOpen;
    },
    get departmentDropdownOpen() {
      return departmentDropdownOpen;
    },
    get machineDropdownOpen() {
      return machineDropdownOpen;
    },
    get teamDropdownOpen() {
      return teamDropdownOpen;
    },

    // Derived (reactive)
    get isAdmin() {
      return isAdmin;
    },
    get isEmployee() {
      return isEmployee;
    },
    get canEditShifts() {
      return canEditShifts;
    },
    get isContextComplete() {
      return isContextComplete;
    },
    get hasShiftData() {
      return hasShiftData;
    },

    // Methods
    setUser,
    updateEffectiveRole,
    setCurrentWeek,
    setAreas,
    setDepartments,
    setMachines,
    setTeams,
    setTeamLeaders,
    setEmployees,
    setTeamMembers,
    setSelectedEmployee,
    setSelectedContext,
    resetSelectedContext,
    setWeeklyShifts,
    setShiftDetails,
    setCurrentShiftNotes,
    setCurrentPlanId,
    setCurrentPatternId,
    setCurrentPatternType,
    setIsLoading,
    setIsDragging,
    setIsEditMode,
    setIsPlanLocked,
    setShowPlanningUI,
    setFavorites,
    setAutofillConfig,
    setRotationConfig,
    setEmployeeTeamInfo,
    setHasFullAccess,
    setStandardRotationEnabled,
    setCustomRotationEnabled,
    setStandardRotationEnabledDirect,
    setCustomRotationEnabledDirect,
    setShowRotationSetupModal,
    setShowCustomRotationModal,
    setWeeklyNotes,
    toggleAreaDropdown,
    toggleDepartmentDropdown,
    toggleMachineDropdown,
    toggleTeamDropdown,
    closeAllDropdowns,
    setRotationHistoryMap,
    addPendingRotationDeletion,
    clearPendingRotationDeletions,
    clearShiftData,
    getEmployeeById,
    getMemberNameById,
    getAreaById,
    getDepartmentById,
    getMachineById,
    getTeamById,
    addShiftAssignment,
    removeShiftAssignment,
    getShiftEmployees,
    addShiftDetail,
    isHierarchyValid,
    reset,
  };
}

// Singleton export
export const shiftsState = createShiftsState();
