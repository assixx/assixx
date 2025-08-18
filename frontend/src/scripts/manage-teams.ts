/**
 * Admin Teams Management
 * Handles team CRUD operations for admin dashboard
 */

import { ApiClient } from '../utils/api-client';
import { mapTeams, mapUsers, type TeamAPIResponse, type UserAPIResponse, type MappedTeam } from '../utils/api-mappers';
import { showSuccessAlert, showErrorAlert } from './utils/alerts';

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
      const deleteInput = document.querySelector('#delete-team-id');
      if (deleteInput !== null && deleteInput.value !== '') {
        void this.confirmDeleteTeam(Number.parseInt(deleteInput.value, 10));
      }
    });
    document.querySelector('#close-delete-modal')?.addEventListener('click', () => {
      const modal = document.querySelector('#delete-team-modal');
      if (modal) modal.classList.remove('active');
    });
    document.querySelector('#cancel-delete-modal')?.addEventListener('click', () => {
      const modal = document.querySelector('#delete-team-modal');
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
      const searchInput = document.querySelector('#team-search');
      this.searchTerm = searchInput !== null ? searchInput.value : '';
      void this.loadTeams();
    });

    // Enter key on search
    document.querySelector('#team-search')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
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

    tbody.innerHTML = this.teams
      .map(
        (team) => `
      <tr>
        <td>
          <strong>${team.name}</strong>
        </td>
        <td>${team.departmentName ?? '-'}</td>
        <td>${team.leaderName ?? '-'}</td>
        <td>${team.memberCount ?? 0}</td>
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
    const modal = document.querySelector('#delete-team-modal');
    const deleteInput = document.querySelector('#delete-team-id');

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
      await this.apiClient.request(`/teams/${id}`, {
        method: 'DELETE',
      });

      showSuccessAlert('Team erfolgreich gelöscht');

      // Close the modal
      const modal = document.querySelector('#delete-team-modal');
      if (modal !== null) {
        modal.classList.remove('active');
      }

      // Reload teams
      await this.loadTeams();
    } catch (error) {
      console.error('Error deleting team:', error);
      const errorObj = error as { message?: string; code?: string };

      if (
        errorObj.code === 'FOREIGN_KEY_CONSTRAINT' ||
        errorObj.message?.includes('foreign key') === true ||
        errorObj.message?.includes('Cannot delete team with members') === true ||
        errorObj.message?.includes('Cannot delete team with machines') === true
      ) {
        showErrorAlert('Team kann nicht gelöscht werden, da noch Zuordnungen (Mitarbeiter/Maschinen) existieren');
      } else {
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

    // Expose functions globally for HTML onclick handlers
    const w = window as unknown as WindowWithTeamHandlers;
    w.editTeam = async (id: number) => {
      const team = await teamsManager?.getTeamDetails(id);
      if (team !== null) {
        // TODO: Open edit modal with team data
        console.info('Edit team:', team);
        showErrorAlert('Bearbeitungsmodal noch nicht implementiert');
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
        const form = document.querySelector('#team-form');
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

    // Toggle dropdown helper
    (window as WindowWithTeamHandlers & { toggleDropdown?: (dropdownId: string) => void }).toggleDropdown = (
      dropdownId: string,
    ) => {
      const dropdown = document.getElementById(`${dropdownId}-dropdown`);
      if (dropdown !== null) {
        const isVisible = dropdown.style.display !== 'none';
        dropdown.style.display = isVisible ? 'none' : 'block';
      }
    };

    // Select dropdown option helper (for department dropdown)
    (
      window as WindowWithTeamHandlers & {
        selectDropdownOption?: (fieldId: string, value: string, displayText: string) => void;
      }
    ).selectDropdownOption = (fieldId: string, value: string, displayText: string) => {
      const input = document.getElementById(`${fieldId}-select`) as HTMLInputElement | null;
      const display = document.getElementById(`${fieldId}-display`);

      if (input !== null) {
        input.value = value;
      }
      if (display !== null) {
        const span = display.querySelector('span');
        if (span !== null) span.textContent = displayText;
      }

      // Close dropdown
      const dropdown = document.getElementById(`${fieldId}-dropdown`);
      if (dropdown !== null) {
        dropdown.classList.remove('active');
      }
    };

    // Update member selection handler
    (window as WindowWithTeamHandlers & { updateMemberSelection?: () => void }).updateMemberSelection = () => {
      const memberDropdown = document.querySelector('#team-members-dropdown');
      const memberDisplay = document.querySelector('#team-members-display');
      const memberInput = document.querySelector('#team-members-select');

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

      // Update display - memberDisplay already checked above
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
      const machineInput = document.querySelector('#team-machines-select');

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

      // Update display - machineDisplay already checked above
      if (selectedNames.length === 0) {
        machineDisplay.textContent = 'Keine Maschinen zugewiesen';
      } else if (selectedNames.length <= 3) {
        machineDisplay.textContent = selectedNames.join(', ');
      } else {
        machineDisplay.textContent = `${selectedNames.slice(0, 2).join(', ')} +${selectedNames.length - 2} weitere`;
      }
    };

    // Save team handler
    w.saveTeam = async () => {
      const form = document.querySelector('#team-form');
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
          if (key === 'maxMembers' || key === 'departmentId') {
            teamData[key] = Number.parseInt(value, 10);
          } else {
            teamData[key] = value;
          }
        }
      });

      // Validate required fields
      if (typeof teamData.name !== 'string' || teamData.name.length === 0) {
        showErrorAlert('Bitte geben Sie einen Teamnamen ein');
        return;
      }

      try {
        const createdTeam = await teamsManager?.createTeam(teamData as Partial<Team>);

        // If machines were selected, create machine_teams associations
        if (createdTeam && machineIds.length > 0) {
          try {
            // Create machine_teams entries
            for (const machineId of machineIds) {
              await teamsManager?.apiClient.request(`/teams/${createdTeam.id}/machines`, {
                method: 'POST',
                body: JSON.stringify({
                  machineId, // API v2 expects camelCase
                }),
              });
            }
            console.info(`[TeamsManager] Assigned ${machineIds.length} machines to team ${createdTeam.id}`);
          } catch (error) {
            console.error('Error assigning machines to team:', error);
            // Don't fail the whole operation, just log the error
          }
        }

        // If users were selected, create user_teams associations
        if (createdTeam && userIds.length > 0) {
          try {
            // Create user_teams entries using the correct API v2 endpoint
            for (const userId of userIds) {
              await teamsManager?.apiClient.request(`/teams/${createdTeam.id}/members`, {
                method: 'POST',
                body: JSON.stringify({
                  userId, // API v2 expects camelCase
                }),
              });
            }
            console.info(`[TeamsManager] Assigned ${userIds.length} users to team ${createdTeam.id}`);
          } catch (error) {
            console.error('Error assigning users to team:', error);
            // Don't fail the whole operation, just log the error
          }
        }

        w.closeTeamModal?.();
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
