/**
 * Admin Machines Management
 * Handles machine CRUD operations for admin dashboard
 */

import { ApiClient } from '../utils/api-client';

import { showSuccess, showError } from './auth';

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
    this.initializeEventListeners();
    // Load machines initially
    void this.loadMachines();
  }

  private initializeEventListeners() {
    // Filter buttons
    document.getElementById('show-all-machines')?.addEventListener('click', () => {
      this.currentFilter = 'all';
      void this.loadMachines();
    });

    document.getElementById('filter-machines-operational')?.addEventListener('click', () => {
      this.currentFilter = 'operational';
      void this.loadMachines();
    });

    document.getElementById('filter-machines-maintenance')?.addEventListener('click', () => {
      this.currentFilter = 'maintenance';
      void this.loadMachines();
    });

    document.getElementById('filter-machines-repair')?.addEventListener('click', () => {
      this.currentFilter = 'repair';
      void this.loadMachines();
    });

    // Search
    document.getElementById('machine-search-btn')?.addEventListener('click', () => {
      const searchInput = document.getElementById('machine-search') as HTMLInputElement | null;
      this.searchTerm = searchInput !== null ? searchInput.value : '';
      void this.loadMachines();
    });

    // Enter key on search
    document.getElementById('machine-search')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const searchInput = e.target as HTMLInputElement;
        this.searchTerm = searchInput.value;
        void this.loadMachines();
      }
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

      const response = await this.apiClient.request<Machine[]>('/machines', {
        method: 'GET',
      });

      // v2 API: apiClient.request already extracts the data array
      this.machines = response;
      console.info('[MachinesManager] Loaded machines:', this.machines);
      this.renderMachinesTable();
    } catch (error) {
      console.error('Error loading machines:', error);
      showError('Fehler beim Laden der Maschinen');
      // Still show empty state on error
      this.machines = [];
      this.renderMachinesTable();
    }
  }

  private renderMachinesTable(): void {
    const tbody = document.getElementById('machines-table-body');
    const machinesTable = document.getElementById('machines-table');
    const machinesEmpty = document.getElementById('machines-empty');

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

      showSuccess('Maschine erfolgreich erstellt');
      await this.loadMachines();
      return response;
    } catch (error) {
      console.error('Error creating machine:', error);
      showError('Fehler beim Erstellen der Maschine');
      throw error;
    }
  }

  async updateMachine(id: number, machineData: Partial<Machine>): Promise<Machine> {
    try {
      const response = await this.apiClient.request<Machine>(`/machines/${id}`, {
        method: 'PUT',
        body: JSON.stringify(machineData),
      });

      showSuccess('Maschine erfolgreich aktualisiert');
      await this.loadMachines();
      return response;
    } catch (error) {
      console.error('Error updating machine:', error);
      showError('Fehler beim Aktualisieren der Maschine');
      throw error;
    }
  }

  async deleteMachine(_id: number): Promise<void> {
    // TODO: Implement proper modal confirmation dialog
    showError('Löschbestätigung: Feature noch nicht implementiert - Maschine kann nicht gelöscht werden');

    // Code below will be activated once confirmation modal is implemented
    /*
    try {
      await this.apiClient.request(`/machines/${_id}`, {
        method: 'DELETE',
      });

      showSuccess('Maschine erfolgreich gelöscht');
      await this.loadMachines();
    } catch (error) {
      console.error('Error deleting machine:', error);
      showError('Fehler beim Löschen der Maschine');
    }
    */

    // Temporary await to satisfy async requirement
    await Promise.resolve();
  }

  async getMachineDetails(id: number): Promise<Machine | null> {
    try {
      const response = await this.apiClient.request<Machine>(`/machines/${id}`, {
        method: 'GET',
      });

      return response;
    } catch (error) {
      console.error('Error getting machine details:', error);
      showError('Fehler beim Laden der Maschinendetails');
      return null;
    }
  }

  async loadDepartmentsForMachineSelect(): Promise<void> {
    try {
      const response = await this.apiClient.request<Department[]>('/departments', {
        method: 'GET',
      });

      const departments = response;
      const dropdownOptions = document.getElementById('machine-department-dropdown');

      if (dropdownOptions === null) {
        console.error('[MachinesManager] Machine department dropdown not found');
        return;
      }

      // Clear existing options and add placeholder
      dropdownOptions.innerHTML = `
        <div class="dropdown-option" data-value="" onclick="selectDropdownOption('machine-department', '', 'Keine Abteilung')">
          Keine Abteilung
        </div>
      `;

      // Add department options
      departments.forEach((dept: Department) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'dropdown-option';
        optionDiv.setAttribute('data-value', dept.id.toString());
        optionDiv.textContent = dept.name;
        optionDiv.setAttribute(
          'onclick',
          `selectDropdownOption('machine-department', '${dept.id}', '${dept.name.replace(/'/g, "\\'")}')`,
        );
        dropdownOptions.appendChild(optionDiv);
      });

      console.info('[MachinesManager] Loaded departments:', departments.length);
    } catch (error) {
      console.error('Error loading departments for machine select:', error);
      showError('Fehler beim Laden der Abteilungen');
    }
  }

  async loadAreasForMachineSelect(): Promise<void> {
    try {
      const response = await this.apiClient.request<Area[]>('/areas', {
        method: 'GET',
      });

      const areas = response;
      const dropdownOptions = document.getElementById('machine-area-dropdown');

      if (dropdownOptions === null) {
        console.error('[MachinesManager] Machine area dropdown not found');
        return;
      }

      // Clear existing options and add placeholder
      dropdownOptions.innerHTML = `
        <div class="dropdown-option" data-value="" onclick="selectDropdownOption('machine-area', '', 'Kein Bereich')">
          Kein Bereich
        </div>
      `;

      // Add area options
      areas.forEach((area: Area) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'dropdown-option';
        optionDiv.setAttribute('data-value', area.id.toString());
        optionDiv.textContent = area.name;
        optionDiv.setAttribute(
          'onclick',
          `selectDropdownOption('machine-area', '${area.id}', '${area.name.replace(/'/g, "\\'")}')`,
        );
        dropdownOptions.appendChild(optionDiv);
      });

      console.info('[MachinesManager] Loaded areas:', areas.length);
    } catch (error) {
      console.error('Error loading areas for machine select:', error);
      showError('Fehler beim Laden der Bereiche');
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
        showError('Bearbeitungsmodal noch nicht implementiert');
      }
    };

    w.viewMachineDetails = async (id: number) => {
      const machine = await machinesManager?.getMachineDetails(id);
      if (machine !== null) {
        // TODO: Open details modal
        console.info('View machine:', machine);
        showError('Detailansicht noch nicht implementiert');
      }
    };

    w.deleteMachine = async (id: number) => {
      await machinesManager?.deleteMachine(id);
    };

    // Handler for floating add button
    w.showMachineModal = async () => {
      const modal = document.getElementById('machineModal');
      if (modal !== null) {
        modal.classList.add('active');

        // Reset form
        const form = document.getElementById('machineForm') as HTMLFormElement | null;
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
      const modal = document.getElementById('machineModal');
      if (modal !== null) {
        modal.classList.remove('active');
      }
    };

    // Save machine handler
    w.saveMachine = async () => {
      const form = document.getElementById('machineForm') as HTMLFormElement | null;
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
        showError('Bitte geben Sie einen Maschinennamen ein');
        return;
      }

      try {
        await machinesManager?.createMachine(machineData as Partial<Machine>);
        w.closeMachineModal?.();
        showSuccess('Maschine erfolgreich hinzugefügt');
      } catch (error) {
        console.error('Error creating machine:', error);
        showError('Fehler beim Hinzufügen der Maschine');
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
