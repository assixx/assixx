// =============================================================================
// MANAGE AREAS - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';
import { handleSessionExpired, isSessionExpiredError } from '$lib/utils/session-expired.js';

import { API_ENDPOINTS } from './constants';

import type {
  Area,
  AdminUser,
  Department,
  Hall,
  AreaPayload,
  AreaType,
  FormIsActiveStatus,
  DeleteAreaResult,
} from './types';

const log = createLogger('ManageAreasApi');

const apiClient = getApiClient();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if value is a non-null object
 */
function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Type-safe extraction helper for nested API responses
 */
function extractArray(response: unknown): unknown[] {
  if (Array.isArray(response)) return response;
  if (!isNonNullObject(response)) return [];

  const obj = response;
  if (Array.isArray(obj.data)) return obj.data;
  if (!isNonNullObject(obj.data)) return [];

  const nested = obj.data;
  if (Array.isArray(nested.data)) return nested.data;

  return [];
}

/**
 * Parse delete error to extract dependency information
 */
interface DeleteErrorInfo {
  hasDependencies: boolean;
  message: string | null;
  status: unknown;
}

function parseDeleteError(err: unknown): DeleteErrorInfo {
  if (!isNonNullObject(err)) {
    return { hasDependencies: false, message: null, status: undefined };
  }

  const status = err.status;
  const message = typeof err.message === 'string' ? err.message : null;
  const details = isNonNullObject(err.details) ? err.details : null;
  const hasDependencies = details?.hasDependencies === true;

  return { hasDependencies, message, status };
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
    const data: unknown = await apiClient.get(API_ENDPOINTS.AREAS);
    const areas: Area[] =
      Array.isArray(data) ? (data as Area[]) : ((data as { data?: Area[] }).data ?? []);
    return { areas, error: null };
  } catch (err: unknown) {
    log.error({ err }, 'Error loading areas');

    if (isSessionExpiredError(err)) {
      handleSessionExpired();
      return { areas: [], error: null };
    }

    return {
      areas: [],
      error: err instanceof Error ? err.message : 'Fehler beim Laden',
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
  } catch (err: unknown) {
    log.error({ err }, 'Error loading area leads');
    return {
      users: [],
      error: err instanceof Error ? err.message : 'Fehler beim Laden',
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
    const data: unknown = await apiClient.get(API_ENDPOINTS.DEPARTMENTS);
    const departments: Department[] =
      Array.isArray(data) ? (data as Department[]) : ((data as { data?: Department[] }).data ?? []);
    return { departments, error: null };
  } catch (err: unknown) {
    log.error({ err }, 'Error loading departments');
    return {
      departments: [],
      error: err instanceof Error ? err.message : 'Fehler beim Laden',
    };
  }
}

/**
 * Load halls from API
 */
export async function loadHalls(): Promise<{
  halls: Hall[];
  error: string | null;
}> {
  try {
    const data: unknown = await apiClient.get(API_ENDPOINTS.HALLS);
    const halls: Hall[] =
      Array.isArray(data) ? (data as Hall[]) : ((data as { data?: Hall[] }).data ?? []);
    return { halls, error: null };
  } catch (err: unknown) {
    log.error({ err }, 'Error loading halls');
    return {
      halls: [],
      error: err instanceof Error ? err.message : 'Fehler beim Laden',
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
  hallIds: number[];
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
    hallIds: formData.hallIds,
  };
}

/**
 * Extract area ID from API response (handles `{ id }` and `{ data: { id } }`)
 */
function extractAreaId(result: unknown): number | null {
  if (!isNonNullObject(result)) return null;
  if (typeof result.id === 'number') return result.id;
  if (isNonNullObject(result.data) && typeof result.data.id === 'number') {
    return result.data.id;
  }
  return null;
}

/**
 * Save area (create or update) — returns areaId for subsequent assign calls
 */
export async function saveArea(
  payload: AreaPayload,
  editId: number | null,
): Promise<{ success: boolean; error: string | null; areaId: number | null }> {
  try {
    if (editId !== null) {
      await apiClient.put(API_ENDPOINTS.area(editId), payload);
      return { success: true, error: null, areaId: editId };
    }
    const result: unknown = await apiClient.post(API_ENDPOINTS.AREAS, payload);
    return { success: true, error: null, areaId: extractAreaId(result) };
  } catch (err: unknown) {
    log.error({ err }, 'Error saving area');
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Fehler beim Speichern',
      areaId: null,
    };
  }
}

/**
 * Assign departments to an area
 */
export async function assignDepartmentsToArea(
  areaId: number,
  departmentIds: number[],
): Promise<void> {
  await apiClient.post(API_ENDPOINTS.areaDepartments(areaId), {
    departmentIds,
  });
}

/**
 * Assign halls to an area
 */
export async function assignHallsToArea(areaId: number, hallIds: number[]): Promise<void> {
  await apiClient.post(API_ENDPOINTS.areaHalls(areaId), { hallIds });
}

/**
 * Delete area
 */
export async function deleteArea(areaId: number): Promise<DeleteAreaResult> {
  try {
    await apiClient.delete(API_ENDPOINTS.area(areaId));
    return { success: true, error: null };
  } catch (err: unknown) {
    log.error({ err }, 'Error deleting area');

    const errorInfo = parseDeleteError(err);

    if (errorInfo.status === 409 || errorInfo.hasDependencies) {
      return {
        success: false,
        error: null,
        hasDependencies: true,
        dependencyMessage: errorInfo.message ?? undefined,
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
    await apiClient.delete(API_ENDPOINTS.areaForceDelete(areaId));
    return { success: true, error: null };
  } catch (err: unknown) {
    log.error({ err }, 'Error force deleting area');
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Fehler beim Löschen',
    };
  }
}
