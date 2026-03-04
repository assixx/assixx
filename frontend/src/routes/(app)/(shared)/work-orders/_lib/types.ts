// =============================================================================
// Work Orders — TYPE DEFINITIONS
// =============================================================================

// =============================================================================
// ENUMS (mirror PostgreSQL ENUMs)
// =============================================================================

/** Work order status lifecycle: open → in_progress → completed → verified */
export type WorkOrderStatus = 'open' | 'in_progress' | 'completed' | 'verified';

/** Work order priority levels */
export type WorkOrderPriority = 'low' | 'medium' | 'high';

/** Source that triggered the work order creation */
export type WorkOrderSourceType = 'tpm_defect' | 'manual';

// =============================================================================
// DOMAIN ENTITIES
// =============================================================================

/** Employee assigned to a work order */
export interface WorkOrderAssignee {
  uuid: string;
  userId: number;
  userName: string;
  profilePicture: string | null;
  assignedAt: string;
}

/** Comment on a work order (manual or auto-generated on status change) */
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

/** Paginated comments with hasMore flag for lazy loading */
export interface PaginatedComments {
  comments: WorkOrderComment[];
  total: number;
  hasMore: boolean;
}

/** Photo attached to a work order */
export interface WorkOrderPhoto {
  uuid: string;
  uploadedBy: number;
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

// =============================================================================
// PAYLOADS (mutation request bodies)
// =============================================================================

/** Payload for POST /work-orders */
export interface CreateWorkOrderPayload {
  title: string;
  description?: string | null;
  priority?: WorkOrderPriority;
  sourceType?: WorkOrderSourceType;
  sourceUuid?: string | null;
  dueDate?: string | null;
  assigneeUuids?: string[];
}

/** Payload for PATCH /work-orders/:uuid */
export interface UpdateWorkOrderPayload {
  title?: string;
  description?: string | null;
  priority?: WorkOrderPriority;
  dueDate?: string | null;
}

/** Payload for PATCH /work-orders/:uuid/status */
export interface UpdateStatusPayload {
  status: WorkOrderStatus;
}

/** Payload for POST /work-orders/:uuid/assignees */
export interface AssignUsersPayload {
  userUuids: string[];
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/** Paginated list response */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
