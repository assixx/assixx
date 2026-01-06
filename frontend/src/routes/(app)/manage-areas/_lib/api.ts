// =============================================================================
// MANAGE AREAS - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import type {
  Area,
  AdminUser,
  Department,
  AreaPayload,
  AreaType,
  FormIsActiveStatus,
  DeleteAreaResult,
} from './types';
import { API_ENDPOINTS } from './constants';
import { base } from '$app/paths';
import { goto } from '$app/navigation';

const apiClient = getApiClient();

// =============================================================================
// SESSION HANDLING
// =============================================================================

/**
 * Check if error is a session expired error
 */
function isSessionExpiredError(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === 'SESSION_EXPIRED'
  );
}

/**
 * Handle session expired error
 */
export function handleSessionExpired(): void {
  goto(`${base}/login?session=expired`);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type-safe extraction helper for nested API responses
 */
function extractArray(response: unknown): unknown[] {
  if (Array.isArray(response)) return response;
  if (response !== null && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data;
    if (obj.data !== null && typeof obj.data === 'object') {
      const nested = obj.data as Record<string, unknown>;
      if (Array.isArray(nested.data)) return nested.data;
    }
  }
  return [];
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Load areas from API
 */
export async function loadAreas(): Promise<{
  areas: Area[];
  error: string | null;
}> {
  try {
    const data = await apiClient.get(API_ENDPOINTS.AREAS);
    const areas = Array.isArray(data) ? data : ((data as { data?: Area[] }).data ?? []);
    return { areas, error: null };
  } catch (err) {
    console.error('[ManageAreas] Error loading areas:', err);

    if (isSessionExpiredError(err)) {
      handleSessionExpired();
      return { areas: [], error: null };
    }

    return {
      areas: [],
      error: err instanceof Error ? err.message : 'Fehler beim Laden der Bereiche',
    };
  }
}

/**
 * Load area leads (admins and root users)
 */
export async function loadAreaLeads(): Promise<{
  users: AdminUser[];
  error: string | null;
}> {
  try {
    const [adminsDataRaw, rootsDataRaw] = await Promise.all([
      apiClient.get(API_ENDPOINTS.USERS_ADMIN),
      apiClient.get(API_ENDPOINTS.USERS_ROOT),
    ]);

    const admins = extractArray(adminsDataRaw) as AdminUser[];
    const roots = extractArray(rootsDataRaw) as AdminUser[];

    // Combine and deduplicate
    const combined = [...roots, ...admins];
    const users = combined.filter(
      (user, index, self) => index === self.findIndex((u) => u.id === user.id),
    );

    return { users, error: null };
  } catch (err) {
    console.error('[ManageAreas] Error loading area leads:', err);
    return {
      users: [],
      error: err instanceof Error ? err.message : 'Fehler beim Laden der Bereichsleiter',
    };
  }
}

/**
 * Load departments from API
 */
export async function loadDepartments(): Promise<{
  departments: Department[];
  error: string | null;
}> {
  try {
    const data = await apiClient.get(API_ENDPOINTS.DEPARTMENTS);
    const departments = Array.isArray(data) ? data : ((data as { data?: Department[] }).data ?? []);
    return { departments, error: null };
  } catch (err) {
    console.error('[ManageAreas] Error loading departments:', err);
    return {
      departments: [],
      error: err instanceof Error ? err.message : 'Fehler beim Laden der Abteilungen',
    };
  }
}

/**
 * Build area payload from form data
 */
export function buildAreaPayload(formData: {
  name: string;
  description: string;
  areaLeadId: number | null;
  type: AreaType;
  capacity: number | null;
  address: string;
  departmentIds: number[];
  isActive: FormIsActiveStatus;
}): AreaPayload {
  return {
    name: formData.name,
    description: formData.description || null,
    areaLeadId: formData.areaLeadId,
    type: formData.type,
    capacity: formData.capacity,
    address: formData.address || null,
    isActive: formData.isActive,
    departmentIds: formData.departmentIds,
  };
}

/**
 * Save area (create or update)
 */
export async function saveArea(
  payload: AreaPayload,
  editId: number | null,
): Promise<{ success: boolean; error: string | null }> {
  try {
    if (editId !== null) {
      await apiClient.put(API_ENDPOINTS.AREA(editId), payload);
    } else {
      await apiClient.post(API_ENDPOINTS.AREAS, payload);
    }
    return { success: true, error: null };
  } catch (err) {
    console.error('[ManageAreas] Error saving area:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Fehler beim Speichern',
    };
  }
}

/**
 * Delete area
 */
export async function deleteArea(areaId: number): Promise<DeleteAreaResult> {
  try {
    await apiClient.delete(API_ENDPOINTS.AREA(areaId));
    return { success: true, error: null };
  } catch (err) {
    console.error('[ManageAreas] Error deleting area:', err);

    // Type-safe error property extraction
    const isObject = err !== null && typeof err === 'object';
    const errObj = isObject ? (err as Record<string, unknown>) : null;
    const status = errObj?.status;
    const details = errObj?.details;
    const detailsObj =
      details !== null && typeof details === 'object' ? (details as Record<string, unknown>) : null;
    const hasDependencies = detailsObj?.hasDependencies === true;
    const message = typeof errObj?.message === 'string' ? errObj.message : null;

    // Check if it's a dependency error
    if (status === 409 || hasDependencies) {
      return {
        success: false,
        error: null,
        hasDependencies: true,
        dependencyMessage: message ?? undefined,
      };
    }

    return {
      success: false,
      error: err instanceof Error ? err.message : 'Fehler beim Löschen',
    };
  }
}

/**
 * Force delete area (removes all dependencies)
 */
export async function forceDeleteArea(
  areaId: number,
): Promise<{ success: boolean; error: string | null }> {
  try {
    await apiClient.delete(API_ENDPOINTS.AREA_FORCE_DELETE(areaId));
    return { success: true, error: null };
  } catch (err) {
    console.error('[ManageAreas] Error force deleting area:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Fehler beim Löschen',
    };
  }
}
