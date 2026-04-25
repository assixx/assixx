// =============================================================================
// MANAGE EMPLOYEES - API FUNCTIONS
// =============================================================================

import { getApiClient, ApiError } from '$lib/utils/api-client';
import { extractArray } from '$lib/utils/api-response';
import { buildLoginUrl } from '$lib/utils/build-apex-url';
import { createLogger } from '$lib/utils/logger';
import { handleSessionExpired } from '$lib/utils/session-expired.js';

import { API_ENDPOINTS } from './constants';

import type { Employee, EmployeePayload, Team } from './types';

const log = createLogger('ManageEmployeesApi');
const apiClient = getApiClient();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert empty string to undefined (for optional API fields)
 */
function toOptional(value: string): string | undefined {
  return value !== '' ? value : undefined;
}

/** Result shape from save operation */
export interface SaveResult {
  id: number;
  uuid: string | null;
}

/** Extract id + uuid from a record (top-level or nested data) */
function extractFields(obj: Record<string, unknown>): SaveResult | null {
  if (typeof obj.id !== 'number') return null;
  return {
    id: obj.id,
    uuid: typeof obj.uuid === 'string' ? obj.uuid : null,
  };
}

/**
 * Extract created resource ID + UUID from API response
 */
function extractCreatedResult(result: unknown): SaveResult {
  if (result === null || typeof result !== 'object') {
    return { id: 0, uuid: null };
  }

  const resultObj = result as Record<string, unknown>;
  const topLevel = extractFields(resultObj);
  if (topLevel !== null) return topLevel;

  if (resultObj.data !== null && typeof resultObj.data === 'object') {
    const nested = extractFields(resultObj.data as Record<string, unknown>);
    if (nested !== null) return nested;
  }

  return { id: 0, uuid: null };
}

// =============================================================================
// AUTH HELPERS
// =============================================================================

/**
 * Check if user is authenticated
 */
export function checkAuth(): boolean {
  if (typeof localStorage === 'undefined') return false;
  const token = localStorage.getItem('accessToken');
  if (token === null) {
    // ADR-050 Amendment 2026-04-22: cross-origin hard-nav to apex login.
    window.location.href = buildLoginUrl('session-expired');
    return false;
  }
  return true;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/** Load employees from API */
export async function loadEmployees(): Promise<Employee[]> {
  if (!checkAuth()) return [];

  try {
    const result = await apiClient.get<Employee[]>(API_ENDPOINTS.EMPLOYEES);
    const employees = extractArray<Employee>(result);

    // Filter to only employees (in case API returns mixed roles)
    return employees.filter((u) => u.role === 'employee');
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 401) {
      handleSessionExpired();
      return [];
    }
    throw err;
  }
}

/** Load teams for multi-select */
export async function loadTeams(): Promise<Team[]> {
  try {
    const result = await apiClient.get<Team[]>(API_ENDPOINTS.TEAMS);
    return extractArray<Team>(result);
  } catch (err: unknown) {
    log.error({ err }, 'Error loading teams');
    return [];
  }
}

/** Generate username from email */
export function generateUsernameFromEmail(email: string): string {
  const normalized = email.toLowerCase().trim();
  const localPart = normalized.split('@')[0] ?? normalized;
  return localPart.replace(/[^\w-]/g, '_');
}

/** Save employee (create or update) */
export async function saveEmployee(
  payload: EmployeePayload,
  editId: number | null,
): Promise<SaveResult> {
  if (!checkAuth()) throw new Error('Not authenticated');

  const isEdit = editId !== null;
  const endpoint = isEdit ? API_ENDPOINTS.user(editId) : API_ENDPOINTS.USERS;

  if (isEdit) {
    await apiClient.put(endpoint, payload);
    return { id: editId, uuid: null };
  }

  const result = await apiClient.post(endpoint, payload);
  return extractCreatedResult(result);
}

/** Assign employee to team */
export async function assignTeamMember(userId: number, teamId: number): Promise<void> {
  try {
    await apiClient.post(API_ENDPOINTS.teamMembers(teamId), { userId });
  } catch (err: unknown) {
    // 409 Conflict is OK - user is already a member
    if (err instanceof ApiError && err.status === 409) {
      return;
    }
    log.error({ err }, 'Error assigning team');
  }
}

/** Remove employee from team */
export async function removeTeamMember(userId: number, teamId: number): Promise<void> {
  try {
    await apiClient.delete(`${API_ENDPOINTS.teamMembers(teamId)}/${userId}`);
  } catch (err: unknown) {
    // 404 Not Found is OK - user was not a member
    if (err instanceof ApiError && err.status === 404) {
      return;
    }
    log.error({ err }, 'Error removing team member');
  }
}

/** Delete employee */
export async function deleteEmployee(employeeId: number): Promise<void> {
  if (!checkAuth()) throw new Error('Not authenticated');
  await apiClient.delete(API_ENDPOINTS.user(employeeId));
}

/** Update employee availability (quick update via users table) */
export async function updateEmployeeAvailability(
  employeeId: number,
  availability: {
    availabilityStatus: string;
    availabilityStart?: string;
    availabilityEnd?: string;
    availabilityReason?: string;
    availabilityNotes?: string;
  },
): Promise<void> {
  if (!checkAuth()) throw new Error('Not authenticated');
  await apiClient.put(API_ENDPOINTS.user(employeeId), availability);
}

/** Sync team memberships - calculates diff between original and new team IDs, then adds/removes as needed */
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

/** Upgrade employee role to admin */
export async function upgradeToAdmin(userId: number): Promise<void> {
  if (!checkAuth()) throw new Error('Not authenticated');
  await apiClient.put(API_ENDPOINTS.user(userId), { role: 'admin' });
}

/**
 * Build employee payload from form data
 * NOTE: Availability is managed separately via AvailabilityModal
 */
export function buildEmployeePayload(
  formData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    positionIds: string[];
    phone: string;
    dateOfBirth: string;
    notes: string;
    employeeNumber: string;
    isActive: 0 | 1 | 3;
  },
  isEdit: boolean,
): EmployeePayload {
  const payload: EmployeePayload = {
    firstName: formData.firstName,
    lastName: formData.lastName,
    email: formData.email.toLowerCase().trim(),
    username: generateUsernameFromEmail(formData.email),
    positionIds: formData.positionIds,
    phone: toOptional(formData.phone),
    dateOfBirth: toOptional(formData.dateOfBirth),
    notes: toOptional(formData.notes),
    employeeNumber: formData.employeeNumber !== '' ? formData.employeeNumber : `EMP${Date.now()}`,
    isActive: formData.isActive,
    role: 'employee',
  };

  // Add password: new employee requires it, edit only if valid new password provided
  const hasValidPassword = formData.password !== '' && formData.password.length >= 8;
  if (!isEdit || hasValidPassword) {
    payload.password = toOptional(formData.password);
  }

  return payload;
}

// =============================================================================
// ROOT-INITIATED PASSWORD RESET (ADR-051 §2.7 / §5.4)
// =============================================================================

/**
 * Root triggers a password-reset-link email for an employee target.
 *
 * Same endpoint as manage-admins (§5.3) — the backend route is user-scoped
 * (`/users/:id/send-password-reset-link`), not role-scoped. Strict Root-only
 * via `@Roles('root')`; admin-with-hasFullAccess is deliberately rejected
 * (§0.2.5 #13 — narrower than ADR-045 Layer-1). The target sets their own
 * password on `/reset-password`; Root never sees the credential.
 *
 * Error codes: `INVALID_TARGET_ROLE` (400), `INACTIVE_TARGET` (400),
 * `RATE_LIMIT` (429 — surfaces via api-client as `err.status === 429` with
 * the client's synthesized `RATE_LIMIT_EXCEEDED` code).
 *
 * @see docs/FEAT_FORGOT_PASSWORD_ROLE_GATE_MASTERPLAN.md §2.7 / §5.4
 */
export async function sendPasswordResetLink(userId: number): Promise<{ message: string }> {
  return await apiClient.post<{ message: string }>(`/users/${userId}/send-password-reset-link`, {});
}
