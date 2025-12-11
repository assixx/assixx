/**
 * Custom Rotation Types and Constants
 * Type definitions and data structures for the 2-week shift planning system
 */

// Shift type definition (early, late, night)
export type ShiftType = 'early' | 'late' | 'night';

// Shift group for employee assignment (F = Früh, S = Spät, N = Nacht)
export type ShiftGroup = 'F' | 'S' | 'N';

// Employee assignment to starting shift group
export interface EmployeeAssignment {
  userId: number;
  userName: string;
  startGroup: ShiftGroup;
}

// Generate rotation request to backend
export interface GenerateRotationRequest {
  config: {
    shiftBlockLength: number;
    freeDays: number;
    startShift: ShiftType;
    shiftSequence: ShiftType[];
    specialRules?: NthWeekdayFreeRule[] | undefined;
  };
  assignments: EmployeeAssignment[];
  startDate: string;
  endDate: string;
  teamId?: number | undefined;
  departmentId?: number | undefined;
}

// Special rule: nth weekday free (e.g., every 4th Sunday free)
export interface NthWeekdayFreeRule {
  type: 'nth_weekday_free';
  name: string;
  weekday: number; // 0-6 (0 = Sunday)
  n: number; // 1-5 (e.g., 4 = "every 4th")
}

export interface DaySchedule {
  early: number[]; // User IDs for early shift
  late: number[]; // User IDs for late shift
  night: number[]; // User IDs for night shift
  free: number[]; // User IDs marked as free
}

export interface WeekData {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

/** Backend-compatible pattern types */
export type BackendPatternType = 'alternate_fs' | 'fixed_n' | 'custom';

export interface CustomRotationPattern {
  name: string;
  patternType: 'auto-detect' | BackendPatternType;
  cycleLengthWeeks: number;
  employeeCount?: number | undefined;
  patternConfig: {
    // Existing: Grid pattern data
    customPattern?:
      | {
          week1: WeekData;
          week2: WeekData;
          week3?: WeekData | undefined;
          week4?: WeekData | undefined;
        }
      | undefined;
    rotationType?: 'forward' | 'backward' | undefined;
    shiftDuration?: number | undefined; // days per shift type

    // NEW: Shift block algorithm configuration
    shiftBlockLength?: number | undefined; // Days per shift block (e.g., 10)
    freeDays?: number | undefined; // Free days between shifts (e.g., 2)
    startShift?: ShiftType | undefined; // Starting shift
    shiftSequence?: ShiftType[] | undefined; // Rotation order (e.g., ['early', 'late', 'night'])
    specialRules?: NthWeekdayFreeRule[] | undefined; // Optional special rules
  };
  startsAt: string;
  endsAt?: string | undefined;
  teamId?: number | undefined;
}

export interface PatternTemplate {
  id: string;
  name: string;
  description: string;
  employeeCount: number;
  cycleWeeks: number;
  preview: string;
}

// Predefined Pattern Templates
export const PATTERN_TEMPLATES: PatternTemplate[] = [
  {
    id: 'auto-detect',
    name: 'Automatische Mustererkennung',
    description:
      'System erkennt das Schichtmuster automatisch aus den ersten 2 Wochen und wiederholt es für den gewählten Zeitraum',
    employeeCount: 0,
    cycleWeeks: 2,
    preview: 'Woche 1 + 2 im Grid ausfüllen → Muster wird automatisch wiederholt',
  },
];

// Constants
export const SHIFT_ROW_SELECTOR = '.shift-row';
