/* eslint-disable max-lines */
// Admin Management Main Controller
import { $$, $all, setHTML } from '../../../utils/dom-utils';
import { showSuccessAlert, showErrorAlert } from '../../utils/alerts';
// Import from data layer
import { type Admin, admins, loadAdmins, loadTenants, deleteAdmin as deleteAdminAPI } from './data';
// Import from forms layer
import {
  SELECTORS,
  getPositionDisplay,
  getStatusBadge,
  getDepartmentsBadge,
  updateTenantDropdown,
  loadAndPopulateDepartments,
  editAdminHandler,
  showAddAdminModal,
  closeAdminModal,
  closePermissionsModal,
  showPermissionsModal,
  savePermissionsHandler,
  handleFormSubmit,
  initPositionDropdown,
  initStatusDropdown,
} from './forms';

// Interface for global window functions
interface ManageAdminsWindow extends Window {
  editAdmin: typeof editAdminHandler | null;
  deleteAdmin: typeof deleteAdminHandler | null;
  showPermissionsModal: typeof showPermissionsModal | null;
  showAddAdminModal: (() => void) | null;
  closeAdminModal: (() => void) | null;
  closePermissionsModal: (() => void) | null;
  savePermissionsHandler: (() => Promise<void>) | null;
}

// DOM Elements
let addAdminBtn: HTMLButtonElement | null;
let deleteModal: HTMLElement | null;
let adminForm: HTMLFormElement | null;
let adminsTableContent: HTMLElement | null;
let loadingDiv: HTMLElement | null;
let emptyDiv: HTMLElement | null;
let searchInput: HTMLInputElement | null;
let searchClearBtn: HTMLButtonElement | null;

// Search state
let filteredAdmins: Admin[] = [];
let selectedResultIndex = -1;

// Filter state
type AdminStatusFilter = 'active' | 'inactive' | 'archived' | 'all';
let currentStatusFilter: AdminStatusFilter = 'active';

// Constants
const SEARCH_INPUT_HAS_VALUE_CLASS = 'search-input--has-value';

// Generate HTML for a single admin table row
function generateAdminRow(admin: Admin): string {
  console.info(`Rendering admin row - ID: ${String(admin.id)}, isActive: ${String(admin.isActive)}`);

  const deptBadge = getDepartmentsBadge(admin);
  const statusBadge = getStatusBadge(admin);
  const employeeNumber = admin.employeeNumber ?? '-';

  console.info(`Admin ${admin.username} - statusBadge: ${statusBadge}`);

  return `
    <tr>
      <td>${String(admin.id)}</td>
      <td>
        <div class="flex items-center gap-2">
          <div class="avatar avatar--sm avatar--color-${admin.id % 10}">
            <span>${admin.firstName.charAt(0)}${admin.lastName.charAt(0)}</span>
          </div>
          <span>${admin.firstName} ${admin.lastName}</span>
        </div>
      </td>
      <td>${admin.email}</td>
      <td>${employeeNumber}</td>
      <td>${getPositionDisplay(admin.position ?? '')}</td>
      <td>${statusBadge}</td>
      <td>${deptBadge}</td>
      <td>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" data-action="edit-admin" data-admin-id="${String(admin.id)}">
            <i class="fas fa-edit"></i>
            Bearbeiten
          </button>
          <button class="btn btn-secondary btn-sm" data-action="show-permissions" data-admin-id="${String(admin.id)}">
            <i class="fas fa-key"></i>
            Berechtigungen
          </button>
          <button class="btn btn-danger btn-sm" data-action="delete-admin" data-admin-id="${String(admin.id)}">
            <i class="fas fa-trash"></i>
            Löschen
          </button>
        </div>
      </td>
    </tr>
  `;
}

// Render admin table
/**
 * Get empty state title based on filter
 */
function getEmptyStateTitle(): string {
  if (currentStatusFilter === 'inactive') return 'Keine inaktiven Administratoren';
  if (currentStatusFilter === 'archived') return 'Keine archivierten Administratoren';
  return 'Keine Administratoren gefunden';
}

/**
 * Get empty state description based on filter
 */
function getEmptyStateDescription(): string {
  if (currentStatusFilter === 'inactive' || currentStatusFilter === 'archived') {
    return 'Es gibt aktuell keine Administratoren in dieser Kategorie.';
  }
  return 'Erstellen Sie Ihren ersten Administrator, um das System zu verwalten.';
}

/**
 * Check if add button should be hidden for current filter
 */
function shouldHideAddButton(): boolean {
  return currentStatusFilter === 'inactive' || currentStatusFilter === 'archived';
}

/**
 * Update empty state content based on current filter
 */
function updateEmptyStateContent(): void {
  if (emptyDiv === null) return;

  const emptyStateTitle = emptyDiv.querySelector<HTMLElement>('.empty-state__title');
  const emptyStateDesc = emptyDiv.querySelector<HTMLElement>('.empty-state__description');
  const emptyStateAddBtn = emptyDiv.querySelector<HTMLButtonElement>('#empty-state-add-btn');

  if (emptyStateTitle !== null) {
    emptyStateTitle.textContent = getEmptyStateTitle();
  }

  if (emptyStateDesc !== null) {
    emptyStateDesc.textContent = getEmptyStateDescription();
  }

  if (emptyStateAddBtn !== null) {
    if (shouldHideAddButton()) {
      emptyStateAddBtn.classList.add('u-hidden');
    } else {
      emptyStateAddBtn.classList.remove('u-hidden');
    }
  }
}

/**
 * Show search no results message
 */
function showSearchNoResults(searchValue: string): void {
  if (adminsTableContent === null) return;
  setHTML(
    adminsTableContent,
    '<div class="empty-state"><p class="empty-state__description">Keine Administratoren gefunden für "' +
      searchValue +
      '"</p></div>',
  );
}

/**
 * Show empty state with filter-specific content
 */
function showEmptyState(): void {
  if (adminsTableContent === null) return;
  setHTML(adminsTableContent, '');
  emptyDiv?.classList.remove('u-hidden');
  updateEmptyStateContent();
}

/**
 * Render admin table with data
 */
function renderAdminTable(adminsToRender: Admin[] = admins): void {
  console.info('renderAdminTable called');
  if (adminsTableContent === null) {
    console.error('adminsTableContent not found');
    return;
  }

  loadingDiv?.classList.add('u-hidden');

  // Handle empty results
  if (adminsToRender.length === 0) {
    const searchValue = searchInput?.value ?? '';
    if (searchValue !== '' && searchValue.trim() !== '') {
      showSearchNoResults(searchValue);
    } else {
      showEmptyState();
    }
    return;
  }

  // Hide empty state and render table
  emptyDiv?.classList.add('u-hidden');
  console.info('Admins to render:', adminsToRender);

  const tableHTML = `
    <div class="data-table-wrapper">
      <table class="data-table data-table--hover data-table--striped" id="admins-table">
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Name</th>
            <th scope="col">E-Mail</th>
            <th scope="col">Personalnummer</th>
            <th scope="col">Position</th>
            <th scope="col">Status</th>
            <th scope="col">Abteilungen</th>
            <th scope="col">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          ${adminsToRender.map((admin) => generateAdminRow(admin)).join('')}
        </tbody>
      </table>
    </div>
  `;

  setHTML(adminsTableContent, tableHTML);

  // Re-initialize tooltips for dynamically added elements
  initDataTooltips();
}

// Load admins and render table
async function loadAdminsAndRender() {
  console.info('loadAdminsAndRender called');

  // Show loading state
  loadingDiv?.classList.remove('u-hidden');
  emptyDiv?.classList.add('u-hidden');

  try {
    await loadAdmins();
    renderAdminTable();
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

async function showDeleteConfirmationModal(admin: Admin): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay modal-overlay--active';
    const modalHTML = `
        <div class="ds-modal ds-modal--sm">
          <div class="ds-modal__header">
            <h3 class="ds-modal__title">Administrator löschen</h3>
          </div>
          <div class="ds-modal__body">
            <p>Möchten Sie den Administrator "${admin.username}" wirklich löschen?</p>
          </div>
          <div class="ds-modal__footer">
            <button class="btn btn-danger" id="confirm-delete">Löschen</button>
            <button class="btn btn-secondary" id="cancel-delete">Abbrechen</button>
          </div>
        </div>
      `;
    setHTML(modal, modalHTML);
    document.body.appendChild(modal);

    const confirmBtn = modal.querySelector('#confirm-delete');
    const cancelBtn = modal.querySelector('#cancel-delete-modal');

    const cleanup = () => {
      modal.remove();
    };

    confirmBtn?.addEventListener('click', () => {
      cleanup();
      resolve(true);
    });

    cancelBtn?.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });
  });
}

async function deleteAdminHandler(adminId: number) {
  console.info('deleteAdminHandler called with ID:', adminId);
  console.info('Current admins array:', admins);
  // Convert to string for comparison since API returns string IDs
  const admin = admins.find((a) => String(a.id) === String(adminId));

  if (!admin) {
    console.error('Admin not found for ID:', adminId);
    console.error(
      'Available admin IDs:',
      admins.map((a) => a.id),
    );
    return;
  }

  console.info('Found admin:', admin);

  const confirmDelete = await showDeleteConfirmationModal(admin);

  if (!confirmDelete) {
    console.info('Delete cancelled');
    return;
  }

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

// Close delete modal
function closeDeleteModal(): void {
  deleteModal?.classList.remove('modal-overlay--active');
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
  (window as unknown as ManageAdminsWindow).showPermissionsModal = showPermissionsModal;
  (window as unknown as ManageAdminsWindow).showAddAdminModal = showAddAdminModal;
  (window as unknown as ManageAdminsWindow).closeAdminModal = closeAdminModal;
  (window as unknown as ManageAdminsWindow).closePermissionsModal = closePermissionsModal;
  (window as unknown as ManageAdminsWindow).savePermissionsHandler = savePermissionsHandler;
}

/**
 * Initialize Design System tooltips from data-tooltip attributes
 * Converts data-tooltip="text" to proper tooltip HTML structure
 */
function initDataTooltips() {
  const elements = document.querySelectorAll('[data-tooltip]');

  elements.forEach((element) => {
    const tooltipText = element.getAttribute('data-tooltip');
    const tooltipPosition = element.getAttribute('data-tooltip-position') ?? 'top';

    if (tooltipText === null || tooltipText === '') {
      return;
    }

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
 * Filter admins based on status
 */
function filterByStatus(adminsList: Admin[], status: AdminStatusFilter): Admin[] {
  switch (status) {
    case 'active':
      // Show only active AND not archived
      return adminsList.filter((admin) => admin.isActive && admin.isArchived !== true);
    case 'inactive':
      // Show only inactive AND not archived (exclude archived!)
      return adminsList.filter((admin) => !admin.isActive && admin.isArchived !== true);
    case 'archived':
      // Show only archived (regardless of isActive)
      return adminsList.filter((admin) => admin.isArchived === true);
    case 'all':
      return adminsList;
    default:
      return adminsList;
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
    const fullName = `${admin.firstName} ${admin.lastName}`.toLowerCase();
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

  // Escape special regex characters to prevent injection
  const escapedQuery = escapeRegex(query);
  // eslint-disable-next-line security/detect-non-literal-regexp -- Safe: escapedQuery is sanitized by escapeRegex() which escapes all special regex characters
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return text.replace(regex, '<strong>$1</strong>');
}

/**
 * Generate HTML for a single search result item
 */
function generateSearchResultItem(admin: Admin, query: string): string {
  const fullName = `${admin.firstName} ${admin.lastName}`;
  const position = getPositionDisplay(admin.position ?? '');
  const employeeNumber = admin.employeeNumber ?? '';

  return `
    <div class="search-input__result-item" data-admin-id="${String(admin.id)}" data-action="edit-from-search">
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div style="font-weight: 500; color: var(--color-text-primary);">
          ${highlightMatch(fullName, query)}
        </div>
        <div style="font-size: 0.813rem; color: var(--color-text-secondary);">
          ${highlightMatch(admin.email, query)}
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
function renderSearchResults(results: Admin[], query: string): void {
  const resultsContainer = document.querySelector<HTMLElement>('#admin-search-results');
  const searchWrapper = document.querySelector<HTMLElement>('.search-input-wrapper');

  if (resultsContainer === null || searchWrapper === null) {
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
      `<div class="search-input__no-results">Keine Administratoren gefunden für "${query}"</div>`,
    );
    return;
  }

  // Limit to 5 results for dropdown
  const limitedResults = results.slice(0, 5);

  const resultsHTML = limitedResults.map((admin) => generateSearchResultItem(admin, query)).join('');

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
  const searchWrapper = document.querySelector<HTMLElement>('.search-input-wrapper');
  searchWrapper?.classList.remove('search-input-wrapper--open');
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
  renderAdminTable(filteredAdmins);
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
    renderAdminTable(filteredAdmins);
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
    const adminId = selectedItem.dataset.adminId;
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
    const adminId = resultItem?.dataset.adminId;
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
    const status = btn.dataset.status as AdminStatusFilter | undefined;
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
    renderAdminTable(filteredAdmins);
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

// Setup permission type radio handlers
function setupPermissionRadioHandlers(): void {
  $all(SELECTORS.PERMISSION_TYPE_RADIO).forEach((radio) => {
    radio.addEventListener('change', (e) => {
      void (async () => {
        const permissionType = (e.target as HTMLInputElement).value;
        const deptContainer = $$(SELECTORS.DEPARTMENT_SELECT_CONTAINER);
        const groupContainer = $$('#group-select-container');

        // Hide all containers first
        deptContainer?.classList.add('hidden');
        groupContainer?.classList.add('hidden');

        if (permissionType === 'specific' && deptContainer !== null) {
          deptContainer.classList.remove('hidden');
          await loadAndPopulateDepartments();
        } else if (permissionType === 'groups' && groupContainer !== null) {
          groupContainer.classList.remove('hidden');
          // TODO: Load and populate groups
        }
      })();
    });
  });
}

// Setup department selection buttons
function setupDepartmentSelectionButtons(): void {
  const selectAllBtn = $$('#select-all-departments');
  const deselectAllBtn = $$('#deselect-all-departments');
  const deptSelect = $$(SELECTORS.DEPARTMENT_SELECT) as HTMLSelectElement | null;

  selectAllBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    if (deptSelect !== null) {
      [...deptSelect.options].forEach((option) => {
        option.selected = true;
      });
    }
  });

  deselectAllBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    if (deptSelect !== null) {
      [...deptSelect.options].forEach((option) => {
        option.selected = false;
      });
    }
  });
}

// Setup form submit handler
function setupFormSubmitHandler(): void {
  adminForm?.addEventListener('submit', (e) => {
    void (async () => {
      await handleFormSubmit(e);
      // Reload admins table after form submission
      await loadAdminsAndRender();
    })();
  });
}

// Initialize DOM elements
function initializeDOMElements(): void {
  addAdminBtn = document.querySelector<HTMLButtonElement>('#add-admin-btn');
  deleteModal = document.querySelector('#delete-admin-modal');
  adminForm = document.querySelector<HTMLFormElement>('#admin-form');
  adminsTableContent = document.querySelector('#admins-table-content');
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

// Attach permissions modal listeners
function attachPermissionsModalListeners(): void {
  document.querySelector('#close-permissions-modal')?.addEventListener('click', () => {
    closePermissionsModal();
  });
  document.querySelector('#cancel-permissions-modal')?.addEventListener('click', () => {
    closePermissionsModal();
  });
  document.querySelector('#save-permissions')?.addEventListener('click', () => {
    void savePermissionsHandler();
  });
}

// Attach delete confirmation listener
function attachDeleteConfirmListener(): void {
  document.querySelector('#confirm-delete-admin')?.addEventListener('click', () => {
    const deleteInput = document.querySelector<HTMLInputElement>('#delete-admin-id');
    if (deleteInput !== null && deleteInput.value !== '') {
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
      const adminId = editBtn.dataset.adminId;
      if (adminId !== undefined) {
        void editAdminHandler(Number.parseInt(adminId, 10));
      }
    }

    // Handle delete admin
    const deleteBtn = target.closest<HTMLElement>('[data-action="delete-admin"]');
    if (deleteBtn) {
      const adminId = deleteBtn.dataset.adminId;
      if (adminId !== undefined) {
        showDeleteModal(Number.parseInt(adminId, 10));
      }
    }

    // Handle permissions
    const permBtn = target.closest<HTMLElement>('[data-action="show-permissions"]');
    if (permBtn) {
      const adminId = permBtn.dataset.adminId;
      if (adminId !== undefined) {
        void showPermissionsModal(Number.parseInt(adminId, 10));
      }
    }
  });
}

// Attach all event listeners
function attachEventListeners(): void {
  attachAddAdminListeners();
  attachModalCloseListeners();
  attachPermissionsModalListeners();
  attachDeleteConfirmListener();
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
  setupPermissionRadioHandlers();
  setupDepartmentSelectionButtons();
  setupFormSubmitHandler();
  initializeTooltipHandlers();
  setupEmailValidation(); // Initialize live email validation
  setupPasswordValidation(); // Initialize live password validation
  setupSearchInput(); // Initialize search input functionality
  setupStatusToggle(); // Initialize status filter toggle
})();

// End of file
