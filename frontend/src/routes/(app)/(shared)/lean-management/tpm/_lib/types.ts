// =============================================================================
// TPM Employee View — TYPE DEFINITIONS
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
export type CardCategory = 'reinigung' | 'wartung' | 'instandhaltung';

// =============================================================================
// DOMAIN ENTITIES
// =============================================================================

/** TPM Maintenance Plan (employee-relevant subset) */
export interface TpmPlan {
  uuid: string;
  machineId: number;
  machineName?: string;
  departmentName?: string;
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
  estimatedExecutionMinutes: number | null;
  cardCategories: CardCategory[];
  isActive: number;
  createdBy: number;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

/** TPM Location (structured location description per plan) */
export interface TpmLocation {
  uuid: string;
  planUuid?: string;
  positionNumber: number;
  title: string;
  description: string | null;
  photoPath: string | null;
  photoFileName: string | null;
  photoFileSize: number | null;
  photoMimeType: string | null;
  isActive: number;
  createdBy: number;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

/** Payload for creating a location */
export interface CreateLocationPayload {
  planUuid: string;
  positionNumber: number;
  title: string;
  description?: string | null;
}

/** Payload for updating a location */
export interface UpdateLocationPayload {
  positionNumber?: number;
  title?: string;
  description?: string | null;
}

/** TPM Color Configuration Entry */
export interface TpmColorConfigEntry {
  statusKey: CardStatus;
  colorHex: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// EXECUTION & APPROVAL TYPES (Kamishibai Board)
// =============================================================================

/** Lightweight employee for participant selection */
export interface TpmEmployee {
  id: number;
  uuid: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeNumber?: string;
  position?: string;
}

/** Approval status for card executions */
export type ApprovalStatus = 'none' | 'pending' | 'approved' | 'rejected';

/** Participant of a TPM execution */
export interface TpmExecutionParticipant {
  uuid: string;
  firstName: string;
  lastName: string;
}

/** Execution record for a card */
export interface TpmExecution {
  uuid: string;
  cardUuid?: string;
  executedBy: number;
  executedByName?: string;
  executionDate: string;
  documentation: string | null;
  noIssuesFound: boolean;
  actualDurationMinutes: number | null;
  actualStaffCount: number | null;
  approvalStatus: ApprovalStatus;
  approvedBy: number | null;
  approvedByName?: string;
  approvedAt: string | null;
  approvalNote: string | null;
  customData: Record<string, unknown>;
  photos?: TpmExecutionPhoto[];
  photoCount?: number;
  participants?: TpmExecutionParticipant[];
  defects?: TpmExecutionDefect[];
  defectCount?: number;
  createdAt: string;
  updatedAt: string;
}

/** Defect entry attached to an execution */
export interface TpmExecutionDefect {
  uuid: string;
  title: string;
  description: string | null;
  positionNumber: number;
  createdAt: string;
}

/** Defect with execution context (for Mängelliste page) */
export interface DefectWithContext {
  uuid: string;
  title: string;
  description: string | null;
  positionNumber: number;
  executionUuid: string;
  executionDate: string;
  executedByName: string | null;
  approvalStatus: ApprovalStatus;
  createdAt: string;
}

/** Defect entry payload for creating an execution */
export interface DefectPayload {
  title: string;
  description?: string | null;
}

/** Photo attached to an execution */
export interface TpmExecutionPhoto {
  uuid: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  sortOrder: number;
  createdAt: string;
}

/** Time estimate for an interval */
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

/** Payload for creating an execution */
export interface CreateExecutionPayload {
  cardUuid: string;
  executionDate?: string;
  noIssuesFound?: boolean;
  actualDurationMinutes?: number | null;
  actualStaffCount?: number | null;
  documentation?: string | null;
  customData?: Record<string, unknown>;
  participantUuids?: string[];
  defects?: DefectPayload[];
}

/** Payload for responding to an execution (approve/reject) */
export interface RespondExecutionPayload {
  action: 'approved' | 'rejected';
  approvalNote?: string | null;
}

// =============================================================================
// AGGREGATED TYPES (Employee Overview)
// =============================================================================

/** Status count summary for a machine's cards */
export interface StatusCounts {
  green: number;
  red: number;
  yellow: number;
  overdue: number;
  total: number;
}

/** Machine with TPM plan and card status summary */
export interface MachineWithTpmStatus {
  plan: TpmPlan;
  statusCounts: StatusCounts;
  cards: TpmCard[];
}

// =============================================================================
// SCHEDULE PROJECTION
// =============================================================================

/** A projected TPM maintenance slot (computed, not stored in DB) */
export interface ProjectedSlot {
  planUuid: string;
  planName: string;
  machineId: number;
  machineName: string;
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

/** TPM Interval Color Configuration Entry (interval type colors) */
export interface IntervalColorConfigEntry {
  statusKey: IntervalType;
  colorHex: string;
  label: string;
  includeInCard: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// SHIFT ASSIGNMENTS (Gesamtansicht — Zugewiesene Mitarbeiter)
// =============================================================================

/** Employee assigned to a TPM maintenance shift */
export interface TpmShiftAssignment {
  planUuid: string;
  machineId: number;
  shiftDate: string;
  userId: number;
  firstName: string;
  lastName: string;
  shiftType: string;
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
