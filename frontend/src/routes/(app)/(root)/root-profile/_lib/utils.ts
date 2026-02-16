/**
 * Root Profile - Utility Functions
 * @module root-profile/_lib/utils
 */

import {
  showSuccessAlert,
  showErrorAlert,
  showWarningAlert,
  showInfoAlert,
} from '$lib/stores/toast';

import type { ToastType } from './types';

/** Format date for display (German locale with time) */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
