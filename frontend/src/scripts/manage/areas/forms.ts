/**
 * Area Management - Modal & Form Handling
 */

import { $$id } from '../../../utils/dom-utils';
import type { Area, AdminUser } from './types';
import { populateAreaForm, resetAreaForm } from './ui';

// Constants
const MODAL_ACTIVE_CLASS = 'modal-overlay--active';

/**
 * Show Add Area Modal
 */
export function showAddAreaModal(): void {
  const modal = $$id('area-modal');
  const form = $$id('area-form') as HTMLFormElement | null;
  const modalTitle = $$id('area-modal-title');

  if (form !== null) {
    form.reset();
  }

  // Set modal title for add mode
  if (modalTitle !== null) {
    modalTitle.textContent = 'Neuer Bereich';
  }

  resetAreaForm();

  // Reset area lead dropdown trigger (form.reset() only clears hidden input, not trigger text)
  const leadTriggerSpan = $$id('area-lead-trigger')?.querySelector('span');
  if (leadTriggerSpan !== null && leadTriggerSpan !== undefined) {
    leadTriggerSpan.textContent = 'Kein Bereichsleiter';
  }

  // Hide status dropdown for CREATE (new areas are always active)
  const statusFieldGroup = document.querySelector('#status-field-group');
  statusFieldGroup?.classList.add('u-hidden');

  modal?.classList.add(MODAL_ACTIVE_CLASS);
}

/**
 * Show Edit Area Modal
 */
export function showEditAreaModal(area: Area): void {
  const modal = $$id('area-modal');
  const modalTitle = $$id('area-modal-title');

  if (modal === null) return;

  // Set modal title for edit mode
  if (modalTitle !== null) {
    modalTitle.textContent = 'Bereich bearbeiten';
  }

  // Show status dropdown for EDIT (allows changing status)
  const statusFieldGroup = document.querySelector('#status-field-group');
  statusFieldGroup?.classList.remove('u-hidden');

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
 * Maps UI values (active/inactive/archived) to DB fields (isActive + isArchived)
 */
export function initStatusDropdown(): void {
  const trigger = document.querySelector('#status-trigger');
  const menu = document.querySelector('#status-menu');
  const isActiveInput = document.querySelector<HTMLInputElement>('#area-is-active');
  const isArchivedInput = document.querySelector<HTMLInputElement>('#area-is-archived');
  const options = document.querySelectorAll('#status-menu .dropdown__option');

  if (trigger === null || menu === null || isActiveInput === null || isArchivedInput === null) return;

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

      // Map UI value to DB fields (isActive + isArchived)
      switch (value) {
        case 'active':
          isActiveInput.value = '1';
          isArchivedInput.value = '0';
          break;
        case 'inactive':
          isActiveInput.value = '0';
          isArchivedInput.value = '0';
          break;
        case 'archived':
          isActiveInput.value = '0';
          isArchivedInput.value = '1';
          break;
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
 * Helper: Set Area Lead Dropdown value (Custom Dropdown)
 */
export function setAreaLeadDropdown(area: Area): void {
  const leadInput = $$id('area-lead') as HTMLInputElement | null;
  const leadTrigger = $$id('area-lead-trigger');

  if (leadInput === null || leadTrigger === null) {
    return;
  }

  const leadValue = area.area_lead_id !== null && area.area_lead_id !== undefined ? String(area.area_lead_id) : '';
  leadInput.value = leadValue;

  const leadTriggerSpan = leadTrigger.querySelector('span');
  if (leadTriggerSpan !== null) {
    // Use || instead of ?? to handle empty strings and whitespace-only names
    const displayName = area.area_lead_name?.trim();
    leadTriggerSpan.textContent = displayName !== '' && displayName !== undefined ? displayName : 'Kein Bereichsleiter';
  }
}

/**
 * Load and populate area lead dropdown (Custom Dropdown)
 * Shows only admin/root users
 */
export function loadAndPopulateAreaLeads(users: AdminUser[]): void {
  const leadMenu = $$id('area-lead-menu');

  if (leadMenu === null) {
    return;
  }

  // Clear existing options and add default
  leadMenu.innerHTML = '<div class="dropdown__option" data-value="">Kein Bereichsleiter</div>';

  // Add user options
  users.forEach((user) => {
    const option = document.createElement('div');
    option.className = 'dropdown__option';
    option.dataset['value'] = String(user.id);
    const roleLabel = user.role === 'root' ? '(Root)' : '(Admin)';
    option.textContent = `${user.firstName} ${user.lastName} ${roleLabel}`;
    leadMenu.appendChild(option);
  });
}

/**
 * Initialize area lead dropdown
 */
export function initAreaLeadDropdown(): void {
  const trigger = document.querySelector('#area-lead-trigger');
  const menu = document.querySelector('#area-lead-menu');
  const dropdown = document.querySelector('#area-lead-dropdown');
  const hiddenInput = document.querySelector<HTMLInputElement>('#area-lead');

  if (trigger === null || menu === null || dropdown === null || hiddenInput === null) return;

  // Toggle dropdown
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    trigger.classList.toggle('active');
    menu.classList.toggle('active');
  });

  // Handle option selection (event delegation for dynamically added options)
  menu.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const option = target.closest('.dropdown__option');

    if (option === null || !(option instanceof HTMLElement)) {
      return;
    }

    const value = option.dataset['value'] ?? '';
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- DOM textContent can be null for certain node types
    const text = (option.textContent ?? '').trim();

    // Update hidden input
    hiddenInput.value = value;

    // Update trigger text
    const triggerSpan = trigger.querySelector('span');
    if (triggerSpan !== null) {
      triggerSpan.textContent = text !== '' ? text : 'Kein Bereichsleiter';
    }

    // Close dropdown
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

// NOTE: initParentDropdown removed (2025-11-29) - areas are now flat (non-hierarchical)

// Initialize dropdowns on page load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initStatusDropdown();
    initTypeDropdown();
    initAreaLeadDropdown();
  });
}
