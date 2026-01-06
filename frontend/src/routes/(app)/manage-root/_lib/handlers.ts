// =============================================================================
// MANAGE ROOT - EVENT HANDLERS
// =============================================================================

import { showWarningAlert, showErrorAlert } from '$lib/stores/toast.js';
import type { RootUser, StatusFilter, FormIsActiveStatus } from './types';
import { applyAllFilters } from './filters';
import {
  calculatePasswordStrength,
  populateFormFromUser,
  getDefaultFormValues,
  validateEmailMatch,
  validatePasswordMatch,
} from './utils';
import { buildRootUserPayload, loadRootUsers, saveRootUser, deleteRootUser } from './api';
import { MESSAGES } from './constants';

// =============================================================================
// TYPES
// =============================================================================

export interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  emailConfirm: string;
  password: string;
  passwordConfirm: string;
  employeeNumber: string;
  position: string;
  notes: string;
  isActive: FormIsActiveStatus;
}

export interface ValidationState {
  emailError: boolean;
  passwordError: boolean;
}

export interface PasswordStrengthState {
  score: number;
  label: string;
  time: string;
}

// =============================================================================
// FILTER HANDLERS
// =============================================================================

/**
 * Apply all filters and return filtered users
 */
export function filterUsers(
  allUsers: RootUser[],
  statusFilter: StatusFilter,
  searchQuery: string,
): RootUser[] {
  return applyAllFilters(allUsers, statusFilter, searchQuery);
}

// =============================================================================
// VALIDATION HANDLERS
// =============================================================================

/**
 * Validate email fields match
 */
export function checkEmailMatch(email: string, emailConfirm: string): boolean {
  return validateEmailMatch(email, emailConfirm);
}

/**
 * Validate password fields match
 */
export function checkPasswordMatch(password: string, passwordConfirm: string): boolean {
  return validatePasswordMatch(password, passwordConfirm);
}

/**
 * Get password strength info
 */
export function getPasswordStrength(password: string): PasswordStrengthState {
  return calculatePasswordStrength(password);
}

// =============================================================================
// FORM DATA HANDLERS
// =============================================================================

/**
 * Get default form values
 */
export function getFormDefaults(): FormState {
  const defaults = getDefaultFormValues();
  return {
    firstName: defaults.firstName,
    lastName: defaults.lastName,
    email: defaults.email,
    emailConfirm: defaults.emailConfirm,
    password: defaults.password,
    passwordConfirm: defaults.passwordConfirm,
    employeeNumber: defaults.employeeNumber,
    position: defaults.position,
    notes: defaults.notes,
    isActive: defaults.isActive,
  };
}

/**
 * Populate form from user data
 */
export function getFormFromUser(user: RootUser): FormState {
  const formData = populateFormFromUser(user);
  return {
    firstName: formData.firstName,
    lastName: formData.lastName,
    email: formData.email,
    emailConfirm: formData.emailConfirm,
    password: formData.password,
    passwordConfirm: formData.passwordConfirm,
    employeeNumber: formData.employeeNumber,
    position: formData.position,
    notes: formData.notes,
    isActive: formData.isActive,
  };
}

// =============================================================================
// API HANDLERS
// =============================================================================

/**
 * Load root users from API
 */
export async function loadAllUsers(): Promise<{ users: RootUser[]; error: string | null }> {
  return await loadRootUsers();
}

/**
 * Save root user (create or update)
 */
export async function saveRootUserData(
  formState: FormState,
  isEditMode: boolean,
  editId: number | null,
): Promise<{ success: boolean; error?: string }> {
  // Validate position
  if (!formState.position) {
    showWarningAlert(MESSAGES.SELECT_POSITION_ERROR);
    return { success: false, error: MESSAGES.SELECT_POSITION_ERROR };
  }

  const payload = buildRootUserPayload(
    {
      firstName: formState.firstName,
      lastName: formState.lastName,
      email: formState.email,
      position: formState.position,
      notes: formState.notes,
      employeeNumber: formState.employeeNumber,
      isActive: formState.isActive,
      password: formState.password,
    },
    isEditMode,
  );

  const result = await saveRootUser(payload, editId);

  if (!result.success) {
    showErrorAlert(result.error ?? MESSAGES.ERROR_SAVING);
  }

  return {
    success: result.success,
    error: result.error ?? undefined,
  };
}

/**
 * Delete root user
 */
export async function deleteRootUserData(
  userId: number,
): Promise<{ success: boolean; error?: string }> {
  const result = await deleteRootUser(userId);

  if (!result.success) {
    showErrorAlert(result.error ?? MESSAGES.ERROR_DELETING);
  }

  return {
    success: result.success,
    error: result.error ?? undefined,
  };
}

// =============================================================================
// KEYBOARD HANDLERS
// =============================================================================

/**
 * Handle escape key for modals
 */
export function handleEscapeKey(
  e: KeyboardEvent,
  closeCallbacks: {
    closeDeleteConfirm: () => void;
    closeDelete: () => void;
    closeRoot: () => void;
  },
  modalStates: {
    showDeleteConfirm: boolean;
    showDelete: boolean;
    showRoot: boolean;
  },
): void {
  if (e.key === 'Escape') {
    if (modalStates.showDeleteConfirm) {
      closeCallbacks.closeDeleteConfirm();
    } else if (modalStates.showDelete) {
      closeCallbacks.closeDelete();
    } else if (modalStates.showRoot) {
      closeCallbacks.closeRoot();
    }
  }
}
