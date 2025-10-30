/**
 * Area Management - Modal & Form Handling
 */

import { $$id } from '../../../utils/dom-utils';
import type { Area } from './types';
import { populateAreaForm, resetAreaForm } from './ui';

// Constants
const MODAL_ACTIVE_CLASS = 'modal-overlay--active';

/**
 * Show Add Area Modal
 */
export function showAddAreaModal(): void {
  const modal = $$id('area-modal');
  const form = $$id('area-form') as HTMLFormElement | null;

  if (form !== null) {
    form.reset();
  }

  resetAreaForm();
  modal?.classList.add(MODAL_ACTIVE_CLASS);
}

/**
 * Show Edit Area Modal
 */
export function showEditAreaModal(area: Area): void {
  const modal = $$id('area-modal');

  if (modal === null) return;

  modal.classList.add(MODAL_ACTIVE_CLASS);
  populateAreaForm(area);
}

/**
 * Close Area Modal
 */
export function closeAreaModal(): void {
  const modal = $$id('area-modal');
  const form = $$id('area-form') as HTMLFormElement | null;

  if (modal !== null) {
    modal.classList.remove(MODAL_ACTIVE_CLASS);
  }

  if (form !== null) {
    form.reset();
  }
}

/**
 * Show Delete Confirmation Modal
 */
export function showDeleteModal(id: number, name: string): void {
  const modal = $$id('delete-area-modal');
  const deleteIdInput = $$id('delete-area-id') as HTMLInputElement | null;
  const messageEl = $$id('delete-area-message');

  if (deleteIdInput !== null) {
    deleteIdInput.value = id.toString();
  }

  if (messageEl !== null) {
    messageEl.textContent = `Möchten Sie den Bereich "${name}" wirklich löschen?`;
  }

  modal?.classList.add(MODAL_ACTIVE_CLASS);
}

/**
 * Close Delete Modal
 */
export function closeDeleteModal(): void {
  const modal = $$id('delete-area-modal');
  const deleteIdInput = $$id('delete-area-id') as HTMLInputElement | null;

  if (modal !== null) {
    modal.classList.remove(MODAL_ACTIVE_CLASS);
  }

  if (deleteIdInput !== null) {
    deleteIdInput.value = '';
  }
}

/**
 * Initialize status dropdown (custom dropdown with badges)
 */
export function initStatusDropdown(): void {
  const trigger = document.querySelector('#status-trigger');
  const menu = document.querySelector('#status-menu');
  const hiddenInput = document.querySelector<HTMLInputElement>('#area-status');
  const options = document.querySelectorAll('#status-menu .dropdown__option');

  if (trigger === null || menu === null || hiddenInput === null) return;

  // Toggle dropdown
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    trigger.classList.toggle('active');
    menu.classList.toggle('active');
  });

  // Select option
  options.forEach((option) => {
    option.addEventListener('click', () => {
      const value = option.getAttribute('data-value');
      const badgeClone = option.querySelector('.badge')?.cloneNode(true) as HTMLElement | undefined;

      if (value !== null) {
        hiddenInput.value = value;
      }

      // Update trigger text with badge
      const triggerSpan = trigger.querySelector('span');
      if (triggerSpan !== null && badgeClone !== undefined) {
        triggerSpan.innerHTML = '';
        triggerSpan.appendChild(badgeClone);
      }

      trigger.classList.remove('active');
      menu.classList.remove('active');
    });
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!trigger.contains(e.target as Node) && !menu.contains(e.target as Node)) {
      trigger.classList.remove('active');
      menu.classList.remove('active');
    }
  });
}

/**
 * Initialize type dropdown
 */
export function initTypeDropdown(): void {
  const trigger = document.querySelector('#type-trigger');
  const menu = document.querySelector('#type-menu');
  const hiddenInput = document.querySelector<HTMLInputElement>('#area-type');
  const options = document.querySelectorAll('#type-menu .dropdown__option');

  if (trigger === null || menu === null || hiddenInput === null) return;

  // Toggle dropdown
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    trigger.classList.toggle('active');
    menu.classList.toggle('active');
  });

  // Select option
  options.forEach((option) => {
    option.addEventListener('click', () => {
      const value = option.getAttribute('data-value');
      const text = option.textContent;

      if (value !== null) {
        hiddenInput.value = value;
      }

      // Update trigger text
      const triggerSpan = trigger.querySelector('span');
      if (triggerSpan !== null) {
        // Safe: dropdown options always have text content in HTML
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        triggerSpan.textContent = text!;
      }

      trigger.classList.remove('active');
      menu.classList.remove('active');
    });
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!trigger.contains(e.target as Node) && !menu.contains(e.target as Node)) {
      trigger.classList.remove('active');
      menu.classList.remove('active');
    }
  });
}

/**
 * Initialize parent dropdown
 */
export function initParentDropdown(): void {
  const trigger = document.querySelector('#parent-trigger');
  const menu = document.querySelector('#parent-menu');
  const hiddenInput = document.querySelector<HTMLInputElement>('#area-parent');
  const dropdown = document.querySelector('#parent-dropdown');

  if (trigger === null || menu === null || hiddenInput === null || dropdown === null) return;

  // Toggle dropdown
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    trigger.classList.toggle('active');
    menu.classList.toggle('active');
  });

  // Handle option selection (delegated to menu)
  menu.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const option = target.closest('.dropdown__option');

    if (option === null || !(option instanceof HTMLElement)) {
      return;
    }

    const value = option.getAttribute('data-value');
    const text = option.textContent;

    if (value !== null) {
      hiddenInput.value = value;
    }

    // Update trigger text
    const triggerSpan = trigger.querySelector('span');
    if (triggerSpan !== null) {
      // Safe: dropdown options always have text content in HTML
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      triggerSpan.textContent = text!;
    }

    trigger.classList.remove('active');
    menu.classList.remove('active');
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target as Node)) {
      trigger.classList.remove('active');
      menu.classList.remove('active');
    }
  });
}

// Initialize dropdowns on page load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initStatusDropdown();
    initTypeDropdown();
    initParentDropdown();
  });
}
