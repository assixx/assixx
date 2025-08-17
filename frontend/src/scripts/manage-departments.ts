/**
 * Admin Departments Management
 * Handles department CRUD operations for admin dashboard
 */

import { ApiClient } from '../utils/api-client';
import { mapDepartment, type DepartmentAPIResponse } from '../utils/api-mappers';

import { showSuccess, showError } from './auth';

interface Department {
  id: number;
  name: string;
  description?: string;
  managerId?: number;
  managerName?: string;
  areaId?: number;
  areaName?: string;
  parentId?: number;
  parentName?: string;
  memberCount?: number;
  teamCount?: number;
  machineCount?: number;
  budget?: number;
  costCenter?: string;
  status: 'active' | 'inactive' | 'restructuring';
  foundedDate?: string;
  notes?: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Area {
  id: number;
  name: string;
  type?: string;
}

interface User {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
}

interface WindowWithDepartmentHandlers extends Window {
  loadDepartmentsTable?: () => void;
  editDepartment?: (id: number) => Promise<void>;
  viewDepartmentDetails?: (id: number) => Promise<void>;
  deleteDepartment?: (id: number) => Promise<void>;
  showDepartmentModal?: () => void;
  closeDepartmentModal?: () => void;
  saveDepartment?: () => Promise<void>;
}

class DepartmentsManager {
  public apiClient: ApiClient;
  private departments: Department[] = [];
  private currentFilter: 'all' | 'active' | 'inactive' | 'restructuring' = 'all';
  private searchTerm = '';

  constructor() {
    this.apiClient = ApiClient.getInstance();
    this.initializeEventListeners();
  }

  /**
   * Escapes HTML to prevent XSS attacks
   * @param text - The text to escape
   * @returns Escaped HTML string
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Sets up event delegation for dropdown clicks
   * @param dropdownId - The dropdown container ID
   * @param selectId - The select input ID prefix
   */
  private setupDropdownEventDelegation(dropdownId: string, selectId: string): void {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    // Remove any existing listeners to prevent duplicates
    const newDropdown = dropdown.cloneNode(true) as HTMLElement;
    dropdown.parentNode?.replaceChild(newDropdown, dropdown);

    // Add event delegation
    newDropdown.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const option = target.closest('.dropdown-option');

      if (option !== null) {
        const value = option.getAttribute('data-value') ?? '';
        const text = option.getAttribute('data-text') ?? '';

        // Call the global selectDropdownOption function safely
        // Using window extension interface for type safety
        const windowWithSelect = window as Window & {
          selectDropdownOption?: (dropdownId: string, value: string, text: string) => void;
        };

        if (typeof windowWithSelect.selectDropdownOption === 'function') {
          windowWithSelect.selectDropdownOption(selectId, value, text);
        }
      }
    });
  }

  private async confirmAction(message: string): Promise<boolean> {
    // TODO: Implement custom confirmation modal
    // For now, show error and block action for safety
    showError(`${message} (Bestätigung erforderlich - Feature noch nicht implementiert)`);
    return Promise.resolve(false); // Block action until proper modal is implemented
  }

  private initializeEventListeners() {
    // Filter buttons
    document.querySelector('#show-all-departments')?.addEventListener('click', () => {
      this.currentFilter = 'all';
      void this.loadDepartments();
    });

    document.querySelector('#filter-departments-active')?.addEventListener('click', () => {
      this.currentFilter = 'active';
      void this.loadDepartments();
    });

    document.querySelector('#filter-departments-inactive')?.addEventListener('click', () => {
      this.currentFilter = 'inactive';
      void this.loadDepartments();
    });

    document.querySelector('#filter-departments-restructuring')?.addEventListener('click', () => {
      this.currentFilter = 'restructuring';
      void this.loadDepartments();
    });

    // Search
    document.querySelector('#department-search-btn')?.addEventListener('click', () => {
      const searchInput = document.querySelector('#department-search') as HTMLInputElement | null;
      this.searchTerm = searchInput !== null ? searchInput.value : '';
      void this.loadDepartments();
    });

    // Enter key on search
    document.querySelector('#department-search')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const searchInput = e.target as HTMLInputElement;
        this.searchTerm = searchInput.value;
        void this.loadDepartments();
      }
    });

    // Close modal buttons
    document.querySelectorAll('[data-action="close-department-modal"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.closeDepartmentModal();
      });
    });
  }

  async loadDepartments(): Promise<void> {
    try {
      const params: Record<string, string> = {};

      if (this.currentFilter !== 'all') {
        params.status = this.currentFilter;
      }

      if (this.searchTerm.length > 0) {
        params.search = this.searchTerm;
      }

      const response = await this.apiClient.request<DepartmentAPIResponse[]>('/api/v2/departments', {
        method: 'GET',
      });

      // v2 API: Map response through api-mappers for consistent field names
      this.departments = response.map(mapDepartment) as Department[];

      // Apply client-side filtering if needed
      if (this.currentFilter !== 'all') {
        this.departments = this.departments.filter((dept) => dept.status === this.currentFilter);
      }

      if (this.searchTerm.length > 0) {
        const search = this.searchTerm.toLowerCase();
        this.departments = this.departments.filter(
          (dept) =>
            dept.name.toLowerCase().includes(search) ||
            dept.description?.toLowerCase().includes(search) === true ||
            dept.managerName?.toLowerCase().includes(search) === true,
        );
      }

      this.renderDepartmentsTable();
    } catch (error) {
      console.error('Error loading departments:', error);
      showError('Fehler beim Laden der Abteilungen');
    }
  }

  private renderDepartmentsTable() {
    const tableBody = document.querySelector('#departments-table-body');
    if (!tableBody) return;

    if (this.departments.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-muted">Keine Abteilungen gefunden</td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = this.departments
      .map(
        (dept) => `
      <tr>
        <td>
          <strong>${dept.name}</strong>
          ${dept.description !== undefined ? `<br><small class="text-muted">${dept.description}</small>` : ''}
        </td>
        <td>${dept.managerName ?? '-'}</td>
        <td>${dept.areaName ?? '-'}</td>
        <td>${dept.parentName ?? '-'}</td>
        <td>
          <span class="badge ${this.getStatusBadgeClass(dept.status)}">
            ${this.getStatusLabel(dept.status)}
          </span>
        </td>
        <td>${String(dept.memberCount ?? 0)}</td>
        <td>${String(dept.teamCount ?? 0)}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="window.editDepartment(${dept.id})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-secondary" onclick="window.viewDepartmentDetails(${dept.id})">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="window.deleteDepartment(${dept.id})">
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

  showDepartmentModal(): void {
    const modal = document.querySelector('#department-modal');
    if (modal !== null) {
      modal.style.display = 'flex';

      // Load areas for dropdown
      void this.loadAreasForDepartmentSelect();

      // Load managers for dropdown
      void this.loadManagersForDepartmentSelect();

      // Load parent departments for hierarchy
      void this.loadParentDepartmentsForSelect();
    }
  }

  closeDepartmentModal(): void {
    const modal = document.querySelector('#department-modal');
    if (modal !== null) {
      modal.style.display = 'none';
    }
  }

  async createDepartment(data: Partial<Department>): Promise<Department> {
    try {
      const response = await this.apiClient.request<DepartmentAPIResponse>('/api/v2/departments', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      showSuccess('Abteilung erfolgreich erstellt');
      await this.loadDepartments();
      return mapDepartment(response) as Department;
    } catch (error) {
      console.error('Error creating department:', error);
      showError('Fehler beim Erstellen der Abteilung');
      throw error;
    }
  }

  async updateDepartment(id: number, data: Partial<Department>): Promise<Department> {
    try {
      const response = await this.apiClient.request<DepartmentAPIResponse>(`/api/v2/departments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      showSuccess('Abteilung erfolgreich aktualisiert');
      await this.loadDepartments();
      return mapDepartment(response) as Department;
    } catch (error) {
      console.error('Error updating department:', error);
      showError('Fehler beim Aktualisieren der Abteilung');
      throw error;
    }
  }

  async deleteDepartment(id: number): Promise<void> {
    // Use custom confirmation dialog or showError for better UX
    const confirmed = await this.confirmAction(
      'Sind Sie sicher, dass Sie diese Abteilung löschen möchten? Alle zugehörigen Teams und Mitarbeiter werden neu zugeordnet.',
    );

    if (!confirmed) {
      return;
    }

    try {
      await this.apiClient.request(`/api/v2/departments/${id}`, {
        method: 'DELETE',
      });

      showSuccess('Abteilung erfolgreich gelöscht');
      await this.loadDepartments();
    } catch (error) {
      console.error('Error deleting department:', error);
      showError('Fehler beim Löschen der Abteilung');
    }
  }

  async getDepartmentDetails(id: number): Promise<Department | null> {
    try {
      return await this.apiClient.request<Department>(`/departments/${id}`, {
        method: 'GET',
      });
    } catch (error) {
      console.error('Error getting department details:', error);
      showError('Fehler beim Laden der Abteilungsdetails');
      return null;
    }
  }

  async loadAreasForDepartmentSelect(): Promise<void> {
    try {
      const response = await this.apiClient.request<Area[]>('/areas', {
        method: 'GET',
      });

      const dropdown = document.querySelector('#department-area-dropdown');
      if (dropdown !== null) {
        dropdown.innerHTML = '';

        // Add default option
        const defaultOption = document.createElement('div');
        defaultOption.className = 'dropdown-option';
        defaultOption.setAttribute('data-value', '');
        defaultOption.setAttribute('data-text', 'Kein Bereich');
        defaultOption.innerHTML = `<i class="fas fa-times-circle"></i> ${this.escapeHtml('Kein Bereich')}`;
        dropdown.append(defaultOption);

        // Add area options
        response.forEach((area) => {
          const optionDiv = document.createElement('div');
          optionDiv.className = 'dropdown-option';
          optionDiv.setAttribute('data-value', area.id.toString());
          optionDiv.setAttribute('data-text', area.name);
          optionDiv.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${this.escapeHtml(area.name)}`;
          dropdown.append(optionDiv);
        });

        // Setup event delegation
        this.setupDropdownEventDelegation('department-area-dropdown', 'department-area');

        console.info('[DepartmentsManager] Loaded areas:', response.length);
      }
    } catch (error) {
      console.error('Error loading areas:', error);
    }
  }

  async loadManagersForDepartmentSelect(): Promise<void> {
    try {
      const response = await this.apiClient.request<User[]>('/users', {
        method: 'GET',
      });

      // Filter for users who can be managers (admins or managers)
      const managers = response.filter((user) => user.role === 'admin' || user.role === 'manager');

      const dropdown = document.querySelector('#department-manager-dropdown');
      if (dropdown !== null) {
        dropdown.innerHTML = '';

        // Add default option
        const defaultOption = document.createElement('div');
        defaultOption.className = 'dropdown-option';
        defaultOption.setAttribute('data-value', '');
        defaultOption.setAttribute('data-text', 'Kein Manager');
        defaultOption.innerHTML = `<i class="fas fa-times-circle"></i> ${this.escapeHtml('Kein Manager')}`;
        dropdown.append(defaultOption);

        // Add manager options
        managers.forEach((manager) => {
          const optionDiv = document.createElement('div');
          optionDiv.className = 'dropdown-option';
          optionDiv.setAttribute('data-value', manager.id.toString());
          const name =
            manager.firstName !== undefined && manager.lastName !== undefined
              ? `${manager.firstName} ${manager.lastName}`
              : manager.username;
          optionDiv.setAttribute('data-text', name);
          optionDiv.innerHTML = `<i class="fas fa-user-tie"></i> ${this.escapeHtml(name)}`;
          dropdown.append(optionDiv);
        });

        // Setup event delegation
        this.setupDropdownEventDelegation('department-manager-dropdown', 'department-manager');

        console.info('[DepartmentsManager] Loaded managers:', managers.length);
      }
    } catch (error) {
      console.error('Error loading managers:', error);
    }
  }

  async loadParentDepartmentsForSelect(): Promise<void> {
    try {
      const response = await this.apiClient.request<DepartmentAPIResponse[]>('/api/v2/departments', {
        method: 'GET',
      });

      const dropdown = document.querySelector('#department-parent-dropdown');
      if (dropdown !== null) {
        dropdown.innerHTML = '';

        // Add default option
        const defaultOption = document.createElement('div');
        defaultOption.className = 'dropdown-option';
        defaultOption.setAttribute('data-value', '');
        defaultOption.setAttribute('data-text', 'Keine übergeordnete Abteilung');
        defaultOption.innerHTML = `<i class="fas fa-times-circle"></i> ${this.escapeHtml('Keine übergeordnete Abteilung')}`;
        dropdown.append(defaultOption);

        // Add department options
        response.map(mapDepartment).forEach((dept) => {
          const optionDiv = document.createElement('div');
          optionDiv.className = 'dropdown-option';
          optionDiv.setAttribute('data-value', dept.id.toString());
          optionDiv.setAttribute('data-text', dept.name);
          optionDiv.innerHTML = `<i class="fas fa-sitemap"></i> ${this.escapeHtml(dept.name)}`;
          dropdown.append(optionDiv);
        });

        // Setup event delegation
        this.setupDropdownEventDelegation('department-parent-dropdown', 'department-parent');

        console.info('[DepartmentsManager] Loaded parent departments:', response.length);
      }
    } catch (error) {
      console.error('Error loading parent departments:', error);
    }
  }
}

// Export manager instance
let departmentsManager: DepartmentsManager | null = null;

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if we're on the admin dashboard
  if (window.location.pathname === '/admin-dashboard') {
    departmentsManager = new DepartmentsManager();

    // Setup global window functions
    const w = window as WindowWithDepartmentHandlers;

    w.loadDepartmentsTable = () => {
      console.info('[DepartmentsManager] loadDepartmentsTable called');
      void departmentsManager?.loadDepartments();
    };

    w.editDepartment = async (id: number) => {
      const department = await departmentsManager?.getDepartmentDetails(id);
      if (department !== null) {
        console.info('Edit department:', department);
        // TODO: Fill form with department data
        departmentsManager?.showDepartmentModal();
      }
    };

    w.viewDepartmentDetails = async (id: number) => {
      const department = await departmentsManager?.getDepartmentDetails(id);
      if (department !== null) {
        console.info('View department:', department);
        // TODO: Show department details modal
        showError('Detailansicht noch nicht implementiert');
      }
    };

    w.deleteDepartment = async (id: number) => {
      await departmentsManager?.deleteDepartment(id);
    };

    w.showDepartmentModal = () => {
      departmentsManager?.showDepartmentModal();
    };

    w.closeDepartmentModal = () => {
      departmentsManager?.closeDepartmentModal();
    };

    w.saveDepartment = async () => {
      const form = document.querySelector('#department-form') as HTMLFormElement | null;
      if (form === null) return;

      const formData = new FormData(form);
      const data: Record<string, unknown> = {};

      formData.forEach((value, key) => {
        if (typeof value === 'string' && value.length > 0) {
          // Convert to appropriate types
          if (key === 'areaId' || key === 'managerId' || key === 'parentId') {
            data[key] = Number.parseInt(value, 10);
          } else {
            data[key] = value;
          }
        }
      });

      // Ensure required fields
      if (typeof data.name !== 'string' || data.name.length === 0) {
        showError('Bitte geben Sie einen Abteilungsnamen ein');
        return;
      }

      try {
        await departmentsManager?.createDepartment(data as Partial<Department>);
        w.closeDepartmentModal?.();
        form.reset();
        showSuccess('Abteilung erfolgreich erstellt');
      } catch (error) {
        console.error('Error saving department:', error);
      }
    };

    // Check URL and load departments if needed
    const checkAndLoadDepartments = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const currentPath = window.location.pathname;

      // Load departments if on admin dashboard departments section OR on manage-departments page
      if (urlParams.get('section') === 'departments' || currentPath.includes('manage-departments')) {
        void departmentsManager?.loadDepartments();
      }
    };

    // Initial check
    checkAndLoadDepartments();

    // Listen for URL changes
    window.addEventListener('popstate', checkAndLoadDepartments);

    // Override pushState and replaceState
    const originalPushState = window.history.pushState.bind(window.history);
    window.history.pushState = function (...args) {
      originalPushState.apply(window.history, args);
      setTimeout(checkAndLoadDepartments, 100);
    };

    const originalReplaceState = window.history.replaceState.bind(window.history);
    window.history.replaceState = function (...args) {
      originalReplaceState.apply(window.history, args);
      setTimeout(checkAndLoadDepartments, 100);
    };
  }
});

export { DepartmentsManager };
