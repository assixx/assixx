/**
 * Work Orders — Type Definitions
 *
 * DB Row types (snake_case, 1:1 with tables), API types (camelCase),
 * enums mirroring PostgreSQL, constants, and status transition matrix.
 */

// ============================================================================
// Enums (mirror PostgreSQL ENUMs from migration 064)
// ============================================================================

export type WorkOrderStatus = 'open' | 'in_progress' | 'completed' | 'verified';

export type WorkOrderPriority = 'low' | 'medium' | 'high';

export type WorkOrderSourceType = 'tpm_defect' | 'manual';

// ============================================================================
// Constants
// ============================================================================

export const MAX_PHOTOS_PER_WORK_ORDER = 10;
export const MAX_PHOTO_FILE_SIZE = 5_242_880; // 5 MB
export const MAX_ASSIGNEES_PER_WORK_ORDER = 10;
export const WORK_ORDER_UPLOAD_DIR = 'uploads/work-orders';

/** German labels for status display */
export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  completed: 'Abgeschlossen',
  verified: 'Verifiziert',
};

/** German labels for priority display */
export const PRIORITY_LABELS: Record<WorkOrderPriority, string> = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
};

/** German labels for source type display */
export const SOURCE_TYPE_LABELS: Record<WorkOrderSourceType, string> = {
  tpm_defect: 'TPM-Mangel',
  manual: 'Manuell',
};

// ============================================================================
// Status Transition Matrix
// ============================================================================

/**
 * Defines valid status transitions.
 *
 * open → in_progress     (Employee: Arbeit begonnen)
 * open → completed       (Employee: Sofort erledigt)
 * in_progress → completed (Employee: Arbeit fertig)
 * completed → verified    (Admin: Verifiziert)
 * completed → in_progress (Admin: Zurück an Employee — nicht akzeptiert)
 * verified → completed    (Admin: Verifikation zurücknehmen)
 */
export const VALID_STATUS_TRANSITIONS: ReadonlyMap<
  WorkOrderStatus,
  readonly WorkOrderStatus[]
> = new Map([
  ['open', ['in_progress', 'completed']],
  ['in_progress', ['completed']],
  ['completed', ['verified', 'in_progress']],
  ['verified', ['completed']],
]);

// ============================================================================
// DB Row Types (snake_case — 1:1 with database columns)
// ============================================================================

export interface WorkOrderRow {
  id: number;
  uuid: string;
  tenant_id: number;
  title: string;
  description: string | null;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  source_type: WorkOrderSourceType;
  source_uuid: string | null;
  due_date: string | null;
  created_by: number;
  completed_at: string | null;
  verified_at: string | null;
  verified_by: number | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderAssigneeRow {
  id: number;
  uuid: string;
  tenant_id: number;
  work_order_id: number;
  user_id: number;
  assigned_at: string;
  assigned_by: number;
}

export interface WorkOrderCommentRow {
  id: number;
  uuid: string;
  tenant_id: number;
  work_order_id: number;
  user_id: number;
  content: string;
  is_status_change: boolean;
  old_status: WorkOrderStatus | null;
  new_status: WorkOrderStatus | null;
  parent_id: number | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderPhotoRow {
  id: number;
  uuid: string;
  tenant_id: number;
  work_order_id: number;
  uploaded_by: number;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  sort_order: number;
  created_at: string;
}

// ============================================================================
// API Types (camelCase — response shapes)
// ============================================================================

export interface WorkOrderAssignee {
  uuid: string;
  userId: number;
  userName: string;
  profilePicture: string | null;
  assignedAt: string;
}

export interface WorkOrderComment {
  id: number;
  uuid: string;
  userId: number;
  firstName: string;
  lastName: string;
  profilePicture: string | null;
  content: string;
  isStatusChange: boolean;
  oldStatus: WorkOrderStatus | null;
  newStatus: WorkOrderStatus | null;
  parentId: number | null;
  replyCount: number;
  createdAt: string;
}

export interface WorkOrderPhoto {
  uuid: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  sortOrder: number;
  createdAt: string;
}

/** Full work order with enriched data (detail view) */
export interface WorkOrder {
  uuid: string;
  title: string;
  description: string | null;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  sourceType: WorkOrderSourceType;
  sourceUuid: string | null;
  sourceTitle: string | null;
  dueDate: string | null;
  createdBy: number;
  createdByName: string;
  assignees: WorkOrderAssignee[];
  commentCount: number;
  photoCount: number;
  completedAt: string | null;
  verifiedAt: string | null;
  verifiedBy: number | null;
  verifiedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Lightweight work order for list views (no nested arrays) */
export interface WorkOrderListItem {
  uuid: string;
  title: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  sourceType: WorkOrderSourceType;
  dueDate: string | null;
  createdByName: string;
  assigneeCount: number;
  assigneeNames: string;
  commentCount: number;
  photoCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Eligible user for assignment dropdown */
export interface EligibleUser {
  id: number;
  uuid: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeNumber: string | null;
}

/** Stats per status for dashboard counters */
export interface WorkOrderStats {
  open: number;
  inProgress: number;
  completed: number;
  verified: number;
  total: number;
  overdue: number;
}

// ============================================================================
// Extended DB Row types (JOIN results — services use these internally)
// ============================================================================

export interface WorkOrderWithCountsRow extends WorkOrderRow {
  created_by_name: string;
  /** COUNT returns string via pg driver */
  assignee_count: string;
  /** STRING_AGG can be null when no assignees */
  assignee_names: string | null;
  /** COUNT returns string via pg driver */
  comment_count: string;
  /** COUNT returns string via pg driver */
  photo_count: string;
}

export interface WorkOrderAssigneeWithNameRow extends WorkOrderAssigneeRow {
  first_name: string;
  last_name: string;
  profile_picture: string | null;
}

export interface WorkOrderCommentWithNameRow extends WorkOrderCommentRow {
  first_name: string;
  last_name: string;
  profile_picture: string | null;
  reply_count: string;
}
