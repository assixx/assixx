/**
 * Work Orders Helpers — Pure functions for mapping
 *
 * Stateless helper functions. No DI, no DB calls, no side effects.
 * Maps DB Row types (snake_case) to API types (camelCase).
 */
import type {
  WorkOrder,
  WorkOrderAssignee,
  WorkOrderAssigneeWithNameRow,
  WorkOrderComment,
  WorkOrderCommentWithNameRow,
  WorkOrderListItem,
  WorkOrderPhoto,
  WorkOrderPhotoRow,
  WorkOrderStatus,
  WorkOrderWithCountsRow,
} from './work-orders.types.js';
import { VALID_STATUS_TRANSITIONS } from './work-orders.types.js';

/** Coerce a Date|string DB value to ISO string */
export function toIsoString(value: Date | string): string {
  return typeof value === 'string' ? value : new Date(value).toISOString();
}

/** Coerce a nullable Date|string DB value to ISO string or null */
export function toIsoStringOrNull(value: Date | string | null): string | null {
  return value === null ? null : toIsoString(value);
}

/** Map work order DB row (with JOINs) to full API response */
export function mapWorkOrderRowToApi(
  row: WorkOrderWithCountsRow,
  assignees: WorkOrderAssignee[] = [],
): WorkOrder {
  return {
    uuid: row.uuid.trim(),
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    sourceType: row.source_type,
    sourceUuid: row.source_uuid?.trim() ?? null,
    sourceTitle: null,
    dueDate: row.due_date,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    assignees,
    commentCount: Number(row.comment_count),
    photoCount: Number(row.photo_count),
    completedAt: toIsoStringOrNull(row.completed_at),
    verifiedAt: toIsoStringOrNull(row.verified_at),
    verifiedBy: row.verified_by,
    verifiedByName: null,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

/** Map work order DB row to lightweight list item */
export function mapWorkOrderRowToListItem(
  row: WorkOrderWithCountsRow,
): WorkOrderListItem {
  return {
    uuid: row.uuid.trim(),
    title: row.title,
    status: row.status,
    priority: row.priority,
    sourceType: row.source_type,
    dueDate: row.due_date,
    createdByName: row.created_by_name,
    assigneeCount: Number(row.assignee_count),
    assigneeNames: row.assignee_names ?? '',
    commentCount: Number(row.comment_count),
    photoCount: Number(row.photo_count),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

/** Map assignee DB row (with user name JOIN) to API response */
export function mapAssigneeRowToApi(
  row: WorkOrderAssigneeWithNameRow,
): WorkOrderAssignee {
  return {
    uuid: row.uuid.trim(),
    userId: row.user_id,
    userName: `${row.first_name} ${row.last_name}`.trim(),
    assignedAt: toIsoString(row.assigned_at),
  };
}

/** Map comment DB row (with user name JOIN) to API response */
export function mapCommentRowToApi(
  row: WorkOrderCommentWithNameRow,
): WorkOrderComment {
  return {
    uuid: row.uuid.trim(),
    userId: row.user_id,
    userName: `${row.first_name} ${row.last_name}`.trim(),
    content: row.content,
    isStatusChange: row.is_status_change,
    oldStatus: row.old_status,
    newStatus: row.new_status,
    createdAt: toIsoString(row.created_at),
  };
}

/** Map photo DB row to API response */
export function mapPhotoRowToApi(row: WorkOrderPhotoRow): WorkOrderPhoto {
  return {
    uuid: row.uuid.trim(),
    filePath: row.file_path,
    fileName: row.file_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    sortOrder: row.sort_order,
    createdAt: toIsoString(row.created_at),
  };
}

/** Validate whether a status transition is allowed */
export function isValidStatusTransition(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
): boolean {
  const allowed = VALID_STATUS_TRANSITIONS.get(from);
  if (allowed === undefined) return false;
  return allowed.includes(to);
}
