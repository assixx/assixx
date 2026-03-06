// =============================================================================
// SHIFTS - TYPE DEFINITIONS
// Based on: frontend/src/scripts/shifts/types.ts
// =============================================================================

import type { TpmIntervalType } from './constants';
import type {
  ExtendedUserRole as UserRole,
  AvailabilityStatus,
} from '@assixx/shared';

export type { UserRole, AvailabilityStatus };

/**
 * Shift time info for display and save operations.
 * Matches the structure used in SHIFT_TIMES constant.
 */
export interface ShiftTimeInfo {
  start: string;
  end: string;
  label: string;
}

/** Map of shift key → time info (e.g. early → {start:'06:00', end:'14:00', label:'Frühschicht'}) */
export type ShiftTimesMap = Record<string, ShiftTimeInfo>;

/** API response for a single shift time definition */
export interface ShiftTimeApiResponse {
  shiftKey: string;
  label: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
  isActive: number;
}

/**
 * Single availability entry (one period of unavailability)
 * A user can have multiple entries per week (e.g. vacation Mon-Tue + sick Fri)
 */
export interface AvailabilityEntry {
  status: AvailabilityStatus;
  startDate?: string;
  endDate?: string;
}

/**
 * Shift types (frontend format)
 */
export type ShiftType = 'early' | 'late' | 'night';

/**
 * Shift types (API/DB format)
 */
export type ShiftTypeAPI = 'F' | 'S' | 'N';

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
  /** All availability entries for the displayed week (multiple periods possible) */
  availabilities?: AvailabilityEntry[];
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
 * Asset
 */
export interface Asset {
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
  assetId?: number;
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
  assetId: number | null;
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
    isTpmMode?: boolean;
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
  assetId?: number;
  name: string;
  shiftNotes?: string;
  isTpmMode?: boolean;
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
  assetId: number;
  assetName: string;
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
  assetId?: number;
  assetName?: string;
  teamLeaderId?: number | null; // For permission checks (SSR)
}

/**
 * Shift assignment count per employee (week, month, year)
 */
export interface AssignmentCount {
  employeeId: number;
  firstName: string;
  lastName: string;
  weekCount: number;
  monthCount: number;
  yearCount: number;
}

/**
 * Dropdown option item
 */
export interface DropdownOption {
  id: number;
  name: string;
}

/**
 * Asset availability entry (from GET /assets/:id/availability)
 * Used by shift planning to visually mark cells where a asset is unavailable.
 */
export interface AssetAvailabilityEntry {
  id: number;
  assetId: number;
  status: string;
  startDate: string;
  endDate: string;
  notes: string | null;
}

/**
 * TPM interval color entry from API (tenant-configurable).
 * Local mirror to avoid fragile cross-route imports (same reason as TpmIntervalType).
 */
export interface IntervalColorEntry {
  statusKey: TpmIntervalType;
  colorHex: string;
  label: string;
}

/**
 * TPM maintenance event for shift grid overlay.
 * One entry per plan×date (a plan's baseWeekday matches a day in the week).
 */
export interface TpmMaintenanceEvent {
  planUuid: string;
  planName: string;
  assetName: string;
  baseTime: string | null;
  bufferHours: number;
  /** Interval types due on this date (e.g. ['weekly', 'monthly', 'quarterly']) */
  intervalTypes: TpmIntervalType[];
}
