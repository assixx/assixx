// =============================================================================
// INVENTORY - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import { extractArray } from '$lib/utils/api-response';
import { createLogger } from '$lib/utils/logger';

import { API_ENDPOINTS } from './constants';

import type {
  CreateListPayload,
  InventoryList,
  UpdateItemPayload,
  UpdateListPayload,
} from './types';

const log = createLogger('InventoryApi');

const apiClient = getApiClient();

// ── Lists ──────────────────────────────────────────────────────

/** Load all inventory lists with status counts */
export async function loadLists(): Promise<InventoryList[]> {
  const result: unknown = await apiClient.get(API_ENDPOINTS.LISTS);
  return extractArray<InventoryList>(result);
}

/** Create a new inventory list */
export async function createList(payload: CreateListPayload): Promise<unknown> {
  return await apiClient.post(API_ENDPOINTS.LISTS, payload);
}

/** Update an inventory list */
export async function updateList(id: string, payload: UpdateListPayload): Promise<unknown> {
  return await apiClient.patch(API_ENDPOINTS.list(id), payload);
}

/** Save list (create or update) */
export async function saveList(
  payload: CreateListPayload | UpdateListPayload,
  editId: string | null,
): Promise<void> {
  if (editId !== null) {
    await updateList(editId, payload as UpdateListPayload);
  } else {
    await createList(payload as CreateListPayload);
  }
}

/** Soft-delete an inventory list */
export async function deleteList(id: string): Promise<void> {
  await apiClient.delete(API_ENDPOINTS.list(id));
}

// ── Items ─────────────────────────────────────────────────────

/** Update an inventory item */
export async function updateItem(uuid: string, payload: UpdateItemPayload): Promise<void> {
  await apiClient.patch(API_ENDPOINTS.item(uuid), payload);
}

/** Soft-delete an inventory item */
export async function deleteItem(uuid: string): Promise<void> {
  await apiClient.delete(API_ENDPOINTS.item(uuid));
}

// ── Photos ────────────────────────────────────────────────────

/** Upload a photo for an inventory item (multipart) */
export async function uploadItemPhoto(itemUuid: string, file: File): Promise<unknown> {
  const formData = new FormData();
  formData.append('file', file);
  return await apiClient.post(API_ENDPOINTS.itemPhotos(itemUuid), formData);
}

/** Delete a photo */
export async function deletePhoto(photoId: string): Promise<void> {
  await apiClient.delete(`/inventory/photos/${photoId}`);
}

/** Update photo caption */
export async function updatePhotoCaption(photoId: string, caption: string | null): Promise<void> {
  await apiClient.patch(`/inventory/photos/${photoId}`, { caption });
}

// ── Categories ─────────────────────────────────────────────────

/** Load category suggestions for autocomplete */
export async function loadCategories(query?: string): Promise<string[]> {
  try {
    const endpoint =
      query !== undefined && query.length > 0 ?
        `${API_ENDPOINTS.CATEGORIES}?q=${encodeURIComponent(query)}`
      : API_ENDPOINTS.CATEGORIES;
    const result: unknown = await apiClient.get(endpoint);
    return extractArray<string>(result);
  } catch (err: unknown) {
    log.error({ err }, 'Error loading categories');
    return [];
  }
}

// ── Payload Builder ────────────────────────────────────────────

/** Build create payload from form data */
export function buildCreatePayload(formData: {
  title: string;
  description: string;
  category: string;
  codePrefix: string;
  codeSeparator: string;
  codeDigits: number;
  icon: string;
}): CreateListPayload {
  return {
    title: formData.title,
    description: formData.description.length > 0 ? formData.description : undefined,
    category: formData.category.length > 0 ? formData.category : undefined,
    codePrefix: formData.codePrefix.toUpperCase(),
    codeSeparator: formData.codeSeparator,
    codeDigits: formData.codeDigits,
    icon: formData.icon.length > 0 ? formData.icon : undefined,
  };
}

/** Build update payload from form data */
export function buildUpdatePayload(formData: {
  title: string;
  description: string;
  category: string;
  codePrefix: string;
  codeSeparator: string;
  codeDigits: number;
  icon: string;
  isActive: 0 | 1 | 3;
}): UpdateListPayload {
  return {
    title: formData.title,
    description: formData.description.length > 0 ? formData.description : null,
    category: formData.category.length > 0 ? formData.category : null,
    codePrefix: formData.codePrefix.toUpperCase(),
    codeSeparator: formData.codeSeparator,
    codeDigits: formData.codeDigits,
    icon: formData.icon.length > 0 ? formData.icon : null,
    isActive: formData.isActive,
  };
}
