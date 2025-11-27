/* eslint-disable max-lines */
/**
 * UI and Rendering Functions for Teams Management
 * Contains all UI rendering, form handling, and dropdown loading functions
 *
 * Migration Complete: 2025-01-28
 * - Removed ALL inline styles
 * - Badge Classes → badge--success, badge--warning (BEM)
 * - Action Buttons → Design System buttons
 * - Dropdowns → Design System dropdown component
 * - Table → data-table--striped (Design System)
 * - Member Count Badge with Tooltip (like manage-departments)
 */

import type { Team, Department, Machine, ProcessedFormData } from './types';
import type { User } from '../../../types/api.types';
import { ApiClient } from '../../../utils/api-client';
import { setSafeHTML } from '../../../utils/dom-utils';

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Helper: Create count badge with tooltip (like manage-departments)
 */
function createCountBadge(count: number, names: string, singular: string, plural?: string): string {
  if (count === 0) {
    return '0';
  }

  const label = count === 1 ? singular : (plural ?? `${singular}s`);

  // If no names available, just show count
  if (names === '' || names.trim() === '') {
    return `<span class="badge badge-info">${String(count)} ${label}</span>`;
  }

  // Return badge with data-tooltip attribute for auto-initialization
  return `<span class="badge badge-info" data-tooltip="${escapeHtml(names)}">${String(count)} ${label}</span>`;
}

/**
 * Check if add button should be hidden for current filter
 */
export function shouldHideAddButton(statusFilter: 'all' | 'active' | 'inactive'): boolean {
  return statusFilter === 'inactive';
}

/**
 * Get empty state title based on filter
 */
function getEmptyStateTitle(statusFilter: 'all' | 'active' | 'inactive'): string {
  switch (statusFilter) {
    case 'inactive':
      return 'Keine inaktiven Teams gefunden';
    case 'active':
      return 'Keine aktiven Teams gefunden';
    default:
      return 'Keine Teams gefunden';
  }
}

/**
 * Get empty state description based on filter
 */
function getEmptyStateDescription(statusFilter: 'all' | 'active' | 'inactive'): string {
  return statusFilter === 'inactive' ? 'Es gibt derzeit keine inaktiven Teams' : 'Fügen Sie Ihr erstes Team hinzu';
}

/**
 * Update empty state content based on current filter
 */
export function updateEmptyStateContent(statusFilter: 'all' | 'active' | 'inactive'): void {
  const emptyDiv = document.querySelector('#teams-empty');
  if (emptyDiv === null) return;

  const emptyStateTitle = emptyDiv.querySelector<HTMLElement>('.empty-state__title');
  const emptyStateDesc = emptyDiv.querySelector<HTMLElement>('.empty-state__description');
  const emptyStateAddBtn = emptyDiv.querySelector<HTMLButtonElement>('#empty-state-add-btn');

  // Update title and description based on filter
  if (emptyStateTitle) {
    emptyStateTitle.textContent = getEmptyStateTitle(statusFilter);
  }

  if (emptyStateDesc) {
    emptyStateDesc.textContent = getEmptyStateDescription(statusFilter);
  }

  // Hide/show add button based on filter
  if (emptyStateAddBtn) {
    emptyStateAddBtn.classList.toggle('u-hidden', shouldHideAddButton(statusFilter));
  }
}

/**
 * Toggle table visibility based on team data
 */
export function toggleTableVisibility(show: boolean, statusFilter: 'all' | 'active' | 'inactive' = 'all'): void {
  const teamsEmpty = document.querySelector('#teams-empty');

  if (show) {
    teamsEmpty?.classList.add('u-hidden');
  } else {
    teamsEmpty?.classList.remove('u-hidden');
    updateEmptyStateContent(statusFilter);
  }
}

/**
 * Get status badge class (Design System BEM naming)
 */
export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
      return 'badge--success';
    case 'inactive':
      return 'badge--warning';
    default:
      return 'badge--error';
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
 * Create action buttons HTML for team row
 * Status is now managed via Edit Modal (like in manage-departments)
 */
function createTeamActionButtons(team: Team): string {
  return `
    <div class="flex gap-2">
      <button
        class="action-icon action-icon--edit"
        data-action="edit-team"
        data-team-id="${String(team.id)}"
        title="Bearbeiten"
        aria-label="Team bearbeiten"
      >
        <i class="fas fa-edit"></i>
      </button>
      <button
        class="action-icon action-icon--delete"
        data-action="delete-team"
        data-team-id="${String(team.id)}"
        title="Löschen"
        aria-label="Team löschen"
      >
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `;
}

/**
 * Create a team row HTML (Design System with Action Icons)
 * Follows exact structure of manage-departments.html
 */
export function createTeamRow(team: Team): string {
  const memberCount = team.memberCount ?? 0;
  const machineCount = team.machineCount ?? 0;
  const statusBadge = getStatusBadgeClass(team.status);
  const statusLabel = getStatusLabel(team.status);

  return `
    <tr data-team-id="${team.id}">
      <td>
        <div style="font-weight: 500; color: var(--color-text-primary);">
          ${team.name}
        </div>
      </td>
      <td>
        ${team.departmentName ?? '-'}
      </td>
      <td>
        ${team.leaderName ?? '-'}
      </td>
      <td>
        <div style="text-align: center;">
          ${createCountBadge(memberCount, team.memberNames ?? '', 'Mitglied', 'Mitglieder')}
        </div>
      </td>
      <td>
        <div style="text-align: center;">
          ${createCountBadge(machineCount, team.machineNames ?? '', 'Maschine', 'Maschinen')}
        </div>
      </td>
      <td>
        <span class="badge ${statusBadge}">${statusLabel}</span>
      </td>
      <td>
        ${new Date(team.createdAt).toLocaleDateString('de-DE')}
      </td>
      <td>
        ${createTeamActionButtons(team)}
      </td>
    </tr>
  `;
}

/**
 * Set input value helper
 */
function setInputValue(id: string, value: string | number | null | undefined): void {
  const input = document.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`);
  if (input === null) return;

  input.value = value !== null && value !== undefined ? value.toString() : '';
}

/**
 * Update dropdown trigger text
 */
function updateDropdownTrigger(selector: string, text: string | undefined): void {
  if (text === undefined || text === '') return;

  const trigger = document.querySelector(selector);
  if (trigger) trigger.textContent = text;
}

/**
 * Update members display
 */
function updateMembersDisplay(members: Team['members']): void {
  const display = document.querySelector('#team-members-display');
  if (display === null) return;

  if (members === undefined || members.length === 0) {
    display.textContent = 'Keine Mitglieder zugewiesen';
    return;
  }

  const memberNames = members
    .map((m) => `${m.firstName} ${m.lastName}`)
    .slice(0, 2)
    .join(', ');

  display.textContent = members.length > 2 ? `${memberNames} +${members.length - 2} weitere` : memberNames;
}

/**
 * Update machines display
 */
function updateMachinesDisplay(machines: Team['machines']): void {
  const display = document.querySelector('#team-machines-display');
  if (display === null) return;

  if (machines === undefined || machines.length === 0) {
    display.textContent = 'Keine Maschinen zugewiesen';
    return;
  }

  const machineNames = machines
    .map((m) => m.name)
    .slice(0, 2)
    .join(', ');

  display.textContent = machines.length > 2 ? `${machineNames} +${machines.length - 2} weitere` : machineNames;
}

/**
 * Populate team form with data
 */
export function populateTeamForm(team: Team): void {
  setInputValue('team-id', team.id);
  setInputValue('team-name', team.name);
  setInputValue('team-description', team.description);
  setInputValue('team-department', team.departmentId);
  setInputValue('team-lead', team.leaderId);
  setInputValue('team-status', team.status);

  updateDropdownTrigger('#department-trigger span', team.departmentName);
  updateDropdownTrigger('#team-lead-trigger span', team.leaderName);

  // Update status dropdown
  const statusTrigger = document.querySelector<HTMLElement>('#status-trigger span');
  if (statusTrigger) {
    setSafeHTML(
      statusTrigger,
      `<span class="badge ${getStatusBadgeClass(team.status)}">${getStatusLabel(team.status)}</span>`,
    );
  }

  updateMembersDisplay(team.members);
  updateMachinesDisplay(team.machines);

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
          teamData['leaderId'] = Number.parseInt(value, 10);
          break;
        case 'id':
          teamData['id'] = Number.parseInt(value, 10);
          break;
        case 'name':
          teamData['name'] = value;
          break;
        case 'description':
          teamData['description'] = value;
          break;
        case 'departmentId':
          teamData['departmentId'] = Number.parseInt(value, 10);
          break;
        case 'status':
          teamData['status'] = value;
          break;
        // Ignore unknown keys for security
        default:
          console.warn(`Ignoring unknown form field: ${key}`);
      }
    }
  });

  return { teamData, machineIds, userIds };
}

// Dropdown Loading Functions (Design System)

/**
 * Load departments for dropdown (Design System)
 */
export async function loadDepartmentsForDropdown(apiClient: ApiClient, selectedId?: number | null): Promise<void> {
  const menu = document.querySelector<HTMLElement>('#department-menu');
  if (!menu) return;

  try {
    const departments = await apiClient.request<Department[]>('/departments', {
      method: 'GET',
    });

    // Clear existing options except the first one (None)
    setSafeHTML(
      menu,
      '<div class="dropdown__option" data-value=""><i class="fas fa-folder-open"></i> Keine Abteilung</div>',
    );

    departments.forEach((dept: Department) => {
      const option = document.createElement('div');
      option.className = 'dropdown__option';
      option.dataset['value'] = dept.id.toString();
      setSafeHTML(option, `<i class="fas fa-building"></i> ${dept.name}`);
      menu.append(option);
    });

    // Select the option if selectedId is provided
    if (selectedId !== null && selectedId !== undefined && selectedId !== 0) {
      const trigger = document.querySelector('#department-trigger span');
      const selected = departments.find((d) => d.id === selectedId);
      if (trigger && selected) {
        trigger.textContent = selected.name;
      }
    }
  } catch (error) {
    console.error('Error loading departments:', error);
  }
}

/**
 * Get admin display name
 */
function getAdminDisplayName(admin: {
  firstName?: string | undefined;
  lastName?: string | undefined;
  username: string;
  employeeNumber?: string | undefined;
}): string {
  const firstName = admin.firstName ?? '';
  const lastName = admin.lastName ?? '';
  const displayName = firstName !== '' && lastName !== '' ? `${firstName} ${lastName}` : admin.username;
  const employeeInfo =
    admin.employeeNumber !== undefined && admin.employeeNumber !== '' ? ` (${admin.employeeNumber})` : '';
  return `${displayName}${employeeInfo}`;
}

/**
 * Select admin in dropdown trigger
 */
function selectAdminInDropdown(admins: User[], selectedId: number): void {
  const trigger = document.querySelector('#team-lead-trigger span');
  const selected = admins.find((a) => a.id === selectedId);

  if (trigger === null || selected === undefined) return;

  trigger.textContent = getAdminDisplayName(selected);
}

/**
 * Load admins for dropdown (Design System)
 */
export async function loadAdminsForDropdown(apiClient: ApiClient, selectedId?: number | null): Promise<void> {
  const menu = document.querySelector<HTMLElement>('#team-lead-menu');
  if (!menu) return;

  try {
    // Backend already returns camelCase via fieldMapping
    const admins = await apiClient.request<User[]>('/users?role=admin', {
      method: 'GET',
    });

    // Clear existing options except the first one (None)
    setSafeHTML(
      menu,
      '<div class="dropdown__option" data-value=""><i class="fas fa-user-slash"></i> Kein Team-Leiter</div>',
    );

    admins.forEach((admin) => {
      const displayName = getAdminDisplayName(admin);

      const option = document.createElement('div');
      option.className = 'dropdown__option';
      option.dataset['value'] = admin.id.toString();
      setSafeHTML(option, `<i class="fas fa-user-tie"></i> ${displayName}`);
      menu.append(option);
    });

    // Select the option if selectedId is provided
    if (selectedId !== null && selectedId !== undefined && selectedId !== 0) {
      selectAdminInDropdown(admins, selectedId);
    }
  } catch (error) {
    console.error('Error loading admins:', error);
  }
}

/**
 * Load machines for dropdown with checkboxes (Design System)
 */
export async function loadMachinesForDropdown(apiClient: ApiClient, team?: Team): Promise<void> {
  const menu = document.querySelector<HTMLElement>('#team-machines-menu');
  if (!menu) return;

  try {
    const machines = await apiClient.request<Machine[]>('/machines', {
      method: 'GET',
    });

    setSafeHTML(menu, '');
    if (machines.length === 0) {
      setSafeHTML(menu, '<div class="dropdown__option dropdown__option--disabled">Keine Maschinen verfügbar</div>');
    } else {
      machines.forEach((machine) => {
        const isChecked = team?.machines?.some((m) => m.id === machine.id) === true;
        const option = document.createElement('label');
        option.className = 'dropdown__option dropdown__option--checkbox';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = machine.id.toString();
        checkbox.checked = isChecked;
        checkbox.className = 'mr-2';

        const span = document.createElement('span');
        const deptInfo =
          machine.departmentName !== null && machine.departmentName !== undefined && machine.departmentName !== ''
            ? ` (${machine.departmentName})`
            : '';
        span.textContent = `${machine.name}${deptInfo}`;

        option.appendChild(checkbox);
        option.appendChild(span);
        menu.append(option);
      });
    }
  } catch (error) {
    console.error('Error loading machines:', error);
  }
}

/**
 * Load users for dropdown with checkboxes (Design System)
 */
export async function loadUsersForDropdown(apiClient: ApiClient, team?: Team): Promise<void> {
  const menu = document.querySelector<HTMLElement>('#team-members-menu');
  if (!menu) return;

  try {
    // Backend already returns camelCase via fieldMapping
    const users = await apiClient.request<User[]>('/users', {
      method: 'GET',
    });

    setSafeHTML(menu, '');
    if (users.length === 0) {
      setSafeHTML(menu, '<div class="dropdown__option dropdown__option--disabled">Keine Benutzer verfügbar</div>');
    } else {
      users.forEach((user) => {
        const displayName =
          user.firstName !== undefined && user.firstName !== '' && user.lastName !== undefined && user.lastName !== ''
            ? `${user.firstName} ${user.lastName}`
            : user.username;
        const isChecked = team?.members?.some((u) => u.id === user.id) === true;

        const option = document.createElement('label');
        option.className = 'dropdown__option dropdown__option--checkbox';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = user.id.toString();
        checkbox.checked = isChecked;
        checkbox.className = 'mr-2';

        const span = document.createElement('span');
        const employeeInfo =
          user.employeeNumber !== undefined && user.employeeNumber !== '' ? ` (${user.employeeNumber})` : '';
        span.textContent = `${displayName}${employeeInfo}`;

        option.appendChild(checkbox);
        option.appendChild(span);
        menu.append(option);
      });
    }
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

/**
 * Setup dropdown listeners (Design System)
 */
export function setupDropdownListeners(): void {
  // Department dropdown
  document.querySelectorAll('#department-menu .dropdown__option').forEach((option) => {
    option.addEventListener('click', () => {
      const value = (option as HTMLElement).dataset['value'] ?? '';
      const text = option.textContent.trim();
      const input = document.querySelector<HTMLInputElement>('#team-department');
      const trigger = document.querySelector('#department-trigger span');

      if (input) input.value = value;
      if (trigger) trigger.textContent = text;

      // Close dropdown
      document.querySelector('#department-dropdown .dropdown__menu')?.classList.remove('active');
    });
  });

  // Team lead dropdown
  document.querySelectorAll('#team-lead-menu .dropdown__option').forEach((option) => {
    option.addEventListener('click', () => {
      const value = (option as HTMLElement).dataset['value'] ?? '';
      const text = option.textContent.trim();
      const input = document.querySelector<HTMLInputElement>('#team-lead');
      const trigger = document.querySelector('#team-lead-trigger span');

      if (input) input.value = value;
      if (trigger) trigger.textContent = text;

      // Close dropdown
      document.querySelector('#team-lead-dropdown .dropdown__menu')?.classList.remove('active');
    });
  });

  // Status dropdown
  document.querySelectorAll('#status-menu .dropdown__option').forEach((option) => {
    option.addEventListener('click', () => {
      const value = (option as HTMLElement).dataset['value'] ?? '';
      const badgeHTML = option.innerHTML;
      const input = document.querySelector<HTMLInputElement>('#team-status');
      const trigger = document.querySelector<HTMLElement>('#status-trigger span');

      if (input) input.value = value;
      if (trigger) setSafeHTML(trigger, badgeHTML);

      // Close dropdown
      document.querySelector('#status-dropdown .dropdown__menu')?.classList.remove('active');
    });
  });

  // Team members dropdown - Update display on checkbox change
  document.querySelectorAll('#team-members-menu input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      updateMemberSelection();
    });
  });

  // Team machines dropdown - Update display on checkbox change
  document.querySelectorAll('#team-machines-menu input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      updateMachineSelection();
    });
  });
}

/**
 * Update member selection display
 */
function updateMemberSelection(): void {
  const menu = document.querySelector('#team-members-menu');
  const display = document.querySelector('#team-members-display');
  const input = document.querySelector<HTMLInputElement>('#team-members-select');

  if (!menu || !display || !input) return;

  const checkboxes = menu.querySelectorAll('input[type="checkbox"]:checked');
  const selectedIds: string[] = [];
  const selectedNames: string[] = [];

  checkboxes.forEach((checkbox) => {
    const cb = checkbox as HTMLInputElement;
    selectedIds.push(cb.value);
    const label = cb.parentElement?.querySelector('span');
    const labelText = label?.textContent ?? '';
    if (labelText !== '') {
      selectedNames.push(labelText.split(' (')[0]?.trim() ?? '');
    }
  });

  input.value = selectedIds.join(',');

  if (selectedNames.length === 0) {
    display.textContent = 'Keine Mitglieder zugewiesen';
  } else if (selectedNames.length <= 2) {
    display.textContent = selectedNames.join(', ');
  } else {
    display.textContent = `${selectedNames.slice(0, 2).join(', ')} +${selectedNames.length - 2} weitere`;
  }
}

/**
 * Update machine selection display
 */
function updateMachineSelection(): void {
  const menu = document.querySelector('#team-machines-menu');
  const display = document.querySelector('#team-machines-display');
  const input = document.querySelector<HTMLInputElement>('#team-machines-select');

  if (!menu || !display || !input) return;

  const checkboxes = menu.querySelectorAll('input[type="checkbox"]:checked');
  const selectedIds: string[] = [];
  const selectedNames: string[] = [];

  checkboxes.forEach((checkbox) => {
    const cb = checkbox as HTMLInputElement;
    selectedIds.push(cb.value);
    const label = cb.parentElement?.querySelector('span');
    const labelText = label?.textContent ?? '';
    if (labelText !== '') {
      selectedNames.push(labelText.split(' (')[0]?.trim() ?? '');
    }
  });

  input.value = selectedIds.join(',');

  if (selectedNames.length === 0) {
    display.textContent = 'Keine Maschinen zugewiesen';
  } else if (selectedNames.length <= 2) {
    display.textContent = selectedNames.join(', ');
  } else {
    display.textContent = `${selectedNames.slice(0, 2).join(', ')} +${selectedNames.length - 2} weitere`;
  }
}
