/**
 * Alert Utilities for SvelteKit
 * Wrapper functions for alert() and confirm() to centralize their usage
 * Toast notifications use the Svelte store (toast.js)
 * Confirm dialogs use DOM-based modals for interactive confirmation
 * Based on: frontend/src/scripts/utils/alerts.ts
 */

import { browser } from '$app/environment';

import {
  showInfoAlert as toastInfo,
  showErrorAlert as toastError,
  showSuccessAlert as toastSuccess,
  showWarningAlert as toastWarning,
} from '$lib/stores/toast';

/** CSS class for custom confirm dialog container */
const CONFIRM_DIALOG_CLASS = 'custom-confirm-dialog';

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
 * Create a DOM element with optional class and text content
 */
function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  textContent?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className !== undefined && className !== '') {
    el.className = className;
  }
  if (textContent !== undefined && textContent !== '') {
    el.textContent = textContent;
  }
  return el;
}

/**
 * Create icon element
 */
function createIcon(iconClass: string): HTMLElement {
  return createElement('i', `fas ${iconClass}`);
}

/**
 * Build confirm modal structure using DOM methods (XSS-safe)
 */
function buildConfirmModal(config: {
  message: string;
  title: string;
  iconClass: string;
  modifier?: string;
  confirmText: string;
  cancelText: string;
  confirmBtnClass: string;
}): HTMLDivElement {
  const container = createElement('div', CONFIRM_DIALOG_CLASS);
  const overlay = createElement('div', 'confirm-overlay');
  const modal = createElement(
    'div',
    config.modifier !== undefined && config.modifier !== ''
      ? `confirm-modal confirm-modal--${config.modifier}`
      : 'confirm-modal',
  );

  // Icon
  const iconDiv = createElement('div', 'confirm-modal__icon');
  iconDiv.appendChild(createIcon(config.iconClass));
  modal.appendChild(iconDiv);

  // Title
  const titleEl = createElement('h3', 'confirm-modal__title', config.title);
  modal.appendChild(titleEl);

  // Message
  const messageEl = createElement('p', 'confirm-modal__message', config.message);
  modal.appendChild(messageEl);

  // Actions
  const actionsDiv = createElement('div', 'confirm-modal__actions');
  const cancelBtn = createElement(
    'button',
    'confirm-modal__btn confirm-modal__btn--cancel',
    config.cancelText,
  );
  const confirmBtn = createElement(
    'button',
    `confirm-modal__btn ${config.confirmBtnClass}`,
    config.confirmText,
  );
  actionsDiv.appendChild(cancelBtn);
  actionsDiv.appendChild(confirmBtn);
  modal.appendChild(actionsDiv);

  overlay.appendChild(modal);
  container.appendChild(overlay);

  return container;
}

/**
 * Create a confirmation dialog using Design System confirm-modal
 */
function createConfirmDialog(message: string): HTMLDivElement {
  return buildConfirmModal({
    message,
    title: 'Bestätigung',
    iconClass: 'fa-question-circle',
    confirmText: 'Ja',
    cancelText: 'Nein',
    confirmBtnClass: 'confirm-modal__btn--confirm',
  });
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
    const modalDiv = buildConfirmModal({
      message,
      title,
      iconClass: 'fa-exclamation-triangle',
      modifier: 'danger',
      confirmText: 'Bestätigen',
      cancelText: 'Abbrechen',
      confirmBtnClass: 'confirm-modal__btn--danger',
    });
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
    const modalDiv = buildConfirmModal({
      message,
      title,
      iconClass: 'fa-exclamation-circle',
      modifier: 'warning',
      confirmText: 'Ja, fortfahren',
      cancelText: 'Abbrechen',
      confirmBtnClass: 'confirm-modal__btn--confirm',
    });
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
 * Build info modal structure using DOM methods (single button variant)
 */
function buildInfoModal(config: { message: string; title: string }): HTMLDivElement {
  const container = createElement('div', CONFIRM_DIALOG_CLASS);
  const overlay = createElement('div', 'confirm-overlay');
  const modal = createElement('div', 'confirm-modal confirm-modal--info');

  // Icon
  const iconDiv = createElement('div', 'confirm-modal__icon');
  iconDiv.appendChild(createIcon('fa-info-circle'));
  modal.appendChild(iconDiv);

  // Title
  const titleEl = createElement('h3', 'confirm-modal__title', config.title);
  modal.appendChild(titleEl);

  // Message
  const messageEl = createElement('p', 'confirm-modal__message', config.message);
  modal.appendChild(messageEl);

  // Actions (single button)
  const actionsDiv = createElement('div', 'confirm-modal__actions');
  const okBtn = createElement('button', 'confirm-modal__btn confirm-modal__btn--confirm', 'OK');
  actionsDiv.appendChild(okBtn);
  modal.appendChild(actionsDiv);

  overlay.appendChild(modal);
  container.appendChild(overlay);

  return container;
}

/**
 * Show an informational modal dialog
 */
export async function showInfoModal(message: string, title: string = 'Hinweis'): Promise<void> {
  if (!browser) return;

  await new Promise<void>((resolve) => {
    const modalDiv = buildInfoModal({ message, title });
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
