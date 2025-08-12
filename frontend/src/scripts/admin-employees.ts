/**
 * Admin Employees Management
 * Handles employee CRUD operations for admin dashboard
 */

import type { User } from '../types/api.types';
import { ApiClient } from '../utils/api-client';

import { showSuccess, showError } from './auth';

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

  constructor() {
    this.apiClient = ApiClient.getInstance();
    this.initializeEventListeners();
  }

  private initializeEventListeners() {
    // Filter buttons
    document.getElementById('show-all-employees')?.addEventListener('click', () => {
      this.currentFilter = 'all';
      void this.loadEmployees();
    });

    document.getElementById('filter-employees-active')?.addEventListener('click', () => {
      this.currentFilter = 'active';
      void this.loadEmployees();
    });

    document.getElementById('filter-employees-inactive')?.addEventListener('click', () => {
      this.currentFilter = 'inactive';
      void this.loadEmployees();
    });

    // Search
    document.getElementById('employee-search-btn')?.addEventListener('click', () => {
      const searchInput = document.getElementById('employee-search') as HTMLInputElement;
      this.searchTerm = searchInput?.value ?? '';
      void this.loadEmployees();
    });

    // Enter key on search
    document.getElementById('employee-search')?.addEventListener('keypress', (e) => {
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

  async loadEmployees() {
    try {
      const params: Record<string, string> = {};

      if (this.currentFilter !== 'all') {
        params.status = this.currentFilter;
      }

      if (this.searchTerm !== null) {
        params.search = this.searchTerm;
      }

      const response = await this.apiClient.request<Employee[]>('/users', {
        method: 'GET',
      });

      // CRITICAL SECURITY: Only show users with role='employee'
      // NEVER show admins or roots in the employees table
      // Admins cannot manage other admins or see root users
      this.employees = (response ?? []).filter((user) => user.role === 'employee');

      // Apply status filter based on is_active field
      if (this.currentFilter === 'active') {
        this.employees = this.employees.filter((emp) => emp.is_active);
      } else if (this.currentFilter === 'inactive') {
        this.employees = this.employees.filter((emp) => !emp.is_active);
      }

      if (this.searchTerm !== null) {
        const search = this.searchTerm.toLowerCase();
        this.employees = this.employees.filter(
          (emp) =>
            (emp.first_name?.toLowerCase().includes(search) ?? false) ||
            (emp.last_name?.toLowerCase().includes(search) ?? false) ||
            emp.email?.toLowerCase().includes(search) ||
            (emp.position?.toLowerCase().includes(search) ?? false) ||
            emp.employeeId?.toLowerCase().includes(search),
        );
      }

      this.renderEmployeesTable();
    } catch (error) {
      console.error('Error loading employees:', error);
      showError('Fehler beim Laden der Mitarbeiter');
    }
  }

  private renderEmployeesTable() {
    const tableBody = document.getElementById('employees-table-body');
    if (tableBody === null || tableBody === undefined) return;

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
          <strong>${String(employee.first_name ?? '')} ${String(employee.last_name ?? '')}</strong>
          ${employee.position ? `<br><small class="text-muted">${employee.position}</small>` : ''}
        </td>
        <td>${String(employee.email ?? '-')}</td>
        <td>
          <code>${String(employee.employee_id ?? employee.employeeId ?? '-')}</code>
        </td>
        <td>${String(employee.departmentName ?? '-')}</td>
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

  showEmployeeModal() {
    const modal = document.getElementById('employee-modal');
    if (modal !== null) {
      modal.style.display = 'flex';

      // Load departments and teams after showing modal
      setTimeout(() => {
        const w = window as WindowWithEmployeeHandlers;
        void w.loadDepartmentsForEmployeeSelect?.();
        void w.loadTeamsForEmployeeSelect?.();
      }, 100);
    }
  }

  hideEmployeeModal() {
    const modal = document.getElementById('employee-modal');
    if (modal !== null) {
      modal.style.display = 'none';
    }
  }

  async createEmployee(data: Partial<Employee>) {
    try {
      const response = await this.apiClient.request<Employee>('/users', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      showSuccess('Mitarbeiter erfolgreich erstellt');
      await this.loadEmployees();
      return response;
    } catch (error) {
      console.error('Error creating employee:', error);
      showError('Fehler beim Erstellen des Mitarbeiters');
      throw error;
    }
  }

  async updateEmployee(id: number, data: Partial<Employee>) {
    // SECURITY: First check if user is actually an employee
    const user = await this.getEmployeeDetails(id);
    if (user === null || user === undefined) {
      showError('Mitarbeiter nicht gefunden');
      throw new Error('User not found');
    }

    // CRITICAL: Never allow editing of admins or roots
    if (user.role !== 'employee') {
      showError('Sicherheitsfehler: Diese Aktion ist nicht erlaubt');
      console.error(`SECURITY VIOLATION: Attempted to update user with role ${user.role}`);
      throw new Error('Security violation');
    }

    try {
      const response = await this.apiClient.request<Employee>(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      showSuccess('Mitarbeiter erfolgreich aktualisiert');
      await this.loadEmployees();
      return response;
    } catch (error) {
      console.error('Error updating employee:', error);
      showError('Fehler beim Aktualisieren des Mitarbeiters');
      throw error;
    }
  }

  async deleteEmployee(id: number) {
    // SECURITY: First check if user is actually an employee
    const user = await this.getEmployeeDetails(id);
    if (user === null || user === undefined) {
      showError('Mitarbeiter nicht gefunden');
      return;
    }

    // CRITICAL: Never allow deletion of admins or roots
    if (user.role !== 'employee') {
      showError('Sicherheitsfehler: Diese Aktion ist nicht erlaubt');
      console.error(`SECURITY VIOLATION: Attempted to delete user with role ${user.role}`);
      return;
    }

    if (!confirm('Sind Sie sicher, dass Sie diesen Mitarbeiter löschen möchten?')) {
      return;
    }

    try {
      await this.apiClient.request(`/users/${id}`, {
        method: 'DELETE',
      });

      showSuccess('Mitarbeiter erfolgreich gelöscht');
      await this.loadEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      showError('Fehler beim Löschen des Mitarbeiters');
    }
  }

  async getEmployeeDetails(id: number): Promise<Employee | null> {
    try {
      const response = await this.apiClient.request<Employee>(`/users/${id}`, {
        method: 'GET',
      });
      return response ?? null;
    } catch (error) {
      console.error('Error getting employee details:', error);
      showError('Fehler beim Laden der Mitarbeiterdetails');
      return null;
    }
  }

  async loadDepartments(): Promise<Department[] | null> {
    try {
      const response = await this.apiClient.request<Department[]>('/departments', {
        method: 'GET',
      });
      return response ?? null;
    } catch (error) {
      console.error('Error loading departments:', error);
      return null;
    }
  }

  async loadTeams(): Promise<Team[] | null> {
    try {
      const response = await this.apiClient.request<Team[]>('/teams', {
        method: 'GET',
      });
      return response ?? null;
    } catch (error) {
      console.error('Error loading teams:', error);
      return null;
    }
  }
}

// Export manager instance
let employeesManager: EmployeesManager | null = null;

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if we're on the admin dashboard
  if (window.location.pathname === '/admin-dashboard') {
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
        showError('Detailansicht noch nicht implementiert');
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
      const form = document.getElementById('create-employee-form') as HTMLFormElement;
      if (form === null || form === undefined) return;

      const formData = new FormData(form);
      const data: Record<string, unknown> = {};

      formData.forEach((value, key) => {
        if (value && value !== undefined && typeof value === 'string') {
          // Convert to appropriate types
          if (key === 'departmentId' || key === 'teamId') {
            data[key] = parseInt(value, 10);
          } else {
            data[key] = value;
          }
        }
      });

      // Ensure required fields
      if (!data.email || !data.firstName || !data.lastName) {
        showError('Bitte füllen Sie alle Pflichtfelder aus');
        return;
      }

      try {
        await employeesManager?.createEmployee(data as Partial<Employee>);
        w.hideEmployeeModal?.();
        form.reset();
      } catch (error) {
        console.error('Error saving employee:', error);
      }
    };

    w.loadDepartmentsForEmployeeSelect = async () => {
      const departments = await employeesManager?.loadDepartments();
      const dropdown = document.getElementById('employee-department-dropdown');

      if (dropdown && departments) {
        dropdown.innerHTML = `
          <div class="dropdown-option" data-value="" onclick="selectDropdownOption('employee-department', '', 'Keine Abteilung')">
            <i class="fas fa-times-circle"></i> Keine Abteilung
          </div>
        `;

        departments.forEach((dept) => {
          const optionDiv = document.createElement('div');
          optionDiv.className = 'dropdown-option';
          optionDiv.setAttribute('data-value', dept.id.toString());
          optionDiv.innerHTML = `<i class="fas fa-building"></i> ${dept.name}`;
          optionDiv.setAttribute(
            'onclick',
            `selectDropdownOption('employee-department', '${dept.id}', '${dept.name.replace(/'/g, "\\'")}')`,
          );
          dropdown.appendChild(optionDiv);
        });

        console.info('[EmployeesManager] Loaded departments:', departments.length);
      }
    };

    w.loadTeamsForEmployeeSelect = async () => {
      const teams = await employeesManager?.loadTeams();
      const selectedDeptId = (document.getElementById('employee-department-select') as HTMLInputElement)?.value;
      const dropdown = document.getElementById('employee-team-dropdown');

      if (dropdown && teams) {
        // Filter teams by department if one is selected
        let filteredTeams = teams;
        if (selectedDeptId !== null && selectedDeptId !== undefined && selectedDeptId !== '0') {
          filteredTeams = teams.filter((team) => team.departmentId === parseInt(selectedDeptId, 10));
        }

        dropdown.innerHTML = `
          <div class="dropdown-option" data-value="" onclick="selectDropdownOption('employee-team', '', 'Kein Team')">
            <i class="fas fa-times-circle"></i> Kein Team
          </div>
        `;

        filteredTeams.forEach((team) => {
          const optionDiv = document.createElement('div');
          optionDiv.className = 'dropdown-option';
          optionDiv.setAttribute('data-value', team.id.toString());
          optionDiv.innerHTML = `<i class="fas fa-users"></i> ${team.name}`;
          optionDiv.setAttribute(
            'onclick',
            `selectDropdownOption('employee-team', '${team.id}', '${team.name.replace(/'/g, "\\'")}')`,
          );
          dropdown.appendChild(optionDiv);
        });

        console.info('[EmployeesManager] Loaded teams:', filteredTeams.length);
      }
    };

    // Check URL and load employees if needed
    const checkAndLoadEmployees = () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('section') === 'employees') {
        void employeesManager?.loadEmployees();
      }
    };

    // Initial check
    checkAndLoadEmployees();

    // Listen for URL changes
    window.addEventListener('popstate', checkAndLoadEmployees);

    // Override pushState and replaceState
    const originalPushState = window.history.pushState;
    window.history.pushState = function (...args) {
      originalPushState.apply(window.history, args);
      setTimeout(checkAndLoadEmployees, 100);
    };

    const originalReplaceState = window.history.replaceState;
    window.history.replaceState = function (...args) {
      originalReplaceState.apply(window.history, args);
      setTimeout(checkAndLoadEmployees, 100);
    };
  }
});

export { EmployeesManager };
