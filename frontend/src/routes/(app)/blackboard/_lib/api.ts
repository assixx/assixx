/**
 * Blackboard API
 * All fetch functions for blackboard data
 */

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
import { ENTRIES_PER_PAGE } from './constants';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get auth token from localStorage
 */
function getAuthToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('token');
}

/**
 * Create headers with auth token
 */
function createHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token !== null) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Handle API response
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Ein Fehler ist aufgetreten' }));
    throw new Error(error.message ?? `HTTP ${response.status}`);
  }
  return await (response.json() as Promise<T>);
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

  const response = await fetch(`/api/v2/blackboard?${params.toString()}`, {
    method: 'GET',
    headers: createHeaders(),
  });

  const data = await handleResponse<PaginatedResponse<BlackboardEntry>>(response);

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
  const response = await fetch(`/api/v2/blackboard/${encodeURIComponent(uuid)}`, {
    method: 'GET',
    headers: createHeaders(),
  });

  if (response.status === 404) {
    return null;
  }

  return await handleResponse<BlackboardEntry>(response);
}

/**
 * Create new entry
 */
export async function createEntry(data: CreateEntryData): Promise<BlackboardEntry> {
  const response = await fetch('/api/v2/blackboard', {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify(data),
  });

  return await handleResponse<BlackboardEntry>(response);
}

/**
 * Update existing entry
 */
export async function updateEntry(id: number, data: UpdateEntryData): Promise<BlackboardEntry> {
  const response = await fetch(`/api/v2/blackboard/${id}`, {
    method: 'PUT',
    headers: createHeaders(),
    body: JSON.stringify(data),
  });

  return await handleResponse<BlackboardEntry>(response);
}

/**
 * Delete entry
 */
export async function deleteEntry(id: number): Promise<void> {
  const response = await fetch(`/api/v2/blackboard/${id}`, {
    method: 'DELETE',
    headers: createHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Fehler beim Löschen' }));
    throw new Error(error.message ?? `HTTP ${response.status}`);
  }
}

/**
 * Confirm entry (mark as read/confirmed)
 */
export async function confirmEntry(entryId: number): Promise<void> {
  const response = await fetch(`/api/v2/blackboard/${entryId}/confirm`, {
    method: 'POST',
    headers: createHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Fehler beim Bestätigen' }));
    throw new Error(error.message ?? `HTTP ${response.status}`);
  }
}

// ============================================================================
// Attachment API Functions
// ============================================================================

/**
 * Upload attachment to entry
 */
export async function uploadAttachment(entryId: number, file: File): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);

  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token !== null) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`/api/v2/blackboard/${entryId}/attachments`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Fehler beim Hochladen' }));
    throw new Error(error.message ?? `HTTP ${response.status}`);
  }
}

/**
 * Delete attachment
 */
export async function deleteAttachment(attachmentId: number): Promise<void> {
  const response = await fetch(`/api/v2/blackboard/attachments/${attachmentId}`, {
    method: 'DELETE',
    headers: createHeaders(),
  });

  if (!response.ok) {
    throw new Error('Fehler beim Löschen des Anhangs');
  }
}

// ============================================================================
// Organization Data API Functions
// ============================================================================

/**
 * Fetch departments
 */
export async function fetchDepartments(): Promise<Department[]> {
  const response = await fetch('/api/v2/departments', {
    method: 'GET',
    headers: createHeaders(),
  });

  const data = await handleResponse<{ data?: Department[] } | Department[]>(response);
  return Array.isArray(data) ? data : (data.data ?? []);
}

/**
 * Fetch teams
 */
export async function fetchTeams(): Promise<Team[]> {
  const response = await fetch('/api/v2/teams', {
    method: 'GET',
    headers: createHeaders(),
  });

  const data = await handleResponse<{ data?: Team[] } | Team[]>(response);
  return Array.isArray(data) ? data : (data.data ?? []);
}

/**
 * Fetch areas
 */
export async function fetchAreas(): Promise<Area[]> {
  const response = await fetch('/api/v2/areas', {
    method: 'GET',
    headers: createHeaders(),
  });

  const data = await handleResponse<{ data?: Area[] } | Area[]>(response);
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
