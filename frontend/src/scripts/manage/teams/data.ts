/**
 * Team Management - Data Layer
 * API calls, state management, and team relation updates
 */

import { ApiClient } from '../../../utils/api-client';
import type { Team, TeamMember, Machine, ITeamsManager } from './types';

// ===== GLOBAL STATE =====
// Note: teamsManager will be set from index.ts to avoid circular dependencies
let teamsManager: ITeamsManager | null = null;

// State getter/setter (needed for import safety)
export function getTeamsManager(): ITeamsManager | null {
  return teamsManager;
}

export function setTeamsManager(manager: ITeamsManager): void {
  teamsManager = manager;
}

// ===== API CLIENT =====
export const apiClient = ApiClient.getInstance();

// ===== TEAM RELATIONS API FUNCTIONS =====

/**
 * Update team members (add/remove users)
 * Compares current members with selected user IDs and syncs differences
 */
export async function updateTeamMembers(
  teamId: number,
  currentMembers: TeamMember[],
  selectedUserIds: number[],
): Promise<void> {
  const currentMemberIds = currentMembers.map((m) => m.id);
  const membersToAdd = selectedUserIds.filter((id) => !currentMemberIds.includes(id));
  const membersToRemove = currentMemberIds.filter((id) => !selectedUserIds.includes(id));

  for (const userId of membersToAdd) {
    try {
      await apiClient.request(`/teams/${teamId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
    } catch (error) {
      console.error(`Error adding member ${userId}:`, error);
    }
  }

  for (const userId of membersToRemove) {
    try {
      await apiClient.request(`/teams/${teamId}/members/${userId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error(`Error removing member ${userId}:`, error);
    }
  }

  console.info(`[TeamsManager] Updated members: +${membersToAdd.length} -${membersToRemove.length}`);
}

/**
 * Update team machines (add/remove assignments)
 * Compares current machines with selected machine IDs and syncs differences
 */
export async function updateTeamMachines(
  teamId: number,
  currentMachines: Machine[],
  selectedMachineIds: number[],
): Promise<void> {
  const currentMachineIds = currentMachines.map((m) => m.id);
  const machinesToAdd = selectedMachineIds.filter((id) => !currentMachineIds.includes(id));
  const machinesToRemove = currentMachineIds.filter((id) => !selectedMachineIds.includes(id));

  for (const machineId of machinesToAdd) {
    try {
      await apiClient.request(`/teams/${teamId}/machines`, {
        method: 'POST',
        body: JSON.stringify({ machineId }),
      });
    } catch (error) {
      console.error(`Error adding machine ${machineId}:`, error);
    }
  }

  for (const machineId of machinesToRemove) {
    try {
      await apiClient.request(`/teams/${teamId}/machines/${machineId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error(`Error removing machine ${machineId}:`, error);
    }
  }

  console.info(`[TeamsManager] Updated machines: +${machinesToAdd.length} -${machinesToRemove.length}`);
}

/**
 * Update all team relations (members + machines) after team save
 * Handles both new and existing teams
 */
export async function updateTeamRelations(
  savedTeam: Team,
  teamData: Record<string, string | number | null>,
  userIds: number[],
  machineIds: number[],
): Promise<void> {
  const manager = getTeamsManager();

  // Handle team members and machines for existing teams
  if ('id' in teamData && manager !== null) {
    const currentTeam = await manager.getTeamDetails(Number(teamData['id']));
    if (currentTeam !== null) {
      await Promise.all([
        updateTeamMembers(savedTeam.id, currentTeam.members ?? [], userIds),
        updateTeamMachines(savedTeam.id, currentTeam.machines ?? [], machineIds),
      ]);
    }
  } else {
    // New team: add all selected members and machines
    await Promise.all([updateTeamMembers(savedTeam.id, [], userIds), updateTeamMachines(savedTeam.id, [], machineIds)]);
  }
}
