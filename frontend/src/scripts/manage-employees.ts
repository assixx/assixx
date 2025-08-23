/**
 * Admin Employees Management
 * Handles employee CRUD operations for admin dashboard
 */

import type { User } from '../types/api.types';
import { ApiClient } from '../utils/api-client';
import { mapUsers, type UserAPIResponse } from '../utils/api-mappers';
import { showSuccessAlert, showErrorAlert } from './utils/alerts';
import { $, $$, $$id, setHTML } from '../utils/dom-utils';

interface Employee extends User {
  employeeId?: string;
  employee_id?: string; // Database field name
  employeeNumber?: string; // Employee Number field
  employee_number?: string; // snake_case version
  departmentId?: number;
  departmentName?: string;
  department_name?: string; // snake_case version
  teamId?: number;
  teamName?: string;
  team_name?: string; // snake_case version
  position?: string;
  hireDate?: string;
  birthday?: string; // Birthday field for form
  status: 'active' | 'inactive' | 'vacation' | 'sick' | 'terminated';
  // Availability fields - both snake_case and camelCase
  availabilityStatus?: string;
  availability_status?: string;
  availabilityReason?: string;
  availableFrom?: string;
  availabilityStart?: string;
  availability_start?: string;
  availabilityEnd?: string;
  availability_end?: string;
  availabilityNotes?: string;
  availability_notes?: string;
  // Add both snake_case and camelCase for compatibility
  first_name?: string;
  last_name?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean | number; // API v2 camelCase (can be boolean or 0/1)
  phone?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  availability?: 'available' | 'busy' | 'away' | 'offline';
  notes?: string;
  contractType?: 'permanent' | 'contract' | 'parttime' | 'intern';
  salary?: number;
  workingHours?: number;
  vacationDays?: number;
}

interface Department {
  id: number;
  name: string;
  areaId?: number;
}

interface Team {
  id: number;
  name: string;
  departmentId?: number;
}

interface WindowWithEmployeeHandlers extends Window {
  loadEmployeesTable?: () => Promise<void>;
  editEmployee?: (id: number) => Promise<void>;
  viewEmployeeDetails?: (id: number) => Promise<void>;
  deleteEmployee?: (id: number) => Promise<void>;
  showEmployeeModal?: () => void;
  hideEmployeeModal?: () => void;
  closeEmployeeModal?: () => void; // Alias for hideEmployeeModal
  saveEmployee?: () => Promise<void>;
  loadDepartmentsForEmployeeSelect: () => Promise<void>;
  loadTeamsForEmployeeSelect?: () => Promise<void>;
}

class EmployeesManager {
  public apiClient: ApiClient;
  private employees: Employee[] = [];
  private currentFilter: 'all' | 'active' | 'inactive' = 'all';
  private searchTerm = '';
  private useV2API = true; // Default to v2 API
  public currentEmployeeId: number | null = null; // Track current employee being edited

  constructor() {
    this.apiClient = ApiClient.getInstance();
    // Check feature flag for v2 API
    const w = window as Window & { FEATURE_FLAGS?: { USE_API_V2_USERS?: boolean } };
    this.useV2API = w.FEATURE_FLAGS?.USE_API_V2_USERS !== false;
    this.initializeEventListeners();
  }

  private async showConfirmDialog(message: string): Promise<boolean> {
    return await new Promise<boolean>((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal active';
      const modalHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">Bestätigung erforderlich</h3>
          </div>
          <div class="modal-body">
            <p>${message}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" id="confirm-action">Bestätigen</button>
            <button class="btn btn-secondary" id="cancel-action">Abbrechen</button>
          </div>
        </div>
      `;
      // eslint-disable-next-line no-unsanitized/property -- Safe: We control the message content
      modal.innerHTML = modalHTML;
      document.body.append(modal);

      const confirmBtn = modal.querySelector('#confirm-action');
      const cancelBtn = modal.querySelector('#cancel-action');

      confirmBtn?.addEventListener('click', () => {
        modal.remove();
        resolve(true);
      });

      cancelBtn?.addEventListener('click', () => {
        modal.remove();
        resolve(false);
      });

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
          resolve(false);
        }
      });
    });
  }

  private initializeEventListeners() {
    // Floating Add Button
    document.querySelector('.add-employee-btn')?.addEventListener('click', () => {
      this.showEmployeeModal();
    });

    // Filter buttons
    document.querySelector('#show-all-employees')?.addEventListener('click', () => {
      this.currentFilter = 'all';
      void this.loadEmployees();
    });

    document.querySelector('#filter-employees-active')?.addEventListener('click', () => {
      this.currentFilter = 'active';
      void this.loadEmployees();
    });

    document.querySelector('#filter-employees-inactive')?.addEventListener('click', () => {
      this.currentFilter = 'inactive';
      void this.loadEmployees();
    });

    // Search
    $$id('employee-search-btn')?.addEventListener('click', () => {
      const searchInput = $$id('employee-search');
      this.searchTerm = searchInput instanceof HTMLInputElement ? searchInput.value : '';
      void this.loadEmployees();
    });

    // Enter key on search
    $$id('employee-search')?.addEventListener('keypress', (e) => {
      if (e instanceof KeyboardEvent && e.key === 'Enter') {
        const searchInput = e.target as HTMLInputElement;
        this.searchTerm = searchInput.value;
        void this.loadEmployees();
      }
    });

    // Close modal buttons
    document.querySelectorAll('[data-action="close-employee-modal"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.hideEmployeeModal();
      });
    });
  }

  async loadEmployees(): Promise<void> {
    try {
      const params: Record<string, string> = {};

      if (this.currentFilter !== 'all') {
        params.status = this.currentFilter;
      }

      if (this.searchTerm.length > 0) {
        params.search = this.searchTerm;
      }

      // ApiClient adds /api/v2 or /api prefix automatically based on feature flag
      const response = await this.apiClient.request<UserAPIResponse[]>('/users', {
        method: 'GET',
      });

      // Handle empty response
      if (!Array.isArray(response)) {
        this.employees = [];
        this.renderEmployeesTable();
        return;
      }

      // Map response through api-mappers for consistent field names (only for v2)
      const mappedUsers = this.useV2API ? mapUsers(response) : response;

      // CRITICAL SECURITY: Only show users with role='employee'
      // NEVER show admins or roots in the employees table
      // Admins cannot manage other admins or see root users
      this.employees = mappedUsers.filter((user) => user.role === 'employee') as Employee[];

      // Apply status filter based on is_active field
      if (this.currentFilter === 'active') {
        this.employees = this.employees.filter((emp) => emp.is_active);
      } else if (this.currentFilter === 'inactive') {
        this.employees = this.employees.filter((emp) => !emp.is_active);
      }

      if (this.searchTerm.length > 0) {
        const search = this.searchTerm.toLowerCase();
        this.employees = this.employees.filter(
          (emp) =>
            (emp.first_name?.toLowerCase().includes(search) ?? false) ||
            (emp.last_name?.toLowerCase().includes(search) ?? false) ||
            emp.email.toLowerCase().includes(search) ||
            (emp.position?.toLowerCase().includes(search) ?? false) ||
            (emp.employeeId?.toLowerCase().includes(search) ?? false),
        );
      }

      // V2 API already provides availability data in the user objects
      // The availabilityStatus field is now included directly in the user response
      console.info('[EmployeesManager] Using availability data from v2 API');

      this.renderEmployeesTable();
    } catch (error) {
      console.error('Error loading employees:', error);
      // Check if it's a 404 (no data) - in that case just show empty state
      const errorObj = error as { status?: number; message?: string };
      if (errorObj.status === 404) {
        // No employees found - this is OK, just show empty state
        this.employees = [];
        this.renderEmployeesTable();
      } else {
        // Real error - show error message
        showErrorAlert('Fehler beim Laden der Mitarbeiter');
      }
    }
  }

  private renderEmployeesTable(): void {
    // Use the same container as the HTML file uses
    const container = $$id('employeeTableContent');
    if (container === null) {
      console.error('[renderEmployeesTable] Container #employeeTableContent not found!');
      return;
    }
    console.info('[renderEmployeesTable] Rendering table with', this.employees.length, 'employees');

    if (this.employees.length === 0) {
      setHTML(
        container,
        `
        <div class="empty-state">
          <div class="empty-state-icon">👥</div>
          <div class="empty-state-text">Keine Mitarbeiter gefunden</div>
          <div class="empty-state-subtext">Fügen Sie Ihren ersten Mitarbeiter hinzu</div>
        </div>
      `,
      );
      return;
    }

    // Render full table structure (same as HTML version)
    const tableHTML = `
      <table class="employee-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>E-Mail</th>
            <th>Position</th>
            <th>Personalnummer</th>
            <th>Abteilung</th>
            <th>Team</th>
            <th>Status</th>
            <th>Verfügbarkeit</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          ${this.employees
            .map((employee) => {
              const firstName = employee.first_name ?? employee.firstName ?? '';
              const lastName = employee.last_name ?? employee.lastName ?? '';
              const fullName = `${firstName} ${lastName}`.trim();
              const displayName = fullName !== '' ? fullName : employee.username;

              // Check both snake_case and camelCase fields (API v1 vs v2)
              // Priority: Check isActive first (API v2), then is_active (API v1/DB)
              let isActive = true; // Default to active
              if ('isActive' in employee && employee.isActive !== undefined) {
                // isActive can be boolean or number (0/1)
                isActive = employee.isActive === true || employee.isActive === 1;
              } else if ('is_active' in employee) {
                // is_active is always boolean
                isActive = employee.is_active;
              }

              return `
            <tr>
              <td>${displayName}</td>
              <td>${employee.email}</td>
              <td>${employee.position ?? '-'}</td>
              <td>${employee.employee_number ?? employee.employeeNumber ?? employee.employee_id ?? employee.employeeId ?? '-'}</td>
              <td>${employee.department_name ?? employee.departmentName ?? '-'}</td>
              <td>${employee.team_name ?? employee.teamName ?? '-'}</td>
              <td>
                <span class="badge ${isActive ? 'badge-success' : 'badge-secondary'}">
                  ${isActive ? 'Aktiv' : 'Inaktiv'}
                </span>
              </td>
              <td>
                ${this.getAvailabilityBadge(employee)}
              </td>
              <td>
                <button class="action-btn edit" onclick="window.editEmployee(${employee.id})">Bearbeiten</button>
                <button class="action-btn delete" onclick="window.deleteEmployee(${employee.id})">Löschen</button>
              </td>
            </tr>
          `;
            })
            .join('')}
        </tbody>
      </table>
    `;

    setHTML(container, tableHTML);
  }

  // Unused methods - commenting out to resolve TypeScript warnings
  // Can be re-enabled when needed
  /*
  private getStatusBadgeClass(status?: string): string {
    switch (status) {
      case 'active':
        return 'badge-success';
      case 'inactive':
        return 'badge-secondary';
      case 'vacation':
        return 'badge-info';
      case 'sick':
        return 'badge-warning';
      case 'terminated':
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  }

  private getStatusLabel(status?: string): string {
    switch (status) {
      case 'active':
        return 'Aktiv';
      case 'inactive':
        return 'Inaktiv';
      case 'vacation':
        return 'Urlaub';
      case 'sick':
        return 'Krank';
      case 'terminated':
        return 'Ausgeschieden';
      default:
        return status ?? 'Unbekannt';
    }
  }
  */

  private getAvailabilityBadge(employee: Employee): string {
    // Handle both snake_case and camelCase from API
    let rawStatus = employee.availabilityStatus ?? employee.availability_status ?? 'available';

    // API v2 sometimes returns combined statuses like "available vacation"
    // Extract the actual status (second word if exists, otherwise first)
    let status = 'available';
    if (typeof rawStatus === 'string') {
      const parts = rawStatus.trim().split(/\s+/);
      // If we have multiple parts, the actual status is usually the second one
      // e.g., "available vacation" -> "vacation"
      if (parts.length > 1) {
        status = parts[1]; // Take the second part as the actual status
      } else {
        status = parts[0] !== '' ? parts[0] : 'available';
      }
    }

    console.info('[EmployeesManager] Availability status for', employee.email, ':', {
      availabilityStatus: employee.availabilityStatus,
      availability_status: employee.availability_status,
      rawStatus: rawStatus,
      resolved: status,
    });

    // Farben basierend auf design-standards
    // Grün = Verfügbar, Orange = Urlaub, Rot = Krank, Cyan = Schulung, Grau = Nicht verfügbar/Sonstiges
    let badgeClass = 'badge-success';
    let badgeText = 'Verfügbar';

    switch (status) {
      case 'vacation':
        badgeClass = 'badge-warning';
        badgeText = 'Urlaub';
        break;
      case 'sick':
        badgeClass = 'badge-danger';
        badgeText = 'Krank';
        break;
      case 'unavailable':
        badgeClass = 'badge-secondary';
        badgeText = 'Nicht verfügbar';
        break;
      case 'training':
        badgeClass = 'badge-info';
        badgeText = 'Schulung';
        break;
      case 'other':
        badgeClass = 'badge-dark';
        badgeText = 'Sonstiges';
        break;
      case 'available':
      default:
        badgeClass = 'badge-success';
        badgeText = 'Verfügbar';
        break;
    }

    return `<span class="badge ${badgeClass}">${badgeText}</span>`;
  }

  showEmployeeModal(isEdit = false, departmentId?: number, teamId?: number): void {
    const modal = $$id('employee-modal');
    if (modal !== null) {
      modal.classList.add('active'); // Verwende .active Klasse wie bei manage-admins!

      // Show/hide availability section based on mode
      const availabilitySections = modal.querySelectorAll('.form-section');
      availabilitySections.forEach((section) => {
        const heading = section.querySelector('h4');
        if (heading !== null && heading.textContent === 'Verfügbarkeit') {
          // Show for edit mode, hide for create mode
          (section as HTMLElement).style.display = isEdit ? 'block' : 'none';
        }
      });

      // Load departments and teams after showing modal
      setTimeout(() => {
        const w = window as WindowWithEmployeeHandlers;

        // Use void to handle promise without async/await in setTimeout
        void (async () => {
          // Load departments first
          await w.loadDepartmentsForEmployeeSelect();

          // Restore department selection if provided
          if (departmentId !== undefined) {
            const deptSelect = $$<HTMLSelectElement>('#employee-department-select');
            if (deptSelect !== null) {
              console.info('[showEmployeeModal] Restoring department selection:', departmentId);
              deptSelect.value = String(departmentId);
            }
          }

          // Load teams (will be filtered by selected department)
          await w.loadTeamsForEmployeeSelect?.();

          // Restore team selection if provided
          if (teamId !== undefined) {
            const teamSelect = $$<HTMLSelectElement>('#employee-team-select');
            if (teamSelect !== null) {
              console.info('[showEmployeeModal] Restoring team selection:', teamId);
              teamSelect.value = String(teamId);
            }
          }
        })();
      }, 100);
    }
  }

  hideEmployeeModal(): void {
    const modal = $$id('employee-modal');
    if (modal !== null) {
      modal.classList.remove('active'); // Verwende .active Klasse wie bei manage-admins!
    }
  }

  async createEmployee(data: Partial<Employee>): Promise<Employee> {
    // Clean optional fields - send undefined instead of empty strings
    const cleanedData = { ...data };

    // Store teamId separately for later assignment
    const teamId = cleanedData.teamId;
    delete cleanedData.teamId; // Remove from user creation data

    // Handle optional fields - delete empty strings
    if (cleanedData.phone === '') {
      delete cleanedData.phone;
    }
    // Handle birthday field - keep as is, DB column is 'birthday'
    if (cleanedData.birthday === '') {
      delete cleanedData.birthday;
    }
    if (cleanedData.position === '') {
      delete cleanedData.position;
    }
    if (cleanedData.employeeNumber === '' || cleanedData.employeeNumber === undefined) {
      // Generate unique employee number if not provided
      cleanedData.employeeNumber = `EMP${Date.now()}`;
    }

    // Remove availability fields for new employees
    delete cleanedData.availabilityStatus;
    delete cleanedData.availabilityStart;
    delete cleanedData.availabilityEnd;
    delete cleanedData.availabilityNotes;

    const response = await this.apiClient.request<UserAPIResponse>('/users', {
      method: 'POST',
      body: JSON.stringify(cleanedData),
    });

    // If teamId was provided, assign the user to the team
    if (teamId !== undefined) {
      try {
        console.info('[createEmployee] Assigning user to team:', teamId);
        // Use the same endpoint as manage-teams
        await this.apiClient.request(`/teams/${teamId}/members`, {
          method: 'POST',
          body: JSON.stringify({ userId: response.id }),
        });
        console.info('[createEmployee] User successfully assigned to team');
      } catch (error) {
        console.error('[createEmployee] Error assigning user to team:', error);
        // Don't fail the whole operation, just show a warning
        showErrorAlert('Mitarbeiter wurde erstellt, aber die Team-Zuweisung ist fehlgeschlagen');
      }
    }

    showSuccessAlert('Mitarbeiter erfolgreich erstellt');

    // Reload employees list without page reload (like in manage-admins)
    console.info('[createEmployee] Reloading employees list...');
    await this.loadEmployees();
    console.info('[createEmployee] Employees list reloaded successfully');

    // Map single user response
    const mappedUsers = mapUsers([response]);
    return mappedUsers[0] as unknown as Employee;
  }

  async updateEmployee(id: number, data: Partial<Employee>): Promise<Employee> {
    // SECURITY: First check if user is actually an employee
    const user = await this.getEmployeeDetails(id);
    if (user === null) {
      showErrorAlert('Mitarbeiter nicht gefunden');
      throw new Error('User not found');
    }

    // CRITICAL: Never allow editing of admins or roots
    if (user.role !== 'employee') {
      showErrorAlert('Sicherheitsfehler: Diese Aktion ist nicht erlaubt');
      console.error(`SECURITY VIOLATION: Attempted to update user with role ${user.role}`);
      throw new Error('Security violation');
    }

    // Store teamId separately for later assignment
    // data.teamId comes from form (could be string), user.teamId from API (number)
    const newTeamIdRaw = data.teamId;
    const currentTeamId = user.teamId;
    delete data.teamId; // Remove from user update data

    try {
      const response = await this.apiClient.request<UserAPIResponse>(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      // Handle team assignment changes
      // Both should be numbers at this point (form values are converted in saveEmployee)
      const newTeamIdNum = newTeamIdRaw ?? null;
      const currentTeamIdNum = currentTeamId ?? null;

      console.info('[updateEmployee] Team comparison:', {
        newTeamId: newTeamIdNum,
        currentTeamId: currentTeamIdNum,
        willUpdate: newTeamIdNum !== currentTeamIdNum,
      });

      if (newTeamIdNum !== currentTeamIdNum) {
        // Remove from old team if exists
        if (currentTeamIdNum !== null) {
          try {
            console.info('[updateEmployee] Removing user from old team:', currentTeamIdNum);
            // Use the same endpoint as manage-teams
            await this.apiClient.request(`/teams/${currentTeamIdNum}/members/${id}`, {
              method: 'DELETE',
            });
          } catch (error) {
            console.error('[updateEmployee] Error removing from old team:', error);
          }
        }

        // Add to new team if specified
        if (newTeamIdNum !== null) {
          try {
            console.info('[updateEmployee] Assigning user to new team:', newTeamIdNum);
            // Use the same endpoint as manage-teams
            await this.apiClient.request(`/teams/${newTeamIdNum}/members`, {
              method: 'POST',
              body: JSON.stringify({ userId: id }),
            });
            console.info('[updateEmployee] User successfully assigned to new team');
          } catch (error) {
            console.error('[updateEmployee] Error assigning to new team:', error);
            showErrorAlert('Team-Zuweisung konnte nicht aktualisiert werden');
          }
        }
      } else {
        console.info('[updateEmployee] Team unchanged, skipping team assignment');
      }

      showSuccessAlert('Mitarbeiter erfolgreich aktualisiert');
      await this.loadEmployees();

      // Map single user response
      const mappedUsers = mapUsers([response]);
      return mappedUsers[0] as unknown as Employee;
    } catch (error) {
      console.error('Error updating employee:', error);
      showErrorAlert('Fehler beim Aktualisieren des Mitarbeiters');
      throw error;
    }
  }

  async deleteEmployee(id: number): Promise<void> {
    // SECURITY: First check if user is actually an employee
    const user = await this.getEmployeeDetails(id);
    if (user === null) {
      showErrorAlert('Mitarbeiter nicht gefunden');
      return;
    }

    // CRITICAL: Never allow deletion of admins or roots
    if (user.role !== 'employee') {
      showErrorAlert('Sicherheitsfehler: Diese Aktion ist nicht erlaubt');
      console.error(`SECURITY VIOLATION: Attempted to delete user with role ${user.role}`);
      return;
    }

    const confirmDelete = await this.showConfirmDialog('Sind Sie sicher, dass Sie diesen Mitarbeiter löschen möchten?');
    if (!confirmDelete) {
      return;
    }

    try {
      await this.apiClient.request(`/users/${id}`, {
        method: 'DELETE',
      });

      showSuccessAlert('Mitarbeiter erfolgreich gelöscht');
      await this.loadEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      showErrorAlert('Fehler beim Löschen des Mitarbeiters');
    }
  }

  async getEmployeeDetails(id: number): Promise<Employee | null> {
    try {
      const response = await this.apiClient.request<UserAPIResponse>(`/users/${id}`, {
        method: 'GET',
      });

      // Map single user response
      const mappedUsers = mapUsers([response]);
      return mappedUsers[0] as unknown as Employee;
    } catch (error) {
      console.error('Error getting employee details:', error);
      showErrorAlert('Fehler beim Laden der Mitarbeiterdetails');
      return null;
    }
  }

  async loadDepartments(): Promise<Department[]> {
    try {
      return await this.apiClient.request<Department[]>('/departments', {
        method: 'GET',
      });
    } catch (error) {
      console.error('Error loading departments:', error);
      return [];
    }
  }

  async loadTeams(): Promise<Team[]> {
    try {
      return await this.apiClient.request<Team[]>('/teams', {
        method: 'GET',
      });
    } catch (error) {
      console.error('Error loading teams:', error);
      return [];
    }
  }
}

// Export manager instance
let employeesManager: EmployeesManager | null = null;

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize on admin dashboard or manage-employees page
  if (window.location.pathname === '/admin-dashboard' || window.location.pathname === '/manage-employees') {
    employeesManager = new EmployeesManager();

    // Setup global window functions
    const w = window as WindowWithEmployeeHandlers;

    w.loadEmployeesTable = async () => {
      console.info('[EmployeesManager] loadEmployeesTable called');
      await employeesManager?.loadEmployees();
    };

    w.editEmployee = async (id: number) => {
      const employee = await employeesManager?.getEmployeeDetails(id);
      if (employee !== null && employee !== undefined) {
        console.info('Edit employee:', employee);
        console.info('Employee details:', {
          employeeNumber: employee.employeeNumber,
          departmentId: employee.departmentId,
          teamId: employee.teamId,
          isActive: employee.isActive,
        });

        // Set current employee ID for update
        if (employeesManager) {
          employeesManager.currentEmployeeId = id;
        }

        // Get modal elements
        const modalTitle = $$('#modalTitle'); // Use the ID directly

        // Update modal title
        if (modalTitle) {
          modalTitle.textContent = 'Mitarbeiter bearbeiten';
        }

        // Fill form with employee data - using $$ for null-safe access like manage-admins
        // Fill basic required fields
        $<HTMLInputElement>('input[name="firstName"]').value = employee.firstName ?? '';
        $<HTMLInputElement>('input[name="lastName"]').value = employee.lastName ?? '';
        $<HTMLInputElement>('input[name="email"]').value = employee.email;
        $<HTMLInputElement>('input[name="emailConfirm"]').value = employee.email;

        // Optional fields - using $$ for null-safe access
        const phone = $$<HTMLInputElement>('input[name="phone"]');
        if (phone) phone.value = employee.phone ?? '';

        const position = $$<HTMLInputElement>('input[name="position"]');
        if (position) position.value = employee.position ?? '';

        const employeeNumber = $$<HTMLInputElement>('input[name="employeeNumber"]');
        if (employeeNumber) {
          console.info('Setting employeeNumber field to:', employee.employeeNumber);
          employeeNumber.value = employee.employeeNumber ?? '';
        }

        const birthday = $$<HTMLInputElement>('input[name="birthday"]');
        if (birthday && employee.birthdate !== undefined && employee.birthdate !== '') {
          const date = new Date(employee.birthdate);
          birthday.value = date.toISOString().split('T')[0];
        }

        // Store department and team IDs for restoration after loading
        const departmentId = employee.departmentId;
        const teamId = employee.teamId;

        const availabilityStatus = $$<HTMLSelectElement>('#availability-status-select');
        if (availabilityStatus && employee.availabilityStatus !== undefined && employee.availabilityStatus !== '') {
          availabilityStatus.value = employee.availabilityStatus;
        }

        const isActiveSelect = $$<HTMLSelectElement>('select[name="isActive"]');
        if (isActiveSelect) {
          console.info(
            'Setting isActive to:',
            employee.isActive,
            '-> select value:',
            employee.isActive === true ? '1' : '0',
          );
          isActiveSelect.value = employee.isActive === true ? '1' : '0';
        }

        // Clear password fields for edit mode
        const passwordField = $$<HTMLInputElement>('input[name="password"]');
        const passwordConfirmField = $$<HTMLInputElement>('input[name="passwordConfirm"]');
        if (passwordField) passwordField.value = '';
        if (passwordConfirmField) passwordConfirmField.value = '';

        // Show modal in edit mode and pass department/team IDs for restoration
        employeesManager?.showEmployeeModal(true, departmentId, teamId);
      }
    };

    w.viewEmployeeDetails = async (id: number) => {
      const employee = await employeesManager?.getEmployeeDetails(id);
      if (employee !== null) {
        console.info('View employee:', employee);
        // TODO: Show employee details modal
        showErrorAlert('Detailansicht noch nicht implementiert');
      }
    };

    w.deleteEmployee = async (id: number) => {
      await employeesManager?.deleteEmployee(id);
    };

    w.viewEmployeeDetails = async (id: number) => {
      // Vorerst zur Bearbeiten-Funktion weiterleiten
      // TODO: Implementiere separate Detail-Ansicht
      await w.editEmployee?.(id);
    };

    w.showEmployeeModal = () => {
      // Reset form for new employee
      if (employeesManager) {
        employeesManager.currentEmployeeId = null;
      }
      const modalTitle = $$('#modalTitle');
      if (modalTitle) {
        modalTitle.textContent = 'Neuen Mitarbeiter anlegen';
      }
      const form = $$<HTMLFormElement>('#employee-form');
      if (form) {
        form.reset();
      }
      // Set default status to Active for new employees
      const isActiveSelect = $$<HTMLSelectElement>('select[name="isActive"]');
      if (isActiveSelect) {
        isActiveSelect.value = '1'; // Default to Active
      }
      employeesManager?.showEmployeeModal();
    };

    w.hideEmployeeModal = () => {
      employeesManager?.hideEmployeeModal();
    };

    // Also expose closeEmployeeModal as alias for compatibility with HTML onclick handlers
    w.closeEmployeeModal = () => {
      employeesManager?.hideEmployeeModal();
    };

    w.saveEmployee = async () => {
      console.info('[saveEmployee] Function called');
      const form = $$id('employee-form');
      if (!(form instanceof HTMLFormElement)) {
        console.error('[saveEmployee] Form not found or not a form element');
        return;
      }
      console.info('[saveEmployee] Form found, processing data...');

      const formData = new FormData(form);
      const data: Record<string, unknown> = {};

      formData.forEach((value, key) => {
        if (typeof value === 'string' && value.length > 0) {
          // Convert to appropriate types - using safe key assignments
          switch (key) {
            case 'departmentId':
            case 'teamId':
              // eslint-disable-next-line security/detect-object-injection
              data[key] = Number.parseInt(value, 10);
              break;
            case 'email':
            case 'firstName':
            case 'lastName':
            case 'position':
            case 'employeeNumber':
            case 'phone':
            case 'birthday':
            case 'isActive':
            case 'availabilityStatus':
            case 'availabilityStart':
            case 'availabilityEnd':
            case 'availabilityNotes':
              // eslint-disable-next-line security/detect-object-injection
              data[key] = value;
              break;
            case 'password':
              // Only include password if it's not empty (for updates)
              if (value.length > 0) {
                // eslint-disable-next-line security/detect-object-injection
                data[key] = value;
              }
              break;
            case 'passwordConfirm':
            case 'emailConfirm':
              // These fields are only for client-side validation
              // They should NOT be sent to the API
              // Silently skip them - this is expected behavior
              break;
            default:
              // SECURITY: Log any unexpected form fields
              // This helps detect potential security issues or typos
              console.warn(`[SECURITY] Unexpected form field detected: ${key}`);
              // DO NOT include unknown fields in data for security
              break;
          }
        }
      });

      // Ensure required fields
      if (
        typeof data.email !== 'string' ||
        data.email.length === 0 ||
        typeof data.firstName !== 'string' ||
        data.firstName.length === 0 ||
        typeof data.lastName !== 'string' ||
        data.lastName.length === 0
      ) {
        showErrorAlert('Bitte füllen Sie alle Pflichtfelder aus');
        return;
      }

      // Set role to 'employee' for new users
      data.role = 'employee';
      // Set username to email (required by backend)
      data.username = data.email;
      // Convert isActive to boolean if present
      if (data.isActive !== undefined) {
        data.isActive = data.isActive === '1' || data.isActive === true;
      }

      try {
        console.info('[saveEmployee] Starting save operation...');
        // Check if we're updating or creating
        if (employeesManager?.currentEmployeeId !== null && employeesManager?.currentEmployeeId !== undefined) {
          console.info('[saveEmployee] Updating employee ID:', employeesManager.currentEmployeeId);
          // Update existing employee
          await employeesManager.updateEmployee(employeesManager.currentEmployeeId, data as Partial<Employee>);
        } else {
          console.info('[saveEmployee] Creating new employee...');
          // Create new employee
          await employeesManager?.createEmployee(data as Partial<Employee>);
        }
        console.info('[saveEmployee] Save successful, closing modal...');
        w.hideEmployeeModal?.();
        form.reset();
        // Reset current employee ID
        if (employeesManager) {
          employeesManager.currentEmployeeId = null;
        }
      } catch (error) {
        console.error('Error saving employee:', error);

        // Check if error has a message property (works for both ApiError and Error)
        const errorObj = error as { message?: string; code?: string; name?: string };

        if (errorObj.message !== undefined) {
          const errorMessage = errorObj.message.toLowerCase();
          console.error('Error message to check:', errorObj.message);

          if (errorMessage.includes('email already exists') || errorMessage.includes('email existiert bereits')) {
            showErrorAlert(
              'Diese E-Mail-Adresse ist bereits vergeben. Bitte verwenden Sie eine andere E-Mail-Adresse.',
            );
          } else if (
            errorMessage.includes('username already exists') ||
            errorMessage.includes('benutzername existiert bereits')
          ) {
            showErrorAlert('Dieser Benutzername ist bereits vergeben. Bitte wählen Sie einen anderen Benutzernamen.');
          } else if (errorMessage.includes('duplicate') || errorMessage.includes('duplikat')) {
            showErrorAlert('Ein Mitarbeiter mit diesen Daten existiert bereits.');
          } else if (errorMessage.includes('validation')) {
            showErrorAlert(`Validierungsfehler: ${errorObj.message}`);
          } else {
            // Show the actual error message from backend
            showErrorAlert(errorObj.message);
          }
        } else {
          console.error('Unknown error type:', error);
          showErrorAlert('Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
        }
      }
    };

    w.loadDepartmentsForEmployeeSelect = async (): Promise<void> => {
      const departments = await employeesManager?.loadDepartments();
      const selectElement = document.querySelector('#employee-department-select');

      if (selectElement !== null && departments !== undefined) {
        // Clear existing options and add default
        selectElement.innerHTML = '<option value="">Keine Abteilung</option>';

        // Add department options
        departments.forEach((dept) => {
          const option = document.createElement('option');
          option.value = dept.id.toString();
          option.textContent = dept.name;
          selectElement.append(option);
        });

        console.info('[EmployeesManager] Loaded departments:', departments.length);
      }
    };

    w.loadTeamsForEmployeeSelect = async (): Promise<void> => {
      const teams = await employeesManager?.loadTeams();
      const deptSelect = $$id('employee-department-select');
      const selectedDeptId = deptSelect instanceof HTMLSelectElement ? deptSelect.value : undefined;
      const selectElement = $$id('employee-team-select');

      if (selectElement !== null && teams !== undefined) {
        // Filter teams by department if one is selected
        let filteredTeams = teams;
        if (selectedDeptId !== undefined && selectedDeptId !== '' && selectedDeptId !== '0') {
          filteredTeams = teams.filter((team) => team.departmentId === Number.parseInt(selectedDeptId, 10));
        }

        // Clear existing options and add default
        selectElement.innerHTML = '<option value="">Kein Team</option>';

        // Add team options
        filteredTeams.forEach((team) => {
          const option = document.createElement('option');
          option.value = team.id.toString();
          option.textContent = team.name;
          selectElement.append(option);
        });

        console.info('[EmployeesManager] Loaded teams:', filteredTeams.length);
      }
    };

    // Add form submit handler - wait for DOM to be ready
    setTimeout(() => {
      const employeeForm = document.querySelector('#employee-form');
      console.info('[EmployeesManager] Looking for form element...');
      if (employeeForm !== null) {
        console.info('[EmployeesManager] Form found, adding submit handler');
        employeeForm.addEventListener('submit', (e) => {
          console.info('[EmployeesManager] Form submit triggered');
          e.preventDefault();
          e.stopPropagation();
          void w.saveEmployee?.();
          return false;
        });
      } else {
        console.error('[EmployeesManager] Form element not found!');
      }
    }, 100);

    // Check URL and load employees if needed
    const checkAndLoadEmployees = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const currentPath = window.location.pathname;

      // Load employees if on admin dashboard employees section OR on manage-employees page
      if (urlParams.get('section') === 'employees' || currentPath.includes('manage-employees')) {
        void employeesManager?.loadEmployees();
      }
    };

    // Initial check
    checkAndLoadEmployees();

    // Listen for URL changes
    window.addEventListener('popstate', checkAndLoadEmployees);

    // Override pushState and replaceState
    const originalPushState = window.history.pushState.bind(window.history);
    window.history.pushState = function (...args) {
      originalPushState.apply(window.history, args);
      setTimeout(checkAndLoadEmployees, 100);
    };

    const originalReplaceState = window.history.replaceState.bind(window.history);
    window.history.replaceState = function (...args) {
      originalReplaceState.apply(window.history, args);
      setTimeout(checkAndLoadEmployees, 100);
    };
  }
});

export { EmployeesManager };
