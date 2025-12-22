/**
 * Account Settings - Utility Functions
 * @module account-settings/_lib/utils
 */

import type { ToastType, DeletionStatus } from './types';
import { STATUS_LABELS, DELETE_CONFIRMATION_TEXT, MIN_REASON_LENGTH } from './constants';

/**
 * Format date for display (German locale)
 * @param isoString - ISO date string
 */
export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get status label for display
 * @param status - Deletion status
 */
export function getStatusLabel(status: DeletionStatus | string): string {
  return STATUS_LABELS[status as DeletionStatus] ?? status;
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
  console.log(`[Toast:${type}] ${message}`);
}

/**
 * Check if delete confirmation input is valid
 * @param input - User input
 */
export function isDeleteConfirmationValid(input: string): boolean {
  return input === DELETE_CONFIRMATION_TEXT;
}

/**
 * Check if deletion reason is valid
 * @param reason - Deletion reason
 */
export function isReasonValid(reason: string): boolean {
  return reason.length >= MIN_REASON_LENGTH;
}

/**
 * Check if deletion can proceed
 * @param confirmation - Confirmation input
 * @param reason - Deletion reason
 */
export function canDelete(confirmation: string, reason: string): boolean {
  return isDeleteConfirmationValid(confirmation) && isReasonValid(reason);
}
