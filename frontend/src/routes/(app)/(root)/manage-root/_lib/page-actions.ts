/**
 * Manage Root — extracted page action handlers.
 * Pure validation + API call wrappers with error handling.
 * Extracted from +page.svelte for maintainability (svelte/max-lines-per-block).
 */
import { ApiError } from '$lib/utils/api-client';

import {
  saveRootUser as apiSaveRootUser,
  deleteRootUser as apiDeleteRootUser,
  buildRootUserPayload,
  updateRootAvailability as apiUpdateAvailability,
} from './api';
import { validateEmailMatch, validateAvailabilityForm, buildAvailabilityPayload } from './utils';

import type { Logger } from '$lib/utils/logger';
import type { RootUserFormData } from './types';
import type { AvailabilityFormData } from './utils';

// --- Types ---

export type RootUserValidationError = 'email' | 'password' | 'position' | 'employee_number';

export interface ActionResult {
  success: boolean;
  errorMessage?: string;
}

export interface SaveRootUserResult extends ActionResult {
  validationError?: RootUserValidationError;
}

export interface AvailabilitySaveResult extends ActionResult {
  validationError?: 'dates_required' | 'end_before_start';
}

// --- Validation ---

function hasPasswordError(password: string, passwordConfirm: string, isEditMode: boolean): boolean {
  if (!isEditMode) {
    return password === '' || passwordConfirm === '' || password !== passwordConfirm;
  }
  const eitherFilled = password !== '' || passwordConfirm !== '';
  return eitherFilled && password !== passwordConfirm;
}

function validateRootUserForm(
  fields: RootUserFormData,
  isEditMode: boolean,
): RootUserValidationError | null {
  if (!validateEmailMatch(fields.email, fields.emailConfirm)) {
    return 'email';
  }
  if (hasPasswordError(fields.password, fields.passwordConfirm, isEditMode)) {
    return 'password';
  }
  if (fields.position === '') {
    return 'position';
  }
  if (fields.employeeNumber.trim() === '') {
    return 'employee_number';
  }
  return null;
}

// --- Coordinated Actions ---

/** Validate + save root user (create or update) */
export async function executeSaveRootUser(
  fields: RootUserFormData,
  editId: number | null,
  isEditMode: boolean,
  log: Logger,
): Promise<SaveRootUserResult> {
  const validationError = validateRootUserForm(fields, isEditMode);
  if (validationError !== null) {
    return { success: false, validationError };
  }

  const payload = buildRootUserPayload(
    {
      firstName: fields.firstName,
      lastName: fields.lastName,
      email: fields.email,
      position: fields.position,
      notes: fields.notes,
      employeeNumber: fields.employeeNumber,
      isActive: fields.isActive,
      password: fields.password,
    },
    isEditMode,
  );

  try {
    const result = await apiSaveRootUser(payload, editId);
    if (result.success) {
      return { success: true };
    }
    return { success: false, errorMessage: result.error ?? undefined };
  } catch (err: unknown) {
    log.error({ err }, 'Error saving user');
    return { success: false };
  }
}

/** Delete root user */
export async function executeDeleteRootUser(userId: number, log: Logger): Promise<ActionResult> {
  try {
    const result = await apiDeleteRootUser(userId);
    if (result.success) {
      return { success: true };
    }
    return { success: false, errorMessage: result.error ?? undefined };
  } catch (err: unknown) {
    log.error({ err }, 'Error deleting user');
    return { success: false };
  }
}

/** Validate + save availability */
export async function executeSaveAvailability(
  userId: number,
  formData: AvailabilityFormData,
  log: Logger,
): Promise<AvailabilitySaveResult> {
  const validationError = validateAvailabilityForm(formData);
  if (validationError !== null) {
    return { success: false, validationError };
  }

  const payload = buildAvailabilityPayload(formData);
  try {
    await apiUpdateAvailability(userId, payload);
    return { success: true };
  } catch (err: unknown) {
    log.error({ err }, 'Error updating availability');
    return {
      success: false,
      errorMessage:
        err instanceof ApiError ? err.message : 'Fehler beim Speichern der Verfügbarkeit',
    };
  }
}
