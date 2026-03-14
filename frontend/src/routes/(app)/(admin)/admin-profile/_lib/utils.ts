/**
 * Admin Profile - Utility Functions
 * @module admin-profile/_lib/utils
 */

import {
  showSuccessAlert,
  showErrorAlert,
  showWarningAlert,
  showInfoAlert,
} from '$lib/stores/toast';

import { MESSAGES } from './constants';

import type { ToastType } from './types';

/** Error code to message mapping for picture upload */
const PICTURE_UPLOAD_ERROR_MAP: Record<string, string> = {
  INVALID_TYPE: MESSAGES.invalidImageType,
  FILE_TOO_LARGE: MESSAGES.fileTooLarge,
};

/** Get error message for picture upload errors */
export function getPictureUploadErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  return PICTURE_UPLOAD_ERROR_MAP[code] ?? MESSAGES.pictureUploadError;
}

/** Toast type to store function mapping */
const TOAST_FN_MAP: Record<ToastType, (msg: string) => string> = {
  success: showSuccessAlert,
  error: showErrorAlert,
  warning: showWarningAlert,
  info: showInfoAlert,
};

/** Show toast notification via toast store */
export function showToast(message: string, type: ToastType = 'info'): void {
  TOAST_FN_MAP[type](message);
}

/** Trigger file input click programmatically */
export function triggerFileInput(inputId: string): void {
  const input = document.getElementById(inputId);
  if (input) input.click();
}

/** Check if password error is related to current password */
export function isCurrentPasswordError(errorMsg: string): boolean {
  const lower = errorMsg.toLowerCase();
  return lower.includes('current') || lower.includes('aktuell');
}

/** Validate password length */
export function isPasswordLengthValid(
  password: string,
  minLength = 12,
  maxLength = 72,
): boolean {
  return password.length >= minLength && password.length <= maxLength;
}

/** Check if passwords match */
export function doPasswordsMatch(
  password: string,
  confirmPassword: string,
): boolean {
  return password === confirmPassword;
}

/** Get display company name */
export function getDisplayCompany(companyName?: string): string {
  return companyName !== undefined && companyName !== '' ? companyName : '-';
}
