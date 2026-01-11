// =============================================================================
// MANAGE EMPLOYEES - API FUNCTIONS
// =============================================================================

import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

import { getApiClient, ApiError } from '$lib/utils/api-client';

import { API_ENDPOINTS } from './constants';

import type { Employee, EmployeePayload, Team } from './types';

const apiClient = getApiClient();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type-safe extraction helper for nested API responses
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
 * Convert empty string to undefined (for optional API fields)
 */
function toOptional(value: string): string | undefined {
  return value !== '' ? value : undefined;
}

/**
 * Extract created resource ID from API response
 */
function extractCreatedId(result: unknown): number {
  if (result === null || typeof result !== 'object') {
    return 0;
  }

  const resultObj = result as Record<string, unknown>;

  // Check top-level id
  if (typeof resultObj.id === 'number') {
    return resultObj.id;
  }

  // Check nested data.id
  if (resultObj.data !== null && typeof resultObj.data === 'object') {
    const dataObj = resultObj.data as Record<string, unknown>;
    if (typeof dataObj.id === 'number') {
      return dataObj.id;
    }
  }

  return 0;
}

// =============================================================================
// AUTH HELPERS
// =============================================================================

/**
 * Handle unauthorized response - redirect to login
 */
function handleUnauthorized(): void {
  void goto(`${resolve('/login', {})}?session=expired`);
}

/**
 * Check if user is authenticated
 */
export function checkAuth(): boolean {
  if (typeof localStorage === 'undefined') return false;
  const token = localStorage.getItem('accessToken');
  if (token === null) {
    void goto(resolve('/login', {}));
    return false;
  }
  return true;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Load employees from API
 * @returns Promise with employees array or throws error
 */
export async function loadEmployees(): Promise<Employee[]> {
  if (!checkAuth()) return [];

  try {
    const result = await apiClient.get<Employee[]>(API_ENDPOINTS.EMPLOYEES);
    const employees = extractArray<Employee>(result);

    // Filter to only employees (in case API returns mixed roles)
    return employees.filter((u) => u.role === 'employee');
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      handleUnauthorized();
      return [];
    }
    throw err;
  }
}

/**
 * Load teams for multi-select
 * @returns Promise with teams array
 */
export async function loadTeams(): Promise<Team[]> {
  try {
    const result = await apiClient.get<Team[]>(API_ENDPOINTS.TEAMS);
    return extractArray<Team>(result);
  } catch (err) {
    console.error('[ManageEmployees] Error loading teams:', err);
    return [];
  }
}

/**
 * Generate username from email
 * @param email - Email address
 * @returns Generated username
 */
export function generateUsernameFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? email;
  return localPart.replace(/[^\w-]/g, '_');
}

/**
 * Save employee (create or update)
 * @param payload - Employee data
 * @param editId - Employee ID for update, null for create
 * @returns Promise with created/updated employee ID
 */
export async function saveEmployee(
  payload: EmployeePayload,
  editId: number | null,
): Promise<number> {
  if (!checkAuth()) throw new Error('Not authenticated');

  const isEdit = editId !== null;
  const endpoint = isEdit ? API_ENDPOINTS.user(editId) : API_ENDPOINTS.USERS;

  if (isEdit) {
    await apiClient.put(endpoint, payload);
    return editId;
  }

  const result = await apiClient.post(endpoint, payload);
  return extractCreatedId(result);
}

/**
 * Assign employee to team
 * @param userId - Employee user ID
 * @param teamId - Team ID
 */
export async function assignTeamMember(userId: number, teamId: number): Promise<void> {
  try {
    await apiClient.post(API_ENDPOINTS.teamMembers(teamId), { userId });
  } catch (err) {
    // 409 Conflict is OK - user is already a member
    if (err instanceof ApiError && err.status === 409) {
      return;
    }
    console.error('[ManageEmployees] Error assigning team:', err);
  }
}

/**
 * Remove employee from team
 * @param userId - Employee user ID
 * @param teamId - Team ID
 */
export async function removeTeamMember(userId: number, teamId: number): Promise<void> {
  try {
    await apiClient.delete(`${API_ENDPOINTS.teamMembers(teamId)}/${userId}`);
  } catch (err) {
    // 404 Not Found is OK - user was not a member
    if (err instanceof ApiError && err.status === 404) {
      return;
    }
    console.error('[ManageEmployees] Error removing team member:', err);
  }
}

/**
 * Delete employee
 * @param employeeId - Employee ID to delete
 */
export async function deleteEmployee(employeeId: number): Promise<void> {
  if (!checkAuth()) throw new Error('Not authenticated');
  await apiClient.delete(API_ENDPOINTS.user(employeeId));
}

/**
 * Sync team memberships for an employee
 * Calculates diff between original and new team IDs, then adds/removes as needed
 * @param userId - Employee user ID
 * @param newTeamIds - New team IDs to assign
 * @param originalTeamIds - Original team IDs (before edit)
 * @param isEditMode - Whether editing existing employee
 */
export async function syncTeamMemberships(
  userId: number,
  newTeamIds: number[],
  originalTeamIds: number[],
  isEditMode: boolean,
): Promise<void> {
  if (userId === 0) return;

  // Calculate teams to add (new teams not in original)
  const teamsToAdd = newTeamIds.filter((id) => !originalTeamIds.includes(id));

  // Add new team memberships
  for (const teamId of teamsToAdd) {
    await assignTeamMember(userId, teamId);
  }

  // Remove old team memberships (only in edit mode)
  if (isEditMode) {
    const teamsToRemove = originalTeamIds.filter((id) => !newTeamIds.includes(id));
    for (const teamId of teamsToRemove) {
      await removeTeamMember(userId, teamId);
    }
  }
}

/**
 * Build employee payload from form data
 */
export function buildEmployeePayload(
  formData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    position: string;
    phone: string;
    dateOfBirth: string;
    employeeNumber: string;
    isActive: 0 | 1 | 3;
    availabilityStatus: string;
    availabilityStart: string;
    availabilityEnd: string;
    availabilityNotes: string;
  },
  isEdit: boolean,
): EmployeePayload {
  const payload: EmployeePayload = {
    firstName: formData.firstName,
    lastName: formData.lastName,
    email: formData.email,
    username: generateUsernameFromEmail(formData.email),
    position: toOptional(formData.position),
    phone: toOptional(formData.phone),
    dateOfBirth: toOptional(formData.dateOfBirth),
    employeeNumber: formData.employeeNumber !== '' ? formData.employeeNumber : `EMP${Date.now()}`,
    isActive: formData.isActive,
    role: 'employee',
    availabilityStatus: formData.availabilityStatus as EmployeePayload['availabilityStatus'],
    availabilityStart: toOptional(formData.availabilityStart),
    availabilityEnd: toOptional(formData.availabilityEnd),
    availabilityNotes: toOptional(formData.availabilityNotes),
  };

  // Add password: new employee requires it, edit only if valid new password provided
  const hasValidPassword = formData.password !== '' && formData.password.length >= 8;
  if (!isEdit || hasValidPassword) {
    payload.password = toOptional(formData.password);
  }

  return payload;
}
