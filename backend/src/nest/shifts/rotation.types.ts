/**
 * Rotation Types
 *
 * Shared type definitions for the rotation service domain.
 * Used by all rotation sub-services and the facade.
 */

// ============================================================
// DATABASE ROW TYPES
// ============================================================

export interface DbPatternRow {
  id: number;
  tenant_id: number;
  team_id: number | null;
  name: string;
  description: string | null;
  pattern_type: 'alternate_fs' | 'fixed_n' | 'custom';
  pattern_config: Record<string, unknown> | string;
  cycle_length_weeks: number;
  starts_at: string | Date;
  ends_at: string | Date | null;
  is_active: number;
  created_by: number;
  created_by_name?: string;
  created_at?: string | Date;
  updated_at?: string | Date;
}

export interface DbAssignmentRow {
  id: number;
  tenant_id: number;
  pattern_id: number;
  user_id: number;
  team_id: number | null;
  shift_group: 'F' | 'S' | 'N';
  rotation_order: number;
  can_override: boolean;
  override_dates: Record<string, unknown> | null;
  is_active: number;
  starts_at: string | Date;
  ends_at: string | Date | null;
  assigned_by: number;
  assigned_at?: string | Date;
  updated_at?: string | Date;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface DbHistoryRow {
  id: number;
  tenant_id: number;
  pattern_id: number;
  assignment_id: number;
  user_id: number;
  team_id: number | null;
  shift_date: string | Date;
  shift_type: 'F' | 'S' | 'N';
  week_number: number;
  status: 'generated' | 'confirmed' | 'modified' | 'cancelled';
  modified_reason: string | null;
  generated_at?: string | Date;
  confirmed_at?: string | Date;
  confirmed_by?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  pattern_name?: string;
}

// ============================================================
// RESPONSE TYPES
// ============================================================

/**
 * Rotation pattern response
 */
export interface RotationPatternResponse {
  id: number;
  tenantId: number;
  teamId?: number | null;
  name: string;
  description?: string;
  patternType: 'alternate_fs' | 'fixed_n' | 'custom';
  patternConfig: Record<string, unknown>;
  cycleLengthWeeks: number;
  startsAt: string;
  endsAt?: string | null;
  isActive: boolean;
  createdBy: number;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Rotation assignment response
 */
export interface RotationAssignmentResponse {
  id: number;
  patternId: number;
  userId: number;
  shiftGroup: 'F' | 'S' | 'N';
  startsAt: string;
  endsAt?: string | null;
  username?: string;
  firstName?: string;
  lastName?: string;
  [key: string]: unknown;
}

/**
 * Rotation history response
 */
export interface RotationHistoryResponse {
  id: number;
  patternId: number;
  userId: number;
  shiftDate: string;
  shiftType: 'F' | 'S' | 'N';
  status: 'generated' | 'confirmed' | 'modified' | 'cancelled';
  username?: string;
  firstName?: string;
  lastName?: string;
  patternName?: string;
  [key: string]: unknown;
}

/**
 * Generated shifts response
 */
export interface GeneratedShiftsResponse {
  shifts: GeneratedShift[];
  [key: string]: unknown;
}

export interface GeneratedShift {
  userId: number;
  date: string;
  shiftType: 'F' | 'S' | 'N';
  [key: string]: unknown;
}

/**
 * Delete history counts response
 */
export interface DeleteHistoryCountsResponse {
  patterns: number;
  assignments: number;
  history: number;
  shifts?: number;
  plans?: number;
}

// ============================================================
// FILTER TYPES
// ============================================================

/**
 * Rotation history filters
 */
export interface RotationHistoryFilters {
  patternId?: number | undefined;
  userId?: number | undefined;
  teamId?: number | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  status?: string | undefined;
}

/**
 * Pattern configuration
 */
export interface PatternConfig {
  weekType?: 'F' | 'S';
  cycleWeeks?: number;
  shiftType?: 'N';
  skipSaturday?: boolean;
  skipSunday?: boolean;
  nightShiftStatic?: boolean;
  skipWeekends?: boolean;
  ignoreNightShift?: boolean;
  shiftBlockLength?: number;
  freeDays?: number;
  startShift?: 'early' | 'late' | 'night';
  shiftSequence?: ('early' | 'late' | 'night')[];
  specialRules?: unknown[];
  pattern?: { week: number; shift: 'F' | 'S' | 'N' }[];
  customPattern?: {
    week1: Record<string, unknown>;
    week2: Record<string, unknown>;
  };
}
