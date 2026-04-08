// =============================================================================
// INVENTORY - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import { extractArray } from '$lib/utils/api-response';
import { createLogger } from '$lib/utils/logger';

import { API_ENDPOINTS } from './constants';

import type {
  CreateListPayload,
  CreateTagPayload,
  InventoryList,
  InventoryTag,
  InventoryTagWithUsage,
  UpdateItemPayload,
  UpdateListPayload,
  UpdateTagPayload,
} from './types';

const log = createLogger('InventoryApi');

const apiClient = getApiClient();

// ── Lists ──────────────────────────────────────────────────────

/** Load all inventory lists with status counts and tags */
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

// ── Tags ───────────────────────────────────────────────────────

/** Load all inventory tags for the tenant with usage counts */
export async function loadTags(): Promise<InventoryTagWithUsage[]> {
  try {
    const result: unknown = await apiClient.get(API_ENDPOINTS.TAGS);
    return extractArray<InventoryTagWithUsage>(result);
  } catch (err: unknown) {
    log.error({ err }, 'Error loading tags');
    return [];
  }
}

/** Create a new inventory tag */
export async function createTag(payload: CreateTagPayload): Promise<InventoryTag> {
  const result: unknown = await apiClient.post(API_ENDPOINTS.TAGS, payload);
  return (result as { data: InventoryTag }).data;
}

/** Update tag (rename + change icon) */
export async function updateTag(tagId: string, payload: UpdateTagPayload): Promise<InventoryTag> {
  const result: unknown = await apiClient.patch(API_ENDPOINTS.tag(tagId), payload);
  return (result as { data: InventoryTag }).data;
}

/** Hard-delete a tag (cascades junction) */
export async function deleteTag(tagId: string): Promise<void> {
  await apiClient.delete(API_ENDPOINTS.tag(tagId));
}

// ── Payload Builder ────────────────────────────────────────────

/** Build create payload from form data */
export function buildCreatePayload(formData: {
  title: string;
  description: string;
  codePrefix: string;
  codeSeparator: string;
  codeDigits: number;
  icon: string;
  tagIds: string[];
}): CreateListPayload {
  return {
    title: formData.title,
    description: formData.description.length > 0 ? formData.description : undefined,
    codePrefix: formData.codePrefix.toUpperCase(),
    codeSeparator: formData.codeSeparator,
    codeDigits: formData.codeDigits,
    icon: formData.icon.length > 0 ? formData.icon : undefined,
    tagIds: formData.tagIds,
  };
}

/** Build update payload from form data */
export function buildUpdatePayload(formData: {
  title: string;
  description: string;
  codePrefix: string;
  codeSeparator: string;
  codeDigits: number;
  icon: string;
  isActive: 0 | 1 | 3;
  tagIds: string[];
}): UpdateListPayload {
  return {
    title: formData.title,
    description: formData.description.length > 0 ? formData.description : null,
    codePrefix: formData.codePrefix.toUpperCase(),
    codeSeparator: formData.codeSeparator,
    codeDigits: formData.codeDigits,
    icon: formData.icon.length > 0 ? formData.icon : null,
    isActive: formData.isActive,
    tagIds: formData.tagIds,
  };
}
