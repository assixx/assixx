/**
 * Alert Utilities
 * Wrapper functions for alert() and confirm() to centralize their usage
 * Uses notification service instead of native alerts
 */

import '../../styles/alerts.css';
import notificationService from '../services/notification.service';
import { setHTML, $$ } from '../../utils/dom-utils';

/**
 * Show an alert message
 * @param message - The message to display
 */
export function showAlert(message: string): void {
  notificationService.info('Information', message);
}

function createConfirmDialog(message: string): HTMLDivElement {
  const confirmDiv = document.createElement('div');
  confirmDiv.className = 'custom-confirm-dialog';
  setHTML(
    confirmDiv,
    `
    <div class="confirm-overlay">
      <div class="confirm-modal">
        <p>${message}</p>
        <div class="confirm-buttons">
          <button class="btn-confirm-yes">Ja</button>
          <button class="btn-confirm-no">Nein</button>
        </div>
      </div>
    </div>
  `,
  );
  return confirmDiv;
}

/**
 * Show a confirmation dialog
 * @param message - The message to display
 * @returns Promise that resolves to true if user clicked OK, false otherwise
 * Note: This uses async notification service instead of native confirm
 */
export async function showConfirm(message: string): Promise<boolean> {
  return await new Promise((resolve) => {
    const confirmDiv = createConfirmDialog(message);
    document.body.append(confirmDiv);

    const yesBtn = $$('.btn-confirm-yes', confirmDiv) as HTMLButtonElement | null;
    const noBtn = $$('.btn-confirm-no', confirmDiv) as HTMLButtonElement | null;

    const cleanup = (): void => {
      confirmDiv.remove();
    };

    yesBtn?.addEventListener('click', () => {
      cleanup();
      resolve(true);
    });

    noBtn?.addEventListener('click', () => {
      cleanup();
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
