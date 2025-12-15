/* eslint-disable max-lines -- Rotation module after refactoring, contains all rotation logic */
/* eslint-disable max-lines-per-function -- Complex UI setup functions require more lines */
/**
 * Rotation Management for Shift Planning System
 * Functions for managing shift rotation patterns
 */

import { showSuccessAlert, showErrorAlert, showConfirm } from '../utils/alerts';
import { getAuthToken } from '../auth/index';
import type { RotationPattern, Employee, SelectedContext } from './types';
import { $$id, setSafeHTML } from '../../utils/dom-utils';
import { getEmployees, getSelectedContext, setRotationConfig, setCurrentWeek } from './state';
import { showRotationModal, hideRotationModal } from './modals';
import { getEmployeeDisplayName } from './ui';
import {
  createRotationPattern as apiCreateRotationPattern,
  updateRotationPattern as apiUpdateRotationPattern,
  assignRotation,
  generateRotationShifts as apiGenerateRotationShifts,
  DuplicatePatternError,
} from './api';

// ============== ROTATION PATTERN API ==============

/**
 * Check if rotation pattern exists for a team
 */
export async function checkRotationPatternExists(teamId: number | null): Promise<boolean> {
  if (teamId === null || teamId === 0) return false;

  try {
    const token = getAuthToken();
    if (token === null || token === '') return false;

    const response = await fetch(`/api/v2/shifts/rotation/patterns?team_id=${String(teamId)}&active=true`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return false;

    // API returns { success: true, data: { patterns: [...] } }
    const result = (await response.json()) as { data?: { patterns?: RotationPattern[] } };
    return (result.data?.patterns?.length ?? 0) > 0;
  } catch (error) {
    console.error('Error checking rotation pattern:', error);
    return false;
  }
}

/**
 * Load active rotation patterns
 */
export async function loadActiveRotationPatterns(): Promise<RotationPattern[]> {
  try {
    const token = getAuthToken();
    if (token === null || token === '') return [];

    const response = await fetch('/api/v2/shifts/rotation/patterns?active=true', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return [];

    // API returns { success: true, data: { patterns: [...] } }
    const result = (await response.json()) as { data?: { patterns?: RotationPattern[] } };
    return result.data?.patterns ?? [];
  } catch (error) {
    console.error('Error loading rotation patterns:', error);
    return [];
  }
}

/**
 * Load existing pattern for a team
 */
export async function loadExistingPattern(teamId: number): Promise<RotationPattern | null> {
  try {
    const token = getAuthToken();
    if (token === null || token === '') return null;

    const response = await fetch(`/api/v2/shifts/rotation/patterns?team_id=${String(teamId)}&active=true`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;

    // API returns { success: true, data: { patterns: [...] } }
    const result = (await response.json()) as { data?: { patterns?: RotationPattern[] } };
    return result.data?.patterns?.[0] ?? null;
  } catch (error) {
    console.error('Error loading existing pattern:', error);
    return null;
  }
}

/**
 * Load a specific pattern by ID
 * Used to get pattern_type from rotation history's patternId
 */
export async function loadPatternById(patternId: number): Promise<RotationPattern | null> {
  try {
    const token = getAuthToken();
    if (token === null || token === '') return null;

    const response = await fetch(`/api/v2/shifts/rotation/patterns/${patternId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;

    // API returns { success: true, data: { pattern: {...} } }
    const result = (await response.json()) as { data?: { pattern?: RotationPattern } };
    return result.data?.pattern ?? null;
  } catch (error) {
    console.error('Error loading pattern by ID:', error);
    return null;
  }
}

/**
 * Create rotation pattern
 */
export async function createRotationPattern(patternData: {
  name: string;
  description?: string;
  teamId: number;
  patternType: string;
  patternConfig: Record<string, unknown>;
  startsAt: string;
  endsAt?: string;
  isActive?: boolean;
}): Promise<{ success: boolean; patternId?: number; error?: string }> {
  try {
    const token = getAuthToken();
    if (token === null || token === '') {
      return { success: false, error: 'Nicht authentifiziert' };
    }

    const response = await fetch('/api/v2/shifts/rotation/patterns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(patternData),
    });

    if (!response.ok) {
      const errorResponse = (await response.json()) as { error?: { message?: string } };
      return { success: false, error: errorResponse.error?.message ?? 'Fehler beim Erstellen des Musters' };
    }

    const result = (await response.json()) as { patternId: number };
    return { success: true, patternId: result.patternId };
  } catch (error) {
    console.error('Error creating rotation pattern:', error);
    return { success: false, error: 'Fehler beim Erstellen des Musters' };
  }
}

/**
 * Update rotation pattern
 */
export async function updateRotationPattern(
  patternId: number,
  patternData: {
    name?: string;
    description?: string;
    patternType?: string;
    patternConfig?: Record<string, unknown>;
    startsAt?: string;
    endsAt?: string;
    isActive?: boolean;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const token = getAuthToken();
    if (token === null || token === '') {
      return { success: false, error: 'Nicht authentifiziert' };
    }

    const response = await fetch(`/api/v2/shifts/rotation/patterns/${String(patternId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(patternData),
    });

    if (!response.ok) {
      const errorResponse = (await response.json()) as { error?: { message?: string } };
      return { success: false, error: errorResponse.error?.message ?? 'Fehler beim Aktualisieren des Musters' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating rotation pattern:', error);
    return { success: false, error: 'Fehler beim Aktualisieren des Musters' };
  }
}

// ============== ROTATION HISTORY ==============

/** Rotation history entry with ID for single-entry deletion support */
export interface RotationHistoryEntry {
  id: number;
  patternId?: number;
  shiftDate: string;
  shiftType: string;
  userId: number;
  status: string;
}

/**
 * Load rotation history for a date range
 */
export async function loadRotationHistory(
  startDate: string,
  endDate: string,
  teamId?: number | null,
): Promise<RotationHistoryEntry[]> {
  try {
    const token = getAuthToken();
    if (token === null || token === '') return [];

    let url = `/api/v2/shifts/rotation/history?start_date=${startDate}&end_date=${endDate}`;
    if (teamId !== null && teamId !== undefined) {
      url += `&team_id=${String(teamId)}`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return [];

    const result = (await response.json()) as {
      data?: {
        history?: RotationHistoryEntry[];
      };
    };

    return result.data?.history ?? [];
  } catch (error) {
    console.error('Error loading rotation history:', error);
    return [];
  }
}

// ============== ROTATION GENERATION ==============

/**
 * Generate rotation shifts
 */
export async function generateRotationShifts(generateData: {
  patternId: number;
  startDate: string;
  weeksToGenerate: number;
}): Promise<{ success: boolean; shiftsGenerated?: number; error?: string }> {
  try {
    const token = getAuthToken();
    if (token === null || token === '') {
      return { success: false, error: 'Nicht authentifiziert' };
    }

    const response = await fetch('/api/v2/shifts/rotation/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(generateData),
    });

    if (!response.ok) {
      const errorResponse = (await response.json()) as { error?: { message?: string } };
      return { success: false, error: errorResponse.error?.message ?? 'Fehler beim Generieren der Schichten' };
    }

    const result = (await response.json()) as { shiftsGenerated: number };
    return { success: true, shiftsGenerated: result.shiftsGenerated };
  } catch (error) {
    console.error('Error generating rotation shifts:', error);
    return { success: false, error: 'Fehler beim Generieren der Schichten' };
  }
}

// ============== ROTATION FORM HELPERS ==============

/**
 * Get rotation form values
 */
export function getRotationFormValues(): {
  pattern: string;
  startDate: string;
  endDate: string;
  skipSaturday: boolean;
  skipSunday: boolean;
  nightShiftStatic: boolean;
} {
  // Hidden input stores the selected value from custom dropdown
  const patternInput = document.querySelector<HTMLInputElement>('#rotation-pattern');
  const startInput = document.querySelector<HTMLInputElement>('#rotation-start-date');
  const endInput = document.querySelector<HTMLInputElement>('#rotation-end-date');
  const skipSaturdayInput = document.querySelector<HTMLInputElement>('#rotation-skip-saturday');
  const skipSundayInput = document.querySelector<HTMLInputElement>('#rotation-skip-sunday');
  const nightStaticInput = document.querySelector<HTMLInputElement>('#rotation-night-static');

  return {
    pattern: patternInput?.value ?? '',
    startDate: startInput?.value ?? '',
    endDate: endInput?.value ?? '',
    skipSaturday: skipSaturdayInput?.checked ?? false,
    skipSunday: skipSundayInput?.checked ?? false,
    nightShiftStatic: nightStaticInput?.checked ?? true, // Default true (N bleibt konstant)
  };
}

/**
 * Validate rotation form values
 */
export function validateRotationForm(formValues: { pattern: string; startDate: string }): {
  valid: boolean;
  error?: string;
} {
  if (formValues.pattern === '') {
    return { valid: false, error: 'Bitte wählen Sie ein Rotationsmuster' };
  }

  if (formValues.startDate === '') {
    return { valid: false, error: 'Bitte wählen Sie ein Startdatum' };
  }

  return { valid: true };
}

/**
 * Map pattern type to API value
 */
export function mapPatternTypeToAPI(selectValue: string): string {
  // Map frontend select values to backend pattern types
  // weekly: 1-week rotation cycle (Früh → Spät → Nacht)
  // biweekly: 2-week rotation cycle
  // monthly: 4-week rotation cycle
  const patternTypeMap = new Map<string, string>([
    ['weekly', 'alternate_fs'],
    ['biweekly', 'fixed_n'],
    ['monthly', 'fixed_n'], // Monthly uses same backend type but with longer cycle
  ]);
  return patternTypeMap.get(selectValue) ?? 'alternate_fs';
}

/**
 * Map API pattern type to select value
 */
export function mapAPIPatternToSelect(patternType: string, patternConfig?: Record<string, unknown>): string {
  if (patternType === 'alternate_fs') {
    return 'weekly';
  }
  if (patternType === 'fixed_n') {
    // Check cycleWeeks to determine if biweekly or monthly
    const cycleWeeks = patternConfig?.['cycleWeeks'];
    if (typeof cycleWeeks === 'number' && cycleWeeks >= 4) {
      return 'monthly';
    }
    return 'biweekly';
  }
  return 'weekly';
}

// ============== ROTATION UI HELPERS ==============

/**
 * Setup available employees for rotation
 */
export function setupAvailableEmployees(
  container: HTMLElement,
  employees: Employee[],
  selectedTeamId: number | null,
  createEmployeeElement: (employee: Employee) => HTMLElement,
): void {
  // Filter employees by selected team
  const teamEmployees = employees.filter((e) => {
    if (e.isActive !== 1) return false;
    if (selectedTeamId !== null && selectedTeamId !== 0) {
      return e.teamId === selectedTeamId;
    }
    return true;
  });

  // Clear existing content
  while (container.firstChild !== null) {
    container.firstChild.remove();
  }

  // Create draggable employee items
  teamEmployees.forEach((employee) => {
    const employeeDiv = createEmployeeElement(employee);
    container.append(employeeDiv);
  });
}

/**
 * Get next Monday from a date
 */
export function getNextMonday(date: Date): Date {
  const result = new Date(date);
  const dayOfWeek = result.getDay();
  const daysUntilMonday = dayOfWeek === 1 ? 7 : dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  result.setDate(result.getDate() + daysUntilMonday);
  return result;
}

/**
 * Get second Friday after a given date
 */
export function getSecondFridayAfter(date: Date): Date {
  const result = new Date(date);
  const dayOfWeek = result.getDay();
  const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 12 - dayOfWeek;
  result.setDate(result.getDate() + daysUntilFriday);
  result.setDate(result.getDate() + 7);
  return result;
}

/**
 * Configure date inputs for rotation modal
 */
export function configureDateInputs(editMode: boolean): void {
  const startDateInput = document.querySelector<HTMLInputElement>('#rotation-start-date');
  const endDateInput = document.querySelector<HTMLInputElement>('#rotation-end-date');

  if (startDateInput === null || endDateInput === null) return;

  const today = new Date();
  const todayString = today.toISOString().split('T')[0] ?? '';
  const maxDate = `${today.getFullYear()}-12-31`;

  startDateInput.min = todayString;
  endDateInput.min = todayString;
  endDateInput.max = maxDate;

  if (!editMode) {
    const nextMonday = getNextMonday(today);
    const secondFriday = getSecondFridayAfter(nextMonday);

    startDateInput.value = nextMonday.toISOString().split('T')[0] ?? '';
    endDateInput.value = secondFriday.toISOString().split('T')[0] ?? '';

    // Auto-adjust end date when start date changes
    startDateInput.addEventListener('change', () => {
      const newStartDate = new Date(startDateInput.value);
      const newEndDate = getSecondFridayAfter(newStartDate);
      const endDateString = newEndDate.toISOString().split('T')[0];
      if (endDateString !== undefined) {
        endDateInput.value = endDateString;
      }
    });
  }
}

// ============== ROTATION SHIFT CONVERSION ==============

/**
 * Convert database shift type to frontend format
 */
export function convertShiftTypeFromDB(dbShiftType: string): string {
  if (dbShiftType === 'F') return 'early';
  if (dbShiftType === 'S') return 'late';
  if (dbShiftType === 'N') return 'night';
  return dbShiftType;
}

/**
 * Convert frontend shift type to API format
 */
export function convertShiftTypeToAPI(frontendType: string): string {
  if (frontendType === 'early') return 'F';
  if (frontendType === 'late') return 'S';
  if (frontendType === 'night') return 'N';
  return frontendType;
}

/**
 * Convert rotation history to legacy shift format
 */
export function convertRotationToLegacyShifts(
  history: { shiftDate: string; shiftType: string; userId: number; status: string }[],
  employees: Employee[],
): {
  date: string;
  shiftType: string;
  employeeId: number;
  firstName: string;
  lastName: string;
  username: string;
}[] {
  return history.map((h) => {
    const employee = employees.find((e) => e.id === h.userId);
    const shiftType = convertShiftTypeFromDB(h.shiftType);

    return {
      date: h.shiftDate,
      shiftType: shiftType,
      employeeId: h.userId,
      firstName: employee?.firstName ?? '',
      lastName: employee?.lastName ?? '',
      username: employee?.username ?? '',
    };
  });
}

// ============== ROTATION CONFIG MANAGEMENT ==============

/**
 * Build rotation payload for API
 */
export function buildRotationPayload(
  context: SelectedContext,
  formValues: {
    pattern: string;
    startDate: string;
    endDate: string;
    skipSaturday: boolean;
    skipSunday: boolean;
    nightShiftStatic: boolean;
  },
): Record<string, unknown> {
  return {
    name: `Team-Rotation ${String(context.teamId ?? 'Unknown')}`,
    description: 'Automatisch generierte Schichtrotation',
    teamId: context.teamId,
    patternType: mapPatternTypeToAPI(formValues.pattern),
    patternConfig: {
      skipSaturday: formValues.skipSaturday,
      skipSunday: formValues.skipSunday,
      nightShiftStatic: formValues.nightShiftStatic,
    },
    startsAt: formValues.startDate,
    endsAt: formValues.endDate !== '' ? formValues.endDate : formValues.startDate,
    isActive: true,
  };
}

/**
 * Load shift assignments from pattern config
 */
export function loadShiftAssignments(shiftGroups: Record<string, string>): void {
  // Load existing employee assignments into drop zones
  Object.entries(shiftGroups).forEach(([shift, employees]) => {
    const dropZone = document.querySelector<HTMLElement>(`.drop-zone[data-shift="${shift}"]`);
    if (dropZone !== null && employees !== '') {
      // Clear existing content
      while (dropZone.firstChild !== null) {
        dropZone.firstChild.remove();
      }

      // Add employee divs
      const employeeIds = employees.split(',');
      employeeIds.forEach((id) => {
        const employeeDiv = document.createElement('div');
        employeeDiv.className = 'employee-item';
        employeeDiv.dataset['employeeId'] = id.trim();
        employeeDiv.textContent = `Employee ${id.trim()}`;
        employeeDiv.draggable = true;
        dropZone.append(employeeDiv);
      });
    }
  });
}

// ============== ROTATION SUCCESS HANDLERS ==============

/**
 * Handle rotation creation success
 */
export function handleRotationCreationSuccess(): void {
  showSuccessAlert('Rotation erfolgreich erstellt und generiert');
}

/**
 * Handle rotation update success
 */
export function handleRotationUpdateSuccess(): void {
  showSuccessAlert('Rotation erfolgreich aktualisiert');
}

/**
 * Handle rotation error
 */
export function handleRotationError(error: unknown): void {
  const errorMessage = error instanceof Error ? error.message : 'Fehler bei der Rotation';
  showErrorAlert(errorMessage);
}

// ============== ROTATION UI LOGIC ==============

/** DataTransfer key for employee name during drag */
const DRAG_DATA_EMPLOYEE_NAME = 'employee-name';

/** Callback type for render operations after rotation changes */
type RenderCallback = () => void | Promise<void>;

/** Stored callback for re-rendering the week after rotation changes */
let renderWeekCallback: RenderCallback | null = null;

/**
 * Set the callback function for re-rendering the week
 * Must be called during initialization from index.ts
 */
export function setRenderWeekCallback(callback: RenderCallback): void {
  renderWeekCallback = callback;
}

// ============== ROTATION PATTERN INFO ==============

/**
 * Get info text for rotation pattern
 * Returns undefined if pattern is not recognized
 */
function getRotationPatternInfo(pattern: string): string | undefined {
  switch (pattern) {
    case 'weekly':
      return (
        'Frühschicht und Spätschicht wechseln sich <strong>wöchentlich</strong> ab. ' +
        'Mit "Nachtschicht konstant" bleibt N immer gleich besetzt (nur F ↔ S alternieren).'
      );
    case 'biweekly':
      return (
        'Frühschicht und Spätschicht wechseln sich <strong>alle 2 Wochen</strong> ab. ' +
        'Mit "Nachtschicht konstant" bleibt N immer gleich besetzt (nur F ↔ S alternieren).'
      );
    case 'monthly':
      return (
        'Frühschicht und Spätschicht wechseln sich <strong>alle 4 Wochen</strong> ab. ' +
        'Mit "Nachtschicht konstant" bleibt N immer gleich besetzt (nur F ↔ S alternieren).'
      );
    default:
      return undefined;
  }
}

/**
 * Update rotation pattern info alert based on selected pattern
 */
export function updateRotationPatternInfo(patternValue: string): void {
  const infoContainer = $$id('rotation-pattern-info');
  const infoText = $$id('rotation-pattern-info-text');

  if (infoContainer === null || infoText === null) {
    return;
  }

  const info = getRotationPatternInfo(patternValue);
  if (info !== undefined) {
    setSafeHTML(infoText, info);
    infoContainer.classList.remove('u-hidden');
  } else {
    infoContainer.classList.add('u-hidden');
  }
}

// ============== ROTATION MODAL EMPLOYEES ==============

/**
 * Create a draggable employee item for the rotation modal
 */
function createRotationEmployeeItem(employee: Employee): HTMLElement {
  const item = document.createElement('div');
  item.className = 'employee-item';
  item.dataset['employeeId'] = String(employee.id);
  item.draggable = true;

  // Build employee info structure (matching sidebar style)
  const infoDiv = document.createElement('div');
  infoDiv.className = 'employee-info';

  const name = getEmployeeDisplayName(employee);
  const nameSpan = document.createElement('span');
  nameSpan.className = 'employee-name';
  nameSpan.textContent = name;
  infoDiv.append(nameSpan);

  item.append(infoDiv);

  // Setup drag events for rotation modal
  item.addEventListener('dragstart', (e) => {
    e.dataTransfer?.setData('text/plain', String(employee.id));
    e.dataTransfer?.setData(DRAG_DATA_EMPLOYEE_NAME, name);
    item.classList.add('dragging');
  });

  item.addEventListener('dragend', () => {
    item.classList.remove('dragging');
  });

  return item;
}

/**
 * Setup drop zones in rotation modal for shift assignment
 */
function setupRotationDropZones(): void {
  const dropZoneIds = ['drop-zone-f', 'drop-zone-s', 'drop-zone-n'];

  dropZoneIds.forEach((zoneId) => {
    const dropZone = $$id(zoneId);
    if (dropZone === null) {
      console.warn(`[ROTATION] Drop zone not found: ${zoneId}`);
      return;
    }

    // Clear existing content in drop zone
    dropZone.innerHTML = '';

    // Allow drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.stopPropagation();
      const relatedTarget = e.relatedTarget as Node | null;
      if (relatedTarget === null || !dropZone.contains(relatedTarget)) {
        dropZone.classList.remove('drag-over');
      }
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      dropZone.classList.remove('drag-over');

      const dragEvent = e;
      const employeeId = dragEvent.dataTransfer?.getData('text/plain');
      const employeeName = dragEvent.dataTransfer?.getData(DRAG_DATA_EMPLOYEE_NAME);

      if (employeeId === undefined || employeeId === '') return;

      // Check if employee is already in any drop zone
      const existingElement = document.querySelector(`.drop-zone [data-employee-id="${employeeId}"]`);
      if (existingElement !== null) {
        existingElement.remove();
      }

      // Also remove from available employees container
      const availableContainer = $$id('rotation-available-employees');
      const availableEmployee = availableContainer?.querySelector(`[data-employee-id="${employeeId}"]`);
      if (availableEmployee !== null && availableEmployee !== undefined) {
        availableEmployee.remove();
      }

      // Create new element in drop zone
      const employeeDiv = document.createElement('div');
      employeeDiv.className = 'employee-item in-drop-zone';
      employeeDiv.dataset['employeeId'] = employeeId;
      employeeDiv.dataset['shiftType'] = dropZone.dataset['shift'] ?? '';
      employeeDiv.draggable = true;

      const infoDiv = document.createElement('div');
      infoDiv.className = 'employee-info';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'employee-name';
      nameSpan.textContent = employeeName ?? `Mitarbeiter ${employeeId}`;
      infoDiv.append(nameSpan);

      // Add remove button
      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-remove-rotation';
      removeBtn.innerHTML = '<i class="fas fa-times"></i>';
      removeBtn.title = 'Zurück zu verfügbar';
      removeBtn.addEventListener('click', () => {
        // Move back to available employees
        const employees = getEmployees();
        const employee = employees.find((emp) => String(emp.id) === employeeId);
        if (employee !== undefined) {
          const container = $$id('rotation-available-employees');
          if (container !== null) {
            const item = createRotationEmployeeItem(employee);
            container.append(item);
          }
        }
        employeeDiv.remove();
      });

      employeeDiv.append(infoDiv, removeBtn);

      // Allow re-dragging from drop zone
      employeeDiv.addEventListener('dragstart', (dragE) => {
        dragE.dataTransfer?.setData('text/plain', employeeId);
        dragE.dataTransfer?.setData(DRAG_DATA_EMPLOYEE_NAME, employeeName ?? '');
        employeeDiv.classList.add('dragging');
      });

      employeeDiv.addEventListener('dragend', () => {
        employeeDiv.classList.remove('dragging');
      });

      dropZone.append(employeeDiv);
    });
  });
}

/**
 * Render employees in the rotation modal for drag & drop assignment
 * Only shows employees from the currently selected team
 */
export function renderRotationModalEmployees(): void {
  const container = $$id('rotation-available-employees');
  if (container === null) {
    console.error('[ROTATION] rotation-available-employees container not found');
    return;
  }

  // Clear existing content
  container.innerHTML = '';

  // Get employees from state (already filtered by team when loaded)
  const employees = getEmployees();
  const context = getSelectedContext();

  console.info('[ROTATION] Rendering employees for modal:', {
    totalEmployees: employees.length,
    selectedTeamId: context.teamId,
  });

  // Filter only active employees from the selected team
  const teamEmployees = employees.filter((emp) => {
    // Must be active
    if (emp.isActive !== 1) return false;
    // If team is selected, filter by team_id
    if (context.teamId !== null && context.teamId !== 0) {
      return emp.teamId === context.teamId;
    }
    return true;
  });

  console.info('[ROTATION] Filtered team employees:', teamEmployees.length);

  if (teamEmployees.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'text-white/50 text-sm p-2';
    emptyMessage.textContent = 'Keine Mitarbeiter im ausgewählten Team gefunden';
    container.append(emptyMessage);
    return;
  }

  // Create draggable employee items for the modal
  teamEmployees.forEach((employee) => {
    const item = createRotationEmployeeItem(employee);
    container.append(item);
  });

  // Setup drop zones for shift assignment
  setupRotationDropZones();
}

/**
 * Handle rotation toggle checkbox
 */
export function handleRotationToggle(enabled: boolean): void {
  console.info('[SHIFTS ROTATION] Toggle:', enabled);
  setRotationConfig({ enabled });
  if (enabled) {
    console.info('[SHIFTS ROTATION] Showing modal...');
    // Render employees in the rotation modal before showing
    renderRotationModalEmployees();
    showRotationModal();
    console.info('[SHIFTS ROTATION] Modal show called');
  }
}

// ============== ROTATION SAVE LOGIC ==============

/** Shift group type for rotation assignments */
type ShiftGroup = 'F' | 'S' | 'N';

/**
 * Collect employees from rotation drop zones
 * Returns employees grouped by shift type (F, S, N)
 */
function collectEmployeesFromDropZones(): {
  employees: { userId: number; group: ShiftGroup }[];
  shiftGroups: Record<ShiftGroup, number[]>;
} {
  const employees: { userId: number; group: ShiftGroup }[] = [];
  const shiftGroups: Record<ShiftGroup, number[]> = { F: [], S: [], N: [] };
  const shiftMapping = new Map<string, ShiftGroup>([
    ['drop-zone-f', 'F'],
    ['drop-zone-s', 'S'],
    ['drop-zone-n', 'N'],
  ]);

  shiftMapping.forEach((group, zoneId) => {
    const dropZone = $$id(zoneId);
    if (dropZone === null) return;

    const employeeItems = dropZone.querySelectorAll<HTMLElement>('[data-employee-id]');
    employeeItems.forEach((item) => {
      const employeeIdStr = item.dataset['employeeId'];
      if (employeeIdStr !== undefined && employeeIdStr !== '') {
        const userId = Number.parseInt(employeeIdStr, 10);
        employees.push({ userId, group });
        switch (group) {
          case 'F':
            shiftGroups.F.push(userId);
            break;
          case 'S':
            shiftGroups.S.push(userId);
            break;
          case 'N':
            shiftGroups.N.push(userId);
            break;
        }
      }
    });
  });

  return { employees, shiftGroups };
}

/**
 * Calculate default end date by adding weeks to start date
 */
function calculateDefaultEndDate(startDate: string, weeks: number): string {
  const start = new Date(startDate);
  start.setDate(start.getDate() + weeks * 7);
  return start.toISOString().split('T')[0] ?? startDate;
}

/**
 * Get cycle length in weeks based on pattern type
 */
function getCycleLengthWeeks(pattern: string): number {
  if (pattern === 'weekly') return 1;
  if (pattern === 'monthly') return 4;
  return 2; // Default for biweekly
}

/**
 * Navigate to the week containing the given date
 * Sets currentWeek to Monday of that week
 */
function navigateToWeekContainingDate(dateStr: string): void {
  const date = new Date(dateStr);
  // Get Monday of this week (ISO weeks start on Monday)
  const dayOfWeek = date.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Sunday = 0, need to go back 6 days
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  setCurrentWeek(monday);
  const mondayStr = monday.toISOString().split('T')[0] ?? '';
  console.info('[SHIFTS ROTATION] Navigated to week containing:', dateStr, '→ Monday:', mondayStr);
}

/**
 * Build rotation pattern data for API
 */
function buildRotationPatternData(
  teamId: number,
  formValues: ReturnType<typeof getRotationFormValues>,
  shiftGroups: Record<ShiftGroup, number[]>,
): {
  name: string;
  patternType: string;
  patternConfig: Record<string, unknown>;
  cycleLengthWeeks: number;
  startsAt: string;
  endsAt?: string;
  teamId: number;
} {
  const patternData: {
    name: string;
    patternType: string;
    patternConfig: Record<string, unknown>;
    cycleLengthWeeks: number;
    startsAt: string;
    endsAt?: string;
    teamId: number;
  } = {
    name: `Team-Rotation ${String(teamId)}`,
    patternType: mapPatternTypeToAPI(formValues.pattern),
    patternConfig: {
      skipSaturday: formValues.skipSaturday,
      skipSunday: formValues.skipSunday,
      nightShiftStatic: formValues.nightShiftStatic,
      shiftGroups,
    },
    cycleLengthWeeks: getCycleLengthWeeks(formValues.pattern),
    startsAt: formValues.startDate,
    teamId,
  };
  if (formValues.endDate !== '') {
    patternData.endsAt = formValues.endDate;
  }
  return patternData;
}

/**
 * Execute rotation creation workflow (create, assign, generate)
 */
async function executeRotationCreation(
  patternData: ReturnType<typeof buildRotationPatternData>,
  employees: { userId: number; group: ShiftGroup }[],
  formValues: ReturnType<typeof getRotationFormValues>,
): Promise<void> {
  const patternResult = await apiCreateRotationPattern(patternData);
  console.info('[SHIFTS ROTATION] Pattern created:', patternResult);

  // Assign employees to the pattern with dates
  const assignData: {
    patternId: number;
    assignments: { userId: number; group: ShiftGroup }[];
    startsAt: string;
    endsAt?: string;
    teamId?: number | null;
  } = {
    patternId: patternResult.id,
    assignments: employees,
    startsAt: formValues.startDate,
  };
  if (formValues.endDate !== '') {
    assignData.endsAt = formValues.endDate;
  }
  const context = getSelectedContext();
  if (context.teamId !== null) {
    assignData.teamId = context.teamId;
  }
  await assignRotation(assignData);

  // Calculate endDate for generation: use formValues.endDate or default to 4 weeks from startDate
  const generateEndDate =
    formValues.endDate !== '' ? formValues.endDate : calculateDefaultEndDate(formValues.startDate, 4);

  const generateResult = await apiGenerateRotationShifts({
    patternId: patternResult.id,
    startDate: formValues.startDate,
    endDate: generateEndDate,
  });

  showSuccessAlert(`Rotation erfolgreich erstellt! ${String(generateResult.shiftsGenerated)} Schichten generiert.`);
  hideRotationModal();

  // Navigate to the week containing the start date
  navigateToWeekContainingDate(formValues.startDate);

  // Call the registered callback to re-render the week
  if (renderWeekCallback !== null) {
    void renderWeekCallback();
  }
}

/**
 * Handle updating an existing rotation pattern (when duplicate name detected)
 */
async function handleUpdateExistingRotation(existingPatternId: number): Promise<void> {
  try {
    console.info('[SHIFTS ROTATION] Updating existing pattern:', existingPatternId);

    const formValues = getRotationFormValues();
    const { employees, shiftGroups } = collectEmployeesFromDropZones();
    const context = getSelectedContext();

    // Build update data conditionally for exactOptionalPropertyTypes
    const updateData: {
      patternType: string;
      patternConfig: Record<string, unknown>;
      cycleLengthWeeks: number;
      startsAt: string;
      endsAt?: string;
      teamId?: number;
    } = {
      patternType: mapPatternTypeToAPI(formValues.pattern),
      patternConfig: {
        skipSaturday: formValues.skipSaturday,
        skipSunday: formValues.skipSunday,
        nightShiftStatic: formValues.nightShiftStatic,
        shiftGroups,
      },
      cycleLengthWeeks: getCycleLengthWeeks(formValues.pattern),
      startsAt: formValues.startDate,
    };
    if (formValues.endDate !== '') {
      updateData.endsAt = formValues.endDate;
    }
    if (context.teamId !== null) {
      updateData.teamId = context.teamId;
    }
    await apiUpdateRotationPattern(existingPatternId, updateData);

    // Re-assign employees with dates
    const assignData: {
      patternId: number;
      assignments: { userId: number; group: ShiftGroup }[];
      startsAt: string;
      endsAt?: string;
      teamId?: number | null;
    } = {
      patternId: existingPatternId,
      assignments: employees,
      startsAt: formValues.startDate,
    };
    if (formValues.endDate !== '') {
      assignData.endsAt = formValues.endDate;
    }
    if (context.teamId !== null) {
      assignData.teamId = context.teamId;
    }
    await assignRotation(assignData);

    // Generate shifts - use formValues.endDate or default to 4 weeks from startDate
    const generateEndDate =
      formValues.endDate !== '' ? formValues.endDate : calculateDefaultEndDate(formValues.startDate, 4);

    const generateResult = await apiGenerateRotationShifts({
      patternId: existingPatternId,
      startDate: formValues.startDate,
      endDate: generateEndDate,
    });

    showSuccessAlert(`Rotation aktualisiert! ${String(generateResult.shiftsGenerated)} Schichten generiert.`);
    hideRotationModal();

    // Navigate to the week containing the start date
    navigateToWeekContainingDate(formValues.startDate);

    // Call the registered callback to re-render the week
    if (renderWeekCallback !== null) {
      void renderWeekCallback();
    }
  } catch (error) {
    console.error('[SHIFTS ROTATION] Update error:', error);
    showErrorAlert(error instanceof Error ? error.message : 'Fehler beim Aktualisieren der Rotation');
  }
}

/**
 * Handle rotation save errors (extracted to reduce complexity)
 */
async function handleRotationSaveError(error: unknown): Promise<void> {
  if (error instanceof DuplicatePatternError) {
    const confirmed = await showConfirm(`${error.message}\n\nMöchten Sie das bestehende Muster überschreiben?`);
    if (confirmed) {
      await handleUpdateExistingRotation(error.existingId);
    }
    return;
  }
  showErrorAlert(error instanceof Error ? error.message : 'Fehler beim Speichern der Rotation');
}

/**
 * Handle save rotation button click
 */
export async function handleSaveRotation(): Promise<void> {
  console.info('[SHIFTS ROTATION] Save rotation clicked');

  try {
    const formValues = getRotationFormValues();
    console.info('[SHIFTS ROTATION] Form values:', formValues);

    const validation = validateRotationForm(formValues);
    if (!validation.valid) {
      showErrorAlert(validation.error ?? 'Validierungsfehler');
      return;
    }

    const context = getSelectedContext();
    if (context.teamId === null) {
      showErrorAlert('Bitte wählen Sie zuerst ein Team aus');
      return;
    }

    const { employees, shiftGroups } = collectEmployeesFromDropZones();
    if (employees.length === 0) {
      showErrorAlert('Bitte ziehen Sie mindestens einen Mitarbeiter in eine Schicht-Spalte');
      return;
    }

    const patternData = buildRotationPatternData(context.teamId, formValues, shiftGroups);
    await executeRotationCreation(patternData, employees, formValues);
  } catch (error) {
    console.error('[SHIFTS ROTATION] Error:', error);
    await handleRotationSaveError(error);
  }
}
