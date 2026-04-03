// =============================================================================
// MANAGE ADMINS - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import { extractArray } from '$lib/utils/api-response';

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
// LOAD FUNCTIONS
// =============================================================================

/**
 * Load all admins from API
 * Handles various API response formats and loads permissions for each admin
 */
export async function loadAdmins(): Promise<Admin[]> {
  const result: unknown = await apiClient.get('/root/admins');
  const loadedAdmins = extractArray<Admin>(result, 'admins');

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
  const result: unknown = await apiClient.get('/areas');
  return extractArray<Area>(result);
}

/**
 * Load all departments for multi-select dropdown
 */
export async function loadDepartments(): Promise<Department[]> {
  const result: unknown = await apiClient.get('/departments');
  return extractArray<Department>(result);
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
    permissions: { canRead: true, canWrite: false, canDelete: false },
  });
}

/** Result from save operation */
export interface SaveAdminResult {
  id: number | null;
  uuid: string | null;
}

/** Apply permission settings for an admin */
async function applyPermissions(adminId: number, data: AdminFormData): Promise<void> {
  await setFullAccess(adminId, data.hasFullAccess);

  if (!data.hasFullAccess) {
    await updateAreaPermissions(adminId, data.areaIds);
    await updateDepartmentPermissions(adminId, data.departmentIds);
  }
}

/** Extract id + uuid from API response */
function extractAdminResult(response: AdminApiResponse, editId: number | null): SaveAdminResult {
  const id = editId ?? response.adminId ?? response.id ?? response.data?.id ?? null;
  const uuid = response.uuid ?? response.data?.uuid ?? null;
  return { id, uuid };
}

/**
 * Save admin (create or update) with permissions
 */
export async function saveAdminWithPermissions(
  data: AdminFormData,
  editId: number | null,
): Promise<SaveAdminResult> {
  const response = editId !== null ? await updateAdmin(editId, data) : await createAdmin(data);

  const result = extractAdminResult(response, editId);

  if (result.id !== null) {
    await applyPermissions(result.id, data);
  }

  return result;
}

// =============================================================================
// ROLE UPGRADE
// =============================================================================

/** Upgrade admin role to root */
export async function upgradeToRoot(adminId: number): Promise<void> {
  await apiClient.put(`/root/admins/${adminId}`, { role: 'root' });
}

/** Downgrade admin role to employee */
export async function downgradeToEmployee(adminId: number): Promise<void> {
  await apiClient.put(`/users/${adminId}`, { role: 'employee' });
}

// =============================================================================
// AVAILABILITY FUNCTIONS
// =============================================================================

/** Update admin availability (quick update via users table) */
export async function updateAdminAvailability(
  adminId: number,
  availability: {
    availabilityStatus: string;
    availabilityStart?: string;
    availabilityEnd?: string;
    availabilityReason?: string;
    availabilityNotes?: string;
  },
): Promise<void> {
  await apiClient.put(`/users/${adminId}`, availability);
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
