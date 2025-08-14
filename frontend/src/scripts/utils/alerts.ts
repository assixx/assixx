/**
 * Alert Utilities
 * Wrapper functions for alert() and confirm() to centralize their usage
 * Uses notification service instead of native alerts
 */

import notificationService from '../services/notification.service';

/**
 * Show an alert message
 * @param message - The message to display
 */
export function showAlert(message: string): void {
  notificationService.info('Information', message);
}

/**
 * Show a confirmation dialog
 * @param message - The message to display
 * @returns True if user clicked OK, false otherwise
 * Note: This still uses native confirm as it requires synchronous user input
 * eslint-disable-next-line no-alert
 */
export function showConfirm(message: string): boolean {
  return window.confirm(message);
}

/**
 * Show an error alert
 * @param message - The error message to display
 */
export function showErrorAlert(message: string): void {
  notificationService.error('Fehler', message);
}

/**
 * Show a success alert
 * @param message - The success message to display
 */
export function showSuccessAlert(message: string): void {
  notificationService.success('Erfolg', message);
}
