// =============================================================================
// SHIFTS - TYPE DEFINITIONS
// Based on: frontend/src/scripts/shifts/types.ts
// =============================================================================

/**
 * User roles
 */
export type UserRole = 'root' | 'admin' | 'employee' | 'team_lead' | 'manager';

/**
 * Shift types (frontend format)
 */
export type ShiftType = 'early' | 'late' | 'night';

/**
 * Shift types (API/DB format)
 */
export type ShiftTypeAPI = 'F' | 'S' | 'N';

/**
 * Availability status
 */
export type AvailabilityStatus =
  | 'available'
  | 'vacation'
  | 'sick'
  | 'unavailable'
  | 'training'
  | 'other';

/**
 * Rotation pattern types
 */
export type RotationPatternType = 'alternate_fs' | 'fixed_n' | 'custom';

/**
 * Current user
 */
export interface User {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  tenantId: number;
  isActive: 0 | 1 | 3 | 4;
  createdAt: string;
  updatedAt: string;
  hasFullAccess?: boolean | number;
  availabilityStatus?: AvailabilityStatus;
  availabilityStart?: string;
  availabilityEnd?: string;
  // Team fields - API v2 uses arrays (teamIds, teamNames)
  teamId?: number | null; // deprecated - use teamIds[0]
  teamIds?: number[]; // array of team IDs (new API)
  teamName?: string | null; // deprecated - use teamNames[0]
  teamNames?: string[]; // array of team names (new API)
  teamDepartmentId?: number | null;
  teamDepartmentName?: string | null;
  teamAreaId?: number | null;
  teamAreaName?: string | null;
}

/**
 * Employee (extends User with shift-specific properties)
 */
export interface Employee extends User {
  shiftAssignments?: ShiftAssignment[];
  availabilityReason?: string;
  availableFrom?: string;
  position?: string;
}

/**
 * Area (top of hierarchy)
 */
export interface Area {
  id: number;
  name: string;
  description?: string;
  type?: string;
}

/**
 * Department
 */
export interface Department {
  id: number;
  name: string;
  description?: string;
  areaId?: number;
}

/**
 * Machine
 */
export interface Machine {
  id: number;
  name: string;
  departmentId: number;
  areaId?: number;
  description?: string;
}

/**
 * Team
 */
export interface Team {
  id: number;
  name: string;
  description?: string;
  leaderId?: number;
  leaderName?: string;
  departmentId?: number;
  departmentName?: string;
  memberCount?: number;
  status?: string;
  createdAt: string;
  updatedAt: string;
  members?: TeamMember[];
  teamLeadId?: number;
}

/**
 * Team member
 */
export interface TeamMember {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  role: 'member' | 'lead';
  userRole?: 'admin' | 'employee' | 'root';
  availabilityStatus?: AvailabilityStatus;
  availabilityStart?: string;
  availabilityEnd?: string;
}

/**
 * Team leader
 */
export interface TeamLeader {
  id: number;
  name: string;
  username: string;
}

/**
 * Shift assignment record
 */
export interface ShiftAssignment {
  id: number;
  employeeId: number;
  date: string;
  shiftType: ShiftType;
  departmentId?: number;
  machineId?: number;
  teamLeaderId?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Selected context for shift planning (hierarchy selection)
 */
export interface SelectedContext {
  areaId: number | null;
  departmentId: number | null;
  machineId: number | null;
  teamId: number | null;
  teamLeaderId: number | null;
}

/**
 * Shift detail data for display
 */
export interface ShiftDetailData {
  employeeId: number;
  firstName: string;
  lastName: string;
  username: string;
  date?: string;
  shiftType?: string;
  isRotationShift?: boolean;
}

/**
 * Shift plan response from API
 */
export interface ShiftPlanResponse {
  plan?: {
    id: number;
    name: string;
    shiftNotes?: string;
    startDate: string;
    endDate: string;
  };
  shifts: {
    id?: number;
    userId: number;
    date: string;
    type: string;
    startTime?: string;
    endTime?: string;
    user?: {
      id: number;
      firstName: string;
      lastName: string;
      username: string;
    };
  }[];
  notes?: Record<string, { note: string }> | unknown[];
}

/**
 * Create shift plan request
 */
export interface CreateShiftPlanRequest {
  startDate: string;
  endDate: string;
  areaId?: number;
  departmentId?: number;
  teamId?: number;
  machineId?: number;
  name: string;
  shiftNotes?: string;
  shifts: {
    userId: number;
    date: string;
    type: string;
    startTime: string;
    endTime: string;
  }[];
  customRotationPattern?: string;
}

/**
 * Shift favorite configuration
 */
export interface ShiftFavorite {
  id: number | string;
  name: string;
  areaId: number;
  areaName: string;
  departmentId: number;
  departmentName: string;
  machineId: number;
  machineName: string;
  teamId: number;
  teamName: string;
  createdAt: string;
}

/**
 * Rotation pattern from database
 */
export interface RotationPattern {
  id: number;
  tenantId: number;
  teamId: number | null;
  name: string;
  description?: string;
  patternType: RotationPatternType;
  patternConfig: Record<string, unknown>;
  cycleLengthWeeks: number;
  startsAt: string;
  endsAt?: string | null;
  isActive: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Rotation history entry (processed format)
 */
export interface RotationHistoryEntry {
  date: string;
  shiftType: string;
  employeeId: number;
  firstName: string;
  lastName: string;
}

/**
 * Rotation history entry from API (raw format)
 */
export interface RotationHistoryEntryAPI {
  id: number; // History entry ID for deletion
  shiftDate: string;
  shiftType: string;
  userId: number;
  status?: string;
  patternId?: number; // Pattern ID for loading pattern type (used by syncRotationToggles)
}

/**
 * Autofill configuration
 */
export interface ShiftAutofillConfig {
  enabled: boolean;
  fillWeekdays: boolean;
  skipWeekends: boolean;
  respectAvailability: boolean;
}

/**
 * Rotation configuration
 */
export interface ShiftRotationConfig {
  enabled: boolean;
  pattern: 'F_S_alternate' | 'custom';
  nightFixed: boolean;
  autoGenerateWeeks: number;
}

/**
 * Custom rotation configuration for modal output
 */
export interface CustomRotationConfig {
  startDate: string;
  endDate: string;
  shiftBlockLength: number;
  freeDays: number;
  startShift: 'early' | 'late' | 'night';
  shiftSequence: 'early-late-night' | 'night-late-early';
  nthWeekdayFree: boolean;
  nthValue: number;
  weekdayValue: number;
  employeeAssignments: Map<string, number[]>;
}

/**
 * Weekly shifts data structure
 * Map<dateKey, Map<shiftType, employeeIds[]>>
 */
export type WeeklyShiftsMap = Map<string, Map<string, number[]>>;

/**
 * Employee team info (for employee view)
 */
export interface EmployeeTeamInfo {
  teamId: number;
  teamName: string;
  departmentId: number;
  departmentName: string;
  areaId: number;
  areaName: string;
  machineId?: number;
  machineName?: string;
  teamLeaderId?: number | null; // For permission checks (SSR)
}

/**
 * Dropdown option item
 */
export interface DropdownOption {
  id: number;
  name: string;
}
