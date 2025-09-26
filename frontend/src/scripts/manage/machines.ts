/* eslint-disable max-lines */
/**
 * Admin Machines Management
 * Handles machine CRUD operations for admin dashboard
 */

import { ApiClient } from '../../utils/api-client';
import { mapMachines, type MachineAPIResponse } from '../../utils/api-mappers';
import { showSuccessAlert, showErrorAlert } from '../utils/alerts';
import { escapeHtml } from '../../utils/dom-utils';
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

    // Using API v2
    console.info('[MachinesManager] Using API version: v2');

    this.initializeEventListeners();
    // Load machines initially
    void this.loadMachines();
  }

  // setupDropdownEventDelegation removed - using native select elements instead of custom dropdowns

  private setupModalListeners() {
    // Add Machine Button (Floating Button)
    document.querySelector('#add-machine-btn')?.addEventListener('click', () => {
      void this.showMachineModal();
    });

    // Modal close buttons
    document.querySelector('#close-machine-modal')?.addEventListener('click', () => {
      this.closeMachineModal();
    });

    document.querySelector('#cancel-machine-modal')?.addEventListener('click', () => {
      this.closeMachineModal();
    });

    // Machine form submission
    document.querySelector('#machine-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.saveMachine();
    });
  }

  private setupFilterListeners() {
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
  }

  private setupSearchListeners() {
    // Search button
    document.querySelector('#machine-search-btn')?.addEventListener('click', () => {
      const searchInput = document.querySelector<HTMLInputElement>('#machine-search');
      this.searchTerm = searchInput?.value ?? '';
      void this.loadMachines();
    });

    // Enter key on search
    const searchInputElement = document.querySelector<HTMLInputElement>('#machine-search');
    searchInputElement?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.searchTerm = searchInputElement.value;
        void this.loadMachines();
      }
    });
  }

  private setupDeleteModalListeners() {
    // Delete modal event listeners
    document.querySelector('#confirm-delete-machine')?.addEventListener('click', () => {
      const deleteInput = document.querySelector<HTMLInputElement>('#delete-machine-id');
      if (deleteInput?.value !== undefined && deleteInput.value !== '') {
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

  private setupMachineActionDelegation() {
    // Helper to handle machine action
    const handleMachineAction = (
      button: HTMLElement | null,
      handler: ((id: number) => Promise<void>) | undefined,
    ): void => {
      if (!button || !handler) return;
      const machineId = button.dataset.machineId;
      if (machineId !== undefined) {
        void handler(Number.parseInt(machineId, 10));
      }
    };

    // Event delegation for machine actions
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const w = window as WindowWithMachineHandlers;

      handleMachineAction(target.closest<HTMLElement>('[data-action="edit-machine"]'), w.editMachine);
      handleMachineAction(target.closest<HTMLElement>('[data-action="view-machine-details"]'), w.viewMachineDetails);
      handleMachineAction(target.closest<HTMLElement>('[data-action="delete-machine"]'), w.deleteMachine);
    });
  }

  private initializeEventListeners() {
    this.setupModalListeners();
    this.setupFilterListeners();
    this.setupSearchListeners();
    this.setupDeleteModalListeners();
    this.setupMachineActionDelegation();
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

      // Using v2 API
      const response = await this.apiClient.request<MachineAPIResponse[]>('/machines', {
        method: 'GET',
      });
      // Map API response to frontend format
      this.machines = mapMachines(response);
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

  private generateMachineRow(machine: Machine): string {
    return `
      <tr>
        <td>
          <strong>${escapeHtml(machine.name)}</strong>
          ${machine.qrCode !== undefined && machine.qrCode !== '' ? `<i class="fas fa-qrcode ms-2" title="QR-Code verfügbar"></i>` : ''}
        </td>
        <td>${escapeHtml(machine.model ?? '-')}</td>
        <td>${escapeHtml(machine.manufacturer ?? '-')}</td>
        <td>${escapeHtml(machine.departmentName ?? '-')}</td>
        <td>
          <span class="badge ${this.getStatusBadgeClass(machine.status)}">
            ${escapeHtml(this.getStatusLabel(machine.status))}
          </span>
        </td>
        <td>${machine.operatingHours !== undefined && machine.operatingHours > 0 ? escapeHtml(`${machine.operatingHours}h`) : '-'}</td>
        <td>
          ${machine.nextMaintenance !== undefined && machine.nextMaintenance.length > 0 ? escapeHtml(new Date(machine.nextMaintenance).toLocaleDateString('de-DE')) : '-'}
          ${this.getMaintenanceWarning(machine.nextMaintenance)}
        </td>
        <td>
          <button class="btn btn-sm btn-secondary" data-action="edit-machine" data-machine-id="${machine.id}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-secondary" data-action="view-machine-details" data-machine-id="${machine.id}">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn btn-sm btn-danger" data-action="delete-machine" data-machine-id="${machine.id}">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
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

    // eslint-disable-next-line no-unsanitized/property -- All user data is escaped with escapeHtml()
    tbody.innerHTML = this.machines.map((machine) => this.generateMachineRow(machine)).join('');
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
    const deleteInput = document.querySelector<HTMLInputElement>('#delete-machine-id');

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

  async showMachineModal(): Promise<void> {
    const modal = document.querySelector('#machine-modal');
    if (modal !== null) {
      modal.classList.add('active');

      // Reset form
      const form = document.querySelector<HTMLFormElement>('#machine-form');
      if (form !== null) form.reset();

      // Reset modal title to "Neue Maschine"
      const modalTitle = document.querySelector('#machine-modal-title');
      if (modalTitle !== null) {
        modalTitle.textContent = 'Neue Maschine';
      }

      // Load departments and areas for selects (using regular select elements)
      await this.loadDepartmentsForMachineSelect();
      await this.loadAreasForMachineSelect();
    }
  }

  closeMachineModal(): void {
    const modal = document.querySelector('#machine-modal');
    if (modal !== null) {
      modal.classList.remove('active');
    }
  }

  async saveMachine(): Promise<void> {
    const form = document.querySelector<HTMLFormElement>('#machine-form');
    if (form === null) return;

    const formData = new FormData(form);
    const machineData: Record<string, string | number> = {};

    // Convert FormData to object
    formData.forEach((value, key) => {
      if (typeof value === 'string' && value.length > 0) {
        // eslint-disable-next-line security/detect-object-injection -- key comes from FormData which is from controlled form elements
        machineData[key] = value;
      }
    });

    // Validate required fields
    if (typeof machineData.name !== 'string' || machineData.name.length === 0) {
      showErrorAlert('Bitte geben Sie einen Maschinennamen ein');
      return;
    }

    try {
      // Check if we're editing (machine-id has value) or creating new

      const machineIdInput = document.querySelector<HTMLInputElement>('#machine-id');
      const machineId = machineIdInput?.value;

      if (machineId !== undefined && machineId !== '') {
        await this.updateMachine(Number.parseInt(machineId, 10), machineData as Partial<Machine>);
        showSuccessAlert('Maschine erfolgreich aktualisiert');
      } else {
        await this.createMachine(machineData as Partial<Machine>);
        showSuccessAlert('Maschine erfolgreich erstellt');
      }

      this.closeMachineModal();
    } catch (error) {
      console.error('Error saving machine:', error);
      // Error messages are already shown by createMachine/updateMachine
    }
  }

  async loadDepartmentsForMachineSelect(): Promise<void> {
    try {
      const response = await this.apiClient.request<Department[]>('/departments', {
        method: 'GET',
      });

      const departments = response;
      const selectElement = document.querySelector<HTMLSelectElement>('#machine-department');

      if (selectElement === null) {
        console.error('[MachinesManager] Machine department select not found');
        return;
      }

      // Clear existing options except the first one (placeholder)
      selectElement.innerHTML = '<option value="">Keine Abteilung</option>';

      // Add department options
      departments.forEach((dept: Department) => {
        const option = document.createElement('option');
        option.value = dept.id.toString();
        option.textContent = dept.name;
        selectElement.append(option);
      });

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
      const selectElement = document.querySelector<HTMLSelectElement>('#machine-area');

      if (selectElement === null) {
        console.error('[MachinesManager] Machine area select not found');
        return;
      }

      // Clear existing options except the first one (placeholder)
      selectElement.innerHTML = '<option value="">Kein Bereich</option>';

      // Add area options
      areas.forEach((area: Area) => {
        const option = document.createElement('option');
        option.value = area.id.toString();
        option.textContent = area.name;
        selectElement.append(option);
      });

      console.info('[MachinesManager] Loaded areas:', areas.length);
    } catch (error) {
      console.error('Error loading areas for machine select:', error);
      showErrorAlert('Fehler beim Laden der Bereiche');
    }
  }
}

// Initialize when DOM is ready
let machinesManager: MachinesManager | null = null;

// Helper to populate edit form with machine data
async function populateEditForm(machine: Machine) {
  const modal = document.querySelector('#machine-modal');
  if (modal === null) return;

  modal.classList.add('active');

  // First load departments and areas
  await machinesManager?.loadDepartmentsForMachineSelect();
  await machinesManager?.loadAreasForMachineSelect();

  // Helper to set input value
  const setInputValue = (id: string, value: string | number | undefined) => {
    const input = document.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`);
    if (input !== null && value !== undefined) {
      input.value = value.toString();
    }
  };

  // Fill form fields
  setInputValue('machine-id', machine.id);
  setInputValue('machine-name', machine.name);
  setInputValue('machine-model', machine.model);
  setInputValue('machine-manufacturer', machine.manufacturer);
  setInputValue('machine-serial', machine.serialNumber);
  setInputValue('machine-department', machine.departmentId);
  setInputValue('machine-area', machine.areaId);
  setInputValue('machine-type', machine.machineType);
  setInputValue('machine-status', machine.status);
  setInputValue('machine-hours', machine.operatingHours);

  // Format date for input
  if (machine.nextMaintenance !== undefined) {
    const date = new Date(machine.nextMaintenance);
    const formattedDate = date.toISOString().split('T')[0];
    setInputValue('machine-next-maintenance', formattedDate);
  }

  // Update modal title
  const modalTitle = document.querySelector('#machine-modal-title');
  if (modalTitle !== null) {
    modalTitle.textContent = 'Maschine bearbeiten';
  }
}

// Setup window handlers for machine operations
function setupWindowHandlers() {
  const w = window as unknown as WindowWithMachineHandlers;

  // Export loadMachinesTable function to window for show-section.ts
  (window as WindowWithMachineHandlers & { loadMachinesTable?: () => void }).loadMachinesTable = () => {
    console.info('[MachinesManager] loadMachinesTable called');
    void machinesManager?.loadMachines();
  };

  // Edit machine handler
  w.editMachine = async (id: number) => {
    const machine = await machinesManager?.getMachineDetails(id);
    if (machine !== null && machine !== undefined) {
      await populateEditForm(machine);
    }
  };

  // View details handler
  w.viewMachineDetails = async (id: number) => {
    const machine = await machinesManager?.getMachineDetails(id);
    if (machine !== null) {
      console.info('View machine:', machine);
      showErrorAlert('Detailansicht noch nicht implementiert');
    }
  };

  // Delete handler
  w.deleteMachine = async (id: number) => {
    await machinesManager?.deleteMachine(id);
  };

  // Modal handlers
  w.showMachineModal = async () => {
    await machinesManager?.showMachineModal();
  };

  w.closeMachineModal = () => {
    machinesManager?.closeMachineModal();
  };

  w.saveMachine = async () => {
    await machinesManager?.saveMachine();
  };
}

// Setup URL change monitoring for section visibility
function setupUrlMonitoring() {
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

  // Monitor pushState/replaceState
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

document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if we're on the manage-machines page
  if (window.location.pathname === '/manage-machines' || window.location.pathname.includes('manage-machines')) {
    machinesManager = new MachinesManager();
    setupWindowHandlers();
    setupUrlMonitoring();
  }
});

export { MachinesManager };
