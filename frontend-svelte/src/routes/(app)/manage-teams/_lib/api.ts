// =============================================================================
// MANAGE TEAMS - API FUNCTIONS
// =============================================================================

import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { getApiClient } from '$lib/utils/api-client';
import type {
  Team,
  Department,
  Admin,
  TeamMember,
  Machine,
  TeamPayload,
  ApiErrorWithDetails,
} from './types';
import { API_ENDPOINTS } from './constants';

const apiClient = getApiClient();

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
 * Load teams from API
 */
export async function loadTeams(): Promise<Team[]> {
  const result = (await apiClient.get(API_ENDPOINTS.TEAMS)) as Team[] | { data?: Team[] };
  return Array.isArray(result) ? result : (result.data ?? []);
}

/**
 * Load departments for dropdown
 */
export async function loadDepartments(): Promise<Department[]> {
  try {
    const result = (await apiClient.get(API_ENDPOINTS.DEPARTMENTS)) as
      | Department[]
      | { data?: Department[] };
    return Array.isArray(result) ? result : (result.data ?? []);
  } catch (err) {
    console.error('[ManageTeams] Error loading departments:', err);
    return [];
  }
}

/**
 * Load admins for team lead dropdown
 */
export async function loadAdmins(): Promise<Admin[]> {
  try {
    const result = (await apiClient.get(API_ENDPOINTS.ADMINS)) as Admin[] | { data?: Admin[] };
    const data = Array.isArray(result) ? result : (result.data ?? []);
    return data.filter((u) => u.role === 'admin');
  } catch (err) {
    console.error('[ManageTeams] Error loading admins:', err);
    return [];
  }
}

/**
 * Load employees for member assignment
 */
export async function loadEmployees(): Promise<TeamMember[]> {
  try {
    const result = (await apiClient.get(API_ENDPOINTS.EMPLOYEES)) as
      | TeamMember[]
      | { data?: TeamMember[] };
    const data = Array.isArray(result) ? result : (result.data ?? []);
    return data.filter((u) => u.role === 'employee');
  } catch (err) {
    console.error('[ManageTeams] Error loading employees:', err);
    return [];
  }
}

/**
 * Load machines for assignment
 */
export async function loadMachines(): Promise<Machine[]> {
  try {
    const result = (await apiClient.get(API_ENDPOINTS.MACHINES)) as
      | Machine[]
      | { data?: Machine[] };
    return Array.isArray(result) ? result : (result.data ?? []);
  } catch (err) {
    console.error('[ManageTeams] Error loading machines:', err);
    return [];
  }
}

/**
 * Fetch team members from /teams/:id/members endpoint
 * Returns array of member objects with id
 */
export async function fetchTeamMembers(teamId: number): Promise<{ id: number }[]> {
  try {
    const result = (await apiClient.get(API_ENDPOINTS.TEAM_MEMBERS(teamId))) as
      | { id: number }[]
      | { data?: { id: number }[] };
    return Array.isArray(result) ? result : (result.data ?? []);
  } catch (err) {
    console.error('[ManageTeams] Error fetching team members:', err);
    return [];
  }
}

/**
 * Fetch team machines from /teams/:id/machines endpoint
 * Returns array of machine objects with id
 */
export async function fetchTeamMachines(teamId: number): Promise<{ id: number }[]> {
  try {
    const result = (await apiClient.get(API_ENDPOINTS.TEAM_MACHINES(teamId))) as
      | { id: number }[]
      | { data?: { id: number }[] };
    return Array.isArray(result) ? result : (result.data ?? []);
  } catch (err) {
    console.error('[ManageTeams] Error fetching team machines:', err);
    return [];
  }
}

/**
 * Save team (create or update)
 * @returns Team ID
 */
export async function saveTeam(payload: TeamPayload, editId: number | null): Promise<number> {
  const isEdit = editId !== null;
  const result = isEdit
    ? ((await apiClient.put(API_ENDPOINTS.TEAM(editId), payload)) as {
        id?: number;
        data?: { id?: number };
      })
    : ((await apiClient.post(API_ENDPOINTS.TEAMS, payload)) as {
        id?: number;
        data?: { id?: number };
      });

  return editId ?? result.id ?? result.data?.id ?? 0;
}

/**
 * Add member to team
 */
export async function addTeamMember(teamId: number, userId: number): Promise<void> {
  try {
    await apiClient.post(API_ENDPOINTS.TEAM_MEMBERS(teamId), { userId });
  } catch (err) {
    console.error(`[ManageTeams] Error adding member ${userId}:`, err);
  }
}

/**
 * Remove member from team
 */
export async function removeTeamMember(teamId: number, userId: number): Promise<void> {
  try {
    await apiClient.delete(API_ENDPOINTS.TEAM_MEMBER(teamId, userId));
  } catch (err) {
    console.error(`[ManageTeams] Error removing member ${userId}:`, err);
  }
}

/**
 * Add machine to team
 */
export async function addTeamMachine(teamId: number, machineId: number): Promise<void> {
  try {
    await apiClient.post(API_ENDPOINTS.TEAM_MACHINES(teamId), { machineId });
  } catch (err) {
    console.error(`[ManageTeams] Error adding machine ${machineId}:`, err);
  }
}

/**
 * Remove machine from team
 */
export async function removeTeamMachine(teamId: number, machineId: number): Promise<void> {
  try {
    await apiClient.delete(API_ENDPOINTS.TEAM_MACHINE(teamId, machineId));
  } catch (err) {
    console.error(`[ManageTeams] Error removing machine ${machineId}:`, err);
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
  const membersToAdd = newMemberIds.filter((id) => !currentMembers.includes(id));
  const membersToRemove = currentMembers.filter((id) => !newMemberIds.includes(id));

  for (const userId of membersToAdd) {
    await addTeamMember(teamId, userId);
  }
  for (const userId of membersToRemove) {
    await removeTeamMember(teamId, userId);
  }

  // Update machines
  const machinesToAdd = newMachineIds.filter((id) => !currentMachines.includes(id));
  const machinesToRemove = currentMachines.filter((id) => !newMachineIds.includes(id));

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
    await apiClient.delete(API_ENDPOINTS.TEAM(teamId));
    return { success: true, hasMembers: false, memberCount: 0 };
  } catch (err) {
    console.error('[ManageTeams] Error deleting team:', err);

    // Check if team has members
    const errObj = err as ApiErrorWithDetails | null;
    if (errObj?.message?.includes('members')) {
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
  await apiClient.delete(`${API_ENDPOINTS.TEAM(teamId)}?force=true`);
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
    description: formData.description || undefined,
    departmentId: formData.departmentId ?? undefined,
    leaderId: formData.leaderId ?? undefined,
    isActive: formData.isActive,
  };
}
