/**
 * Vacation Holidays — API Layer (browser-side)
 * apiClient.get<T>() returns T directly (auto-unwrapped).
 */
import { getApiClient } from '$lib/utils/api-client';

import type {
  CreateHolidayPayload,
  UpdateHolidayPayload,
  VacationHoliday,
} from './types';

const apiClient = getApiClient();

// ─── Holidays CRUD ──────────────────────────────────────────────────

export async function getHolidays(year?: number): Promise<VacationHoliday[]> {
  const params = year !== undefined ? `?year=${year}` : '';
  return await apiClient.get<VacationHoliday[]>(`/vacation/holidays${params}`);
}

export async function createHoliday(
  payload: CreateHolidayPayload,
): Promise<VacationHoliday> {
  return await apiClient.post<VacationHoliday>('/vacation/holidays', payload);
}

export async function updateHoliday(
  id: string,
  payload: UpdateHolidayPayload,
): Promise<VacationHoliday> {
  return await apiClient.put<VacationHoliday>(
    `/vacation/holidays/${id}`,
    payload,
  );
}

export async function deleteHoliday(id: string): Promise<void> {
  await apiClient.delete<undefined>(`/vacation/holidays/${id}`);
}
