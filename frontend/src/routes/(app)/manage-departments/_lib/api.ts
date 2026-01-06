// =============================================================================
// MANAGE DEPARTMENTS - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import type {
  Department,
  Area,
  AdminUser,
  DepartmentPayload,
  FormIsActiveStatus,
  DeleteDepartmentResult,
  DependencyDetails,
} from './types';
import { API_ENDPOINTS, DEPENDENCY_LABELS } from './constants';
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

/**
 * Check session and redirect if invalid
 */
export function checkSession(): boolean {
  const token = localStorage.getItem('accessToken');
  const userRole = localStorage.getItem('userRole');

  if (!token || (userRole !== 'root' && userRole !== 'admin')) {
    goto(`${base}/login`);
    return false;
  }
  return true;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type-safe extraction helper for nested API responses
 */
function extractArray<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response;
  if (response !== null && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data;
  }
  return [];
}

/**
 * Build dependency message from details
 */
export function buildDependencyMessage(details: DependencyDetails): string {
  const deps = Object.entries(DEPENDENCY_LABELS);

  const messages = deps
    .map(([key, label]) => {
      const count = details[key as keyof DependencyDetails];
      return typeof count === 'number' && count > 0 ? `${count} ${label}` : null;
    })
    .filter((msg): msg is string => msg !== null);

  return messages.join(', ');
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Load departments from API
 */
export async function loadDepartments(): Promise<{
  departments: Department[];
  error: string | null;
}> {
  try {
    const data = await apiClient.get(API_ENDPOINTS.DEPARTMENTS);
    const departments = extractArray<Department>(data);
    return { departments, error: null };
  } catch (err) {
    console.error('[ManageDepartments] Error loading departments:', err);

    if (isSessionExpiredError(err)) {
      handleSessionExpired();
      return { departments: [], error: null };
    }

    return {
      departments: [],
      error: err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten',
    };
  }
}

/**
 * Load areas for dropdown
 */
export async function loadAreas(): Promise<{
  areas: Area[];
  error: string | null;
}> {
  try {
    const data = await apiClient.get(API_ENDPOINTS.AREAS);
    const areas = extractArray<Area>(data);
    return { areas, error: null };
  } catch (err) {
    console.error('[ManageDepartments] Error loading areas:', err);
    return {
      areas: [],
      error: err instanceof Error ? err.message : 'Fehler beim Laden der Bereiche',
    };
  }
}

/**
 * Load department leads (admin/root users)
 */
export async function loadDepartmentLeads(): Promise<{
  users: AdminUser[];
  error: string | null;
}> {
  try {
    const token = localStorage.getItem('accessToken');

    const [adminsRes, rootsRes] = await Promise.all([
      fetch(`/api/v2${API_ENDPOINTS.USERS_ADMIN}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`/api/v2${API_ENDPOINTS.USERS_ROOT}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    let admins: AdminUser[] = [];
    let roots: AdminUser[] = [];

    if (adminsRes.ok) {
      const adminsResult = await adminsRes.json();
      admins = extractArray<AdminUser>(adminsResult);
    }
    if (rootsRes.ok) {
      const rootsResult = await rootsRes.json();
      roots = extractArray<AdminUser>(rootsResult);
    }

    // Combine and deduplicate
    const combined = [...roots, ...admins];
    const users = combined.filter(
      (user, index, self) => index === self.findIndex((u) => u.id === user.id),
    );

    return { users, error: null };
  } catch (err) {
    console.error('[ManageDepartments] Error loading department leads:', err);
    return {
      users: [],
      error: err instanceof Error ? err.message : 'Fehler beim Laden der Abteilungsleiter',
    };
  }
}

/**
 * Build department payload from form data
 */
export function buildDepartmentPayload(formData: {
  name: string;
  description: string;
  areaId: number | null;
  departmentLeadId: number | null;
  isActive: FormIsActiveStatus;
}): DepartmentPayload {
  return {
    name: formData.name.trim(),
    description: formData.description.trim() || null,
    areaId: formData.areaId,
    departmentLeadId: formData.departmentLeadId,
    isActive: formData.isActive,
  };
}

/**
 * Save department (create or update)
 */
export async function saveDepartment(
  payload: DepartmentPayload,
  editId: number | null,
): Promise<{ success: boolean; error: string | null }> {
  try {
    if (editId !== null) {
      await apiClient.put(API_ENDPOINTS.DEPARTMENT(editId), payload);
    } else {
      await apiClient.post(API_ENDPOINTS.DEPARTMENTS, payload);
    }
    return { success: true, error: null };
  } catch (err) {
    console.error('[ManageDepartments] Error saving department:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Fehler beim Speichern',
    };
  }
}

/**
 * Delete department
 */
export async function deleteDepartment(departmentId: number): Promise<DeleteDepartmentResult> {
  try {
    await apiClient.delete(API_ENDPOINTS.DEPARTMENT(departmentId));
    return { success: true, error: null };
  } catch (err) {
    console.error('[ManageDepartments] Error deleting department:', err);

    // Type-safe error property extraction
    const isObject = err !== null && typeof err === 'object';
    const errObj = isObject ? (err as Record<string, unknown>) : null;
    const code = errObj?.code;
    const message = typeof errObj?.message === 'string' ? errObj.message : '';
    const detailsRaw = errObj?.details;
    const details =
      detailsRaw !== null && typeof detailsRaw === 'object'
        ? (detailsRaw as DependencyDetails)
        : {};

    // Check if dependencies exist
    if (
      code === 'DEPT_400' ||
      message.includes('dependencies') ||
      message.includes('Abhängigkeiten')
    ) {
      return {
        success: false,
        error: null,
        hasDependencies: true,
        dependencyDetails: details,
      };
    }

    return {
      success: false,
      error: err instanceof Error ? err.message : 'Fehler beim Löschen',
    };
  }
}

/**
 * Force delete department (removes all dependencies)
 */
export async function forceDeleteDepartment(
  departmentId: number,
): Promise<{ success: boolean; error: string | null }> {
  try {
    await apiClient.delete(API_ENDPOINTS.DEPARTMENT_FORCE_DELETE(departmentId));
    return { success: true, error: null };
  } catch (err) {
    console.error('[ManageDepartments] Error force deleting department:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Fehler beim Löschen',
    };
  }
}
