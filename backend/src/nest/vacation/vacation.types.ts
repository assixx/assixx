/**
 * Vacation Module Types
 *
 * All interfaces and DB row types for the vacation request system.
 * Maps directly to the 7 vacation_* tables created in Migration 29.
 */

// ============================================================================
// Enums (mirror PostgreSQL ENUMs from migration 29)
// ============================================================================

export type VacationRequestStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'withdrawn'
  | 'cancelled';

export type VacationType =
  | 'regular'
  | 'special_doctor'
  | 'special_bereavement'
  | 'special_birth'
  | 'special_wedding'
  | 'special_move'
  | 'unpaid';

export type VacationHalfDay = 'none' | 'morning' | 'afternoon';

export type BlackoutScopeType = 'global' | 'team' | 'department';

export type CapacityStatus = 'ok' | 'warning' | 'critical';

export type OverallCapacityStatus = 'ok' | 'warning' | 'blocked';

// ============================================================================
// DB Row Types (1:1 mapping to table columns)
// ============================================================================

/** Row type for `vacation_holidays` table */
export interface VacationHolidayRow {
  id: string;
  tenant_id: number;
  holiday_date: string;
  name: string;
  recurring: boolean;
  is_active: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

/** Row type for `vacation_entitlements` table */
export interface VacationEntitlementRow {
  id: string;
  tenant_id: number;
  user_id: number;
  year: number;
  total_days: string; // NUMERIC comes as string from pg
  carried_over_days: string;
  additional_days: string;
  carry_over_expires_at: string | null;
  is_active: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

/** Row type for `vacation_requests` table */
export interface VacationRequestRow {
  id: string;
  tenant_id: number;
  requester_id: number;
  approver_id: number | null;
  substitute_id: number | null;
  start_date: string;
  end_date: string;
  half_day_start: VacationHalfDay;
  half_day_end: VacationHalfDay;
  vacation_type: VacationType;
  status: VacationRequestStatus;
  computed_days: string; // NUMERIC comes as string from pg
  is_special_leave: boolean;
  request_note: string | null;
  response_note: string | null;
  responded_at: string | null;
  responded_by: number | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

/** Row type for `vacation_request_status_log` table (append-only) */
export interface VacationRequestStatusLogRow {
  id: string;
  tenant_id: number;
  request_id: string;
  old_status: VacationRequestStatus | null;
  new_status: VacationRequestStatus;
  changed_by: number;
  note: string | null;
  created_at: string;
}

/** Row type for `vacation_blackouts` table */
export interface VacationBlackoutRow {
  id: string;
  tenant_id: number;
  name: string;
  reason: string | null;
  start_date: string;
  end_date: string;
  scope_type: BlackoutScopeType;
  scope_id: number | null;
  is_active: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

/** Row type for `vacation_staffing_rules` table */
export interface VacationStaffingRuleRow {
  id: string;
  tenant_id: number;
  machine_id: number;
  min_staff_count: number;
  is_active: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

/** Row type for `vacation_settings` table */
export interface VacationSettingsRow {
  id: string;
  tenant_id: number;
  default_annual_days: string; // NUMERIC comes as string from pg
  max_carry_over_days: string;
  carry_over_deadline_month: number;
  carry_over_deadline_day: number;
  advance_notice_days: number;
  max_consecutive_days: number | null;
  is_active: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Application Types (used in service layer and API responses)
// ============================================================================

/** Holiday as returned by the API */
export interface VacationHoliday {
  id: string;
  holidayDate: string;
  name: string;
  recurring: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

/** Entitlement as returned by the API */
export interface VacationEntitlement {
  id: string;
  userId: number;
  year: number;
  totalDays: number;
  carriedOverDays: number;
  additionalDays: number;
  carryOverExpiresAt: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Balance calculation result (computed, not stored) */
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

/** Vacation request as returned by the API */
export interface VacationRequest {
  id: string;
  requesterId: number;
  approverId: number | null;
  substituteId: number | null;
  startDate: string;
  endDate: string;
  halfDayStart: VacationHalfDay;
  halfDayEnd: VacationHalfDay;
  vacationType: VacationType;
  status: VacationRequestStatus;
  computedDays: number;
  isSpecialLeave: boolean;
  requestNote: string | null;
  responseNote: string | null;
  respondedAt: string | null;
  respondedBy: number | null;
  createdAt: string;
  updatedAt: string;
  /** Populated via JOIN when available */
  requesterName?: string;
  approverName?: string;
  substituteName?: string;
}

/** Status log entry as returned by the API */
export interface VacationStatusLogEntry {
  id: string;
  requestId: string;
  oldStatus: VacationRequestStatus | null;
  newStatus: VacationRequestStatus;
  changedBy: number;
  changedByName?: string;
  note: string | null;
  createdAt: string;
}

/** Blackout period as returned by the API */
export interface VacationBlackout {
  id: string;
  name: string;
  reason: string | null;
  startDate: string;
  endDate: string;
  scopeType: BlackoutScopeType;
  scopeId: number | null;
  scopeName?: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

/** Staffing rule as returned by the API */
export interface VacationStaffingRule {
  id: string;
  machineId: number;
  machineName?: string;
  minStaffCount: number;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

/** Tenant-wide vacation settings as returned by the API */
export interface VacationSettings {
  id: string;
  defaultAnnualDays: number;
  maxCarryOverDays: number;
  carryOverDeadlineMonth: number;
  carryOverDeadlineDay: number;
  advanceNoticeDays: number;
  maxConsecutiveDays: number | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Capacity Analysis Types
// ============================================================================

/** Result of analyzeCapacity() — the heart of the system */
export interface VacationCapacityAnalysis {
  workdays: number;
  teamAnalysis: TeamCapacityItem[];
  machineAnalysis: MachineCapacityItem[];
  blackoutConflicts: BlackoutConflict[];
  entitlementCheck: EntitlementCheckResult;
  substituteCheck?: SubstituteCheckResult;
  overallStatus: OverallCapacityStatus;
}

/** Team capacity for a specific date range */
export interface TeamCapacityItem {
  teamId: number;
  teamName: string;
  totalMembers: number;
  absentMembers: number;
  availableAfterApproval: number;
  status: CapacityStatus;
}

/** Machine capacity for a specific date range */
export interface MachineCapacityItem {
  machineId: number;
  machineName: string;
  minStaffRequired: number;
  currentlyAvailable: number;
  availableAfterApproval: number;
  absentMembers: AbsentMemberInfo[];
  status: CapacityStatus;
}

/** Info about an absent team member during a capacity check */
export interface AbsentMemberInfo {
  userId: number;
  userName: string;
  dates: string;
}

/** Blackout conflict found during capacity check */
export interface BlackoutConflict {
  blackoutId: string;
  name: string;
  startDate: string;
  endDate: string;
  scopeType: BlackoutScopeType;
}

/** Entitlement check result during capacity analysis */
export interface EntitlementCheckResult {
  sufficient: boolean;
  availableDays: number;
  requestedDays: number;
  remainingAfterApproval: number;
}

/** Substitute availability check result */
export interface SubstituteCheckResult {
  substituteId: number;
  substituteName: string;
  available: boolean;
  conflictDates?: string[];
}

// ============================================================================
// Approver Determination
// ============================================================================

/** Result of getApprover() */
export interface ApproverResult {
  approverId: number | null;
  autoApproved: boolean;
}

// ============================================================================
// Paginated Results
// ============================================================================

/** Generic paginated result wrapper */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================================
// Team Calendar
// ============================================================================

/** Team calendar data for a given month */
export interface TeamCalendarData {
  teamId: number;
  teamName: string;
  month: number;
  year: number;
  entries: TeamCalendarEntry[];
}

/** Single entry in the team calendar */
export interface TeamCalendarEntry {
  userId: number;
  userName: string;
  startDate: string;
  endDate: string;
  vacationType: VacationType;
  halfDayStart: VacationHalfDay;
  halfDayEnd: VacationHalfDay;
}
