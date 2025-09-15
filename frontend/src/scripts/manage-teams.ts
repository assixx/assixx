/**
 * Admin Teams Management
 * Handles team CRUD operations for admin dashboard
 */

import { ApiClient } from '../utils/api-client';
import { mapTeams, mapUsers, type TeamAPIResponse, type UserAPIResponse, type MappedTeam } from '../utils/api-mappers';
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
    const teamsTable = document.querySelector('#teams-table');
    const teamsEmpty = document.querySelector('#teams-empty');

    if (tbody === null) return;

    if (this.teams.length === 0) {
      // Hide table and show empty state
      if (teamsTable !== null) {
        teamsTable.classList.add('u-hidden');
      }
      if (teamsEmpty !== null) {
        teamsEmpty.classList.remove('u-hidden');
      }
      tbody.innerHTML = '';
      return;
    }

    // Show table and hide empty state
    if (teamsTable !== null) {
      teamsTable.classList.remove('u-hidden');
    }
    if (teamsEmpty !== null) {
      teamsEmpty.classList.add('u-hidden');
    }

    const tableHTML = this.teams
      .map(
        (team) => `
      <tr>
        <td>
          <strong>${team.name}</strong>
        </td>
        <td>${team.departmentName ?? '-'}</td>
        <td>${team.leaderName ?? '-'}</td>
        <td>
          ${
            team.memberCount !== undefined && team.memberCount > 0
              ? `<span class="status-badge member-badge" style="background: rgba(33, 150, 243, 0.2); color: #2196f3; border-color: rgba(33, 150, 243, 0.3); cursor: help; position: relative; white-space: nowrap;" data-members="${team.memberNames ?? ''}">
                ${team.memberCount} ${team.memberCount === 1 ? 'Mitglied' : 'Mitglieder'}
                ${
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
                    : ''
                }
              </span>`
              : '0'
          }
        </td>
        <td>
          <span class="badge ${this.getStatusBadgeClass(team.status)}">
            ${this.getStatusLabel(team.status)}
          </span>
        </td>
        <td>${new Date(team.createdAt).toLocaleDateString('de-DE')}</td>
        <td>
          <button class="action-btn edit" onclick="window.editTeam(${team.id})">
            Bearbeiten
          </button>
          <button class="action-btn ${team.status === 'active' ? 'deactivate' : 'activate'}" onclick="window.toggleTeamStatus(${team.id}, '${team.status}')">
            ${team.status === 'active' ? 'Deaktivieren' : 'Aktivieren'}
          </button>
          <button class="action-btn delete" onclick="window.deleteTeam(${team.id})">
            Löschen
          </button>
        </td>
      </tr>
    `,
      )
      .join('');

    // eslint-disable-next-line no-unsanitized/property -- Safe: We control all data in tableHTML
    tbody.innerHTML = tableHTML;

    // Add event listeners for member tooltips
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

  async confirmDeleteTeam(id: number): Promise<void> {
    try {
      // First try to delete without force
      await this.apiClient.request(`/teams/${id}`, {
        method: 'DELETE',
      });

      showSuccessAlert('Team erfolgreich gelöscht');

      // Close the modal
      const modal = document.querySelector(DELETE_TEAM_MODAL_ID);
      if (modal !== null) {
        modal.classList.remove('active');
      }

      // Reload teams
      await this.loadTeams();
    } catch (error) {
      const errorObj = error as { message?: string; code?: string; details?: { memberCount?: number } };

      // If team has members, try again with force=true
      if (errorObj.message?.includes('Cannot delete team with members') === true) {
        try {
          // Ask for confirmation first
          const memberCount = errorObj.details?.memberCount ?? 'einige';
          if (
            confirm(
              `Das Team hat ${memberCount} Mitglieder. Möchten Sie das Team trotzdem löschen? Alle Mitglieder werden automatisch aus dem Team entfernt.`,
            )
          ) {
            // Delete with force=true
            await this.apiClient.request(`/teams/${id}?force=true`, {
              method: 'DELETE',
            });
            showSuccessAlert('Team und alle Mitgliederzuordnungen erfolgreich gelöscht');
            // Close the modal
            const modal = document.querySelector(DELETE_TEAM_MODAL_ID);
            if (modal !== null) {
              modal.classList.remove('active');
            }
            // Reload teams
            await this.loadTeams();
          }
        } catch (forceError) {
          console.error('Error force deleting team:', forceError);
          showErrorAlert('Fehler beim Löschen des Teams');
        }
      } else if (
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

document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if we're on the manage-teams page
  if (window.location.pathname === '/manage-teams' || window.location.pathname.includes('manage-teams')) {
    teamsManager = new TeamsManager();

    // Export loadTeamsTable function to window for show-section.ts
    (window as WindowWithTeamHandlers & { loadTeamsTable?: () => void }).loadTeamsTable = () => {
      console.info('[TeamsManager] loadTeamsTable called');
      void teamsManager?.loadTeams();
    };

    // Toggle dropdown helper - Define globally so it's available for all modals
    (window as WindowWithTeamHandlers & { toggleDropdown?: (dropdownId: string) => void }).toggleDropdown = (
      dropdownId: string,
    ) => {
      const dropdown = document.querySelector<HTMLElement>(`#${dropdownId}-dropdown`);
      if (dropdown !== null) {
        const isVisible = dropdown.style.display !== 'none';
        dropdown.style.display = isVisible ? 'none' : 'block';
      }
    };

    // Update member selection handler
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

      // Update hidden input
      memberInput.value = selectedIds.join(',');

      // Update display
      if (selectedNames.length === 0) {
        memberDisplay.textContent = 'Keine Mitglieder zugewiesen';
      } else if (selectedNames.length <= 3) {
        memberDisplay.textContent = selectedNames.join(', ');
      } else {
        memberDisplay.textContent = `${selectedNames.slice(0, 2).join(', ')} +${selectedNames.length - 2} weitere`;
      }
    };

    // Update machine selection handler
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

      // Update hidden input
      machineInput.value = selectedIds.join(',');

      // Update display
      if (selectedNames.length === 0) {
        machineDisplay.textContent = 'Keine Maschinen zugewiesen';
      } else if (selectedNames.length <= 3) {
        machineDisplay.textContent = selectedNames.join(', ');
      } else {
        machineDisplay.textContent = `${selectedNames.slice(0, 2).join(', ')} +${selectedNames.length - 2} weitere`;
      }
    };

    // Expose functions globally for HTML onclick handlers
    const w = window as unknown as WindowWithTeamHandlers;
    w.editTeam = async (id: number) => {
      const team = await teamsManager?.getTeamDetails(id);
      if (team !== null && team !== undefined) {
        // Open modal
        const modal = document.querySelector('#team-modal');
        if (modal !== null) {
          modal.classList.add('active');

          // Load departments for dropdown
          if (teamsManager !== null) {
            try {
              const departments = await teamsManager.loadDepartments();
              const departmentSelect = document.querySelector<HTMLSelectElement>('#team-department');

              if (departmentSelect && departments) {
                // Clear existing options and add placeholder
                departmentSelect.innerHTML = '<option value="">Keine Abteilung</option>';

                // Add department options
                departments.forEach((dept: Department) => {
                  const option = document.createElement('option');
                  option.value = dept.id.toString();
                  option.textContent = dept.name;
                  departmentSelect.append(option);
                });
              }

              // Load admins for team leader dropdown (Team-Leaders should be admins)
              const usersResponse = await teamsManager.apiClient.request<UserAPIResponse[]>('/users?role=admin', {
                method: 'GET',
              });

              const admins = mapUsers(usersResponse);
              const leaderSelect = document.querySelector<HTMLSelectElement>('#team-lead');

              if (leaderSelect !== null) {
                // Clear existing options and add placeholder
                leaderSelect.innerHTML = '<option value="">Kein Team-Leiter</option>';

                // Add admin options
                admins.forEach((admin) => {
                  const option = document.createElement('option');
                  option.value = admin.id.toString();
                  const displayName =
                    admin.firstName !== '' && admin.lastName !== ''
                      ? `${admin.firstName} ${admin.lastName}`
                      : admin.username;
                  option.textContent = displayName;
                  leaderSelect.append(option);
                });
              }

              // Load machines for multi-select dropdown
              const machineResponse = await teamsManager.apiClient.request<Machine[]>('/machines', {
                method: 'GET',
              });
              const machines = machineResponse;
              const machineDropdown = document.querySelector('#team-machines-dropdown');

              if (machineDropdown !== null) {
                machineDropdown.innerHTML = '';

                if (machines.length === 0) {
                  machineDropdown.innerHTML =
                    '<div class="dropdown-option" style="color: #666;">Keine Maschinen verfügbar</div>';
                } else {
                  machines.forEach((machine) => {
                    const optionDiv = document.createElement('div');
                    optionDiv.className = 'dropdown-option';
                    optionDiv.style.padding = '8px 12px';
                    // Check if machine is assigned to this team
                    const isChecked = team.machines?.some((m) => m.id === machine.id) === true ? 'checked' : '';
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
                    machineDropdown.append(optionDiv);
                  });
                }
              }

              // Load users for multi-select dropdown (Team-Members)
              const userResponse = await teamsManager.apiClient.request<UserAPIResponse[]>('/users', {
                method: 'GET',
              });
              const users = mapUsers(userResponse);
              const memberDropdown = document.querySelector('#team-members-dropdown');

              if (memberDropdown !== null) {
                memberDropdown.innerHTML = '';

                if (users.length === 0) {
                  memberDropdown.innerHTML =
                    '<div class="dropdown-option" style="color: #666;">Keine Benutzer verfügbar</div>';
                } else {
                  users.forEach((user) => {
                    const optionDiv = document.createElement('div');
                    optionDiv.className = 'dropdown-option';
                    optionDiv.style.padding = '8px 12px';
                    const displayName =
                      user.firstName !== '' && user.lastName !== ''
                        ? `${user.firstName} ${user.lastName}`
                        : user.username;
                    // Check if user is member of this team
                    const isChecked = team.members?.some((m) => m.id === user.id) === true ? 'checked' : '';
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
                    memberDropdown.append(optionDiv);
                  });
                }
              }
            } catch (error) {
              console.error('Error loading form data:', error);
            }
          }

          // Fill form with team data
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
          // Use team status directly as it's always defined
          setInputValue('team-status', team.status);

          // Display team members
          const membersDisplay = document.querySelector('#team-members-display');
          if (membersDisplay !== null && team.members !== undefined && team.members.length > 0) {
            const memberNames = team.members.map((m) => `${m.firstName} ${m.lastName}`).join(', ');
            membersDisplay.textContent = `${team.members.length} Mitglieder: ${memberNames}`;
          } else if (membersDisplay !== null) {
            membersDisplay.textContent = 'Keine Mitglieder zugewiesen';
          }

          // Display assigned machines (if any)
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
      }
    };

    w.viewTeamDetails = async (id: number) => {
      const team = await teamsManager?.getTeamDetails(id);
      if (team !== null) {
        // TODO: Open details modal
        console.info('View team:', team);
        showErrorAlert('Detailansicht noch nicht implementiert');
      }
    };

    w.deleteTeam = (id: number) => {
      teamsManager?.deleteTeam(id);
    };

    // Handler for floating add button
    w.showTeamModal = async () => {
      const modal = document.querySelector('#team-modal');
      if (modal !== null) {
        modal.classList.add('active');

        // Load departments for dropdown
        if (teamsManager !== null) {
          try {
            const departments = await teamsManager.loadDepartments();
            const departmentSelect = document.querySelector('#team-department');

            if (departmentSelect && departments) {
              // Clear existing options and add placeholder
              departmentSelect.innerHTML = '<option value="">Keine Abteilung</option>';

              // Add department options
              departments.forEach((dept) => {
                const option = document.createElement('option');
                option.value = dept.id.toString();
                option.textContent = dept.name;
                departmentSelect.append(option);
              });

              console.info('[TeamsManager] Loaded departments:', departments.length);
            }
          } catch (error) {
            console.error('Error loading departments:', error);
          }

          // Load admins for team-lead dropdown
          try {
            const usersResponse = await teamsManager.apiClient.request<UserAPIResponse[]>('/users?role=admin', {
              method: 'GET',
            });
            const admins = mapUsers(usersResponse);
            const teamLeadSelect = document.querySelector('#team-lead');

            if (teamLeadSelect !== null) {
              // Clear existing options and add placeholder
              teamLeadSelect.innerHTML = '<option value="">Kein Team-Leiter</option>';

              // Add admin options
              admins.forEach((admin) => {
                const option = document.createElement('option');
                option.value = admin.id.toString();
                const displayName =
                  admin.firstName !== '' && admin.lastName !== ''
                    ? `${admin.firstName} ${admin.lastName}`
                    : admin.username;
                option.textContent = displayName;
                teamLeadSelect.append(option);
              });

              console.info('[TeamsManager] Loaded admins for team-lead:', admins.length);
            }
          } catch (error) {
            console.error('Error loading admins:', error);
          }

          // Load machines for multi-select dropdown
          try {
            const machineResponse = await teamsManager.apiClient.request<Machine[]>('/machines', {
              method: 'GET',
            });
            const machines = machineResponse;
            const machineDropdown = document.querySelector('#team-machines-dropdown');

            if (machineDropdown !== null) {
              // Clear and create checkboxes for multi-selection
              machineDropdown.innerHTML = '';

              if (machines.length === 0) {
                machineDropdown.innerHTML =
                  '<div class="dropdown-option" style="color: #666;">Keine Maschinen verfügbar</div>';
              } else {
                machines.forEach((machine) => {
                  const optionDiv = document.createElement('div');
                  optionDiv.className = 'dropdown-option';
                  optionDiv.style.padding = '8px 12px';
                  // eslint-disable-next-line no-unsanitized/property -- Safe: We control all machine data
                  optionDiv.innerHTML = `
                    <label style="display: flex; align-items: center; cursor: pointer; width: 100%;">
                      <input type="checkbox" value="${machine.id}"
                             onchange="window.updateMachineSelection()"
                             style="margin-right: 8px;">
                      <span>${machine.name} ${machine.departmentName !== undefined && machine.departmentName !== null && machine.departmentName !== '' ? `(${machine.departmentName})` : ''}</span>
                    </label>
                  `;
                  machineDropdown.append(optionDiv);
                });
              }

              console.info('[TeamsManager] Loaded machines:', machines.length);
            }
          } catch (error) {
            console.error('Error loading machines:', error);
          }

          // Load users for multi-select dropdown (Team-Members)
          try {
            const userResponse = await teamsManager.apiClient.request<UserAPIResponse[]>('/users', {
              method: 'GET',
            });
            const users = mapUsers(userResponse);
            const memberDropdown = document.querySelector('#team-members-dropdown');

            if (memberDropdown !== null) {
              // Clear and create checkboxes for multi-selection
              memberDropdown.innerHTML = '';

              if (users.length === 0) {
                memberDropdown.innerHTML =
                  '<div class="dropdown-option" style="color: #666;">Keine Benutzer verfügbar</div>';
              } else {
                users.forEach((user) => {
                  const optionDiv = document.createElement('div');
                  optionDiv.className = 'dropdown-option';
                  optionDiv.style.padding = '8px 12px';
                  const displayName =
                    user.firstName !== '' && user.lastName !== ''
                      ? `${user.firstName} ${user.lastName}`
                      : user.username;
                  // eslint-disable-next-line no-unsanitized/property -- Safe: We control all user data
                  optionDiv.innerHTML = `
                    <label style="display: flex; align-items: center; cursor: pointer; width: 100%;">
                      <input type="checkbox" value="${user.id}"
                             onchange="window.updateMemberSelection()"
                             style="margin-right: 8px;">
                      <span>${displayName} ${user.departmentName !== undefined && user.departmentName !== '' && user.departmentName !== 'Keine Abteilung' ? `(${user.departmentName})` : ''}</span>
                    </label>
                  `;
                  memberDropdown.append(optionDiv);
                });
              }

              console.info('[TeamsManager] Loaded members:', users.length);
            }
          } catch (error) {
            console.error('Error loading users:', error);
          }
        }

        // Reset form
        const form = document.querySelector<HTMLFormElement>('#team-form');
        if (form !== null) {
          form.reset();
        }
      }
    };

    // Close modal handler
    w.closeTeamModal = () => {
      const modal = document.querySelector('#team-modal');
      if (modal !== null) {
        modal.classList.remove('active');
      }
    };

    // Select dropdown option helper (for department dropdown)
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

    // Save team handler
    w.saveTeam = async () => {
      const form = document.querySelector<HTMLFormElement>('#team-form');
      if (form === null) {
        return;
      }

      const formData = new FormData(form);
      const teamData: Record<string, string | number> = {};

      // Convert FormData to object
      let machineIds: number[] = [];
      let userIds: number[] = [];
      formData.forEach((value, key) => {
        if (key === 'machineIds' && typeof value === 'string' && value.length > 0) {
          // Extract machine IDs for separate handling
          machineIds = value
            .split(',')
            .filter((id) => id.length > 0)
            .map((id) => Number.parseInt(id, 10));
        } else if (key === 'userIds' && typeof value === 'string' && value.length > 0) {
          // Extract user IDs for separate handling
          userIds = value
            .split(',')
            .filter((id) => id.length > 0)
            .map((id) => Number.parseInt(id, 10));
        } else if (typeof value === 'string' && value.length > 0) {
          // Map teamLeadId to leaderId for API compatibility
          const mappedKey = key === 'teamLeadId' ? 'leaderId' : key;

          if (mappedKey === 'maxMembers' || mappedKey === 'departmentId' || mappedKey === 'leaderId') {
            // eslint-disable-next-line security/detect-object-injection -- Safe: mappedKey is controlled and validated
            teamData[mappedKey] = Number.parseInt(value, 10);
          } else {
            // eslint-disable-next-line security/detect-object-injection -- Safe: mappedKey is controlled and validated
            teamData[mappedKey] = value;
          }
        }
      });

      // Validate required fields
      if (typeof teamData.name !== 'string' || teamData.name.length === 0) {
        showErrorAlert('Bitte geben Sie einen Teamnamen ein');
        return;
      }

      // Check if this is an update (team-id field has value) or create
      const teamIdInput = document.querySelector<HTMLInputElement>('#team-id');
      const teamId =
        teamIdInput?.value !== undefined && teamIdInput.value !== '' ? Number.parseInt(teamIdInput.value, 10) : null;

      try {
        let savedTeam: Team | undefined;

        if (teamId !== null && teamId > 0) {
          // UPDATE existing team
          savedTeam = await teamsManager?.updateTeam(teamId, teamData as Partial<Team>);
        } else {
          // CREATE new team
          savedTeam = await teamsManager?.createTeam(teamData as Partial<Team>);
        }

        // Handle member/machine assignments for both CREATE and UPDATE
        if (savedTeam) {
          // For updates, we need to handle add/remove logic
          if (teamId !== null && teamId > 0) {
            // Get current team details to compare
            const currentTeam = await teamsManager?.getTeamDetails(teamId);

            if (currentTeam) {
              // --- Handle MEMBERS ---
              const currentMemberIds = currentTeam.members?.map((m) => m.id) ?? [];
              const selectedMemberIds = userIds;

              // Find members to add (in selected but not in current)
              const membersToAdd = selectedMemberIds.filter((id) => !currentMemberIds.includes(id));

              // Find members to remove (in current but not in selected)
              const membersToRemove = currentMemberIds.filter((id) => !selectedMemberIds.includes(id));

              // Add new members
              for (const userId of membersToAdd) {
                try {
                  await teamsManager?.apiClient.request(`/teams/${savedTeam.id}/members`, {
                    method: 'POST',
                    body: JSON.stringify({ userId }),
                  });
                } catch (error) {
                  console.error(`Error adding member ${userId}:`, error);
                }
              }

              // Remove members
              for (const userId of membersToRemove) {
                try {
                  await teamsManager?.apiClient.request(`/teams/${savedTeam.id}/members/${userId}`, {
                    method: 'DELETE',
                  });
                } catch (error) {
                  console.error(`Error removing member ${userId}:`, error);
                }
              }

              // --- Handle MACHINES ---
              const currentMachineIds = currentTeam.machines?.map((m) => m.id) ?? [];
              const selectedMachineIds = machineIds;

              // Find machines to add
              const machinesToAdd = selectedMachineIds.filter((id) => !currentMachineIds.includes(id));

              // Find machines to remove
              const machinesToRemove = currentMachineIds.filter((id) => !selectedMachineIds.includes(id));

              // Add new machines
              for (const machineId of machinesToAdd) {
                try {
                  await teamsManager?.apiClient.request(`/teams/${savedTeam.id}/machines`, {
                    method: 'POST',
                    body: JSON.stringify({ machineId }),
                  });
                } catch (error) {
                  console.error(`Error adding machine ${machineId}:`, error);
                }
              }

              // Remove machines
              for (const machineId of machinesToRemove) {
                try {
                  await teamsManager?.apiClient.request(`/teams/${savedTeam.id}/machines/${machineId}`, {
                    method: 'DELETE',
                  });
                } catch (error) {
                  console.error(`Error removing machine ${machineId}:`, error);
                }
              }

              console.info(
                `[TeamsManager] Updated members: +${membersToAdd.length} -${membersToRemove.length}, machines: +${machinesToAdd.length} -${machinesToRemove.length}`,
              );
            }
          } else {
            // For NEW teams, just add all selected members and machines
            for (const machineId of machineIds) {
              try {
                await teamsManager?.apiClient.request(`/teams/${savedTeam.id}/machines`, {
                  method: 'POST',
                  body: JSON.stringify({ machineId }),
                });
              } catch (error) {
                console.error('Error assigning machine:', error);
              }
            }

            for (const userId of userIds) {
              try {
                await teamsManager?.apiClient.request(`/teams/${savedTeam.id}/members`, {
                  method: 'POST',
                  body: JSON.stringify({ userId }),
                });
              } catch (error) {
                console.error('Error assigning user:', error);
              }
            }

            if (machineIds.length > 0 || userIds.length > 0) {
              console.info(
                `[TeamsManager] Created team with ${userIds.length} members and ${machineIds.length} machines`,
              );
            }
          }
        }

        w.closeTeamModal?.();
        // Reload teams to show updated member/machine counts
        await teamsManager?.loadTeams();
        // Success message already shown in createTeam method
      } catch (error) {
        console.error('Error creating team:', error);
        // Error message already shown in createTeam method
      }
    };

    // Window-level functions for onclick handlers are already defined above

    // Function to check if teams section is visible
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
});

export { TeamsManager };
