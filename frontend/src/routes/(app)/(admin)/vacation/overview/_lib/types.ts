/**
 * Vacation Overview — Frontend Type Definitions
 * Mirrors backend vacation.types.ts for team calendar + balance.
 */

// ─── Team calendar types ─────────────────────────────────────────

export interface TeamCalendarEntry {
  userId: number;
  userName: string;
  startDate: string;
  endDate: string;
  vacationType: VacationType;
  halfDayStart: VacationHalfDay;
  halfDayEnd: VacationHalfDay;
}

export interface TeamCalendarData {
  teamId: number;
  teamName: string;
  month: number;
  year: number;
  entries: TeamCalendarEntry[];
}

export type VacationType =
  | 'regular'
  | 'special_doctor'
  | 'special_bereavement'
  | 'special_birth'
  | 'special_wedding'
  | 'special_move'
  | 'unpaid';

export type VacationHalfDay = 'none' | 'morning' | 'afternoon';

// ─── Team selector types ─────────────────────────────────────────

export interface TeamListItem {
  id: number;
  name: string;
}

// ─── Balance (own overview) ──────────────────────────────────────

export interface VacationBalance {
  year: number;
  totalDays: number;
  carriedOverDays: number;
  effectiveCarriedOver: number;
  additionalDays: number;
  availableDays: number;
  usedDays: number;
  remainingDays: number;
  pendingDays: number;
  projectedRemaining: number;
}

// ─── Calendar grid helper types ──────────────────────────────────

/** Per-user row in the calendar grid */
export interface CalendarUserRow {
  userId: number;
  userName: string;
  /** Day index (1-based) → cell info or null */
  days: Map<number, CalendarDayCell>;
}

/** Single cell in the calendar grid */
export interface CalendarDayCell {
  vacationType: VacationType;
  halfDay: VacationHalfDay;
  /** Whether this day is a range continuation (not start) */
  isContinuation: boolean;
}

// ─── Blackout types ─────────────────────────────────────────────

export interface BlackoutPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isGlobal: boolean;
}

// ─── Machine types ──────────────────────────────────────────────

export interface MachineListItem {
  id: number;
  name: string;
}

// ─── Staffing rule types ─────────────────────────────────────────

export interface StaffingRule {
  id: string;
  machineId: number;
  machineName: string;
  minStaffCount: number;
}

// ─── Machine availability (for day-header marking) ──────────────

export interface MachineAvailabilityEntry {
  id: number;
  machineId: number;
  status: string;
  startDate: string;
  endDate: string;
}

// ─── SSR page data ───────────────────────────────────────────────

export interface VacationOverviewPageData {
  machines: MachineListItem[];
  blackouts: BlackoutPeriod[];
  staffingRules: StaffingRule[];
  currentYear: number;
  currentMonth: number;
}
