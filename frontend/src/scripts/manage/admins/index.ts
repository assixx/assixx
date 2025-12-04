/* eslint-disable max-lines */
/**
 * Admin Management - Main Controller
 * Orchestration, event handling, and business logic
 */

import { $$, $all } from '../../../utils/dom-utils';
import { showSuccessAlert, showErrorAlert } from '../../utils/alerts';
// Import from types
import type { Admin, AdminStatusFilter, ManageAdminsWindow } from './types';
// Import from data layer
import {
  admins,
  loadAdmins,
  loadTenants,
  deleteAdmin as deleteAdminAPI,
  // N:M REFACTORING: Import toggle setup function
  setupAdminFullAccessToggle,
  // Area → Department filter: Hide departments that belong to selected areas
  setupAreaDepartmentFilter,
  // Department → Team filter: Hide teams that belong to selected departments
  setupDepartmentTeamFilter,
} from './data';
// Import from UI layer
import { renderAdminTable, renderSearchResults, closeSearchResults } from './ui';
// Import from forms layer
import {
  SELECTORS,
  getPositionDisplay,
  updateTenantDropdown,
  editAdminHandler,
  showAddAdminModal,
  closeAdminModal,
  handleFormSubmit,
  initPositionDropdown,
  initStatusDropdown,
} from './forms';

// DOM Elements
let addAdminBtn: HTMLButtonElement | null;
let deleteModal: HTMLElement | null;
let adminForm: HTMLFormElement | null;
let loadingDiv: HTMLElement | null;
let emptyDiv: HTMLElement | null;
let searchInput: HTMLInputElement | null;
let searchClearBtn: HTMLButtonElement | null;

// Search state
let filteredAdmins: Admin[] = [];
let selectedResultIndex = -1;

// Filter state
let currentStatusFilter: AdminStatusFilter = 'active';

// Constants
const SEARCH_INPUT_HAS_VALUE_CLASS = 'search-input--has-value';

// Load admins and render table
async function loadAdminsAndRender() {
  console.info('loadAdminsAndRender called');

  // Show loading state
  loadingDiv?.classList.remove('u-hidden');
  emptyDiv?.classList.add('u-hidden');

  try {
    await loadAdmins();
    renderAdminTable(admins, currentStatusFilter, initDataTooltips);
  } catch (error) {
    console.error('Fehler:', error);
    showErrorAlert('Netzwerkfehler beim Laden der Admins');
    // Hide loading on error
    loadingDiv?.classList.add('u-hidden');
  }
}

// Load tenants and update dropdown
async function loadTenantsAndUpdate() {
  try {
    await loadTenants();
    updateTenantDropdown();
  } catch (error) {
    console.error('Fehler beim Laden der Tenants:', error);
  }
}

// Delete handlers

async function deleteAdminHandler(adminId: number) {
  console.info('deleteAdminHandler called with ID:', adminId);

  // NOTE: Confirmation is already handled by the double-check modal pattern in HTML
  // (delete-admin-modal → delete-admin-confirm-modal)
  // This function is called AFTER user has confirmed deletion

  try {
    await deleteAdminAPI(adminId);

    // Admin-Liste neu laden
    await loadAdminsAndRender();
    showSuccessAlert('Administrator gelöscht');
  } catch (error) {
    console.error('Error deleting admin:', error);
    showErrorAlert('Netzwerkfehler beim Löschen');
  }
}

// Close delete modal (step 1)
function closeDeleteModal(): void {
  deleteModal?.classList.remove('modal-overlay--active');
}

// Close delete confirm modal (step 2)
function closeDeleteConfirmModal(): void {
  const confirmModal = document.querySelector('#delete-admin-confirm-modal');
  confirmModal?.classList.remove('modal-overlay--active');
}

// Show delete confirm modal (step 2 - double-check pattern)
function showDeleteConfirmModal(): void {
  // Close first modal
  closeDeleteModal();
  // Show second modal
  const confirmModal = document.querySelector('#delete-admin-confirm-modal');
  confirmModal?.classList.add('modal-overlay--active');
}

// Show delete modal
function showDeleteModal(adminId: number): void {
  const admin = admins.find((a) => a.id === adminId);
  if (!admin) {
    showErrorAlert('Administrator nicht gefunden');
    return;
  }

  const deleteIdInput = document.querySelector<HTMLInputElement>('#delete-admin-id');

  if (deleteModal && deleteIdInput) {
    deleteIdInput.value = String(adminId);
    deleteModal.classList.add('modal-overlay--active');
  }
}

// Helper function to setup global functions
function setupGlobalFunctions() {
  (window as unknown as ManageAdminsWindow).editAdmin = editAdminHandler;
  (window as unknown as ManageAdminsWindow).deleteAdmin = deleteAdminHandler;
  (window as unknown as ManageAdminsWindow).showAddAdminModal = showAddAdminModal;
  (window as unknown as ManageAdminsWindow).closeAdminModal = closeAdminModal;
  (window as unknown as ManageAdminsWindow).reloadAdminsTable = loadAdminsAndRender;
}

/**
 * Initialize Design System tooltips from data-tooltip attributes
 * Converts data-tooltip="text" to proper tooltip HTML structure
 */
function initDataTooltips() {
  const elements = document.querySelectorAll('[data-tooltip]');

  elements.forEach((element) => {
    const tooltipText = element.getAttribute('data-tooltip');

    if (tooltipText === null || tooltipText === '') {
      return;
    }

    // CRITICAL: Inside scroll containers (overflow:auto), position:absolute tooltips
    // will ALWAYS be clipped - no matter if top or bottom.
    // Solution: Use native title attribute which browser renders outside any container
    const isInsideScrollContainer = element.closest('.table-responsive') !== null;

    if (isInsideScrollContainer) {
      // Use native title - browser handles positioning, never clipped
      element.setAttribute('title', tooltipText);
      element.removeAttribute('data-tooltip');
      return;
    }

    // For elements NOT in scroll containers: use custom tooltip
    const tooltipPosition = element.getAttribute('data-tooltip-position') ?? 'top';

    // Wrap element if not already wrapped
    const isAlreadyWrapped = element.parentElement?.classList.contains('tooltip') ?? false;

    if (!isAlreadyWrapped) {
      const wrapper = document.createElement('div');
      wrapper.className = 'tooltip';

      // Replace element with wrapper using element.before()
      element.before(wrapper);
      wrapper.appendChild(element);

      // Create tooltip content
      const tooltipContent = document.createElement('div');
      tooltipContent.className = `tooltip__content tooltip__content--${tooltipPosition} tooltip__content--multiline`;
      tooltipContent.setAttribute('role', 'tooltip');
      // Use textContent for multiline support - preserves newlines
      tooltipContent.textContent = tooltipText;

      wrapper.appendChild(tooltipContent);
    }
  });
}

// Helper function to initialize tooltip handlers
function initializeTooltipHandlers() {
  // Initialize data-tooltip attributes (Design System tooltips)
  initDataTooltips();

  // Event delegation for admin actions
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle tooltip visibility
    if (target.classList.contains('info-icon') || target.closest('.info-icon')) {
      e.stopPropagation();
      const icon = target.classList.contains('info-icon') ? target : target.closest('.info-icon');
      const tooltip = icon?.querySelector('.info-tooltip');

      if (tooltip) {
        tooltip.classList.toggle('show');

        // Ensure tooltip doesn't go off-screen
        const rect = tooltip.getBoundingClientRect();
        if (rect.left < 0) {
          (tooltip as HTMLElement).style.left = '0';
          (tooltip as HTMLElement).style.transform = 'translateX(0)';
        } else if (rect.right > window.innerWidth) {
          (tooltip as HTMLElement).style.left = 'auto';
          (tooltip as HTMLElement).style.right = '0';
          (tooltip as HTMLElement).style.transform = 'translateX(0)';
        }
      }
    }
  });

  // Hide tooltips when clicking elsewhere
  document.addEventListener('click', (e) => {
    $all('.info-tooltip.show').forEach((tooltip) => {
      const icon = tooltip.closest('.info-icon');
      const currentEvent = e;
      if (icon !== null && !icon.contains(currentEvent.target as Node)) {
        tooltip.classList.remove('show');
      }
    });
  });
}

// Constants for field validation states
const FIELD_STATE_ERROR = 'is-error';
const FIELD_STATE_SUCCESS = 'is-success';

// Helper function to setup password validation
/**
 * Setup live email validation with visual feedback
 */
function setupEmailValidation(): void {
  const emailField = $$(SELECTORS.ADMIN_EMAIL) as HTMLInputElement | null;
  const emailConfirmField = $$(SELECTORS.ADMIN_EMAIL_CONFIRM) as HTMLInputElement | null;
  const emailError = $$(SELECTORS.EMAIL_ERROR);

  if (emailField !== null && emailConfirmField !== null && emailError !== null) {
    // Validate on both fields with real-time visual feedback
    const validateEmails = (): void => {
      const email = emailField.value;
      const emailConfirm = emailConfirmField.value;

      // Only validate if confirm field has value
      if (emailConfirm !== '') {
        if (email !== emailConfirm) {
          // Show error
          emailError.classList.remove('u-hidden');
          emailField.classList.add(FIELD_STATE_ERROR);
          emailField.classList.remove(FIELD_STATE_SUCCESS);
          emailConfirmField.classList.add(FIELD_STATE_ERROR);
          emailConfirmField.classList.remove(FIELD_STATE_SUCCESS);
        } else {
          // Show success
          emailError.classList.add('u-hidden');
          emailField.classList.remove(FIELD_STATE_ERROR);
          emailField.classList.add(FIELD_STATE_SUCCESS);
          emailConfirmField.classList.remove(FIELD_STATE_ERROR);
          emailConfirmField.classList.add(FIELD_STATE_SUCCESS);
        }
      } else {
        // Clear all states when confirm is empty
        emailError.classList.add('u-hidden');
        emailField.classList.remove(FIELD_STATE_ERROR, FIELD_STATE_SUCCESS);
        emailConfirmField.classList.remove(FIELD_STATE_ERROR, FIELD_STATE_SUCCESS);
      }
    };

    emailField.addEventListener('input', validateEmails);
    emailConfirmField.addEventListener('input', validateEmails);
  }
}

/**
 * Setup live password validation with visual feedback
 */
function setupPasswordValidation(): void {
  const passwordField = $$(SELECTORS.ADMIN_PASSWORD) as HTMLInputElement | null;
  const passwordConfirmField = $$(SELECTORS.ADMIN_PASSWORD_CONFIRM) as HTMLInputElement | null;
  const passwordError = $$(SELECTORS.PASSWORD_ERROR);

  if (passwordField !== null && passwordConfirmField !== null && passwordError !== null) {
    // Validate on both fields with real-time visual feedback
    const validatePasswords = (): void => {
      const password = passwordField.value;
      const passwordConfirm = passwordConfirmField.value;

      // Only validate if confirm field has value
      if (passwordConfirm !== '') {
        const passwordsMatch = password.length === passwordConfirm.length && password === passwordConfirm;
        if (!passwordsMatch) {
          // Show error
          passwordError.classList.remove('u-hidden');
          passwordField.classList.add(FIELD_STATE_ERROR);
          passwordField.classList.remove(FIELD_STATE_SUCCESS);
          passwordConfirmField.classList.add(FIELD_STATE_ERROR);
          passwordConfirmField.classList.remove(FIELD_STATE_SUCCESS);
        } else {
          // Show success
          passwordError.classList.add('u-hidden');
          passwordField.classList.remove(FIELD_STATE_ERROR);
          passwordField.classList.add(FIELD_STATE_SUCCESS);
          passwordConfirmField.classList.remove(FIELD_STATE_ERROR);
          passwordConfirmField.classList.add(FIELD_STATE_SUCCESS);
        }
      } else {
        // Clear all states when confirm is empty
        passwordError.classList.add('u-hidden');
        passwordField.classList.remove(FIELD_STATE_ERROR, FIELD_STATE_SUCCESS);
        passwordConfirmField.classList.remove(FIELD_STATE_ERROR, FIELD_STATE_SUCCESS);
      }
    };

    passwordField.addEventListener('input', validatePasswords);
    passwordConfirmField.addEventListener('input', validatePasswords);
  }
}

/**
 * Filter admins by unified isActive status (2025-12-02)
 * Status: 0=inactive, 1=active, 3=archived, 4=deleted
 */
function filterByStatus(adminsList: Admin[], status: AdminStatusFilter): Admin[] {
  switch (status) {
    case 'active':
      return adminsList.filter((admin) => admin.isActive === 1);
    case 'inactive':
      return adminsList.filter((admin) => admin.isActive === 0);
    case 'archived':
      return adminsList.filter((admin) => admin.isActive === 3);
    case 'all':
    default:
      // Show all except deleted (isActive !== 4)
      return adminsList.filter((admin) => admin.isActive !== 4);
  }
}

/**
 * Filter admins based on search query
 */
function filterBySearch(adminsList: Admin[], query: string): Admin[] {
  const searchTerm = query.toLowerCase().trim();

  if (searchTerm === '') {
    return adminsList;
  }

  return adminsList.filter((admin) => {
    const fullName = `${admin.firstName ?? ''} ${admin.lastName ?? ''}`.trim().toLowerCase();
    const email = admin.email.toLowerCase();
    const position = (admin.position ?? '').toLowerCase();
    const positionDisplay = getPositionDisplay(admin.position ?? '').toLowerCase();
    const employeeNumber = (admin.employeeNumber ?? '').toLowerCase();

    return (
      fullName.includes(searchTerm) ||
      email.includes(searchTerm) ||
      employeeNumber.includes(searchTerm) ||
      position.includes(searchTerm) ||
      positionDisplay.includes(searchTerm)
    );
  });
}

/**
 * Apply all filters (status + search)
 */
function applyAllFilters(query: string): Admin[] {
  // First filter by status
  let result = filterByStatus(admins, currentStatusFilter);
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
  filteredAdmins = applyAllFilters(query);
  renderAdminTable(filteredAdmins, currentStatusFilter, initDataTooltips);
  renderSearchResults(filteredAdmins, query);
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
    filteredAdmins = applyAllFilters('');
    renderAdminTable(filteredAdmins, currentStatusFilter, initDataTooltips);
    closeSearchResults();
    searchInput.focus();
  }
}

/**
 * Handle search result item click
 */
function handleResultItemClick(searchContainer: HTMLElement, adminId: string): void {
  void editAdminHandler(Number.parseInt(adminId, 10));
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
  const resultsContainer = document.querySelector<HTMLElement>('#admin-search-results');
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
    const adminId = selectedItem.dataset['adminId'];
    if (adminId !== undefined) {
      handleResultItemClick(searchContainer, adminId);
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
 * Setup search input functionality
 */
function setupSearchInput(): void {
  searchInput = document.querySelector<HTMLInputElement>('#admin-search');
  searchClearBtn = document.querySelector<HTMLButtonElement>('#admin-search-clear');
  const searchContainer = document.querySelector<HTMLElement>('#admin-search-container');
  const searchWrapper = document.querySelector<HTMLElement>('.search-input-wrapper');

  if (searchInput === null || searchContainer === null || searchWrapper === null) {
    console.error('Search input elements not found');
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
    const adminId = resultItem?.dataset['adminId'];
    if (resultItem !== null && adminId !== undefined) {
      handleResultItemClick(searchContainer, adminId);
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
 * Setup status filter toggle
 */
function setupStatusToggle(): void {
  const toggleGroup = document.querySelector<HTMLElement>('#admin-status-toggle');
  if (toggleGroup === null) {
    console.error('Status toggle group not found');
    return;
  }

  // Handle toggle button clicks
  toggleGroup.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.toggle-group__btn');
    if (btn === null || btn.disabled) {
      return;
    }

    // Get status from data attribute
    const status = btn.dataset['status'] as AdminStatusFilter | undefined;
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

    // Reapply all filters
    const query = searchInput?.value ?? '';
    filteredAdmins = applyAllFilters(query);
    renderAdminTable(filteredAdmins, currentStatusFilter, initDataTooltips);
    renderSearchResults(filteredAdmins, query);
  });
}

// Position dropdown no longer needed - using standard select element

// Check authentication
function checkAuth(): boolean {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('userRole');

  if (token === null || token === '' || userRole !== 'root') {
    window.location.href = '/login';
    return false;
  }
  return true;
}

// Load initial data
function loadInitialData(): void {
  void (async () => {
    await loadAdminsAndRender();
    await loadTenantsAndUpdate();
  })();
}

/**
 * Setup form submit handler
 */
function setupFormSubmitHandler(): void {
  adminForm?.addEventListener('submit', (e) => {
    void (async () => {
      await handleFormSubmit(e);
      // Reload admins table after form submission
      await loadAdminsAndRender();
    })();
  });
}

/**
 * Initialize DOM elements
 */
function initializeDOMElements(): void {
  addAdminBtn = document.querySelector<HTMLButtonElement>('#add-admin-btn');
  deleteModal = document.querySelector('#delete-admin-modal');
  adminForm = document.querySelector<HTMLFormElement>('#admin-form');
  loadingDiv = document.querySelector('#admins-loading');
  emptyDiv = document.querySelector('#admins-empty');
  searchInput = document.querySelector<HTMLInputElement>('#admin-search');
  searchClearBtn = document.querySelector<HTMLButtonElement>('#admin-search-clear');

  // Debug logging
  console.info('FAB button found:', addAdminBtn !== null);
  if (addAdminBtn === null) {
    console.error('FAB button #add-admin-btn not found in DOM!');
  }
}

// Attach FAB and empty state listeners
function attachAddAdminListeners(): void {
  // FAB button
  if (addAdminBtn !== null) {
    console.info('Attaching click handler to FAB button');
    addAdminBtn.addEventListener('click', () => {
      console.info('FAB button clicked!');
      showAddAdminModal();
    });
  } else {
    console.error('Cannot attach event listener - addAdminBtn is null!');
  }

  // Empty state add button
  document.querySelector('#empty-state-add-btn')?.addEventListener('click', () => {
    showAddAdminModal();
  });
}

// Attach modal close button listeners
function attachModalCloseListeners(): void {
  // Admin modal close buttons
  document.querySelector('#close-admin-modal')?.addEventListener('click', () => {
    closeAdminModal();
  });
  document.querySelector('#cancel-admin-modal')?.addEventListener('click', () => {
    closeAdminModal();
  });

  // Delete modal close buttons
  document.querySelector('#close-delete-modal')?.addEventListener('click', closeDeleteModal);
  document.querySelector('#cancel-delete-modal')?.addEventListener('click', closeDeleteModal);
}

// Attach delete confirmation listeners (double-check pattern)
function attachDeleteConfirmListeners(): void {
  // Step 1: Proceed to second confirmation
  document.querySelector('#proceed-delete-admin')?.addEventListener('click', () => {
    showDeleteConfirmModal();
  });

  // Step 2: Cancel on second modal
  document.querySelector('#cancel-delete-confirm')?.addEventListener('click', closeDeleteConfirmModal);

  // Step 2: Final confirmation - actually delete
  document.querySelector('#confirm-delete-admin-final')?.addEventListener('click', () => {
    const deleteInput = document.querySelector<HTMLInputElement>('#delete-admin-id');
    if (deleteInput !== null && deleteInput.value !== '') {
      closeDeleteConfirmModal();
      void deleteAdminHandler(Number.parseInt(deleteInput.value, 10));
    }
  });
}

// Attach table action listeners (event delegation)
function attachTableActionListeners(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle edit admin
    const editBtn = target.closest<HTMLElement>('[data-action="edit-admin"]');
    if (editBtn) {
      const adminId = editBtn.dataset['adminId'];
      if (adminId !== undefined) {
        void editAdminHandler(Number.parseInt(adminId, 10));
      }
    }

    // Handle delete admin
    const deleteBtn = target.closest<HTMLElement>('[data-action="delete-admin"]');
    if (deleteBtn) {
      const adminId = deleteBtn.dataset['adminId'];
      if (adminId !== undefined) {
        showDeleteModal(Number.parseInt(adminId, 10));
      }
    }
  });
}

// Attach all event listeners
function attachEventListeners(): void {
  attachAddAdminListeners();
  attachModalCloseListeners();
  attachDeleteConfirmListeners(); // Double-check pattern for delete
  attachTableActionListeners();
}

// Initialize the admin management
(() => {
  if (!checkAuth()) return;

  initializeDOMElements();
  attachEventListeners();
  setupGlobalFunctions();
  loadInitialData();
  initPositionDropdown(); // Initialize custom position dropdown
  initStatusDropdown(); // Initialize custom status dropdown
  setupFormSubmitHandler();
  initializeTooltipHandlers();
  setupEmailValidation(); // Initialize live email validation
  setupPasswordValidation(); // Initialize live password validation
  setupSearchInput(); // Initialize search input functionality
  setupStatusToggle(); // Initialize status filter toggle
  setupAdminFullAccessToggle(); // N:M REFACTORING: Setup full access toggle handler
  setupAreaDepartmentFilter(); // Area → Department filter: Hide departments covered by selected areas
  setupDepartmentTeamFilter(); // Department → Team filter: Hide teams covered by selected departments
})();

// End of file
