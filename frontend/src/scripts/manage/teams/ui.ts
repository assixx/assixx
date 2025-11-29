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
 * Update status hidden inputs based on status value
 */
function updateTeamStatusInputs(value: string): void {
  const isActiveInput = document.querySelector<HTMLInputElement>('#team-is-active');
  const isArchivedInput = document.querySelector<HTMLInputElement>('#team-is-archived');

  if (isActiveInput === null || isArchivedInput === null) return;

  switch (value) {
    case 'inactive':
      isActiveInput.value = '0';
      isArchivedInput.value = '0';
      break;
    case 'archived':
      isActiveInput.value = '0';
      isArchivedInput.value = '1';
      break;
    default: // active
      isActiveInput.value = '1';
      isArchivedInput.value = '0';
  }
}

/**
 * Handle status dropdown option click
 */
function handleStatusOptionClick(option: HTMLElement): void {
  const value = option.dataset['value'] ?? '';
  const badgeHTML = option.innerHTML;
  const trigger = document.querySelector<HTMLElement>('#status-trigger span');

  updateTeamStatusInputs(value);

  if (trigger !== null) {
    setSafeHTML(trigger, badgeHTML);
  }

  // Close dropdown
  document.querySelector('#status-dropdown .dropdown__menu')?.classList.remove('active');
}

/**
 * Helper: Create count badge with native title tooltip
 */
function createCountBadge(count: number, names: string, singular: string, plural?: string): string {
  if (count === 0) {
    return '<span class="badge badge--secondary" title="Keine zugewiesen">0</span>';
  }

  const label = count === 1 ? singular : (plural ?? `${singular}s`);

  // If no names available, just show count without tooltip
  if (names === '' || names.trim() === '') {
    return `<span class="badge badge--info">${String(count)} ${label}</span>`;
  }

  // Return badge with native title tooltip
  return `<span class="badge badge--info" title="${escapeHtml(names)}">${String(count)} ${label}</span>`;
}

/**
 * Get empty state title based on filter
 */
function getEmptyStateTitle(statusFilter: 'all' | 'active' | 'inactive' | 'archived'): string {
  switch (statusFilter) {
    case 'inactive':
      return 'Keine inaktiven Teams gefunden';
    case 'active':
      return 'Keine aktiven Teams gefunden';
    case 'archived':
      return 'Keine archivierten Teams gefunden';
    default:
      return 'Keine Teams gefunden';
  }
}

/**
 * Get empty state description based on filter
 */
function getEmptyStateDescription(statusFilter: 'all' | 'active' | 'inactive' | 'archived'): string {
  switch (statusFilter) {
    case 'inactive':
      return 'Es gibt derzeit keine inaktiven Teams';
    case 'archived':
      return 'Es gibt derzeit keine archivierten Teams';
    default:
      return 'Fügen Sie Ihr erstes Team hinzu';
  }
}

/**
 * Update empty state content based on current filter
 */
export function updateEmptyStateContent(statusFilter: 'all' | 'active' | 'inactive' | 'archived'): void {
  const emptyDiv = document.querySelector('#teams-empty');
  if (emptyDiv === null) return;

  const emptyStateTitle = emptyDiv.querySelector<HTMLElement>('.empty-state__title');
  const emptyStateDesc = emptyDiv.querySelector<HTMLElement>('.empty-state__description');

  // Update title and description based on filter
  if (emptyStateTitle) {
    emptyStateTitle.textContent = getEmptyStateTitle(statusFilter);
  }

  if (emptyStateDesc) {
    emptyStateDesc.textContent = getEmptyStateDescription(statusFilter);
  }
}

/**
 * Toggle table visibility based on team data
 */
export function toggleTableVisibility(
  show: boolean,
  statusFilter: 'all' | 'active' | 'inactive' | 'archived' = 'all',
): void {
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
 * Parse nullable ID field - returns null for empty string, number otherwise
 */
function parseNullableId(value: string): number | null {
  return value.length > 0 ? Number.parseInt(value, 10) : null;
}

/**
 * Process a single team form field
 * Returns true if field was processed, false if unknown
 */
function processTeamField(teamData: Record<string, string | number | null>, key: string, value: string): boolean {
  // Nullable ID fields (can be cleared to null)
  if (key === 'teamLeadId') {
    teamData['leaderId'] = parseNullableId(value);
    return true;
  }
  if (key === 'departmentId') {
    teamData['departmentId'] = parseNullableId(value);
    return true;
  }

  // Required/optional string fields (only set if non-empty)
  if (key === 'id' && value.length > 0) {
    teamData['id'] = Number.parseInt(value, 10);
    return true;
  }
  if (key === 'name' && value.length > 0) {
    teamData['name'] = value;
    return true;
  }
  if (key === 'description') {
    teamData['description'] = value;
    return true;
  }
  if (key === 'status' && value.length > 0) {
    teamData['status'] = value;
    return true;
  }

  return false;
}

/**
 * Process form data for team save
 */
export function processTeamFormData(formData: FormData): ProcessedFormData {
  const teamData: Record<string, string | number | null> = {};
  let machineIds: number[] = [];
  let userIds: number[] = [];

  formData.forEach((value, key) => {
    if (typeof value !== 'string') return;

    if (key === 'machineIds' && value.length > 0) {
      machineIds = parseIdsFromString(value);
      return;
    }
    if (key === 'userIds' && value.length > 0) {
      userIds = parseIdsFromString(value);
      return;
    }

    const processed = processTeamField(teamData, key, value);
    if (!processed) {
      console.warn(`Ignoring unknown form field: ${key}`);
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
    // Fetch both root AND admin users - both can be team leads
    // Team lead must be root or admin (enforced by DB trigger)
    const [roots, admins] = await Promise.all([
      apiClient.request<User[]>('/users?role=root', { method: 'GET' }),
      apiClient.request<User[]>('/users?role=admin', { method: 'GET' }),
    ]);
    const allLeaders = [...roots, ...admins];

    // Clear existing options except the first one (None)
    setSafeHTML(
      menu,
      '<div class="dropdown__option" data-value=""><i class="fas fa-user-slash"></i> Kein Team-Leiter</div>',
    );

    allLeaders.forEach((leader) => {
      const displayName = getAdminDisplayName(leader);
      const roleIcon = leader.role === 'root' ? 'fa-crown' : 'fa-user-tie';

      const option = document.createElement('div');
      option.className = 'dropdown__option';
      option.dataset['value'] = leader.id.toString();
      setSafeHTML(option, `<i class="fas ${roleIcon}"></i> ${displayName}`);
      menu.append(option);
    });

    // Select the option if selectedId is provided
    if (selectedId !== null && selectedId !== undefined && selectedId !== 0) {
      selectAdminInDropdown(allLeaders, selectedId);
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
 * NOTE: Only loads employees - team membership is for employees only
 * (enforced by DB trigger: trg_user_teams_role_check)
 */
export async function loadUsersForDropdown(apiClient: ApiClient, team?: Team): Promise<void> {
  const menu = document.querySelector<HTMLElement>('#team-members-menu');
  if (!menu) return;

  try {
    // Only load employees - admins/root cannot be team members (they get access via permissions)
    const users = await apiClient.request<User[]>('/users?role=employee', {
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

  // Status dropdown - Maps UI values to DB fields (isActive + isArchived)
  document.querySelectorAll('#status-menu .dropdown__option').forEach((option) => {
    option.addEventListener('click', () => {
      handleStatusOptionClick(option as HTMLElement);
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
