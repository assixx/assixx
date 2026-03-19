// =============================================================================
// MANAGE TEAMS - API FUNCTIONS
// =============================================================================

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';

import { API_ENDPOINTS } from './constants';

import type {
  Team,
  Department,
  Admin,
  TeamMember,
  Asset,
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
  } catch (err: unknown) {
    log.error({ err }, 'Error loading departments');
    return [];
  }
}

/**
 * Load all active users as leader candidates.
 * Any role (root, admin, employee) can be a team leader.
 */
export async function loadLeaderCandidates(): Promise<Admin[]> {
  try {
    const result: unknown = await apiClient.get(
      API_ENDPOINTS.LEADER_CANDIDATES,
    );
    return extractArrayFromResponse<Admin>(result);
  } catch (err: unknown) {
    log.error({ err }, 'Error loading leader candidates');
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
  } catch (err: unknown) {
    log.error({ err }, 'Error loading employees');
    return [];
  }
}

/**
 * Load assets for assignment
 */
export async function loadAssets(): Promise<Asset[]> {
  try {
    const result: unknown = await apiClient.get(API_ENDPOINTS.MACHINES);
    return extractArrayFromResponse<Asset>(result);
  } catch (err: unknown) {
    log.error({ err }, 'Error loading assets');
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
  } catch (err: unknown) {
    log.error({ err }, 'Error fetching team members');
    return [];
  }
}

/**
 * Fetch team assets from /teams/:id/assets endpoint
 * Returns array of asset objects with id
 */
export async function fetchTeamAssets(
  teamId: number,
): Promise<{ id: number }[]> {
  try {
    const result: unknown = await apiClient.get(
      API_ENDPOINTS.teamAssets(teamId),
    );
    return extractArrayFromResponse<{ id: number }>(result);
  } catch (err: unknown) {
    log.error({ err }, 'Error fetching team assets');
    return [];
  }
}

/** Save team (create or update), returns team ID */
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
  } catch (err: unknown) {
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
  } catch (err: unknown) {
    log.error({ err, userId }, 'Error removing member');
  }
}

/**
 * Add asset to team
 */
export async function addTeamAsset(
  teamId: number,
  assetId: number,
): Promise<void> {
  try {
    await apiClient.post(API_ENDPOINTS.teamAssets(teamId), { assetId });
  } catch (err: unknown) {
    log.error({ err, assetId }, 'Error adding asset');
  }
}

/**
 * Remove asset from team
 */
export async function removeTeamAsset(
  teamId: number,
  assetId: number,
): Promise<void> {
  try {
    await apiClient.delete(API_ENDPOINTS.teamAsset(teamId, assetId));
  } catch (err: unknown) {
    log.error({ err, assetId }, 'Error removing asset');
  }
}

/**
 * Update team members and assets relations
 */
export async function updateTeamRelations(
  teamId: number,
  newMemberIds: number[],
  newAssetIds: number[],
  isEditMode: boolean,
): Promise<void> {
  let currentMembers: number[] = [];
  let currentAssets: number[] = [];

  if (isEditMode) {
    // Fetch current members and assets from separate endpoints
    const [members, assets] = await Promise.all([
      fetchTeamMembers(teamId),
      fetchTeamAssets(teamId),
    ]);
    currentMembers = members.map((m) => m.id);
    currentAssets = assets.map((m) => m.id);
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

  // Update assets
  const assetsToAdd = newAssetIds.filter((id) => !currentAssets.includes(id));
  const assetsToRemove = currentAssets.filter(
    (id) => !newAssetIds.includes(id),
  );

  for (const assetId of assetsToAdd) {
    await addTeamAsset(teamId, assetId);
  }
  for (const assetId of assetsToRemove) {
    await removeTeamAsset(teamId, assetId);
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
  } catch (err: unknown) {
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
    departmentId: formData.departmentId,
    leaderId: formData.leaderId,
    isActive: formData.isActive,
  };
}

/**
 * Assign a single hall to a team (or clear assignment)
 */
export async function assignTeamHall(
  teamId: number,
  hallId: number | null,
): Promise<void> {
  const hallIds = hallId !== null ? [hallId] : [];
  await apiClient.post(`${API_ENDPOINTS.TEAMS}/${teamId}/halls`, { hallIds });
}
