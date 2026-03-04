// =============================================================================
// Work Orders — API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';

import type {
  AssignUsersPayload,
  CreateCommentPayload,
  CreateWorkOrderPayload,
  EligibleUser,
  PaginatedResponse,
  UpdateStatusPayload,
  UpdateWorkOrderPayload,
  WorkOrder,
  WorkOrderAssignee,
  WorkOrderComment,
  WorkOrderListItem,
  WorkOrderPhoto,
  WorkOrderStats,
} from './types';

const log = createLogger('WorkOrdersApi');
const apiClient = getApiClient();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const EMPTY_PAGE: PaginatedResponse<never> = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
};

function numberOr(val: unknown, fallback: number): number {
  return typeof val === 'number' ? val : fallback;
}

/** Type-safe extraction of paginated data from API response */
function extractPaginated<T>(result: unknown): PaginatedResponse<T> {
  if (result === null || typeof result !== 'object') return EMPTY_PAGE;
  const obj = result as Record<string, unknown>;
  const items =
    Array.isArray(obj.data) ? (obj.data as T[])
    : Array.isArray(obj.items) ? (obj.items as T[])
    : [];
  return {
    items,
    total: numberOr(obj.total, 0),
    page: numberOr(obj.page, 1),
    pageSize: numberOr(obj.pageSize ?? obj.limit, 20),
  };
}

/** Type-safe extraction of array data from API response */
function extractArray<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result !== null && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

// =============================================================================
// CORE CRUD
// =============================================================================

/** Create a new work order */
export async function createWorkOrder(
  payload: CreateWorkOrderPayload,
): Promise<WorkOrder> {
  return await apiClient.post<WorkOrder>('/work-orders', payload);
}

/** Fetch a single work order by UUID (full detail with assignees) */
export async function fetchWorkOrder(uuid: string): Promise<WorkOrder> {
  return await apiClient.get<WorkOrder>(`/work-orders/${uuid}`);
}

/** Append non-empty filter values to URLSearchParams */
function applyFilters(
  params: URLSearchParams,
  filters: Record<string, string | undefined>,
): void {
  for (const [key, val] of Object.entries(filters)) {
    if (val !== undefined && val !== '') {
      params.set(key, val);
    }
  }
}

/** Fetch paginated list of all work orders (admin view) */
export async function fetchWorkOrders(
  page = 1,
  limit = 20,
  filters: {
    status?: string;
    priority?: string;
    sourceType?: string;
    assigneeUuid?: string;
  } = {},
): Promise<PaginatedResponse<WorkOrderListItem>> {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  applyFilters(params, filters);

  const result: unknown = await apiClient.get(
    `/work-orders?${params.toString()}`,
  );
  return extractPaginated<WorkOrderListItem>(result);
}

/** Fetch paginated list of work orders assigned to current user */
export async function fetchMyWorkOrders(
  page = 1,
  limit = 20,
  filters: {
    status?: string;
    priority?: string;
  } = {},
): Promise<PaginatedResponse<WorkOrderListItem>> {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  applyFilters(params, filters);

  const result: unknown = await apiClient.get(
    `/work-orders/my?${params.toString()}`,
  );
  return extractPaginated<WorkOrderListItem>(result);
}

/** Update a work order (admin only) */
export async function updateWorkOrder(
  uuid: string,
  payload: UpdateWorkOrderPayload,
): Promise<WorkOrder> {
  return await apiClient.patch<WorkOrder>(`/work-orders/${uuid}`, payload);
}

/** Soft-delete a work order (admin only) */
export async function deleteWorkOrder(uuid: string): Promise<void> {
  await apiClient.delete(`/work-orders/${uuid}`);
}

// =============================================================================
// STATUS
// =============================================================================

/** Update work order status (employee + admin) */
export async function updateStatus(
  uuid: string,
  payload: UpdateStatusPayload,
): Promise<void> {
  await apiClient.patch(`/work-orders/${uuid}/status`, payload);
}

// =============================================================================
// ASSIGNEES
// =============================================================================

/** Assign users to a work order (admin only) */
export async function assignUsers(
  uuid: string,
  payload: AssignUsersPayload,
): Promise<WorkOrderAssignee[]> {
  return await apiClient.post<WorkOrderAssignee[]>(
    `/work-orders/${uuid}/assignees`,
    payload,
  );
}

/** Remove an assignee from a work order (admin only) */
export async function removeAssignee(
  uuid: string,
  userUuid: string,
): Promise<void> {
  await apiClient.delete(`/work-orders/${uuid}/assignees/${userUuid}`);
}

/** Fetch eligible users for assignment (team-filtered if machineId given) */
export async function fetchEligibleUsers(
  machineId?: number,
): Promise<EligibleUser[]> {
  const url =
    machineId !== undefined ?
      `/work-orders/eligible-users?machineId=${machineId}`
    : '/work-orders/eligible-users';
  const result: unknown = await apiClient.get(url);
  return extractArray<EligibleUser>(result);
}

// =============================================================================
// COMMENTS
// =============================================================================

/** Add a comment to a work order */
export async function addComment(
  uuid: string,
  payload: CreateCommentPayload,
): Promise<WorkOrderComment> {
  return await apiClient.post<WorkOrderComment>(
    `/work-orders/${uuid}/comments`,
    payload,
  );
}

/** Fetch paginated comments for a work order */
export async function fetchComments(
  uuid: string,
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<WorkOrderComment>> {
  const result: unknown = await apiClient.get(
    `/work-orders/${uuid}/comments?page=${page}&limit=${limit}`,
  );
  return extractPaginated<WorkOrderComment>(result);
}

// =============================================================================
// PHOTOS
// =============================================================================

/** Upload a photo to a work order */
export async function uploadPhoto(
  uuid: string,
  file: File,
): Promise<WorkOrderPhoto> {
  const formData = new FormData();
  formData.append('file', file);
  return await apiClient.post<WorkOrderPhoto>(
    `/work-orders/${uuid}/photos`,
    formData,
  );
}

/** Fetch photos for a work order */
export async function fetchPhotos(uuid: string): Promise<WorkOrderPhoto[]> {
  const result: unknown = await apiClient.get(`/work-orders/${uuid}/photos`);
  return extractArray<WorkOrderPhoto>(result);
}

// =============================================================================
// STATS
// =============================================================================

/** Fetch work order stats (counts per status) for dashboard */
export async function fetchStats(): Promise<WorkOrderStats> {
  return await apiClient.get<WorkOrderStats>('/work-orders/stats');
}

// =============================================================================
// ERROR HELPERS
// =============================================================================

/** Log API error with context */
export function logApiError(context: string, err: unknown): void {
  log.error({ err }, `WorkOrders API error: ${context}`);
}
