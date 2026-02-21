// =============================================================================
// TPM (Total Productive Maintenance) - TYPE DEFINITIONS
// =============================================================================

/** Interval type for maintenance plans */
export type IntervalType =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'semi_annual'
  | 'annual'
  | 'long_runner'
  | 'custom';

/** Card status (Kamishibai board colors) */
export type CardStatus = 'green' | 'red' | 'yellow' | 'overdue';

/** Card role — who performs the task */
export type CardRole = 'operator' | 'maintenance';

/** Execution approval status */
export type ApprovalStatus = 'none' | 'pending' | 'approved' | 'rejected';

/** Status filter for plan list */
export type PlanStatusFilter = 'all' | 'active' | 'archived';

// =============================================================================
// DOMAIN ENTITIES
// =============================================================================

/** TPM Maintenance Plan */
export interface TpmPlan {
  uuid: string;
  machineId: number;
  machineName?: string;
  name: string;
  baseWeekday: number;
  baseRepeatEvery: number;
  baseTime: string | null;
  shiftPlanRequired: boolean;
  notes: string | null;
  createdBy: number;
  createdByName?: string;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

/** TPM Card (Kamishibai-Karte) */
export interface TpmCard {
  uuid: string;
  planUuid?: string;
  machineId: number;
  machineName?: string;
  templateUuid?: string | null;
  cardCode: string;
  cardRole: CardRole;
  intervalType: IntervalType;
  intervalOrder: number;
  title: string;
  description: string | null;
  locationDescription: string | null;
  locationPhotoUrl: string | null;
  requiresApproval: boolean;
  status: CardStatus;
  currentDueDate: string | null;
  lastCompletedAt: string | null;
  lastCompletedBy: number | null;
  lastCompletedByName?: string;
  sortOrder: number;
  customFields: Record<string, unknown>;
  customIntervalDays: number | null;
  weekdayOverride: number | null;
  isActive: number;
  createdBy: number;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

/** TPM Card Execution */
export interface TpmCardExecution {
  uuid: string;
  cardUuid?: string;
  executedBy: number;
  executedByName?: string;
  executionDate: string;
  documentation: string | null;
  approvalStatus: ApprovalStatus;
  approvedBy: number | null;
  approvedByName?: string;
  approvedAt: string | null;
  approvalNote: string | null;
  customData: Record<string, unknown>;
  photos?: TpmExecutionPhoto[];
  createdAt: string;
  updatedAt: string;
}

/** TPM Execution Photo */
export interface TpmExecutionPhoto {
  uuid: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  sortOrder: number;
  createdAt: string;
}

/** TPM Time Estimate per interval */
export interface TpmTimeEstimate {
  uuid: string;
  planId: number;
  intervalType: IntervalType;
  staffCount: number;
  preparationMinutes: number;
  executionMinutes: number;
  followupMinutes: number;
  totalMinutes: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

/** TPM Card Template */
export interface TpmCardTemplate {
  uuid: string;
  name: string;
  description: string | null;
  defaultFields: Record<string, unknown>;
  isDefault: boolean;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

/** TPM Color Configuration Entry */
export interface TpmColorConfigEntry {
  statusKey: CardStatus;
  colorHex: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

/** TPM Escalation Configuration */
export interface TpmEscalationConfig {
  escalationAfterHours: number;
  notifyTeamLead: boolean;
  notifyDepartmentLead: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// MACHINE (from /machines endpoint)
// =============================================================================

/** Machine entity (simplified for TPM dropdowns) */
export interface Machine {
  uuid: string;
  name: string;
  machineNumber: string | null;
  status: string;
  machineType: string | null;
  areaId?: number | null;
  departmentId?: number | null;
  departmentName?: string;
}

/** Area (Bereich) for cascade dropdown */
export interface TpmArea {
  id: number;
  name: string;
}

/** Department (Abteilung) for cascade dropdown */
export interface TpmDepartment {
  id: number;
  name: string;
  areaId?: number;
}

// =============================================================================
// SLOT ASSISTANT
// =============================================================================

/** Conflict type from slot assistant */
export type SlotConflictType =
  | 'no_shift_plan'
  | 'machine_downtime'
  | 'existing_tpm';

/** Single conflict description */
export interface SlotConflict {
  type: SlotConflictType;
  description: string;
}

/** Availability for a single day */
export interface DayAvailability {
  date: string;
  isAvailable: boolean;
  conflicts: SlotConflict[];
}

/** Full slot availability result */
export interface SlotAvailabilityResult {
  machineId: number;
  startDate: string;
  endDate: string;
  days: DayAvailability[];
  availableDays: number;
  totalDays: number;
}

/** Team member availability status */
export interface TeamMemberStatus {
  userId: number;
  userName: string;
  isAvailable: boolean;
  unavailabilityReason: string | null;
}

/** Team availability result */
export interface TeamAvailabilityResult {
  teamId: number;
  date: string;
  members: TeamMemberStatus[];
  availableCount: number;
  totalCount: number;
}

/** Team info from machine_teams */
export interface MachineTeamInfo {
  teamId: number;
  teamName: string;
}

/** Combined team availability for a machine (all assigned teams) */
export interface MachineTeamAvailabilityResult {
  machineId: number;
  date: string;
  teams: MachineTeamInfo[];
  members: TeamMemberStatus[];
  availableCount: number;
  totalCount: number;
}

// =============================================================================
// PAYLOADS (for create/update)
// =============================================================================

/** Payload for creating a maintenance plan */
export interface CreatePlanPayload {
  machineUuid: string;
  name: string;
  baseWeekday: number;
  baseRepeatEvery: number;
  baseTime: string | null;
  shiftPlanRequired: boolean;
  notes: string | null;
}

/** Payload for updating a maintenance plan */
export interface UpdatePlanPayload {
  name?: string;
  baseWeekday?: number;
  baseRepeatEvery?: number;
  baseTime?: string | null;
  shiftPlanRequired?: boolean;
  notes?: string | null;
}

/** Payload for setting a time estimate */
export interface CreateTimeEstimatePayload {
  planUuid: string;
  intervalType: IntervalType;
  staffCount: number;
  preparationMinutes: number;
  executionMinutes: number;
  followupMinutes: number;
}

/** Payload for creating a card */
export interface CreateCardPayload {
  planUuid: string;
  cardRole: CardRole;
  intervalType: IntervalType;
  title: string;
  description: string | null;
  locationDescription: string | null;
  requiresApproval: boolean;
  customIntervalDays: number | null;
  weekdayOverride: number | null;
}

/** Payload for updating a card */
export interface UpdateCardPayload {
  cardRole?: CardRole;
  intervalType?: IntervalType;
  title?: string;
  description?: string | null;
  locationDescription?: string | null;
  requiresApproval?: boolean;
  customIntervalDays?: number | null;
  weekdayOverride?: number | null;
}

/** Payload for checking card duplicates */
export interface CheckDuplicatePayload {
  planUuid: string;
  title: string;
  intervalType: IntervalType;
}

/** Result of duplicate check */
export interface DuplicateCheckResult {
  hasDuplicate: boolean;
  existingCards: TpmCard[];
}

// =============================================================================
// CONFIG PAYLOADS
// =============================================================================

/** Payload for updating a single color config entry */
export interface UpdateColorPayload {
  statusKey: CardStatus;
  colorHex: string;
  label: string;
}

/** Payload for updating escalation config */
export interface UpdateEscalationPayload {
  escalationAfterHours: number;
  notifyTeamLead?: boolean;
  notifyDepartmentLead?: boolean;
}

/** Payload for creating a card template */
export interface CreateTemplatePayload {
  name: string;
  description?: string | null;
  defaultFields?: Record<string, unknown>;
  isDefault?: boolean;
}

/** Payload for updating a card template */
export interface UpdateTemplatePayload {
  name?: string;
  description?: string | null;
  defaultFields?: Record<string, unknown>;
  isDefault?: boolean;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/** Paginated list response */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/** Generic API response wrapper */
export interface ApiResponse<T> {
  data?: T;
  success?: boolean;
}
