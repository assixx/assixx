/**
 * Admin Teams Management
 * Handles team CRUD operations for admin dashboard
 */

import { ApiClient } from '../utils/api-client';

import { showSuccess, showError } from './auth';

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
  departmentId?: number;
  departmentName?: string;
  areaId?: number;
  status?: string;
}

interface User {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  departmentId?: number;
  departmentName?: string;
  role?: string;
}

interface WindowWithTeamHandlers extends Window {
  editTeam?: (id: number) => Promise<void>;
  viewTeamDetails?: (id: number) => Promise<void>;
  deleteTeam?: (id: number) => Promise<void>;
  showTeamModal?: () => Promise<void>;
  closeTeamModal?: () => void;
  saveTeam?: () => Promise<void>;
}

class TeamsManager {
  public apiClient: ApiClient; // Made public for access in global functions
  private teams: Team[] = [];
  private currentFilter: 'all' | 'active' | 'inactive' | 'restructuring' = 'all';
  private searchTerm = '';

  constructor() {
    this.apiClient = ApiClient.getInstance();
    this.initializeEventListeners();
  }

  async loadDepartments(): Promise<Department[] | null> {
    try {
      const response = await this.apiClient.request<Department[]>('/departments', {
        method: 'GET',
      });
      return response;
    } catch (error) {
      console.error('Error loading departments:', error);
      return null;
    }
  }

  private initializeEventListeners() {
    // Filter buttons
    document.getElementById('show-all-teams')?.addEventListener('click', () => {
      this.currentFilter = 'all';
      void this.loadTeams();
    });

    document.getElementById('filter-teams-active')?.addEventListener('click', () => {
      this.currentFilter = 'active';
      void this.loadTeams();
    });

    document.getElementById('filter-teams-inactive')?.addEventListener('click', () => {
      this.currentFilter = 'inactive';
      void this.loadTeams();
    });

    document.getElementById('filter-teams-restructuring')?.addEventListener('click', () => {
      this.currentFilter = 'restructuring';
      void this.loadTeams();
    });

    // Search
    document.getElementById('team-search-btn')?.addEventListener('click', () => {
      const searchInput = document.getElementById('team-search') as HTMLInputElement | null;
      this.searchTerm = searchInput !== null ? searchInput.value : '';
      void this.loadTeams();
    });

    // Enter key on search
    document.getElementById('team-search')?.addEventListener('keypress', (e) => {
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

      const response = await this.apiClient.request<Team[]>('/teams', {
        method: 'GET',
      });

      // v2 API: apiClient.request already extracts the data array
      this.teams = response;
      this.renderTeamsTable();
    } catch (error) {
      console.error('Error loading teams:', error);
      showError('Fehler beim Laden der Teams');
    }
  }

  private renderTeamsTable() {
    const tbody = document.getElementById('teams-table-body');
    if (tbody === null) return;

    if (this.teams.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-muted">Keine Teams gefunden</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.teams
      .map(
        (team) => `
      <tr>
        <td>
          <strong>${team.name}</strong>
        </td>
        <td>${team.description ?? '-'}</td>
        <td>${team.leaderName ?? '-'}</td>
        <td>${team.departmentName ?? '-'}</td>
        <td>
          <span class="badge ${this.getStatusBadgeClass(team.status)}">
            ${this.getStatusLabel(team.status)}
          </span>
        </td>
        <td>${team.memberCount ?? 0}/${team.maxMembers ?? '-'}</td>
        <td>${team.performanceScore !== undefined ? `${team.performanceScore}%` : '-'}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="window.editTeam(${team.id})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-secondary" onclick="window.viewTeamDetails(${team.id})">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="window.deleteTeam(${team.id})">
            <i class="fas fa-trash"></i>
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
      case 'restructuring':
        return 'badge-warning';
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
      case 'restructuring':
        return 'Umstrukturierung';
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

      showSuccess('Team erfolgreich erstellt');
      await this.loadTeams();
      return response;
    } catch (error) {
      console.error('Error creating team:', error);
      showError('Fehler beim Erstellen des Teams');
      throw error;
    }
  }

  async updateTeam(id: number, teamData: Partial<Team>): Promise<Team> {
    try {
      const response = await this.apiClient.request<Team>(`/teams/${id}`, {
        method: 'PUT',
        body: JSON.stringify(teamData),
      });

      showSuccess('Team erfolgreich aktualisiert');
      await this.loadTeams();
      return response;
    } catch (error) {
      console.error('Error updating team:', error);
      showError('Fehler beim Aktualisieren des Teams');
      throw error;
    }
  }

  async deleteTeam(_id: number): Promise<void> {
    // TODO: Implement proper confirmation modal
    showError('Löschbestätigung: Feature noch nicht implementiert - Team kann nicht gelöscht werden');
    await Promise.resolve();
    // Code below will be activated once confirmation modal is implemented
    /*
    if (!confirm('Sind Sie sicher, dass Sie dieses Team löschen möchten?')) {
      return;
    }

    try {
      await this.apiClient.request(`/teams/${_id}`, {
        method: 'DELETE',
      });

      showSuccess('Team erfolgreich gelöscht');
      await this.loadTeams();
    } catch (error) {
      console.error('Error deleting team:', error);
      showError('Fehler beim Löschen des Teams');
    }
    */
  }

  async getTeamDetails(id: number): Promise<Team | null> {
    try {
      const response = await this.apiClient.request<Team>(`/teams/${id}`, {
        method: 'GET',
      });

      return response;
    } catch (error) {
      console.error('Error getting team details:', error);
      showError('Fehler beim Laden der Teamdetails');
      return null;
    }
  }
}

// Initialize when DOM is ready
let teamsManager: TeamsManager | null = null;

document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if we're on the admin dashboard
  if (window.location.pathname === '/admin-dashboard') {
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
        showError('Bearbeitungsmodal noch nicht implementiert');
      }
    };

    w.viewTeamDetails = async (id: number) => {
      const team = await teamsManager?.getTeamDetails(id);
      if (team !== null) {
        // TODO: Open details modal
        console.info('View team:', team);
        showError('Detailansicht noch nicht implementiert');
      }
    };

    w.deleteTeam = async (id: number) => {
      await teamsManager?.deleteTeam(id);
    };

    // Handler for floating add button
    w.showTeamModal = async () => {
      const modal = document.getElementById('teamModal');
      if (modal !== null) {
        modal.classList.add('active');

        // Load departments for dropdown
        if (teamsManager !== null) {
          try {
            const departments = await teamsManager.loadDepartments();
            const dropdownOptions = document.getElementById('team-department-dropdown');

            if (dropdownOptions && departments) {
              // Clear existing options and add placeholder
              dropdownOptions.innerHTML = `
                <div class="dropdown-option" data-value="" onclick="selectDropdownOption('team-department', '', 'Keine Abteilung')">
                  Keine Abteilung
                </div>
              `;

              // Add department options
              departments.forEach((dept) => {
                const optionDiv = document.createElement('div');
                optionDiv.className = 'dropdown-option';
                optionDiv.setAttribute('data-value', dept.id.toString());
                optionDiv.textContent = dept.name;
                optionDiv.setAttribute(
                  'onclick',
                  `selectDropdownOption('team-department', '${dept.id}', '${dept.name.replace(/'/g, "\\'")}')`,
                );
                dropdownOptions.appendChild(optionDiv);
              });

              console.info('[TeamsManager] Loaded departments:', departments.length);
            }
          } catch (error) {
            console.error('Error loading departments:', error);
          }

          // Load machines for multi-select dropdown
          try {
            const machineResponse = await teamsManager.apiClient.request<Machine[]>('/machines', {
              method: 'GET',
            });
            const machines = machineResponse;
            const machineDropdown = document.getElementById('team-machines-dropdown');

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
                             onchange="updateMachineSelection()"
                             style="margin-right: 8px;">
                      <span>${machine.name} ${machine.departmentName !== undefined && machine.departmentName.length > 0 ? `(${machine.departmentName})` : ''}</span>
                    </label>
                  `;
                  machineDropdown.appendChild(optionDiv);
                });
              }

              console.info('[TeamsManager] Loaded machines:', machines.length);
            }
          } catch (error) {
            console.error('Error loading machines:', error);
          }

          // Load users for multi-select dropdown
          try {
            const userResponse = await teamsManager.apiClient.request<User[]>('/users', {
              method: 'GET',
            });
            const users = userResponse;
            const userDropdown = document.getElementById('team-users-dropdown');

            if (userDropdown !== null) {
              // Clear and create checkboxes for multi-selection
              userDropdown.innerHTML = '';

              if (users.length === 0) {
                userDropdown.innerHTML =
                  '<div class="dropdown-option" style="color: #666;">Keine Benutzer verfügbar</div>';
              } else {
                users.forEach((user) => {
                  const optionDiv = document.createElement('div');
                  optionDiv.className = 'dropdown-option';
                  optionDiv.style.padding = '8px 12px';
                  const displayName =
                    user.firstName !== undefined &&
                    user.firstName.length > 0 &&
                    user.lastName !== undefined &&
                    user.lastName.length > 0
                      ? `${user.firstName} ${user.lastName}`
                      : user.username;
                  optionDiv.innerHTML = `
                    <label style="display: flex; align-items: center; cursor: pointer; width: 100%;">
                      <input type="checkbox" value="${user.id}"
                             onchange="updateUserSelection()"
                             style="margin-right: 8px;">
                      <span>${displayName} ${user.departmentName !== undefined && user.departmentName.length > 0 ? `(${user.departmentName})` : ''}</span>
                    </label>
                  `;
                  userDropdown.appendChild(optionDiv);
                });
              }

              console.info('[TeamsManager] Loaded users:', users.length);
            }
          } catch (error) {
            console.error('Error loading users:', error);
          }
        }

        // Reset form
        const form = document.getElementById('teamForm') as HTMLFormElement | null;
        if (form !== null) {
          form.reset();
        }
      }
    };

    // Close modal handler
    w.closeTeamModal = () => {
      const modal = document.getElementById('teamModal');
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
        dropdown.classList.toggle('active');
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

    // Update user selection handler
    (window as WindowWithTeamHandlers & { updateUserSelection?: () => void }).updateUserSelection = () => {
      const userDropdown = document.getElementById('team-users-dropdown');
      const userDisplay = document.getElementById('team-users-display');
      const userInput = document.getElementById('team-users-select') as HTMLInputElement | null;

      if (userDropdown === null || userDisplay === null || userInput === null) {
        return;
      }

      const checkboxes = userDropdown.querySelectorAll('input[type="checkbox"]:checked');
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
      userInput.value = selectedIds.join(',');

      // Update display
      const displaySpan = userDisplay.querySelector('span');
      if (displaySpan !== null) {
        if (selectedNames.length === 0) {
          displaySpan.textContent = 'Keine Mitglieder zugewiesen';
        } else if (selectedNames.length <= 3) {
          displaySpan.textContent = selectedNames.join(', ');
        } else {
          displaySpan.textContent = `${selectedNames.slice(0, 2).join(', ')} +${selectedNames.length - 2} weitere`;
        }
      }
    };

    // Update machine selection handler
    (window as WindowWithTeamHandlers & { updateMachineSelection?: () => void }).updateMachineSelection = () => {
      const machineDropdown = document.getElementById('team-machines-dropdown');
      const machineDisplay = document.getElementById('team-machines-display');
      const machineInput = document.getElementById('team-machines-select') as HTMLInputElement | null;

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
      const displaySpan = machineDisplay.querySelector('span');
      if (displaySpan !== null) {
        if (selectedNames.length === 0) {
          displaySpan.textContent = 'Keine Maschinen zugewiesen';
        } else if (selectedNames.length <= 3) {
          displaySpan.textContent = selectedNames.join(', ');
        } else {
          displaySpan.textContent = `${selectedNames.slice(0, 2).join(', ')} +${selectedNames.length - 2} weitere`;
        }
      }
    };

    // Save team handler
    w.saveTeam = async () => {
      const form = document.getElementById('teamForm') as HTMLFormElement | null;
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
            .map((id) => parseInt(id, 10));
        } else if (key === 'userIds' && typeof value === 'string' && value.length > 0) {
          // Extract user IDs for separate handling
          userIds = value
            .split(',')
            .filter((id) => id.length > 0)
            .map((id) => parseInt(id, 10));
        } else if (typeof value === 'string' && value.length > 0) {
          if (key === 'maxMembers' || key === 'departmentId') {
            teamData[key] = parseInt(value, 10);
          } else {
            teamData[key] = value;
          }
        }
      });

      // Validate required fields
      if (typeof teamData.name !== 'string' || teamData.name.length === 0) {
        showError('Bitte geben Sie einen Teamnamen ein');
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
                  machineId,
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
                  userId,
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
        showSuccess('Team erfolgreich erstellt');
      } catch (error) {
        console.error('Error creating team:', error);
        showError('Fehler beim Erstellen des Teams');
      }
    };

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
