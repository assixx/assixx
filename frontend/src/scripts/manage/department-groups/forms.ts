/**
 * Department Groups Forms - Modal Management
 */

import { $$id } from '../../../utils/dom-utils';
import type { DepartmentGroup, WindowWithGroupHandlers } from './types';

// Constants
const MODAL_ACTIVE_CLASS = 'modal-overlay--active';

/**
 * Show modal for adding a new group
 */
export function showAddGroupModal(): void {
  const modal = $$id('group-modal');
  const title = $$id('group-modal-title');
  const form = $$id('group-form');
  const groupIdInput = $$id('group-id');

  if (title !== null) {
    title.textContent = 'Neue Abteilungsgruppe erstellen';
  }

  if (form instanceof HTMLFormElement) {
    form.reset();
  }

  if (groupIdInput instanceof HTMLInputElement) {
    groupIdInput.value = '';
  }

  modal?.classList.add(MODAL_ACTIVE_CLASS);
}

/**
 * Show modal for editing an existing group
 */
export function showEditGroupModal(group: DepartmentGroup): void {
  const modal = $$id('group-modal');
  const title = $$id('group-modal-title');
  const groupIdInput = $$id('group-id');

  if (title !== null) {
    title.textContent = 'Gruppe bearbeiten';
  }

  // Set group ID for update
  if (groupIdInput instanceof HTMLInputElement) {
    groupIdInput.value = group.id.toString();
  }

  // Fill form fields
  const nameInput = $$id('group-name');
  if (nameInput instanceof HTMLInputElement) {
    nameInput.value = group.name;
  }

  const descriptionInput = $$id('group-description');
  if (descriptionInput instanceof HTMLTextAreaElement) {
    descriptionInput.value = group.description ?? '';
  }

  // Set parent group in custom dropdown
  const parentInput = $$id('parent-group');
  const parentLabel = $$id('parent-group-label');
  if (parentInput instanceof HTMLInputElement && parentLabel !== null) {
    const parentId = group.parentGroupId?.toString() ?? '';
    parentInput.value = parentId;

    // Update label text
    if (parentId === '') {
      parentLabel.textContent = 'Keine (Hauptgruppe)';
    } else if (group.parentName !== undefined) {
      parentLabel.textContent = group.parentName;
    }
  }

  modal?.classList.add(MODAL_ACTIVE_CLASS);
}

/**
 * Close group modal
 */
export function closeGroupModal(): void {
  const modal = $$id('group-modal');
  modal?.classList.remove(MODAL_ACTIVE_CLASS);

  const form = $$id('group-form');
  if (form instanceof HTMLFormElement) {
    form.reset();
  }

  const groupIdInput = $$id('group-id');
  if (groupIdInput instanceof HTMLInputElement) {
    groupIdInput.value = '';
  }

  // Reset custom dropdown
  const parentInput = $$id('parent-group');
  const parentLabel = $$id('parent-group-label');
  if (parentInput instanceof HTMLInputElement) {
    parentInput.value = '';
  }
  if (parentLabel !== null) {
    parentLabel.textContent = 'Keine (Hauptgruppe)';
  }
}

/**
 * Show delete confirmation modal
 */
export function showDeleteModal(id: number, name: string): void {
  const modal = $$id('delete-group-modal');
  const deleteIdInput = $$id('delete-group-id');

  if (deleteIdInput instanceof HTMLInputElement) {
    deleteIdInput.value = id.toString();
  }

  // Update modal body with group name
  const modalBody = modal?.querySelector('.ds-modal__body p');
  if (modalBody !== null && modalBody !== undefined) {
    modalBody.textContent = `Möchten Sie die Gruppe "${name}" wirklich löschen?`;
  }

  modal?.classList.add(MODAL_ACTIVE_CLASS);
}

/**
 * Close delete confirmation modal
 */
export function closeDeleteModal(): void {
  const modal = $$id('delete-group-modal');
  modal?.classList.remove(MODAL_ACTIVE_CLASS);

  const deleteIdInput = $$id('delete-group-id');
  if (deleteIdInput instanceof HTMLInputElement) {
    deleteIdInput.value = '';
  }
}

/**
 * Setup form submit handler
 * Prevents default form submission and calls window.saveGroup()
 */
export function setupFormSubmitHandler(): void {
  const form = $$id('group-form');
  if (!(form instanceof HTMLFormElement)) {
    console.warn('[setupFormSubmitHandler] Form not found');
    return;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const w = window as WindowWithGroupHandlers;
    void w.saveGroup?.();
  });
}

/**
 * Reset modal scroll position
 * Called after modal is opened to ensure modal body is scrolled to top
 */
export function resetModalScroll(): void {
  const modalBody = document.querySelector('.ds-modal__body');
  if (modalBody !== null) {
    modalBody.scrollTop = 0;
  }
}

/**
 * Set dropdown visibility styles
 */
function setDropdownStyles(menu: HTMLElement, isVisible: boolean): void {
  if (isVisible) {
    menu.style.visibility = 'visible';
    menu.style.opacity = '1';
    menu.style.transform = 'translateY(0)';
  } else {
    menu.style.visibility = 'hidden';
    menu.style.opacity = '0';
    menu.style.transform = 'translateY(-10px)';
  }
}

/**
 * Toggle dropdown state
 */
function toggleDropdown(trigger: HTMLElement, menu: HTMLElement, isOpen: boolean): void {
  if (isOpen) {
    trigger.classList.add('active');
    menu.classList.add('active');
  } else {
    trigger.classList.remove('active');
    menu.classList.remove('active');
  }
  setDropdownStyles(menu, isOpen);
}

/**
 * Handle dropdown option selection
 */
function handleDropdownSelection(
  e: Event,
  menu: HTMLElement,
  trigger: HTMLElement,
  hiddenInput: HTMLElement,
  label: HTMLElement,
): void {
  const option = (e.target as HTMLElement).closest<HTMLElement>('.dropdown__option');
  if (option === null) return;

  const value = option.dataset.value ?? '';
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- textContent can be null
  const text = option.textContent !== null ? option.textContent.trim() : '';

  if (hiddenInput instanceof HTMLInputElement) {
    hiddenInput.value = value;
  }
  label.textContent = text;

  toggleDropdown(trigger, menu, false);
}

/**
 * Setup custom dropdown interaction for parent group selection
 * Handles open/close, selection, and outside click
 */
export function setupParentGroupDropdown(): void {
  const setupId = Math.random().toString(36).substring(2, 11);
  console.log('[setupParentGroupDropdown] Called with ID:', setupId);

  const trigger = $$id('parent-group-trigger');
  const menu = $$id('parent-group-menu');
  const hiddenInput = $$id('parent-group');
  const label = $$id('parent-group-label');

  if (trigger === null || menu === null || hiddenInput === null || label === null) {
    console.warn('[setupParentGroupDropdown] Required elements not found');
    return;
  }

  // Toggle dropdown on trigger click
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = menu.classList.contains('active');
    toggleDropdown(trigger, menu, !isActive);
    console.log('[setupParentGroupDropdown] Toggled:', { isActive: !isActive, setupId });
  });

  // Handle option selection
  menu.addEventListener('click', (e) => {
    handleDropdownSelection(e, menu, trigger, hiddenInput, label);
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const dropdown = $$id('parent-group-dropdown');
    if (dropdown !== null && !dropdown.contains(target)) {
      toggleDropdown(trigger, menu, false);
    }
  });
}
