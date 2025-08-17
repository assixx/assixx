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
 * @returns Promise that resolves to true if user clicked OK, false otherwise
 * Note: This uses async notification service instead of native confirm
 */
export async function showConfirm(message: string): Promise<boolean> {
  // Create a promise that resolves based on user action
  return new Promise((resolve) => {
    // Use notification service with action buttons
    const confirmDiv = document.createElement('div');
    confirmDiv.className = 'custom-confirm-dialog';
    confirmDiv.innerHTML = `
      <div class="confirm-overlay">
        <div class="confirm-modal">
          <p>${message}</p>
          <div class="confirm-buttons">
            <button class="btn-confirm-yes">Ja</button>
            <button class="btn-confirm-no">Nein</button>
          </div>
        </div>
      </div>
    `;

    document.body.append(confirmDiv);

    const yesBtn = confirmDiv.querySelector('.btn-confirm-yes');
    const noBtn = confirmDiv.querySelector('.btn-confirm-no');

    yesBtn?.addEventListener('click', () => {
      confirmDiv.remove();
      resolve(true);
    });

    noBtn?.addEventListener('click', () => {
      confirmDiv.remove();
      resolve(false);
    });
  });
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
