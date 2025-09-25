/**
 * UI and Rendering Functions for Teams Management
 * Contains all UI rendering, form handling, and dropdown loading functions
 */

import type { Team, Department, Machine, ProcessedFormData } from './types';
import type { UserAPIResponse } from '../../../utils/api-mappers';
import { mapUsers } from '../../../utils/api-mappers';
import { setSafeHTML } from '../../../utils/dom-utils';
import { ApiClient } from '../../../utils/api-client';

/**
 * Toggle table visibility based on team data
 */
export function toggleTableVisibility(show: boolean): void {
  const teamsTable = document.querySelector('#teams-table');
  const teamsEmpty = document.querySelector('#teams-empty');

  if (show) {
    teamsTable?.classList.remove('u-hidden');
    teamsEmpty?.classList.add('u-hidden');
  } else {
    teamsTable?.classList.add('u-hidden');
    teamsEmpty?.classList.remove('u-hidden');
  }
}

/**
 * Create member badge HTML
 */
export function createMemberBadge(team: Team): string {
  if (team.memberCount === undefined || team.memberCount === 0) {
    return '0';
  }

  const memberText = `${team.memberCount} ${team.memberCount === 1 ? 'Mitglied' : 'Mitglieder'}`;
  const tooltip =
    team.memberNames !== undefined && team.memberNames !== ''
      ? `<span class="member-tooltip" style="
        display: none;
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-bottom: 8px;
        padding: 8px 12px;
        background: rgba(18, 18, 18, 0.95);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        white-space: nowrap;
        max-width: 300px;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #fff;
        font-size: 12px;
        font-weight: normal;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        pointer-events: none;
      ">${team.memberNames}</span>`
      : '';

  return `<span class="status-badge member-badge" style="background: rgba(33, 150, 243, 0.2); color: #2196f3; border-color: rgba(33, 150, 243, 0.3); cursor: help; position: relative; white-space: nowrap;" data-members="${team.memberNames ?? ''}">
    ${memberText}
    ${tooltip}
  </span>`;
}

/**
 * Get status badge class
 */
export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
      return 'badge-success';
    case 'inactive':
      return 'badge-secondary';
    default:
      return 'badge-secondary';
  }
}

/**
 * Get status label
 */
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Aktiv';
    case 'inactive':
      return 'Inaktiv';
    default:
      return status;
  }
}

/**
 * Create a team row HTML
 */
export function createTeamRow(team: Team): string {
  return `
    <tr>
      <td><strong>${team.name}</strong></td>
      <td>${team.departmentName ?? '-'}</td>
      <td>${team.leaderName ?? '-'}</td>
      <td>${createMemberBadge(team)}</td>
      <td>
        <span class="badge ${getStatusBadgeClass(team.status)}">
          ${getStatusLabel(team.status)}
        </span>
      </td>
      <td>${new Date(team.createdAt).toLocaleDateString('de-DE')}</td>
      <td>
        <button class="action-btn edit" data-action="edit-team" data-team-id="${team.id}">
          Bearbeiten
        </button>
        <button class="action-btn ${team.status === 'active' ? 'deactivate' : 'activate'}" data-action="toggle-team-status" data-team-id="${team.id}" data-status="${team.status}">
          ${team.status === 'active' ? 'Deaktivieren' : 'Aktivieren'}
        </button>
        <button class="action-btn delete" data-action="delete-team" data-team-id="${team.id}">
          Löschen
        </button>
      </td>
    </tr>
  `;
}

/**
 * Add tooltip event listeners to member badges
 */
export function addTooltipListeners(tbody: Element): void {
  const memberBadges = tbody.querySelectorAll('.member-badge');
  memberBadges.forEach((badge) => {
    const tooltip = badge.querySelector('.member-tooltip');
    if (tooltip instanceof HTMLElement) {
      badge.addEventListener('mouseenter', () => {
        tooltip.style.display = 'block';
      });
      badge.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });
    }
  });
}

/**
 * Populate team form with data
 */
export function populateTeamForm(team: Team): void {
  const setInputValue = (id: string, value: string | number | null | undefined) => {
    const input = document.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`);
    if (input !== null) {
      if (value !== null && value !== undefined) {
        input.value = value.toString();
      } else {
        input.value = '';
      }
    }
  };

  setInputValue('team-id', team.id);
  setInputValue('team-name', team.name);
  setInputValue('team-description', team.description);
  setInputValue('team-department', team.departmentId);
  setInputValue('team-lead', team.leaderId);
  setInputValue('team-type', team.teamType);
  setInputValue('team-max-members', team.maxMembers);
  setInputValue('team-status', team.status);

  // Display team members
  const membersDisplay = document.querySelector('#team-members-display');
  if (membersDisplay !== null && team.members !== undefined && team.members.length > 0) {
    const memberNames = team.members.map((m) => `${m.firstName} ${m.lastName}`).join(', ');
    membersDisplay.textContent = `${team.members.length} Mitglieder: ${memberNames}`;
  } else if (membersDisplay !== null) {
    membersDisplay.textContent = 'Keine Mitglieder zugewiesen';
  }

  // Display assigned machines
  const machinesDisplay = document.querySelector('#team-machines-display');
  if (machinesDisplay !== null && team.machines !== undefined && team.machines.length > 0) {
    const machineNames = team.machines.map((m) => m.name).join(', ');
    machinesDisplay.textContent = `${team.machines.length} Maschinen: ${machineNames}`;
  } else if (machinesDisplay !== null) {
    machinesDisplay.textContent = 'Keine Maschinen zugewiesen';
  }

  // Update modal title
  const modalTitle = document.querySelector('#team-modal-title');
  if (modalTitle !== null) {
    modalTitle.textContent = 'Team bearbeiten';
  }
}

/**
 * Parse IDs from comma-separated string
 */
export function parseIdsFromString(value: string): number[] {
  return value
    .split(',')
    .filter((id) => id.length > 0)
    .map((id) => Number.parseInt(id, 10));
}

/**
 * Process form data for team save
 */
export function processTeamFormData(formData: FormData): ProcessedFormData {
  const teamData: Record<string, string | number> = {};
  let machineIds: number[] = [];
  let userIds: number[] = [];

  formData.forEach((value, key) => {
    if (key === 'machineIds' && typeof value === 'string' && value.length > 0) {
      machineIds = parseIdsFromString(value);
    } else if (key === 'userIds' && typeof value === 'string' && value.length > 0) {
      userIds = parseIdsFromString(value);
    } else if (typeof value === 'string' && value.length > 0) {
      // Whitelist of allowed form field keys to prevent object injection
      switch (key) {
        case 'teamLeadId':
          teamData.leaderId = value;
          break;
        case 'id':
          teamData.id = Number.parseInt(value, 10);
          break;
        case 'name':
          teamData.name = value;
          break;
        case 'description':
          teamData.description = value;
          break;
        case 'departmentId':
          teamData.departmentId = Number.parseInt(value, 10);
          break;
        case 'leaderId':
          teamData.leaderId = Number.parseInt(value, 10);
          break;
        case 'teamType':
          teamData.teamType = value;
          break;
        case 'maxMembers':
          teamData.maxMembers = Number.parseInt(value, 10);
          break;
        case 'status':
          teamData.status = value;
          break;
        // Ignore memberIds as it's handled separately
        case 'memberIds':
          break;
        // Ignore unknown keys for security
        default:
          console.warn(`Ignoring unknown form field: ${key}`);
      }
    }
  });

  return { teamData, machineIds, userIds };
}

// Dropdown Loading Functions

/**
 * Load departments for select dropdown
 */
export async function loadDepartmentsForSelect(select: Element | null, apiClient: ApiClient): Promise<void> {
  if (!select) return;

  try {
    const departments = await apiClient.request<Department[]>('/departments', {
      method: 'GET',
    });

    setSafeHTML(select as HTMLElement, '<option value="">Keine Abteilung</option>');
    departments.forEach((dept: Department) => {
      const option = document.createElement('option');
      option.value = dept.id.toString();
      option.textContent = dept.name;
      select.append(option);
    });
  } catch (error) {
    console.error('Error loading departments:', error);
  }
}

/**
 * Load admins for select dropdown
 */
export async function loadAdminsForSelect(select: Element | null, apiClient: ApiClient): Promise<void> {
  if (!select) return;

  try {
    const usersResponse = await apiClient.request<UserAPIResponse[]>('/users?role=admin', {
      method: 'GET',
    });
    const admins = mapUsers(usersResponse);

    setSafeHTML(select as HTMLElement, '<option value="">Kein Team-Leiter</option>');
    admins.forEach((admin) => {
      const option = document.createElement('option');
      option.value = admin.id.toString();
      const displayName =
        admin.firstName !== '' && admin.lastName !== '' ? `${admin.firstName} ${admin.lastName}` : admin.username;
      option.textContent = displayName;
      select.append(option);
    });
  } catch (error) {
    console.error('Error loading admins:', error);
  }
}

/**
 * Load machines for dropdown
 */
export async function loadMachinesForDropdown(
  dropdown: Element | null,
  apiClient: ApiClient,
  team?: Team,
): Promise<void> {
  if (!dropdown) return;

  try {
    const machineResponse = await apiClient.request<Machine[]>('/machines', {
      method: 'GET',
    });
    const machines = machineResponse;

    setSafeHTML(dropdown as HTMLElement, '');
    if (machines.length === 0) {
      setSafeHTML(
        dropdown as HTMLElement,
        '<div class="dropdown-option" style="color: #666;">Keine Maschinen verfügbar</div>',
      );
    } else {
      machines.forEach((machine) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'dropdown-option';
        optionDiv.style.padding = '8px 12px';
        const isChecked = team?.machines?.some((m) => m.id === machine.id) === true ? 'checked' : '';
        // eslint-disable-next-line no-unsanitized/property -- Safe: We control all machine data
        optionDiv.innerHTML = `
          <label style="display: flex; align-items: center; cursor: pointer; width: 100%;">
            <input type="checkbox" value="${machine.id}"
                   onchange="window.updateMachineSelection()"
                   style="margin-right: 8px;"
                   ${isChecked}>
            <span>${machine.name} ${machine.departmentName !== undefined && machine.departmentName !== null && machine.departmentName !== '' ? `(${machine.departmentName})` : ''}</span>
          </label>
        `;
        dropdown.append(optionDiv);
      });
    }
  } catch (error) {
    console.error('Error loading machines:', error);
  }
}

/**
 * Load users for dropdown
 */
export async function loadUsersForDropdown(dropdown: Element | null, apiClient: ApiClient, team?: Team): Promise<void> {
  if (!dropdown) return;

  try {
    const userResponse = await apiClient.request<UserAPIResponse[]>('/users', {
      method: 'GET',
    });
    const users = mapUsers(userResponse);

    setSafeHTML(dropdown as HTMLElement, '');
    if (users.length === 0) {
      setSafeHTML(
        dropdown as HTMLElement,
        '<div class="dropdown-option" style="color: #666;">Keine Benutzer verfügbar</div>',
      );
    } else {
      users.forEach((user) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'dropdown-option';
        optionDiv.style.padding = '8px 12px';
        const displayName =
          user.firstName !== '' && user.lastName !== '' ? `${user.firstName} ${user.lastName}` : user.username;
        const isChecked = team?.members?.some((u) => u.id === user.id) === true ? 'checked' : '';
        // eslint-disable-next-line no-unsanitized/property -- Safe: We control all user data
        optionDiv.innerHTML = `
          <label style="display: flex; align-items: center; cursor: pointer; width: 100%;">
            <input type="checkbox" value="${user.id}"
                   onchange="window.updateMemberSelection()"
                   style="margin-right: 8px;"
                   ${isChecked}>
            <span>${displayName} ${user.departmentName !== undefined && user.departmentName !== '' && user.departmentName !== 'Keine Abteilung' ? `(${user.departmentName})` : ''}</span>
          </label>
        `;
        dropdown.append(optionDiv);
      });
    }
  } catch (error) {
    console.error('Error loading users:', error);
  }
}
