/**
 * Vacation API layer — browser-side calls via apiClient.
 * apiClient.get<T>() returns T directly (auto-unwrapped).
 */
import { getApiClient } from '$lib/utils/api-client';

import { DEFAULT_PAGE_SIZE } from './constants';

import type {
  CreateVacationRequestPayload,
  PaginatedResult,
  RespondPayload,
  VacationBalance,
  VacationCapacityAnalysis,
  VacationRequest,
  VacationRequestStatus,
  VacationStatusLogEntry,
} from './types';

const apiClient = getApiClient();

// ─── Requests ────────────────────────────────────────────────────────

export async function getMyRequests(
  page: number = 1,
  limit: number = DEFAULT_PAGE_SIZE,
  year?: number,
  status?: VacationRequestStatus,
): Promise<PaginatedResult<VacationRequest>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (year !== undefined) params.append('year', String(year));
  if (status !== undefined) params.append('status', status);

  return await apiClient.get<PaginatedResult<VacationRequest>>(
    `/vacation/requests?${params}`,
  );
}

export async function getIncomingRequests(
  page: number = 1,
  limit: number = DEFAULT_PAGE_SIZE,
  year?: number,
  status?: VacationRequestStatus,
): Promise<PaginatedResult<VacationRequest>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (year !== undefined) params.append('year', String(year));
  if (status !== undefined) params.append('status', status);

  return await apiClient.get<PaginatedResult<VacationRequest>>(
    `/vacation/requests/incoming?${params}`,
  );
}

export async function createRequest(
  payload: CreateVacationRequestPayload,
): Promise<VacationRequest> {
  return await apiClient.post<VacationRequest>('/vacation/requests', payload);
}

export async function editRequest(
  id: string,
  payload: Partial<CreateVacationRequestPayload>,
): Promise<VacationRequest> {
  return await apiClient.patch<VacationRequest>(
    `/vacation/requests/${id}`,
    payload,
  );
}

export async function respondToRequest(
  id: string,
  payload: RespondPayload,
): Promise<VacationRequest> {
  return await apiClient.patch<VacationRequest>(
    `/vacation/requests/${id}/respond`,
    payload,
  );
}

export async function withdrawRequest(id: string): Promise<void> {
  await apiClient.patch<undefined>(`/vacation/requests/${id}/withdraw`);
}

export async function cancelRequest(id: string, reason: string): Promise<void> {
  await apiClient.patch<undefined>(`/vacation/requests/${id}/cancel`, {
    reason,
  });
}

export async function getStatusLog(
  id: string,
): Promise<VacationStatusLogEntry[]> {
  return await apiClient.get<VacationStatusLogEntry[]>(
    `/vacation/requests/${id}/status-log`,
  );
}

// ─── Capacity ────────────────────────────────────────────────────────

export async function analyzeCapacity(
  startDate: string,
  endDate: string,
  requesterId?: number,
): Promise<VacationCapacityAnalysis> {
  const params = new URLSearchParams({ startDate, endDate });
  if (requesterId !== undefined) {
    params.append('requesterId', String(requesterId));
  }

  return await apiClient.get<VacationCapacityAnalysis>(
    `/vacation/capacity?${params}`,
  );
}

// ─── Entitlements ────────────────────────────────────────────────────

export async function getMyBalance(year?: number): Promise<VacationBalance> {
  const params = year !== undefined ? `?year=${year}` : '';
  return await apiClient.get<VacationBalance>(
    `/vacation/entitlements/me${params}`,
  );
}
