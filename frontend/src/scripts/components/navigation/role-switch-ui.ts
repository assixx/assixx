/**
 * Role Switch UI Module
 * UI logic for role switching dropdown
 */

import { $$ } from '../../../utils/dom-utils';
import { switchRoleForRoot, switchRoleForAdmin } from '../../auth/role-switch';
import type { Role } from './types';

/**
 * Toggle dropdown visibility
 */
export function toggleDropdown(dropdownDisplay: HTMLElement, dropdownOptions: HTMLElement): void {
  const isActive = dropdownDisplay.classList.contains('active');

  if (isActive) {
    dropdownDisplay.classList.remove('active');
    dropdownOptions.classList.remove('active');
  } else {
    dropdownDisplay.classList.add('active');
    dropdownOptions.classList.add('active');
  }
}

/**
 * Setup dropdown toggle click handler
 */
export function setupDropdownToggle(dropdownDisplay: HTMLElement, dropdownOptions: HTMLElement): void {
  dropdownDisplay.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleDropdown(dropdownDisplay, dropdownOptions);
  });
}

/**
 * Handle role selection for root user
 */
export function handleRootRoleSelection(e: Event, dropdownDisplay: HTMLElement, dropdownOptions: HTMLElement): void {
  e.stopPropagation();

  const target = e.target as HTMLElement;
  const option = target.closest('.dropdown__option');

  if (!(option instanceof HTMLElement)) {
    return;
  }

  const selectedRole = option.dataset['value'] as Role;

  // Update display with icon and text
  const displaySpan = dropdownDisplay.querySelector('span');
  if (displaySpan) {
    // eslint-disable-next-line no-unsanitized/property -- Safe: copying our own generated HTML
    displaySpan.innerHTML = option.innerHTML;
  }

  // Close dropdown
  dropdownDisplay.classList.remove('active');
  dropdownOptions.classList.remove('active');

  // Call the role switch function
  void switchRoleForRoot(selectedRole);
}

/**
 * Handle role selection for admin user
 */
export function handleAdminRoleSelection(e: Event, dropdownDisplay: HTMLElement, dropdownOptions: HTMLElement): void {
  void (async () => {
    e.stopPropagation();

    const target = e.target as HTMLElement;
    const option = target.closest('.dropdown__option');

    if (!(option instanceof HTMLElement)) {
      return;
    }

    const roleValue = option.dataset['value'];
    if (roleValue !== 'admin' && roleValue !== 'employee') {
      return;
    }

    // Close dropdown
    dropdownDisplay.classList.remove('active');
    dropdownOptions.classList.remove('active');

    // Admin users can only switch between admin and employee
    await switchRoleForAdmin(roleValue);
  })();
}

/**
 * Setup role selection handlers for root user
 */
export function setupRootRoleSelectionHandlers(dropdownDisplay: HTMLElement, dropdownOptions: HTMLElement): void {
  const options = dropdownOptions.querySelectorAll('.dropdown__option');
  options.forEach((option) => {
    option.addEventListener('click', (e) => {
      handleRootRoleSelection(e, dropdownDisplay, dropdownOptions);
    });
  });
}

/**
 * Setup role selection handlers for admin user
 */
export function setupAdminRoleSelectionHandlers(dropdownDisplay: HTMLElement, dropdownOptions: HTMLElement): void {
  const options = dropdownOptions.querySelectorAll('.dropdown__option');
  options.forEach((option) => {
    option.addEventListener('click', (e) => {
      handleAdminRoleSelection(e, dropdownDisplay, dropdownOptions);
    });
  });
}

// Store reference to outside click handler for cleanup
let outsideClickHandler: ((e: Event) => void) | null = null;

/**
 * Setup outside click handler to close dropdown
 */
export function setupOutsideClickHandler(dropdownDisplay: HTMLElement, dropdownOptions: HTMLElement): void {
  // Remove previous handler if exists
  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler);
  }

  outsideClickHandler = (e: Event) => {
    if (!dropdownDisplay.contains(e.target as Node) && !dropdownOptions.contains(e.target as Node)) {
      dropdownDisplay.classList.remove('active');
      dropdownOptions.classList.remove('active');
    }
  };

  document.addEventListener('click', outsideClickHandler);
}

/**
 * Initialize role switch dropdown for root user
 */
export function initializeRoleSwitchForRoot(): void {
  const userRole = localStorage.getItem('userRole');

  if (userRole !== 'root') {
    return;
  }

  const dropdownDisplay = $$('#roleSwitchDisplay');
  const dropdownOptions = $$('#roleSwitchDropdown');

  if (!dropdownDisplay || !dropdownOptions) {
    return;
  }

  // Check if already initialized
  if (Object.prototype.hasOwnProperty.call(dropdownDisplay.dataset, 'initialized')) {
    return;
  }

  // Mark as initialized
  dropdownDisplay.dataset['initialized'] = 'true';

  setupDropdownToggle(dropdownDisplay, dropdownOptions);
  setupRootRoleSelectionHandlers(dropdownDisplay, dropdownOptions);
  setupOutsideClickHandler(dropdownDisplay, dropdownOptions);
}

/**
 * Initialize role switch dropdown for admin user
 */
export function initializeRoleSwitchForAdmin(): void {
  const userRole = localStorage.getItem('userRole');

  if (userRole !== 'admin') {
    return;
  }

  const dropdownDisplay = $$('#roleSwitchDisplay');
  const dropdownOptions = $$('#roleSwitchDropdown');

  if (!dropdownDisplay || !dropdownOptions) {
    return;
  }

  // Check if already initialized
  if (Object.prototype.hasOwnProperty.call(dropdownDisplay.dataset, 'initialized')) {
    return;
  }

  // Mark as initialized
  dropdownDisplay.dataset['initialized'] = 'true';

  setupDropdownToggle(dropdownDisplay, dropdownOptions);
  setupAdminRoleSelectionHandlers(dropdownDisplay, dropdownOptions);
  setupOutsideClickHandler(dropdownDisplay, dropdownOptions);
}

/**
 * Initialize role switch for any user role
 */
export function initializeRoleSwitch(): void {
  const userRole = localStorage.getItem('userRole');

  if (userRole === 'root') {
    initializeRoleSwitchForRoot();
  } else if (userRole === 'admin') {
    initializeRoleSwitchForAdmin();
  }
}
