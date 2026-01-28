// =============================================================================
// MANAGE ADMINS - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';

import type {
  Admin,
  Area,
  Department,
  AdminPermissions,
  AdminApiResponse,
  AdminFormData,
} from './types';

const apiClient = getApiClient();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type guard: checks if value is a non-null object
 */
function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Attempts to extract array from object by key, or from 'data' property
 */
function extractArrayFromObject(
  obj: Record<string, unknown>,
  key?: string,
): unknown[] | null {
  // { [key]: T[] } - e.g. { admins: Admin[] }
  if (key !== undefined) {
    const keyValue = obj[key];
    if (Array.isArray(keyValue)) {
      return keyValue as unknown[];
    }
  }

  // { data: T[] }
  const dataValue = obj.data;
  if (Array.isArray(dataValue)) {
    return dataValue as unknown[];
  }

  // { data: { [key]: T[] } }
  if (key !== undefined && isNonNullObject(dataValue)) {
    const nestedValue = dataValue[key];
    if (Array.isArray(nestedValue)) {
      return nestedValue as unknown[];
    }
  }

  return null;
}

/**
 * Type-safe extraction of array data from various API response formats
 * Handles: T[], { data: T[] }, { [key]: T[] }, { data: { [key]: T[] } }
 */
function extractArrayFromResponse<T>(result: unknown, key?: string): T[] {
  // Direct array response
  if (Array.isArray(result)) {
    return result as T[];
  }

  // Object response - delegate to helper
  if (isNonNullObject(result)) {
    return (extractArrayFromObject(result, key) ?? []) as T[];
  }

  return [];
}

// =============================================================================
// LOAD FUNCTIONS
// =============================================================================

/**
 * Load all admins from API
 * Handles various API response formats and loads permissions for each admin
 */
export async function loadAdmins(): Promise<Admin[]> {
  const result: unknown = await apiClient.get('/root/admins');
  const loadedAdmins = extractArrayFromResponse<Admin>(result, 'admins');

  // Load permissions for each admin
  for (const admin of loadedAdmins) {
    try {
      const permsData: AdminPermissions = await apiClient.get(
        `/admin-permissions/${admin.id}`,
      );
      admin.areas = permsData.areas ?? [];
      admin.departments = permsData.departments ?? [];
      admin.hasFullAccess = permsData.hasFullAccess ?? false;
    } catch {
      admin.areas = [];
      admin.departments = [];
      admin.hasFullAccess = false;
    }
  }

  return loadedAdmins;
}

/**
 * Load all areas for multi-select dropdown
 */
export async function loadAreas(): Promise<Area[]> {
  const result: unknown = await apiClient.get('/areas');
  return extractArrayFromResponse<Area>(result);
}

/**
 * Load all departments for multi-select dropdown
 */
export async function loadDepartments(): Promise<Department[]> {
  const result: unknown = await apiClient.get('/departments');
  return extractArrayFromResponse<Department>(result);
}

// =============================================================================
// SAVE FUNCTIONS
// =============================================================================

/**
 * Create a new admin
 */
export async function createAdmin(
  data: AdminFormData,
): Promise<AdminApiResponse> {
  return await apiClient.post('/root/admins', data);
}

/**
 * Update an existing admin
 */
export async function updateAdmin(
  adminId: number,
  data: AdminFormData,
): Promise<AdminApiResponse> {
  return await apiClient.put(`/root/admins/${adminId}`, data);
}

/**
 * Set full access permission for an admin
 */
export async function setFullAccess(
  adminId: number,
  hasFullAccess: boolean,
): Promise<void> {
  await apiClient.patch(`/admin-permissions/${adminId}/full-access`, {
    hasFullAccess,
  });
}

/**
 * Update area permissions for an admin
 */
export async function updateAreaPermissions(
  adminId: number,
  areaIds: number[],
): Promise<void> {
  await apiClient.post(`/admin-permissions/${adminId}/areas`, {
    areaIds,
    permissions: { canRead: true, canWrite: false, canDelete: false },
  });
}

/**
 * Update department permissions for an admin
 */
export async function updateDepartmentPermissions(
  adminId: number,
  departmentIds: number[],
): Promise<void> {
  await apiClient.post('/admin-permissions', {
    adminId,
    departmentIds,
    permissions: { canRead: true, canWrite: false, canDelete: false },
  });
}

/**
 * Save admin (create or update) with permissions
 * Returns the admin ID
 */
export async function saveAdminWithPermissions(
  data: AdminFormData,
  editId: number | null,
): Promise<number | null> {
  // Create or update admin
  const result =
    editId !== null ? await updateAdmin(editId, data) : await createAdmin(data);

  const adminId =
    editId ?? result.adminId ?? result.id ?? result.data?.id ?? null;

  if (adminId !== null) {
    // Set full access
    await setFullAccess(adminId, data.hasFullAccess);

    // Update area/department permissions (if not full access)
    if (!data.hasFullAccess) {
      await updateAreaPermissions(adminId, data.areaIds);
      await updateDepartmentPermissions(adminId, data.departmentIds);
    }
  }

  return adminId;
}

// =============================================================================
// DELETE FUNCTIONS
// =============================================================================

/**
 * Delete an admin
 */
export async function deleteAdmin(adminId: number): Promise<void> {
  await apiClient.delete(`/root/admins/${adminId}`);
}

// =============================================================================
// HELPER TYPES FOR ERROR HANDLING
// =============================================================================

/**
 * Check if error has SESSION_EXPIRED code
 */
export function isSessionExpiredError(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === 'SESSION_EXPIRED'
  );
}
