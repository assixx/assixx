/**
 * TPM Module Types
 *
 * All interfaces and DB row types for the Total Productive Maintenance system.
 * Maps directly to the 8 tpm_* tables created in Migrations 041-044.
 *
 * Structure:
 *   1. Enums (mirror PostgreSQL ENUMs)
 *   2. DB Row Types (1:1 mapping to table columns, snake_case)
 *   3. Application Types (API responses, camelCase)
 *   4. Interval Utilities
 */

// ============================================================================
// Enums (mirror PostgreSQL ENUMs from migration 041)
// ============================================================================

export type TpmIntervalType =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'semi_annual'
  | 'annual'
  | 'custom';

export type TpmCardStatus = 'green' | 'red' | 'yellow' | 'overdue';

export type TpmCardRole = 'operator' | 'maintenance';

export type TpmCardCategory = 'reinigung' | 'wartung' | 'inspektion';

export type TpmApprovalStatus = 'none' | 'pending' | 'approved' | 'rejected';

// ============================================================================
// DB Row Types (1:1 mapping to table columns)
// ============================================================================

/** Row type for `tpm_maintenance_plans` table (migration 041) */
export interface TpmMaintenancePlanRow {
  id: number;
  uuid: string;
  tenant_id: number;
  machine_id: number;
  name: string;
  base_weekday: number;
  base_repeat_every: number;
  base_time: string | null;
  buffer_hours: string; // NUMERIC(4,1) → pg returns string
  shift_plan_required: boolean;
  notes: string | null;
  created_by: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

/** Row type for `tpm_time_estimates` table (migration 041) */
export interface TpmTimeEstimateRow {
  id: number;
  uuid: string;
  tenant_id: number;
  plan_id: number;
  interval_type: TpmIntervalType;
  staff_count: number;
  preparation_minutes: number;
  execution_minutes: number;
  followup_minutes: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

/** Row type for `tpm_card_templates` table (migration 042) */
export interface TpmCardTemplateRow {
  id: number;
  uuid: string;
  tenant_id: number;
  name: string;
  description: string | null;
  default_fields: Record<string, unknown>;
  is_default: boolean;
  is_active: number;
  created_at: string;
  updated_at: string;
}

/** Row type for `tpm_cards` table (migration 042) */
export interface TpmCardRow {
  id: number;
  uuid: string;
  tenant_id: number;
  plan_id: number;
  machine_id: number;
  template_id: number | null;
  card_code: string;
  card_role: TpmCardRole;
  interval_type: TpmIntervalType;
  interval_order: number;
  title: string;
  description: string | null;
  location_description: string | null;
  location_photo_url: string | null;
  requires_approval: boolean;
  status: TpmCardStatus;
  current_due_date: string | null;
  last_completed_at: string | null;
  last_completed_by: number | null;
  sort_order: number;
  custom_fields: Record<string, unknown>;
  custom_interval_days: number | null;
  weekday_override: number | null;
  estimated_execution_minutes: number | null;
  card_categories: TpmCardCategory[];
  is_active: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

/** Row type for `tpm_card_executions` table (migration 043 + 048) */
export interface TpmCardExecutionRow {
  id: number;
  uuid: string;
  tenant_id: number;
  card_id: number;
  executed_by: number;
  execution_date: string;
  documentation: string | null;
  approval_status: TpmApprovalStatus;
  approved_by: number | null;
  approved_at: string | null;
  approval_note: string | null;
  custom_data: Record<string, unknown>;
  no_issues_found: boolean;
  actual_duration_minutes: number | null;
  actual_staff_count: number | null;
  created_at: string;
  updated_at: string;
}

/** Row type for `tpm_card_execution_photos` table (migration 043) — immutable, no updated_at */
export interface TpmCardExecutionPhotoRow {
  id: number;
  uuid: string;
  tenant_id: number;
  execution_id: number;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  sort_order: number;
  created_at: string;
}

/** Row type for `tpm_execution_participants` table (migration 055) */
export interface TpmExecutionParticipantRow {
  id: number;
  uuid: string;
  tenant_id: number;
  execution_id: number;
  user_id: number;
  created_at: string;
}

/** Row type for `tpm_scheduled_dates` table (migration 046) — year-ahead dates per card */
export interface TpmScheduledDateRow {
  id: number;
  tenant_id: number;
  card_id: number;
  scheduled_date: string;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
}

/** Row type for `tpm_locations` table (migration 054) — structured location per plan */
export interface TpmLocationRow {
  id: number;
  uuid: string;
  tenant_id: number;
  plan_id: number;
  position_number: number;
  title: string;
  description: string | null;
  photo_path: string | null;
  photo_file_name: string | null;
  photo_file_size: number | null;
  photo_mime_type: string | null;
  is_active: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

/** Row type for `tpm_execution_defects` table (migration 061) */
export interface TpmExecutionDefectRow {
  id: number;
  uuid: string;
  tenant_id: number;
  execution_id: number;
  title: string;
  description: string | null;
  position_number: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

/** Row type for `tpm_escalation_config` table (migration 044) — 1 row per tenant, no uuid */
export interface TpmEscalationConfigRow {
  id: number;
  tenant_id: number;
  escalation_after_hours: number;
  notify_team_lead: boolean;
  notify_department_lead: boolean;
  created_at: string;
  updated_at: string;
}

/** Row type for `tpm_color_config` table (migration 044, 060) — per status per tenant, no uuid */
export interface TpmColorConfigRow {
  id: number;
  tenant_id: number;
  status_key: string;
  color_hex: string;
  label: string;
  include_in_card: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Application Types (used in service layer and API responses)
// ============================================================================

/** Maintenance plan as returned by the API */
export interface TpmPlan {
  uuid: string;
  machineId: number;
  machineUuid?: string;
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

/** Time estimate as returned by the API */
export interface TpmTimeEstimate {
  uuid: string;
  planId: number;
  intervalType: TpmIntervalType;
  staffCount: number;
  preparationMinutes: number;
  executionMinutes: number;
  followupMinutes: number;
  totalMinutes: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

/** Card template as returned by the API */
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

/** Card as returned by the API */
export interface TpmCard {
  uuid: string;
  planUuid?: string;
  machineId: number;
  machineName?: string;
  templateUuid?: string | null;
  cardCode: string;
  cardRole: TpmCardRole;
  intervalType: TpmIntervalType;
  intervalOrder: number;
  title: string;
  description: string | null;
  locationDescription: string | null;
  locationPhotoUrl: string | null;
  requiresApproval: boolean;
  status: TpmCardStatus;
  currentDueDate: string | null;
  lastCompletedAt: string | null;
  lastCompletedBy: number | null;
  lastCompletedByName?: string;
  sortOrder: number;
  customFields: Record<string, unknown>;
  customIntervalDays: number | null;
  weekdayOverride: number | null;
  estimatedExecutionMinutes: number | null;
  cardCategories: TpmCardCategory[];
  isActive: number;
  createdBy: number;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

/** Location as returned by the API */
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

/** Participant of a TPM execution (API response) */
export interface TpmExecutionParticipant {
  uuid: string;
  firstName: string;
  lastName: string;
}

/** Defect entry as returned by the API */
export interface TpmExecutionDefect {
  uuid: string;
  title: string;
  description: string | null;
  positionNumber: number;
  createdAt: string;
}

/** Execution record as returned by the API */
export interface TpmCardExecution {
  uuid: string;
  cardUuid?: string;
  executedBy: number;
  executedByName?: string;
  executionDate: string;
  documentation: string | null;
  noIssuesFound: boolean;
  actualDurationMinutes: number | null;
  actualStaffCount: number | null;
  approvalStatus: TpmApprovalStatus;
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

/** Execution photo as returned by the API */
export interface TpmExecutionPhoto {
  uuid: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  sortOrder: number;
  createdAt: string;
}

/** Escalation config as returned by the API */
export interface TpmEscalationConfig {
  escalationAfterHours: number;
  notifyTeamLead: boolean;
  notifyDepartmentLead: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Color config entry as returned by the API */
export interface TpmColorConfigEntry {
  statusKey: string;
  colorHex: string;
  label: string;
  includeInCard: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Schedule Projection Types (cross-plan conflict detection)
// ============================================================================

/** A projected TPM maintenance slot (computed, not stored in DB) */
export interface ProjectedSlot {
  planUuid: string;
  planName: string;
  machineId: number;
  machineName: string;
  intervalTypes: TpmIntervalType[];
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

// ============================================================================
// Interval Utilities
// ============================================================================

/**
 * Maps interval types to their cascade order.
 * Lower number = shorter interval = cascaded first.
 * Used by tpm-card-cascade.service.ts for batch updates.
 */
export const INTERVAL_ORDER_MAP: Record<TpmIntervalType, number> = {
  daily: 1,
  weekly: 2,
  monthly: 3,
  quarterly: 4,
  semi_annual: 5,
  annual: 6,
  custom: 7,
} as const;

/**
 * All interval types in cascade order (ascending).
 * Useful for iteration and display.
 */
export const INTERVAL_TYPES_ORDERED: readonly TpmIntervalType[] = [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'semi_annual',
  'annual',
  'custom',
] as const;

/** German labels for interval types (used in API responses and frontend) */
export const INTERVAL_LABELS: Record<TpmIntervalType, string> = {
  daily: 'Täglich',
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  quarterly: 'Vierteljährlich',
  semi_annual: 'Halbjährlich',
  annual: 'Jährlich',
  custom: 'Benutzerdefiniert',
} as const;

/** German labels for card status (used in API responses and frontend) */
export const STATUS_LABELS: Record<TpmCardStatus, string> = {
  green: 'Erledigt',
  red: 'Fällig',
  yellow: 'Freigabe ausstehend',
  overdue: 'Überfällig',
} as const;

/** German labels for card roles */
export const ROLE_LABELS: Record<TpmCardRole, string> = {
  operator: 'Bediener',
  maintenance: 'Instandhaltung',
} as const;

/** German labels for card categories */
export const CATEGORY_LABELS: Record<TpmCardCategory, string> = {
  reinigung: 'Reinigung',
  wartung: 'Wartung',
  inspektion: 'Inspektion',
} as const;

/** Ordered category keys for consistent iteration */
export const CATEGORY_KEYS_ORDERED: readonly TpmCardCategory[] = [
  'reinigung',
  'wartung',
  'inspektion',
] as const;

/** Category color config entry — colorHex is null when no custom color is set */
export interface TpmCategoryColorConfigEntry {
  categoryKey: TpmCardCategory;
  colorHex: string | null;
  label: string;
  createdAt: string;
  updatedAt: string;
}

/** Card code prefixes per role */
export const CARD_CODE_PREFIX: Record<TpmCardRole, string> = {
  operator: 'BT',
  maintenance: 'IV',
} as const;

/** Default color configuration per card status */
export const DEFAULT_COLORS: Record<
  TpmCardStatus,
  { hex: string; label: string }
> = {
  green: { hex: '#22c55e', label: 'Erledigt' },
  red: { hex: '#ef4444', label: 'Fällig' },
  yellow: { hex: '#eab308', label: 'Freigabe ausstehend' },
  overdue: { hex: '#dc2626', label: 'Überfällig' },
} as const;

/** Default color configuration per interval type (calendar badges) */
export const DEFAULT_INTERVAL_COLORS: Record<
  TpmIntervalType,
  { hex: string; label: string }
> = {
  daily: { hex: '#4CAF50', label: 'Täglich' },
  weekly: { hex: '#8BC34A', label: 'Wöchentlich' },
  monthly: { hex: '#5bb5f5', label: 'Monatlich' },
  quarterly: { hex: '#b0b0b0', label: 'Vierteljährlich' },
  semi_annual: { hex: '#f5a0a0', label: 'Halbjährlich' },
  annual: { hex: '#c8b88a', label: 'Jährlich' },
  custom: { hex: '#FF9800', label: 'Benutzerdefiniert' },
} as const;

/** Employee eligible as execution participant (API response shape) */
export interface EligibleParticipant {
  id: number;
  uuid: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeNumber: string | null;
  position: string | null;
}

/** Row type for `tpm_defect_photos` table (migration 063) — immutable, no updated_at */
export interface TpmDefectPhotoRow {
  id: number;
  uuid: string;
  tenant_id: number;
  defect_id: number;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  sort_order: number;
  created_at: string;
}

/** Defect photo as returned by the API */
export interface TpmDefectPhoto {
  uuid: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  sortOrder: number;
  createdAt: string;
}

/** Max photos per execution (enforced in service layer) */
export const MAX_PHOTOS_PER_EXECUTION = 5;

/** Max photos per defect (enforced in service layer) */
export const MAX_PHOTOS_PER_DEFECT = 5;

/** Max photo file size in bytes (5MB, enforced in DB + service) */
export const MAX_PHOTO_FILE_SIZE = 5_242_880;
