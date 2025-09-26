/* eslint-disable max-lines */
/**
 * Admin Teams Management
 * Handles team CRUD operations for admin dashboard
 */

import { ApiClient } from '../../../utils/api-client';
import { mapTeams, type TeamAPIResponse, type MappedTeam } from '../../../utils/api-mappers';
import { showSuccessAlert, showErrorAlert } from '../../utils/alerts';
import type { Team, TeamMember, Machine, WindowWithTeamHandlers } from './types';
import {
  toggleTableVisibility,
  createTeamRow,
  addTooltipListeners,
  populateTeamForm,
  processTeamFormData,
  loadDepartmentsForSelect,
  loadAdminsForSelect,
  loadMachinesForDropdown,
  loadUsersForDropdown,
} from './ui';

// Constants
const DELETE_TEAM_MODAL_ID = '#delete-team-modal';

class TeamsManager {
  public apiClient: ApiClient; // Made public for access in global functions
  private teams: Team[] = [];
  private currentFilter: 'all' | 'active' | 'inactive' = 'all';
  private searchTerm = '';
  private useV2API = true; // Default to v2 API

  constructor() {
    this.apiClient = ApiClient.getInstance();
    // Feature flags removed - always use v2
    this.useV2API = true;
    this.initializeEventListeners();
    // Load teams initially
    void this.loadTeams();
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

  private renderTeamsTable() {
    const tbody = document.querySelector('#teams-table-body');
    if (tbody === null) return;

    if (this.teams.length === 0) {
      toggleTableVisibility(false);
      tbody.innerHTML = '';
      return;
    }

    toggleTableVisibility(true);

    const tableHTML = this.teams.map((team) => createTeamRow(team)).join('');

    // eslint-disable-next-line no-unsanitized/property -- Safe: We control all data in tableHTML
    tbody.innerHTML = tableHTML;

    addTooltipListeners(tbody);
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
    if (!teamsManager) return;

    const team = await teamsManager.getTeamDetails(id);
    if (team === null) return;

    const modal = document.querySelector('#team-modal');
    if (modal === null) return;

    modal.classList.add('active');

    // Load all dropdowns in parallel
    const apiClient = teamsManager.apiClient;
    await Promise.all([
      loadDepartmentsForSelect(document.querySelector<HTMLSelectElement>('#team-department'), apiClient),
      loadAdminsForSelect(document.querySelector<HTMLSelectElement>('#team-lead'), apiClient),
      loadMachinesForDropdown(document.querySelector('#team-machines-dropdown'), apiClient, team),
      loadUsersForDropdown(document.querySelector('#team-members-dropdown'), apiClient, team),
    ]);

    // Populate form with team data
    populateTeamForm(team);
  };
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
    if (!teamsManager) return;

    const modal = document.querySelector('#team-modal');
    if (modal === null) return;

    modal.classList.add('active');

    // Load all dropdowns in parallel
    const apiClient = teamsManager.apiClient;
    await Promise.all([
      loadDepartmentsForSelect(document.querySelector('#team-department'), apiClient),
      loadAdminsForSelect(document.querySelector('#team-lead'), apiClient),
      loadMachinesForDropdown(document.querySelector('#team-machines-dropdown'), apiClient),
      loadUsersForDropdown(document.querySelector('#team-members-dropdown'), apiClient),
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

async function updateTeamRelations(
  savedTeam: Team,
  teamData: Record<string, string | number>,
  userIds: number[],
  machineIds: number[],
): Promise<void> {
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
    await Promise.all([updateTeamMembers(savedTeam.id, [], userIds), updateTeamMachines(savedTeam.id, [], machineIds)]);
  }
}

function setupSaveTeam(): void {
  const w = window as unknown as WindowWithTeamHandlers;
  w.saveTeam = async () => {
    const form = document.querySelector<HTMLFormElement>('#team-form');
    if (form === null) return;

    const formData = new FormData(form);
    const { teamData, machineIds, userIds } = processTeamFormData(formData);

    try {
      const savedTeam = await ('id' in teamData
        ? teamsManager?.updateTeam(Number(teamData.id), teamData)
        : teamsManager?.createTeam(teamData));

      if (savedTeam) {
        await updateTeamRelations(savedTeam, teamData, userIds, machineIds);
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
