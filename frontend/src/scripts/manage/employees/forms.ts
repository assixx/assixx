/**
 * Employee Management Forms Layer - Modal and Form Handling
 * Following manage-admins pattern for consistent architecture
 */

import { $$id, setSafeHTML } from '../../../utils/dom-utils';
import { resetAndReinitializePasswordToggles } from '../../../utils/password-toggle';
import type { Employee, WindowWithEmployeeHandlers } from './types';
import { fillBasicFormFields, fillOptionalFormFields, fillAvailabilityFields, setStatusAndClearPasswords } from './ui';

// ===== CONSTANTS =====
const MODAL_ACTIVE_CLASS = 'modal-overlay--active';

// Password toggle cleanup controller (prevent memory leaks)
let passwordToggleCleanup: AbortController | null = null;

// ===== DOM ELEMENT SELECTORS =====
// NOTE: IDs without '#' prefix because $$id() adds it automatically
export const SELECTORS = {
  EMPLOYEE_MODAL: 'employee-modal',
  MODAL_TITLE: 'employee-modal-title',
  EMPLOYEE_FORM: 'employee-form',
  EMPLOYEE_ID: 'employee-id',
  DELETE_MODAL: 'delete-employee-modal',
  DELETE_INPUT: 'delete-employee-id',
  POSITION_TRIGGER: 'position-trigger',
  POSITION_INPUT: 'employee-position',
  STATUS_TRIGGER: 'status-trigger',
  STATUS_INPUT: 'employee-status',
  AVAILABILITY_TRIGGER: 'availability-status-trigger',
  AVAILABILITY_INPUT: 'availability-status',
} as const;

// ===== HELPER FUNCTIONS =====

/**
 * Reset a single dropdown to default state
 */
function resetDropdown(triggerId: string, inputId: string, defaultText: string | null, defaultValue: string): void {
  const trigger = $$id(triggerId);
  const input = $$id(inputId) as HTMLInputElement | null;

  if (trigger !== null) {
    const span = trigger.querySelector('span');
    if (span !== null && defaultText !== null) {
      if (defaultText.includes('<span')) {
        // HTML content (for status badges)
        setSafeHTML(span, defaultText);
      } else {
        // Plain text
        span.textContent = defaultText;
      }
    }
  }

  if (input !== null) {
    input.value = defaultValue;
  }
}

/**
 * Reset custom dropdown displays to default values
 * Following manage-admins clearFormFields pattern
 */
export function resetCustomDropdowns(): void {
  // Reset Position Dropdown
  resetDropdown('position-trigger', 'employee-position', 'Bitte wählen...', '');

  // Reset Status Dropdown - default to "Aktiv"
  resetDropdown('status-trigger', 'employee-status', '<span class="badge badge--success">Aktiv</span>', '1');

  // Reset Availability Status Dropdown - default to "Verfügbar"
  resetDropdown('availability-status-trigger', 'availability-status', 'Verfügbar', 'available');

  // Reset Department Dropdown
  resetDropdown('department-trigger', 'employee-department', 'Keine Abteilung', '');

  // Reset Team Dropdown
  resetDropdown('team-trigger', 'employee-team', 'Kein Team', '');
}

/**
 * Clear all form validation states
 */
export function clearFieldValidationStates(): void {
  // TODO: Implement if needed for employee form validation
  // Following manage-admins pattern
}

/**
 * Update dropdown trigger text from menu option
 */
function updateDropdownTriggerText(trigger: HTMLElement, menu: HTMLElement, value: number): void {
  const selectedOption = menu.querySelector(`[data-value="${value}"]`);
  if (selectedOption !== null) {
    const span = trigger.querySelector('span');
    if (span !== null) {
      span.textContent = selectedOption.textContent;
    }
  }
}

/**
 * Restore custom dropdown value by setting hidden input and trigger text
 */
function restoreDropdownValue(inputId: string, triggerId: string, menuId: string, value: number | undefined): void {
  if (value === undefined) return;

  const input = $$id(inputId) as HTMLInputElement | null;
  const trigger = $$id(triggerId);
  const menu = $$id(menuId);

  if (input !== null) {
    input.value = String(value);

    // Update trigger text from selected option
    if (trigger !== null && menu !== null) {
      updateDropdownTriggerText(trigger, menu, value);
    }
  }
}

// ===== MODAL FUNCTIONS =====

/**
 * Show employee modal for creating new employee
 * Following manage-admins showAddAdminModal pattern
 */
export function showAddEmployeeModal(): void {
  console.info('[showAddEmployeeModal] Opening modal for new employee');

  const modal = $$id(SELECTORS.EMPLOYEE_MODAL);
  const title = $$id(SELECTORS.MODAL_TITLE);
  const form = $$id(SELECTORS.EMPLOYEE_FORM) as HTMLFormElement | null;

  if (title !== null) {
    title.textContent = 'Neuen Mitarbeiter anlegen';
  }

  // Reset form
  if (form !== null) {
    form.reset();
  }

  // Reset custom dropdowns
  resetCustomDropdowns();

  // Hide availability section for new employees
  const availabilitySections = modal?.querySelectorAll('.form-section');
  availabilitySections?.forEach((section) => {
    const heading = section.querySelector('h4');
    if (heading !== null && heading.textContent === 'Verfügbarkeit') {
      (section as HTMLElement).style.display = 'none';
    }
  });

  // Initialize password toggles
  passwordToggleCleanup = resetAndReinitializePasswordToggles(
    [
      { input: '#employee-password', toggle: '#employee-password-toggle' },
      { input: '#employee-password-confirm', toggle: '#employee-password-confirm-toggle' },
    ],
    passwordToggleCleanup,
  );

  // Show modal
  if (modal !== null) {
    modal.classList.add(MODAL_ACTIVE_CLASS);
  }

  // Load departments and teams
  setTimeout(() => {
    const w = window as WindowWithEmployeeHandlers;
    void (async () => {
      if (w.loadDepartmentsForEmployeeSelect !== undefined) {
        await w.loadDepartmentsForEmployeeSelect();
      }
      await w.loadTeamsForEmployeeSelect?.();
    })();
  }, 100);
}

/**
 * Show employee modal for editing existing employee
 * Following manage-admins showEditAdminModal pattern
 */
export function showEditEmployeeModal(employee: Employee, departmentId?: number, teamId?: number): void {
  console.info('[showEditEmployeeModal] Opening modal for employee:', employee.id);

  const modal = $$id(SELECTORS.EMPLOYEE_MODAL);
  const title = $$id(SELECTORS.MODAL_TITLE);

  if (title !== null) {
    title.textContent = 'Mitarbeiter bearbeiten';
  }

  // Fill form fields
  fillBasicFormFields(employee);
  fillOptionalFormFields(employee);
  fillAvailabilityFields(employee);
  setStatusAndClearPasswords(employee);

  // Show availability section for edit mode
  const availabilitySections = modal?.querySelectorAll('.form-section');
  availabilitySections?.forEach((section) => {
    const heading = section.querySelector('h4');
    if (heading !== null && heading.textContent === 'Verfügbarkeit') {
      (section as HTMLElement).style.display = 'block';
    }
  });

  // Initialize password toggles
  passwordToggleCleanup = resetAndReinitializePasswordToggles(
    [
      { input: '#employee-password', toggle: '#employee-password-toggle' },
      { input: '#employee-password-confirm', toggle: '#employee-password-confirm-toggle' },
    ],
    passwordToggleCleanup,
  );

  // Show modal
  if (modal !== null) {
    modal.classList.add(MODAL_ACTIVE_CLASS);
  }

  // Load departments and teams, then restore selection
  setTimeout(() => {
    const w = window as WindowWithEmployeeHandlers;
    void (async () => {
      if (w.loadDepartmentsForEmployeeSelect !== undefined) {
        await w.loadDepartmentsForEmployeeSelect();
      }

      // Restore department selection (custom dropdown)
      if (departmentId !== undefined) {
        console.info('[showEditEmployeeModal] Restoring department selection:', departmentId);
        restoreDropdownValue('employee-department', 'department-trigger', 'department-menu', departmentId);
      }

      // Load teams
      await w.loadTeamsForEmployeeSelect?.();

      // Restore team selection (custom dropdown)
      if (teamId !== undefined) {
        console.info('[showEditEmployeeModal] Restoring team selection:', teamId);
        restoreDropdownValue('employee-team', 'team-trigger', 'team-menu', teamId);
      }
    })();
  }, 100);
}

/**
 * Close employee modal and cleanup
 * Following manage-admins closeAdminModal pattern
 */
export function closeEmployeeModal(): void {
  console.info('[closeEmployeeModal] Closing modal');

  const modal = $$id(SELECTORS.EMPLOYEE_MODAL);
  if (modal !== null) {
    modal.classList.remove(MODAL_ACTIVE_CLASS);
  }

  // Reset form to clear all fields (prevents old data from appearing in next modal)
  const form = $$id(SELECTORS.EMPLOYEE_FORM) as HTMLFormElement | null;
  if (form !== null) {
    form.reset();
  }

  // Reset custom dropdowns (form.reset() doesn't reset custom UI)
  resetCustomDropdowns();

  // Cleanup password toggle event listeners
  passwordToggleCleanup?.abort();
  passwordToggleCleanup = null;
}

/**
 * Show delete confirmation modal
 * Following manage-admins pattern
 * @param employeeId - Employee ID to delete
 * @param _employeeName - Employee name (reserved for future use in confirmation message)
 */
export function showDeleteModal(employeeId: number, _employeeName: string): void {
  console.info('[showDeleteModal] Opening delete modal for employee:', employeeId);

  const deleteModal = $$id(SELECTORS.DELETE_MODAL);
  const deleteIdInput = $$id(SELECTORS.DELETE_INPUT) as HTMLInputElement | null;

  if (deleteModal !== null && deleteIdInput !== null) {
    deleteIdInput.value = String(employeeId);
    deleteModal.classList.add(MODAL_ACTIVE_CLASS);
  }
}

/**
 * Close delete confirmation modal
 */
export function closeDeleteModal(): void {
  console.info('[closeDeleteModal] Closing delete modal');

  const deleteModal = $$id(SELECTORS.DELETE_MODAL);
  if (deleteModal !== null) {
    deleteModal.classList.remove(MODAL_ACTIVE_CLASS);
  }
}

// Note: Form submit handling (handleSaveEmployee) remains in index.ts
// because it needs access to EmployeesManager instance for API calls
