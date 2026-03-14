/**
 * Employee Profile - Utility Functions
 * @module employee-profile/_lib/utils
 */

import {
  showSuccessAlert,
  showErrorAlert,
  showWarningAlert,
  showInfoAlert,
} from '$lib/stores/toast';

import type { ToastType } from './types';

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

/** Get display department name */
export function getDisplayDepartment(departmentName?: string): string {
  return departmentName !== undefined && departmentName !== '' ?
      departmentName
    : '-';
}

/** Get user initials from name */
export function getInitials(firstName?: string, lastName?: string): string {
  const firstInitial = firstName?.charAt(0).toUpperCase() ?? '';
  const lastInitial = lastName?.charAt(0).toUpperCase() ?? '';

  if (firstInitial !== '' || lastInitial !== '') {
    return `${firstInitial}${lastInitial}`;
  }

  return 'U';
}

/** Count character categories in password (0-4: upper, lower, digits, special) */
export function countPasswordCategories(password: string): number {
  let count = 0;
  if (/[A-Z]/.test(password)) count++; // Uppercase
  if (/[a-z]/.test(password)) count++; // Lowercase
  if (/\d/.test(password)) count++; // Numbers
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) count++; // Special chars
  return count;
}

/** Validate password meets basic requirements */
export function validatePassword(password: string): {
  isValid: boolean;
  errorMessage: string;
} {
  if (password.length < 12) {
    return {
      isValid: false,
      errorMessage: 'Passwort muss mindestens 12 Zeichen lang sein',
    };
  }
  if (password.length > 72) {
    return {
      isValid: false,
      errorMessage: 'Passwort darf maximal 72 Zeichen lang sein (BCrypt-Limit)',
    };
  }

  const categories = countPasswordCategories(password);
  if (categories < 3) {
    return {
      isValid: false,
      errorMessage:
        'Passwort muss Zeichen aus mind. 3 Kategorien enthalten: Groß-/Kleinbuchstaben, Zahlen, Sonderzeichen',
    };
  }

  return { isValid: true, errorMessage: '' };
}
