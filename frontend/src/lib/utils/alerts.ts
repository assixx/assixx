/**
 * Alert Utilities for SvelteKit
 * Wrapper functions for alert() and confirm() to centralize their usage
 * Toast notifications use the Svelte store (toast.js)
 * Confirm dialogs use DOM-based modals for interactive confirmation
 * Based on: frontend/src/scripts/utils/alerts.ts
 */

import {
  showInfoAlert as toastInfo,
  showErrorAlert as toastError,
  showSuccessAlert as toastSuccess,
  showWarningAlert as toastWarning,
} from '$lib/stores/toast.js';
import { browser } from '$app/environment';

/** CSS class for custom confirm dialog container */
const CONFIRM_DIALOG_CLASS = 'custom-confirm-dialog';

/**
 * Escape HTML for safe rendering
 */
function escapeHtml(text: string): string {
  if (!browser) return text;
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Show an alert message (info notification)
 */
export function showAlert(message: string): void {
  toastInfo(message);
}

/**
 * Show an error alert
 */
export function showErrorAlert(message: string): void {
  toastError(message);
}

/**
 * Show a success alert
 */
export function showSuccessAlert(message: string): void {
  toastSuccess(message);
}

/**
 * Show a warning alert
 */
export function showWarningAlert(message: string): void {
  toastWarning(message);
}

/**
 * Create a confirmation dialog using Design System confirm-modal
 */
function createConfirmDialog(message: string): HTMLDivElement {
  const confirmDiv = document.createElement('div');
  confirmDiv.className = CONFIRM_DIALOG_CLASS;
  confirmDiv.innerHTML = `
    <div class="confirm-overlay">
      <div class="confirm-modal">
        <div class="confirm-modal__icon">
          <i class="fas fa-question-circle"></i>
        </div>
        <h3 class="confirm-modal__title">Bestätigung</h3>
        <p class="confirm-modal__message">${escapeHtml(message)}</p>
        <div class="confirm-modal__actions">
          <button class="confirm-modal__btn confirm-modal__btn--cancel">Nein</button>
          <button class="confirm-modal__btn confirm-modal__btn--confirm">Ja</button>
        </div>
      </div>
    </div>
  `;
  return confirmDiv;
}

/**
 * Show a confirmation dialog
 * @returns Promise that resolves to true if user clicked Ja, false otherwise
 */
export async function showConfirm(message: string): Promise<boolean> {
  if (!browser) return false;

  return await new Promise((resolve) => {
    const confirmDiv = createConfirmDialog(message);
    document.body.append(confirmDiv);

    const confirmBtn = confirmDiv.querySelector('.confirm-modal__btn--confirm');
    const cancelBtn = confirmDiv.querySelector('.confirm-modal__btn--cancel');

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
 * Show a danger confirmation dialog for destructive actions
 */
export async function showConfirmDanger(
  message: string,
  title: string = 'Bestätigung erforderlich',
): Promise<boolean> {
  if (!browser) return false;

  return await new Promise((resolve) => {
    const modalDiv = document.createElement('div');
    modalDiv.className = CONFIRM_DIALOG_CLASS;
    modalDiv.innerHTML = `
      <div class="confirm-overlay">
        <div class="confirm-modal confirm-modal--danger">
          <div class="confirm-modal__icon">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <h3 class="confirm-modal__title">${escapeHtml(title)}</h3>
          <p class="confirm-modal__message">${escapeHtml(message)}</p>
          <div class="confirm-modal__actions">
            <button class="confirm-modal__btn confirm-modal__btn--cancel">Abbrechen</button>
            <button class="confirm-modal__btn confirm-modal__btn--danger">Bestätigen</button>
          </div>
        </div>
      </div>
    `;
    document.body.append(modalDiv);

    const dangerBtn = modalDiv.querySelector('.confirm-modal__btn--danger');
    const cancelBtn = modalDiv.querySelector('.confirm-modal__btn--cancel');

    const cleanup = (): void => {
      modalDiv.remove();
    };

    dangerBtn?.addEventListener('click', () => {
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
 * Show a warning confirmation dialog
 */
export async function showConfirmWarning(
  message: string,
  title: string = 'Hinweis',
): Promise<boolean> {
  if (!browser) return false;

  return await new Promise((resolve) => {
    const modalDiv = document.createElement('div');
    modalDiv.className = CONFIRM_DIALOG_CLASS;
    modalDiv.innerHTML = `
      <div class="confirm-overlay">
        <div class="confirm-modal confirm-modal--warning">
          <div class="confirm-modal__icon">
            <i class="fas fa-exclamation-circle"></i>
          </div>
          <h3 class="confirm-modal__title">${escapeHtml(title)}</h3>
          <p class="confirm-modal__message">${escapeHtml(message)}</p>
          <div class="confirm-modal__actions">
            <button class="confirm-modal__btn confirm-modal__btn--cancel">Abbrechen</button>
            <button class="confirm-modal__btn confirm-modal__btn--confirm">Ja, fortfahren</button>
          </div>
        </div>
      </div>
    `;
    document.body.append(modalDiv);

    const confirmBtn = modalDiv.querySelector('.confirm-modal__btn--confirm');
    const cancelBtn = modalDiv.querySelector('.confirm-modal__btn--cancel');

    const cleanup = (): void => {
      modalDiv.remove();
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
 * Show an informational modal dialog
 */
export async function showInfoModal(message: string, title: string = 'Hinweis'): Promise<void> {
  if (!browser) return;

  await new Promise<void>((resolve) => {
    const modalDiv = document.createElement('div');
    modalDiv.className = CONFIRM_DIALOG_CLASS;
    modalDiv.innerHTML = `
      <div class="confirm-overlay">
        <div class="confirm-modal confirm-modal--info">
          <div class="confirm-modal__icon">
            <i class="fas fa-info-circle"></i>
          </div>
          <h3 class="confirm-modal__title">${escapeHtml(title)}</h3>
          <p class="confirm-modal__message">${escapeHtml(message)}</p>
          <div class="confirm-modal__actions">
            <button class="confirm-modal__btn confirm-modal__btn--confirm">OK</button>
          </div>
        </div>
      </div>
    `;
    document.body.append(modalDiv);

    const okBtn = modalDiv.querySelector('.confirm-modal__btn--confirm');

    const cleanup = (): void => {
      modalDiv.remove();
    };

    okBtn?.addEventListener('click', () => {
      cleanup();
      resolve();
    });
  });
}
