/* eslint-disable max-lines */
/**
 * Admin Management - Forms Layer
 * UI and form handling for admin management
 */

import { $, $$, setHTML, setSafeHTML, $$id } from '../../../utils/dom-utils';
import { resetPasswordToggles, resetAndReinitializePasswordToggles } from '../../../utils/password-toggle';
import { setupPasswordStrength, resetPasswordStrengthUI } from '../../../utils/password-strength-integration';
import { showSuccessAlert, showErrorAlert } from '../../utils/alerts';
// Import from types
import type { Admin, AdminFormData } from './types';
// Import from data layer
import {
  admins,
  tenants,
  currentAdminId,
  setCurrentAdminId,
  saveAdmin as saveAdminAPI,
  updateAdminPermissions,
  updateUserAreaPermissions,
  setUserFullAccess,
  // N:M REFACTORING: New helpers for form multi-selects
  getMultiSelectValues,
  setMultiSelectValues,
  loadAreasForAdminForm,
  loadDepartmentsForAdminForm,
  // NOTE: loadTeamsForAdminForm removed - Admins get teams via inheritance
  // Area → Department filter
  filterDepartmentsBySelectedAreas,
  // NOTE: filterTeamsBySelectedDepartmentsAndAreas removed - not needed anymore
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
  ADMIN_IS_ACTIVE: '#admin-is-active',
  ADMIN_IS_ARCHIVED: '#admin-is-archived',
  ADMIN_EMPLOYEE_NUMBER: '#admin-employee-number',
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
      const value = htmlOption.dataset['value'] ?? '';
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
 * Maps UI values (active/inactive/archived) to DB fields (isActive + isArchived)
 */
export function initStatusDropdown(): void {
  const trigger = $$('#status-trigger');
  const menu = $$('#status-menu');
  const dropdown = $$('#status-dropdown');
  const isActiveInput = $$(SELECTORS.ADMIN_IS_ACTIVE) as HTMLInputElement | null;
  const isArchivedInput = $$(SELECTORS.ADMIN_IS_ARCHIVED) as HTMLInputElement | null;

  if (trigger === null || menu === null || dropdown === null) {
    console.error('Status dropdown elements not found');
    return;
  }

  if (isActiveInput === null || isArchivedInput === null) {
    console.error('Status hidden inputs not found');
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

    const value = option.dataset['value'] ?? '';
    // Get badge element from option
    const badge = option.querySelector('.badge');

    // Map UI value to DB fields (isActive + isArchived)
    switch (value) {
      case 'active':
        isActiveInput.value = '1';
        isArchivedInput.value = '0';
        break;
      case 'inactive':
        isActiveInput.value = '0';
        isArchivedInput.value = '0';
        break;
      case 'archived':
        isActiveInput.value = '0';
        isArchivedInput.value = '1';
        break;
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
  if (admin.isArchived) {
    return '<span class="badge badge--error">Archiviert</span>';
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
  if (admin.isArchived) {
    return 'archived';
  }
  if (admin.isActive) {
    return 'active';
  }
  return 'inactive';
}

/** Check if admin has full access (helper to reduce complexity) */
function checkFullAccess(admin: Admin): boolean {
  return admin.hasFullAccess === true || admin.hasFullAccess === 1;
}

/** Get department label based on count */
function getDeptLabel(count: number, short: boolean): string {
  if (short) return count === 1 ? 'Abtlg.' : 'Abtlgn.';
  return count === 1 ? 'Abteilung' : 'Abteilungen';
}

/** Get area label based on count */
function getAreaLabel(count: number): string {
  return count === 1 ? 'Bereich' : 'Bereiche';
}

/**
 * Get departments badge HTML for admin table
 * BADGE-INHERITANCE-DISPLAY: Shows inherited departments when admin has area permissions
 */
export function getDepartmentsBadge(admin: Admin): string {
  const deptCount = admin.departments?.length ?? 0;
  const areaCount = admin.areas?.length ?? 0;

  if (checkFullAccess(admin)) {
    return '<span class="badge badge--primary" title="Voller Zugriff auf alle Abteilungen"><i class="fas fa-globe mr-1"></i>Alle</span>';
  }

  // Has direct departments AND areas (direct + inherited)
  if (deptCount > 0 && areaCount > 0) {
    const deptNames = admin.departments?.map((d) => d.name).join(', ') ?? '';
    return `<span class="badge badge--info" title="Direkt: ${deptNames} + Vererbt von ${areaCount} ${getAreaLabel(areaCount)}">${deptCount} ${getDeptLabel(deptCount, true)} + Vererbt</span>`;
  }

  // Has only direct departments
  if (deptCount > 0) {
    const deptNames = admin.departments?.map((d) => d.name).join(', ') ?? '';
    return `<span class="badge badge--info" title="${deptNames}">${deptCount} ${getDeptLabel(deptCount, false)}</span>`;
  }

  // Has areas but no direct departments (inherited via area)
  if (areaCount > 0) {
    const areaNames = admin.areas?.map((a) => a.name).join(', ') ?? '';
    return `<span class="badge badge--info" title="Abteilungen werden vererbt von: ${areaNames}"><i class="fas fa-sitemap mr-1"></i>Vererbt</span>`;
  }

  return '<span class="badge badge--secondary" title="Keine Abteilung zugewiesen">Keine</span>';
}

/**
 * Get areas badge HTML for admin table
 * Shows count with tooltip listing area names
 */
export function getAreasBadge(admin: Admin): string {
  const hasFullAccess = admin.hasFullAccess === true || admin.hasFullAccess === 1;

  // Full access = "Alle" badge
  if (hasFullAccess) {
    return '<span class="badge badge--primary" title="Voller Zugriff auf alle Bereiche"><i class="fas fa-globe mr-1"></i>Alle</span>';
  }

  // No areas assigned
  if (!admin.areas || admin.areas.length === 0) {
    return '<span class="badge badge--secondary" title="Keine Bereiche zugewiesen">Keine</span>';
  }

  // Show area count with tooltip
  const count = admin.areas.length;
  const label = count === 1 ? 'Bereich' : 'Bereiche';
  const areaNames = admin.areas.map((area) => area.name).join(', ');

  return `<span class="badge badge--info" title="${areaNames}">${String(count)} ${label}</span>`;
}

/**
 * Get teams badge HTML for admin table
 * NOTE: Admin teams are inherited via Area/Department, not directly assigned
 * This function shows inheritance info based on area/department permissions
 * INHERITANCE-FIX: Now shows actual area/department names in tooltip
 */
export function getTeamsBadge(admin: Admin): string {
  const hasFullAccess = admin.hasFullAccess === true || admin.hasFullAccess === 1;

  // Full access = "Alle" badge
  if (hasFullAccess) {
    return '<span class="badge badge--primary" title="Voller Zugriff auf alle Teams"><i class="fas fa-globe mr-1"></i>Alle</span>';
  }

  // Check if admin has area or department permissions (teams inherited from these)
  const hasAreas = (admin.areas?.length ?? 0) > 0;
  const hasDepts = (admin.departments?.length ?? 0) > 0;

  if (hasAreas || hasDepts) {
    // INHERITANCE-FIX: Build detailed tooltip with actual names
    const parts: string[] = [];
    if (hasAreas) {
      const areaNames = admin.areas?.map((a) => a.name).join(', ') ?? '';
      parts.push(`Bereiche: ${areaNames}`);
    }
    if (hasDepts) {
      const deptNames = admin.departments?.map((d) => d.name).join(', ') ?? '';
      parts.push(`Abteilungen: ${deptNames}`);
    }
    const tooltip = `Teams vererbt von: ${parts.join(' | ')}`;
    return `<span class="badge badge--info" title="${tooltip}"><i class="fas fa-sitemap mr-1"></i>Vererbt</span>`;
  }

  // No areas or departments = no team access
  return '<span class="badge badge--secondary" title="Keine Teams zugewiesen">Keine</span>';
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

/**
 * Get username from email
 * IMPORTANT: Backend sets username = email (lowercase) always
 * This function just returns the lowercase email for consistency
 * The backend ignores any username sent and uses the email instead
 * @param email - Email address
 * @returns Lowercase email (used as username in backend)
 */
function getUsernameFromEmail(email: string): string {
  // Backend ALWAYS sets username = email (lowercase)
  // We send email as username for consistency, but it's ignored anyway
  return email.toLowerCase().trim();
}

/**
 * Get input value with null safety
 */
function getInputValue(selector: string): string {
  const el = $$(selector) as HTMLInputElement | null;
  return el?.value ?? '';
}

/**
 * Get organization assignment data from form
 * N:M REFACTORING: Extracted to reduce cognitive complexity
 */
function getOrganizationFormData(): {
  hasFullAccess: boolean;
  areaIds: number[];
  departmentIds: number[];
} {
  const fullAccessToggle = $$id('admin-full-access') as HTMLInputElement | null;
  const hasFullAccess = fullAccessToggle?.checked ?? false;

  // If full access, send empty arrays (full access = all)
  // NOTE: teamIds removed - Admins get teams via inheritance (Area → Dept → Team)
  const areaIds = hasFullAccess ? [] : getMultiSelectValues('admin-areas');
  const departmentIds = hasFullAccess ? [] : getMultiSelectValues('admin-departments');

  console.info('[getOrganizationFormData] N:M data:', { hasFullAccess, areaIds, departmentIds });
  return { hasFullAccess, areaIds, departmentIds };
}

export function getFormData(): AdminFormData {
  const email = getInputValue(SELECTORS.ADMIN_EMAIL);
  // Read from hidden inputs (set by status dropdown)
  const isActiveEl = $$(SELECTORS.ADMIN_IS_ACTIVE) as HTMLInputElement | null;
  const isArchivedEl = $$(SELECTORS.ADMIN_IS_ARCHIVED) as HTMLInputElement | null;
  const isActiveValue = isActiveEl?.value ?? '1';
  const isArchivedValue = isArchivedEl?.value ?? '0';

  const formData: AdminFormData = {
    firstName: getInputValue('#admin-first-name'),
    lastName: getInputValue('#admin-last-name'),
    email,
    // NOTE: username is optional and IGNORED by backend (username = email always)
    // We send it for API compatibility but backend overwrites it
    username: getUsernameFromEmail(email),
    password: getInputValue(SELECTORS.ADMIN_PASSWORD),
    position: getInputValue(SELECTORS.ADMIN_POSITION),
    notes: ($('#admin-notes') as HTMLTextAreaElement).value,
    role: 'admin',
    employeeNumber: getInputValue(SELECTORS.ADMIN_EMPLOYEE_NUMBER),
    isActive: isActiveValue === '1',
    isArchived: isArchivedValue === '1',
  };

  // N:M REFACTORING: Add organization assignment data
  // NOTE: teamIds removed - Admins get teams via inheritance
  const orgData = getOrganizationFormData();
  formData.hasFullAccess = orgData.hasFullAccess;
  formData.areaIds = orgData.areaIds;
  formData.departmentIds = orgData.departmentIds;

  // Remove empty password for updates
  const isUpdate = currentAdminId !== null && currentAdminId !== 0;
  if (isUpdate && (formData.password === undefined || formData.password === '')) {
    delete formData.password;
  }

  return formData;
}

// ===== FORM UI HELPERS =====

/**
 * Initialize password strength validation for admin form
 * Extracted to reduce duplication between edit and add modal functions
 */
function initAdminPasswordStrength(): void {
  setupPasswordStrength({
    passwordFieldId: 'admin-password',
    strengthContainerId: 'admin-password-strength-container',
    strengthBarId: 'admin-password-strength-bar',
    strengthLabelId: 'admin-password-strength-label',
    strengthTimeId: 'admin-password-strength-time',
    feedbackContainerId: 'admin-password-feedback',
    feedbackWarningId: 'admin-password-feedback-warning',
    feedbackSuggestionsId: 'admin-password-feedback-suggestions',
    getUserInputs: () => {
      const firstName = ($$id('admin-first-name') as HTMLInputElement | null)?.value ?? '';
      const lastName = ($$id('admin-last-name') as HTMLInputElement | null)?.value ?? '';
      const email = ($$id('admin-email') as HTMLInputElement | null)?.value ?? '';
      return [firstName, lastName, email].filter((v) => v !== '');
    },
  });
}

export function fillAdminFormFields(admin: Admin): void {
  ($('#admin-first-name') as HTMLInputElement).value = admin.firstName ?? '';
  ($('#admin-last-name') as HTMLInputElement).value = admin.lastName ?? '';
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
 * Get status badge HTML by status value
 */
function getStatusBadgeHtml(statusValue: string): string {
  switch (statusValue) {
    case 'inactive':
      return '<span class="badge badge--warning">Inaktiv</span>';
    case 'archived':
      return '<span class="badge badge--error">Archiviert</span>';
    default:
      return '<span class="badge badge--success">Aktiv</span>';
  }
}

/**
 * Update hidden inputs for status (isActive + isArchived)
 */
function updateStatusHiddenInputs(
  statusValue: string,
  isActiveInput: HTMLInputElement,
  isArchivedInput: HTMLInputElement,
): void {
  switch (statusValue) {
    case 'inactive':
      isActiveInput.value = '0';
      isArchivedInput.value = '0';
      break;
    case 'archived':
      isActiveInput.value = '0';
      isArchivedInput.value = '1';
      break;
    default: // active
      isActiveInput.value = '1';
      isArchivedInput.value = '0';
  }
}

/**
 * Set status dropdown value and display
 * Maps UI value to DB fields (isActive + isArchived)
 * @param statusValue - Status value ('active', 'inactive', 'archived')
 */
export function setStatusDropdown(statusValue: string): void {
  const isActiveInput = $$(SELECTORS.ADMIN_IS_ACTIVE) as HTMLInputElement | null;
  const isArchivedInput = $$(SELECTORS.ADMIN_IS_ARCHIVED) as HTMLInputElement | null;
  const statusTrigger = $$('#status-trigger');

  // Map UI value to DB fields
  if (isActiveInput !== null && isArchivedInput !== null) {
    updateStatusHiddenInputs(statusValue, isActiveInput, isArchivedInput);
  }

  // Update the display badge
  if (statusTrigger === null || statusValue === '') return;

  const triggerSpan = statusTrigger.querySelector('span');
  if (triggerSpan !== null) {
    setSafeHTML(triggerSpan, getStatusBadgeHtml(statusValue));
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

    // Note: Email confirm field is NOT cleared here
    // - In edit mode: It's pre-populated with the existing email by fillAdminFormFields()
    // - In add mode: It's already cleared by clearFormFields()
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
  const isActiveInput = $$(SELECTORS.ADMIN_IS_ACTIVE) as HTMLInputElement | null;
  const isArchivedInput = $$(SELECTORS.ADMIN_IS_ARCHIVED) as HTMLInputElement | null;
  const statusTrigger = $$('#status-trigger');

  // Reset to active state (isActive=1, isArchived=0)
  if (isActiveInput !== null) {
    isActiveInput.value = '1';
  }
  if (isArchivedInput !== null) {
    isArchivedInput.value = '0';
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

export function resetModalUIElements(): void {
  resetPositionDropdown();
  resetFormVisibility();
  resetErrorMessages();

  // Reset password strength UI to prevent cached validation state
  resetPasswordStrengthUI({
    passwordFieldId: 'admin-password',
    strengthContainerId: 'admin-password-strength-container',
    feedbackContainerId: 'admin-password-feedback',
  });
}

// ===== MODAL HANDLERS =====

// N:M REFACTORING: Constants and helper functions for organization selects
const OPACITY_REDUCED_CLASS = 'opacity-50';

/**
 * Set disabled state for a select element
 */
function setSelectDisabled(selectId: string, disabled: boolean): void {
  const select = $$id(selectId) as HTMLSelectElement | null;
  if (select !== null) select.disabled = disabled;
}

/**
 * Toggle opacity class on container element
 */
function setContainerOpacity(containerId: string, reduced: boolean): void {
  const container = $$id(containerId);
  if (reduced) {
    container?.classList.add(OPACITY_REDUCED_CLASS);
  } else {
    container?.classList.remove(OPACITY_REDUCED_CLASS);
  }
}

/**
 * Apply visual state to organization selects based on full access mode
 * N:M REFACTORING: Extracted to reduce duplication
 */
function applyOrganizationSelectsVisual(hasFullAccess: boolean): void {
  // Update select disabled states
  setSelectDisabled('admin-areas', hasFullAccess);
  setSelectDisabled('admin-departments', hasFullAccess);
  setSelectDisabled('admin-teams', hasFullAccess);

  // Update container opacity states
  setContainerOpacity('admin-area-select-container', hasFullAccess);
  setContainerOpacity('admin-department-select-container', hasFullAccess);
  setContainerOpacity('admin-team-select-container', hasFullAccess);
}

/**
 * Load and restore organization selections for editing
 * N:M REFACTORING: Extracted to reduce function size
 *
 * Order matters:
 * 1. Load all data (areas, departments) - NOTE: teams removed (inherited)
 * 2. Restore area selections
 * 3. Filter departments (hide those covered by selected areas)
 * 4. Restore department selections (only for remaining visible departments)
 */
async function loadAndRestoreOrganizationSelections(admin: Admin): Promise<void> {
  await loadAreasForAdminForm();
  await loadDepartmentsForAdminForm();
  // NOTE: loadTeamsForAdminForm removed - Admins get teams via inheritance

  const areaIds = admin.areaIds ?? admin.areas?.map((a) => a.id) ?? [];
  const departmentIds = admin.departmentIds ?? admin.departments?.map((d) => d.id) ?? [];
  const hasFullAccess = admin.hasFullAccess === true || admin.hasFullAccess === 1;

  console.info('[loadAndRestoreOrganizationSelections] Restoring:', { areaIds, departmentIds, hasFullAccess });

  // 1. Restore area selections FIRST
  if (areaIds.length > 0) {
    setMultiSelectValues('admin-areas', areaIds);
  }

  // 2. Filter departments based on selected areas
  // This hides departments that are already covered by area inheritance
  filterDepartmentsBySelectedAreas();

  // 3. Restore department selections (only visible departments)
  if (departmentIds.length > 0) {
    setMultiSelectValues('admin-departments', departmentIds);
  }
  // NOTE: Team filtering/restoring removed - Admins get teams via inheritance
}

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

  // Setup password strength validation
  initAdminPasswordStrength();

  // N:M REFACTORING: Set full access toggle and apply visual state
  const fullAccessToggle = $$id('admin-full-access') as HTMLInputElement | null;
  const hasFullAccess = admin.hasFullAccess === true || admin.hasFullAccess === 1;
  if (fullAccessToggle !== null) {
    fullAccessToggle.checked = hasFullAccess;
  }
  applyOrganizationSelectsVisual(hasFullAccess);

  // Load areas and departments, then restore selections
  await loadAndRestoreOrganizationSelections(admin);
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

  // Setup password strength validation
  initAdminPasswordStrength();

  // N:M REFACTORING: Reset and load organization selects
  const fullAccessToggle = $$id('admin-full-access') as HTMLInputElement | null;
  if (fullAccessToggle !== null) {
    fullAccessToggle.checked = false;
  }
  applyOrganizationSelectsVisual(false); // Reset to enabled state

  // Load organization data and apply filters after all data is loaded
  // NOTE: Teams removed - Admins get teams via inheritance
  void (async () => {
    await loadAreasForAdminForm();
    await loadDepartmentsForAdminForm();
    // Filter departments: hide those that belong to selected areas (none selected in add mode)
    filterDepartmentsBySelectedAreas();
  })();
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

/**
 * Update N:M organization permissions for an admin
 * N:M REFACTORING: Extracted to reduce cognitive complexity
 */
async function updateOrganizationPermissions(adminId: number, formData: AdminFormData): Promise<void> {
  // 1. Update has_full_access flag
  await setUserFullAccess(adminId, formData.hasFullAccess ?? false);

  // 2. Update area permissions (only if not full access)
  if (formData.hasFullAccess !== true) {
    const areaIds = formData.areaIds ?? [];
    await updateUserAreaPermissions(adminId, areaIds);
  }

  // 3. Update department permissions (only if not full access)
  if (formData.hasFullAccess !== true) {
    const departmentIds = formData.departmentIds ?? [];
    await updateAdminPermissions(adminId, departmentIds, []);
  }

  console.info('[updateOrganizationPermissions] N:M permissions updated:', {
    adminId,
    hasFullAccess: formData.hasFullAccess,
    areaIds: formData.areaIds,
    departmentIds: formData.departmentIds,
  });
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

    // N:M REFACTORING: Update organization permissions
    // This handles has_full_access, areas, and departments
    await updateOrganizationPermissions(adminId, formData);

    // NOTE: Legacy updatePermissions() removed - it was overwriting N:M permissions
    // with empty arrays because it reads from radio buttons that no longer exist

    const isUpdate = currentAdminId !== null && currentAdminId !== 0;
    showSuccessAlert(isUpdate ? 'Administrator aktualisiert' : 'Administrator hinzugefügt');
    closeAdminModal();
  } catch (error) {
    handleSaveError(error);
  }
}
