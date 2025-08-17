/**
 * Admin Machines Management
 * Handles machine CRUD operations for admin dashboard
 */

import { ApiClient } from '../utils/api-client';
import { mapMachines, type MachineAPIResponse } from '../utils/api-mappers';

import { showSuccessAlert, showErrorAlert } from './utils/alerts';
// Role switch will be loaded by HTML

interface Machine {
  id: number;
  name: string;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  assetNumber?: string;
  departmentId?: number;
  departmentName?: string;
  areaId?: number;
  location?: string;
  machineType?: 'production' | 'packaging' | 'quality_control' | 'logistics' | 'utility' | 'other';
  status: 'operational' | 'maintenance' | 'repair' | 'standby' | 'decommissioned';
  purchaseDate?: string;
  installationDate?: string;
  warrantyUntil?: string;
  lastMaintenance?: string;
  nextMaintenance?: string;
  operatingHours?: number;
  productionCapacity?: string;
  energyConsumption?: string;
  manualUrl?: string;
  qrCode?: string;
  notes?: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Department {
  id: number;
  name: string;
  description?: string;
}

interface Area {
  id: number;
  name: string;
  description?: string;
  type?: string;
}

// ApiResponse interface removed - not used in this file

interface WindowWithMachineHandlers extends Window {
  editMachine?: (id: number) => Promise<void>;
  viewMachineDetails?: (id: number) => Promise<void>;
  deleteMachine?: (id: number) => Promise<void>;
  showMachineModal?: () => Promise<void>; // Changed to async
  closeMachineModal?: () => void;
  saveMachine?: () => Promise<void>;
}

class MachinesManager {
  private apiClient: ApiClient;
  private machines: Machine[] = [];
  private currentFilter: 'all' | 'operational' | 'maintenance' | 'repair' = 'all';
  private searchTerm = '';

  constructor() {
    this.apiClient = ApiClient.getInstance();

    // Check feature flag for API v2
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_MACHINES ?? true;
    console.info('[MachinesManager] Using API version:', useV2 ? 'v2' : 'v1');

    this.initializeEventListeners();
    // Load machines initially
    void this.loadMachines();
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
        const value = option.dataset.value ?? '';
        const text = option.dataset.text ?? '';

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

  private initializeEventListeners() {
    // Filter buttons
    document.querySelector('#show-all-machines')?.addEventListener('click', () => {
      this.currentFilter = 'all';
      void this.loadMachines();
    });

    document.querySelector('#filter-machines-operational')?.addEventListener('click', () => {
      this.currentFilter = 'operational';
      void this.loadMachines();
    });

    document.querySelector('#filter-machines-maintenance')?.addEventListener('click', () => {
      this.currentFilter = 'maintenance';
      void this.loadMachines();
    });

    document.querySelector('#filter-machines-repair')?.addEventListener('click', () => {
      this.currentFilter = 'repair';
      void this.loadMachines();
    });

    // Search
    document.querySelector('#machine-search-btn')?.addEventListener('click', () => {
      const searchInput = document.querySelector('#machine-search');
      this.searchTerm = searchInput !== null ? searchInput.value : '';
      void this.loadMachines();
    });

    // Enter key on search
    document.querySelector('#machine-search')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const searchInput = e.target as HTMLInputElement;
        this.searchTerm = searchInput.value;
        void this.loadMachines();
      }
    });

    // Delete modal event listeners
    document.querySelector('#confirm-delete-machine')?.addEventListener('click', () => {
      const deleteInput = document.querySelector('#delete-machine-id');
      if (deleteInput !== null && deleteInput.value !== '') {
        void this.confirmDeleteMachine(Number.parseInt(deleteInput.value, 10));
      }
    });

    document.querySelector('#close-delete-modal')?.addEventListener('click', () => {
      const modal = document.querySelector('#delete-machine-modal');
      if (modal) modal.classList.remove('active');
    });

    document.querySelector('#cancel-delete-modal')?.addEventListener('click', () => {
      const modal = document.querySelector('#delete-machine-modal');
      if (modal) modal.classList.remove('active');
    });
  }

  async loadMachines(): Promise<void> {
    try {
      console.info('[MachinesManager] Loading machines...');
      const params: Record<string, string> = {};

      if (this.currentFilter !== 'all') {
        params.status = this.currentFilter;
      }

      if (this.searchTerm.length > 0) {
        params.search = this.searchTerm;
      }

      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_MACHINES ?? true;

      if (useV2) {
        const response = await this.apiClient.request<MachineAPIResponse[]>('/machines', {
          method: 'GET',
        });
        // Map API response to frontend format
        this.machines = mapMachines(response);
      } else {
        // v1 API fallback
        const response = await this.apiClient.request<Machine[]>('/machines', {
          method: 'GET',
        });
        this.machines = response;
      }
      console.info('[MachinesManager] Loaded machines:', this.machines);
      this.renderMachinesTable();
    } catch (error) {
      console.error('Error loading machines:', error);
      showErrorAlert('Fehler beim Laden der Maschinen');
      // Still show empty state on error
      this.machines = [];
      this.renderMachinesTable();
    }
  }

  private renderMachinesTable(): void {
    const tbody = document.querySelector('#machines-table-body');
    const machinesTable = document.querySelector('#machines-table');
    const machinesEmpty = document.querySelector('#machines-empty');

    console.info('[MachinesManager] Rendering table, machines count:', this.machines.length);
    console.info('[MachinesManager] Elements found:', {
      tbody: tbody !== null,
      machinesTable: machinesTable !== null,
      machinesEmpty: machinesEmpty !== null,
    });

    if (tbody === null) return;

    if (this.machines.length === 0) {
      // Hide table and show empty state
      console.info('[MachinesManager] No machines, showing empty state');
      if (machinesTable !== null) {
        machinesTable.classList.add('u-hidden');
      }
      if (machinesEmpty !== null) {
        machinesEmpty.classList.remove('u-hidden');
      }
      tbody.innerHTML = '';
      return;
    }

    // Show table and hide empty state
    console.info('[MachinesManager] Has machines, showing table');
    if (machinesTable !== null) {
      machinesTable.classList.remove('u-hidden');
    }
    if (machinesEmpty !== null) {
      machinesEmpty.classList.add('u-hidden');
    }

    tbody.innerHTML = this.machines
      .map(
        (machine) => `
      <tr>
        <td>
          <strong>${machine.name}</strong>
          ${machine.qrCode !== undefined && machine.qrCode.length > 0 ? `<i class="fas fa-qrcode ms-2" title="QR-Code verfügbar"></i>` : ''}
        </td>
        <td>${machine.model ?? '-'}</td>
        <td>${machine.manufacturer ?? '-'}</td>
        <td>${machine.departmentName ?? '-'}</td>
        <td>
          <span class="badge ${this.getStatusBadgeClass(machine.status)}">
            ${this.getStatusLabel(machine.status)}
          </span>
        </td>
        <td>${machine.operatingHours !== undefined && machine.operatingHours > 0 ? `${machine.operatingHours}h` : '-'}</td>
        <td>
          ${machine.nextMaintenance !== undefined && machine.nextMaintenance.length > 0 ? new Date(machine.nextMaintenance).toLocaleDateString('de-DE') : '-'}
          ${this.getMaintenanceWarning(machine.nextMaintenance)}
        </td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="window.editMachine(${machine.id})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-secondary" onclick="window.viewMachineDetails(${machine.id})">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="window.deleteMachine(${machine.id})">
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
      case 'operational':
        return 'badge-success';
      case 'maintenance':
        return 'badge-warning';
      case 'repair':
        return 'badge-danger';
      case 'standby':
        return 'badge-secondary';
      case 'decommissioned':
        return 'badge-dark';
      default:
        return 'badge-secondary';
    }
  }

  private getStatusLabel(status: string): string {
    switch (status) {
      case 'operational':
        return 'Betriebsbereit';
      case 'maintenance':
        return 'In Wartung';
      case 'repair':
        return 'In Reparatur';
      case 'standby':
        return 'Standby';
      case 'decommissioned':
        return 'Außer Betrieb';
      default:
        return status;
    }
  }

  private getMaintenanceWarning(nextMaintenance?: string): string {
    if (nextMaintenance === undefined) return '';

    const maintenanceDate = new Date(nextMaintenance);
    const today = new Date();
    const daysUntil = Math.floor((maintenanceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) {
      return '<i class="fas fa-exclamation-triangle text-danger ms-2" title="Wartung überfällig"></i>';
    } else if (daysUntil <= 7) {
      return '<i class="fas fa-exclamation-circle text-warning ms-2" title="Wartung bald fällig"></i>';
    }

    return '';
  }

  async createMachine(machineData: Partial<Machine>): Promise<Machine> {
    try {
      const response = await this.apiClient.request<Machine>('/machines', {
        method: 'POST',
        body: JSON.stringify(machineData),
      });

      showSuccessAlert('Maschine erfolgreich erstellt');
      await this.loadMachines();
      return response;
    } catch (error) {
      console.error('Error creating machine:', error);
      showErrorAlert('Fehler beim Erstellen der Maschine');
      throw error;
    }
  }

  async updateMachine(id: number, machineData: Partial<Machine>): Promise<Machine> {
    try {
      const response = await this.apiClient.request<Machine>(`/machines/${id}`, {
        method: 'PUT',
        body: JSON.stringify(machineData),
      });

      showSuccessAlert('Maschine erfolgreich aktualisiert');
      await this.loadMachines();
      return response;
    } catch (error) {
      console.error('Error updating machine:', error);
      showErrorAlert('Fehler beim Aktualisieren der Maschine');
      throw error;
    }
  }

  async deleteMachine(id: number): Promise<void> {
    // Show delete confirmation modal
    const modal = document.querySelector('#delete-machine-modal');
    const deleteInput = document.querySelector('#delete-machine-id');

    if (modal !== null && deleteInput !== null) {
      deleteInput.value = id.toString();
      modal.classList.add('active');
    }

    // Actual deletion is handled by confirmDeleteMachine
    await Promise.resolve();
  }

  async confirmDeleteMachine(id: number): Promise<void> {
    try {
      await this.apiClient.request(`/machines/${id}`, {
        method: 'DELETE',
      });

      showSuccessAlert('Maschine erfolgreich gelöscht');

      // Close the modal
      const modal = document.querySelector('#delete-machine-modal');
      if (modal !== null) {
        modal.classList.remove('active');
      }

      // Reload machines
      await this.loadMachines();
    } catch (error) {
      console.error('Error deleting machine:', error);
      const errorObj = error as { message?: string; code?: string };

      if (
        errorObj.code === 'FOREIGN_KEY_CONSTRAINT' ||
        errorObj.message?.includes('foreign key') === true ||
        errorObj.message?.includes('Cannot delete machine') === true
      ) {
        showErrorAlert('Maschine kann nicht gelöscht werden, da noch Zuordnungen existieren');
      } else {
        showErrorAlert('Fehler beim Löschen der Maschine');
      }
    }
  }

  async getMachineDetails(id: number): Promise<Machine | null> {
    try {
      return await this.apiClient.request<Machine>(`/machines/${id}`, {
        method: 'GET',
      });
    } catch (error) {
      console.error('Error getting machine details:', error);
      showErrorAlert('Fehler beim Laden der Maschinendetails');
      return null;
    }
  }

  async loadDepartmentsForMachineSelect(): Promise<void> {
    try {
      const response = await this.apiClient.request<Department[]>('/departments', {
        method: 'GET',
      });

      const departments = response;
      const dropdownOptions = document.querySelector('#machine-department-dropdown');

      if (dropdownOptions === null) {
        console.error('[MachinesManager] Machine department dropdown not found');
        return;
      }

      // Clear existing options
      dropdownOptions.innerHTML = '';

      // Add placeholder option
      const defaultOption = document.createElement('div');
      defaultOption.className = 'dropdown-option';
      defaultOption.dataset.value = '';
      defaultOption.dataset.text = 'Keine Abteilung';
      defaultOption.textContent = 'Keine Abteilung';
      dropdownOptions.append(defaultOption);

      // Add department options
      departments.forEach((dept: Department) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'dropdown-option';
        optionDiv.dataset.value = dept.id.toString();
        optionDiv.dataset.text = dept.name;
        optionDiv.textContent = dept.name;
        dropdownOptions.append(optionDiv);
      });

      // Setup event delegation
      this.setupDropdownEventDelegation('machine-department-dropdown', 'machine-department');

      console.info('[MachinesManager] Loaded departments:', departments.length);
    } catch (error) {
      console.error('Error loading departments for machine select:', error);
      showErrorAlert('Fehler beim Laden der Abteilungen');
    }
  }

  async loadAreasForMachineSelect(): Promise<void> {
    try {
      const response = await this.apiClient.request<Area[]>('/areas', {
        method: 'GET',
      });

      const areas = response;
      const dropdownOptions = document.querySelector('#machine-area-dropdown');

      if (dropdownOptions === null) {
        console.error('[MachinesManager] Machine area dropdown not found');
        return;
      }

      // Clear existing options
      dropdownOptions.innerHTML = '';

      // Add placeholder option
      const defaultOption = document.createElement('div');
      defaultOption.className = 'dropdown-option';
      defaultOption.dataset.value = '';
      defaultOption.dataset.text = 'Kein Bereich';
      defaultOption.textContent = 'Kein Bereich';
      dropdownOptions.append(defaultOption);

      // Add area options
      areas.forEach((area: Area) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'dropdown-option';
        optionDiv.dataset.value = area.id.toString();
        optionDiv.dataset.text = area.name;
        optionDiv.textContent = area.name;
        dropdownOptions.append(optionDiv);
      });

      // Setup event delegation
      this.setupDropdownEventDelegation('machine-area-dropdown', 'machine-area');

      console.info('[MachinesManager] Loaded areas:', areas.length);
    } catch (error) {
      console.error('Error loading areas for machine select:', error);
      showErrorAlert('Fehler beim Laden der Bereiche');
    }
  }
}

// Initialize when DOM is ready
let machinesManager: MachinesManager | null = null;

document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if we're on the manage-machines page
  if (window.location.pathname === '/manage-machines' || window.location.pathname.includes('manage-machines')) {
    machinesManager = new MachinesManager();

    // Export loadMachinesTable function to window for show-section.ts
    (window as WindowWithMachineHandlers & { loadMachinesTable?: () => void }).loadMachinesTable = () => {
      console.info('[MachinesManager] loadMachinesTable called');
      void machinesManager?.loadMachines();
    };

    // Expose functions globally for HTML onclick handlers
    const w = window as unknown as WindowWithMachineHandlers;
    w.editMachine = async (id: number) => {
      const machine = await machinesManager?.getMachineDetails(id);
      if (machine !== null) {
        // TODO: Open edit modal with machine data
        console.info('Edit machine:', machine);
        showErrorAlert('Bearbeitungsmodal noch nicht implementiert');
      }
    };

    w.viewMachineDetails = async (id: number) => {
      const machine = await machinesManager?.getMachineDetails(id);
      if (machine !== null) {
        // TODO: Open details modal
        console.info('View machine:', machine);
        showErrorAlert('Detailansicht noch nicht implementiert');
      }
    };

    w.deleteMachine = async (id: number) => {
      await machinesManager?.deleteMachine(id);
    };

    // Handler for floating add button
    w.showMachineModal = async () => {
      const modal = document.querySelector('#machineModal');
      if (modal !== null) {
        modal.classList.add('active');

        // Reset form
        const form = document.querySelector('#machineForm');
        if (form !== null) form.reset();

        // Load departments and areas for dropdowns
        if (machinesManager !== null) {
          await machinesManager.loadDepartmentsForMachineSelect();
          await machinesManager.loadAreasForMachineSelect();
        }
      }
    };

    // Close modal handler
    w.closeMachineModal = () => {
      const modal = document.querySelector('#machineModal');
      if (modal !== null) {
        modal.classList.remove('active');
      }
    };

    // Save machine handler
    w.saveMachine = async () => {
      const form = document.querySelector('#machineForm');
      if (form === null) return;

      const formData = new FormData(form);
      const machineData: Record<string, string | number> = {};

      // Convert FormData to object
      formData.forEach((value, key) => {
        if (typeof value === 'string' && value.length > 0) {
          machineData[key] = value;
        }
      });

      // Validate required fields
      if (typeof machineData.name !== 'string' || machineData.name.length === 0) {
        showErrorAlert('Bitte geben Sie einen Maschinennamen ein');
        return;
      }

      try {
        await machinesManager?.createMachine(machineData as Partial<Machine>);
        w.closeMachineModal?.();
        showSuccessAlert('Maschine erfolgreich hinzugefügt');
      } catch (error) {
        console.error('Error creating machine:', error);
        showErrorAlert('Fehler beim Hinzufügen der Maschine');
      }
    };

    // Function to check if machines section is visible
    const checkMachinesVisibility = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const section = urlParams.get('section');
      if (section === 'machines') {
        void machinesManager?.loadMachines();
      }
    };

    // Check on initial load
    checkMachinesVisibility();

    // Listen for URL changes
    window.addEventListener('popstate', checkMachinesVisibility);

    // Also check when section parameter changes
    const originalPushState = window.history.pushState.bind(window.history);
    window.history.pushState = function (...args) {
      originalPushState.apply(window.history, args);
      setTimeout(checkMachinesVisibility, 100);
    };

    const originalReplaceState = window.history.replaceState.bind(window.history);
    window.history.replaceState = function (...args) {
      originalReplaceState.apply(window.history, args);
      setTimeout(checkMachinesVisibility, 100);
    };
  }
});

export { MachinesManager };
