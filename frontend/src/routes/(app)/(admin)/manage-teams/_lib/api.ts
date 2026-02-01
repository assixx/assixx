// =============================================================================
// MANAGE TEAMS - API FUNCTIONS
// =============================================================================

import { goto } from '$app/navigation';

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';

import { API_ENDPOINTS } from './constants';

import type {
  Team,
  Department,
  Admin,
  TeamMember,
  Machine,
  TeamPayload,
  ApiErrorWithDetails,
} from './types';

const log = createLogger('ManageTeamsApi');

const apiClient = getApiClient();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type-safe extraction of array data from various API response formats
 * Handles: T[], { data: T[] }
 */
function extractArrayFromResponse<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }

  if (result !== null && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if (Array.isArray(obj.data)) {
      return obj.data as T[];
    }
  }

  return [];
}

/**
 * Type-safe extraction of ID from API response
 * Handles: { id: number }, { data: { id: number } }
 */
function extractIdFromResponse(result: unknown): number | null {
  if (result === null || typeof result !== 'object') {
    return null;
  }

  const obj = result as Record<string, unknown>;

  // Direct { id: number }
  if (typeof obj.id === 'number') {
    return obj.id;
  }

  // { data: { id: number } }
  if (obj.data !== null && typeof obj.data === 'object') {
    const dataObj = obj.data as Record<string, unknown>;
    if (typeof dataObj.id === 'number') {
      return dataObj.id;
    }
  }

  return null;
}

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
 * Handle session expired error - navigates to login page
 */
export function handleSessionExpired(): void {
  void goto('/login?session=expired');
}

// =============================================================================
// LOAD FUNCTIONS
// =============================================================================

/**
 * Load teams from API
 */
export async function loadTeams(): Promise<Team[]> {
  const result: unknown = await apiClient.get(API_ENDPOINTS.TEAMS);
  return extractArrayFromResponse<Team>(result);
}

/**
 * Load departments for dropdown
 */
export async function loadDepartments(): Promise<Department[]> {
  try {
    const result: unknown = await apiClient.get(API_ENDPOINTS.DEPARTMENTS);
    return extractArrayFromResponse<Department>(result);
  } catch (err) {
    log.error({ err }, 'Error loading departments');
    return [];
  }
}

/**
 * Load admins and root users for team lead dropdown
 */
export async function loadAdmins(): Promise<Admin[]> {
  try {
    const [adminsResult, rootsResult] = await Promise.all([
      apiClient.get(API_ENDPOINTS.ADMINS),
      apiClient.get(API_ENDPOINTS.ROOT_USERS),
    ]);
    const admins = extractArrayFromResponse<Admin>(adminsResult);
    const roots = extractArrayFromResponse<Admin>(rootsResult);
    return [...admins, ...roots];
  } catch (err) {
    log.error({ err }, 'Error loading team leaders');
    return [];
  }
}

/**
 * Load employees for member assignment
 */
export async function loadEmployees(): Promise<TeamMember[]> {
  try {
    const result: unknown = await apiClient.get(API_ENDPOINTS.EMPLOYEES);
    const data = extractArrayFromResponse<TeamMember>(result);
    return data.filter((u) => u.role === 'employee');
  } catch (err) {
    log.error({ err }, 'Error loading employees');
    return [];
  }
}

/**
 * Load machines for assignment
 */
export async function loadMachines(): Promise<Machine[]> {
  try {
    const result: unknown = await apiClient.get(API_ENDPOINTS.MACHINES);
    return extractArrayFromResponse<Machine>(result);
  } catch (err) {
    log.error({ err }, 'Error loading machines');
    return [];
  }
}

/**
 * Fetch team members from /teams/:id/members endpoint
 * Returns array of member objects with id
 */
export async function fetchTeamMembers(
  teamId: number,
): Promise<{ id: number }[]> {
  try {
    const result: unknown = await apiClient.get(
      API_ENDPOINTS.teamMembers(teamId),
    );
    return extractArrayFromResponse<{ id: number }>(result);
  } catch (err) {
    log.error({ err }, 'Error fetching team members');
    return [];
  }
}

/**
 * Fetch team machines from /teams/:id/machines endpoint
 * Returns array of machine objects with id
 */
export async function fetchTeamMachines(
  teamId: number,
): Promise<{ id: number }[]> {
  try {
    const result: unknown = await apiClient.get(
      API_ENDPOINTS.teamMachines(teamId),
    );
    return extractArrayFromResponse<{ id: number }>(result);
  } catch (err) {
    log.error({ err }, 'Error fetching team machines');
    return [];
  }
}

/**
 * Save team (create or update)
 * @returns Team ID
 */
export async function saveTeam(
  payload: TeamPayload,
  editId: number | null,
): Promise<number> {
  const isEdit = editId !== null;
  const result: unknown =
    isEdit ?
      await apiClient.put(API_ENDPOINTS.team(editId), payload)
    : await apiClient.post(API_ENDPOINTS.TEAMS, payload);

  return editId ?? extractIdFromResponse(result) ?? 0;
}

/**
 * Add member to team
 */
export async function addTeamMember(
  teamId: number,
  userId: number,
): Promise<void> {
  try {
    await apiClient.post(API_ENDPOINTS.teamMembers(teamId), { userId });
  } catch (err) {
    log.error({ err, userId }, 'Error adding member');
  }
}

/**
 * Remove member from team
 */
export async function removeTeamMember(
  teamId: number,
  userId: number,
): Promise<void> {
  try {
    await apiClient.delete(API_ENDPOINTS.teamMember(teamId, userId));
  } catch (err) {
    log.error({ err, userId }, 'Error removing member');
  }
}

/**
 * Add machine to team
 */
export async function addTeamMachine(
  teamId: number,
  machineId: number,
): Promise<void> {
  try {
    await apiClient.post(API_ENDPOINTS.teamMachines(teamId), { machineId });
  } catch (err) {
    log.error({ err, machineId }, 'Error adding machine');
  }
}

/**
 * Remove machine from team
 */
export async function removeTeamMachine(
  teamId: number,
  machineId: number,
): Promise<void> {
  try {
    await apiClient.delete(API_ENDPOINTS.teamMachine(teamId, machineId));
  } catch (err) {
    log.error({ err, machineId }, 'Error removing machine');
  }
}

/**
 * Update team members and machines relations
 */
export async function updateTeamRelations(
  teamId: number,
  newMemberIds: number[],
  newMachineIds: number[],
  isEditMode: boolean,
): Promise<void> {
  let currentMembers: number[] = [];
  let currentMachines: number[] = [];

  if (isEditMode) {
    // Fetch current members and machines from separate endpoints
    const [members, machines] = await Promise.all([
      fetchTeamMembers(teamId),
      fetchTeamMachines(teamId),
    ]);
    currentMembers = members.map((m) => m.id);
    currentMachines = machines.map((m) => m.id);
  }

  // Update members
  const membersToAdd = newMemberIds.filter(
    (id) => !currentMembers.includes(id),
  );
  const membersToRemove = currentMembers.filter(
    (id) => !newMemberIds.includes(id),
  );

  for (const userId of membersToAdd) {
    await addTeamMember(teamId, userId);
  }
  for (const userId of membersToRemove) {
    await removeTeamMember(teamId, userId);
  }

  // Update machines
  const machinesToAdd = newMachineIds.filter(
    (id) => !currentMachines.includes(id),
  );
  const machinesToRemove = currentMachines.filter(
    (id) => !newMachineIds.includes(id),
  );

  for (const machineId of machinesToAdd) {
    await addTeamMachine(teamId, machineId);
  }
  for (const machineId of machinesToRemove) {
    await removeTeamMachine(teamId, machineId);
  }
}

/**
 * Delete team result
 */
export interface DeleteTeamResult {
  success: boolean;
  hasMembers: boolean;
  memberCount: number;
}

/**
 * Delete team
 */
export async function deleteTeam(teamId: number): Promise<DeleteTeamResult> {
  try {
    await apiClient.delete(API_ENDPOINTS.team(teamId));
    return { success: true, hasMembers: false, memberCount: 0 };
  } catch (err) {
    log.error({ err }, 'Error deleting team');

    // Check if team has members
    const errObj = err as ApiErrorWithDetails | null;
    if (errObj?.message?.includes('members') === true) {
      return {
        success: false,
        hasMembers: true,
        memberCount: errObj.details?.memberCount ?? 0,
      };
    }

    throw err;
  }
}

/**
 * Force delete team with members
 */
export async function forceDeleteTeam(teamId: number): Promise<void> {
  await apiClient.delete(`${API_ENDPOINTS.team(teamId)}?force=true`);
}

/**
 * Check for session expired and redirect
 */
export function checkSessionExpired(err: unknown): boolean {
  if (isSessionExpiredError(err)) {
    handleSessionExpired();
    return true;
  }
  return false;
}

/**
 * Build team payload from form data
 */
export function buildTeamPayload(formData: {
  name: string;
  description: string;
  departmentId: number | null;
  leaderId: number | null;
  isActive: 0 | 1 | 3;
}): TeamPayload {
  return {
    name: formData.name,
    description:
      formData.description.length > 0 ? formData.description : undefined,
    departmentId: formData.departmentId ?? undefined,
    leaderId: formData.leaderId ?? undefined,
    isActive: formData.isActive,
  };
}
