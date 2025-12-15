/**
 * Dropdown Filter Functions for Shift Planning System
 * Updated to use Design System classes (.dropdown, .dropdown__trigger, .dropdown__menu)
 */

// Type definitions for window extensions
interface FiltersWindow extends Window {
  toggleDropdown: typeof toggleDropdown;
  selectOption: typeof selectOption;
}

/**
 * Toggle dropdown visibility
 * @param type - The dropdown type selector (e.g., '#area', '#department')
 */
export function toggleDropdown(type: string): void {
  const trigger = document.querySelector<HTMLElement>(`${type}Display`);
  const menu = document.querySelector<HTMLElement>(`${type}Dropdown`);

  if (trigger === null || menu === null) {
    return;
  }

  // Close all other dropdowns first
  closeAllDropdowns();

  // Toggle current dropdown
  const isActive = menu.classList.contains('active');
  if (!isActive) {
    trigger.classList.add('active');
    menu.classList.add('active');
  }
}

/**
 * Close all dropdowns
 */
function closeAllDropdowns(): void {
  document.querySelectorAll<HTMLElement>('.dropdown__trigger.active').forEach((trigger) => {
    trigger.classList.remove('active');
  });
  document.querySelectorAll<HTMLElement>('.dropdown__menu.active').forEach((menu) => {
    menu.classList.remove('active');
  });
}

/**
 * Select an option from a dropdown
 * @param type - The dropdown type selector (e.g., '#area', '#department')
 * @param value - The value to set
 * @param text - The display text
 */
export function selectOption(type: string, value: string, text: string): void {
  const trigger = document.querySelector<HTMLElement>(`${type}Display`);
  const menu = document.querySelector<HTMLElement>(`${type}Dropdown`);
  const hiddenInput = document.querySelector<HTMLInputElement>(`${type}Select`);

  if (trigger === null || menu === null) {
    return;
  }

  const span = trigger.querySelector('span');
  if (span !== null) {
    span.textContent = text;
  }

  trigger.classList.remove('active');
  menu.classList.remove('active');

  // Set the hidden input value and trigger change event
  if (hiddenInput !== null) {
    hiddenInput.value = value;
    const event = new Event('change');
    hiddenInput.dispatchEvent(event);
  }
}

/**
 * Close all dropdowns when clicking outside
 */
function handleClickOutside(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  if (target.closest('.dropdown') === null) {
    closeAllDropdowns();
  }
}

/**
 * Handle dropdown toggle via clicking on trigger
 */
function handleDropdownToggle(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  const trigger = target.closest<HTMLElement>('.dropdown__trigger');

  if (trigger !== null) {
    e.preventDefault();
    e.stopPropagation();

    const dropdown = trigger.closest<HTMLElement>('.dropdown');
    const dropdownType = dropdown?.dataset['dropdown'];

    if (dropdownType !== undefined) {
      toggleDropdown(`#${dropdownType}`);
    }
  }
}

/**
 * Handle dropdown option click
 */
function handleOptionClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  const option = target.closest<HTMLElement>('.dropdown__option');

  if (option !== null) {
    e.preventDefault();
    e.stopPropagation();

    const dropdown = option.closest<HTMLElement>('.dropdown');
    const dropdownType = dropdown?.dataset['dropdown'];
    const value = option.dataset['value'] ?? '';
    const text = option.dataset['text'] ?? option.textContent.trim();

    if (dropdownType !== undefined) {
      selectOption(`#${dropdownType}`, value, text);

      // Dispatch custom event for index.ts to handle
      const event = new CustomEvent('dropdownChange', {
        detail: { type: dropdownType, value, text },
      });
      document.dispatchEvent(event);
    }
  }
}

// Guard to prevent double-initialization
let dropdownListenersInitialized = false;

/**
 * Initialize dropdown event listeners
 */
export function initDropdownListeners(): void {
  if (dropdownListenersInitialized) {
    return;
  }
  dropdownListenersInitialized = true;

  document.addEventListener('click', handleClickOutside);
  document.addEventListener('click', handleDropdownToggle);
  document.addEventListener('click', handleOptionClick);
}

// Make functions globally available for backwards compatibility
(window as unknown as FiltersWindow).toggleDropdown = toggleDropdown;
(window as unknown as FiltersWindow).selectOption = selectOption;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDropdownListeners);
} else {
  initDropdownListeners();
}
