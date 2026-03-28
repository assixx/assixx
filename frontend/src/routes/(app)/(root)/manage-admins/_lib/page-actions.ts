/**
 * Manage Admins — extracted page action handlers.
 * Pure validation + API call wrappers with error handling.
 * Extracted from +page.svelte for maintainability (svelte/max-lines-per-block).
 */
import { ApiError, getApiErrorMessage } from '$lib/utils/api-client';

import {
  deleteAdmin as apiDeleteAdmin,
  downgradeToEmployee as apiDowngradeToEmployee,
  saveAdminWithPermissions,
  updateAdminAvailability as apiUpdateAvailability,
  upgradeToRoot as apiUpgradeToRoot,
} from './api';
import { buildAdminFormData, buildAvailabilityPayload, validateAvailabilityForm } from './utils';

import type { Logger } from '$lib/utils/logger';
import type { AdminFormData } from './types';
import type {
  AvailabilityFormData,
  AvailabilityPayload,
  AvailabilityValidationError,
  FormState,
} from './utils';

// --- Types ---

export interface ActionResult {
  success: boolean;
  errorMessage?: string;
}

export interface SaveAdminActionResult extends ActionResult {
  uuid: string | null;
  validationError?: string;
}

export interface AvailabilitySaveResult extends ActionResult {
  validationError?: AvailabilityValidationError;
}

export interface FullFormFields extends FormState {
  emailConfirm: string;
  passwordConfirm: string;
}

interface AdminValidationParams {
  email: string;
  emailConfirm: string;
  password: string;
  passwordConfirm: string;
  positionIds: string[];
  employeeNumber: string;
}

/** Subset of messages needed for validation + save */
interface AdminMessages {
  readonly ERROR_EMAIL_MISMATCH: string;
  readonly ERROR_PASSWORD_MISMATCH: string;
  readonly ERROR_POSITION_REQUIRED: string;
  readonly ERROR_EMPLOYEE_NUMBER_REQUIRED: string;
  readonly ERROR_SAVE_FAILED: string;
}

// --- Validation ---

/** Check password fields: required for new, optional for edit (both-or-none + must match) */
function hasPasswordError(password: string, passwordConfirm: string, isEditMode: boolean): boolean {
  if (!isEditMode) {
    return password === '' || passwordConfirm === '' || password !== passwordConfirm;
  }
  const eitherFilled = password !== '' || passwordConfirm !== '';
  return eitherFilled && password !== passwordConfirm;
}

/** Validates admin form fields — returns error message or null */
function validateAdminForm(
  params: AdminValidationParams,
  isEditMode: boolean,
  messages: AdminMessages,
): string | null {
  if (params.email !== params.emailConfirm) {
    return messages.ERROR_EMAIL_MISMATCH;
  }
  if (hasPasswordError(params.password, params.passwordConfirm, isEditMode)) {
    return messages.ERROR_PASSWORD_MISMATCH;
  }
  if (params.positionIds.length === 0) {
    return messages.ERROR_POSITION_REQUIRED;
  }
  if (!params.employeeNumber) {
    return messages.ERROR_EMPLOYEE_NUMBER_REQUIRED;
  }
  return null;
}

// --- Coordinated Actions ---

/** Validate + save admin (create or update) with permissions */
export async function executeFullAdminSave(
  fields: FullFormFields,
  editId: number | null,
  isEditMode: boolean,
  log: Logger,
  messages: AdminMessages,
): Promise<SaveAdminActionResult> {
  const vError = validateAdminForm(fields, isEditMode, messages);
  if (vError !== null) {
    return { success: false, uuid: null, validationError: vError };
  }
  const formData: AdminFormData = buildAdminFormData(fields, isEditMode);
  try {
    const result = await saveAdminWithPermissions(formData, editId);
    return { success: true, uuid: result.uuid };
  } catch (err: unknown) {
    log.error({ err }, 'Error saving admin');
    return {
      success: false,
      uuid: null,
      errorMessage: getApiErrorMessage(err, messages.ERROR_SAVE_FAILED),
    };
  }
}

/** Validate + save availability */
export async function executeFullAvailabilitySave(
  adminId: number,
  formData: AvailabilityFormData,
  log: Logger,
): Promise<AvailabilitySaveResult> {
  const validationError = validateAvailabilityForm(formData);
  if (validationError !== null) {
    return { success: false, validationError };
  }
  const payload: AvailabilityPayload = buildAvailabilityPayload(formData);
  try {
    await apiUpdateAvailability(adminId, payload);
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

// --- Simple API Wrappers ---

/** Upgrade admin to root */
export async function executeUpgradeToRoot(adminId: number, log: Logger): Promise<ActionResult> {
  try {
    await apiUpgradeToRoot(adminId);
    return { success: true };
  } catch (err: unknown) {
    log.error({ err }, 'Error upgrading admin to root');
    return {
      success: false,
      errorMessage: err instanceof Error ? err.message : undefined,
    };
  }
}

/** Downgrade admin to employee */
export async function executeDowngradeToEmployee(
  adminId: number,
  log: Logger,
): Promise<ActionResult> {
  try {
    await apiDowngradeToEmployee(adminId);
    return { success: true };
  } catch (err: unknown) {
    log.error({ err }, 'Error downgrading admin to employee');
    return {
      success: false,
      errorMessage: err instanceof Error ? err.message : undefined,
    };
  }
}

/** Delete an admin */
export async function executeDeleteAdmin(adminId: number, log: Logger): Promise<ActionResult> {
  try {
    await apiDeleteAdmin(adminId);
    return { success: true };
  } catch (err: unknown) {
    log.error({ err }, 'Error deleting admin');
    return { success: false };
  }
}
