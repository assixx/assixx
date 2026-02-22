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
  | 'long_runner'
  | 'custom';

/** Card status (Kamishibai board colors) */
export type CardStatus = 'green' | 'red' | 'yellow' | 'overdue';

/** Card role — who performs the task */
export type CardRole = 'operator' | 'maintenance';

// =============================================================================
// DOMAIN ENTITIES
// =============================================================================

/** TPM Maintenance Plan (employee-relevant subset) */
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
  isActive: number;
  createdBy: number;
  createdByName?: string;
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

// =============================================================================
// EXECUTION & APPROVAL TYPES (Kamishibai Board)
// =============================================================================

/** Approval status for card executions */
export type ApprovalStatus = 'none' | 'pending' | 'approved' | 'rejected';

/** Execution record for a card */
export interface TpmExecution {
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
  photoCount?: number;
  createdAt: string;
  updatedAt: string;
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
  documentation?: string | null;
  customData?: Record<string, unknown>;
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
// API RESPONSE TYPES
// =============================================================================

/** Paginated list response */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
