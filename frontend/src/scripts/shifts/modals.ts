/**
 * Modal Utilities for Shift Planning System
 * Functions for creating, showing, and closing modals
 */

import { $$id, createElement } from '../../utils/dom-utils';
import { DISPLAY } from './constants';

// ============== MODAL DISPLAY CONTROL ==============

/**
 * Show a modal by ID
 */
export function showModal(modalId: string): void {
  console.info(`[MODALS] Attempting to show modal: ${modalId}`);
  const modal = $$id(modalId) as HTMLDivElement | null;
  console.info(`[MODALS] Modal element found:`, modal !== null, modal);
  if (modal !== null) {
    modal.style.display = DISPLAY.FLEX;
    modal.classList.add('show');
    modal.classList.add('modal-overlay--active');
    console.info(`[MODALS] Modal classes after show:`, modal.className);
  } else {
    console.error(`[MODALS] Modal element not found: ${modalId}`);
  }
}

/**
 * Hide a modal by ID
 */
export function hideModal(modalId: string): void {
  const modal = $$id(modalId) as HTMLDivElement | null;
  if (modal !== null) {
    modal.classList.remove('show');
    modal.classList.remove('modal-overlay--active');
    // Optional: hide after animation
    setTimeout(() => {
      modal.style.display = DISPLAY.NONE;
    }, 300);
  }
}

/**
 * Close modal by target element (from close button click)
 */
export function closeModalByTarget(target: HTMLElement): void {
  const modal = target.closest('.modal-overlay');
  if (modal !== null) {
    modal.classList.remove('modal-overlay--active');
    modal.classList.remove('show');
    setTimeout(() => {
      modal.remove();
    }, 300);
  }
}

/**
 * Check if target is a close modal button
 */
export function isCloseModalAction(target: HTMLElement): boolean {
  return target.dataset['action'] === 'close-modal';
}

// ============== MODAL CONTENT UPDATES ==============

/**
 * Update modal title
 */
export function updateModalTitle(modalId: string, title: string): void {
  const modal = $$id(modalId);
  if (modal !== null) {
    const modalHeader = modal.querySelector('.modal-header h2');
    if (modalHeader !== null) {
      modalHeader.textContent = title;
    }
  }
}

/**
 * Set modal body content
 */
export function setModalBodyContent(modalId: string, content: HTMLElement | string): void {
  const modal = $$id(modalId);
  if (modal !== null) {
    const modalBody = modal.querySelector('.modal-body');
    if (modalBody !== null) {
      // Clear existing content safely
      while (modalBody.firstChild !== null) {
        modalBody.firstChild.remove();
      }
      if (typeof content === 'string') {
        const textNode = document.createTextNode(content);
        modalBody.append(textNode);
      } else {
        modalBody.append(content);
      }
    }
  }
}

// ============== MODAL EVENT SETUP ==============

/**
 * Setup modal close button handlers
 */
export function setupModalCloseHandlers(modalId: string, onClose: () => void): void {
  const closeButtons = document.querySelectorAll(`[data-modal-close="${modalId}"]`);
  closeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      onClose();
    });
  });
}

/**
 * Setup modal backdrop click to close
 */
export function setupModalBackdropClose(modalId: string, onClose: () => void): void {
  const modal = $$id(modalId);
  if (modal !== null) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        onClose();
      }
    });
  }
}

/**
 * Setup escape key to close modal
 */
export function setupModalEscapeClose(modalId: string, onClose: () => void): () => void {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      const modal = $$id(modalId);
      if (modal?.classList.contains('show') === true) {
        onClose();
      }
    }
  };

  document.addEventListener('keydown', handleEscape);

  return () => {
    document.removeEventListener('keydown', handleEscape);
  };
}

// ============== SHIFT DETAILS MODAL ==============

/**
 * Create shift details modal content
 */
export function createShiftDetailsContent(
  shiftType: string,
  date: string,
  employees: { id: number; name: string }[],
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'shift-details-content';

  // Header
  const header = createElement('div', { className: 'shift-details-header' });
  const title = createElement('h3', {}, getShiftLabel(shiftType));
  const dateSpan = createElement('span', { className: 'shift-date' }, formatDateGerman(date));
  header.append(title, dateSpan);
  container.append(header);

  // Employee list
  const employeeList = createElement('div', { className: 'shift-employees-list' });

  if (employees.length === 0) {
    const emptyMessage = createElement('p', { className: 'empty-message' }, 'Keine Mitarbeiter zugewiesen');
    employeeList.append(emptyMessage);
  } else {
    employees.forEach((emp) => {
      const empItem = createElement('div', { className: 'shift-employee-item' }, emp.name);
      employeeList.append(empItem);
    });
  }

  container.append(employeeList);

  return container;
}

/**
 * Get shift label for display
 */
function getShiftLabel(shiftType: string): string {
  const labels = new Map<string, string>([
    ['early', 'Frühschicht'],
    ['late', 'Spätschicht'],
    ['night', 'Nachtschicht'],
    ['F', 'Frühschicht'],
    ['S', 'Spätschicht'],
    ['N', 'Nachtschicht'],
  ]);
  return labels.get(shiftType) ?? shiftType;
}

/**
 * Format date in German format
 */
function formatDateGerman(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// ============== DYNAMIC MODAL CREATION ==============

/**
 * Create a basic modal structure
 */
export function createModal(
  modalId: string,
  title: string,
  body: HTMLElement | string,
  footerButtons?: { text: string; className?: string; onClick: () => void }[],
): HTMLElement {
  const overlay = createElement('div', {
    className: 'modal-overlay',
    id: modalId,
  });

  const modalContainer = createElement('div', { className: 'modal-container' });

  // Header
  const header = createElement('div', { className: 'modal-header' });
  const titleElement = createElement('h2', {}, title);
  const closeBtn = createElement('button', {
    className: 'modal-close-btn',
  });
  closeBtn.dataset['action'] = 'close-modal';
  closeBtn.textContent = '\u00D7'; // × character (multiplication sign)
  header.append(titleElement, closeBtn);

  // Body
  const bodyContainer = createElement('div', { className: 'modal-body' });
  if (typeof body === 'string') {
    const textNode = document.createTextNode(body);
    bodyContainer.append(textNode);
  } else {
    bodyContainer.append(body);
  }

  // Footer (optional)
  const footer = createElement('div', { className: 'modal-footer' });
  if (footerButtons !== undefined && footerButtons.length > 0) {
    footerButtons.forEach((btn) => {
      const button = createElement('button', { className: btn.className ?? 'btn' }, btn.text);
      button.addEventListener('click', btn.onClick);
      footer.append(button);
    });
  }

  modalContainer.append(header, bodyContainer, footer);
  overlay.append(modalContainer);

  return overlay;
}

/**
 * Show a temporary info modal
 */
export function showInfoModal(title: string, message: string, duration: number = 3000): void {
  const modal = createModal('info-modal-temp', title, message, [
    {
      text: 'OK',
      className: 'btn btn-primary',
      onClick: () => {
        const modalEl = $$id('info-modal-temp');
        if (modalEl !== null) {
          modalEl.remove();
        }
      },
    },
  ]);

  document.body.append(modal);
  showModal('info-modal-temp');

  // Auto-close after duration
  if (duration > 0) {
    setTimeout(() => {
      const modalEl = $$id('info-modal-temp');
      if (modalEl !== null) {
        modalEl.remove();
      }
    }, duration);
  }
}

/**
 * Show a confirmation modal
 */
export function showConfirmModal(title: string, message: string, onConfirm: () => void, onCancel?: () => void): void {
  const removeModal = () => {
    const modalEl = $$id('confirm-modal-temp');
    if (modalEl !== null) {
      modalEl.remove();
    }
  };

  const modal = createModal('confirm-modal-temp', title, message, [
    {
      text: 'Abbrechen',
      className: 'btn btn-secondary',
      onClick: () => {
        removeModal();
        onCancel?.();
      },
    },
    {
      text: 'Bestätigen',
      className: 'btn btn-primary',
      onClick: () => {
        removeModal();
        onConfirm();
      },
    },
  ]);

  document.body.append(modal);
  showModal('confirm-modal-temp');
}

// ============== ROTATION MODAL SPECIFIC ==============

/**
 * Show rotation setup modal
 */
export function showRotationModal(): void {
  showModal('rotation-setup-modal');
}

/**
 * Hide rotation setup modal
 */
export function hideRotationModal(): void {
  hideModal('rotation-setup-modal');
}

/**
 * Update rotation modal title based on edit mode
 */
export function updateRotationModalTitle(editMode: boolean): void {
  updateModalTitle('rotation-setup-modal', editMode ? 'Schichtrotation bearbeiten' : 'Schichtrotation einrichten');
}
