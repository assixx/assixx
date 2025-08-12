/**
 * Admin Departments Management
 * Handles department CRUD operations for admin dashboard
 */

import { ApiClient } from '../utils/api-client';

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

  private async confirmAction(message: string): Promise<boolean> {
    // Use a promise-based approach for confirmation
    return new Promise((resolve) => {
      // For now, use native confirm but wrapped in Promise
      // In production, replace with a custom modal

      resolve(confirm(message));
    });
  }

  private initializeEventListeners() {
    // Filter buttons
    document.getElementById('show-all-departments')?.addEventListener('click', () => {
      this.currentFilter = 'all';
      void this.loadDepartments();
    });

    document.getElementById('filter-departments-active')?.addEventListener('click', () => {
      this.currentFilter = 'active';
      void this.loadDepartments();
    });

    document.getElementById('filter-departments-inactive')?.addEventListener('click', () => {
      this.currentFilter = 'inactive';
      void this.loadDepartments();
    });

    document.getElementById('filter-departments-restructuring')?.addEventListener('click', () => {
      this.currentFilter = 'restructuring';
      void this.loadDepartments();
    });

    // Search
    document.getElementById('department-search-btn')?.addEventListener('click', () => {
      const searchInput = document.getElementById('department-search') as HTMLInputElement;
      this.searchTerm = searchInput?.value ?? '';
      void this.loadDepartments();
    });

    // Enter key on search
    document.getElementById('department-search')?.addEventListener('keypress', (e) => {
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

  async loadDepartments() {
    try {
      const params: Record<string, string> = {};

      if (this.currentFilter !== 'all') {
        params.status = this.currentFilter;
      }

      if (this.searchTerm !== null) {
        params.search = this.searchTerm;
      }

      const response = await this.apiClient.request<Department[]>('/departments', {
        method: 'GET',
      });

      // v2 API: apiClient.request already extracts the data array
      this.departments = response ?? [];

      // Apply client-side filtering if needed
      if (this.currentFilter !== 'all') {
        this.departments = this.departments.filter((dept) => dept.status === this.currentFilter);
      }

      if (this.searchTerm !== null) {
        const search = this.searchTerm.toLowerCase();
        this.departments = this.departments.filter(
          (dept) =>
            dept.name.toLowerCase().includes(search) ||
            (dept.description?.toLowerCase().includes(search) ?? false) ||
            dept.managerName?.toLowerCase().includes(search),
        );
      }

      this.renderDepartmentsTable();
    } catch (error) {
      console.error('Error loading departments:', error);
      showError('Fehler beim Laden der Abteilungen');
    }
  }

  private renderDepartmentsTable() {
    const tableBody = document.getElementById('departments-table-body');
    if (tableBody === null || tableBody === undefined) return;

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
          ${dept.description ? `<br><small class="text-muted">${dept.description}</small>` : ''}
        </td>
        <td>${String(dept.managerName ?? '-')}</td>
        <td>${String(dept.areaName ?? '-')}</td>
        <td>${String(dept.parentName ?? '-')}</td>
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

  showDepartmentModal() {
    const modal = document.getElementById('department-modal');
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

  closeDepartmentModal() {
    const modal = document.getElementById('department-modal');
    if (modal !== null) {
      modal.style.display = 'none';
    }
  }

  async createDepartment(data: Partial<Department>) {
    try {
      const response = await this.apiClient.request<Department>('/departments', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      showSuccess('Abteilung erfolgreich erstellt');
      await this.loadDepartments();
      return response;
    } catch (error) {
      console.error('Error creating department:', error);
      showError('Fehler beim Erstellen der Abteilung');
      throw error;
    }
  }

  async updateDepartment(id: number, data: Partial<Department>) {
    try {
      const response = await this.apiClient.request<Department>(`/departments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      showSuccess('Abteilung erfolgreich aktualisiert');
      await this.loadDepartments();
      return response;
    } catch (error) {
      console.error('Error updating department:', error);
      showError('Fehler beim Aktualisieren der Abteilung');
      throw error;
    }
  }

  async deleteDepartment(id: number) {
    // Use custom confirmation dialog or showError for better UX
    const confirmed = await this.confirmAction(
      'Sind Sie sicher, dass Sie diese Abteilung löschen möchten? Alle zugehörigen Teams und Mitarbeiter werden neu zugeordnet.',
    );

    if (confirmed === null || confirmed === undefined) {
      return;
    }

    try {
      await this.apiClient.request(`/departments/${id}`, {
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
      const response = await this.apiClient.request<Department>(`/departments/${id}`, {
        method: 'GET',
      });
      return response ?? null;
    } catch (error) {
      console.error('Error getting department details:', error);
      showError('Fehler beim Laden der Abteilungsdetails');
      return null;
    }
  }

  async loadAreasForDepartmentSelect() {
    try {
      const response = await this.apiClient.request<Area[]>('/areas', {
        method: 'GET',
      });

      const dropdown = document.getElementById('department-area-dropdown');
      if (dropdown && response) {
        dropdown.innerHTML = `
          <div class="dropdown-option" data-value="" onclick="selectDropdownOption('department-area', '', 'Kein Bereich')">
            <i class="fas fa-times-circle"></i> Kein Bereich
          </div>
        `;

        response.forEach((area) => {
          const optionDiv = document.createElement('div');
          optionDiv.className = 'dropdown-option';
          optionDiv.setAttribute('data-value', area.id.toString());
          optionDiv.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${area.name}`;
          optionDiv.setAttribute(
            'onclick',
            `selectDropdownOption('department-area', '${area.id}', '${area.name.replace(/'/g, "\\'")}')`,
          );
          dropdown.appendChild(optionDiv);
        });

        console.info('[DepartmentsManager] Loaded areas:', response.length);
      }
    } catch (error) {
      console.error('Error loading areas:', error);
    }
  }

  async loadManagersForDepartmentSelect() {
    try {
      const response = await this.apiClient.request<User[]>('/users', {
        method: 'GET',
      });

      // Filter for users who can be managers (admins or managers)
      const managers = response?.filter((user) => user.role === 'admin' || user.role === 'manager') ?? [];

      const dropdown = document.getElementById('department-manager-dropdown');
      if (dropdown && managers) {
        dropdown.innerHTML = `
          <div class="dropdown-option" data-value="" onclick="selectDropdownOption('department-manager', '', 'Kein Manager')">
            <i class="fas fa-times-circle"></i> Kein Manager
          </div>
        `;

        managers.forEach((manager) => {
          const optionDiv = document.createElement('div');
          optionDiv.className = 'dropdown-option';
          optionDiv.setAttribute('data-value', manager.id.toString());
          const name =
            manager.firstName && manager.lastName ? `${manager.firstName} ${manager.lastName}` : manager.username;
          optionDiv.innerHTML = `<i class="fas fa-user-tie"></i> ${name}`;
          optionDiv.setAttribute(
            'onclick',
            `selectDropdownOption('department-manager', '${manager.id}', '${name.replace(/'/g, "\\'")}')`,
          );
          dropdown.appendChild(optionDiv);
        });

        console.info('[DepartmentsManager] Loaded managers:', managers.length);
      }
    } catch (error) {
      console.error('Error loading managers:', error);
    }
  }

  async loadParentDepartmentsForSelect() {
    try {
      const response = await this.apiClient.request<Department[]>('/departments', {
        method: 'GET',
      });

      const dropdown = document.getElementById('department-parent-dropdown');
      if (dropdown && response) {
        dropdown.innerHTML = `
          <div class="dropdown-option" data-value="" onclick="selectDropdownOption('department-parent', '', 'Keine übergeordnete Abteilung')">
            <i class="fas fa-times-circle"></i> Keine übergeordnete Abteilung
          </div>
        `;

        response.forEach((dept) => {
          const optionDiv = document.createElement('div');
          optionDiv.className = 'dropdown-option';
          optionDiv.setAttribute('data-value', dept.id.toString());
          optionDiv.innerHTML = `<i class="fas fa-sitemap"></i> ${dept.name}`;
          optionDiv.setAttribute(
            'onclick',
            `selectDropdownOption('department-parent', '${dept.id}', '${dept.name.replace(/'/g, "\\'")}')`,
          );
          dropdown.appendChild(optionDiv);
        });

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
      const form = document.getElementById('department-form') as HTMLFormElement;
      if (form === null || form === undefined) return;

      const formData = new FormData(form);
      const data: Record<string, unknown> = {};

      formData.forEach((value, key) => {
        if (value && value !== undefined && typeof value === 'string') {
          // Convert to appropriate types
          if (key === 'areaId' || key === 'managerId' || key === 'parentId') {
            data[key] = parseInt(value, 10);
          } else {
            data[key] = value;
          }
        }
      });

      // Ensure required fields
      if (data.name === null || data.name === undefined) {
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
      if (urlParams.get('section') === 'departments') {
        void departmentsManager?.loadDepartments();
      }
    };

    // Initial check
    checkAndLoadDepartments();

    // Listen for URL changes
    window.addEventListener('popstate', checkAndLoadDepartments);

    // Override pushState and replaceState
    const originalPushState = window.history.pushState;
    window.history.pushState = function (...args) {
      originalPushState.apply(window.history, args);
      setTimeout(checkAndLoadDepartments, 100);
    };

    const originalReplaceState = window.history.replaceState;
    window.history.replaceState = function (...args) {
      originalReplaceState.apply(window.history, args);
      setTimeout(checkAndLoadDepartments, 100);
    };
  }
});

export { DepartmentsManager };
