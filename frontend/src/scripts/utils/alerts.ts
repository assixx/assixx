/**
 * Alert Utilities
 * Wrapper functions for alert() and confirm() to centralize their usage
 * and make it easier to replace with a proper notification system later
 */

/**
 * Show an alert message
 * @param message - The message to display
 */
export function showAlert(message: string): void {
  alert(message);
}

/**
 * Show a confirmation dialog
 * @param message - The message to display
 * @returns True if user clicked OK, false otherwise
 */
export function showConfirm(message: string): boolean {
  return confirm(message);
}

/**
 * Show an error alert
 * @param message - The error message to display
 */
export function showErrorAlert(message: string): void {
  alert(`Fehler: ${message}`);
}

/**
 * Show a success alert
 * @param message - The success message to display
 */
export function showSuccessAlert(message: string): void {
  alert(`Erfolg: ${message}`);
}
