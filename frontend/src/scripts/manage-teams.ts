/**
 * Admin Teams Management
 * Handles team CRUD operations for admin dashboard
 */

import { ApiClient } from '../utils/api-client';
import { mapTeams, mapUsers, type TeamAPIResponse, type UserAPIResponse, type MappedTeam } from '../utils/api-mappers';
import { setSafeHTML } from '../utils/dom-utils';
import { showSuccessAlert, showErrorAlert } from './utils/alerts';

// Constants
const DELETE_TEAM_MODAL_ID = '#delete-team-modal';

interface TeamMember {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  position?: string | null;
  employeeId?: string;
}

interface Team {
  id: number;
  name: string;
  description?: string;
  leaderId?: number;
  leaderName?: string;
  departmentId?: number;
  departmentName?: string;
  areaId?: number;
  shiftModelId?: number;
  memberCount?: number;
  memberNames?: string;
  maxMembers?: number;
  teamType?: 'production' | 'quality' | 'maintenance' | 'logistics' | 'administration' | 'other';
  status: 'active' | 'inactive' | 'restructuring';
  foundedDate?: string;
  costCenter?: string;
  budget?: number;
  performanceScore?: number;
  notes?: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
  members?: TeamMember[];
  machines?: { id: number; name: string }[];
}

// ApiResponse interface removed - not used in this file

interface Department {
  id: number;
  name: string;
}

interface Machine {
  id: number;
  name: string;
  departmentId?: number | null;
  departmentName?: string | null;
  areaId?: number | null;
  status?: string;
}

// Use this type for users loaded in teams module to avoid conflicts

interface WindowWithTeamHandlers extends Window {
  editTeam?: (id: number) => Promise<void>;
  viewTeamDetails?: (id: number) => Promise<void>;
  deleteTeam?: (id: number) => void;
  toggleTeamStatus?: (id: number, status: string) => Promise<void>;
  showTeamModal?: () => Promise<void>;
  closeTeamModal?: () => void;
  saveTeam?: () => Promise<void>;
}

class TeamsManager {
  public apiClient: ApiClient; // Made public for access in global functions
  private teams: Team[] = [];
  private currentFilter: 'all' | 'active' | 'inactive' = 'all';
  private searchTerm = '';
  private useV2API = true; // Default to v2 API

  constructor() {
    this.apiClient = ApiClient.getInstance();
    // Check feature flag for v2 API
    const w = window as Window & { FEATURE_FLAGS?: { USE_API_V2_TEAMS?: boolean } };
    this.useV2API = w.FEATURE_FLAGS?.USE_API_V2_TEAMS !== false;
    this.initializeEventListeners();
    // Load teams initially
    void this.loadTeams();
  }

  async loadDepartments(): Promise<Department[] | null> {
    try {
      return await this.apiClient.request<Department[]>('/departments', {
        method: 'GET',
      });
    } catch (error) {
      console.error('Error loading departments:', error);
      return null;
    }
  }

  private initializeEventListeners() {
    // Add button
    document.querySelector('#add-team-btn')?.addEventListener('click', () => {
      void (window as WindowWithTeamHandlers).showTeamModal?.();
    });

    // Modal close buttons
    document.querySelector('#close-team-modal')?.addEventListener('click', () => {
      (window as WindowWithTeamHandlers).closeTeamModal?.();
    });
    document.querySelector('#cancel-team-modal')?.addEventListener('click', () => {
      (window as WindowWithTeamHandlers).closeTeamModal?.();
    });

    // Form submit
    document.querySelector('#team-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      void (window as WindowWithTeamHandlers).saveTeam?.();
    });

    // Delete modal
    document.querySelector('#confirm-delete-team')?.addEventListener('click', () => {
      const deleteInput = document.querySelector<HTMLInputElement>('#delete-team-id');
      if (deleteInput !== null && deleteInput.value !== '') {
        void this.confirmDeleteTeam(Number.parseInt(deleteInput.value, 10));
      }
    });
    document.querySelector('#close-delete-modal')?.addEventListener('click', () => {
      const modal = document.querySelector(DELETE_TEAM_MODAL_ID);
      if (modal) modal.classList.remove('active');
    });
    document.querySelector('#cancel-delete-modal')?.addEventListener('click', () => {
      const modal = document.querySelector(DELETE_TEAM_MODAL_ID);
      if (modal) modal.classList.remove('active');
    });

    // Filter buttons
    document.querySelector('#show-all-teams')?.addEventListener('click', () => {
      this.currentFilter = 'all';
      void this.loadTeams();
    });

    document.querySelector('#filter-teams-active')?.addEventListener('click', () => {
      this.currentFilter = 'active';
      void this.loadTeams();
    });

    document.querySelector('#filter-teams-inactive')?.addEventListener('click', () => {
      this.currentFilter = 'inactive';
      void this.loadTeams();
    });

    // Search
    document.querySelector('#team-search-btn')?.addEventListener('click', () => {
      const searchInput = document.querySelector<HTMLInputElement>('#team-search');
      this.searchTerm = searchInput !== null ? searchInput.value : '';
      void this.loadTeams();
    });

    // Enter key on search
    document.querySelector('#team-search')?.addEventListener('keypress', (e) => {
      const keyboardEvent = e as KeyboardEvent;
      if (keyboardEvent.key === 'Enter') {
        const searchInput = e.target as HTMLInputElement;
        this.searchTerm = searchInput.value;
        void this.loadTeams();
      }
    });

    // Event delegation for team actions
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      this.handleTeamAction(target);
    });
  }

  private handleDropdownToggle(target: HTMLElement): void {
    const dropdownToggle = target.closest<HTMLElement>('[data-action="toggle-dropdown"]');
    if (!dropdownToggle) return;

    const dropdownId = dropdownToggle.dataset.dropdown;
    const windowWithToggle = window as WindowWithTeamHandlers & { toggleDropdown?: (dropdownId: string) => void };

    if (dropdownId !== undefined && dropdownId !== '' && 'toggleDropdown' in windowWithToggle) {
      windowWithToggle.toggleDropdown(dropdownId);
    }
  }

  private handleEditTeam(target: HTMLElement, w: WindowWithTeamHandlers): void {
    const editBtn = target.closest<HTMLElement>('[data-action="edit-team"]');
    if (!editBtn) return;

    const teamId = editBtn.dataset.teamId;
    if (teamId !== undefined && w.editTeam) {
      void w.editTeam(Number.parseInt(teamId, 10));
    }
  }

  private handleToggleTeamStatus(target: HTMLElement, w: WindowWithTeamHandlers): void {
    const toggleBtn = target.closest<HTMLElement>('[data-action="toggle-team-status"]');
    if (!toggleBtn) return;

    const teamId = toggleBtn.dataset.teamId;
    const status = toggleBtn.dataset.status;
    if (teamId !== undefined && status !== undefined && w.toggleTeamStatus) {
      void w.toggleTeamStatus(Number.parseInt(teamId, 10), status);
    }
  }

  private handleDeleteTeam(target: HTMLElement, w: WindowWithTeamHandlers): void {
    const deleteBtn = target.closest<HTMLElement>('[data-action="delete-team"]');
    if (!deleteBtn) return;

    const teamId = deleteBtn.dataset.teamId;
    if (teamId !== undefined && w.deleteTeam) {
      w.deleteTeam(Number.parseInt(teamId, 10));
    }
  }

  private handleTeamAction(target: HTMLElement): void {
    const w = window as WindowWithTeamHandlers;

    this.handleDropdownToggle(target);
    this.handleEditTeam(target, w);
    this.handleToggleTeamStatus(target, w);
    this.handleDeleteTeam(target, w);
  }

  async loadTeams(): Promise<void> {
    try {
      const params: Record<string, string> = {};

      if (this.currentFilter !== 'all') {
        params.status = this.currentFilter;
      }

      if (this.searchTerm.length > 0) {
        params.search = this.searchTerm;
      }

      // ApiClient adds /api/v2 or /api prefix automatically based on feature flag
      const response = await this.apiClient.request<TeamAPIResponse[]>('/teams', {
        method: 'GET',
      });

      // Map response through api-mappers for consistent field names (only for v2)
      // Handle both v2 (with mappers) and v1 responses
      if (this.useV2API) {
        // Map through api-mappers for consistent field names
        // TypeScript workaround for mapTeams import issue
        const mapFunction = mapTeams as (teams: TeamAPIResponse[]) => MappedTeam[];
        const mappedData = mapFunction(response);
        this.teams = mappedData as Team[];
      } else {
        this.teams = response as Team[];
      }
      this.renderTeamsTable();
    } catch (error) {
      console.error('Error loading teams:', error);
      showErrorAlert('Fehler beim Laden der Teams');
    }
  }

  private toggleTableVisibility(show: boolean) {
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

  private createMemberBadge(team: Team): string {
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

  private createTeamRow(team: Team): string {
    return `
      <tr>
        <td><strong>${team.name}</strong></td>
        <td>${team.departmentName ?? '-'}</td>
        <td>${team.leaderName ?? '-'}</td>
        <td>${this.createMemberBadge(team)}</td>
        <td>
          <span class="badge ${this.getStatusBadgeClass(team.status)}">
            ${this.getStatusLabel(team.status)}
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

  private addTooltipListeners(tbody: Element) {
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

  private renderTeamsTable() {
    const tbody = document.querySelector('#teams-table-body');
    if (tbody === null) return;

    if (this.teams.length === 0) {
      this.toggleTableVisibility(false);
      tbody.innerHTML = '';
      return;
    }

    this.toggleTableVisibility(true);

    const tableHTML = this.teams.map((team) => this.createTeamRow(team)).join('');

    // eslint-disable-next-line no-unsanitized/property -- Safe: We control all data in tableHTML
    tbody.innerHTML = tableHTML;

    this.addTooltipListeners(tbody);
  }

  private getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'active':
        return 'badge-success';
      case 'inactive':
        return 'badge-secondary';
      default:
        return 'badge-secondary';
    }
  }

  private getStatusLabel(status: string): string {
    switch (status) {
      case 'active':
        return 'Aktiv';
      case 'inactive':
        return 'Inaktiv';
      default:
        return status;
    }
  }

  async createTeam(teamData: Partial<Team>): Promise<Team> {
    try {
      const response = await this.apiClient.request<Team>('/teams', {
        method: 'POST',
        body: JSON.stringify(teamData),
      });

      showSuccessAlert('Team erfolgreich erstellt');
      await this.loadTeams();
      return response;
    } catch (error) {
      console.error('Error creating team:', error);
      showErrorAlert('Fehler beim Erstellen des Teams');
      throw error;
    }
  }

  async updateTeam(id: number, teamData: Partial<Team>): Promise<Team> {
    try {
      const response = await this.apiClient.request<Team>(`/teams/${id}`, {
        method: 'PUT',
        body: JSON.stringify(teamData),
      });

      showSuccessAlert('Team erfolgreich aktualisiert');
      await this.loadTeams();
      return response;
    } catch (error) {
      console.error('Error updating team:', error);
      showErrorAlert('Fehler beim Aktualisieren des Teams');
      throw error;
    }
  }

  deleteTeam(id: number): void {
    // Show confirmation modal
    const modal = document.querySelector(DELETE_TEAM_MODAL_ID);
    const deleteInput = document.querySelector<HTMLInputElement>('#delete-team-id');

    if (modal === null || deleteInput === null) {
      showErrorAlert('Löschbestätigungs-Modal nicht gefunden');
      return;
    }

    // Set the team ID in the hidden input
    deleteInput.value = id.toString();

    // Show the modal
    modal.classList.add('active');
  }

  private closeDeleteModal(): void {
    const modal = document.querySelector(DELETE_TEAM_MODAL_ID);
    if (modal !== null) {
      modal.classList.remove('active');
    }
  }

  private async handleDeleteSuccess(): Promise<void> {
    showSuccessAlert('Team erfolgreich gelöscht');
    this.closeDeleteModal();
    await this.loadTeams();
  }

  private async handleForceDelete(id: number, memberCount: number | string): Promise<void> {
    const confirmMsg = `Das Team hat ${memberCount} Mitglieder. Möchten Sie das Team trotzdem löschen? Alle Mitglieder werden automatisch aus dem Team entfernt.`;

    if (!confirm(confirmMsg)) {
      return;
    }

    await this.apiClient.request(`/teams/${id}?force=true`, {
      method: 'DELETE',
    });

    showSuccessAlert('Team und alle Mitgliederzuordnungen erfolgreich gelöscht');
    this.closeDeleteModal();
    await this.loadTeams();
  }

  private handleDeleteError(error: unknown): void {
    const errorObj = error as { message?: string; code?: string };

    if (
      errorObj.code === 'FOREIGN_KEY_CONSTRAINT' ||
      errorObj.message?.includes('foreign key') === true ||
      errorObj.message?.includes('Cannot delete team with machines') === true
    ) {
      showErrorAlert('Team kann nicht gelöscht werden, da noch Zuordnungen (Maschinen) existieren');
    } else {
      console.error('Error deleting team:', error);
      showErrorAlert('Fehler beim Löschen des Teams');
    }
  }

  async confirmDeleteTeam(id: number): Promise<void> {
    try {
      await this.apiClient.request(`/teams/${id}`, {
        method: 'DELETE',
      });
      await this.handleDeleteSuccess();
    } catch (error) {
      const errorObj = error as { message?: string; code?: string; details?: { memberCount?: number } };

      if (errorObj.message?.includes('Cannot delete team with members') === true) {
        try {
          const memberCount = errorObj.details?.memberCount ?? 'einige';
          await this.handleForceDelete(id, memberCount);
        } catch (forceError) {
          console.error('Error force deleting team:', forceError);
          showErrorAlert('Fehler beim Löschen des Teams');
        }
      } else {
        this.handleDeleteError(error);
      }
    }
  }

  async getTeamDetails(id: number): Promise<Team | null> {
    try {
      return await this.apiClient.request<Team>(`/teams/${id}`, {
        method: 'GET',
      });
    } catch (error) {
      console.error('Error getting team details:', error);
      showErrorAlert('Fehler beim Laden der Teamdetails');
      return null;
    }
  }
}

// Initialize when DOM is ready
let teamsManager: TeamsManager | null = null;

function setupUrlChangeHandlers(): void {
  const checkTeamsVisibility = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const section = urlParams.get('section');
    if (section === 'teams') {
      void teamsManager?.loadTeams();
    }
  };

  // Check on initial load
  checkTeamsVisibility();

  // Listen for URL changes
  window.addEventListener('popstate', checkTeamsVisibility);

  // Also check when section parameter changes
  const originalPushState = window.history.pushState.bind(window.history);
  window.history.pushState = function (...args) {
    originalPushState.apply(window.history, args);
    setTimeout(checkTeamsVisibility, 100);
  };

  const originalReplaceState = window.history.replaceState.bind(window.history);
  window.history.replaceState = function (...args) {
    originalReplaceState.apply(window.history, args);
    setTimeout(checkTeamsVisibility, 100);
  };
}

// Window handler functions
function setupSelectDropdownOption(): void {
  (
    window as WindowWithTeamHandlers & {
      selectDropdownOption?: (fieldId: string, value: string, displayText: string) => void;
    }
  ).selectDropdownOption = (fieldId: string, value: string, displayText: string) => {
    const input = document.querySelector<HTMLInputElement>(`#${fieldId}-select`);
    const display = document.querySelector(`#${fieldId}-display`);

    if (input !== null) {
      input.value = value;
    }
    if (display !== null) {
      const span = display.querySelector('span');
      if (span !== null) span.textContent = displayText;
    }

    // Close dropdown
    const dropdown = document.querySelector(`#${fieldId}-dropdown`);
    if (dropdown !== null) {
      dropdown.classList.remove('active');
    }
  };
}

function setupWindowHandlers(): void {
  setupLoadTeamsTable();
  setupToggleDropdown();
  setupUpdateMemberSelection();
  setupUpdateMachineSelection();
  setupSelectDropdownOption();
}

function setupEditTeam(): void {
  const w = window as unknown as WindowWithTeamHandlers;
  w.editTeam = async (id: number) => {
    const team = await teamsManager?.getTeamDetails(id);
    if (team === null || team === undefined) return;

    const modal = document.querySelector('#team-modal');
    if (modal === null) return;

    modal.classList.add('active');

    // Load all dropdowns in parallel
    await Promise.all([
      loadDepartmentsForSelect(document.querySelector<HTMLSelectElement>('#team-department')),
      loadAdminsForSelect(document.querySelector<HTMLSelectElement>('#team-lead')),
      loadMachinesForDropdown(document.querySelector('#team-machines-dropdown'), team),
      loadUsersForDropdown(document.querySelector('#team-members-dropdown'), team),
    ]);

    // Populate form with team data
    populateTeamForm(team);
  };
}

function populateTeamForm(team: Team): void {
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

function setupViewTeamDetails(): void {
  const w = window as unknown as WindowWithTeamHandlers;
  w.viewTeamDetails = async (id: number) => {
    const team = await teamsManager?.getTeamDetails(id);
    if (team !== null) {
      // TODO: Open details modal
      console.info('View team:', team);
      showErrorAlert('Detailansicht noch nicht implementiert');
    }
  };
}

function setupDeleteTeam(): void {
  const w = window as unknown as WindowWithTeamHandlers;
  w.deleteTeam = (id: number) => {
    teamsManager?.deleteTeam(id);
  };
}

function setupToggleTeamStatus(): void {
  const w = window as unknown as WindowWithTeamHandlers;
  w.toggleTeamStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const response = await teamsManager?.apiClient.request<{ success: boolean; message: string }>(`/teams/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus }),
    });

    if (response?.success === true) {
      showSuccessAlert(`Team status successfully changed to ${newStatus}`);
      void teamsManager?.loadTeams();
    }
  };
}

function setupShowTeamModal(): void {
  const w = window as unknown as WindowWithTeamHandlers;
  w.showTeamModal = async () => {
    const modal = document.querySelector('#team-modal');
    if (modal === null) return;

    modal.classList.add('active');

    // Load all dropdowns in parallel
    await Promise.all([
      loadDepartmentsForSelect(document.querySelector('#team-department')),
      loadAdminsForSelect(document.querySelector('#team-lead')),
      loadMachinesForDropdown(document.querySelector('#team-machines-dropdown')),
      loadUsersForDropdown(document.querySelector('#team-members-dropdown')),
    ]);

    // Reset form
    const form = document.querySelector<HTMLFormElement>('#team-form');
    if (form !== null) {
      form.reset();
    }
  };
}

function setupCloseTeamModal(): void {
  const w = window as unknown as WindowWithTeamHandlers;
  w.closeTeamModal = () => {
    const modal = document.querySelector('#team-modal');
    if (modal !== null) {
      modal.classList.remove('active');
    }
  };
}

async function updateTeamMembers(
  teamId: number,
  currentMembers: TeamMember[],
  selectedUserIds: number[],
): Promise<void> {
  const currentMemberIds = currentMembers.map((m) => m.id);
  const membersToAdd = selectedUserIds.filter((id) => !currentMemberIds.includes(id));
  const membersToRemove = currentMemberIds.filter((id) => !selectedUserIds.includes(id));

  for (const userId of membersToAdd) {
    try {
      await teamsManager?.apiClient.request(`/teams/${teamId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
    } catch (error) {
      console.error(`Error adding member ${userId}:`, error);
    }
  }

  for (const userId of membersToRemove) {
    try {
      await teamsManager?.apiClient.request(`/teams/${teamId}/members/${userId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error(`Error removing member ${userId}:`, error);
    }
  }

  console.info(`[TeamsManager] Updated members: +${membersToAdd.length} -${membersToRemove.length}`);
}

async function updateTeamMachines(
  teamId: number,
  currentMachines: Machine[],
  selectedMachineIds: number[],
): Promise<void> {
  const currentMachineIds = currentMachines.map((m) => m.id);
  const machinesToAdd = selectedMachineIds.filter((id) => !currentMachineIds.includes(id));
  const machinesToRemove = currentMachineIds.filter((id) => !selectedMachineIds.includes(id));

  for (const machineId of machinesToAdd) {
    try {
      await teamsManager?.apiClient.request(`/teams/${teamId}/machines`, {
        method: 'POST',
        body: JSON.stringify({ machineId }),
      });
    } catch (error) {
      console.error(`Error adding machine ${machineId}:`, error);
    }
  }

  for (const machineId of machinesToRemove) {
    try {
      await teamsManager?.apiClient.request(`/teams/${teamId}/machines/${machineId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error(`Error removing machine ${machineId}:`, error);
    }
  }

  console.info(`[TeamsManager] Updated machines: +${machinesToAdd.length} -${machinesToRemove.length}`);
}

function setupSaveTeam(): void {
  const w = window as unknown as WindowWithTeamHandlers;
  w.saveTeam = async () => {
    const form = document.querySelector<HTMLFormElement>('#team-form');
    if (form === null) return;

    const formData = new FormData(form);
    const teamData: Record<string, string | number> = {};

    let machineIds: number[] = [];
    let userIds: number[] = [];

    formData.forEach((value, key) => {
      if (key === 'machineIds' && typeof value === 'string' && value.length > 0) {
        machineIds = value
          .split(',')
          .filter((id) => id.length > 0)
          .map((id) => Number.parseInt(id, 10));
      } else if (key === 'userIds' && typeof value === 'string' && value.length > 0) {
        userIds = value
          .split(',')
          .filter((id) => id.length > 0)
          .map((id) => Number.parseInt(id, 10));
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

    try {
      const savedTeam = await ('id' in teamData
        ? teamsManager?.updateTeam(Number(teamData.id), teamData)
        : teamsManager?.createTeam(teamData));

      if (savedTeam) {
        // Handle team members and machines for existing teams
        if ('id' in teamData) {
          const currentTeam = await teamsManager?.getTeamDetails(Number(teamData.id));
          if (currentTeam) {
            await Promise.all([
              updateTeamMembers(savedTeam.id, currentTeam.members ?? [], userIds),
              updateTeamMachines(savedTeam.id, currentTeam.machines ?? [], machineIds),
            ]);
          }
        } else {
          // For new teams, add all selected members and machines
          await Promise.all([
            updateTeamMembers(savedTeam.id, [], userIds),
            updateTeamMachines(savedTeam.id, [], machineIds),
          ]);
        }
      }

      w.closeTeamModal?.();
      await teamsManager?.loadTeams();
    } catch (error) {
      console.error('Error saving team:', error);
    }
  };
}

// Handler functions extracted from DOMContentLoaded
function setupLoadTeamsTable(): void {
  (window as WindowWithTeamHandlers & { loadTeamsTable?: () => void }).loadTeamsTable = () => {
    console.info('[TeamsManager] loadTeamsTable called');
    void teamsManager?.loadTeams();
  };
}

function setupToggleDropdown(): void {
  (window as WindowWithTeamHandlers & { toggleDropdown?: (dropdownId: string) => void }).toggleDropdown = (
    dropdownId: string,
  ) => {
    const dropdown = document.querySelector<HTMLElement>(`#${dropdownId}-dropdown`);
    if (dropdown !== null) {
      const isVisible = dropdown.style.display !== 'none';
      dropdown.style.display = isVisible ? 'none' : 'block';
    }
  };
}

function setupUpdateMemberSelection(): void {
  (window as WindowWithTeamHandlers & { updateMemberSelection?: () => void }).updateMemberSelection = () => {
    const memberDropdown = document.querySelector('#team-members-dropdown');
    const memberDisplay = document.querySelector('#team-members-display');
    const memberInput = document.querySelector<HTMLInputElement>('#team-members-select');

    if (memberDropdown === null || memberDisplay === null || memberInput === null) {
      return;
    }

    const checkboxes = memberDropdown.querySelectorAll('input[type="checkbox"]:checked');
    const selectedIds: string[] = [];
    const selectedNames: string[] = [];

    checkboxes.forEach((checkbox) => {
      const input = checkbox as HTMLInputElement;
      selectedIds.push(input.value);
      const label = checkbox.parentElement?.querySelector('span');
      if (label && label.textContent.length > 0) {
        selectedNames.push(label.textContent.split(' (')[0]);
      }
    });

    memberInput.value = selectedIds.join(',');

    if (selectedNames.length === 0) {
      memberDisplay.textContent = 'Keine Mitglieder zugewiesen';
    } else if (selectedNames.length <= 3) {
      memberDisplay.textContent = selectedNames.join(', ');
    } else {
      memberDisplay.textContent = `${selectedNames.slice(0, 2).join(', ')} +${selectedNames.length - 2} weitere`;
    }
  };
}

function setupUpdateMachineSelection(): void {
  (window as WindowWithTeamHandlers & { updateMachineSelection?: () => void }).updateMachineSelection = () => {
    const machineDropdown = document.querySelector('#team-machines-dropdown');
    const machineDisplay = document.querySelector('#team-machines-display');
    const machineInput = document.querySelector<HTMLInputElement>('#team-machines-select');

    if (machineDropdown === null || machineDisplay === null || machineInput === null) {
      return;
    }

    const checkboxes = machineDropdown.querySelectorAll('input[type="checkbox"]:checked');
    const selectedIds: string[] = [];
    const selectedNames: string[] = [];

    checkboxes.forEach((checkbox) => {
      const input = checkbox as HTMLInputElement;
      selectedIds.push(input.value);
      const label = checkbox.parentElement?.querySelector('span');
      if (label && label.textContent.length > 0) {
        selectedNames.push(label.textContent.split(' (')[0]);
      }
    });

    machineInput.value = selectedIds.join(',');

    if (selectedNames.length === 0) {
      machineDisplay.textContent = 'Keine Maschinen zugewiesen';
    } else if (selectedNames.length <= 3) {
      machineDisplay.textContent = selectedNames.join(', ');
    } else {
      machineDisplay.textContent = `${selectedNames.slice(0, 2).join(', ')} +${selectedNames.length - 2} weitere`;
    }
  };
}

async function loadDepartmentsForSelect(select: Element | null): Promise<void> {
  if (!select || !teamsManager) return;

  try {
    const departments = await teamsManager.loadDepartments();
    if (!departments) return;

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

async function loadAdminsForSelect(select: Element | null): Promise<void> {
  if (!select || !teamsManager) return;

  try {
    const usersResponse = await teamsManager.apiClient.request<UserAPIResponse[]>('/users?role=admin', {
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

async function loadMachinesForDropdown(dropdown: Element | null, team?: Team): Promise<void> {
  if (!dropdown || !teamsManager) return;

  try {
    const machineResponse = await teamsManager.apiClient.request<Machine[]>('/machines', {
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

async function loadUsersForDropdown(dropdown: Element | null, team?: Team): Promise<void> {
  if (!dropdown || !teamsManager) return;

  try {
    const userResponse = await teamsManager.apiClient.request<UserAPIResponse[]>('/users', {
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

document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if we're on the manage-teams page
  if (window.location.pathname === '/manage-teams' || window.location.pathname.includes('manage-teams')) {
    teamsManager = new TeamsManager();

    // Setup all window handlers
    setupWindowHandlers();
    setupEditTeam();
    setupViewTeamDetails();
    setupDeleteTeam();
    setupToggleTeamStatus();
    setupShowTeamModal();
    setupCloseTeamModal();
    setupSaveTeam();
    setupUrlChangeHandlers();
  }
});

export { TeamsManager };
