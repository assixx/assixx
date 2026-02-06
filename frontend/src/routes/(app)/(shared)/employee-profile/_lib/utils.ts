/**
 * Employee Profile - Utility Functions
 * @module employee-profile/_lib/utils
 */

import { POSITION_MAP } from './constants';

import type { ToastType } from './types';

/**
 * Show toast notification via custom event
 * @param message - Toast message
 * @param type - Toast type
 */
export function showToast(message: string, type: ToastType = 'info'): void {
  if (typeof window === 'undefined') return;

  const event = new CustomEvent('show-toast', {
    detail: { message, type },
  });
  window.dispatchEvent(event);
}

/**
 * Trigger file input click programmatically
 * @param inputId - Input element ID
 */
export function triggerFileInput(inputId: string): void {
  const input = document.getElementById(inputId);
  if (input) input.click();
}

/**
 * Check if password error is related to current password
 * @param errorMsg - Error message
 */
export function isCurrentPasswordError(errorMsg: string): boolean {
  const lower = errorMsg.toLowerCase();
  return lower.includes('current') || lower.includes('aktuell');
}

/**
 * Validate password length
 * @param password - Password to validate
 * @param minLength - Minimum length (default 12)
 * @param maxLength - Maximum length (default 72)
 */
export function isPasswordLengthValid(
  password: string,
  minLength = 12,
  maxLength = 72,
): boolean {
  return password.length >= minLength && password.length <= maxLength;
}

/**
 * Check if passwords match
 * @param password - New password
 * @param confirmPassword - Confirmation password
 */
export function doPasswordsMatch(
  password: string,
  confirmPassword: string,
): boolean {
  return password === confirmPassword;
}

/**
 * Get display position from position key
 * @param position - Position key from API
 * @returns German display name or original value
 */
export function getDisplayPosition(position?: string): string {
  if (position === undefined || position === '') {
    return '-';
  }
  return POSITION_MAP[position.toLowerCase()] ?? position;
}

/**
 * Get display department name
 * @param departmentName - Department name from API
 * @returns Department name or placeholder
 */
export function getDisplayDepartment(departmentName?: string): string {
  return departmentName !== undefined && departmentName !== '' ?
      departmentName
    : '-';
}

/**
 * Get user initials from name
 * @param firstName - First name
 * @param lastName - Last name
 * @returns Initials or fallback
 */
export function getInitials(firstName?: string, lastName?: string): string {
  const firstInitial = firstName?.charAt(0).toUpperCase() ?? '';
  const lastInitial = lastName?.charAt(0).toUpperCase() ?? '';

  if (firstInitial !== '' || lastInitial !== '') {
    return `${firstInitial}${lastInitial}`;
  }

  return 'U';
}

/**
 * Count character categories in password
 * @param password - Password to check
 * @returns Number of categories present (0-4)
 */
export function countPasswordCategories(password: string): number {
  let count = 0;
  if (/[A-Z]/.test(password)) count++; // Uppercase
  if (/[a-z]/.test(password)) count++; // Lowercase
  if (/\d/.test(password)) count++; // Numbers
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) count++; // Special chars
  return count;
}

/**
 * Validate password meets basic requirements
 * @param password - Password to validate
 * @returns Validation result with error message
 */
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
