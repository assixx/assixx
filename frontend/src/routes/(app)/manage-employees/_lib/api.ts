// =============================================================================
// MANAGE EMPLOYEES - API FUNCTIONS
// =============================================================================

import type { Employee, EmployeePayload, Team } from './types';
import { API_ENDPOINTS } from './constants';
import { goto } from '$app/navigation';
import { base } from '$app/paths';

/**
 * Get authorization headers with token
 */
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('accessToken');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Handle unauthorized response
 */
function handleUnauthorized(status: number): boolean {
  if (status === 401) {
    goto(`${base}/login?session=expired`);
    return true;
  }
  return false;
}

/**
 * Check if user is authenticated and redirect if not
 */
export function checkAuth(): string | null {
  const token = localStorage.getItem('accessToken');
  if (!token) {
    goto(`${base}/login`);
    return null;
  }
  return token;
}

/**
 * Load employees from API
 * @returns Promise with employees array or throws error
 */
export async function loadEmployees(): Promise<Employee[]> {
  const token = checkAuth();
  if (!token) return [];

  const response = await fetch(API_ENDPOINTS.EMPLOYEES, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    if (handleUnauthorized(response.status)) return [];
    throw new Error(`HTTP ${response.status}`);
  }

  const result = await response.json();
  const employeeData = result.data ?? result ?? [];

  // Filter to only employees (in case API returns mixed roles)
  return Array.isArray(employeeData)
    ? employeeData.filter((u: { role?: string }) => u.role === 'employee')
    : [];
}

/**
 * Load teams for multi-select
 * @returns Promise with teams array
 */
export async function loadTeams(): Promise<Team[]> {
  const token = localStorage.getItem('accessToken');
  if (!token) return [];

  try {
    const response = await fetch(API_ENDPOINTS.TEAMS, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return [];

    const result = await response.json();
    return Array.isArray(result) ? result : (result.data ?? []);
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
  const token = checkAuth();
  if (!token) throw new Error('Not authenticated');

  const isEdit = editId !== null;
  const endpoint = isEdit ? API_ENDPOINTS.USER(editId) : API_ENDPOINTS.USERS;
  const method = isEdit ? 'PUT' : 'POST';

  const response = await fetch(endpoint, {
    method,
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message ?? errorData.message ?? `HTTP ${response.status}`);
  }

  const result = await response.json();
  return editId ?? result.id ?? result.data?.id;
}

/**
 * Assign employee to team
 * @param userId - Employee user ID
 * @param teamId - Team ID
 */
export async function assignTeamMember(userId: number, teamId: number): Promise<void> {
  const token = localStorage.getItem('accessToken');
  if (!token) return;

  try {
    const response = await fetch(API_ENDPOINTS.TEAM_MEMBERS(teamId), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId }),
    });

    // 409 Conflict is OK - user is already a member (should not happen with diff logic)
    if (!response.ok && response.status !== 409) {
      console.error('[ManageEmployees] Error assigning team:', response.status);
    }
  } catch (err) {
    console.error('[ManageEmployees] Error assigning team:', err);
  }
}

/**
 * Remove employee from team
 * @param userId - Employee user ID
 * @param teamId - Team ID
 */
export async function removeTeamMember(userId: number, teamId: number): Promise<void> {
  const token = localStorage.getItem('accessToken');
  if (!token) return;

  try {
    const response = await fetch(`${API_ENDPOINTS.TEAM_MEMBERS(teamId)}/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    // 404 Not Found is OK - user was not a member
    if (!response.ok && response.status !== 404) {
      console.error('[ManageEmployees] Error removing team member:', response.status);
    }
  } catch (err) {
    console.error('[ManageEmployees] Error removing team member:', err);
  }
}

/**
 * Delete employee
 * @param employeeId - Employee ID to delete
 */
export async function deleteEmployee(employeeId: number): Promise<void> {
  const token = checkAuth();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(API_ENDPOINTS.USER(employeeId), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
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
    position: formData.position || undefined,
    phone: formData.phone || undefined,
    dateOfBirth: formData.dateOfBirth || undefined,
    employeeNumber: formData.employeeNumber || `EMP${Date.now()}`,
    isActive: formData.isActive,
    role: 'employee',
    availabilityStatus: formData.availabilityStatus as EmployeePayload['availabilityStatus'],
    availabilityStart: formData.availabilityStart || undefined,
    availabilityEnd: formData.availabilityEnd || undefined,
    availabilityNotes: formData.availabilityNotes || undefined,
  };

  // Add password for new employees or when changed
  if (!isEdit && formData.password) {
    payload.password = formData.password;
  } else if (isEdit && formData.password && formData.password.length >= 8) {
    payload.password = formData.password;
  }

  return payload;
}
