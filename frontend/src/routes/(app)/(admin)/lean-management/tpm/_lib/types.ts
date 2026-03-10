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
  | 'custom';

/** Card status (Kamishibai board colors) */
export type CardStatus = 'green' | 'red' | 'yellow' | 'overdue';

/** Card role — who performs the task */
export type CardRole = 'operator' | 'maintenance';

/** Card category — what type of maintenance activity */
export type CardCategory = 'reinigung' | 'wartung' | 'inspektion';

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
  assetId: number;
  assetUuid?: string;
  assetName?: string;
  name: string;
  baseWeekday: number;
  baseRepeatEvery: number;
  baseTime: string | null;
  bufferHours: number;
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
  assetId: number;
  assetName?: string;
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
  estimatedExecutionMinutes: number | null;
  cardCategories: CardCategory[];
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

/** TPM Color Configuration Entry (card status colors) */
export interface TpmColorConfigEntry {
  statusKey: CardStatus;
  colorHex: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

/** TPM Interval Color Configuration Entry (interval type colors) */
export interface IntervalColorConfigEntry {
  statusKey: IntervalType;
  colorHex: string;
  label: string;
  includeInCard: boolean;
  createdAt: string;
  updatedAt: string;
}

/** TPM Category Color Configuration Entry — colorHex is null when no custom color */
export interface CategoryColorConfigEntry {
  categoryKey: CardCategory;
  colorHex: string | null;
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
// MACHINE (from /assets endpoint)
// =============================================================================

/** Asset entity (simplified for TPM dropdowns) */
export interface Asset {
  uuid: string;
  name: string;
  assetNumber: string | null;
  status: string;
  assetType: string | null;
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
  | 'existing_tpm'
  | 'tpm_schedule';

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
  assetId: number;
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
  firstName: string | null;
  lastName: string | null;
  profilePicture: string | null;
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

/** Team info from asset_teams */
export interface AssetTeamInfo {
  teamId: number;
  teamName: string;
}

/** Combined team availability for a asset (all assigned teams) */
export interface AssetTeamAvailabilityResult {
  assetId: number;
  date: string;
  teams: AssetTeamInfo[];
  members: TeamMemberStatus[];
  availableCount: number;
  totalCount: number;
}

// =============================================================================
// PAYLOADS (for create/update)
// =============================================================================

/** Payload for creating a maintenance plan */
export interface CreatePlanPayload {
  assetUuid: string;
  name: string;
  baseWeekday: number;
  baseRepeatEvery: number;
  baseTime: string | null;
  bufferHours: number;
  shiftPlanRequired: boolean;
  notes: string | null;
}

/** Payload for updating a maintenance plan */
export interface UpdatePlanPayload {
  name?: string;
  baseWeekday?: number;
  baseRepeatEvery?: number;
  baseTime?: string | null;
  bufferHours?: number;
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

/** Optional time estimate fields for card creation/edit */
export interface TimeEstimateInput {
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
  estimatedExecutionMinutes?: number | null;
  cardCategories: CardCategory[];
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
  estimatedExecutionMinutes?: number | null;
  cardCategories?: CardCategory[];
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

/** Payload for updating a single card status color config entry */
export interface UpdateColorPayload {
  statusKey: CardStatus;
  colorHex: string;
  label: string;
}

/** Payload for updating a single interval color config entry */
export interface UpdateIntervalColorPayload {
  intervalKey: IntervalType;
  colorHex: string;
  label: string;
  includeInCard?: boolean;
}

/** Payload for updating a single category color config entry */
export interface UpdateCategoryColorPayload {
  categoryKey: CardCategory;
  colorHex: string;
  label: string;
}

/** Payload for updating escalation config */
export interface UpdateEscalationPayload {
  escalationAfterHours: number;
  notifyTeamLead?: boolean;
  notifyDepartmentLead?: boolean;
}

// =============================================================================
// SCHEDULE PROJECTION
// =============================================================================

/** A projected TPM maintenance slot (computed, not stored in DB) */
export interface ProjectedSlot {
  planUuid: string;
  planName: string;
  assetId: number;
  assetName: string;
  intervalTypes: IntervalType[];
  date: string;
  startTime: string | null;
  endTime: string | null;
  bufferHours: number;
  isFullDay: boolean;
}

/** Result of a schedule projection across all active plans */
export interface ScheduleProjectionResult {
  slots: ProjectedSlot[];
  dateRange: { start: string; end: string };
  planCount: number;
}

// =============================================================================
// INTERVAL MATRIX
// =============================================================================

/** Single entry in the interval matrix: one plan × one interval type */
export interface IntervalMatrixEntry {
  planUuid: string;
  intervalType: IntervalType;
  cardCount: number;
  greenCount: number;
  redCount: number;
  yellowCount: number;
  overdueCount: number;
}

// =============================================================================
// PLAN ASSIGNMENTS
// =============================================================================

/** A single TPM plan assignment (employee to plan on specific date) */
export interface TpmPlanAssignment {
  uuid: string;
  userId: number;
  firstName: string;
  lastName: string;
  userName: string;
  scheduledDate: string;
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
