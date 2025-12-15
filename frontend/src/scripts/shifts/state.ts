/**
 * State Management for Shift Planning System
 * Centralized state store with getters and setters
 */

import { ApiClient } from '../../utils/api-client';
import type {
  Employee,
  Area,
  Department,
  Machine,
  Team,
  TeamLeader,
  TeamMember,
  SelectedContext,
  ShiftFavorite,
  ShiftAutofillConfig,
  ShiftRotationConfig,
  ShiftDetailData,
} from './types';

// State interface
export interface ShiftPlanningState {
  // API Client
  apiClient: ApiClient;

  // Week navigation
  currentWeek: Date;

  // Employees
  selectedEmployee: Employee | null;
  employees: Employee[];
  teamMembers: TeamMember[];

  // Shift data
  weeklyShifts: Map<string, Map<string, number[]>>;
  shiftDetails: Map<string, ShiftDetailData>;

  // User info
  isAdmin: boolean;
  userRole: string;
  currentUserId: number | null;
  hasFullAccess: boolean;

  // UI state
  isDragging: boolean;
  isEditMode: boolean;
  isPlanLocked: boolean;
  editMode: boolean;

  // Plan management
  currentPlanId: number | null;
  currentPatternId: number | null;
  currentPatternType: 'alternate_fs' | 'fixed_n' | 'custom' | null;
  currentShiftNotes: string;

  // Context data (hierarchy)
  areas: Area[];
  departments: Department[];
  machines: Machine[];
  teams: Team[];
  teamLeaders: TeamLeader[];
  selectedContext: SelectedContext;

  // Favorites
  favorites: ShiftFavorite[];

  // Configuration
  autofillConfig: ShiftAutofillConfig;
  rotationConfig: ShiftRotationConfig;

  // Cache
  userPreferencesCache: Map<string, string | boolean | object>;

  // Rotation History tracking (for single-entry deletions)
  // Key: `${date}_${shiftType}_${userId}`, Value: rotation_history_id
  rotationHistoryMap: Map<string, number>;
  // IDs of rotation history entries to delete on save
  pendingRotationDeletions: Set<number>;
}

// Create initial state
function createInitialState(): ShiftPlanningState {
  return {
    apiClient: ApiClient.getInstance(),
    currentWeek: new Date(),
    selectedEmployee: null,
    employees: [],
    teamMembers: [],
    weeklyShifts: new Map(),
    shiftDetails: new Map(),
    isAdmin: false,
    userRole: '',
    currentUserId: null,
    hasFullAccess: false,
    isDragging: false,
    isEditMode: false,
    isPlanLocked: false,
    editMode: false,
    currentPlanId: null,
    currentPatternId: null,
    currentPatternType: null,
    currentShiftNotes: '',
    areas: [],
    departments: [],
    machines: [],
    teams: [],
    teamLeaders: [],
    selectedContext: {
      areaId: null,
      departmentId: null,
      machineId: null,
      teamId: null,
      teamLeaderId: null,
    },
    favorites: [],
    autofillConfig: {
      enabled: false,
      fillWeekdays: true,
      skipWeekends: true,
      respectAvailability: true,
    },
    rotationConfig: {
      enabled: false,
      pattern: 'F_S_alternate',
      nightFixed: true,
      autoGenerateWeeks: 4,
    },
    userPreferencesCache: new Map(),
    rotationHistoryMap: new Map(),
    pendingRotationDeletions: new Set(),
  };
}

// Singleton state instance
let state: ShiftPlanningState = createInitialState();

// State getters
export function getState(): ShiftPlanningState {
  return state;
}

export function getApiClient(): ApiClient {
  return state.apiClient;
}

export function getCurrentWeek(): Date {
  return state.currentWeek;
}

export function getSelectedContext(): SelectedContext {
  return state.selectedContext;
}

export function getEmployees(): Employee[] {
  return state.employees;
}

export function getTeams(): Team[] {
  return state.teams;
}

export function getAreas(): Area[] {
  return state.areas;
}

export function getDepartments(): Department[] {
  return state.departments;
}

export function getMachines(): Machine[] {
  return state.machines;
}

export function getWeeklyShifts(): Map<string, Map<string, number[]>> {
  return state.weeklyShifts;
}

export function getShiftDetails(): Map<string, ShiftDetailData> {
  return state.shiftDetails;
}

export function getCurrentPlanId(): number | null {
  return state.currentPlanId;
}

export function getCurrentPatternType(): 'alternate_fs' | 'fixed_n' | 'custom' | null {
  return state.currentPatternType;
}

export function isAdmin(): boolean {
  return state.isAdmin;
}

export function isEditMode(): boolean {
  return state.isEditMode;
}

export function isPlanLocked(): boolean {
  return state.isPlanLocked;
}

export function getAutofillConfig(): ShiftAutofillConfig {
  return state.autofillConfig;
}

export function getRotationConfig(): ShiftRotationConfig {
  return state.rotationConfig;
}

export function getFavorites(): ShiftFavorite[] {
  return state.favorites;
}

// State setters
export function setCurrentWeek(week: Date): void {
  state.currentWeek = week;
}

export function setSelectedEmployee(employee: Employee | null): void {
  state.selectedEmployee = employee;
}

export function setEmployees(employees: Employee[]): void {
  state.employees = employees;
}

export function setTeamMembers(members: TeamMember[]): void {
  state.teamMembers = members;
}

export function setAreas(areas: Area[]): void {
  state.areas = areas;
}

export function setDepartments(departments: Department[]): void {
  state.departments = departments;
}

export function setMachines(machines: Machine[]): void {
  state.machines = machines;
}

export function setTeams(teams: Team[]): void {
  state.teams = teams;
}

export function setTeamLeaders(leaders: TeamLeader[]): void {
  state.teamLeaders = leaders;
}

export function setSelectedContext(context: Partial<SelectedContext>): void {
  state.selectedContext = { ...state.selectedContext, ...context };
}

export function resetSelectedContext(): void {
  state.selectedContext = {
    areaId: null,
    departmentId: null,
    machineId: null,
    teamId: null,
    teamLeaderId: null,
  };
}

export function setCurrentPlanId(planId: number | null): void {
  state.currentPlanId = planId;
}

export function setCurrentPatternType(patternType: 'alternate_fs' | 'fixed_n' | 'custom' | null): void {
  state.currentPatternType = patternType;
}

export function setIsAdmin(admin: boolean): void {
  state.isAdmin = admin;
}

export function setUserRole(role: string): void {
  state.userRole = role;
}

export function setCurrentUserId(userId: number | null): void {
  state.currentUserId = userId;
}

export function getHasFullAccess(): boolean {
  return state.hasFullAccess;
}

export function setHasFullAccess(hasAccess: boolean): void {
  state.hasFullAccess = hasAccess;
}

// Cache for canEditShifts result (invalidated when context changes)
let canEditShiftsCache: boolean | null = null;
let canEditShiftsCacheKey: string | null = null;

/**
 * Invalidate the canEditShifts cache (call when context changes)
 */
export function invalidateEditPermissionCache(): void {
  canEditShiftsCache = null;
  canEditShiftsCacheKey = null;
}

/**
 * Check if current user can edit shifts (CACHED)
 * Permission hierarchy:
 * 1. Root role → can edit all
 * 2. Has full access flag → can edit all
 * 3. Is team_lead of the selected team → can edit that team's shifts
 */
export function canEditShifts(): boolean {
  // Create cache key from relevant state
  const cacheKey = `${state.userRole}_${String(state.hasFullAccess)}_${String(state.currentUserId)}_${String(state.selectedContext.teamLeaderId)}`;

  // Return cached result if valid
  if (canEditShiftsCache !== null && canEditShiftsCacheKey === cacheKey) {
    return canEditShiftsCache;
  }

  // Calculate permission
  let result = false;

  // Root can always edit
  if (state.userRole === 'root') {
    result = true;
  }
  // Admin with full access can edit all
  else if (state.userRole === 'admin' && state.hasFullAccess) {
    result = true;
  }
  // Team lead of the selected team can edit
  else {
    const selectedTeamLeadId = state.selectedContext.teamLeaderId;
    if (selectedTeamLeadId !== null && state.currentUserId !== null && selectedTeamLeadId === state.currentUserId) {
      result = true;
    }
  }

  // Cache result
  canEditShiftsCache = result;
  canEditShiftsCacheKey = cacheKey;

  return result;
}

export function setIsDragging(dragging: boolean): void {
  state.isDragging = dragging;
}

export function setIsEditMode(editMode: boolean): void {
  state.isEditMode = editMode;
}

export function setIsPlanLocked(locked: boolean): void {
  state.isPlanLocked = locked;
}

export function setAutofillConfig(config: Partial<ShiftAutofillConfig>): void {
  state.autofillConfig = { ...state.autofillConfig, ...config };
}

export function setRotationConfig(config: Partial<ShiftRotationConfig>): void {
  state.rotationConfig = { ...state.rotationConfig, ...config };
}

export function setFavorites(favorites: ShiftFavorite[]): void {
  state.favorites = favorites;
}

export function setWeeklyShifts(shifts: Map<string, Map<string, number[]>>): void {
  state.weeklyShifts = shifts;
}

export function setShiftDetails(details: Map<string, ShiftDetailData>): void {
  state.shiftDetails = details;
}

export function clearShiftData(): void {
  state.weeklyShifts = new Map();
  state.shiftDetails = new Map();
  state.currentPlanId = null;
  state.currentShiftNotes = '';
  state.rotationHistoryMap = new Map();
  state.pendingRotationDeletions = new Set();
}

export function getCurrentShiftNotes(): string {
  return state.currentShiftNotes;
}

export function setCurrentShiftNotes(notes: string): void {
  state.currentShiftNotes = notes;
}

// Rotation History tracking
export function getRotationHistoryMap(): Map<string, number> {
  return state.rotationHistoryMap;
}

export function setRotationHistoryMap(map: Map<string, number>): void {
  state.rotationHistoryMap = map;
}

export function getPendingRotationDeletions(): Set<number> {
  return state.pendingRotationDeletions;
}

export function addPendingRotationDeletion(historyId: number): void {
  state.pendingRotationDeletions.add(historyId);
}

export function clearPendingRotationDeletions(): void {
  state.pendingRotationDeletions = new Set();
}

export function setUserPreferencesCache(cache: Map<string, string | boolean | object>): void {
  state.userPreferencesCache = cache;
}

export function updateUserPreferencesCache(key: string, value: string | boolean | object): void {
  state.userPreferencesCache.set(key, value);
}

// Reset state to initial values
export function resetState(): void {
  state = createInitialState();
}

// Get employee by ID
export function getEmployeeById(id: number): Employee | undefined {
  return state.employees.find((emp) => emp.id === id);
}

// Get member name by ID
export function getMemberNameById(userId: number): string {
  const employee = state.employees.find((emp) => emp.id === userId);
  if (employee !== undefined) {
    const firstName = employee.firstName ?? '';
    const lastName = employee.lastName ?? '';
    if (firstName !== '' || lastName !== '') {
      return `${firstName} ${lastName}`.trim();
    }
    return employee.username !== '' ? employee.username : `User ${String(userId)}`;
  }
  return `User ${String(userId)}`;
}

// Check if context is complete for shift planning
export function isContextComplete(): boolean {
  const ctx = state.selectedContext;
  return ctx.teamId !== null && ctx.teamId !== 0;
}

// Check if hierarchy is valid
export function isHierarchyValid(): boolean {
  const ctx = state.selectedContext;
  // Team requires department
  if (ctx.teamId !== null && ctx.teamId !== 0) {
    return ctx.departmentId !== null && ctx.departmentId !== 0;
  }
  return true;
}
