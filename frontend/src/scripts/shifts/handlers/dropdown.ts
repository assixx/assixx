/**
 * Dropdown Event Handlers for Shift Planning System
 * Handles dropdown changes with cascading logic
 *
 * @module shifts/handlers/dropdown
 */

import type { Employee } from '../types';
import {
  getSelectedContext,
  setSelectedContext,
  getTeams,
  setDepartments,
  setMachines,
  setTeams,
  setEmployees,
  isAdmin as getIsAdmin,
  getFavorites,
} from '../state';
import { fetchDepartments, fetchMachines, fetchTeams, fetchTeamMembers } from '../api';
import {
  populateDropdown,
  setDropdownDisabled,
  resetDropdown,
  showPlanningUI,
  showEditRotationButton,
  renderEmployeesList,
} from '../ui';
import { DROPDOWN_PLACEHOLDERS } from '../constants';
import { checkRotationPatternExists } from '../rotation';
import { renderAddFavoriteButton } from '../favorites';

// ============== TYPES ==============

/** Callback for rendering current week */
export type RenderWeekCallback = () => Promise<void>;

/** Callback for saving context to storage */
export type SaveContextCallback = () => void;

// Store callback references (set by index.ts)
let renderWeekCallback: RenderWeekCallback | null = null;
let saveContextCallback: SaveContextCallback | null = null;

/**
 * Register the render week callback
 */
export function setRenderWeekCallback(callback: RenderWeekCallback): void {
  renderWeekCallback = callback;
}

/**
 * Register the save context callback
 */
export function setSaveContextCallback(callback: SaveContextCallback): void {
  saveContextCallback = callback;
}

// ============== HELPER FUNCTIONS ==============

/** Handle area selection */
async function handleAreaChange(numValue: number): Promise<void> {
  setSelectedContext({ areaId: numValue, departmentId: null, machineId: null, teamId: null });

  const departments = await fetchDepartments(numValue);
  setDepartments(departments);
  populateDropdown('departmentDropdown', departments, 'department', 'Keine Abteilungen verfügbar');

  setDropdownDisabled('department', false);
  resetDropdown('machine', DROPDOWN_PLACEHOLDERS.AWAIT_DEPARTMENT);
  resetDropdown('team', DROPDOWN_PLACEHOLDERS.AWAIT_DEPARTMENT);
  setDropdownDisabled('machine', true, DROPDOWN_PLACEHOLDERS.AWAIT_DEPARTMENT);
  setDropdownDisabled('team', true, DROPDOWN_PLACEHOLDERS.AWAIT_DEPARTMENT);

  setMachines([]);
  setTeams([]);
  console.info('[SHIFTS] Area selected, departments loaded:', departments.length);
}

/** Handle department selection */
async function handleDepartmentChange(numValue: number): Promise<void> {
  const context = getSelectedContext();
  setSelectedContext({ departmentId: numValue, machineId: null, teamId: null });

  const machines = await fetchMachines(numValue, context.areaId);
  setMachines(machines);
  populateDropdown('machineDropdown', machines, 'machine', 'Keine Maschinen verfügbar');
  setDropdownDisabled('machine', false);

  resetDropdown('team', DROPDOWN_PLACEHOLDERS.AWAIT_MACHINE);
  setDropdownDisabled('team', true, DROPDOWN_PLACEHOLDERS.AWAIT_MACHINE);
  setTeams([]);
  console.info('[SHIFTS] Department selected, machines:', machines.length);
}

/** Handle machine selection */
async function handleMachineChange(numValue: number): Promise<void> {
  const context = getSelectedContext();
  setSelectedContext({ machineId: numValue, teamId: null });

  const teams = await fetchTeams(context.departmentId);
  setTeams(teams);
  populateDropdown('teamDropdown', teams, 'team', 'Keine Teams verfügbar');
  setDropdownDisabled('team', false);
  console.info('[SHIFTS] Machine selected, teams:', teams.length);
}

/** Map team member to Employee type */
function mapMemberToEmployee(
  m: {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
    availabilityStatus?: string;
    availabilityStart?: string;
    availabilityEnd?: string;
  },
  teamId: number,
): Employee {
  const emp: Employee = {
    id: m.id,
    username: m.username,
    firstName: m.firstName,
    lastName: m.lastName,
    role: 'employee' as const,
    tenantId: 0,
    createdAt: '',
    updatedAt: '',
    isActive: 1,
    email: '',
    position: '',
    teamId,
  };
  if (m.availabilityStatus !== undefined) emp.availabilityStatus = m.availabilityStatus;
  if (m.availabilityStart !== undefined) emp.availabilityStart = m.availabilityStart;
  if (m.availabilityEnd !== undefined) emp.availabilityEnd = m.availabilityEnd;
  return emp;
}

/** Handle team selection */
async function handleTeamChange(numValue: number): Promise<void> {
  const teams = getTeams();
  const selectedTeam = teams.find((t) => t.id === numValue);
  setSelectedContext({ teamId: numValue, teamLeaderId: selectedTeam?.leaderId ?? null });

  const members = await fetchTeamMembers(numValue);
  const teamEmployees = members.map((m) => mapMemberToEmployee(m, numValue));
  setEmployees(teamEmployees);
  renderEmployeesList(teamEmployees);
  showPlanningUI(getIsAdmin());

  void checkRotationPatternExists(numValue).then((exists) => {
    showEditRotationButton(exists && getIsAdmin());
    return exists;
  });

  if (renderWeekCallback !== null) void renderWeekCallback();
}

// ============== MAIN HANDLER ==============

/**
 * Handle dropdown change with cascading logic
 */
export async function handleDropdownChange(type: string, value: string): Promise<void> {
  const numValue = Number.parseInt(value, 10);

  switch (type) {
    case 'area':
      await handleAreaChange(numValue);
      break;
    case 'department':
      await handleDepartmentChange(numValue);
      break;
    case 'machine':
      await handleMachineChange(numValue);
      break;
    case 'team':
      await handleTeamChange(numValue);
      break;
  }

  if (saveContextCallback !== null) saveContextCallback();
  renderAddFavoriteButton('.shift-info-row', getSelectedContext(), getFavorites());
}
