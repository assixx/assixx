/**
 * Vacation Rules — API Layer (browser-side)
 * apiClient.get<T>() returns T directly (auto-unwrapped).
 */
import { getApiClient } from '$lib/utils/api-client';

import type {
  CreateBlackoutPayload,
  CreateStaffingRulePayload,
  OrgMachine,
  UpdateBlackoutPayload,
  UpdateSettingsPayload,
  UpdateStaffingRulePayload,
  VacationBlackout,
  VacationSettings,
  VacationStaffingRule,
} from './types';

const apiClient = getApiClient();

// ─── Blackouts ──────────────────────────────────────────────────────

export async function getBlackouts(year?: number): Promise<VacationBlackout[]> {
  const params = year !== undefined ? `?year=${year}` : '';
  return await apiClient.get<VacationBlackout[]>(
    `/vacation/blackouts${params}`,
  );
}

export async function createBlackout(
  payload: CreateBlackoutPayload,
): Promise<VacationBlackout> {
  return await apiClient.post<VacationBlackout>('/vacation/blackouts', payload);
}

export async function updateBlackout(
  id: string,
  payload: UpdateBlackoutPayload,
): Promise<VacationBlackout> {
  return await apiClient.put<VacationBlackout>(
    `/vacation/blackouts/${id}`,
    payload,
  );
}

export async function deleteBlackout(id: string): Promise<void> {
  await apiClient.delete<undefined>(`/vacation/blackouts/${id}`);
}

// ─── Staffing Rules ─────────────────────────────────────────────────

export async function getStaffingRules(): Promise<VacationStaffingRule[]> {
  return await apiClient.get<VacationStaffingRule[]>(
    '/vacation/staffing-rules',
  );
}

export async function createStaffingRule(
  payload: CreateStaffingRulePayload,
): Promise<VacationStaffingRule> {
  return await apiClient.post<VacationStaffingRule>(
    '/vacation/staffing-rules',
    payload,
  );
}

export async function updateStaffingRule(
  id: string,
  payload: UpdateStaffingRulePayload,
): Promise<VacationStaffingRule> {
  return await apiClient.put<VacationStaffingRule>(
    `/vacation/staffing-rules/${id}`,
    payload,
  );
}

export async function deleteStaffingRule(id: string): Promise<void> {
  await apiClient.delete<undefined>(`/vacation/staffing-rules/${id}`);
}

// ─── Organization Hierarchy (for cascade dropdowns) ─────────────────

/** Fetch machines filtered by department (for staffing rule creation cascade). */
export async function fetchMachinesByDepartment(
  departmentId: number,
): Promise<OrgMachine[]> {
  const response = await apiClient.get<OrgMachine[] | { data: OrgMachine[] }>(
    `/machines?departmentId=${departmentId}`,
  );
  if (Array.isArray(response)) return response;
  return response.data;
}

// ─── Settings ───────────────────────────────────────────────────────

export async function getSettings(): Promise<VacationSettings> {
  return await apiClient.get<VacationSettings>('/vacation/settings');
}

export async function updateSettings(
  payload: UpdateSettingsPayload,
): Promise<VacationSettings> {
  return await apiClient.put<VacationSettings>('/vacation/settings', payload);
}
