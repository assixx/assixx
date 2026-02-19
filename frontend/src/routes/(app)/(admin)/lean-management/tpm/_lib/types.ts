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
