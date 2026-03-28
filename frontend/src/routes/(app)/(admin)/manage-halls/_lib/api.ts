// =============================================================================
// MANAGE HALLS - API FUNCTIONS
// =============================================================================

import { DEFAULT_HIERARCHY_LABELS, type HierarchyLabels } from '$lib/types/hierarchy-labels';
import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';
import { isSessionExpiredError, handleSessionExpired } from '$lib/utils/session-expired.js';

import { API_ENDPOINTS } from './constants';

import type { Hall, Area, HallPayload, FormIsActiveStatus, DeleteHallResult } from './types';

const log = createLogger('ManageHallsApi');

const apiClient = getApiClient();

function extractArray<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  if (response !== null && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

export async function loadHalls(): Promise<{
  halls: Hall[];
  error: string | null;
}> {
  try {
    const data = await apiClient.get(API_ENDPOINTS.HALLS);
    const halls = extractArray<Hall>(data);
    return { halls, error: null };
  } catch (err: unknown) {
    log.error({ err }, 'Error loading halls');

    if (isSessionExpiredError(err)) {
      handleSessionExpired();
      return { halls: [], error: null };
    }

    return {
      halls: [],
      error: err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten',
    };
  }
}

export async function loadAreas(labels: HierarchyLabels = DEFAULT_HIERARCHY_LABELS): Promise<{
  areas: Area[];
  error: string | null;
}> {
  try {
    const data = await apiClient.get(API_ENDPOINTS.AREAS);
    const areas = extractArray<Area>(data);
    return { areas, error: null };
  } catch (err: unknown) {
    log.error({ err }, 'Error loading areas');
    return {
      areas: [],
      error: err instanceof Error ? err.message : `Fehler beim Laden der ${labels.area}`,
    };
  }
}

export function buildHallPayload(formData: {
  name: string;
  description: string;
  areaId: number | null;
  isActive: FormIsActiveStatus;
}): HallPayload {
  return {
    name: formData.name.trim(),
    description: formData.description.trim() || null,
    areaId: formData.areaId,
    isActive: formData.isActive,
  };
}

export async function saveHall(
  payload: HallPayload,
  editId: number | null,
): Promise<{ success: boolean; error: string | null }> {
  try {
    if (editId !== null) {
      await apiClient.put(API_ENDPOINTS.hall(editId), payload);
    } else {
      await apiClient.post(API_ENDPOINTS.HALLS, payload);
    }
    return { success: true, error: null };
  } catch (err: unknown) {
    log.error({ err }, 'Error saving hall');
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Fehler beim Speichern',
    };
  }
}

export async function deleteHall(hallId: number): Promise<DeleteHallResult> {
  try {
    await apiClient.delete(API_ENDPOINTS.hall(hallId));
    return { success: true, error: null };
  } catch (err: unknown) {
    log.error({ err }, 'Error deleting hall');
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Fehler beim Löschen',
    };
  }
}
