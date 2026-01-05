/* eslint-disable max-lines */
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
  teams,
  currentMachineId,
  setCurrentMachineId,
  loadDepartments,
  loadAreas,
  loadTeams,
  getMachineById,
  getMachineTeams,
  setMachineTeamsApi,
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
  MACHINE_TEAMS: '#machine-teams',
  MACHINE_TYPE: '#machine-type',
  MACHINE_STATUS: '#machine-status',
  MACHINE_HOURS: '#machine-hours',
  MACHINE_NEXT_MAINTENANCE: '#machine-next-maintenance',
  MACHINE_FORM: '#machine-form',
} as const;

// Element IDs for $$id() (without #)
const ELEMENT_IDS = {
  TEAMS_MENU: 'teams-menu',
  TEAMS_INPUT: 'machine-teams',
  TEAMS_DISPLAY: 'teams-display',
  TEAMS_TRIGGER: 'teams-trigger',
  TEAMS_DROPDOWN: 'teams-dropdown',
  DEPARTMENT_MENU: 'department-menu',
  DEPARTMENT_INPUT: 'machine-department',
  DEPARTMENT_TRIGGER: 'department-trigger',
  AREA_MENU: 'area-menu',
  AREA_INPUT: 'machine-area',
  AREA_TRIGGER: 'area-trigger',
} as const;

// UI text constants
const NO_TEAMS_TEXT = 'Keine Teams zugewiesen';
const SELECT_AREA_FIRST_TEXT = 'Bitte zuerst Bereich wählen';
const SELECT_DEPARTMENT_FIRST_TEXT = 'Bitte zuerst Abteilung wählen';

// State for current machine teams (for tracking changes)
let currentMachineTeamIds: number[] = [];

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
 * Convert FormData to machine data object with proper type conversions
 */
function convertFormDataToMachineData(formData: FormData): Record<string, string | number | undefined> {
  const machineData: Record<string, string | number | undefined> = {};
  const numericFields = ['departmentId', 'areaId', 'operatingHours'];
  const dateFields = ['nextMaintenance', 'lastMaintenance', 'purchaseDate', 'installationDate', 'warrantyUntil'];

  formData.forEach((value, key) => {
    if (typeof value !== 'string' || value.length === 0) return;

    if (numericFields.includes(key)) {
      const numValue = Number(value);
      if (!Number.isNaN(numValue)) {
        // eslint-disable-next-line security/detect-object-injection -- key from FormData controlled elements
        machineData[key] = numValue;
      }
    } else if (dateFields.includes(key)) {
      // eslint-disable-next-line security/detect-object-injection -- key from FormData controlled elements
      machineData[key] = new Date(value).toISOString();
    } else {
      // eslint-disable-next-line security/detect-object-injection -- key from FormData controlled elements
      machineData[key] = value;
    }
  });

  return machineData;
}

/**
 * Parse team IDs from hidden input value
 */
function parseTeamIds(teamsInput: HTMLInputElement): number[] {
  const value = teamsInput.value;
  if (value.length === 0) return [];
  return value
    .split(',')
    .map(Number)
    .filter((id) => !Number.isNaN(id));
}

/**
 * Save machine teams if they changed
 */
async function saveTeamsIfChanged(machineId: number): Promise<void> {
  const teamsInput = $$id(ELEMENT_IDS.TEAMS_INPUT) as HTMLInputElement | null;
  if (teamsInput === null) return;

  const teamIds = parseTeamIds(teamsInput);
  const hasChanged =
    teamIds.length !== currentMachineTeamIds.length || teamIds.some((id) => !currentMachineTeamIds.includes(id));

  if (hasChanged) {
    await setMachineTeamsApi(machineId, teamIds);
    console.info('[MachineForms] Machine teams saved:', teamIds);
  }
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

    const departmentMenu = $$id(ELEMENT_IDS.DEPARTMENT_MENU);
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
      option.dataset['value'] = String(dept.id);
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

    const areaMenu = $$id(ELEMENT_IDS.AREA_MENU);
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
      option.dataset['value'] = String(area.id);
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
 * Populate teams dropdown (Multi-Select with Checkboxes)
 * Optionally filtered by departmentId
 */
export async function populateTeamsDropdown(
  filterDepartmentId?: number,
  selectedTeamIds: number[] = [],
): Promise<void> {
  try {
    // Load teams if not already loaded
    if (teams.length === 0) {
      await loadTeams();
    }

    const teamsMenu = $$id(ELEMENT_IDS.TEAMS_MENU);
    if (teamsMenu === null) {
      console.error('[MachineForms] Teams menu not found');
      return;
    }

    // Filter teams by department if specified
    const filteredTeams =
      filterDepartmentId !== undefined ? teams.filter((team) => team.departmentId === filterDepartmentId) : teams;

    // Clear existing options
    teamsMenu.textContent = '';

    if (filteredTeams.length === 0) {
      const emptyOption = document.createElement('div');
      emptyOption.className = 'dropdown__option dropdown__option--disabled';
      emptyOption.textContent = 'Keine Teams verfügbar';
      teamsMenu.appendChild(emptyOption);
      return;
    }

    // Add team options with checkboxes (using DOM manipulation for security)
    filteredTeams.forEach((team) => {
      const isChecked = selectedTeamIds.includes(team.id);
      const option = document.createElement('label');
      option.className = 'dropdown__option dropdown__option--checkbox';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = String(team.id);
      checkbox.checked = isChecked;

      const nameSpan = document.createElement('span');
      nameSpan.textContent = team.name;

      option.appendChild(checkbox);
      option.appendChild(nameSpan);

      if (team.departmentName !== undefined) {
        const deptSmall = document.createElement('small');
        deptSmall.className = 'text-muted ml-2';
        deptSmall.textContent = `(${team.departmentName})`;
        option.appendChild(deptSmall);
      }

      teamsMenu.appendChild(option);
    });

    // Add change listeners to checkboxes
    teamsMenu.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        updateTeamsSelection();
      });
    });

    console.info('[MachineForms] Populated teams:', filteredTeams.length);
  } catch (error) {
    console.error('Error populating teams:', error);
  }
}

/**
 * Update teams selection (hidden input and display)
 */
function updateTeamsSelection(): void {
  const teamsMenu = $$id(ELEMENT_IDS.TEAMS_MENU);
  const teamsInput = $$id(ELEMENT_IDS.TEAMS_INPUT) as HTMLInputElement | null;
  const teamsDisplay = $$id(ELEMENT_IDS.TEAMS_DISPLAY);

  if (teamsMenu === null || teamsInput === null || teamsDisplay === null) {
    return;
  }

  // Get all checked checkboxes
  const checkedBoxes = teamsMenu.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked');
  const selectedIds: number[] = [];
  const selectedNames: string[] = [];

  checkedBoxes.forEach((checkbox) => {
    const teamId = Number(checkbox.value);
    if (!Number.isNaN(teamId)) {
      selectedIds.push(teamId);
      const label = checkbox.parentElement?.querySelector('span');
      if (label !== null && label !== undefined) {
        selectedNames.push(label.textContent);
      }
    }
  });

  // Update hidden input
  teamsInput.value = selectedIds.join(',');

  // Update display
  if (selectedNames.length === 0) {
    teamsDisplay.textContent = NO_TEAMS_TEXT;
  } else if (selectedNames.length <= 2) {
    teamsDisplay.textContent = selectedNames.join(', ');
  } else {
    teamsDisplay.textContent = `${selectedNames.length} Teams ausgewählt`;
  }
}

/**
 * Reset Department dropdown to placeholder state (no Area selected)
 */
export function resetDepartmentDropdownToPlaceholder(): void {
  const departmentMenu = $$id(ELEMENT_IDS.DEPARTMENT_MENU);
  const deptInput = $$id(ELEMENT_IDS.DEPARTMENT_INPUT) as HTMLInputElement | null;
  const deptTrigger = $$id(ELEMENT_IDS.DEPARTMENT_TRIGGER);

  if (departmentMenu !== null) {
    setSafeHTML(
      departmentMenu,
      `<div class="dropdown__option dropdown__option--disabled">${SELECT_AREA_FIRST_TEXT}</div>`,
    );
  }

  if (deptInput !== null) deptInput.value = '';
  if (deptTrigger !== null) {
    const span = deptTrigger.querySelector('span');
    if (span !== null) span.textContent = SELECT_AREA_FIRST_TEXT;
  }
}

/**
 * Reset Teams dropdown to placeholder state (no Department selected)
 */
export function resetTeamsDropdownToPlaceholder(): void {
  const teamsMenu = $$id(ELEMENT_IDS.TEAMS_MENU);
  const teamsInput = $$id(ELEMENT_IDS.TEAMS_INPUT) as HTMLInputElement | null;
  const teamsDisplay = $$id(ELEMENT_IDS.TEAMS_DISPLAY);

  if (teamsMenu !== null) {
    setSafeHTML(
      teamsMenu,
      `<div class="dropdown__option dropdown__option--disabled">${SELECT_DEPARTMENT_FIRST_TEXT}</div>`,
    );
  }

  if (teamsInput !== null) teamsInput.value = '';
  if (teamsDisplay !== null) teamsDisplay.textContent = SELECT_DEPARTMENT_FIRST_TEXT;
}

/**
 * Filter departments dropdown by selected area
 */
export function filterDepartmentsByArea(areaId: number | null): void {
  // If no area selected, show placeholder instead of all departments
  if (areaId === null) {
    resetDepartmentDropdownToPlaceholder();
    resetTeamsDropdownToPlaceholder();
    return;
  }

  const departmentMenu = $$id(ELEMENT_IDS.DEPARTMENT_MENU);
  if (departmentMenu === null) return;

  // Filter departments by area
  const filteredDepts = departments.filter((dept) => dept.areaId === areaId);

  // Clear and repopulate
  departmentMenu.innerHTML = '<div class="dropdown__option" data-value="">Keine Abteilung</div>';

  filteredDepts.forEach((dept) => {
    const option = document.createElement('div');
    option.className = 'dropdown__option';
    option.dataset['value'] = String(dept.id);
    option.textContent = dept.name;
    departmentMenu.appendChild(option);
  });

  // Reset department selection
  const deptInput = $$id(ELEMENT_IDS.DEPARTMENT_INPUT) as HTMLInputElement | null;
  const deptTrigger = $$id(ELEMENT_IDS.DEPARTMENT_TRIGGER);
  if (deptInput !== null) deptInput.value = '';
  if (deptTrigger !== null) {
    const span = deptTrigger.querySelector('span');
    if (span !== null) span.textContent = 'Keine Abteilung';
  }

  // Also reset teams when department changes
  resetTeamsDropdownToPlaceholder();
}

/**
 * Filter teams dropdown by selected department
 */
export function filterTeamsByDepartment(departmentId: number | null): void {
  // If no department selected, show placeholder instead of all teams
  if (departmentId === null) {
    resetTeamsDropdownToPlaceholder();
    return;
  }

  const selectedTeamIds = getSelectedTeamIds();
  void populateTeamsDropdown(departmentId, selectedTeamIds);
}

/**
 * Get currently selected team IDs
 */
function getSelectedTeamIds(): number[] {
  const teamsInput = $$id(ELEMENT_IDS.TEAMS_INPUT) as HTMLInputElement | null;
  if (teamsInput === null || teamsInput.value === '') return [];
  return teamsInput.value
    .split(',')
    .map(Number)
    .filter((id) => !Number.isNaN(id));
}

/**
 * Setup cascading dropdown event listeners
 */
export function setupCascadingDropdowns(): void {
  // Area dropdown change handler
  const areaMenu = $$id(ELEMENT_IDS.AREA_MENU);
  if (areaMenu !== null) {
    areaMenu.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const option = target.closest('.dropdown__option');
      if (option === null) return;

      const areaId = option.getAttribute('data-value');
      const numericAreaId = areaId !== null && areaId !== '' ? Number(areaId) : null;

      // Update hidden input and trigger display
      const areaInput = $$id(ELEMENT_IDS.AREA_INPUT) as HTMLInputElement | null;
      const areaTrigger = $$id(ELEMENT_IDS.AREA_TRIGGER);
      if (areaInput !== null) areaInput.value = areaId ?? '';
      if (areaTrigger !== null) {
        const span = areaTrigger.querySelector('span');
        if (span !== null) span.textContent = option.textContent;
      }

      // Filter departments by area
      filterDepartmentsByArea(numericAreaId);
    });
  }

  // Department dropdown change handler
  const departmentMenu = $$id(ELEMENT_IDS.DEPARTMENT_MENU);
  if (departmentMenu !== null) {
    departmentMenu.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const option = target.closest('.dropdown__option');
      if (option === null) return;

      const deptId = option.getAttribute('data-value');
      const numericDeptId = deptId !== null && deptId !== '' ? Number(deptId) : null;

      // Update hidden input and trigger display
      const deptInput = $$id(ELEMENT_IDS.DEPARTMENT_INPUT) as HTMLInputElement | null;
      const deptTrigger = $$id(ELEMENT_IDS.DEPARTMENT_TRIGGER);
      if (deptInput !== null) deptInput.value = deptId ?? '';
      if (deptTrigger !== null) {
        const span = deptTrigger.querySelector('span');
        if (span !== null) span.textContent = option.textContent;
      }

      // Filter teams by department
      filterTeamsByDepartment(numericDeptId);
    });
  }

  // Teams dropdown toggle - use same pattern as Area/Department (active class on menu)
  const teamsTrigger = $$id(ELEMENT_IDS.TEAMS_TRIGGER);
  const teamsMenu = $$id(ELEMENT_IDS.TEAMS_MENU);
  const teamsDropdown = $$id(ELEMENT_IDS.TEAMS_DROPDOWN);
  if (teamsTrigger !== null && teamsMenu !== null && teamsDropdown !== null) {
    teamsTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      teamsMenu.classList.toggle('active'); // Same pattern as Department/Area
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!teamsDropdown.contains(e.target as Node)) {
        teamsMenu.classList.remove('active');
      }
    });
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

  // Reset current machine ID and teams
  setCurrentMachineId(null);
  currentMachineTeamIds = [];

  // Reset form
  if (form !== null) {
    form.reset();
  }

  // Set modal title
  if (modalTitle !== null) {
    modalTitle.textContent = 'Neue Maschine';
  }

  // Load dropdowns with proper cascading:
  // 1. Only Areas are populated initially
  // 2. Department shows "Bitte zuerst Bereich wählen"
  // 3. Teams shows "Bitte zuerst Abteilung wählen"
  void (async () => {
    // Pre-load data for cascading (but don't populate dropdowns yet)
    await loadDepartments();
    await loadTeams();

    // Only populate Areas dropdown - user must select Area first
    await populateAreaDropdown();

    // Set placeholder states for dependent dropdowns
    resetDepartmentDropdownToPlaceholder();
    resetTeamsDropdownToPlaceholder();

    // Setup cascading event handlers
    setupCascadingDropdowns();
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
  const deptInput = $$id(ELEMENT_IDS.DEPARTMENT_INPUT) as HTMLInputElement | null;
  const deptTrigger = $$id(ELEMENT_IDS.DEPARTMENT_TRIGGER);

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
  const areaInput = $$id(ELEMENT_IDS.AREA_INPUT) as HTMLInputElement | null;
  const areaTrigger = $$id(ELEMENT_IDS.AREA_TRIGGER);

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
 * Helper: Get teams display text based on machine teams and department status
 */
function getTeamsDisplayText(machineTeams: { teamName: string }[], hasDepartment: boolean): string {
  if (!hasDepartment) {
    return SELECT_DEPARTMENT_FIRST_TEXT;
  }
  if (machineTeams.length === 0) {
    return NO_TEAMS_TEXT;
  }
  if (machineTeams.length <= 2) {
    return machineTeams.map((t) => t.teamName).join(', ');
  }
  return `${machineTeams.length} Teams ausgewählt`;
}

/**
 * Helper: Populate department dropdown filtered by area
 */
function populateDepartmentsByArea(areaId: number | undefined): void {
  if (areaId === undefined) {
    resetDepartmentDropdownToPlaceholder();
    return;
  }

  const filteredDepts = departments.filter((dept) => dept.areaId === areaId);
  const departmentMenu = $$id(ELEMENT_IDS.DEPARTMENT_MENU);
  if (departmentMenu === null) return;

  departmentMenu.innerHTML = '<div class="dropdown__option" data-value="">Keine Abteilung</div>';
  filteredDepts.forEach((dept) => {
    const option = document.createElement('div');
    option.className = 'dropdown__option';
    option.dataset['value'] = String(dept.id);
    option.textContent = dept.name;
    departmentMenu.appendChild(option);
  });
}

/**
 * Populate form with machine data (for editing)
 * Uses proper cascading: Area → Department → Teams
 */
async function populateFormWithMachineData(machine: Machine): Promise<void> {
  // Load all data first
  await loadDepartments();
  await loadTeams();
  await populateAreaDropdown();

  // Cascade dropdowns based on machine's current assignments
  populateDepartmentsByArea(machine.areaId);

  // Load teams for machine
  const machineTeams = await getMachineTeams(machine.id);
  const teamIds = machineTeams.map((t) => t.teamId);
  currentMachineTeamIds = teamIds;

  // Populate teams dropdown based on department
  if (machine.departmentId !== undefined) {
    await populateTeamsDropdown(machine.departmentId, teamIds);
  } else {
    resetTeamsDropdownToPlaceholder();
  }

  // Update teams display
  const teamsInput = $$id(ELEMENT_IDS.TEAMS_INPUT) as HTMLInputElement | null;
  const teamsDisplay = $$id(ELEMENT_IDS.TEAMS_DISPLAY);
  if (teamsInput !== null) teamsInput.value = teamIds.join(',');
  if (teamsDisplay !== null) {
    teamsDisplay.textContent = getTeamsDisplayText(machineTeams, machine.departmentId !== undefined);
  }

  // Setup cascading event handlers
  setupCascadingDropdowns();

  // Set form fields
  setInputById('machine-id', String(machine.id));
  setInputById('machine-name', machine.name);
  setInputById('machine-model', machine.model ?? '');
  setInputById('machine-manufacturer', machine.manufacturer ?? '');
  setInputById('machine-serial', machine.serialNumber ?? '');
  setInputById('machine-hours', machine.operatingHours !== undefined ? String(machine.operatingHours) : '');

  // Handle date field
  const nextMaintenance = machine.nextMaintenance ?? '';
  if (nextMaintenance !== '') {
    const date = new Date(nextMaintenance);
    setInputById('machine-next-maintenance', date.toISOString().split('T')[0] ?? '');
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

  const machineData = convertFormDataToMachineData(new FormData(form));

  // Validate required fields
  if (typeof machineData['name'] !== 'string' || machineData['name'].length === 0) {
    showErrorAlert('Bitte geben Sie einen Maschinennamen ein');
    return;
  }

  try {
    const savedId = await saveMachineAPI(machineData as unknown as MachineFormData);
    console.info('[MachineForms] Machine saved:', savedId);

    await saveTeamsIfChanged(savedId);

    const message = currentMachineId !== null ? 'Maschine erfolgreich aktualisiert' : 'Maschine erfolgreich erstellt';
    showSuccessAlert(message);
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
