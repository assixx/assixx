/**
 * KVP Categories Admin - API Client
 */
import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';

import type { CustomizableCategoriesData } from './types';

const log = createLogger('KvpCategoriesApi');
const apiClient = getApiClient();

const BASE = '/kvp/categories';

/** Fetch customizable categories (admin view) */
export async function fetchCustomizable(): Promise<CustomizableCategoriesData | null> {
  try {
    return await apiClient.get<CustomizableCategoriesData>(
      `${BASE}/customizable`,
    );
  } catch (err: unknown) {
    log.error({ err }, 'Error fetching customizable categories');
    return null;
  }
}

/** Upsert a name override for a global default category */
export async function upsertOverride(
  categoryId: number,
  customName: string,
): Promise<boolean> {
  try {
    await apiClient.put(`${BASE}/override/${categoryId}`, { customName });
    return true;
  } catch (err: unknown) {
    log.error({ err }, 'Error upserting override');
    return false;
  }
}

/** Delete a name override (reset to default) */
export async function deleteOverride(categoryId: number): Promise<boolean> {
  try {
    await apiClient.delete(`${BASE}/override/${categoryId}`);
    return true;
  } catch (err: unknown) {
    log.error({ err }, 'Error deleting override');
    return false;
  }
}

/** Create a new custom category */
export async function createCustomCategory(data: {
  name: string;
  color: string;
  icon: string;
  description?: string;
}): Promise<{ id: number } | null> {
  try {
    return await apiClient.post<{ id: number }>(`${BASE}/custom`, data);
  } catch (err: unknown) {
    log.error({ err }, 'Error creating custom category');
    return null;
  }
}

/** Update a custom category */
export async function updateCustomCategory(
  id: number,
  data: {
    name?: string;
    color?: string;
    icon?: string;
    description?: string;
  },
): Promise<boolean> {
  try {
    await apiClient.put(`${BASE}/custom/${id}`, data);
    return true;
  } catch (err: unknown) {
    log.error({ err }, 'Error updating custom category');
    return false;
  }
}

/** Soft-delete a custom category (preserves data for existing KVPs with strikethrough) */
export async function deleteCustomCategory(
  id: number,
): Promise<{ affectedSuggestions: number } | null> {
  try {
    return await apiClient.delete<{ affectedSuggestions: number }>(
      `${BASE}/custom/${id}`,
    );
  } catch (err: unknown) {
    log.error({ err }, 'Error deleting custom category');
    return null;
  }
}
