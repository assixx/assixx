/* eslint-disable max-lines */
// Logs page functionality
import { showError, showSuccess } from '../auth/index';
import { ApiClient } from '../../utils/api-client';
import { $$, setHTML } from '../../utils/dom-utils';
import {
  initLogsUI,
  handleToggleDropdown,
  handleSelectOption,
  closeDeleteLogsModal,
  openDeleteLogsModal,
  displayActiveFilters,
  resetDropdownDisplays,
} from './ui';

// Type definitions
interface LogEntry {
  id: number;
  userId: number;
  userName: string;
  userRole: string;
  userFirstName?: string;
  userLastName?: string;
  employeeNumber?: string;
  action: string;
  entityType?: string;
  entityId?: number;
  oldValues?: unknown;
  newValues?: unknown;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

interface LogsResponse {
  logs: LogEntry[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

interface LogDetails {
  title?: string;
  shared_to?: string;
  login_method?: string;
  role?: string;
  [key: string]: unknown;
}

type Pagination = LogsResponse['pagination'];

interface Filters {
  user?: string | undefined;
  action?: string | undefined;
  entity_type?: string | undefined;
  timerange?: string | undefined;
}

interface LogsWindow extends Window {
  applyFilters: typeof applyFilters;
  resetFilters: typeof resetFilters;
  deleteFilteredLogs: typeof deleteFilteredLogs;
  loadPreviousPage: typeof loadPreviousPage;
  loadNextPage: typeof loadNextPage;
  showFullDetails: typeof showFullDetails;
  confirmDeleteLogs: typeof confirmDeleteLogs;
  currentFilters?: Filters;
}

// Global variables
const apiClient = ApiClient.getInstance();
let currentOffset = 0;
const limit = 50;
let currentFilters: Filters = {};
let filtersApplied = false; // Tracks if "Apply Filters" was clicked (enables delete/reset buttons)

// Setup filter listeners
function setupFilterListeners() {
  const filterInputs = ['filter-user', 'filter-action', 'filter-entity', 'filter-timerange'];

  filterInputs.forEach((id) => {
    const element = $$(`#${id}`);
    if (element) {
      element.addEventListener('keypress', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          applyFilters();
        }
      });
    }
  });
}

// Helper function to check if a filter value should be included
function shouldIncludeFilter(value: string | undefined): boolean {
  return value !== undefined && value !== '' && value !== 'all';
}

// Helper function to calculate start date based on timerange
function calculateStartDate(timerange: string, now: Date): string {
  switch (timerange) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    case 'week': {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return weekAgo.toISOString();
    }
    case 'month': {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return monthAgo.toISOString();
    }
    default:
      return '';
  }
}

// Build query params for API
function buildQueryParams(): URLSearchParams {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: currentOffset.toString(),
  });

  // Add search filter (searches: first_name, last_name, full_name, employee_number, username, email, department, area, team, action, entity_type)
  if (currentFilters.user !== undefined && currentFilters.user !== '') {
    params.append('search', currentFilters.user);
  }

  // Add action filter
  if (shouldIncludeFilter(currentFilters.action)) {
    params.append('action', currentFilters.action ?? '');
  }

  // Add entity type filter
  if (shouldIncludeFilter(currentFilters.entity_type)) {
    params.append('entityType', currentFilters.entity_type ?? '');
  }

  // Add date range filters
  if (shouldIncludeFilter(currentFilters.timerange)) {
    const now = new Date();
    const startDate = calculateStartDate(currentFilters.timerange ?? '', now);

    if (startDate !== '') {
      params.append('startDate', startDate);
      params.append('endDate', now.toISOString());
    }
  }

  return params;
}

// Load logs
async function loadLogs() {
  const container = $$('#logs-table-container');
  if (!container) return;

  setHTML(
    container,
    `
    <div class="loading">
      <div class="spinner spinner--lg mx-auto">
        <div class="spinner__circle"></div>
      </div>
      <p class="mt-4">Logs werden geladen...</p>
    </div>
  `,
  );

  try {
    const params = buildQueryParams();
    const response = await apiClient.request<LogsResponse>(`/logs?${params.toString()}`, {
      method: 'GET',
    });

    displayLogs(response.logs);
    updatePagination(response.pagination);
    updateDeleteButtonState();
  } catch (error) {
    console.error('Error loading logs:', error);
    setHTML(
      container,
      `
      <div class="empty-state empty-state--sm empty-state--error">
        <div class="empty-state__icon"><i class="fas fa-exclamation-triangle"></i></div>
        <p class="empty-state__title">Fehler beim Laden der Logs</p>
        <div class="empty-state__actions">
          <button class="btn btn-primary btn--sm" onclick="location.reload()">Erneut versuchen</button>
        </div>
      </div>
    `,
    );
  }
}

// Helper functions for formatLogEntry
function formatEntityInfo(entry: LogEntry): string {
  if (entry.entityType === undefined) {
    return '';
  }
  let entityInfo = `<span class="entity-type">${entry.entityType}</span>`;
  if (entry.entityId !== undefined) {
    entityInfo += ` <span class="entity-id">#${entry.entityId}</span>`;
  }
  return entityInfo;
}

// Format log entry for display
function formatLogEntry(entry: LogEntry): string {
  const formattedDate = new Date(entry.createdAt).toLocaleString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const entityInfo = formatEntityInfo(entry);
  const roleLower = entry.userRole.toLowerCase();
  const badgeVariant = roleLower === 'root' ? 'badge--danger' : roleLower === 'admin' ? 'badge--warning' : 'badge--info';
  const roleLabel = getRoleLabel(entry.userRole);

  // Build full name from firstName + lastName, fallback to userName
  const firstName = entry.userFirstName ?? '';
  const lastName = entry.userLastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  const displayName = fullName !== '' ? fullName : entry.userName;
  const employeeNumber = entry.employeeNumber ?? '-';

  return `
    <tr>
      <td class="text-muted">${entry.id}</td>
      <td>
        <div class="user-info">
          <span class="user-name">${displayName}</span>
          <span class="badge badge--sm ${badgeVariant}">${roleLabel}</span>
        </div>
      </td>
      <td class="text-muted">${employeeNumber}</td>
      <td>
        <span class="action-label action-${entry.action.toLowerCase()}">${getActionLabel(entry.action)}</span>
      </td>
      <td>${entityInfo}</td>
      <td class="text-muted ip-cell">${entry.ipAddress ?? '-'}</td>
      <td class="text-muted">${formattedDate}</td>
    </tr>
  `;
}

// Display logs
function displayLogs(logs: LogEntry[]) {
  const container = $$('#logs-table-container');
  if (!container) return;

  if (logs.length === 0) {
    setHTML(
      container,
      `
      <div class="empty-state empty-state--sm">
        <div class="empty-state__icon"><i class="fas fa-search"></i></div>
        <p class="empty-state__title">Keine Logs gefunden</p>
        <p class="empty-state__description">Versuche andere Filterkriterien</p>
      </div>
    `,
    );
    return;
  }

  const rows = logs.map((entry) => formatLogEntry(entry)).join('');

  setHTML(
    container,
    `
    <table class="table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Benutzer</th>
          <th>Personalnr.</th>
          <th>Aktion</th>
          <th>Objekt</th>
          <th>IP-Adresse</th>
          <th>Zeitstempel</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `,
  );
}

// Helper function to update button state
function setButtonDisabled(button: Element | null, disabled: boolean): void {
  if (!button) return;

  if (disabled) {
    button.setAttribute('disabled', 'true');
  } else {
    button.removeAttribute('disabled');
  }
}

// Helper function to update pagination info text
function updatePageInfo(pageInfo: Element | null, pagination: Pagination): void {
  if (!pageInfo) return;

  const currentPage = Math.floor(currentOffset / limit) + 1;
  const totalPages = Math.ceil(pagination.total / limit);
  pageInfo.textContent = `Seite ${currentPage} von ${totalPages} (${pagination.total} Einträge)`;
}

// Helper function to render page number buttons
function renderPageNumbers(currentPage: number, totalPages: number): void {
  const pagesContainer = $$('#pagination-pages');
  if (!pagesContainer) return;

  // Calculate visible page range (max 5 pages)
  let startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, startPage + 4);
  startPage = Math.max(1, endPage - 4);

  const pages: string[] = [];

  // First page + ellipsis if needed
  if (startPage > 1) {
    pages.push(`<button class="pagination__page" data-action="go-to-page" data-page="1">1</button>`);
    if (startPage > 2) {
      pages.push(`<span class="pagination__ellipsis">...</span>`);
    }
  }

  // Page numbers
  for (let i = startPage; i <= endPage; i++) {
    const activeClass = i === currentPage ? ' pagination__page--active' : '';
    pages.push(`<button class="pagination__page${activeClass}" data-action="go-to-page" data-page="${i}">${i}</button>`);
  }

  // Last page + ellipsis if needed
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pages.push(`<span class="pagination__ellipsis">...</span>`);
    }
    pages.push(`<button class="pagination__page" data-action="go-to-page" data-page="${totalPages}">${totalPages}</button>`);
  }

  setHTML(pagesContainer, pages.join(''));
}

// Update pagination
function updatePagination(pagination: Pagination) {
  const paginationContainer = $$('#pagination-container');
  const pageInfo = $$('#pagination-info');
  const prevBtn = $$('#prev-btn');
  const nextBtn = $$('#next-btn');

  const currentPage = Math.floor(currentOffset / limit) + 1;
  const totalPages = Math.ceil(pagination.total / limit);

  // Show/hide pagination container based on results
  if (paginationContainer) {
    paginationContainer.classList.toggle('u-hidden', pagination.total === 0);
  }

  // Update page info text
  updatePageInfo(pageInfo, pagination);

  // Render page numbers
  renderPageNumbers(currentPage, totalPages);

  // Update button states
  setButtonDisabled(prevBtn, currentOffset === 0);
  setButtonDisabled(nextBtn, !pagination.hasMore);
}

// Apply filters
function applyFilters() {
  const userFilter = ($$('#filter-user') as HTMLInputElement | null)?.value;
  const actionFilter = ($$('#filter-action') as HTMLSelectElement | null)?.value;
  const entityFilter = ($$('#filter-entity') as HTMLSelectElement | null)?.value;
  const timerangeFilter = ($$('#filter-timerange') as HTMLSelectElement | null)?.value;

  currentFilters = {
    user: userFilter,
    action: actionFilter,
    entity_type: entityFilter,
    timerange: timerangeFilter,
  };

  // Mark that filters have been applied (enables delete/reset buttons)
  // Even without explicit filters, "all logs" is a valid filter selection
  filtersApplied = true;

  currentOffset = 0;
  updateFilterButtonStates();
  void loadLogs();
}

// Reset filters
function resetFilters() {
  const userFilter = $$('#filter-user') as HTMLInputElement | null;
  const actionFilter = $$('#filter-action') as HTMLInputElement | null;
  const entityFilter = $$('#filter-entity') as HTMLInputElement | null;
  const timerangeFilter = $$('#filter-timerange') as HTMLInputElement | null;

  if (userFilter) userFilter.value = '';
  if (actionFilter) actionFilter.value = 'all';
  if (entityFilter) entityFilter.value = 'all';
  if (timerangeFilter) timerangeFilter.value = 'all';

  // Reset dropdown displays
  resetDropdownDisplays();

  currentFilters = {};
  filtersApplied = false; // Reset the applied state
  currentOffset = 0;
  updateFilterButtonStates();
  void loadLogs();
}

// Delete filtered logs
function deleteFilteredLogs() {
  // Set currentFilters on window for UI module to access
  (window as unknown as LogsWindow).currentFilters = currentFilters;
  displayActiveFilters(currentFilters);
  openDeleteLogsModal();
}

// Build delete request body from current filters
function buildDeleteRequestBody(): Record<string, unknown> {
  const passwordInput = $$('#deleteLogsPassword') as HTMLInputElement | null;
  const body: Record<string, unknown> = {
    confirmPassword: passwordInput?.value ?? '',
  };

  let hasFilters = false;

  // Add search filter (user input field searches across multiple fields in backend)
  if (currentFilters.user !== undefined && currentFilters.user !== '') {
    body['search'] = currentFilters.user;
    hasFilters = true;
  }

  // Add action filter
  if (shouldIncludeFilter(currentFilters.action)) {
    body['action'] = currentFilters.action;
    hasFilters = true;
  }

  // Add entity type filter
  if (shouldIncludeFilter(currentFilters.entity_type)) {
    body['entityType'] = currentFilters.entity_type;
    hasFilters = true;
  }

  // Add date range as olderThanDays (convert timerange to days)
  if (shouldIncludeFilter(currentFilters.timerange)) {
    const daysMap: Record<string, number> = {
      today: 0, // 0 means delete all (no age restriction)
      week: 7,
      month: 30,
    };
    const days = daysMap[currentFilters.timerange ?? ''];
    if (days !== undefined) {
      body['olderThanDays'] = days;
      hasFilters = true;
    }
  }

  // If no specific filters set, use olderThanDays: 0 to delete ALL logs
  // Backend requires at least one filter, and 0 means "no age restriction" = all logs
  if (!hasFilters) {
    body['olderThanDays'] = 0;
  }

  return body;
}

// Confirm delete logs
async function confirmDeleteLogs() {
  try {
    const body = buildDeleteRequestBody();

    await apiClient.request('/logs', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    showSuccess('Logs erfolgreich gelöscht');
    currentOffset = 0;
    filtersApplied = false; // Reset after successful delete
    closeDeleteLogsModal();
    void loadLogs();
  } catch (error) {
    console.error('Error deleting logs:', error);
    showError('Fehler beim Löschen der Logs');
  }
}

// Load previous page
function loadPreviousPage() {
  if (currentOffset >= limit) {
    currentOffset -= limit;
    void loadLogs();
  }
}

// Load next page
function loadNextPage() {
  currentOffset += limit;
  void loadLogs();
}

// Go to specific page
function goToPage(page: number) {
  currentOffset = (page - 1) * limit;
  void loadLogs();
}

// Get human-readable action label
function getActionLabel(action: string): string {
  const actionLabels: Record<string, string> = {
    CREATE: 'Erstellt',
    UPDATE: 'Aktualisiert',
    DELETE: 'Gelöscht',
    LOGIN: 'Anmeldung',
    LOGOUT: 'Abmeldung',
    SHARE: 'Geteilt',
    ARCHIVE: 'Archiviert',
    RESTORE: 'Wiederhergestellt',
    EXPORT: 'Exportiert',
    IMPORT: 'Importiert',
    EMAIL_SENT: 'E-Mail',
    PASSWORD_CHANGE: 'Passwort',
    ROLE_CHANGE: 'Rolle',
  };

  // eslint-disable-next-line security/detect-object-injection -- action comes from server API response, not user input
  return actionLabels[action] ?? action;
}

// Get role label
function getRoleLabel(role: string): string {
  const roleLabels: Record<string, string> = {
    root: 'Root',
    admin: 'Admin',
    employee: 'Mitarbeiter',
  };

  // eslint-disable-next-line security/detect-object-injection -- role comes from server API response, not user input
  return roleLabels[role] ?? role;
}

// Format details for modal display
function formatDetailsForModal(details: LogDetails): string {
  const formattedDetails: string[] = [];

  for (const [key, value] of Object.entries(details)) {
    const formattedKey = key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .replace(/Id$/, ' ID');

    let formattedValue = '';
    if (value === null) {
      formattedValue = '<span class="null-value">null</span>';
    } else if (typeof value === 'object') {
      formattedValue = `<pre>${JSON.stringify(value, null, 2)}</pre>`;
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      formattedValue = String(value);
    } else {
      formattedValue = JSON.stringify(value);
    }

    formattedDetails.push(`
      <div class="detail-row">
        <span class="detail-key">${formattedKey}:</span>
        <span class="detail-value">${formattedValue}</span>
      </div>
    `);
  }

  return formattedDetails.join('');
}

// Show full details in modal (uses Design System: .modal-overlay, .ds-modal)
function showFullDetails(encodedDetails: string) {
  try {
    const detailsStr = decodeURIComponent(encodedDetails);
    const details = JSON.parse(detailsStr) as LogDetails;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay modal-overlay--active';
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    };

    const content = `
      <div class="ds-modal ds-modal--md">
        <div class="ds-modal__header">
          <h3 class="ds-modal__title">
            <i class="fas fa-info-circle mr-2"></i>
            Log-Details
          </h3>
          <button class="ds-modal__close" onclick="this.closest('.modal-overlay').remove()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="ds-modal__body">
          ${formatDetailsForModal(details)}
        </div>
      </div>
    `;

    setHTML(overlay, content);
    document.body.append(overlay);
  } catch (error) {
    console.error('Error parsing details:', error);
    showError('Fehler beim Anzeigen der Details');
  }
}

// Check if any filters are active
function hasActiveFilters(): boolean {
  return (
    (currentFilters.user !== undefined && currentFilters.user !== '') ||
    (currentFilters.action !== undefined && currentFilters.action !== '' && currentFilters.action !== 'all') ||
    (currentFilters.entity_type !== undefined &&
      currentFilters.entity_type !== '' &&
      currentFilters.entity_type !== 'all') ||
    (currentFilters.timerange !== undefined && currentFilters.timerange !== '' && currentFilters.timerange !== 'all')
  );
}

// Update reset button state (enabled when filters have been applied)
function updateResetButtonState() {
  const resetBtn = $$('[data-action="reset-filters"]');
  if (!resetBtn) return;

  // Reset button enabled when "Apply Filters" was clicked
  if (filtersApplied) {
    resetBtn.removeAttribute('disabled');
  } else {
    resetBtn.setAttribute('disabled', 'true');
  }
}

// Update delete button state
function updateDeleteButtonState() {
  const deleteBtn = $$('[data-action="delete-filtered-logs"]');
  if (!deleteBtn) return;

  // Delete button enabled when "Apply Filters" was clicked
  // This includes "all logs" when no explicit filters are set
  if (filtersApplied) {
    deleteBtn.removeAttribute('disabled');
    const filterInfo = hasActiveFilters() ? 'Gefilterte Logs löschen' : 'Alle Logs löschen';
    deleteBtn.setAttribute('title', filterInfo);
  } else {
    deleteBtn.setAttribute('disabled', 'true');
    deleteBtn.setAttribute('title', 'Bitte "Filter anwenden" klicken um Logs zu löschen');
  }
}

// Update all filter-dependent button states
function updateFilterButtonStates() {
  updateResetButtonState();
  updateDeleteButtonState();
}

// ============== INITIALIZATION ==============

/**
 * Check authentication and redirect if not authorized
 * @returns true if authorized, false if redirecting
 */
function checkAuth(): boolean {
  const token = localStorage.getItem('token') ?? localStorage.getItem('accessToken');
  const userRole = localStorage.getItem('userRole');

  if (token === null || token === '' || userRole !== 'root') {
    window.location.href = '/login';
    return false;
  }
  return true;
}

/**
 * Register functions on window object for legacy compatibility
 */
function registerGlobalFunctions(): void {
  (window as unknown as LogsWindow).applyFilters = applyFilters;
  (window as unknown as LogsWindow).resetFilters = resetFilters;
  (window as unknown as LogsWindow).deleteFilteredLogs = deleteFilteredLogs;
  (window as unknown as LogsWindow).loadPreviousPage = loadPreviousPage;
  (window as unknown as LogsWindow).loadNextPage = loadNextPage;
  (window as unknown as LogsWindow).showFullDetails = showFullDetails;
  (window as unknown as LogsWindow).confirmDeleteLogs = confirmDeleteLogs;
}

/**
 * Handle click events via event delegation
 */
function handleActionClick(actionElement: HTMLElement): void {
  const action = actionElement.dataset['action'];

  switch (action) {
    case 'toggle-dropdown':
      handleToggleDropdown(actionElement);
      break;
    case 'select-option':
      handleSelectOption(actionElement);
      break;
    case 'close-delete-modal':
      closeDeleteLogsModal();
      break;
    case 'show-details': {
      const details = actionElement.dataset['details'];
      if (details !== undefined && details !== '') {
        showFullDetails(details);
      }
      break;
    }
    case 'delete-filtered-logs':
      deleteFilteredLogs();
      break;
    case 'reset-filters':
      resetFilters();
      break;
    case 'apply-filters':
      applyFilters();
      break;
    case 'load-previous-page':
      loadPreviousPage();
      break;
    case 'load-next-page':
      loadNextPage();
      break;
    case 'go-to-page': {
      const pageStr = actionElement.dataset['page'];
      if (pageStr !== undefined && pageStr !== '') {
        const page = Number.parseInt(pageStr, 10);
        if (!Number.isNaN(page)) {
          goToPage(page);
        }
      }
      break;
    }
    case 'confirm-delete':
      void confirmDeleteLogs();
      break;
  }
}

// Initialize on page load
(() => {
  if (!checkAuth()) return;

  registerGlobalFunctions();

  document.addEventListener('DOMContentLoaded', () => {
    initLogsUI();
    void loadLogs();
    setupFilterListeners();
    updateFilterButtonStates();
  });

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const actionElement = target.closest<HTMLElement>('[data-action]');
    if (actionElement !== null) {
      handleActionClick(actionElement);
    }
  });
})();
