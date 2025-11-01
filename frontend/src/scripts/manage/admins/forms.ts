/* eslint-disable max-lines */
/**
 * Admin Management - Forms Layer
 * UI and form handling for admin management
 */

import { $, $$, $all, setHTML, setSafeHTML } from '../../../utils/dom-utils';
import { resetPasswordToggles, resetAndReinitializePasswordToggles } from '../../../utils/password-toggle';
import { showSuccessAlert, showErrorAlert } from '../../utils/alerts';
// Import from types
import type { Admin, AdminFormData, Department } from './types';
// Import from data layer
import {
  admins,
  tenants,
  currentAdminId,
  setCurrentAdminId,
  loadDepartments,
  loadDepartmentGroups,
  loadAdminPermissions,
  saveAdmin as saveAdminAPI,
  updateAdminPermissions,
} from './data';

// ===== CONSTANTS =====
const MODAL_ACTIVE_CLASS = 'modal-overlay--active';

// Password toggle cleanup (prevent memory leaks)
let passwordToggleCleanup: AbortController | null = null;

// ===== DOM ELEMENT SELECTORS =====
export const SELECTORS = {
  ADMIN_MODAL: '#admin-modal',
  MODAL_TITLE: '#admin-modal-title',
  ADMIN_EMAIL: '#admin-email',
  ADMIN_EMAIL_CONFIRM: '#admin-email-confirm',
  ADMIN_PASSWORD: '#admin-password',
  ADMIN_PASSWORD_CONFIRM: '#admin-password-confirm',
  ADMIN_POSITION: '#admin-position',
  ADMIN_STATUS: '#admin-status',
  ADMIN_EMPLOYEE_NUMBER: '#admin-employee-number',
  DEPARTMENT_SELECT: '#department-select',
  DEPARTMENT_SELECT_CONTAINER: '#department-select-container',
  PERMISSION_TYPE_RADIO: 'input[name="permission-type"]',
  PERMISSION_TYPE_CHECKED: 'input[name="permission-type"]:checked',
  EMAIL_ERROR: '#email-error',
  PASSWORD_ERROR: '#password-error',
} as const;

// ===== HELPER FUNCTIONS =====

/**
 * Initialize position custom dropdown
 * Sets up event listeners for the custom dropdown functionality
 */
export function initPositionDropdown(): void {
  const trigger = $$('#position-trigger');
  const menu = $$('#position-menu');
  const hiddenInput = $$(SELECTORS.ADMIN_POSITION) as HTMLInputElement | null;

  if (trigger === null || menu === null) {
    console.error('Position dropdown elements not found');
    return;
  }

  // Get options ONLY from position menu (not all dropdowns!)
  const options = menu.querySelectorAll('.dropdown__option');

  // Toggle menu on trigger click
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    trigger.classList.toggle('active');
    menu.classList.toggle('active');
  });

  // Handle option selection
  options.forEach((option) => {
    option.addEventListener('click', () => {
      // Cast to HTMLElement for dataset access
      const htmlOption = option as HTMLElement;
      const value = htmlOption.dataset.value ?? '';
      const text = htmlOption.textContent;

      // Update hidden input
      if (hiddenInput !== null) {
        hiddenInput.value = value;
      }

      // Update trigger text
      const triggerSpan = trigger.querySelector('span');
      if (triggerSpan !== null) {
        triggerSpan.textContent = text;
      }

      // Close menu
      menu.classList.remove('active');
      trigger.classList.remove('active');
    });
  });

  // Close menu on outside click
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!trigger.contains(target) && !menu.contains(target)) {
      menu.classList.remove('active');
      trigger.classList.remove('active');
    }
  });
}

/**
 * Initialize status custom dropdown
 * Sets up event listeners for the custom dropdown functionality with badge support
 */
export function initStatusDropdown(): void {
  const trigger = $$('#status-trigger');
  const menu = $$('#status-menu');
  const dropdown = $$('#status-dropdown');
  const hiddenInput = $$(SELECTORS.ADMIN_STATUS) as HTMLInputElement | null;

  if (trigger === null || menu === null || dropdown === null) {
    console.error('Status dropdown elements not found');
    return;
  }

  // Toggle menu on trigger click
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    trigger.classList.toggle('active');
    menu.classList.toggle('active');
  });

  // Handle option selection - use event delegation on menu
  menu.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const option = target.closest('.dropdown__option');

    if (option === null || !(option instanceof HTMLElement)) {
      return;
    }

    const value = option.dataset.value ?? '';
    // Get badge element from option
    const badge = option.querySelector('.badge');

    // Update hidden input
    if (hiddenInput !== null) {
      hiddenInput.value = value;
    }

    // Update trigger with badge
    const triggerSpan = trigger.querySelector('span');
    if (triggerSpan !== null && badge !== null) {
      // Clone the badge to preserve classes - using setSafeHTML for controlled HTML
      setSafeHTML(triggerSpan, badge.outerHTML);
    }

    // Close menu
    menu.classList.remove('active');
    trigger.classList.remove('active');
  });

  // Close menu on outside click
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!dropdown.contains(target)) {
      menu.classList.remove('active');
      trigger.classList.remove('active');
    }
  });
}

// Helper function to display position names
export function getPositionDisplay(position: string): string {
  const positionMap = new Map<string, string>([
    ['bereichsleiter', 'Bereichsleiter'],
    ['personalleiter', 'Personalleiter'],
    ['geschaeftsfuehrer', 'Geschäftsführer'],
    ['werksleiter', 'Werksleiter'],
    ['produktionsleiter', 'Produktionsleiter'],
    ['qualitaetsleiter', 'Qualitätsleiter'],
    ['it-leiter', 'IT-Leiter'],
    ['vertriebsleiter', 'Vertriebsleiter'],
    ['mitarbeiter', 'Mitarbeiter'],
  ]);
  return positionMap.get(position) ?? position;
}

/**
 * Get status badge HTML based on admin status
 * @param admin - Admin object with isActive and isArchived fields
 * @returns HTML string for status badge
 */
export function getStatusBadge(admin: Admin): string {
  // Check if admin is archived
  if (admin.isArchived === true) {
    return '<span class="badge badge--secondary">Archiviert</span>';
  }

  // Check if admin is active
  if (admin.isActive) {
    return '<span class="badge badge--success">Aktiv</span>';
  }

  // Default to inactive
  return '<span class="badge badge--warning">Inaktiv</span>';
}

/**
 * Get status value from admin object
 * @param admin - Admin object
 * @returns Status value string ('active', 'inactive', or 'archived')
 */
export function getStatusValue(admin: Admin): string {
  if (admin.isArchived === true) {
    return 'archived';
  }
  if (admin.isActive) {
    return 'active';
  }
  return 'inactive';
}

// Helper function to display departments badge with tooltip
export function getDepartmentsBadge(admin: Admin): string {
  console.info(`Getting badge for admin ${String(admin.id)}:`, {
    hasAllAccess: admin.hasAllAccess,
    departments: admin.departments,
    departmentCount: admin.departments ? admin.departments.length : 0,
  });

  if (admin.hasAllAccess === true) {
    return '<span class="badge badge-success">Alle Abteilungen</span>';
  }

  if (!admin.departments || admin.departments.length === 0) {
    return '<span class="badge badge-secondary">Keine Abteilungen</span>';
  }

  const count = admin.departments.length;
  const label = count === 1 ? 'Abteilung' : 'Abteilungen';

  // Build department names list for tooltip (newline separated)
  const departmentNames = admin.departments.map((dept) => dept.name).join('\n');

  // Return badge with data-tooltip attribute for auto-initialization
  return `<span class="badge badge-info" data-tooltip="${departmentNames}">${String(count)} ${label}</span>`;
}

// Load and populate departments in select
export async function loadAndPopulateDepartments(): Promise<void> {
  const departments = await loadDepartments();
  const deptSelect = $$(SELECTORS.DEPARTMENT_SELECT) as HTMLSelectElement | null;

  if (deptSelect !== null && departments.length > 0) {
    deptSelect.innerHTML = '';
    departments.forEach((dept) => {
      const option = document.createElement('option');
      option.value = dept.id.toString();
      option.textContent = dept.name;
      deptSelect.appendChild(option);
    });
  }
}

// Load and populate department groups
export async function loadAndPopulateDepartmentGroups(): Promise<void> {
  const groups: { id: number; name: string; departments?: Department[] }[] = await loadDepartmentGroups();
  const groupContainer = $$('#group-select-container');

  if (groupContainer !== null && groups.length > 0) {
    // Clear existing content
    groupContainer.innerHTML = '';

    // Create checkboxes for each group
    groups.forEach((group: { id: number; name: string; departments?: Department[] }) => {
      const label = document.createElement('label');
      label.className = 'checkbox-label';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'groupSelect';
      checkbox.value = group.id.toString();
      checkbox.className = 'checkbox-input';

      const span = document.createElement('span');
      span.textContent = group.name;

      label.appendChild(checkbox);
      label.appendChild(span);
      groupContainer.appendChild(label);
    });
  }
}

// Update tenant dropdown
export function updateTenantDropdown(): void {
  const select = $$('#admin-tenant') as HTMLSelectElement | null;
  if (select !== null) {
    setHTML(
      select,
      tenants
        .map((t) => `<option value="${String(t.id)}">${t.name ?? t.company_name ?? t.subdomain}</option>`)
        .join(''),
    );
  }
}

// ===== FORM VALIDATION =====

export function validateEmails(): boolean {
  const emailEl = $$(SELECTORS.ADMIN_EMAIL) as HTMLInputElement | null;
  const emailConfirmEl = $$(SELECTORS.ADMIN_EMAIL_CONFIRM) as HTMLInputElement | null;
  const email = emailEl !== null ? emailEl.value : '';
  const emailConfirm = emailConfirmEl !== null ? emailConfirmEl.value : '';
  const emailError = $$(SELECTORS.EMAIL_ERROR);

  if (email !== emailConfirm) {
    if (emailError) emailError.classList.remove('u-hidden');
    showErrorAlert('Die E-Mail-Adressen stimmen nicht überein!');
    return false;
  }
  if (emailError) emailError.classList.add('u-hidden');
  return true;
}

/**
 * Validate password length (min 8 characters)
 */
function validatePasswordLength(password: string, errorElement: HTMLElement | null): boolean {
  if (password.length > 0 && password.length < 8) {
    if (errorElement) errorElement.classList.remove('u-hidden');
    showErrorAlert('Passwort muss mindestens 8 Zeichen lang sein!');
    return false;
  }
  return true;
}

/**
 * Validate password complexity (uppercase, lowercase, number)
 * Must match backend PasswordSchema: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/
 */
function validatePasswordComplexity(password: string, errorElement: HTMLElement | null): boolean {
  if (password.length > 0) {
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);

    if (!hasLowercase || !hasUppercase || !hasNumber) {
      if (errorElement) errorElement.classList.remove('u-hidden');
      showErrorAlert('Passwort muss mindestens einen Großbuchstaben, einen Kleinbuchstaben und eine Zahl enthalten!');
      return false;
    }
  }
  return true;
}

/**
 * Validate password match
 */
function validatePasswordMatch(password: string, passwordConfirm: string, errorElement: HTMLElement | null): boolean {
  // eslint-disable-next-line security/detect-possible-timing-attacks -- Safe: client-side UX validation only, not comparing secrets
  if (password !== passwordConfirm) {
    if (errorElement) errorElement.classList.remove('u-hidden');
    showErrorAlert('Die Passwörter stimmen nicht überein!');
    return false;
  }
  return true;
}

/**
 * Validate passwords (optional in edit mode, required in create mode)
 */
export function validatePasswords(): boolean {
  const passwordEl = $$(SELECTORS.ADMIN_PASSWORD) as HTMLInputElement | null;
  const passwordConfirmEl = $$(SELECTORS.ADMIN_PASSWORD_CONFIRM) as HTMLInputElement | null;
  const password = passwordEl !== null ? passwordEl.value : '';
  const passwordConfirm = passwordConfirmEl !== null ? passwordConfirmEl.value : '';
  const passwordError = $$(SELECTORS.PASSWORD_ERROR);

  // Password is optional in edit mode, but if provided, must be valid
  const isPasswordProvided = password !== '' || passwordConfirm !== '';

  if (isPasswordProvided) {
    if (!validatePasswordLength(password, passwordError)) return false;
    if (!validatePasswordComplexity(password, passwordError)) return false;
    if (!validatePasswordMatch(password, passwordConfirm, passwordError)) return false;
  }

  if (passwordError) passwordError.classList.add('u-hidden');
  return true;
}

export function validatePosition(): boolean {
  const positionEl = $$(SELECTORS.ADMIN_POSITION) as HTMLInputElement | null;
  const position = positionEl !== null ? positionEl.value : '';

  if (position === '' || position.trim() === '') {
    showErrorAlert('Bitte wählen Sie eine Position aus!');
    return false;
  }
  return true;
}

// ===== FORM DATA HANDLING =====

export function getFormData(): AdminFormData {
  const firstNameEl = $$('#admin-first-name') as HTMLInputElement | null;
  const lastNameEl = $$('#admin-last-name') as HTMLInputElement | null;
  const emailEl = $$(SELECTORS.ADMIN_EMAIL) as HTMLInputElement | null;
  const email = emailEl !== null ? emailEl.value : '';
  const passwordEl = $$(SELECTORS.ADMIN_PASSWORD) as HTMLInputElement | null;
  const positionEl = $$(SELECTORS.ADMIN_POSITION) as HTMLInputElement | null;
  const employeeNumberEl = $$(SELECTORS.ADMIN_EMPLOYEE_NUMBER) as HTMLInputElement | null;
  const statusEl = $$(SELECTORS.ADMIN_STATUS) as HTMLInputElement | null;

  const formData: AdminFormData = {
    firstName: firstNameEl !== null ? firstNameEl.value : '',
    lastName: lastNameEl !== null ? lastNameEl.value : '',
    email,
    username: email,
    password: passwordEl !== null ? passwordEl.value : '',
    position: positionEl !== null ? positionEl.value : '',
    notes: ($('#admin-notes') as HTMLTextAreaElement).value,
    role: 'admin',
    employeeNumber: employeeNumberEl !== null ? employeeNumberEl.value : '',
  };

  // Map status dropdown to isActive and isArchived
  // 'active' → isActive = true, isArchived = false
  // 'inactive' → isActive = false, isArchived = false
  // 'archived' → isActive = false, isArchived = true
  const statusValue = statusEl !== null ? statusEl.value : 'active';
  console.info('Status dropdown value:', statusValue);
  formData.isActive = statusValue === 'active';
  formData.isArchived = statusValue === 'archived';

  // Remove empty password for updates
  if (
    currentAdminId !== null &&
    currentAdminId !== 0 &&
    (formData.password === undefined || formData.password === '')
  ) {
    delete formData.password;
  }

  return formData;
}

export async function getPermissionData(
  permissionType: string,
): Promise<{ departmentIds: number[]; groupIds: number[] }> {
  let departmentIds: number[] = [];
  let groupIds: number[] = [];

  if (permissionType === 'specific') {
    const select = $$(SELECTORS.DEPARTMENT_SELECT) as HTMLSelectElement | null;
    if (select !== null) {
      departmentIds = [...select.selectedOptions].map((opt) => Number.parseInt(opt.value, 10));
    }
  } else if (permissionType === 'groups') {
    const checkboxes = $all('input[name="groupSelect"]:checked');
    groupIds = [...checkboxes].map((checkbox) => Number.parseInt((checkbox as HTMLInputElement).value, 10));
  } else if (permissionType === 'all') {
    const allDepts = await loadDepartments();
    departmentIds = allDepts.map((d) => d.id);
  }

  return { departmentIds, groupIds };
}

export async function updatePermissions(adminId: number): Promise<void> {
  const permissionTypeInput = document.querySelector(SELECTORS.PERMISSION_TYPE_CHECKED);
  const permissionType = permissionTypeInput instanceof HTMLInputElement ? permissionTypeInput.value : undefined;
  console.info('🔵 Permission type selected:', permissionType);

  if (adminId === 0 || permissionType === undefined) return;

  const { departmentIds, groupIds } = await getPermissionData(permissionType);

  console.info('🔵 Setting department permissions for admin:', adminId);
  console.info('Department IDs:', departmentIds);

  await updateAdminPermissions(adminId, departmentIds, groupIds);
}

// ===== FORM UI HELPERS =====

export function fillAdminFormFields(admin: Admin): void {
  ($('#admin-first-name') as HTMLInputElement).value = admin.firstName;
  ($('#admin-last-name') as HTMLInputElement).value = admin.lastName;
  ($(SELECTORS.ADMIN_EMAIL) as HTMLInputElement).value = admin.email;
  ($(SELECTORS.ADMIN_EMAIL_CONFIRM) as HTMLInputElement).value = admin.email;
  ($(SELECTORS.ADMIN_EMPLOYEE_NUMBER) as HTMLInputElement).value = admin.employeeNumber ?? '';
  ($('#admin-notes') as HTMLTextAreaElement).value = admin.notes ?? '';
}

export function setPositionDropdown(positionValue: string): void {
  const positionInput = $$(SELECTORS.ADMIN_POSITION) as HTMLInputElement | null;
  const positionTrigger = $$('#position-trigger');

  if (positionInput !== null) {
    positionInput.value = positionValue;
  }

  // Update the display text
  if (positionTrigger !== null && positionValue !== '') {
    const displayText = getPositionDisplay(positionValue);
    const triggerSpan = positionTrigger.querySelector('span');
    if (triggerSpan !== null) {
      triggerSpan.textContent = displayText;
    }
  }
}

/**
 * Set status dropdown value and display
 * @param statusValue - Status value ('active', 'inactive', 'archived')
 */
export function setStatusDropdown(statusValue: string): void {
  const statusInput = $$(SELECTORS.ADMIN_STATUS) as HTMLInputElement | null;
  const statusTrigger = $$('#status-trigger');

  if (statusInput !== null) {
    statusInput.value = statusValue;
  }

  // Update the display badge
  if (statusTrigger !== null && statusValue !== '') {
    const triggerSpan = statusTrigger.querySelector('span');
    if (triggerSpan !== null) {
      // Set badge HTML based on status value - safe controlled template strings
      if (statusValue === 'active') {
        setSafeHTML(triggerSpan, '<span class="badge badge--success">Aktiv</span>');
      } else if (statusValue === 'inactive') {
        setSafeHTML(triggerSpan, '<span class="badge badge--warning">Inaktiv</span>');
      } else if (statusValue === 'archived') {
        setSafeHTML(triggerSpan, '<span class="badge badge--secondary">Archiviert</span>');
      }
    }
  }
}

export function setActiveStatus(isActive: boolean): void {
  const activeStatusGroup = $$('#active-status-group');
  if (activeStatusGroup) activeStatusGroup.style.display = 'block';

  const isActiveCheckbox = $('#admin-is-active') as HTMLInputElement;
  console.info('Setting checkbox for edit - isActive:', isActive);
  isActiveCheckbox.checked = isActive;
}

export function hideEditModeElements(): void {
  // Show email/password fields in edit mode (Admin can change them)
  // Only hide error messages
  const emailError = $$(SELECTORS.EMAIL_ERROR);
  const passwordError = $$(SELECTORS.PASSWORD_ERROR);

  if (emailError) emailError.classList.add('u-hidden');
  if (passwordError) passwordError.classList.add('u-hidden');

  // Ensure email/password groups are visible
  const emailConfirmGroup = $$('#email-confirm-group');
  const passwordGroup = $$('#password-group');
  const passwordConfirmGroup = $$('#password-confirm-group');

  if (emailConfirmGroup) emailConfirmGroup.style.display = '';
  if (passwordGroup) passwordGroup.style.display = '';
  if (passwordConfirmGroup) passwordConfirmGroup.style.display = '';
}

export async function setPermissionType(admin: Admin): Promise<void> {
  // Reset all permission type radio buttons
  $all(SELECTORS.PERMISSION_TYPE_RADIO).forEach((radio) => {
    (radio as HTMLInputElement).checked = false;
  });

  // Hide all containers first
  const deptContainer = $$(SELECTORS.DEPARTMENT_SELECT_CONTAINER);
  const groupContainer = $$('#group-select-container');
  if (deptContainer) deptContainer.style.display = 'none';
  if (groupContainer) groupContainer.style.display = 'none';

  if (admin.hasAllAccess === true) {
    setRadioButton('all');
  } else if (admin.departments !== undefined && admin.departments.length > 0) {
    setRadioButton('specific');
    await setupDepartmentSelection(admin, deptContainer);
  } else {
    setRadioButton('none');
  }
}

export function setRadioButton(value: string): void {
  const radio = document.querySelector(`input[name="permissionType"][value="${value}"]`);
  if (radio) {
    (radio as HTMLInputElement).checked = true;
    console.info(`✅ Set permission type to: ${value}`);
  }
}

export async function setupDepartmentSelection(admin: Admin, deptContainer: HTMLElement | null): Promise<void> {
  if (!deptContainer) return;

  deptContainer.style.display = 'block';
  await loadAndPopulateDepartments();

  const deptSelect = $$(SELECTORS.DEPARTMENT_SELECT) as HTMLSelectElement | null;
  if (!deptSelect) return;

  // Clear all selections first
  [...deptSelect.options].forEach((option) => (option.selected = false));

  // Select assigned departments
  if (admin.departments) {
    admin.departments.forEach((dept) => {
      const option = [...deptSelect.options].find((opt) => opt.value === dept.id.toString());
      if (option) {
        option.selected = true;
        console.info('✅ Selected department:', dept.name);
      }
    });
  }
}

export function setOptionalFields(): void {
  const fields = [
    { selector: SELECTORS.ADMIN_EMAIL_CONFIRM, type: 'input' },
    { selector: SELECTORS.ADMIN_PASSWORD, type: 'password' },
    { selector: SELECTORS.ADMIN_PASSWORD_CONFIRM, type: 'password' },
  ];

  fields.forEach(({ selector, type }) => {
    const field = $$(selector) as HTMLInputElement | null;
    if (!field) return;

    field.required = false;

    // Clear password fields for security (don't show existing password)
    if (type === 'password') {
      field.value = '';
    }

    // Clear email confirm field (will be re-entered by user)
    if (type === 'input' && selector === SELECTORS.ADMIN_EMAIL_CONFIRM) {
      field.value = '';
    }
  });
}

// ===== CLEAR/RESET FUNCTIONS =====

export function clearFormFields(): void {
  ($('#admin-first-name') as HTMLInputElement).value = '';
  ($('#admin-last-name') as HTMLInputElement).value = '';
  ($(SELECTORS.ADMIN_EMAIL) as HTMLInputElement).value = '';
  ($(SELECTORS.ADMIN_EMAIL_CONFIRM) as HTMLInputElement).value = '';
  ($(SELECTORS.ADMIN_PASSWORD) as HTMLInputElement).value = '';
  ($(SELECTORS.ADMIN_PASSWORD_CONFIRM) as HTMLInputElement).value = '';
  ($(SELECTORS.ADMIN_EMPLOYEE_NUMBER) as HTMLInputElement).value = '';
  ($('#admin-notes') as HTMLTextAreaElement).value = '';
  resetPositionDropdown();
  resetStatusDropdown();
  clearFieldValidationStates();
}

/**
 * Clear validation states from form fields
 * NOTE: Live validation is handled in index.ts (setupEmailValidation, setupPasswordValidation)
 */
export function clearFieldValidationStates(): void {
  const emailField = $$(SELECTORS.ADMIN_EMAIL);
  const emailConfirmField = $$(SELECTORS.ADMIN_EMAIL_CONFIRM);
  const passwordField = $$(SELECTORS.ADMIN_PASSWORD);
  const passwordConfirmField = $$(SELECTORS.ADMIN_PASSWORD_CONFIRM);

  // Remove validation classes
  emailField?.classList.remove('is-error', 'is-success');
  emailConfirmField?.classList.remove('is-error', 'is-success');
  passwordField?.classList.remove('is-error', 'is-success');
  passwordConfirmField?.classList.remove('is-error', 'is-success');

  // Hide error messages
  $$(SELECTORS.EMAIL_ERROR)?.classList.add('u-hidden');
  $$(SELECTORS.PASSWORD_ERROR)?.classList.add('u-hidden');
}

export function resetPositionDropdown(): void {
  const positionInput = $$(SELECTORS.ADMIN_POSITION) as HTMLInputElement | null;
  const positionTrigger = $$('#position-trigger');

  if (positionInput !== null) {
    positionInput.value = '';
  }

  // Reset display text
  if (positionTrigger !== null) {
    const triggerSpan = positionTrigger.querySelector('span');
    if (triggerSpan !== null) {
      triggerSpan.textContent = 'Bitte wählen...';
    }
  }
}

/**
 * Reset status dropdown to default (active)
 */
export function resetStatusDropdown(): void {
  const statusInput = $$(SELECTORS.ADMIN_STATUS) as HTMLInputElement | null;
  const statusTrigger = $$('#status-trigger');

  if (statusInput !== null) {
    statusInput.value = 'active';
  }

  // Reset display badge to active
  if (statusTrigger !== null) {
    const triggerSpan = statusTrigger.querySelector('span');
    if (triggerSpan !== null) {
      setSafeHTML(triggerSpan, '<span class="badge badge--success">Aktiv</span>');
    }
  }
}

export function resetFormVisibility(): void {
  const activeStatusGroup = $$('#active-status-group');
  if (activeStatusGroup) activeStatusGroup.style.display = 'none';

  const emailConfirmGroup = $$('#email-confirm-group');
  if (emailConfirmGroup) emailConfirmGroup.style.display = 'block';

  const passwordGroup = $$('#password-group');
  const passwordConfirmGroup = $$('#password-confirm-group');
  if (passwordGroup) passwordGroup.style.display = 'block';
  if (passwordConfirmGroup) passwordConfirmGroup.style.display = 'block';
}

export function resetErrorMessages(): void {
  const emailError = $$(SELECTORS.EMAIL_ERROR);
  const passwordError = $$(SELECTORS.PASSWORD_ERROR);
  if (emailError) emailError.classList.add('u-hidden');
  if (passwordError) passwordError.classList.add('u-hidden');
}

export function resetPermissionSettings(): void {
  $all(SELECTORS.PERMISSION_TYPE_RADIO).forEach((radio) => {
    (radio as HTMLInputElement).checked = false;
  });

  const deptContainer = $$(SELECTORS.DEPARTMENT_SELECT_CONTAINER);
  const groupContainer = $$('#group-select-container');
  if (deptContainer) deptContainer.style.display = 'none';
  if (groupContainer) groupContainer.style.display = 'none';

  const noneRadio = document.querySelector('input[name="permission-type"][value="none"]');
  if (noneRadio) {
    (noneRadio as HTMLInputElement).checked = true;
  }
}

export function resetModalUIElements(): void {
  resetPositionDropdown();
  resetFormVisibility();
  resetErrorMessages();
  resetPermissionSettings();
}

// ===== MODAL HANDLERS =====

export async function editAdminHandler(adminId: number): Promise<void> {
  setCurrentAdminId(adminId);
  const admin = admins.find((a) => String(a.id) === String(adminId));
  if (!admin) return;

  const title = $$(SELECTORS.MODAL_TITLE);
  if (title) title.textContent = 'Admin bearbeiten';

  fillAdminFormFields(admin);
  setPositionDropdown(admin.position ?? '');
  setStatusDropdown(getStatusValue(admin));
  hideEditModeElements();

  console.info('🔵 Loading department assignments for admin:', adminId);
  console.info('Admin departments:', admin.departments);
  console.info('Admin hasAllAccess:', admin.hasAllAccess);

  await setPermissionType(admin);
  setOptionalFields();

  const adminModal = $$('#admin-modal');
  adminModal?.classList.add(MODAL_ACTIVE_CLASS);

  // Reset UI and re-initialize event listeners (global utility handles cleanup)
  passwordToggleCleanup = resetAndReinitializePasswordToggles(
    [
      { input: '#admin-password', toggle: '#admin-password-toggle' },
      { input: '#admin-password-confirm', toggle: '#admin-password-confirm-toggle' },
    ],
    passwordToggleCleanup,
  );
}

export function showAddAdminModal(): void {
  console.info('showAddAdminModal called');
  setCurrentAdminId(null);
  const title = $$(SELECTORS.MODAL_TITLE);

  if (title) title.textContent = 'Neuen Administrator hinzufügen';

  clearFormFields();
  resetModalUIElements();

  // Set fields as required for new admin
  const emailConfirmField = $$(SELECTORS.ADMIN_EMAIL_CONFIRM) as HTMLInputElement | null;
  if (emailConfirmField !== null) {
    emailConfirmField.required = true;
  }

  const passwordField = $$(SELECTORS.ADMIN_PASSWORD) as HTMLInputElement | null;
  const passwordConfirmField = $$(SELECTORS.ADMIN_PASSWORD_CONFIRM) as HTMLInputElement | null;
  if (passwordField !== null) {
    passwordField.required = true;
  }
  if (passwordConfirmField !== null) {
    passwordConfirmField.required = true;
  }

  const adminModal = $$('#admin-modal');
  if (adminModal !== null) {
    console.info(`Opening modal - adding ${MODAL_ACTIVE_CLASS} class`);
    adminModal.classList.add(MODAL_ACTIVE_CLASS);
  } else {
    console.error('Modal #admin-modal not found!');
  }

  // Reset UI and re-initialize event listeners (global utility handles cleanup)
  passwordToggleCleanup = resetAndReinitializePasswordToggles(
    [
      { input: '#admin-password', toggle: '#admin-password-toggle' },
      { input: '#admin-password-confirm', toggle: '#admin-password-confirm-toggle' },
    ],
    passwordToggleCleanup,
  );
}

export function closeAdminModal(): void {
  const adminModal = $$('#admin-modal');
  adminModal?.classList.remove(MODAL_ACTIVE_CLASS);
  setCurrentAdminId(null);

  // Reset password inputs to default state (hidden)

  resetPasswordToggles([
    { input: '#admin-password', toggle: '#admin-password-toggle' },
    { input: '#admin-password-confirm', toggle: '#admin-password-confirm-toggle' },
  ]);

  // Cleanup password toggle event listeners to prevent memory leak
  passwordToggleCleanup?.abort();
  passwordToggleCleanup = null;
}

export function closePermissionsModal(): void {
  const modal = $$('#permissions-modal');
  if (modal) {
    modal.classList.remove(MODAL_ACTIVE_CLASS);
  }
}

// Show permissions modal
export async function showPermissionsModal(adminId: number): Promise<void> {
  console.info('showPermissionsModal called with admin ID:', adminId);

  const admin = admins.find((a) => a.id === adminId);
  if (!admin) {
    console.error('Admin not found:', adminId);
    return;
  }

  console.info('Found admin:', admin);

  // Update modal info
  const adminNameSpan = $$('#perm-admin-name');
  const adminEmailSpan = $$('#perm-admin-email');
  if (adminNameSpan) {
    adminNameSpan.textContent = `${admin.firstName} ${admin.lastName}`;
  }
  if (adminEmailSpan) {
    adminEmailSpan.textContent = admin.email;
  }

  // Store admin ID for save handler
  setCurrentAdminId(adminId);

  // Load current permissions
  const permissionsResponse = await loadAdminPermissions(adminId);
  console.info('Current permissions:', permissionsResponse);

  // Note: Permissions table building removed - HTML structure uses radio buttons for permission types
  // instead of individual department checkboxes. See permission-type radio handlers in index.ts

  // Show modal
  const modal = $$('#permissions-modal');
  if (modal) {
    modal.classList.add(MODAL_ACTIVE_CLASS);
  }
}

// Save permissions handler - updated for radio button based permissions
export async function savePermissionsHandler(): Promise<void> {
  if (currentAdminId === null) {
    console.error('No admin ID set');
    return;
  }

  try {
    // Update permissions based on selected type (radio buttons and department select)
    await updatePermissions(currentAdminId);
    showSuccessAlert('Berechtigungen aktualisiert');
    closePermissionsModal();
  } catch (error) {
    console.error('Error saving permissions:', error);
    showErrorAlert('Netzwerkfehler beim Speichern');
  }
}

// Form submit handling
/**
 * Highlight field with error state temporarily
 */
function highlightFieldError(selector: string, duration: number = 3000): void {
  const field = $$(selector) as HTMLInputElement | null;
  if (field !== null) {
    field.classList.add('is-error');
    field.focus();
    setTimeout(() => {
      field.classList.remove('is-error');
    }, duration);
  }
}

/**
 * Handle duplicate field error with visual feedback
 */
function handleDuplicateFieldError(fieldSelector: string, message: string): void {
  highlightFieldError(fieldSelector);
  showErrorAlert(message);
}

/**
 * Handle API errors and show specific error messages
 */
function handleSaveError(error: unknown): void {
  console.error('Save error:', error);

  const errorObj = error as { code?: string; message?: string; error?: string };
  const errorCode = errorObj.code;
  const errorMessage = errorObj.message ?? errorObj.error ?? '';

  // Check specific error codes first
  if (errorCode === 'DUPLICATE_EMPLOYEE_NUMBER') {
    handleDuplicateFieldError(SELECTORS.ADMIN_EMPLOYEE_NUMBER, 'Diese Personalnummer wird bereits verwendet!');
    return;
  }

  if (errorCode === 'DUPLICATE_EMAIL' || errorCode === 'DUPLICATE_USERNAME') {
    const message =
      errorCode === 'DUPLICATE_EMAIL'
        ? 'Diese E-Mail-Adresse wird bereits verwendet!'
        : 'Dieser Benutzername wird bereits verwendet!';
    handleDuplicateFieldError(SELECTORS.ADMIN_EMAIL, message);
    return;
  }

  // Fallback: Parse error message for backwards compatibility
  const lowerMessage = errorMessage.toLowerCase();
  if (lowerMessage.includes('employee') || lowerMessage.includes('personalnummer')) {
    handleDuplicateFieldError(SELECTORS.ADMIN_EMPLOYEE_NUMBER, 'Diese Personalnummer wird bereits verwendet!');
    return;
  }

  if (lowerMessage.includes('email')) {
    handleDuplicateFieldError(SELECTORS.ADMIN_EMAIL, 'Diese E-Mail-Adresse wird bereits verwendet!');
    return;
  }

  if (errorCode === 'DUPLICATE_ENTRY' || lowerMessage.includes('duplicate')) {
    showErrorAlert('Ein Administrator mit dieser E-Mail oder Personalnummer existiert bereits!');
    return;
  }

  // Generic error
  showErrorAlert('Fehler beim Speichern: ' + (errorMessage !== '' ? errorMessage : 'Netzwerkfehler'));
}

export async function handleFormSubmit(e: Event): Promise<void> {
  e.preventDefault();

  // Validate form
  if (!validateEmails()) return;
  if (!validatePasswords()) return;
  if (!validatePosition()) return;

  // Get form data
  const formData = getFormData();
  console.info('Sending form data:', formData);
  console.info('Current admin ID:', currentAdminId);
  console.info('isActive value being sent:', formData.isActive);

  try {
    // Save admin
    const adminId = await saveAdminAPI(formData);

    // Update permissions
    await updatePermissions(adminId);

    showSuccessAlert(
      currentAdminId !== null && currentAdminId !== 0 ? 'Administrator aktualisiert' : 'Administrator hinzugefügt',
    );
    closeAdminModal();
  } catch (error) {
    handleSaveError(error);
  }
}
