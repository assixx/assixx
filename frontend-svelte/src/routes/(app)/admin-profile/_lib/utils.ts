/**
 * Admin Profile - Utility Functions
 * @module admin-profile/_lib/utils
 */

import type { ToastType } from './types';
import { POSITION_MAP } from './constants';

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
  console.log(`[Toast:${type}] ${message}`);
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

/**
 * Get display position from position key
 * @param position - Position key from API
 * @returns German display name or original value
 */
export function getDisplayPosition(position?: string): string {
  if (!position || position === '') {
    return '-';
  }
  return POSITION_MAP[position.toLowerCase()] ?? position;
}

/**
 * Get display company name
 * @param companyName - Company name from API
 * @returns Company name or placeholder
 */
export function getDisplayCompany(companyName?: string): string {
  return companyName && companyName !== '' ? companyName : '-';
}
