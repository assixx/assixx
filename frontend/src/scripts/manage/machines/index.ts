/**
 * Machine Management - Main Controller
 * Orchestration, event handling, and business logic
 */

import { showSuccessAlert, showErrorAlert } from '../../utils/alerts';
// Import from types
import type { Machine, MachineStatusFilter, ManageMachinesWindow } from './types';
// Import from data layer
import { machines, loadMachines, deleteMachine as deleteMachineAPI } from './data';
// Import from UI layer
import { renderMachinesTable, renderSearchResults, closeSearchResults, showDeleteConfirmationModal } from './ui';
// Import from forms layer
import {
  showAddMachineModal,
  closeMachineModal,
  editMachineHandler,
  viewMachineDetailsHandler,
  handleFormSubmit,
} from './forms';

// DOM Elements
let addMachineBtn: HTMLButtonElement | null;
let machineForm: HTMLFormElement | null;
let loadingDiv: HTMLElement | null;
let emptyDiv: HTMLElement | null;
let searchInput: HTMLInputElement | null;
let searchClearBtn: HTMLButtonElement | null;

// Search state
let filteredMachines: Machine[] = [];
let selectedResultIndex = -1;

// Filter state
let currentStatusFilter: MachineStatusFilter = 'all';

// Constants
const SEARCH_INPUT_HAS_VALUE_CLASS = 'search-input--has-value';

// ===== MACHINE OPERATIONS =====

/**
 * Load machines and render table
 */
async function loadMachinesAndRender(): Promise<void> {
  console.info('[MachinesController] loadMachinesAndRender called');

  // Show loading state
  loadingDiv?.classList.remove('u-hidden');
  emptyDiv?.classList.add('u-hidden');

  try {
    const searchTerm = searchInput?.value ?? '';
    const statusFilter = currentStatusFilter === 'all' ? undefined : currentStatusFilter;

    await loadMachines(statusFilter, searchTerm);
    renderMachinesTable(machines, currentStatusFilter);
  } catch (error) {
    console.error('Fehler:', error);
    showErrorAlert('Netzwerkfehler beim Laden der Maschinen');
    // Hide loading on error
    loadingDiv?.classList.add('u-hidden');
  }
}

/**
 * Delete machine handler
 */
async function deleteMachineHandler(machineId: number): Promise<void> {
  console.info('[MachinesController] deleteMachineHandler called with ID:', machineId);

  // Convert to string for comparison since API returns string IDs
  const machine = machines.find((m) => String(m.id) === String(machineId));

  if (machine === undefined) {
    console.error('Machine not found for ID:', machineId);
    showErrorAlert('Maschine nicht gefunden');
    return;
  }

  console.info('Found machine:', machine);

  const confirmDelete = await showDeleteConfirmationModal(machine);

  if (!confirmDelete) {
    console.info('Delete cancelled');
    return;
  }

  try {
    await deleteMachineAPI(machineId);

    // Reload machines table
    await loadMachinesAndRender();
    showSuccessAlert('Maschine gelöscht');
  } catch (error) {
    console.error('Error deleting machine:', error);
    const errorMessage = error instanceof Error ? error.message : 'Netzwerkfehler beim Löschen';
    showErrorAlert(errorMessage);
  }
}

// ===== GLOBAL FUNCTIONS SETUP =====

/**
 * Setup global functions for inline event handlers
 */
function setupGlobalFunctions(): void {
  (window as unknown as ManageMachinesWindow).editMachine = editMachineHandler;
  (window as unknown as ManageMachinesWindow).deleteMachine = deleteMachineHandler;
  (window as unknown as ManageMachinesWindow).viewMachineDetails = viewMachineDetailsHandler;
  (window as unknown as ManageMachinesWindow).showMachineModal = showAddMachineModal;
  (window as unknown as ManageMachinesWindow).closeMachineModal = closeMachineModal;
}

// ===== FILTER & SEARCH LOGIC =====

/**
 * Filter machines based on status
 */
function filterByStatus(machinesList: Machine[], status: MachineStatusFilter): Machine[] {
  if (status === 'all') {
    return machinesList;
  }

  return machinesList.filter((machine) => machine.status === status);
}

/**
 * Filter machines based on search query
 */
function filterBySearch(machinesList: Machine[], query: string): Machine[] {
  const searchTerm = query.toLowerCase().trim();

  if (searchTerm === '') {
    return machinesList;
  }

  return machinesList.filter((machine) => {
    const name = machine.name.toLowerCase();
    const model = (machine.model ?? '').toLowerCase();
    const manufacturer = (machine.manufacturer ?? '').toLowerCase();
    const department = (machine.departmentName ?? '').toLowerCase();
    const serialNumber = (machine.serialNumber ?? '').toLowerCase();

    return (
      name.includes(searchTerm) ||
      model.includes(searchTerm) ||
      manufacturer.includes(searchTerm) ||
      department.includes(searchTerm) ||
      serialNumber.includes(searchTerm)
    );
  });
}

/**
 * Apply all filters (status + search)
 */
function applyAllFilters(query: string): Machine[] {
  // First filter by status
  let result = filterByStatus(machines, currentStatusFilter);
  // Then filter by search
  result = filterBySearch(result, query);
  return result;
}

/**
 * Handle search input changes
 */
function handleSearchInputChange(searchContainer: HTMLElement, query: string): void {
  // Toggle has-value class for clear button
  if (query !== '' && query.trim() !== '') {
    searchContainer.classList.add(SEARCH_INPUT_HAS_VALUE_CLASS);
  } else {
    searchContainer.classList.remove(SEARCH_INPUT_HAS_VALUE_CLASS);
  }

  // Apply all filters (status + search)
  filteredMachines = applyAllFilters(query);
  renderMachinesTable(filteredMachines, currentStatusFilter);
  renderSearchResults(filteredMachines, query);
  selectedResultIndex = -1;
}

/**
 * Handle clear button click
 */
function handleSearchClear(searchContainer: HTMLElement): void {
  if (searchInput !== null) {
    searchInput.value = '';
    searchContainer.classList.remove(SEARCH_INPUT_HAS_VALUE_CLASS);
    // Reapply status filter (no search)
    filteredMachines = applyAllFilters('');
    renderMachinesTable(filteredMachines, currentStatusFilter);
    closeSearchResults();
    searchInput.focus();
  }
}

/**
 * Handle search result item click
 */
function handleResultItemClick(searchContainer: HTMLElement, machineId: string): void {
  void editMachineHandler(Number.parseInt(machineId, 10));
  closeSearchResults();
  if (searchInput !== null) {
    searchInput.value = '';
    searchContainer.classList.remove(SEARCH_INPUT_HAS_VALUE_CLASS);
  }
}

/**
 * Handle keyboard navigation in search results
 */
function handleSearchKeyboard(e: KeyboardEvent, searchContainer: HTMLElement): void {
  const resultsContainer = document.querySelector<HTMLElement>('#machine-search-results');
  const resultItems = resultsContainer?.querySelectorAll('[data-action="edit-from-search"]');

  if (resultItems === undefined || resultItems.length === 0) {
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedResultIndex = Math.min(selectedResultIndex + 1, resultItems.length - 1);
    updateSelectedResult(resultItems);
    return;
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedResultIndex = Math.max(selectedResultIndex - 1, -1);
    updateSelectedResult(resultItems);
    return;
  }

  if (e.key === 'Enter' && selectedResultIndex >= 0) {
    e.preventDefault();
    // eslint-disable-next-line security/detect-object-injection -- Safe: selectedResultIndex is a controlled index from our keyboard navigation (bounded by resultItems.length)
    const selectedItem = resultItems[selectedResultIndex] as HTMLElement;
    const machineId = selectedItem.dataset.machineId;
    if (machineId !== undefined) {
      handleResultItemClick(searchContainer, machineId);
      selectedResultIndex = -1;
    }
    return;
  }

  if (e.key === 'Escape') {
    closeSearchResults();
    selectedResultIndex = -1;
    searchInput?.blur();
  }
}

/**
 * Update visual selection of result items
 */
function updateSelectedResult(resultItems: NodeListOf<Element>): void {
  resultItems.forEach((item, index) => {
    const htmlItem = item as HTMLElement;
    if (index === selectedResultIndex) {
      htmlItem.classList.add('search-input__result-item--active');
    } else {
      htmlItem.classList.remove('search-input__result-item--active');
    }
  });
}

/**
 * Setup search input functionality
 */
function setupSearchInput(): void {
  searchInput = document.querySelector<HTMLInputElement>('#machine-search');
  searchClearBtn = document.querySelector<HTMLButtonElement>('#machine-search-clear');
  const searchContainer = document.querySelector<HTMLElement>('#machine-search-container');
  const searchWrapper = document.querySelector<HTMLElement>('.search-input-wrapper');

  if (searchInput === null || searchContainer === null || searchWrapper === null) {
    console.error('[MachinesController] Search input elements not found');
    return;
  }

  // Input changes
  searchInput.addEventListener('input', () => {
    const query = searchInput?.value ?? '';
    handleSearchInputChange(searchContainer, query);
  });

  // Clear button
  searchClearBtn?.addEventListener('click', () => {
    handleSearchClear(searchContainer);
  });

  // Result clicks
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const resultItem = target.closest<HTMLElement>('[data-action="edit-from-search"]');
    const machineId = resultItem?.dataset.machineId;
    if (resultItem !== null && machineId !== undefined) {
      handleResultItemClick(searchContainer, machineId);
    }
  });

  // Outside clicks
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!searchWrapper.contains(target)) {
      closeSearchResults();
    }
  });

  // Keyboard navigation
  searchInput.addEventListener('keydown', (e) => {
    handleSearchKeyboard(e, searchContainer);
  });
}

/**
 * Setup status filter toggle
 */
function setupStatusToggle(): void {
  const toggleGroup = document.querySelector<HTMLElement>('#machine-status-toggle');
  if (toggleGroup === null) {
    console.error('[MachinesController] Status toggle group not found');
    return;
  }

  // Handle toggle button clicks
  toggleGroup.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.toggle-group__btn');
    if (btn === null || btn.disabled) {
      return;
    }

    // Get status from data attribute
    const status = btn.dataset.status as MachineStatusFilter | undefined;
    if (status === undefined) {
      return;
    }

    // Update active state
    toggleGroup.querySelectorAll('.toggle-group__btn').forEach((b) => {
      b.classList.remove('active');
    });
    btn.classList.add('active');

    // Update filter state
    currentStatusFilter = status;

    // Reload machines with new filter
    void loadMachinesAndRender();
  });
}

// ===== EVENT LISTENERS =====

/**
 * Check authentication
 */
function checkAuth(): boolean {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('userRole');

  if (token === null || token === '' || (userRole !== 'admin' && userRole !== 'root')) {
    window.location.href = '/login';
    return false;
  }
  return true;
}

/**
 * Initialize DOM elements
 */
function initializeDOMElements(): void {
  addMachineBtn = document.querySelector<HTMLButtonElement>('.add-machine-btn');
  machineForm = document.querySelector<HTMLFormElement>('#machine-form');
  loadingDiv = document.querySelector('#machines-loading');
  emptyDiv = document.querySelector('#machines-empty');
  searchInput = document.querySelector<HTMLInputElement>('#machine-search');
  searchClearBtn = document.querySelector<HTMLButtonElement>('#machine-search-clear');

  // Debug logging
  console.info('[MachinesController] FAB button found:', addMachineBtn !== null);
  if (addMachineBtn === null) {
    console.error('FAB button .add-machine-btn not found in DOM!');
  }
}

/**
 * Attach FAB and empty state listeners
 */
function attachAddMachineListeners(): void {
  // FAB button
  if (addMachineBtn !== null) {
    console.info('[MachinesController] Attaching click handler to FAB button');
    addMachineBtn.addEventListener('click', () => {
      console.info('FAB button clicked!');
      showAddMachineModal();
    });
  } else {
    console.error('Cannot attach event listener - addMachineBtn is null!');
  }

  // Empty state add button
  document.querySelector('#empty-state-add-btn')?.addEventListener('click', () => {
    showAddMachineModal();
  });
}

/**
 * Attach modal close button listeners
 */
function attachModalCloseListeners(): void {
  // Machine modal close buttons
  document.querySelector('#close-machine-modal')?.addEventListener('click', () => {
    closeMachineModal();
  });
  document.querySelector('#cancel-machine-modal')?.addEventListener('click', () => {
    closeMachineModal();
  });
}

/**
 * Attach table action listeners (event delegation)
 */
function attachTableActionListeners(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle edit machine
    const editBtn = target.closest<HTMLElement>('[data-action="edit-machine"]');
    if (editBtn) {
      const machineId = editBtn.dataset.machineId;
      if (machineId !== undefined) {
        void editMachineHandler(Number.parseInt(machineId, 10));
      }
    }

    // Handle view machine details
    const viewBtn = target.closest<HTMLElement>('[data-action="view-machine-details"]');
    if (viewBtn) {
      const machineId = viewBtn.dataset.machineId;
      if (machineId !== undefined) {
        void viewMachineDetailsHandler(Number.parseInt(machineId, 10));
      }
    }

    // Handle delete machine
    const deleteBtn = target.closest<HTMLElement>('[data-action="delete-machine"]');
    if (deleteBtn) {
      const machineId = deleteBtn.dataset.machineId;
      if (machineId !== undefined) {
        void deleteMachineHandler(Number.parseInt(machineId, 10));
      }
    }
  });
}

/**
 * Setup form submit handler
 */
function setupFormSubmitHandler(): void {
  machineForm?.addEventListener('submit', (e) => {
    void (async () => {
      await handleFormSubmit(e);
      // Reload machines table after form submission
      await loadMachinesAndRender();
    })();
  });
}

/**
 * Initialize custom dropdown components
 */
function initCustomDropdowns(): void {
  // Initialize all dropdowns (department, area, type, status)
  initDropdown('department-dropdown', 'department-trigger', 'department-menu', 'machine-department');
  initDropdown('area-dropdown', 'area-trigger', 'area-menu', 'machine-area');
  initDropdown('type-dropdown', 'type-trigger', 'type-menu', 'machine-type');
  initDropdown('status-dropdown', 'status-trigger', 'status-menu', 'machine-status');
}

/**
 * Generic dropdown initialization helper
 */
function initDropdown(dropdownId: string, triggerId: string, menuId: string, hiddenInputId: string): void {
  const trigger = document.getElementById(triggerId);
  const menu = document.getElementById(menuId);
  const dropdown = document.getElementById(dropdownId);
  const hiddenInput = document.getElementById(hiddenInputId) as HTMLInputElement | null;

  if (trigger === null || menu === null || dropdown === null) {
    console.warn(`[initDropdown] Dropdown elements not found for: ${dropdownId}`);
    return;
  }

  // Toggle menu on trigger click
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    trigger.classList.toggle('active');
    menu.classList.toggle('active');
  });

  // Handle option selection
  menu.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const option = target.closest('.dropdown__option');

    if (option === null || !(option instanceof HTMLElement)) {
      return;
    }

    handleDropdownSelection(option, trigger, hiddenInput, dropdownId);

    // Close menu
    menu.classList.remove('active');
    trigger.classList.remove('active');
  });

  // Close menu on outside click
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!dropdown.contains(target)) {
      menu.classList.remove('active');
      trigger.classList.remove('active');
    }
  });
}

/**
 * Handle dropdown option selection and update display
 */
function handleDropdownSelection(
  option: HTMLElement,
  trigger: HTMLElement,
  hiddenInput: HTMLInputElement | null,
  _dropdownId: string,
): void {
  const value = option.dataset.value ?? '';
  const text = option.textContent;
  const trimmedText = text !== '' ? text.trim() : '';
  const displayText = trimmedText !== '' ? trimmedText : value;

  // Update hidden input
  if (hiddenInput !== null) {
    hiddenInput.value = value;
  }

  // Update trigger text
  const triggerSpan = trigger.querySelector('span');
  if (triggerSpan !== null) {
    const badge = option.querySelector('.badge');
    if (badge !== null) {
      // For status dropdown with badges - clone to prevent XSS
      const clonedBadge = badge.cloneNode(true);
      triggerSpan.textContent = '';
      triggerSpan.appendChild(clonedBadge);
    } else {
      // For simple text dropdowns
      triggerSpan.textContent = displayText;
    }
  }
}

/**
 * Attach all event listeners
 */
function attachEventListeners(): void {
  attachAddMachineListeners();
  attachModalCloseListeners();
  attachTableActionListeners();
  setupFormSubmitHandler();
  initCustomDropdowns();
}

/**
 * Load initial data
 */
function loadInitialData(): void {
  void loadMachinesAndRender();
}

// ===== INITIALIZATION =====

/**
 * Initialize the machine management
 */
(() => {
  if (!checkAuth()) return;

  initializeDOMElements();
  attachEventListeners();
  setupGlobalFunctions();
  loadInitialData();
  setupSearchInput();
  setupStatusToggle();
})();

// End of file
