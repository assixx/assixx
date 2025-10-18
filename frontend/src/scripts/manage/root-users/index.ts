/**
 * Root User Management - Main Entry Point
 * 100% Design System compliant - migrated from inline JS
 * Follows manage-admins.html pattern
 */

import { $, getData, setHTML } from '../../../utils/dom-utils';
import { showSuccessAlert, showErrorAlert } from '../../utils/alerts';
import { type RootUser, loadRootUsers as loadRootUsersAPI, deleteRootUserAPI, allRootUsers } from './data';
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
type RootStatusFilter = 'active' | 'inactive' | 'all';
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
  const emptyStateEl = $('#root-users-empty');
  const tableContent = $('#rootTableContent');

  // Apply status filter first
  let filtered = filterByStatus(allRootUsers, currentStatusFilter);

  // Apply search filter
  filtered = filterBySearch(filtered, currentSearchQuery);

  if (filtered.length === 0) {
    emptyStateEl.classList.remove('u-hidden');
    setHTML(tableContent, '');

    // Hide "Add" button in empty state when filtering for inactive users
    const emptyStateAddBtn = $('#empty-state-add-btn');
    if (currentStatusFilter === 'inactive') {
      emptyStateAddBtn.classList.add('u-hidden');
    } else {
      emptyStateAddBtn.classList.remove('u-hidden');
    }
  } else {
    emptyStateEl.classList.add('u-hidden');
    displayRootUsers(filtered);
  }
}

function renderUserRow(user: RootUser): string {
  const statusBadge =
    user.isActive === true
      ? '<span class="badge badge--success">Aktiv</span>'
      : '<span class="badge badge--warning">Inaktiv</span>';
  const employeeNumber = user.employeeNumber ?? '-';

  return `
    <tr>
      <td>${user.id}</td>
      <td>
        <div class="flex items-center gap-2">
          <div class="avatar avatar--sm avatar--color-${user.id % 10}">
            <span>${user.firstName.charAt(0)}${user.lastName.charAt(0)}</span>
          </div>
          <span>${user.firstName} ${user.lastName}</span>
        </div>
      </td>
      <td>${user.email}</td>
      <td>${employeeNumber}</td>
      <td>${user.position ?? '-'}</td>
      <td>${statusBadge}</td>
      <td>${new Date(user.createdAt).toLocaleDateString('de-DE')}</td>
      <td>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-secondary" data-action="edit-root-user" data-user-id="${user.id}">
            <i class="fas fa-edit"></i>
            Bearbeiten
          </button>
          <button class="btn btn-sm btn-danger" data-action="delete-root-user" data-user-id="${user.id}">
            <i class="fas fa-trash"></i>
            Löschen
          </button>
        </div>
      </td>
    </tr>
  `;
}

function displayRootUsers(users: RootUser[]): void {
  const container = $('#rootTableContent');

  setHTML(
    container,
    `
    <div class="data-table-wrapper">
      <table class="data-table data-table--hover data-table--striped">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>E-Mail</th>
            <th>Personalnummer</th>
            <th>Position</th>
            <th>Status</th>
            <th>Erstellt am</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          ${users.map((user) => renderUserRow(user)).join('')}
        </tbody>
      </table>
    </div>
    <div class="alert alert--info mt-4">
      <div class="alert__icon">
        <i class="fas fa-info-circle"></i>
      </div>
      <div class="alert__content">
        <div class="alert__message">
          Ihr eigenes Profil wird hier nicht angezeigt. Bearbeiten Sie es über
          <a href="/root-profile" class="text-blue-500 hover:underline">Mein Profil</a>.
        </div>
      </div>
    </div>
  `,
  );
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
 * Escape special regex characters in a string
 * Prevents regex injection attacks
 */
function escapeRegex(str: string): string {
  return str.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
}

/**
 * Highlight search term in text
 * Wraps matches in <strong> tags for highlighting
 */
function highlightMatch(text: string, query: string): string {
  if (query === '' || query.trim() === '') {
    return text;
  }

  const escapedQuery = escapeRegex(query);
  // eslint-disable-next-line security/detect-non-literal-regexp -- Safe: escapedQuery is sanitized by escapeRegex()
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return text.replace(regex, '<strong>$1</strong>');
}

/**
 * Generate HTML for a single search result item
 */
function generateSearchResultItem(user: RootUser, query: string): string {
  const fullName = `${user.firstName} ${user.lastName}`;
  const position = user.position ?? 'Keine Position';
  const employeeNumber = user.employeeNumber ?? '';

  return `
    <div class="search-input__result-item" data-user-id="${String(user.id)}" data-action="edit-from-search">
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div style="font-weight: 500; color: var(--color-text-primary);">
          ${highlightMatch(fullName, query)}
        </div>
        <div style="font-size: 0.813rem; color: var(--color-text-secondary);">
          ${highlightMatch(user.email, query)}
        </div>
        <div style="font-size: 0.75rem; color: var(--color-text-muted); display: flex; gap: 8px;">
          <span>${highlightMatch(position, query)}</span>
          ${employeeNumber !== '' ? `<span>• ${highlightMatch(employeeNumber, query)}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render search results dropdown
 */
function renderSearchResults(results: RootUser[], query: string): void {
  const resultsContainer = $('#root-search-results');
  const searchWrapper = resultsContainer.closest('.search-input-wrapper');

  if (searchWrapper === null) {
    return;
  }

  // If no query, hide results
  if (query === '' || query.trim() === '') {
    searchWrapper.classList.remove('search-input-wrapper--open');
    setHTML(resultsContainer, '');
    return;
  }

  // Show results dropdown
  searchWrapper.classList.add('search-input-wrapper--open');

  // If no results
  if (results.length === 0) {
    setHTML(
      resultsContainer,
      `<div class="search-input__no-results">Keine Root-Benutzer gefunden für "${query}"</div>`,
    );
    return;
  }

  // Limit to 5 results for dropdown
  const limitedResults = results.slice(0, 5);

  const resultsHTML = limitedResults.map((user) => generateSearchResultItem(user, query)).join('');

  // Add "show all" if more than 5 results
  const showAllHTML =
    results.length > 5
      ? `<div class="search-input__result-item" style="font-size: 0.813rem; color: var(--color-primary); text-align: center; border-top: 1px solid rgb(255 255 255 / 5%);">
          ${String(results.length - 5)} weitere Ergebnisse in Tabelle
        </div>`
      : '';

  setHTML(resultsContainer, resultsHTML + showAllHTML);
}

/**
 * Close search results dropdown
 */
function closeSearchResults(): void {
  const searchWrapper = document.querySelector('.search-input-wrapper');
  const resultsContainer = $('#root-search-results');

  if (searchWrapper !== null) {
    searchWrapper.classList.remove('search-input-wrapper--open');
  }
  setHTML(resultsContainer, '');
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
