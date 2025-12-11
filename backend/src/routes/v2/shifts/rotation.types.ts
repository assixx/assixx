/**
 * Shift Rotation Types
 * Type definitions for shift rotation patterns
 */

export interface ShiftRotationPattern {
  id?: number;
  tenantId: number;
  teamId?: number | null;
  name: string;
  description?: string;
  patternType: 'alternate_fs' | 'fixed_n' | 'custom';
  patternConfig: PatternConfig;
  cycleLengthWeeks: number;
  startsAt: string;
  endsAt?: string | null;
  isActive: boolean;
  createdBy: number;
  createdAt?: string;
  updatedAt?: string;
}

// Shift type for block algorithm
export type ShiftBlockType = 'early' | 'late' | 'night';

// Special rule: nth weekday free (e.g., every 4th Sunday free)
export interface NthWeekdayFreeRule {
  type: 'nth_weekday_free';
  name: string;
  weekday: number; // 0-6 (0 = Sunday)
  n: number; // 1-5 (e.g., 4 = "every 4th")
}

// Configuration for shift block algorithm
export interface ShiftBlockConfig {
  shiftBlockLength: number; // Days per shift block (e.g., 10)
  freeDays: number; // Free days between shifts (e.g., 2)
  startShift: ShiftBlockType; // Starting shift
  shiftSequence: ShiftBlockType[]; // Rotation order (e.g., ['early', 'late', 'night'])
  specialRules?: NthWeekdayFreeRule[]; // Optional special rules
}

export interface PatternConfig {
  weekType?: 'F' | 'S';
  cycleWeeks?: number;
  shiftType?: 'N';
  pattern?: {
    week: number;
    shift: 'F' | 'S' | 'N';
  }[];

  // Weekend skip options (individual days)
  skipSaturday?: boolean;
  skipSunday?: boolean;

  // Night shift behavior
  nightShiftStatic?: boolean; // N stays N, only F ↔ S alternate

  // LEGACY (deprecated) - kept for backward compatibility
  skipWeekends?: boolean;
  ignoreNightShift?: boolean;

  // Custom rotation patterns (2-week patterns)
  customPattern?: {
    week1: WeekSchedule;
    week2: WeekSchedule;
  };

  // NEW: Shift block algorithm configuration
  shiftBlockLength?: number; // Days per shift block (e.g., 10)
  freeDays?: number; // Free days between shifts (e.g., 2)
  startShift?: ShiftBlockType; // Starting shift
  shiftSequence?: ShiftBlockType[]; // Rotation order
  specialRules?: NthWeekdayFreeRule[]; // Optional special rules
}

// NEW: Supporting interfaces for Custom Rotation
export interface WeekSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface DaySchedule {
  early: number[]; // User IDs assigned to early shift (F)
  late: number[]; // User IDs assigned to late shift (S)
  night: number[]; // User IDs assigned to night shift (N)
  free: number[]; // User IDs marked as free/off duty
}

// ============== DB ROW TYPES (snake_case - matches database columns) ==============

/** Database row type for shift_rotation_assignments table */
export interface ShiftRotationAssignmentRow {
  id?: number;
  tenant_id: number;
  pattern_id: number;
  user_id: number;
  team_id?: number | null;
  shift_group: 'F' | 'S' | 'N';
  rotation_order?: number;
  can_override?: boolean;
  override_dates?: Record<string, string>;
  is_active: boolean;
  starts_at: string;
  ends_at?: string | null;
  assigned_by: number;
  assigned_at?: string;
  updated_at?: string;
}

/** Database row type for shift_rotation_history table */
export interface ShiftRotationHistoryRow {
  id?: number;
  tenant_id: number;
  pattern_id: number;
  assignment_id: number;
  user_id: number;
  team_id?: number | null;
  shift_date: string;
  shift_type: 'F' | 'S' | 'N';
  week_number: number;
  status: 'generated' | 'confirmed' | 'modified' | 'cancelled';
  modified_reason?: string | null;
  generated_at?: string;
  confirmed_at?: string | null;
  confirmed_by?: number | null;
}

// ============== API RESPONSE TYPES (camelCase - for frontend) ==============

/** API response type for shift rotation assignments */
export interface ShiftRotationAssignment {
  id?: number;
  tenantId: number;
  patternId: number;
  userId: number;
  teamId?: number | null;
  shiftGroup: 'F' | 'S' | 'N';
  rotationOrder?: number;
  canOverride?: boolean;
  overrideDates?: Record<string, string>;
  isActive: boolean;
  startsAt: string;
  endsAt?: string | null;
  assignedBy: number;
  assignedAt?: string;
  updatedAt?: string;
}

/** API response type for shift rotation history */
export interface ShiftRotationHistory {
  id?: number;
  tenantId: number;
  patternId: number;
  assignmentId: number;
  userId: number;
  teamId?: number | null;
  shiftDate: string;
  shiftType: 'F' | 'S' | 'N';
  weekNumber: number;
  status: 'generated' | 'confirmed' | 'modified' | 'cancelled';
  modifiedReason?: string | null;
  generatedAt?: string;
  confirmedAt?: string | null;
  confirmedBy?: number | null;
}

/** API Request Interface (camelCase) - converted to snake_case in service */
export interface CreateRotationPatternRequest {
  name: string;
  description?: string;
  teamId?: number | null;
  patternType: 'alternate_fs' | 'fixed_n' | 'custom';
  patternConfig: PatternConfig;
  cycleLengthWeeks?: number;
  startsAt: string;
  endsAt?: string;
  isActive?: boolean;
}

/** API Request Interface for assigning users to rotation (camelCase from frontend) */
export interface AssignRotationRequest {
  patternId: number;
  assignments: { userId: number; group: 'F' | 'S' | 'N' }[];
  teamId?: number | null;
  startsAt: string;
  endsAt?: string;
}

/** API Request Interface for generating rotation shifts (camelCase from frontend) */
export interface GenerateRotationRequest {
  patternId: number;
  startDate: string;
  endDate: string;
  preview?: boolean;
}

/** Employee assignment for algorithm-based rotation generation */
export interface EmployeeAssignment {
  userId: number;
  userName: string;
  startGroup: 'F' | 'S' | 'N';
}

/** API Request Interface for algorithm-based rotation generation (new flow) */
export interface GenerateRotationFromConfigRequest {
  config: {
    shiftBlockLength: number;
    freeDays: number;
    startShift: ShiftBlockType;
    shiftSequence: ShiftBlockType[];
    specialRules?: NthWeekdayFreeRule[];
  };
  assignments: EmployeeAssignment[];
  startDate: string;
  endDate: string;
  teamId?: number;
  departmentId?: number;
}
