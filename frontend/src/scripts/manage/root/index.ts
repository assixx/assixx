/**
 * Root User Management - Main Controller
 * Orchestration, event handling, and business logic
 */

import { $, getData } from '../../../utils/dom-utils';
import { showSuccessAlert, showErrorAlert } from '../../utils/alerts';
// Import from types
import type { RootUser, RootStatusFilter } from './types';
// Import from data layer
import { loadRootUsers as loadRootUsersAPI, deleteRootUserAPI, allRootUsers } from './data';
// Import from UI layer
import { displayRootUsers, showEmptyState, renderSearchResults, closeSearchResults } from './ui';
// Import from forms layer
import {
  setupValidationListeners,
  handleFormSubmit,
  closeRootModal,
  showAddRootModal,
  editRootUserHandler,
  setupSingleDropdown,
  loadDepartments,
  CSS_CLASSES,
} from './forms';

// Filter state
let currentStatusFilter: RootStatusFilter = 'active';
let currentSearchQuery = '';

/**
 * Load root users and apply filters
 */
async function loadRootUsers(): Promise<void> {
  const loadingEl = $('#root-users-loading');
  const emptyStateEl = $('#root-users-empty');

  loadingEl.classList.remove('u-hidden');
  emptyStateEl.classList.add('u-hidden');

  try {
    await loadRootUsersAPI();
    loadingEl.classList.add('u-hidden');
    applyFilters();
  } catch (error) {
    console.error('Error loading root users:', error);
    showErrorAlert('Fehler beim Laden der Root-Benutzer');
    loadingEl.classList.add('u-hidden');
  }
}

/**
 * Filter root users by status
 */
function filterByStatus(users: RootUser[], status: RootStatusFilter): RootUser[] {
  switch (status) {
    case 'active':
      return users.filter((user) => user.isActive === true || user.isActive === 1);
    case 'inactive':
      return users.filter((user) => user.isActive === false || user.isActive === 0);
    case 'all':
      return users;
    default:
      return users;
  }
}

/**
 * Filter root users by search query
 */
function filterBySearch(users: RootUser[], query: string): RootUser[] {
  const searchTerm = query.toLowerCase().trim();

  if (searchTerm === '') {
    return users;
  }

  return users.filter((user) => {
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    const email = user.email.toLowerCase();
    const position = (user.position ?? '').toLowerCase();
    const employeeNumber = (user.employeeNumber ?? '').toLowerCase();

    return (
      fullName.includes(searchTerm) ||
      email.includes(searchTerm) ||
      employeeNumber.includes(searchTerm) ||
      position.includes(searchTerm)
    );
  });
}

/**
 * Apply all filters and display results
 */
function applyFilters(): void {
  // Apply status filter first
  let filtered = filterByStatus(allRootUsers, currentStatusFilter);

  // Apply search filter
  filtered = filterBySearch(filtered, currentSearchQuery);

  if (filtered.length === 0) {
    showEmptyState(currentStatusFilter);
  } else {
    const emptyStateEl = $('#root-users-empty');
    emptyStateEl.classList.add('u-hidden');
    displayRootUsers(filtered);
  }
}

function deleteRootUser(userId: number): void {
  // Show delete modal
  const deleteModal = $('#delete-root-modal');
  const deleteRootId = $('#delete-root-id') as HTMLInputElement;
  deleteRootId.value = userId.toString();
  deleteModal.classList.add(CSS_CLASSES.MODAL_ACTIVE);
}

async function confirmDeleteRootUser(): Promise<void> {
  const deleteRootId = ($('#delete-root-id') as HTMLInputElement).value;
  const userId = Number.parseInt(deleteRootId, 10);

  try {
    await deleteRootUserAPI(userId);
    showSuccessAlert('Root-Benutzer erfolgreich gelöscht');

    const deleteModal = $('#delete-root-modal');
    deleteModal.classList.remove(CSS_CLASSES.MODAL_ACTIVE);

    await loadRootUsers();
  } catch (error) {
    showErrorAlert(error instanceof Error ? error.message : 'Fehler beim Löschen des Root-Benutzers');
  }
}

/**
 * Setup status toggle group
 */
function setupStatusToggle(): void {
  const toggleGroup = $('#root-status-toggle');

  toggleGroup.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.toggle-group__btn');
    if (btn === null || btn.disabled) {
      return;
    }

    const status = getData(btn, 'status') as RootStatusFilter | undefined;
    if (status === undefined) {
      return;
    }

    // Update active state
    toggleGroup.querySelectorAll('.toggle-group__btn').forEach((b) => {
      b.classList.remove('active');
    });
    btn.classList.add('active');

    // Update filter and reload
    currentStatusFilter = status;
    applyFilters();
  });
}

/**
 * Setup search functionality
 */
function setupSearch(): void {
  const searchInput = $('#root-search') as HTMLInputElement;
  const searchClear = $('#root-search-clear');

  // Search on input
  searchInput.addEventListener('input', () => {
    currentSearchQuery = searchInput.value;

    // Apply filters to table
    applyFilters();

    // Render search results dropdown
    const filtered = filterBySearch(allRootUsers, currentSearchQuery);
    renderSearchResults(filtered, currentSearchQuery);

    // Show/hide clear button
    if (currentSearchQuery !== '') {
      searchClear.classList.add('search-input__clear--visible');
    } else {
      searchClear.classList.remove('search-input__clear--visible');
    }
  });

  // Clear button
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    currentSearchQuery = '';
    searchClear.classList.remove('search-input__clear--visible');
    closeSearchResults();
    applyFilters();
  });

  // Result item clicks
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const resultItem = target.closest<HTMLElement>('[data-action="edit-from-search"]');

    if (resultItem !== null) {
      const userId = getData(resultItem, 'userId');
      if (userId !== undefined) {
        editRootUserHandler(Number.parseInt(userId, 10));
        closeSearchResults();
        searchInput.value = '';
        currentSearchQuery = '';
        searchClear.classList.remove('search-input__clear--visible');
      }
    }
  });

  // Outside clicks
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const searchWrapper = document.querySelector('.search-input-wrapper');
    if (searchWrapper !== null && !searchWrapper.contains(target)) {
      closeSearchResults();
    }
  });
}

/**
 * Setup dropdown handlers for position and department selection
 * Uses Design System dropdown component pattern
 */
function setupDropdownHandlers(): void {
  setupSingleDropdown('position-dropdown', 'position-trigger', 'position-menu', 'root-position');
  setupSingleDropdown('department-dropdown', 'department-trigger', 'department-menu', 'root-department-id');
}

function initializeApp(): void {
  console.log('[RootUsers] Initializing...');

  void loadRootUsers();
  void loadDepartments();

  // Initialize position dropdown
  setupDropdownHandlers();

  // Form submit
  const form = $('#root-form');
  form.addEventListener('submit', (e) => void handleFormSubmit(e, loadRootUsers));

  // Setup validation listeners
  setupValidationListeners();

  // Status Toggle Group
  setupStatusToggle();

  // Search Input
  setupSearch();

  // Floating Action Button
  const addBtn = $('#add-root-btn');
  addBtn.addEventListener('click', showAddRootModal);

  // Empty state add button
  const emptyStateAddBtn = $('#empty-state-add-btn');
  emptyStateAddBtn.addEventListener('click', showAddRootModal);

  // Modal close buttons
  const closeModalBtn = $('#close-root-modal');
  closeModalBtn.addEventListener('click', closeRootModal);

  const cancelModalBtn = $('#cancel-root-modal');
  cancelModalBtn.addEventListener('click', closeRootModal);

  // Delete modal buttons
  const closeDeleteModalBtn = $('#close-delete-modal');
  closeDeleteModalBtn.addEventListener('click', () => {
    $('#delete-root-modal').classList.remove(CSS_CLASSES.MODAL_ACTIVE);
  });

  const cancelDeleteModalBtn = $('#cancel-delete-modal');
  cancelDeleteModalBtn.addEventListener('click', () => {
    $('#delete-root-modal').classList.remove(CSS_CLASSES.MODAL_ACTIVE);
  });

  const confirmDeleteBtn = $('#confirm-delete-root');
  confirmDeleteBtn.addEventListener('click', () => void confirmDeleteRootUser());

  // Close modal on overlay click
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('modal-overlay')) {
      target.classList.remove(CSS_CLASSES.MODAL_ACTIVE);
    }
  });

  // Event delegation for root user actions
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    const editBtn = target.closest<HTMLElement>('[data-action="edit-root-user"]');
    if (editBtn) {
      const userId = getData(editBtn, 'userId');
      if (userId !== undefined) {
        editRootUserHandler(Number.parseInt(userId, 10));
      }
    }

    const deleteBtn = target.closest<HTMLElement>('[data-action="delete-root-user"]');
    if (deleteBtn) {
      const userId = getData(deleteBtn, 'userId');
      if (userId !== undefined) {
        deleteRootUser(Number.parseInt(userId, 10));
      }
    }
  });
}

// Execute immediately
(() => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('userRole');

  if (token === null || token === '' || userRole !== 'root') {
    window.location.href = '/login';
    return;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeApp();
    });
  } else {
    initializeApp();
  }
})();
