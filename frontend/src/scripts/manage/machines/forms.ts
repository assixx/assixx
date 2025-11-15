/**
 * Machine Management - Forms Layer
 * UI and form handling for machine management
 */

import { $$, $$id, setSafeHTML } from '../../../utils/dom-utils';
import { showSuccessAlert, showErrorAlert } from '../../utils/alerts';
// Import from types
import type { Machine, MachineFormData } from './types';
// Import from data layer
import {
  machines,
  departments,
  areas,
  currentMachineId,
  setCurrentMachineId,
  loadDepartments,
  loadAreas,
  getMachineById,
  saveMachine as saveMachineAPI,
} from './data';

// ===== CONSTANTS =====
const MODAL_ACTIVE_CLASS = 'modal-overlay--active';

// ===== DOM ELEMENT SELECTORS =====
export const SELECTORS = {
  MACHINE_MODAL: '#machine-modal',
  MODAL_TITLE: '#machine-modal-title',
  MACHINE_ID: '#machine-id',
  MACHINE_NAME: '#machine-name',
  MACHINE_MODEL: '#machine-model',
  MACHINE_MANUFACTURER: '#machine-manufacturer',
  MACHINE_SERIAL: '#machine-serial',
  MACHINE_DEPARTMENT: '#machine-department',
  MACHINE_AREA: '#machine-area',
  MACHINE_TYPE: '#machine-type',
  MACHINE_STATUS: '#machine-status',
  MACHINE_HOURS: '#machine-hours',
  MACHINE_NEXT_MAINTENANCE: '#machine-next-maintenance',
  MACHINE_FORM: '#machine-form',
} as const;

// ===== HELPER FUNCTIONS =====

/**
 * Get machine type display label
 */
export function getMachineTypeLabel(type: string): string {
  const typeMap = new Map<string, string>([
    ['production', 'Produktion'],
    ['packaging', 'Verpackung'],
    ['quality_control', 'Qualitätskontrolle'],
    ['logistics', 'Logistik'],
    ['utility', 'Versorgung'],
    ['other', 'Sonstiges'],
  ]);
  return typeMap.get(type) ?? type;
}

/**
 * Populate department dropdown (Custom Dropdown)
 */
export async function populateDepartmentDropdown(): Promise<void> {
  try {
    // Load departments if not already loaded
    if (departments.length === 0) {
      await loadDepartments();
    }

    const departmentMenu = $$id('department-menu');
    if (departmentMenu === null) {
      console.error('[MachineForms] Department menu not found');
      return;
    }

    // Clear existing options
    departmentMenu.innerHTML = '<div class="dropdown__option" data-value="">Keine Abteilung</div>';

    // Add department options
    departments.forEach((dept) => {
      const option = document.createElement('div');
      option.className = 'dropdown__option';
      option.dataset.value = String(dept.id);
      option.textContent = dept.name;
      departmentMenu.appendChild(option);
    });

    console.info('[MachineForms] Populated departments:', departments.length);
  } catch (error) {
    console.error('Error populating departments:', error);
    showErrorAlert('Fehler beim Laden der Abteilungen');
  }
}

/**
 * Populate area dropdown (Custom Dropdown)
 */
export async function populateAreaDropdown(): Promise<void> {
  try {
    // Load areas if not already loaded
    if (areas.length === 0) {
      await loadAreas();
    }

    const areaMenu = $$id('area-menu');
    if (areaMenu === null) {
      console.error('[MachineForms] Area menu not found');
      return;
    }

    // Clear existing options
    areaMenu.innerHTML = '<div class="dropdown__option" data-value="">Kein Bereich</div>';

    // Add area options
    areas.forEach((area) => {
      const option = document.createElement('div');
      option.className = 'dropdown__option';
      option.dataset.value = String(area.id);
      option.textContent = area.name;
      areaMenu.appendChild(option);
    });

    console.info('[MachineForms] Populated areas:', areas.length);
  } catch (error) {
    console.error('Error populating areas:', error);
    showErrorAlert('Fehler beim Laden der Bereiche');
  }
}

/**
 * Show add machine modal (new machine)
 */
export function showAddMachineModal(): void {
  const modal = $$(SELECTORS.MACHINE_MODAL);
  const form = $$(SELECTORS.MACHINE_FORM) as HTMLFormElement | null;
  const modalTitle = $$(SELECTORS.MODAL_TITLE);

  if (modal === null) {
    console.error('[MachineForms] Machine modal not found');
    return;
  }

  // Reset current machine ID
  setCurrentMachineId(null);

  // Reset form
  if (form !== null) {
    form.reset();
  }

  // Set modal title
  if (modalTitle !== null) {
    modalTitle.textContent = 'Neue Maschine';
  }

  // Load dropdowns
  void (async () => {
    await populateDepartmentDropdown();
    await populateAreaDropdown();
  })();

  // Show modal
  modal.classList.add(MODAL_ACTIVE_CLASS);
}

/**
 * Close machine modal
 */
export function closeMachineModal(): void {
  const modal = $$(SELECTORS.MACHINE_MODAL);
  if (modal !== null) {
    modal.classList.remove(MODAL_ACTIVE_CLASS);
  }
}

/**
 * Helper: Set Department Dropdown value and display
 */
function setDepartmentDropdown(machine: Machine): void {
  const deptInput = $$id('machine-department') as HTMLInputElement | null;
  const deptTrigger = $$id('department-trigger');

  if (deptInput === null || deptTrigger === null) {
    return;
  }

  const deptValue = machine.departmentId !== undefined ? String(machine.departmentId) : '';
  deptInput.value = deptValue;

  const deptTriggerSpan = deptTrigger.querySelector('span');
  if (deptTriggerSpan !== null) {
    deptTriggerSpan.textContent = machine.departmentName ?? 'Keine Abteilung';
  }
}

/**
 * Helper: Set Area Dropdown value and display
 */
function setAreaDropdown(machine: Machine): void {
  const areaInput = $$id('machine-area') as HTMLInputElement | null;
  const areaTrigger = $$id('area-trigger');

  if (areaInput === null || areaTrigger === null) {
    return;
  }

  const areaValue = machine.areaId !== undefined ? String(machine.areaId) : '';
  areaInput.value = areaValue;

  const areaTriggerSpan = areaTrigger.querySelector('span');
  if (areaTriggerSpan !== null) {
    // We don't have areaName in Machine interface, so we need to find it from areas array
    const area = areas.find((a) => a.id === machine.areaId);
    areaTriggerSpan.textContent = area?.name ?? 'Kein Bereich';
  }
}

/**
 * Helper: Set Machine Type Dropdown value and display
 */
function setMachineTypeDropdown(machine: Machine): void {
  const typeInput = $$id('machine-type') as HTMLInputElement | null;
  const typeTrigger = $$id('type-trigger');

  if (typeInput === null || typeTrigger === null) {
    return;
  }

  const typeValue = machine.machineType ?? '';
  typeInput.value = typeValue;

  const typeTriggerSpan = typeTrigger.querySelector('span');
  if (typeTriggerSpan !== null) {
    const typeLabels = new Map<string, string>([
      ['production', 'Produktion'],
      ['packaging', 'Verpackung'],
      ['quality_control', 'Qualitätskontrolle'],
      ['logistics', 'Logistik'],
      ['utility', 'Versorgung'],
      ['other', 'Sonstiges'],
    ]);
    // Safe Map access prevents prototype pollution
    typeTriggerSpan.textContent = typeLabels.get(typeValue) ?? 'Maschinentyp wählen';
  }
}

/**
 * Helper: Set Status Dropdown value and display (with badge)
 */
function setStatusDropdown(machine: Machine): void {
  const statusInput = $$id('machine-status') as HTMLInputElement | null;
  const statusTrigger = $$id('status-trigger');

  if (statusInput === null || statusTrigger === null) {
    return;
  }

  statusInput.value = machine.status;

  const statusTriggerSpan = statusTrigger.querySelector('span');
  if (statusTriggerSpan !== null) {
    const statusConfig: Record<string, { class: string; text: string }> = {
      operational: { class: 'badge--success', text: 'Betriebsbereit' },
      maintenance: { class: 'badge--warning', text: 'In Wartung' },
      repair: { class: 'badge--danger', text: 'In Reparatur' },
      standby: { class: 'badge--info', text: 'Standby' },
      decommissioned: { class: 'badge--error', text: 'Außer Betrieb' },
    };

    const config = statusConfig[machine.status] ?? { class: 'badge--error', text: machine.status };
    setSafeHTML(statusTriggerSpan, `<span class="badge ${config.class}">${config.text}</span>`);
  }
}

/**
 * Helper: Safely set input value by ID
 */
function setInputById(id: string, value: string): void {
  const input = $$id(id) as HTMLInputElement | null;
  if (input !== null) {
    input.value = value;
  }
}

/**
 * Populate form with machine data (for editing)
 */
async function populateFormWithMachineData(machine: Machine): Promise<void> {
  // First load dropdowns
  await populateDepartmentDropdown();
  await populateAreaDropdown();

  // Set form fields using helper to reduce complexity
  setInputById('machine-id', String(machine.id));
  setInputById('machine-name', machine.name);
  setInputById('machine-model', machine.model ?? '');
  setInputById('machine-manufacturer', machine.manufacturer ?? '');
  setInputById('machine-serial', machine.serialNumber ?? '');
  setInputById('machine-hours', machine.operatingHours !== undefined ? String(machine.operatingHours) : '');

  // Handle date field (convert to YYYY-MM-DD format)
  if (machine.nextMaintenance !== undefined && machine.nextMaintenance !== '') {
    const date = new Date(machine.nextMaintenance);
    setInputById('machine-next-maintenance', date.toISOString().split('T')[0]);
  }

  // Set custom dropdowns
  setDepartmentDropdown(machine);
  setAreaDropdown(machine);
  setMachineTypeDropdown(machine);
  setStatusDropdown(machine);
}

/**
 * Edit machine handler
 */
export async function editMachineHandler(machineId: number): Promise<void> {
  console.info('[MachineForms] Editing machine:', machineId);

  // Find machine in local array first
  let machine: Machine | null | undefined = machines.find((m) => m.id === machineId);

  // If not found locally, fetch from API
  machine ??= await getMachineById(machineId);

  // Check if machine was found
  if (!machine) {
    showErrorAlert('Maschine nicht gefunden');
    return;
  }

  const modal = $$(SELECTORS.MACHINE_MODAL);
  const modalTitle = $$(SELECTORS.MODAL_TITLE);

  if (modal === null) {
    console.error('[MachineForms] Machine modal not found');
    return;
  }

  // Set current machine ID
  setCurrentMachineId(machineId);

  // Update modal title
  if (modalTitle !== null) {
    modalTitle.textContent = 'Maschine bearbeiten';
  }

  // Populate form with machine data
  await populateFormWithMachineData(machine);

  // Show modal
  modal.classList.add(MODAL_ACTIVE_CLASS);
}

/**
 * Handle form submission (create or update)
 */
export async function handleFormSubmit(e: Event): Promise<void> {
  e.preventDefault();

  const form = $$(SELECTORS.MACHINE_FORM) as HTMLFormElement | null;
  if (form === null) return;

  const formData = new FormData(form);
  const machineData: Record<string, string | number | undefined> = {};

  // Convert FormData to object with proper type conversions
  formData.forEach((value, key) => {
    if (typeof value === 'string') {
      // Skip empty strings for optional fields
      if (value.length === 0) {
        return;
      }

      // Convert numeric fields to numbers
      if (key === 'departmentId' || key === 'areaId' || key === 'operatingHours') {
        const numValue = Number(value);
        if (!Number.isNaN(numValue)) {
          // eslint-disable-next-line security/detect-object-injection -- key comes from FormData which is from controlled form elements
          machineData[key] = numValue;
        }
        return;
      }

      // Convert date fields from YYYY-MM-DD to ISO 8601 format
      const dateFields = ['nextMaintenance', 'lastMaintenance', 'purchaseDate', 'installationDate', 'warrantyUntil'];
      if (dateFields.includes(key)) {
        // Convert YYYY-MM-DD to ISO 8601: YYYY-MM-DDTHH:mm:ss.000Z
        const isoDate = new Date(value).toISOString();
        // eslint-disable-next-line security/detect-object-injection -- key comes from FormData which is from controlled form elements
        machineData[key] = isoDate;
        return;
      }

      // Keep other strings as-is
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
    // Save machine (create or update based on currentMachineId)
    const savedId = await saveMachineAPI(machineData as unknown as MachineFormData);
    console.info('[MachineForms] Machine saved:', savedId);

    // Show success message
    if (currentMachineId !== null) {
      showSuccessAlert('Maschine erfolgreich aktualisiert');
    } else {
      showSuccessAlert('Maschine erfolgreich erstellt');
    }

    // Close modal
    closeMachineModal();
  } catch (error) {
    console.error('Error saving machine:', error);
    const errorMessage = error instanceof Error ? error.message : 'Fehler beim Speichern der Maschine';
    showErrorAlert(errorMessage);
  }
}

/**
 * View machine details handler (placeholder)
 */
export async function viewMachineDetailsHandler(machineId: number): Promise<void> {
  console.info('[MachineForms] Viewing machine details:', machineId);

  const machine = machines.find((m) => m.id === machineId);

  if (machine === undefined) {
    showErrorAlert('Maschine nicht gefunden');
    return;
  }

  // TODO: Implement details modal/view
  // For now, just edit the machine
  await editMachineHandler(machineId);
}
