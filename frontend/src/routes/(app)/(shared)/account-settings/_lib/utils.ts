/**
 * Account Settings - Utility Functions
 * @module account-settings/_lib/utils
 */

import { createLogger } from '$lib/utils/logger';

import {
  STATUS_LABELS,
  DELETE_CONFIRMATION_TEXT,
  MIN_REASON_LENGTH,
} from './constants';

import type { ToastType, DeletionStatus } from './types';

const log = createLogger('AccountSettingsUtils');

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
 * @param status - Deletion status (known or unknown)
 */
export function getStatusLabel(status: string): string {
  if (status in STATUS_LABELS) {
    return STATUS_LABELS[status as DeletionStatus];
  }
  return status;
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
  log.warn({ type }, message);
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
