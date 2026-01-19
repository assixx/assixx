/**
 * Blackboard API
 * All fetch functions for blackboard data
 */

import { getApiClient } from '$lib/utils/api-client';

import { ENTRIES_PER_PAGE } from './constants';

import type {
  BlackboardEntry,
  CreateEntryData,
  UpdateEntryData,
  Department,
  Team,
  Area,
  FilterState,
  PaginatedResponse,
} from './types';

const apiClient = getApiClient();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build query string from filter state
 */
function buildQueryParams(filters: FilterState, page: number): string {
  const params = new URLSearchParams({
    status: filters.status,
    page: String(page),
    limit: String(ENTRIES_PER_PAGE),
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
  });

  if (filters.filter !== 'all') {
    params.append('orgLevel', filters.filter);
  }
  if (filters.search.trim() !== '') {
    params.append('search', filters.search);
  }
  if (filters.priority !== undefined) {
    params.append('priority', filters.priority);
  }

  return params.toString();
}

// ============================================================================
// Entry API Functions
// ============================================================================

/**
 * Fetch all entries with filters and pagination
 */
export async function fetchEntries(
  filters: FilterState,
  page: number = 1,
): Promise<{ entries: BlackboardEntry[]; totalPages: number; total: number }> {
  const queryString = buildQueryParams(filters, page);
  const data = await apiClient.get<PaginatedResponse<BlackboardEntry>>(
    `/blackboard?${queryString}`,
  );

  // Handle different response formats
  const entries = data.entries ?? data.data ?? [];
  const pagination = data.meta?.pagination ?? { total: entries.length, totalPages: 1 };

  return {
    entries,
    totalPages: pagination.totalPages,
    total: pagination.total,
  };
}

/**
 * Fetch single entry by UUID
 */
export async function fetchEntryByUuid(uuid: string): Promise<BlackboardEntry | null> {
  try {
    // Backend returns entry directly (no wrapper)
    return await apiClient.get<BlackboardEntry>(`/blackboard/entries/${encodeURIComponent(uuid)}`);
  } catch (err) {
    // Return null for 404
    if (err !== null && typeof err === 'object' && 'status' in err && err.status === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Create new entry
 */
export async function createEntry(data: CreateEntryData): Promise<BlackboardEntry> {
  return await apiClient.post<BlackboardEntry>('/blackboard', data);
}

/**
 * Update existing entry
 */
export async function updateEntry(id: number, data: UpdateEntryData): Promise<BlackboardEntry> {
  return await apiClient.put<BlackboardEntry>(`/blackboard/${id}`, data);
}

/**
 * Delete entry
 */
export async function deleteEntry(id: number): Promise<void> {
  await apiClient.delete(`/blackboard/${id}`);
}

/**
 * Confirm entry (mark as read/confirmed)
 */
export async function confirmEntry(entryId: number): Promise<void> {
  await apiClient.post(`/blackboard/${entryId}/confirm`, {});
}

// ============================================================================
// Attachment API Functions
// ============================================================================

/**
 * Upload attachment to entry
 */
export async function uploadAttachment(entryId: number, file: File): Promise<void> {
  const formData = new FormData();
  formData.append('attachment', file); // Backend expects 'attachment' field name

  await apiClient.upload(`/blackboard/entries/${entryId}/attachments`, formData);
}

/**
 * Delete attachment
 */
export async function deleteAttachment(attachmentId: number): Promise<void> {
  await apiClient.delete(`/blackboard/attachments/${attachmentId}`);
}

// ============================================================================
// Organization Data API Functions
// ============================================================================

/**
 * Fetch departments
 */
export async function fetchDepartments(): Promise<Department[]> {
  const data = await apiClient.get<{ data?: Department[] } | Department[]>('/departments');
  return Array.isArray(data) ? data : (data.data ?? []);
}

/**
 * Fetch teams
 */
export async function fetchTeams(): Promise<Team[]> {
  const data = await apiClient.get<{ data?: Team[] } | Team[]>('/teams');
  return Array.isArray(data) ? data : (data.data ?? []);
}

/**
 * Fetch areas
 */
export async function fetchAreas(): Promise<Area[]> {
  const data = await apiClient.get<{ data?: Area[] } | Area[]>('/areas');
  return Array.isArray(data) ? data : (data.data ?? []);
}

/**
 * Fetch all organization data at once
 */
export async function fetchOrganizations(): Promise<{
  departments: Department[];
  teams: Team[];
  areas: Area[];
}> {
  const [departments, teams, areas] = await Promise.all([
    fetchDepartments(),
    fetchTeams(),
    fetchAreas(),
  ]);

  return { departments, teams, areas };
}
