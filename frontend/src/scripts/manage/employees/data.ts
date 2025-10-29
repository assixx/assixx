/**
 * Employee Management - Data Layer
 * API calls, state management, and employee operations
 */

import { ApiClient } from '../../../utils/api-client';
import { $$id } from '../../../utils/dom-utils';
import { showErrorAlert } from '../../utils/alerts';
import type { Employee, IEmployeesManager, WindowWithEmployeeHandlers } from './types';
import { processFormField } from './ui';

// ===== GLOBAL STATE =====
// Note: employeesManager will be set from index.ts to avoid circular dependencies
let employeesManager: IEmployeesManager | null = null;

// State getter/setter (needed for import safety)
export function getEmployeesManager(): IEmployeesManager | null {
  return employeesManager;
}

export function setEmployeesManager(manager: IEmployeesManager): void {
  employeesManager = manager;
}

// ===== API CLIENT =====
export const apiClient = ApiClient.getInstance();

// ===== FORM DATA PROCESSING =====

/**
 * Validate password on form submit
 * Must match backend PasswordSchema: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/
 * Exported for use in forms.ts (live validation)
 */
export function validatePasswordOnSubmit(password: string): { valid: boolean; message: string } {
  // Check length
  if (password.length > 0 && password.length < 8) {
    return { valid: false, message: 'Passwort muss mindestens 8 Zeichen lang sein!' };
  }

  // Check complexity
  if (password.length > 0) {
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);

    if (!hasLowercase || !hasUppercase || !hasNumber) {
      return {
        valid: false,
        message: 'Passwort muss mindestens einen Großbuchstaben, einen Kleinbuchstaben und eine Zahl enthalten!',
      };
    }
  }

  return { valid: true, message: '' };
}

/**
 * Extract form data into a typed record object
 * @param form - The form element to extract data from
 * @param isUpdate - Whether this is an update (true) or create (false) operation
 */
function extractFormDataToRecord(form: HTMLFormElement, isUpdate: boolean): Record<string, unknown> {
  const formData = new FormData(form);
  const data: Record<string, unknown> = {};

  formData.forEach((value, key) => {
    if (typeof value === 'string') {
      processFormField(data, key, value, isUpdate);
    }
  });

  // Special handling: if availabilityStatus is 'available', set dates to null
  if (data.availabilityStatus === 'available') {
    data.availabilityStart = null;
    data.availabilityEnd = null;
  }

  return data;
}

/**
 * Validate required employee fields
 */
function validateRequiredEmployeeFields(data: Record<string, unknown>): { valid: boolean; message?: string } {
  if (
    typeof data.email !== 'string' ||
    data.email.length === 0 ||
    typeof data.firstName !== 'string' ||
    data.firstName.length === 0 ||
    typeof data.lastName !== 'string' ||
    data.lastName.length === 0
  ) {
    return { valid: false, message: 'Bitte füllen Sie alle Pflichtfelder aus' };
  }
  return { valid: true };
}

/**
 * Validate employee password if provided
 */
function validateEmployeePasswordField(data: Record<string, unknown>): { valid: boolean; message?: string } {
  if (typeof data.password === 'string' && data.password !== '') {
    const passwordValidation = validatePasswordOnSubmit(data.password);
    if (!passwordValidation.valid) {
      return { valid: false, message: passwordValidation.message };
    }
  }
  return { valid: true };
}

/**
 * Prepare employee data for save operation
 */
function prepareEmployeeDataForSave(data: Record<string, unknown>): void {
  data.role = 'employee';
  data.username = data.email;
  if (data.isActive !== undefined) {
    data.isActive = data.isActive === '1' || data.isActive === true;
  }
}

// ===== SAVE OPERATIONS =====

/**
 * Perform employee save operation and close modal
 */
async function performEmployeeSave(data: Record<string, unknown>, form: HTMLFormElement): Promise<void> {
  console.info('[saveEmployee] Starting save operation...');

  if (employeesManager?.currentEmployeeId !== null && employeesManager?.currentEmployeeId !== undefined) {
    console.info('[saveEmployee] Updating employee ID:', employeesManager.currentEmployeeId);
    await employeesManager.updateEmployee(employeesManager.currentEmployeeId, data as Partial<Employee>);
  } else {
    console.info('[saveEmployee] Creating new employee...');
    await employeesManager?.createEmployee(data as Partial<Employee>);
  }

  console.info('[saveEmployee] Save successful, closing modal...');
  const w = window as WindowWithEmployeeHandlers;
  w.hideEmployeeModal?.();
  form.reset();

  if (employeesManager !== null) {
    employeesManager.currentEmployeeId = null;
  }
}

/**
 * Save employee handler - orchestrates the save workflow
 */
export async function handleSaveEmployee(): Promise<void> {
  console.info('[saveEmployee] Function called');
  const form = $$id('employee-form');
  if (!(form instanceof HTMLFormElement)) {
    console.error('[saveEmployee] Form not found or not a form element');
    return;
  }
  console.info('[saveEmployee] Form found, processing data...');

  const isUpdate = employeesManager?.currentEmployeeId !== null && employeesManager?.currentEmployeeId !== undefined;
  const data = extractFormDataToRecord(form, isUpdate);

  const requiredValidation = validateRequiredEmployeeFields(data);
  if (!requiredValidation.valid) {
    showErrorAlert(requiredValidation.message ?? 'Validation error');
    return;
  }

  const passwordValidation = validateEmployeePasswordField(data);
  if (!passwordValidation.valid) {
    showErrorAlert(passwordValidation.message ?? 'Password validation error');
    return;
  }

  prepareEmployeeDataForSave(data);

  try {
    await performEmployeeSave(data, form);
  } catch (error) {
    console.error('Error saving employee:', error);
    employeesManager?.handleEmployeeSaveError(error);
  }
}

// ===== DROPDOWN LOADING =====

/**
 * Handle loading departments for employee select (custom dropdown)
 */
export async function handleLoadDepartments(): Promise<void> {
  const departments = await employeesManager?.loadDepartments();
  const menu = $$id('department-menu');

  if (menu !== null && departments !== undefined) {
    // Clear existing options and add default
    menu.innerHTML = '<div class="dropdown__option" data-value="">Keine Abteilung</div>';

    // Add department options
    departments.forEach((dept) => {
      const option = document.createElement('div');
      option.className = 'dropdown__option';
      option.dataset.value = dept.id.toString();
      option.textContent = dept.name;
      menu.append(option);
    });

    console.info('[EmployeesManager] Loaded departments:', departments.length);
  }
}

/**
 * Handle loading teams for employee select (custom dropdown)
 */
export async function handleLoadTeams(): Promise<void> {
  const teams = await employeesManager?.loadTeams();
  const deptInput = $$id('employee-department') as HTMLInputElement | null;
  const selectedDeptId = deptInput?.value;
  const menu = $$id('team-menu');

  if (menu !== null && teams !== undefined) {
    // Filter teams by department if one is selected
    let filteredTeams = teams;
    if (selectedDeptId !== undefined && selectedDeptId !== '' && selectedDeptId !== '0') {
      filteredTeams = teams.filter((team) => team.departmentId === Number.parseInt(selectedDeptId, 10));
    }

    // Clear existing options and add default
    menu.innerHTML = '<div class="dropdown__option" data-value="">Kein Team</div>';

    // Add team options
    filteredTeams.forEach((team) => {
      const option = document.createElement('div');
      option.className = 'dropdown__option';
      option.dataset.value = team.id.toString();
      option.textContent = team.name;
      menu.append(option);
    });

    console.info('[EmployeesManager] Loaded teams:', filteredTeams.length);
  }
}
