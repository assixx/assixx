/**
 * Admin Employees Management
 * Handles employee CRUD operations for admin dashboard
 */

import type { User } from '../types/api.types';
import { ApiClient } from '../utils/api-client';
import { mapUsers, type UserAPIResponse } from '../utils/api-mappers';

import { showSuccessAlert, showErrorAlert } from './utils/alerts';

interface Employee extends User {
  employeeId?: string;
  employee_id?: string; // Database field name
  departmentId?: number;
  departmentName?: string;
  teamId?: number;
  teamName?: string;
  position?: string;
  hireDate?: string;
  status: 'active' | 'inactive' | 'vacation' | 'sick' | 'terminated';
  // Add both snake_case and camelCase for compatibility
  first_name?: string;
  last_name?: string;
  firstName?: string;
  lastName?: string;
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

  constructor() {
    this.apiClient = ApiClient.getInstance();
    // Check feature flag for v2 API
    const w = window as Window & { FEATURE_FLAGS?: { USE_API_V2_USERS?: boolean } };
    this.useV2API = w.FEATURE_FLAGS?.USE_API_V2_USERS !== false;
    this.initializeEventListeners();
  }

  private showConfirmDialog(message: string): boolean {
    // TODO: Implement custom modal dialog
    // For now, return false to block action
    // In production, this should open a proper confirmation modal
    showErrorAlert(`${message} (Bestätigung erforderlich - Feature noch nicht implementiert)`);
    return false; // Safer to block action until proper modal is implemented
  }

  private initializeEventListeners() {
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
    document.querySelector('#employee-search-btn')?.addEventListener('click', () => {
      const searchInput = document.querySelector('#employee-search') as HTMLInputElement | null;
      this.searchTerm = searchInput !== null ? searchInput.value : '';
      void this.loadEmployees();
    });

    // Enter key on search
    document.querySelector('#employee-search')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
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
    const tableBody = document.querySelector('#employees-table-body');
    if (tableBody === null) return;

    if (this.employees.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-muted">Keine Mitarbeiter gefunden</td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = this.employees
      .map(
        (employee) => `
      <tr>
        <td>
          <strong>${employee.first_name ?? ''} ${employee.last_name ?? ''}</strong>
          ${employee.position !== undefined && employee.position.length > 0 ? `<br><small class="text-muted">${employee.position}</small>` : ''}
        </td>
        <td>${employee.email}</td>
        <td>
          <code>${employee.employee_id ?? employee.employeeId ?? '-'}</code>
        </td>
        <td>${employee.departmentName ?? '-'}</td>
        <td>
          <span class="badge ${!employee.is_active ? 'badge-secondary' : 'badge-success'}">
            ${!employee.is_active ? 'Inaktiv' : 'Aktiv'}
          </span>
        </td>
        <td>
          <span class="availability-dot ${this.getAvailabilityClass(employee.availability)}"></span>
          ${this.getAvailabilityLabel(employee.availability)}
        </td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="window.editEmployee(${employee.id})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-secondary" onclick="window.viewEmployeeDetails(${employee.id})">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="window.deleteEmployee(${employee.id})">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `,
      )
      .join('');
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

  private getAvailabilityClass(availability?: string): string {
    switch (availability) {
      case 'available':
        return 'available';
      case 'busy':
        return 'busy';
      case 'away':
        return 'away';
      case 'offline':
      default:
        return 'offline';
    }
  }

  private getAvailabilityLabel(availability?: string): string {
    switch (availability) {
      case 'available':
        return 'Verfügbar';
      case 'busy':
        return 'Beschäftigt';
      case 'away':
        return 'Abwesend';
      case 'offline':
      default:
        return 'Offline';
    }
  }

  showEmployeeModal(): void {
    const modal = document.querySelector('#employee-modal');
    if (modal !== null) {
      modal.style.display = 'flex';

      // Load departments and teams after showing modal
      setTimeout(() => {
        const w = window as WindowWithEmployeeHandlers;
        void w.loadDepartmentsForEmployeeSelect();
        void w.loadTeamsForEmployeeSelect?.();
      }, 100);
    }
  }

  hideEmployeeModal(): void {
    const modal = document.querySelector('#employee-modal');
    if (modal !== null) {
      modal.style.display = 'none';
    }
  }

  async createEmployee(data: Partial<Employee>): Promise<Employee> {
    const response = await this.apiClient.request<UserAPIResponse>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    showSuccessAlert('Mitarbeiter erfolgreich erstellt');

    // Reload page after successful creation
    setTimeout(() => {
      window.location.reload();
    }, 1000);

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

    try {
      const response = await this.apiClient.request<UserAPIResponse>(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

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

    const confirmDelete = this.showConfirmDialog('Sind Sie sicher, dass Sie diesen Mitarbeiter löschen möchten?');
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
      if (employee !== null) {
        console.info('Edit employee:', employee);
        // TODO: Fill form with employee data
        employeesManager?.showEmployeeModal();
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

    w.showEmployeeModal = () => {
      employeesManager?.showEmployeeModal();
    };

    w.hideEmployeeModal = () => {
      employeesManager?.hideEmployeeModal();
    };

    w.saveEmployee = async () => {
      const form = document.querySelector('#employee-form') as HTMLFormElement | null;
      if (form === null) return;

      const formData = new FormData(form);
      const data: Record<string, unknown> = {};

      formData.forEach((value, key) => {
        if (typeof value === 'string' && value.length > 0) {
          // Convert to appropriate types
          if (key === 'departmentId' || key === 'teamId') {
            data[key] = Number.parseInt(value, 10);
          } else {
            data[key] = value;
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
        await employeesManager?.createEmployee(data as Partial<Employee>);
        w.hideEmployeeModal?.();
        form.reset();
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

    w.loadDepartmentsForEmployeeSelect = async () => {
      const departments = await employeesManager?.loadDepartments();
      const selectElement = document.querySelector('#employee-department-select') as HTMLSelectElement | null;

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

    w.loadTeamsForEmployeeSelect = async () => {
      const teams = await employeesManager?.loadTeams();
      const selectedDeptId = (document.querySelector('#employee-department-select') as HTMLSelectElement | null)?.value;
      const selectElement = document.querySelector('#employee-team-select') as HTMLSelectElement | null;

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

    // Add form submit handler
    const employeeForm = document.querySelector('#employee-form') as HTMLFormElement | null;
    if (employeeForm !== null) {
      employeeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        void w.saveEmployee?.();
      });
    }

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
