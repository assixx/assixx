/**
 * Logs page UI utilities
 * Handles dropdown interactions, modal management, and delete confirmation
 *
 * @module logs/ui
 */

import { $$, setHTML } from '../../utils/dom-utils';

// ============== TYPES ==============

/** Filter configuration for delete confirmation */
interface LogFilters {
  action?: string | undefined;
  user?: string | undefined;
  entity_type?: string | undefined;
  timerange?: string | undefined;
}

// ============== DROPDOWN FUNCTIONS ==============

/**
 * Toggle a dropdown open/closed
 * Uses Design System: .dropdown__trigger, .dropdown__menu
 * @param dropdownId - The ID selector for the dropdown (e.g., '#action')
 */
export function toggleDropdown(dropdownId: string): void {
  const trigger = $$(dropdownId + 'Display');
  const menu = $$(dropdownId + 'Dropdown');

  if (!trigger || !menu) return;

  // Close all other dropdowns (Design System classes)
  document.querySelectorAll('.dropdown__trigger').forEach((d) => {
    if (d.id !== dropdownId.replace('#', '') + 'Display') {
      d.classList.remove('active');
    }
  });
  document.querySelectorAll('.dropdown__menu').forEach((d) => {
    if (d.id !== dropdownId.replace('#', '') + 'Dropdown') {
      d.classList.remove('active');
    }
  });

  // Toggle current dropdown
  trigger.classList.toggle('active');
  menu.classList.toggle('active');
}

/**
 * Select an option from a dropdown
 * Uses Design System: .dropdown__trigger, .dropdown__menu, .dropdown__option
 * @param dropdownId - The ID selector for the dropdown (e.g., '#action')
 * @param value - The value to set
 * @param text - The display text
 */
export function selectOption(dropdownId: string, value: string, text: string): void {
  const trigger = $$(dropdownId + 'Display');
  const menu = $$(dropdownId + 'Dropdown');
  const input = $$('#filter-' + dropdownId.replace('#', '')) as HTMLInputElement | null;

  if (!trigger || !menu) return;

  // Update trigger text
  const span = trigger.querySelector('span');
  if (span) {
    span.textContent = text;
  }

  // Update hidden input value
  if (input) {
    input.value = value;
  }

  // Close dropdown
  trigger.classList.remove('active');
  menu.classList.remove('active');

  // Mark selected option (Design System class)
  menu.querySelectorAll('.dropdown__option').forEach((option) => {
    option.classList.remove('selected');
    if (option.textContent.trim() === text) {
      option.classList.add('selected');
    }
  });
}

/**
 * Handle toggle-dropdown action from data attribute
 */
export function handleToggleDropdown(element: HTMLElement): void {
  const dropdown = element.dataset['dropdown'];
  if (dropdown !== undefined && dropdown !== '') {
    toggleDropdown('#' + dropdown);
  }
}

/**
 * Handle select-option action from data attribute
 */
export function handleSelectOption(element: HTMLElement): void {
  const type = element.dataset['type'];
  const value = element.dataset['value'];
  const text = element.dataset['text'];
  if (
    type !== undefined &&
    type !== '' &&
    value !== undefined &&
    value !== '' &&
    text !== undefined &&
    text !== ''
  ) {
    selectOption('#' + type, value, text);
  }
}

/**
 * Close all open dropdowns (when clicking outside)
 * Uses Design System: .dropdown__trigger, .dropdown__menu
 */
export function closeAllDropdowns(): void {
  document.querySelectorAll('.dropdown__trigger').forEach((d) => {
    d.classList.remove('active');
  });
  document.querySelectorAll('.dropdown__menu').forEach((d) => {
    d.classList.remove('active');
  });
}

/**
 * Reset all dropdown displays to their default state
 * Uses Design System: .dropdown__option
 */
export function resetDropdownDisplays(): void {
  // Reset action dropdown
  const actionDisplay = $$('#actionDisplay span');
  if (actionDisplay) actionDisplay.textContent = 'Alle Aktionen';

  // Reset entity dropdown
  const entityDisplay = $$('#entityDisplay span');
  if (entityDisplay) entityDisplay.textContent = 'Alle Typen';

  // Reset timerange dropdown
  const timerangeDisplay = $$('#timerangeDisplay span');
  if (timerangeDisplay) timerangeDisplay.textContent = 'Alle Zeit';

  // Clear selected state from all options (Design System class)
  document.querySelectorAll('.dropdown__option').forEach((option) => {
    option.classList.remove('selected');
  });
}

// ============== MODAL FUNCTIONS ==============

/**
 * Open the delete logs modal
 */
export function openDeleteLogsModal(): void {
  const modal = $$('#deleteLogsModal');
  if (modal) {
    modal.classList.add('modal-overlay--active');
  }
}

/**
 * Close the delete logs modal and reset its state
 */
export function closeDeleteLogsModal(): void {
  const modal = $$('#deleteLogsModal');
  const confirmInput = $$('#deleteLogsConfirmation') as HTMLInputElement | null;
  const passwordInput = $$('#deleteLogsPassword') as HTMLInputElement | null;
  const confirmBtn = $$('#confirmDeleteLogsBtn') as HTMLButtonElement | null;

  if (modal) {
    modal.classList.remove('modal-overlay--active');
  }
  if (confirmInput) {
    confirmInput.value = '';
  }
  if (passwordInput) {
    passwordInput.value = '';
  }
  if (confirmBtn) {
    confirmBtn.disabled = true;
  }
}

/**
 * Update the delete confirmation button state based on input validation
 * Password is ALWAYS required for audit log deletion
 */
export function updateDeleteConfirmButtonState(): void {
  const confirmInput = $$('#deleteLogsConfirmation') as HTMLInputElement | null;
  const passwordInput = $$('#deleteLogsPassword') as HTMLInputElement | null;
  const confirmBtn = $$('#confirmDeleteLogsBtn') as HTMLButtonElement | null;

  if (!confirmBtn || !confirmInput) return;

  const confirmValue = confirmInput.value;
  const passwordValue = passwordInput?.value ?? '';

  // Both "LÖSCHEN" text and password are ALWAYS required for audit log deletion
  confirmBtn.disabled = confirmValue !== 'LÖSCHEN' || passwordValue === '';
}

/**
 * Display active filters in the delete confirmation modal
 */
export function displayActiveFilters(filters: LogFilters): void {
  const container = $$('#activeFiltersDisplay');
  if (!container) return;

  const filterLabels: Record<string, string> = {
    action: 'Aktion',
    user: 'Benutzer',
    entity_type: 'Entitätstyp',
    timerange: 'Zeitraum',
  };

  const activeFilters: string[] = [];

  // Iterate over known filter keys only (safe from injection)
  const filterKeys = ['action', 'user', 'entity_type', 'timerange'] as const;
  for (const key of filterKeys) {
    // eslint-disable-next-line security/detect-object-injection -- key is from const array, not user input
    const value = filters[key];
    if (value !== undefined && value !== '' && value !== 'all') {
      // eslint-disable-next-line security/detect-object-injection -- key is from const array, not user input
      const label: string = filterLabels[key] ?? key;
      activeFilters.push(`<span class="badge badge--info mr-2 mb-2">${label}: ${value}</span>`);
    }
  }

  if (activeFilters.length === 0) {
    setHTML(
      container,
      '<span class="text-[var(--color-text-secondary)]">Keine spezifischen Filter aktiv (ALLE Logs werden gelöscht!)</span>',
    );
  } else {
    setHTML(container, activeFilters.join(''));
  }
}

// ============== INITIALIZATION ==============

/**
 * Initialize UI event listeners
 */
export function initLogsUI(): void {
  // Close dropdowns when clicking outside (Design System: .dropdown)
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.dropdown')) {
      closeAllDropdowns();
    }
  });

  // Delete confirmation input listeners
  const confirmInput = $$('#deleteLogsConfirmation');
  const passwordInput = $$('#deleteLogsPassword');

  if (confirmInput) {
    confirmInput.addEventListener('input', updateDeleteConfirmButtonState);
  }
  if (passwordInput) {
    passwordInput.addEventListener('input', updateDeleteConfirmButtonState);
  }

  // Keyboard support for modal (Escape to close)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = $$('#deleteLogsModal');
      if (modal?.classList.contains('modal-overlay--active') === true) {
        closeDeleteLogsModal();
      }
    }
  });
}
