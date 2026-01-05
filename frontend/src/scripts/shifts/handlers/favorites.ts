/**
 * Favorites Event Handlers for Shift Planning System
 * Handles loading and applying favorites
 *
 * @module shifts/handlers/favorites
 */

import type { Employee, ShiftFavorite } from '../types';
import { $$id, setData } from '../../../utils/dom-utils';
import { setSelectedContext, setEmployees, isAdmin as getIsAdmin, getSelectedContext, getFavorites } from '../state';
import { fetchTeamMembers, fetchTeamById } from '../api';
import { updateDropdownDisplay, showPlanningUI, showEditRotationButton, renderEmployeesList } from '../ui';
import { checkRotationPatternExists } from '../rotation';
import { renderAddFavoriteButton } from '../favorites';
import { renderCurrentWeek } from '../week-renderer';

// ============== TYPES ==============

/** Callback for saving context */
export type SaveContextCallback = () => void;

let saveContextCallback: SaveContextCallback | null = null;

export function setFavoritesSaveContextCallback(callback: SaveContextCallback): void {
  saveContextCallback = callback;
}

// ============== HELPERS ==============

/** Map team member to Employee type */
function mapMemberToEmployee(member: { id: number; firstName: string; lastName: string }): Employee {
  return {
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    username: `${member.firstName} ${member.lastName}`,
    position: 'Mitarbeiter',
    email: '',
    role: 'employee' as const,
    tenantId: 0,
    createdAt: '',
    updatedAt: '',
    isActive: 1 as const,
  };
}

// ============== MAIN FUNCTION ==============

/**
 * Load a favorite and set all dropdowns accordingly
 */
export async function loadFavoriteWithDropdowns(favorite: ShiftFavorite): Promise<void> {
  // Fetch team to get leaderId for permission check
  const team = await fetchTeamById(favorite.teamId);
  const teamLeaderId = team?.leaderId ?? null;

  setSelectedContext({
    areaId: favorite.areaId,
    departmentId: favorite.departmentId,
    machineId: favorite.machineId,
    teamId: favorite.teamId,
    teamLeaderId,
  });

  updateDropdownDisplay('area', favorite.areaName);
  updateDropdownDisplay('department', favorite.departmentName);
  updateDropdownDisplay('machine', favorite.machineName);
  updateDropdownDisplay('team', favorite.teamName);

  const areaDisplay = $$id('areaDisplay');
  const departmentDisplay = $$id('departmentDisplay');
  const machineDisplay = $$id('machineDisplay');
  const teamDisplay = $$id('teamDisplay');

  if (areaDisplay !== null) setData(areaDisplay, 'value', String(favorite.areaId));
  if (departmentDisplay !== null) setData(departmentDisplay, 'value', String(favorite.departmentId));
  if (machineDisplay !== null) setData(machineDisplay, 'value', String(favorite.machineId));
  if (teamDisplay !== null) setData(teamDisplay, 'value', String(favorite.teamId));

  const teamMembers = await fetchTeamMembers(favorite.teamId);
  // Only include users with userRole='employee' (not admins/team leads)
  const teamEmployees = teamMembers
    .filter((m) => m.userRole === 'employee')
    .map((m) => ({ ...mapMemberToEmployee(m), teamId: favorite.teamId }));

  setEmployees(teamEmployees);
  renderEmployeesList(teamEmployees);
  showPlanningUI(getIsAdmin());

  const hasRotation = await checkRotationPatternExists(favorite.teamId);
  showEditRotationButton(hasRotation);

  await renderCurrentWeek();

  if (saveContextCallback !== null) saveContextCallback();
  renderAddFavoriteButton('.shift-info-row', getSelectedContext(), getFavorites());
}
