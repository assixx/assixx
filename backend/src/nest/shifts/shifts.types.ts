/**
 * Shifts Types
 *
 * Shared types for the shifts module.
 * All sub-services and the facade import from here.
 * Follows the same pattern as rotation.types.ts.
 */

// ============================================================
// RESPONSE TYPES
// ============================================================

/**
 * Shift response type
 */
export interface ShiftResponse {
  id: number;
  userId: number;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number | undefined;
  type?: string | undefined;
  status?: string | undefined;
  departmentId?: number | undefined;
  departmentName?: string | undefined;
  userName?: string | undefined;
  notes?: string | undefined;
  [key: string]: unknown;
}

/**
 * Shift plan response
 */
export interface ShiftPlanResponse {
  planId: number;
  shiftIds: number[];
  message: string;
}

/**
 * Swap request types — re-exported from shift-swap.types.ts
 * @see shift-swap.types.ts for the canonical definitions
 */
export type {
  SwapRequestResponse,
  SwapRequestFilters,
  DbSwapRequestRow,
  SwapRequestStatus,
  SwapRequestScope,
} from './shift-swap.types.js';

/**
 * Calendar shift response
 */
export interface CalendarShiftResponse {
  date: string;
  type: string;
}

/**
 * Assignment count per employee (week, month, year).
 *
 * `weekInMonthCount` / `weekInYearCount` are the intersection counts
 * (shifts that lie in BOTH the current week AND the reference month/year).
 * The frontend needs these to correctly re-merge local (unsaved) week edits
 * into the month/year totals when the current week crosses a month/year
 * boundary — see `frontend/.../shifts/+page.svelte` assignmentCounts derived.
 */
export interface AssignmentCountResponse {
  employeeId: number;
  firstName: string;
  lastName: string;
  weekCount: number;
  monthCount: number;
  yearCount: number;
  weekInMonthCount: number;
  weekInYearCount: number;
}

/**
 * Favorite response
 */
export interface FavoriteResponse {
  id: number;
  name: string;
  areaId: number;
  areaName: string;
  departmentId: number;
  departmentName: string;
  assetId: number;
  assetName: string;
  teamId: number;
  teamName: string;
  [key: string]: unknown;
}

// ============================================================
// FILTER TYPES
// ============================================================

/**
 * Shift list filters
 */
export interface ShiftFilters {
  date?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  userId?: number | undefined;
  departmentId?: number | undefined;
  teamId?: number | undefined;
  status?: string | undefined;
  type?: string | undefined;
  templateId?: number | undefined;
  planId?: number | undefined;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

/**
 * Shift plan filters
 */
export interface ShiftPlanFilters {
  areaId?: number | undefined;
  departmentId?: number | undefined;
  teamId?: number | undefined;
  assetId?: number | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
}

/**
 * Overtime filters
 */
export interface OvertimeFilters {
  userId: number;
  startDate: string;
  endDate: string;
}

/**
 * Export filters
 */
export interface ExportFilters {
  startDate: string;
  endDate: string;
  departmentId?: number | undefined;
  teamId?: number | undefined;
  userId?: number | undefined;
}

// ============================================================
// DATABASE ROW TYPES
// ============================================================

export interface DbShiftRow {
  id: number;
  tenant_id: number;
  plan_id: number | null;
  user_id: number;
  date: string | Date;
  start_time: string | Date;
  end_time: string | Date;
  title: string | null;
  required_employees: number | null;
  actual_start: string | null;
  actual_end: string | null;
  break_minutes: number | null;
  status: string | null;
  type: string | null;
  notes: string | null;
  area_id: number | null;
  department_id: number;
  team_id: number | null;
  asset_id: number | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
  // Joined fields
  user_name?: string | undefined;
  first_name?: string | undefined;
  last_name?: string | undefined;
  department_name?: string | undefined;
  team_name?: string | undefined;
}

export interface DbFavoriteRow {
  id: number;
  tenant_id: number;
  user_id: number;
  name: string;
  area_id: number;
  area_name: string;
  department_id: number;
  department_name: string;
  asset_id: number;
  asset_name: string;
  team_id: number;
  team_name: string;
  created_at: Date;
}

export interface DbShiftPlanRow {
  id: number;
  tenant_id: number;
  area_id: number | null;
  department_id: number;
  team_id: number | null;
  asset_id: number | null;
  name: string | null;
  start_date: string;
  end_date: string;
  shift_notes: string | null;
  custom_rotation_pattern: string | null;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}
