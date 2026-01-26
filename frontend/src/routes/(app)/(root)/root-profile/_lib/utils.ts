/**
 * Root Profile - Utility Functions
 * @module root-profile/_lib/utils
 */

import type { ToastType } from './types';

/**
 * Format date for display (German locale with time)
 * @param dateStr - ISO date string
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Show toast notification via custom event
 * @param message - Toast message
 * @param type - Toast type
 */
export function showToast(message: string, type: ToastType = 'info'): void {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('show-toast', {
      detail: { message, type },
    });
    window.dispatchEvent(event);
  }
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
export function isPasswordLengthValid(password: string, minLength = 12, maxLength = 72): boolean {
  return password.length >= minLength && password.length <= maxLength;
}

/**
 * Check if passwords match
 * @param password - New password
 * @param confirmPassword - Confirmation password
 */
export function doPasswordsMatch(password: string, confirmPassword: string): boolean {
  return password === confirmPassword;
}
