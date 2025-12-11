/**
 * Event Handling Utilities for Shift Planning System
 * Event listener setup and common handler patterns
 */

import { CSS_SELECTORS } from './constants';

// ============== EVENT LISTENER SETUP ==============

/**
 * Setup week navigation button listeners
 */
export function setupWeekNavigation(onPrevWeek: () => void, onNextWeek: () => void): void {
  const prevBtn = document.querySelector('#prevWeekBtn');
  const nextBtn = document.querySelector('#nextWeekBtn');

  if (prevBtn !== null) {
    prevBtn.addEventListener('click', onPrevWeek);
  } else {
    console.error('[SHIFTS ERROR] Previous week button not found!');
  }

  if (nextBtn !== null) {
    nextBtn.addEventListener('click', onNextWeek);
  } else {
    console.error('[SHIFTS ERROR] Next week button not found!');
  }
}

/**
 * Setup notes toggle functionality
 */
export function setupNotesToggle(notesToggleSelector: string, notesPanelSelector: string): void {
  const notesToggle = document.querySelector(notesToggleSelector);
  const notesPanel = document.querySelector(notesPanelSelector);
  const notesTextarea = document.querySelector('#weeklyNotes');

  if (notesToggle !== null && notesPanel !== null) {
    notesToggle.addEventListener('click', () => {
      notesPanel.classList.toggle('show');
      if (notesPanel.classList.contains('show') && notesTextarea !== null) {
        (notesTextarea as HTMLTextAreaElement).focus();
      }
    });
  }
}

/**
 * Setup admin action buttons (save, reset)
 */
export function setupAdminActions(onSave: () => void, onReset: () => void): void {
  document.querySelector('#saveScheduleBtn')?.addEventListener('click', onSave);
  document.querySelector('#resetScheduleBtn')?.addEventListener('click', onReset);
}

// ============== DROPDOWN EVENT HANDLERS ==============

/**
 * Setup custom dropdown change event listener
 */
export function setupDropdownChangeListener(displayElementId: string, onValueChange: (value: string) => void): void {
  const displayElement = document.querySelector(`#${displayElementId}`);
  if (displayElement !== null) {
    displayElement.addEventListener('dropdownChange', (e) => {
      const event = e as CustomEvent<{ value: string }>;
      onValueChange(event.detail.value);
    });
  }
}

/**
 * Handle dropdown option click
 */
export function handleDropdownOptionClick(
  target: HTMLElement,
  onSelect: (type: string, value: string, text: string) => void,
): boolean {
  const option = target.closest<HTMLElement>('.dropdown__option');
  if (option === null) return false;

  const type = option.dataset['type'];
  const value = option.dataset['value'];
  const text = option.dataset['text'];

  if (type !== undefined && type !== '' && value !== undefined && value !== '' && text !== undefined && text !== '') {
    onSelect(type, value, text);
    return true;
  }

  return false;
}

// ============== SHIFT CELL EVENT HANDLERS ==============

/**
 * Setup shift cell click handler
 */
export function setupShiftCellClickHandler(
  onAdminClick: (cell: HTMLElement) => void,
  onEmployeeClick: (cell: HTMLElement) => void,
  isAdmin: boolean,
): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const shiftCell = target.closest(CSS_SELECTORS.SHIFT_CELL);

    if (shiftCell !== null) {
      if (isAdmin) {
        onAdminClick(shiftCell as HTMLElement);
      } else {
        onEmployeeClick(shiftCell as HTMLElement);
      }
    }
  });
}

/**
 * Check if target is a remove shift button
 */
export function isRemoveShiftButton(target: HTMLElement): boolean {
  return target.dataset['action'] === 'remove-shift' || target.parentElement?.dataset['action'] === 'remove-shift';
}

/**
 * Get remove button data from target
 */
export function getRemoveButtonData(target: HTMLElement): {
  employeeId: string | undefined;
  cell: HTMLElement | null;
} | null {
  const btn = target.dataset['action'] === 'remove-shift' ? target : target.parentElement;
  if (btn === null) return null;

  const employeeId = btn.dataset['employeeId'];
  const card = btn.closest('.employee-card');
  const cell = card?.closest(CSS_SELECTORS.SHIFT_CELL) as HTMLElement | null;

  return { employeeId, cell };
}

// ============== MODAL EVENT HANDLERS ==============

/**
 * Check if target is a close modal button
 */
export function isCloseModalButton(target: HTMLElement): boolean {
  return target.dataset['action'] === 'close-modal';
}

/**
 * Close modal by target
 */
export function closeModalByTarget(target: HTMLElement): void {
  const modal = target.closest('.modal-overlay');
  if (modal !== null) {
    modal.classList.remove('modal-overlay--active');
    setTimeout(() => {
      modal.remove();
    }, 300);
  }
}

// ============== EMPLOYEE SELECTION ==============

/**
 * Setup employee selection handler
 */
export function setupEmployeeSelection(onSelect: (employeeItem: HTMLElement) => void): () => void {
  let mouseDownTime = 0;

  const handleMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const employeeItem = target.closest(CSS_SELECTORS.EMPLOYEE_ITEM);
    if (employeeItem !== null && employeeItem.getAttribute('draggable') === 'false') {
      mouseDownTime = Date.now();
    }
  };

  const handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const employeeItem = target.closest(CSS_SELECTORS.EMPLOYEE_ITEM);
    // Quick click detection (less than 200ms between mousedown and click)
    if (employeeItem !== null && Date.now() - mouseDownTime < 200) {
      onSelect(employeeItem as HTMLElement);
    }
  };

  document.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('click', handleClick);

  // Return cleanup function
  return () => {
    document.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('click', handleClick);
  };
}

// ============== KEYBOARD EVENTS ==============

/**
 * Setup keyboard shortcut handler
 */
export function setupKeyboardShortcut(
  key: string,
  modifiers: { ctrl?: boolean; shift?: boolean; alt?: boolean },
  handler: () => void,
): () => void {
  const handleKeyDown = (e: KeyboardEvent) => {
    const ctrlMatch = modifiers.ctrl === undefined || e.ctrlKey === modifiers.ctrl;
    const shiftMatch = modifiers.shift === undefined || e.shiftKey === modifiers.shift;
    const altMatch = modifiers.alt === undefined || e.altKey === modifiers.alt;

    if (e.key.toLowerCase() === key.toLowerCase() && ctrlMatch && shiftMatch && altMatch) {
      e.preventDefault();
      handler();
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  return () => {
    document.removeEventListener('keydown', handleKeyDown);
  };
}

// ============== GLOBAL CLICK DELEGATION ==============

/**
 * Setup global click handler for action buttons
 */
export function setupGlobalActionHandler(
  actionHandlers: Map<string, (target: HTMLElement, event: Event) => void>,
): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const actionElement = target.closest<HTMLElement>('[data-action]');

    if (actionElement !== null) {
      const action = actionElement.dataset['action'];
      if (action !== undefined) {
        const handler = actionHandlers.get(action);
        if (handler !== undefined) {
          handler(actionElement, e);
        }
      }
    }
  });
}

// ============== FORM EVENTS ==============

/**
 * Setup checkbox change handler
 */
export function setupCheckboxHandler(checkboxId: string, onChange: (checked: boolean) => void): void {
  const checkbox = document.querySelector<HTMLInputElement>(`#${checkboxId}`);
  console.info(`[EVENTS] Setting up checkbox handler for: #${checkboxId}`, checkbox !== null ? 'FOUND' : 'NOT FOUND');
  if (checkbox !== null) {
    checkbox.addEventListener('change', () => {
      console.info(`[EVENTS] Checkbox ${checkboxId} changed to:`, checkbox.checked);
      onChange(checkbox.checked);
    });
  } else {
    console.warn(`[EVENTS] Checkbox #${checkboxId} not found in DOM`);
  }
}

/**
 * Setup select change handler
 */
export function setupSelectHandler(selectId: string, onChange: (value: string) => void): void {
  const select = document.querySelector<HTMLSelectElement>(`#${selectId}`);
  if (select !== null) {
    select.addEventListener('change', () => {
      onChange(select.value);
    });
  }
}

/**
 * Setup custom dropdown (like in manage-admins modals)
 * Uses .active class on trigger and menu (matching design-system CSS)
 * @param triggerId - ID of the trigger element (e.g., 'rotation-pattern-trigger')
 * @param menuId - ID of the menu element (e.g., 'rotation-pattern-menu')
 * @param hiddenInputId - ID of the hidden input to store selected value (e.g., 'rotation-pattern')
 * @param onChange - Callback when selection changes
 */
export function setupCustomDropdown(
  triggerId: string,
  menuId: string,
  hiddenInputId: string,
  onChange?: (value: string) => void,
): void {
  const trigger = document.querySelector<HTMLElement>(`#${triggerId}`);
  const menu = document.querySelector<HTMLElement>(`#${menuId}`);
  const hiddenInput = document.querySelector<HTMLInputElement>(`#${hiddenInputId}`);

  if (trigger === null || menu === null) {
    console.warn(`[EVENTS] Custom dropdown setup failed - missing elements: trigger=${triggerId}, menu=${menuId}`);
    return;
  }

  // Get options from menu
  const options = menu.querySelectorAll('.dropdown__option');

  // Toggle dropdown on trigger click
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    trigger.classList.toggle('active');
    menu.classList.toggle('active');
  });

  // Handle option selection
  options.forEach((option) => {
    option.addEventListener('click', () => {
      const htmlOption = option as HTMLElement;
      const value = htmlOption.dataset['value'] ?? '';
      const text = htmlOption.textContent;

      // Update hidden input
      if (hiddenInput !== null) {
        hiddenInput.value = value;
      }

      // Update trigger text
      const triggerSpan = trigger.querySelector('span');
      if (triggerSpan !== null) {
        triggerSpan.textContent = text;
      }

      // Close dropdown
      menu.classList.remove('active');
      trigger.classList.remove('active');

      // Call onChange callback
      onChange?.(value);
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!trigger.contains(target) && !menu.contains(target)) {
      menu.classList.remove('active');
      trigger.classList.remove('active');
    }
  });
}

/**
 * Reset custom dropdown to default state
 */
export function resetCustomDropdown(
  triggerId: string,
  hiddenInputId: string,
  defaultText: string = 'Bitte wählen...',
): void {
  const trigger = document.querySelector<HTMLElement>(`#${triggerId}`);
  const hiddenInput = document.querySelector<HTMLInputElement>(`#${hiddenInputId}`);

  if (trigger !== null) {
    const triggerSpan = trigger.querySelector('span');
    if (triggerSpan !== null) {
      triggerSpan.textContent = defaultText;
    }
  }

  if (hiddenInput !== null) {
    hiddenInput.value = '';
  }

  // Clear selected state from options
  const menu = trigger?.nextElementSibling;
  if (menu !== null && menu !== undefined) {
    menu.querySelectorAll('.dropdown__option').forEach((opt) => {
      opt.classList.remove('selected');
    });
  }
}

/**
 * Set custom dropdown value programmatically
 */
export function setCustomDropdownValue(triggerId: string, menuId: string, hiddenInputId: string, value: string): void {
  const trigger = document.querySelector<HTMLElement>(`#${triggerId}`);
  const menu = document.querySelector<HTMLElement>(`#${menuId}`);
  const hiddenInput = document.querySelector<HTMLInputElement>(`#${hiddenInputId}`);

  if (trigger === null || menu === null || hiddenInput === null) return;

  // Find matching option
  const option = menu.querySelector<HTMLElement>(`.dropdown__option[data-value="${value}"]`);

  if (option !== null) {
    const text = option.textContent;

    // Update hidden input
    hiddenInput.value = value;

    // Update trigger text
    const triggerSpan = trigger.querySelector('span');
    if (triggerSpan !== null) {
      triggerSpan.textContent = text;
    }

    // Mark option as selected
    menu.querySelectorAll('.dropdown__option').forEach((opt) => {
      opt.classList.remove('selected');
    });
    option.classList.add('selected');
  }
}

/**
 * Setup date input change handler with auto-adjust
 */
export function setupDateInputAutoAdjust(
  startInputId: string,
  endInputId: string,
  calculateEndDate: (startDate: Date) => Date,
): void {
  const startInput = document.querySelector<HTMLInputElement>(`#${startInputId}`);
  const endInput = document.querySelector<HTMLInputElement>(`#${endInputId}`);

  if (startInput !== null && endInput !== null) {
    startInput.addEventListener('change', () => {
      const newStartDate = new Date(startInput.value);
      const newEndDate = calculateEndDate(newStartDate);
      const endDateString = newEndDate.toISOString().split('T')[0];
      if (endDateString !== undefined) {
        endInput.value = endDateString;
      }
    });
  }
}
