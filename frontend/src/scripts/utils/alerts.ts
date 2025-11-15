/**
 * Alert Utilities
 * Wrapper functions for alert() and confirm() to centralize their usage
 * Uses notification service instead of native alerts
 */

import '../../styles/alerts.css';
import '../../design-system/components/confirm-modal/confirm-modal.css';
import notificationService from '../services/notification.service';
import { setHTML, $$ } from '../../utils/dom-utils';

/**
 * Show an alert message
 * @param message - The message to display
 */
export function showAlert(message: string): void {
  notificationService.info('Information', message);
}

/**
 * Create a confirmation dialog using Design System confirm-modal component
 * @param message - The message to display
 * @returns HTMLDivElement containing the dialog
 */
function createConfirmDialog(message: string): HTMLDivElement {
  const confirmDiv = document.createElement('div');
  confirmDiv.className = 'custom-confirm-dialog';
  setHTML(
    confirmDiv,
    `
    <div class="confirm-overlay">
      <div class="confirm-modal confirm-modal">
        <div class="confirm-modal__icon">
          <i class="fas fa-question-circle"></i>
        </div>
        <h3 class="confirm-modal__title">Bestätigung</h3>
        <p class="confirm-modal__message">${message}</p>
        <div class="confirm-modal__actions">
          <button class="confirm-modal__btn confirm-modal__btn--cancel">Nein</button>
          <button class="confirm-modal__btn confirm-modal__btn--confirm">Ja</button>
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
 * Note: This uses Design System confirm-modal component
 */
export async function showConfirm(message: string): Promise<boolean> {
  return await new Promise((resolve) => {
    const confirmDiv = createConfirmDialog(message);
    document.body.append(confirmDiv);

    const confirmBtn = $$('.confirm-modal__btn--confirm', confirmDiv) as HTMLButtonElement | null;
    const cancelBtn = $$('.confirm-modal__btn--cancel', confirmDiv) as HTMLButtonElement | null;

    const cleanup = (): void => {
      confirmDiv.remove();
    };

    confirmBtn?.addEventListener('click', () => {
      cleanup();
      resolve(true);
    });

    cancelBtn?.addEventListener('click', () => {
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

/**
 * Show a warning alert
 * @param message - The warning message to display
 */
export function showWarningAlert(message: string): void {
  notificationService.warning('Warnung', message);
}

/**
 * Show an informational modal dialog with Design System confirm-modal--info
 * @param message - The message to display
 * @param title - Optional title (default: "Hinweis")
 * @returns Promise that resolves when user clicks OK
 */
export async function showInfoModal(message: string, title: string = 'Hinweis'): Promise<void> {
  await new Promise<void>((resolve) => {
    const modalDiv = document.createElement('div');
    modalDiv.className = 'custom-confirm-dialog';
    setHTML(
      modalDiv,
      `
      <div class="confirm-overlay">
        <div class="confirm-modal confirm-modal--info">
          <div class="confirm-modal__icon">
            <i class="fas fa-info-circle"></i>
          </div>
          <h3 class="confirm-modal__title">${title}</h3>
          <p class="confirm-modal__message">${message}</p>
          <div class="confirm-modal__actions">
            <button class="confirm-modal__btn confirm-modal__btn--confirm">OK</button>
          </div>
        </div>
      </div>
    `,
    );
    document.body.append(modalDiv);

    const okBtn = $$('.confirm-modal__btn--confirm', modalDiv) as HTMLButtonElement | null;

    const cleanup = (): void => {
      modalDiv.remove();
    };

    okBtn?.addEventListener('click', () => {
      cleanup();
      resolve();
    });
  });
}
