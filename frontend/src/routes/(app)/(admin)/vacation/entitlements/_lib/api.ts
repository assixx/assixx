/**
 * Vacation Entitlements — API Layer (browser-side)
 * apiClient.get<T>() returns T directly (auto-unwrapped).
 */
import { getApiClient } from '$lib/utils/api-client';

import type {
  AddDaysPayload,
  CreateEntitlementPayload,
  VacationBalance,
  VacationEntitlement,
} from './types';

const apiClient = getApiClient();

// ─── Balance ────────────────────────────────────────────────────────

export async function getUserBalance(
  userId: number,
  year?: number,
): Promise<VacationBalance> {
  const params = year !== undefined ? `?year=${year}` : '';
  return await apiClient.get<VacationBalance>(
    `/vacation/entitlements/${userId}${params}`,
  );
}

// ─── Entitlement CRUD ───────────────────────────────────────────────

export async function createOrUpdateEntitlement(
  userId: number,
  payload: CreateEntitlementPayload,
): Promise<VacationEntitlement> {
  return await apiClient.put<VacationEntitlement>(
    `/vacation/entitlements/${userId}`,
    payload,
  );
}

export async function addDays(
  userId: number,
  payload: AddDaysPayload,
): Promise<VacationEntitlement> {
  return await apiClient.post<VacationEntitlement>(
    `/vacation/entitlements/${userId}/add-days`,
    payload,
  );
}
