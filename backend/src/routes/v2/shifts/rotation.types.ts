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

export interface PatternConfig {
  weekType?: 'F' | 'S';
  cycleWeeks?: number;
  shiftType?: 'N';
  pattern?: {
    week: number;
    shift: 'F' | 'S' | 'N';
  }[];
  skipWeekends?: boolean;
  ignoreNightShift?: boolean;
}

export interface ShiftRotationAssignment {
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

export interface ShiftRotationHistory {
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

export interface CreateRotationPatternRequest {
  name: string;
  description?: string;
  team_id?: number | null;
  pattern_type: 'alternate_fs' | 'fixed_n' | 'custom';
  pattern_config: PatternConfig;
  cycle_length_weeks?: number;
  starts_at: string;
  ends_at?: string;
  is_active?: boolean;
}

export interface AssignRotationRequest {
  pattern_id: number;
  user_ids: number[];
  team_id?: number | null;
  shift_groups: Record<number, 'F' | 'S' | 'N'>;
  starts_at: string;
  ends_at?: string;
}

export interface GenerateRotationRequest {
  pattern_id: number;
  start_date: string;
  end_date: string;
  preview?: boolean;
}

export interface RotationPatternResponse {
  success: boolean;
  data?: {
    pattern?: ShiftRotationPattern;
    patterns?: ShiftRotationPattern[];
    assignments?: ShiftRotationAssignment[];
    history?: ShiftRotationHistory[];
    generatedShifts?: {
      user_id: number;
      date: string;
      shift_type: 'F' | 'S' | 'N';
    }[];
  };
  error?: {
    code: string;
    message: string;
  };
}
