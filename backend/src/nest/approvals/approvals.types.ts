/**
 * Approvals — Type Definitions
 * @module approvals/approvals.types
 *
 * DB row types (snake_case) and API response types (camelCase).
 * ENUMs match PostgreSQL types: approval_status, approval_approver_type, approval_priority.
 */

// =============================================================================
// ENUMS
// =============================================================================

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type ApprovalPriority = 'low' | 'medium' | 'high';

export type ApprovalApproverType =
  | 'user'
  | 'team_lead'
  | 'area_lead'
  | 'department_lead'
  | 'position';

// =============================================================================
// CONSTANTS
// =============================================================================

export const STATUS_LABELS: Readonly<Record<ApprovalStatus, string>> = {
  pending: 'Offen',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
};

export const PRIORITY_LABELS: Readonly<Record<ApprovalPriority, string>> = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
};

export const APPROVER_TYPE_LABELS: Readonly<Record<ApprovalApproverType, string>> = {
  user: 'Benutzer',
  team_lead: 'Team Lead',
  area_lead: 'Bereichsleiter',
  department_lead: 'Abteilungsleiter',
  position: 'Position',
};

// =============================================================================
// DB ROW TYPES (snake_case — 1:1 with PostgreSQL tables)
// =============================================================================

export interface ApprovalConfigRow {
  id: number;
  uuid: string;
  tenant_id: number;
  addon_code: string;
  approver_type: ApprovalApproverType;
  approver_user_id: number | null;
  approver_position_id: string | null;
  scope_area_ids: number[] | null;
  scope_department_ids: number[] | null;
  scope_team_ids: number[] | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ApprovalRow {
  id: number;
  uuid: string;
  tenant_id: number;
  addon_code: string;
  source_entity_type: string;
  source_uuid: string;
  title: string;
  description: string | null;
  requested_by: number;
  assigned_to: number | null;
  status: ApprovalStatus;
  priority: ApprovalPriority;
  decided_by: number | null;
  decided_at: string | null;
  decision_note: string | null;
  reward_amount: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

/** Extended row with JOINed user names + read-tracking */
export interface ApprovalListRow extends ApprovalRow {
  requested_by_name: string;
  decided_by_name: string | null;
  assigned_to_name: string | null;
  read_at?: string | null;
}

// =============================================================================
// API RESPONSE TYPES (camelCase)
// =============================================================================

export interface ApprovalConfig {
  uuid: string;
  addonCode: string;
  approverType: ApprovalApproverType;
  approverUserId: number | null;
  approverUserName: string | null;
  approverPositionId: string | null;
  approverPositionName: string | null;
  scopeAreaIds: number[] | null;
  scopeDepartmentIds: number[] | null;
  scopeTeamIds: number[] | null;
  createdAt: string;
}

export interface Approval {
  uuid: string;
  addonCode: string;
  sourceEntityType: string;
  sourceUuid: string;
  title: string;
  description: string | null;
  requestedBy: number;
  requestedByName: string;
  assignedTo: number | null;
  assignedToName: string | null;
  status: ApprovalStatus;
  priority: ApprovalPriority;
  decidedBy: number | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  rewardAmount: number | null;
  isRead: boolean;
  createdAt: string;
}

export interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

// =============================================================================
// MAPPERS
// =============================================================================

export function mapConfigRowToApi(
  row: ApprovalConfigRow & {
    approver_user_name?: string | null;
    approver_position_name?: string | null;
  },
): ApprovalConfig {
  return {
    uuid: row.uuid.trim(),
    addonCode: row.addon_code,
    approverType: row.approver_type,
    approverUserId: row.approver_user_id,
    approverUserName: row.approver_user_name ?? null,
    approverPositionId: row.approver_position_id,
    approverPositionName: row.approver_position_name ?? null,
    scopeAreaIds: row.scope_area_ids ?? null,
    scopeDepartmentIds: row.scope_department_ids ?? null,
    scopeTeamIds: row.scope_team_ids ?? null,
    createdAt: row.created_at,
  };
}

export function mapApprovalRowToApi(row: ApprovalListRow): Approval {
  return {
    uuid: row.uuid.trim(),
    addonCode: row.addon_code,
    sourceEntityType: row.source_entity_type,
    sourceUuid: row.source_uuid.trim(),
    title: row.title,
    description: row.description,
    requestedBy: row.requested_by,
    requestedByName: row.requested_by_name,
    assignedTo: row.assigned_to,
    assignedToName: row.assigned_to_name ?? null,
    status: row.status,
    priority: row.priority,
    decidedBy: row.decided_by,
    decidedByName: row.decided_by_name ?? null,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    rewardAmount: row.reward_amount !== null ? Number(row.reward_amount) : null,
    isRead: row.read_at !== undefined && row.read_at !== null,
    createdAt: row.created_at,
  };
}
