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
  ApiResponse,
  AdminFormData,
} from './types';

const apiClient = getApiClient();

// =============================================================================
// LOAD FUNCTIONS
// =============================================================================

/**
 * Load all admins from API
 * Handles various API response formats and loads permissions for each admin
 */
export async function loadAdmins(): Promise<Admin[]> {
  const result: unknown = await apiClient.get('/root/admins');

  // Type-safe extraction of admin data from various API response formats
  let loadedAdmins: Admin[] = [];

  if (Array.isArray(result)) {
    // Direct array response
    loadedAdmins = result;
  } else if (result !== null && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if (Array.isArray(obj.admins)) {
      // { admins: Admin[] }
      loadedAdmins = obj.admins;
    } else if (obj.data !== undefined) {
      if (Array.isArray(obj.data)) {
        // { data: Admin[] }
        loadedAdmins = obj.data;
      } else if (obj.data !== null && typeof obj.data === 'object') {
        const dataObj = obj.data as Record<string, unknown>;
        if (Array.isArray(dataObj.admins)) {
          // { data: { admins: Admin[] } }
          loadedAdmins = dataObj.admins;
        }
      }
    }
  }

  // Load permissions for each admin
  for (const admin of loadedAdmins) {
    try {
      const permsData: AdminPermissions = await apiClient.get(`/admin-permissions/${admin.id}`);
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
  const result = await apiClient.get('/areas');
  return Array.isArray(result) ? result : (result.data ?? []);
}

/**
 * Load all departments for multi-select dropdown
 */
export async function loadDepartments(): Promise<Department[]> {
  const result = await apiClient.get('/departments');
  return Array.isArray(result) ? result : (result.data ?? []);
}

// =============================================================================
// SAVE FUNCTIONS
// =============================================================================

/**
 * Create a new admin
 */
export async function createAdmin(data: AdminFormData): Promise<AdminApiResponse> {
  return await apiClient.post('/root/admins', data);
}

/**
 * Update an existing admin
 */
export async function updateAdmin(adminId: number, data: AdminFormData): Promise<AdminApiResponse> {
  return await apiClient.put(`/root/admins/${adminId}`, data);
}

/**
 * Set full access permission for an admin
 */
export async function setFullAccess(adminId: number, hasFullAccess: boolean): Promise<void> {
  await apiClient.patch(`/admin-permissions/${adminId}/full-access`, {
    hasFullAccess,
  });
}

/**
 * Update area permissions for an admin
 */
export async function updateAreaPermissions(adminId: number, areaIds: number[]): Promise<void> {
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
    permissions: { can_read: true, can_write: false, can_delete: false },
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
  const result = editId !== null ? await updateAdmin(editId, data) : await createAdmin(data);

  const adminId = editId ?? result.adminId ?? result.id ?? result.data?.id ?? null;

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
