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
  return await new Promise((resolve) => {
    // Add inline styles for the confirmation dialog
    const style = document.createElement('style');
    style.textContent = `
      .custom-confirm-dialog {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 99999;
      }
      .confirm-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .confirm-modal {
        background: linear-gradient(135deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 30, 0.95) 100%);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 30px;
        max-width: 500px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(10px);
      }
      .confirm-modal p {
        color: #ffffff;
        font-size: 16px;
        margin: 0 0 25px 0;
        line-height: 1.5;
      }
      .confirm-buttons {
        display: flex;
        gap: 15px;
        justify-content: flex-end;
      }
      .confirm-buttons button {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      .btn-confirm-yes {
        background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
        color: white;
      }
      .btn-confirm-yes:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0, 212, 255, 0.3);
      }
      .btn-confirm-no {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      .btn-confirm-no:hover {
        background: rgba(255, 255, 255, 0.15);
      }
    `;
    document.head.append(style);

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
      style.remove(); // Clean up styles
      resolve(true);
    });

    noBtn?.addEventListener('click', () => {
      confirmDiv.remove();
      style.remove(); // Clean up styles
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
