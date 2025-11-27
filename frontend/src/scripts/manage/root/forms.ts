/* eslint-disable max-lines */
/**
 * Root User Management - Forms Layer
 * Form handling, validation, modal logic
 */

import { $, $$, getData, setData, setHTML, $$id } from '../../../utils/dom-utils';
import { showSuccessAlert, showErrorAlert } from '../../utils/alerts';
import { resetPasswordToggles, resetAndReinitializePasswordToggles } from '../../../utils/password-toggle';
import { setupPasswordStrength, resetPasswordStrengthUI } from '../../../utils/password-strength-integration';
// Import from types
import type { RootUser, FormValues } from './types';
// Import from data layer
import {
  currentEditId,
  setCurrentEditId,
  saveRootUser,
  loadDepartments as loadDepartmentsAPI,
  allRootUsers,
} from './data';

// Field state classes for validation feedback (Design System)
const FIELD_STATE_ERROR = 'is-error';
const FIELD_STATE_SUCCESS = 'is-success';

// CSS Classes (prevent duplicate strings)
export const CSS_CLASSES = {
  MODAL_ACTIVE: 'modal-overlay--active',
} as const;

// Password toggle cleanup (prevent memory leaks)
let passwordToggleCleanup: AbortController | null = null;

// DOM Selectors (prevent duplicate strings)
export const SELECTORS = {
  ROOT_EMAIL: '#root-email',
  ROOT_EMAIL_CONFIRM: '#root-email-confirm',
  ROOT_PASSWORD: '#root-password',
  ROOT_PASSWORD_CONFIRM: '#root-password-confirm',
  ROOT_PASSWORD_TOGGLE: '#root-password-toggle',
  ROOT_PASSWORD_CONFIRM_TOGGLE: '#root-password-confirm-toggle',
  ROOT_EMPLOYEE_NUMBER: '#root-employee-number',
  EMAIL_ERROR: '#email-error',
  PASSWORD_ERROR: '#password-error',
} as const;

/**
 * Setup live email validation with visual feedback
 */
function setupEmailValidation(): void {
  const emailField = $$(SELECTORS.ROOT_EMAIL) as HTMLInputElement | null;
  const emailConfirmField = $$(SELECTORS.ROOT_EMAIL_CONFIRM) as HTMLInputElement | null;
  const emailError = $$(SELECTORS.EMAIL_ERROR);

  if (emailField !== null && emailConfirmField !== null && emailError !== null) {
    const validateEmails = (): void => {
      const email = emailField.value;
      const emailConfirm = emailConfirmField.value;

      if (emailConfirm !== '') {
        if (email !== emailConfirm) {
          emailError.classList.remove('u-hidden');
          emailField.classList.add(FIELD_STATE_ERROR);
          emailField.classList.remove(FIELD_STATE_SUCCESS);
          emailConfirmField.classList.add(FIELD_STATE_ERROR);
          emailConfirmField.classList.remove(FIELD_STATE_SUCCESS);
        } else {
          emailError.classList.add('u-hidden');
          emailField.classList.remove(FIELD_STATE_ERROR);
          emailField.classList.add(FIELD_STATE_SUCCESS);
          emailConfirmField.classList.remove(FIELD_STATE_ERROR);
          emailConfirmField.classList.add(FIELD_STATE_SUCCESS);
        }
      } else {
        emailError.classList.add('u-hidden');
        emailField.classList.remove(FIELD_STATE_ERROR, FIELD_STATE_SUCCESS);
        emailConfirmField.classList.remove(FIELD_STATE_ERROR, FIELD_STATE_SUCCESS);
      }
    };

    emailField.addEventListener('input', validateEmails);
    emailConfirmField.addEventListener('input', validateEmails);
  }
}

/**
 * Setup live password validation with visual feedback
 */
function setupPasswordValidation(): void {
  const passwordField = $$(SELECTORS.ROOT_PASSWORD) as HTMLInputElement | null;
  const passwordConfirmField = $$(SELECTORS.ROOT_PASSWORD_CONFIRM) as HTMLInputElement | null;
  const passwordError = $$(SELECTORS.PASSWORD_ERROR);

  if (passwordField !== null && passwordConfirmField !== null && passwordError !== null) {
    const validatePasswords = (): void => {
      const password = passwordField.value;
      const passwordConfirm = passwordConfirmField.value;

      if (passwordConfirm !== '') {
        const passwordsMatch = password.length === passwordConfirm.length && password === passwordConfirm;
        if (!passwordsMatch) {
          passwordError.classList.remove('u-hidden');
          passwordField.classList.add(FIELD_STATE_ERROR);
          passwordField.classList.remove(FIELD_STATE_SUCCESS);
          passwordConfirmField.classList.add(FIELD_STATE_ERROR);
          passwordConfirmField.classList.remove(FIELD_STATE_SUCCESS);
        } else {
          passwordError.classList.add('u-hidden');
          passwordField.classList.remove(FIELD_STATE_ERROR);
          passwordField.classList.add(FIELD_STATE_SUCCESS);
          passwordConfirmField.classList.remove(FIELD_STATE_ERROR);
          passwordConfirmField.classList.add(FIELD_STATE_SUCCESS);
        }
      } else {
        passwordError.classList.add('u-hidden');
        passwordField.classList.remove(FIELD_STATE_ERROR, FIELD_STATE_SUCCESS);
        passwordConfirmField.classList.remove(FIELD_STATE_ERROR, FIELD_STATE_SUCCESS);
      }
    };

    passwordField.addEventListener('input', validatePasswords);
    passwordConfirmField.addEventListener('input', validatePasswords);
  }
}

/**
 * Initialize validation listeners for email and password fields
 */
export function setupValidationListeners(): void {
  setupEmailValidation();
  setupPasswordValidation();

  // NOTE: Password toggle setup moved to showAddRootModal() and editRootUserHandler()
  // This ensures event listeners are properly re-attached each time the modal opens
  // (after being cleaned up by abort() in closeRootModal())
}

/**
 * Highlight field with error state and auto-remove after duration
 */
function highlightFieldError(selector: string, duration: number = 3000): void {
  const field = $$(selector) as HTMLInputElement | null;
  if (field !== null) {
    field.classList.add(FIELD_STATE_ERROR);
    field.focus();
    setTimeout(() => {
      field.classList.remove(FIELD_STATE_ERROR);
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

  if (errorCode === 'DUPLICATE_EMPLOYEE_NUMBER') {
    handleDuplicateFieldError(SELECTORS.ROOT_EMPLOYEE_NUMBER, 'Diese Personalnummer wird bereits verwendet!');
    return;
  }

  if (errorCode === 'DUPLICATE_EMAIL' || errorCode === 'DUPLICATE_USERNAME') {
    const message =
      errorCode === 'DUPLICATE_EMAIL'
        ? 'Diese E-Mail-Adresse wird bereits verwendet!'
        : 'Dieser Benutzername wird bereits verwendet!';
    handleDuplicateFieldError(SELECTORS.ROOT_EMAIL, message);
    return;
  }

  const lowerMessage = errorMessage.toLowerCase();
  if (lowerMessage.includes('employee') || lowerMessage.includes('personalnummer')) {
    handleDuplicateFieldError(SELECTORS.ROOT_EMPLOYEE_NUMBER, 'Diese Personalnummer wird bereits verwendet!');
    return;
  }

  if (lowerMessage.includes('email')) {
    handleDuplicateFieldError(SELECTORS.ROOT_EMAIL, 'Diese E-Mail-Adresse wird bereits verwendet!');
    return;
  }

  if (errorCode === 'DUPLICATE_ENTRY' || lowerMessage.includes('duplicate')) {
    showErrorAlert('Ein Root-Benutzer mit dieser E-Mail oder Personalnummer existiert bereits!');
    return;
  }

  showErrorAlert('Fehler beim Speichern: ' + (errorMessage !== '' ? errorMessage : 'Netzwerkfehler'));
}

/**
 * Load departments and populate dropdown
 */
export async function loadDepartments(): Promise<void> {
  try {
    const departments = await loadDepartmentsAPI();
    const departmentMenu = $('#department-menu');

    const firstOption = departmentMenu.querySelector('.dropdown__option[data-value=""]');
    setHTML(departmentMenu, '');
    if (firstOption !== null) {
      departmentMenu.appendChild(firstOption);
    }

    departments.forEach((dept) => {
      const option = document.createElement('div');
      option.className = 'dropdown__option';
      setData(option, 'value', dept.id.toString());
      setData(option, 'text', dept.name);
      option.textContent = dept.name;
      departmentMenu.appendChild(option);
    });
  } catch (error) {
    console.error('Failed to load departments:', error);
  }
}

/**
 * Get form values
 */
function getFormValues(): FormValues {
  return {
    firstName: ($('#root-first-name') as HTMLInputElement).value,
    lastName: ($('#root-last-name') as HTMLInputElement).value,
    email: ($(SELECTORS.ROOT_EMAIL) as HTMLInputElement).value,
    emailConfirm: ($$(SELECTORS.ROOT_EMAIL_CONFIRM) as HTMLInputElement | null)?.value ?? '',
    password: ($$(SELECTORS.ROOT_PASSWORD) as HTMLInputElement | null)?.value ?? '',
    passwordConfirm: ($$(SELECTORS.ROOT_PASSWORD_CONFIRM) as HTMLInputElement | null)?.value ?? '',
    position: ($('#root-position') as HTMLInputElement | null)?.value ?? '',
    notes: ($('#root-notes') as HTMLTextAreaElement | null)?.value ?? '',
    employeeNumber: ($$(SELECTORS.ROOT_EMPLOYEE_NUMBER) as HTMLInputElement | null)?.value ?? '',
    departmentId: ($('#root-department-id') as HTMLSelectElement | null)?.value ?? '',
    isActive: currentEditId !== null ? (($('#root-is-active') as HTMLInputElement | null)?.checked ?? false) : true,
  };
}

/**
 * Clear error messages and validation states
 */
function clearErrorMessages(): void {
  const emailField = $$(SELECTORS.ROOT_EMAIL) as HTMLInputElement | null;
  const emailConfirmField = $$(SELECTORS.ROOT_EMAIL_CONFIRM) as HTMLInputElement | null;
  const passwordField = $$(SELECTORS.ROOT_PASSWORD) as HTMLInputElement | null;
  const passwordConfirmField = $$(SELECTORS.ROOT_PASSWORD_CONFIRM) as HTMLInputElement | null;
  const employeeNumberField = $$(SELECTORS.ROOT_EMPLOYEE_NUMBER) as HTMLInputElement | null;

  emailField?.classList.remove(FIELD_STATE_ERROR, FIELD_STATE_SUCCESS);
  emailConfirmField?.classList.remove(FIELD_STATE_ERROR, FIELD_STATE_SUCCESS);
  passwordField?.classList.remove(FIELD_STATE_ERROR, FIELD_STATE_SUCCESS);
  passwordConfirmField?.classList.remove(FIELD_STATE_ERROR, FIELD_STATE_SUCCESS);
  employeeNumberField?.classList.remove(FIELD_STATE_ERROR, FIELD_STATE_SUCCESS);

  const emailError = $$(SELECTORS.EMAIL_ERROR);
  const passwordError = $$(SELECTORS.PASSWORD_ERROR);
  emailError?.classList.add('u-hidden');
  passwordError?.classList.add('u-hidden');
}

/**
 * Validate email fields
 */
function validateEmailFields(values: FormValues): boolean {
  if (values.email !== values.emailConfirm) {
    const emailError = $(SELECTORS.EMAIL_ERROR);
    emailError.classList.remove('u-hidden');
    showErrorAlert('E-Mail-Adressen stimmen nicht überein');
    return false;
  }
  return true;
}

/**
 * Validate password length
 */
function validatePasswordLength(password: string): boolean {
  if (password.length > 0 && password.length < 8) {
    showErrorAlert('Passwort muss mindestens 8 Zeichen lang sein');
    return false;
  }
  return true;
}

/**
 * Validate password complexity (uppercase, lowercase, number)
 * Must match backend PasswordSchema: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/
 */
function validatePasswordComplexity(password: string): boolean {
  if (password.length > 0) {
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);

    if (!hasLowercase || !hasUppercase || !hasNumber) {
      showErrorAlert('Passwort muss mindestens einen Großbuchstaben, einen Kleinbuchstaben und eine Zahl enthalten!');
      return false;
    }
  }
  return true;
}

/**
 * Validate password match
 */
function validatePasswordMatch(password: string, passwordConfirm: string): boolean {
  // eslint-disable-next-line security/detect-possible-timing-attacks -- Safe: client-side UX validation only, not comparing secrets
  if (password !== passwordConfirm) {
    const passwordError = $(SELECTORS.PASSWORD_ERROR);
    passwordError.classList.remove('u-hidden');
    showErrorAlert('Passwörter stimmen nicht überein');
    return false;
  }
  return true;
}

/**
 * Validate password fields for create mode (password required)
 */
function validatePasswordCreate(values: FormValues): boolean {
  if (!validatePasswordLength(values.password)) return false;
  if (!validatePasswordComplexity(values.password)) return false;
  if (!validatePasswordMatch(values.password, values.passwordConfirm)) return false;
  return true;
}

/**
 * Validate password fields for edit mode (password optional)
 */
function validatePasswordEdit(values: FormValues): boolean {
  const isPasswordProvided = values.password !== '' || values.passwordConfirm !== '';

  if (isPasswordProvided) {
    if (!validatePasswordLength(values.password)) return false;
    if (!validatePasswordComplexity(values.password)) return false;
    if (!validatePasswordMatch(values.password, values.passwordConfirm)) return false;
  }

  return true;
}

/**
 * Validate password fields
 */
function validatePasswordFields(values: FormValues, isEdit: boolean): boolean {
  return isEdit ? validatePasswordEdit(values) : validatePasswordCreate(values);
}

/**
 * Validate position field
 */
function validatePositionField(values: FormValues): boolean {
  if (values.position === '') {
    showErrorAlert('Bitte wählen Sie eine Position aus');
    return false;
  }
  return true;
}

/**
 * Validate form values
 */
function validateForm(values: FormValues, isEdit: boolean): boolean {
  if (!validateEmailFields(values)) return false;
  if (!validatePasswordFields(values, isEdit)) return false;
  if (!validatePositionField(values)) return false;
  return true;
}

/**
 * Generate a valid username from an email address
 * - Takes the part before @
 * - Replaces invalid characters with underscores
 * - Only allows letters, numbers, underscores, and hyphens
 * @param email - Email address to convert
 * @returns Valid username
 */
function generateUsernameFromEmail(email: string): string {
  // Take the part before @ (local part of email)
  const localPart = email.split('@')[0] ?? email;

  // Replace any character that's not a letter, number, underscore, or hyphen with underscore
  // This ensures the username matches the backend regex: /^[\w-]+$/
  return localPart.replace(/[^\w-]/g, '_');
}

/**
 * Build user data for API request
 */
function buildUserData(values: FormValues, isEdit: boolean): Record<string, unknown> {
  const userData: Record<string, unknown> = {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    position: values.position,
    notes: values.notes,
    isActive: values.isActive,
  };

  if (values.employeeNumber !== '') {
    userData['employeeNumber'] = values.employeeNumber;
  }

  if (values.departmentId !== '') {
    userData['departmentId'] = Number.parseInt(values.departmentId, 10);
  }

  // Password handling
  if (!isEdit) {
    // Create mode: password is required
    userData['password'] = values.password;
    userData['username'] = generateUsernameFromEmail(values.email);
  } else {
    // Edit mode: password is optional (only send if provided)
    if (values.password !== '' && values.password.length >= 8) {
      userData['password'] = values.password;
    }
  }

  return userData;
}

/**
 * Handle form submission
 */
export async function handleFormSubmit(event: Event, onSuccess: () => Promise<void>): Promise<void> {
  event.preventDefault();

  const values = getFormValues();
  clearErrorMessages();

  const isEdit = currentEditId !== null;
  if (!validateForm(values, isEdit)) {
    return;
  }

  const userData = buildUserData(values, isEdit);

  try {
    await saveRootUser(userData, isEdit, currentEditId);

    showSuccessAlert(isEdit ? 'Root-Benutzer aktualisiert' : 'Root-Benutzer erstellt');
    closeRootModal();
    await onSuccess();
  } catch (error) {
    handleSaveError(error);
  }
}

/**
 * Close root modal
 */
export function closeRootModal(): void {
  const modal = $('#root-modal');
  modal.classList.remove(CSS_CLASSES.MODAL_ACTIVE);
  setCurrentEditId(null);

  const form = $('#root-form') as HTMLFormElement;
  form.reset();

  clearErrorMessages();

  // Reset password inputs to default state (hidden)

  resetPasswordToggles([
    { input: SELECTORS.ROOT_PASSWORD, toggle: SELECTORS.ROOT_PASSWORD_TOGGLE },
    { input: SELECTORS.ROOT_PASSWORD_CONFIRM, toggle: SELECTORS.ROOT_PASSWORD_CONFIRM_TOGGLE },
  ]);

  // Reset password strength UI to prevent cached validation state
  resetPasswordStrengthUI({
    passwordFieldId: 'root-password',
    strengthContainerId: 'root-password-strength-container',
    feedbackContainerId: 'root-password-feedback',
  });

  // Cleanup password toggle event listeners to prevent memory leak
  passwordToggleCleanup?.abort();
  passwordToggleCleanup = null;
}

/**
 * Show add root modal
 */
export function showAddRootModal(): void {
  setCurrentEditId(null);

  const modalTitle = $('#root-modal-title') as HTMLElement | null;
  if (modalTitle !== null) {
    modalTitle.textContent = 'Root-Benutzer hinzufügen';
  }

  const form = $('#root-form') as HTMLFormElement;
  form.reset();

  const positionTrigger = $('#position-trigger');
  const positionTriggerSpan = positionTrigger.querySelector('span');
  if (positionTriggerSpan !== null) {
    positionTriggerSpan.textContent = 'Position auswählen...';
  }
  ($('#root-position') as HTMLInputElement).value = '';

  const departmentTrigger = $('#department-trigger');
  const departmentTriggerSpan = departmentTrigger.querySelector('span');
  if (departmentTriggerSpan !== null) {
    departmentTriggerSpan.textContent = 'Keine Abteilung zuweisen';
  }
  ($('#root-department-id') as HTMLInputElement).value = '';

  $('#password-group').classList.remove('u-hidden');
  $('#password-confirm-group').classList.remove('u-hidden');
  $('#email-confirm-group').classList.remove('u-hidden');
  $('#active-status-group').classList.add('u-hidden');

  clearErrorMessages();

  const modal = $('#root-modal');
  modal.classList.add(CSS_CLASSES.MODAL_ACTIVE);

  // Reset UI and re-initialize event listeners (global utility handles cleanup)
  passwordToggleCleanup = resetAndReinitializePasswordToggles(
    [
      { input: SELECTORS.ROOT_PASSWORD, toggle: SELECTORS.ROOT_PASSWORD_TOGGLE },
      { input: SELECTORS.ROOT_PASSWORD_CONFIRM, toggle: SELECTORS.ROOT_PASSWORD_CONFIRM_TOGGLE },
    ],
    passwordToggleCleanup,
  );

  // Setup password strength validation
  setupPasswordStrength({
    passwordFieldId: 'root-password',
    strengthContainerId: 'root-password-strength-container',
    strengthBarId: 'root-password-strength-bar',
    strengthLabelId: 'root-password-strength-label',
    strengthTimeId: 'root-password-strength-time',
    feedbackContainerId: 'root-password-feedback',
    feedbackWarningId: 'root-password-feedback-warning',
    feedbackSuggestionsId: 'root-password-feedback-suggestions',
    getUserInputs: () => {
      const firstName = ($$id('root-first-name') as HTMLInputElement | null)?.value ?? '';
      const lastName = ($$id('root-last-name') as HTMLInputElement | null)?.value ?? '';
      const email = ($$id('root-email') as HTMLInputElement | null)?.value ?? '';
      const employeeNumber = ($$id('root-employee-number') as HTMLInputElement | null)?.value ?? '';
      return [firstName, lastName, email, employeeNumber].filter((v) => v !== '');
    },
  });
}

/**
 * Populate basic form fields with user data
 */
function populateBasicFields(user: RootUser): void {
  ($('#root-first-name') as HTMLInputElement).value = user.firstName;
  ($('#root-last-name') as HTMLInputElement).value = user.lastName;
  ($(SELECTORS.ROOT_EMAIL) as HTMLInputElement).value = user.email;
  ($(SELECTORS.ROOT_EMAIL_CONFIRM) as HTMLInputElement).value = user.email;
  ($('#root-notes') as HTMLTextAreaElement).value = user.notes ?? '';

  const employeeNumberInput = $$(SELECTORS.ROOT_EMPLOYEE_NUMBER) as HTMLInputElement | null;
  if (employeeNumberInput !== null) {
    employeeNumberInput.value = user.employeeNumber ?? '';
  }
}

/**
 * Set department dropdown value and display
 */
function setDepartmentValue(departmentId: number): void {
  const departmentInput = $('#root-department-id') as HTMLInputElement;
  departmentInput.value = departmentId.toString();

  const departmentTrigger = $('#department-trigger');
  const departmentOption = document.querySelector(`.dropdown__option[data-value="${departmentId}"]`);

  if (departmentOption !== null) {
    const triggerSpan = departmentTrigger.querySelector('span');
    if (triggerSpan !== null) {
      const departmentEl = departmentOption as HTMLElement;
      triggerSpan.textContent = getData(departmentEl, 'text') ?? departmentOption.textContent;
    }
  }
}

/**
 * Set position dropdown value and display
 */
function setPositionValue(position: string): void {
  ($('#root-position') as HTMLInputElement).value = position;
  const positionTrigger = $('#position-trigger');
  const positionSpan = positionTrigger.querySelector('span');
  if (positionSpan !== null) {
    positionSpan.textContent = position.toUpperCase();
  }
}

/**
 * Configure form for edit mode
 */
function configureEditMode(isActive: boolean | number): void {
  // Show email/password fields in edit mode (Root can change them)
  $('#password-group').classList.remove('u-hidden');
  $('#password-confirm-group').classList.remove('u-hidden');
  $('#email-confirm-group').classList.remove('u-hidden');

  // Make password fields optional (only if changing)
  const passwordField = $(SELECTORS.ROOT_PASSWORD) as HTMLInputElement;
  const passwordConfirmField = $(SELECTORS.ROOT_PASSWORD_CONFIRM) as HTMLInputElement;
  passwordField.required = false;
  passwordConfirmField.required = false;

  // Clear password fields (don't show existing password for security)
  passwordField.value = '';
  passwordConfirmField.value = '';

  const activeStatusGroup = $('#active-status-group');
  activeStatusGroup.classList.remove('u-hidden');
  const checkbox = $('#root-is-active') as HTMLInputElement;
  checkbox.checked = Boolean(isActive);
}

/**
 * Edit root user handler
 */
export function editRootUserHandler(userId: number): void {
  setCurrentEditId(userId);

  // Find user in cached data
  const user = allRootUsers.find((u) => u.id === userId);

  if (user === undefined) {
    showErrorAlert('Benutzer nicht gefunden');
    return;
  }

  const modalTitle = $('#root-modal-title');
  modalTitle.textContent = 'Root-Benutzer bearbeiten';

  populateBasicFields(user);

  if (user.departmentId !== undefined) {
    setDepartmentValue(user.departmentId);
  }

  if (user.position !== undefined && user.position !== '') {
    setPositionValue(user.position);
  }

  configureEditMode(user.isActive);

  const modal = $('#root-modal');
  modal.classList.add(CSS_CLASSES.MODAL_ACTIVE);

  // Reset UI and re-initialize event listeners (global utility handles cleanup)
  passwordToggleCleanup = resetAndReinitializePasswordToggles(
    [
      { input: SELECTORS.ROOT_PASSWORD, toggle: SELECTORS.ROOT_PASSWORD_TOGGLE },
      { input: SELECTORS.ROOT_PASSWORD_CONFIRM, toggle: SELECTORS.ROOT_PASSWORD_CONFIRM_TOGGLE },
    ],
    passwordToggleCleanup,
  );

  // Setup password strength validation
  setupPasswordStrength({
    passwordFieldId: 'root-password',
    strengthContainerId: 'root-password-strength-container',
    strengthBarId: 'root-password-strength-bar',
    strengthLabelId: 'root-password-strength-label',
    strengthTimeId: 'root-password-strength-time',
    feedbackContainerId: 'root-password-feedback',
    feedbackWarningId: 'root-password-feedback-warning',
    feedbackSuggestionsId: 'root-password-feedback-suggestions',
    getUserInputs: () => {
      const firstName = ($$id('root-first-name') as HTMLInputElement | null)?.value ?? '';
      const lastName = ($$id('root-last-name') as HTMLInputElement | null)?.value ?? '';
      const email = ($$id('root-email') as HTMLInputElement | null)?.value ?? '';
      const employeeNumber = ($$id('root-employee-number') as HTMLInputElement | null)?.value ?? '';
      return [firstName, lastName, email, employeeNumber].filter((v) => v !== '');
    },
  });
}

/**
 * Setup single dropdown (position or department)
 */
export function setupSingleDropdown(dropdownId: string, triggerId: string, menuId: string, inputId: string): void {
  const trigger = $(`#${triggerId}`);
  const menu = $(`#${menuId}`);
  const input = $(`#${inputId}`) as HTMLInputElement;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.dropdown__trigger.active').forEach((t) => {
      if (t !== trigger) {
        t.classList.remove('active');
        const siblingMenu = t.nextElementSibling;
        if (siblingMenu !== null) siblingMenu.classList.remove('active');
      }
    });
    trigger.classList.toggle('active');
    menu.classList.toggle('active');
  });

  menu.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const option = target.closest('.dropdown__option');

    if (option === null || !(option instanceof HTMLElement)) {
      return;
    }

    const value = getData(option, 'value') ?? '';
    const text = getData(option, 'text') ?? option.textContent;

    input.value = value;

    const triggerSpan = trigger.querySelector('span');
    if (triggerSpan !== null) {
      triggerSpan.textContent = text;
    }

    trigger.classList.remove('active');
    menu.classList.remove('active');
  });

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const dropdown = $(`#${dropdownId}`);
    if (!dropdown.contains(target)) {
      trigger.classList.remove('active');
      menu.classList.remove('active');
    }
  });
}
