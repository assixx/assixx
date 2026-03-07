// =============================================================================
// MANAGE DEPARTMENTS - API FUNCTIONS
// =============================================================================

import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';
import {
  handleSessionExpired,
  isSessionExpiredError,
} from '$lib/utils/session-expired.js';

import { API_ENDPOINTS, DEPENDENCY_LABELS } from './constants';

import type {
  Department,
  Area,
  AdminUser,
  DepartmentPayload,
  FormIsActiveStatus,
  DeleteDepartmentResult,
  DependencyDetails,
} from './types';

const log = createLogger('ManageDepartmentsApi');

const apiClient = getApiClient();

// =============================================================================
// SESSION HANDLING
// =============================================================================

/**
 * Parsed API error structure
 */
interface ParsedApiError {
  code: string | null;
  message: string;
  details: DependencyDetails;
}

/**
 * Parse unknown error into structured object
 */
function parseApiError(err: unknown): ParsedApiError {
  if (err === null || typeof err !== 'object') {
    return { code: null, message: '', details: {} };
  }

  const errObj = err as Record<string, unknown>;
  const code = typeof errObj.code === 'string' ? errObj.code : null;
  const message = typeof errObj.message === 'string' ? errObj.message : '';
  const detailsRaw = errObj.details;
  const details =
    detailsRaw !== null && typeof detailsRaw === 'object' ?
      (detailsRaw as DependencyDetails)
    : {};

  return { code, message, details };
}

/**
 * Check if error indicates department has dependencies
 */
function isDependencyError(parsed: ParsedApiError): boolean {
  return (
    parsed.code === 'DEPT_400' ||
    parsed.message.includes('dependencies') ||
    parsed.message.includes('Abhängigkeiten')
  );
}

/**
 * Check session and redirect if invalid
 */
export function checkSession(): boolean {
  const token = localStorage.getItem('accessToken');
  const userRole = localStorage.getItem('userRole');

  if (token === null || (userRole !== 'root' && userRole !== 'admin')) {
    void goto(resolve('/login', {}));
    return false;
  }
  return true;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type-safe extraction helper for nested API responses
 * Caller is responsible for ensuring T matches the actual data type
 */
function extractArray<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  if (response !== null && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
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
      return typeof count === 'number' && count > 0 ?
          `${count} ${label}`
        : null;
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
    log.error({ err }, 'Error loading departments');

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
    log.error({ err }, 'Error loading areas');
    return {
      areas: [],
      error:
        err instanceof Error ? err.message : 'Fehler beim Laden der Bereiche',
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
    // Fetch both admin and root users in parallel using getApiClient
    const [adminsData, rootsData] = await Promise.all([
      apiClient.get<AdminUser[]>(API_ENDPOINTS.USERS_ADMIN).catch(() => []),
      apiClient.get<AdminUser[]>(API_ENDPOINTS.USERS_ROOT).catch(() => []),
    ]);

    const admins = extractArray<AdminUser>(adminsData);
    const roots = extractArray<AdminUser>(rootsData);

    // Combine and deduplicate
    const combined = [...roots, ...admins];
    const users = combined.filter(
      (user, index, self) => index === self.findIndex((u) => u.id === user.id),
    );

    return { users, error: null };
  } catch (err) {
    log.error({ err }, 'Error loading department leads');
    return {
      users: [],
      error:
        err instanceof Error ?
          err.message
        : 'Fehler beim Laden der Abteilungsleiter',
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
      await apiClient.put(API_ENDPOINTS.department(editId), payload);
    } else {
      await apiClient.post(API_ENDPOINTS.DEPARTMENTS, payload);
    }
    return { success: true, error: null };
  } catch (err) {
    log.error({ err }, 'Error saving department');
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Fehler beim Speichern',
    };
  }
}

/**
 * Delete department
 */
export async function deleteDepartment(
  departmentId: number,
): Promise<DeleteDepartmentResult> {
  try {
    await apiClient.delete(API_ENDPOINTS.department(departmentId));
    return { success: true, error: null };
  } catch (err) {
    log.error({ err }, 'Error deleting department');

    const parsed = parseApiError(err);

    if (isDependencyError(parsed)) {
      return {
        success: false,
        error: null,
        hasDependencies: true,
        dependencyDetails: parsed.details,
      };
    }

    return {
      success: false,
      error: parsed.message || 'Fehler beim Löschen',
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
    await apiClient.delete(API_ENDPOINTS.departmentForceDelete(departmentId));
    return { success: true, error: null };
  } catch (err) {
    log.error({ err }, 'Error force deleting department');
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Fehler beim Löschen',
    };
  }
}
