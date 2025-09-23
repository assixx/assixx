// Logs page functionality
import { showError, showSuccess } from '../scripts/auth';
import { ApiClient } from '../utils/api-client';
import { $$, setHTML } from '../utils/dom-utils';

// Type definitions
interface LogEntry {
  id: number;
  userId: number;
  userName: string;
  userRole: string;
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
  user?: string;
  action?: string;
  entity_type?: string;
  timerange?: string;
}

interface LogsWindow extends Window {
  applyFilters: typeof applyFilters;
  resetFilters: typeof resetFilters;
  deleteFilteredLogs: typeof deleteFilteredLogs;
  loadPreviousPage: typeof loadPreviousPage;
  loadNextPage: typeof loadNextPage;
  showFullDetails: typeof showFullDetails;
  confirmDeleteLogs: typeof confirmDeleteLogs;
}

// Global variables
const apiClient = ApiClient.getInstance();
let currentOffset = 0;
const limit = 50;
let currentFilters: Filters = {};

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

// Build query params for API
function buildQueryParams(): URLSearchParams {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: currentOffset.toString(),
  });

  // Add filters - don't send 'all' to backend
  if (currentFilters.user !== undefined && currentFilters.user !== '') {
    params.append('userId', currentFilters.user);
  }
  if (currentFilters.action !== undefined && currentFilters.action !== '' && currentFilters.action !== 'all') {
    params.append('action', currentFilters.action);
  }
  if (
    currentFilters.entity_type !== undefined &&
    currentFilters.entity_type !== '' &&
    currentFilters.entity_type !== 'all'
  ) {
    params.append('entityType', currentFilters.entity_type);
  }
  // v2 API uses startDate/endDate instead of timerange
  if (currentFilters.timerange !== undefined && currentFilters.timerange !== '' && currentFilters.timerange !== 'all') {
    const now = new Date();
    const endDate = now.toISOString();
    let startDate: string;

    switch (currentFilters.timerange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        break;
      case 'week': {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        startDate = weekAgo.toISOString();
        break;
      }
      case 'month': {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        startDate = monthAgo.toISOString();
        break;
      }
      default:
        startDate = '';
    }

    if (startDate !== '') {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
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
      <div class="loading-spinner"></div>
      <p>Logs werden geladen...</p>
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
      <div class="error-state">
        <p>Fehler beim Laden der Logs</p>
        <button onclick="location.reload()">Erneut versuchen</button>
      </div>
    `,
    );
  }
}

// Helper functions for formatLogEntry
function parseLogDetails(detailsStr: string | undefined): LogDetails | null {
  if (detailsStr === undefined || detailsStr === '') {
    return null;
  }
  return JSON.parse(detailsStr) as LogDetails;
}

function createDetailsButton(detailsStr: string | undefined): string {
  if (detailsStr === undefined || detailsStr === '') {
    return '';
  }
  const encodedDetails = encodeURIComponent(detailsStr);
  return `<button class="btn-icon" data-action="show-details" data-details="${encodedDetails}" title="Details anzeigen">
           <i class="fas fa-info-circle"></i>
         </button>`;
}

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

function buildDetailsSummary(details: LogDetails | null): string {
  if (details === null) {
    return '';
  }

  let summary = '';
  if (details.title !== undefined && details.title !== '') {
    summary = ` - ${details.title}`;
  }
  if (details.shared_to !== undefined && details.shared_to !== '') {
    summary += ` (Geteilt mit: ${details.shared_to})`;
  }
  if (details.login_method !== undefined && details.login_method !== '') {
    summary = ` - ${details.login_method}`;
  }
  return summary;
}

// Format log entry for display
function formatLogEntry(entry: LogEntry): string {
  const details = parseLogDetails(entry.details);
  const detailsButton = createDetailsButton(entry.details);
  const formattedDate = new Date(entry.createdAt).toLocaleString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const entityInfo = formatEntityInfo(entry);
  const roleClass = `role-${entry.userRole.toLowerCase()}`;
  const roleLabel = getRoleLabel(entry.userRole);
  const detailsSummary = buildDetailsSummary(details);

  return `
    <tr>
      <td class="text-muted">${entry.id}</td>
      <td>
        <div class="user-info">
          <span class="user-name">${entry.userName}</span>
          <span class="user-role ${roleClass}">${roleLabel}</span>
        </div>
      </td>
      <td>
        <span class="action-label action-${entry.action.toLowerCase()}">${getActionLabel(entry.action)}</span>
      </td>
      <td>${entityInfo}</td>
      <td class="details-cell">
        <span class="details-text">${entry.action}${detailsSummary}</span>
        ${detailsButton}
      </td>
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
      <div class="no-data">
        <p>Keine Logs gefunden</p>
      </div>
    `,
    );
    return;
  }

  const rows = logs.map((entry) => formatLogEntry(entry)).join('');

  setHTML(
    container,
    `
    <table class="logs-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Benutzer</th>
          <th>Aktion</th>
          <th>Objekt</th>
          <th>Details</th>
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

// Update pagination
function updatePagination(pagination: Pagination) {
  const pageInfo = $$('#page-info');
  const prevBtn = $$('#prev-page');
  const nextBtn = $$('#next-page');

  if (pageInfo) {
    const currentPage = Math.floor(currentOffset / limit) + 1;
    const totalPages = Math.ceil(pagination.total / limit);
    pageInfo.textContent = `Seite ${currentPage} von ${totalPages} (${pagination.total} Einträge)`;
  }

  if (prevBtn) {
    if (currentOffset === 0) {
      prevBtn.setAttribute('disabled', 'true');
    } else {
      prevBtn.removeAttribute('disabled');
    }
  }

  if (nextBtn) {
    if (!pagination.hasMore) {
      nextBtn.setAttribute('disabled', 'true');
    } else {
      nextBtn.removeAttribute('disabled');
    }
  }
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

  currentOffset = 0;
  void loadLogs();
}

// Reset filters
function resetFilters() {
  const userFilter = $$('#filter-user') as HTMLInputElement | null;
  const actionFilter = $$('#filter-action') as HTMLSelectElement | null;
  const entityFilter = $$('#filter-entity') as HTMLSelectElement | null;
  const timerangeFilter = $$('#filter-timerange') as HTMLSelectElement | null;

  if (userFilter) userFilter.value = '';
  if (actionFilter) actionFilter.value = 'all';
  if (entityFilter) entityFilter.value = 'all';
  if (timerangeFilter) timerangeFilter.value = 'all';

  currentFilters = {};
  currentOffset = 0;
  void loadLogs();
}

// Delete filtered logs
function deleteFilteredLogs() {
  const modal = $$('#deleteModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

// Confirm delete logs
async function confirmDeleteLogs() {
  try {
    const params = buildQueryParams();

    await apiClient.request(`/logs?${params.toString()}`, {
      method: 'DELETE',
    });

    showSuccess('Logs erfolgreich gelöscht');
    currentOffset = 0;
    void loadLogs();

    // Close modal
    const modal = $$('#deleteModal');
    if (modal) {
      modal.style.display = 'none';
    }
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

// Show full details in modal
function showFullDetails(encodedDetails: string) {
  try {
    const detailsStr = decodeURIComponent(encodedDetails);
    const details = JSON.parse(detailsStr) as LogDetails;

    const modal = document.createElement('div');
    modal.className = 'modal details-modal';
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    };

    const content = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Log-Details</h3>
          <button onclick="this.closest('.modal').remove()" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          ${formatDetailsForModal(details)}
        </div>
      </div>
    `;

    setHTML(modal, content);
    document.body.append(modal);
  } catch (error) {
    console.error('Error parsing details:', error);
    showError('Fehler beim Anzeigen der Details');
  }
}

// Update delete button state
function updateDeleteButtonState() {
  const deleteBtn = $$('#delete-filtered-btn');
  if (!deleteBtn) return;

  const hasActiveFilters =
    (currentFilters.user !== undefined && currentFilters.user !== '') ||
    (currentFilters.action !== undefined && currentFilters.action !== '' && currentFilters.action !== 'all') ||
    (currentFilters.entity_type !== undefined &&
      currentFilters.entity_type !== '' &&
      currentFilters.entity_type !== 'all') ||
    (currentFilters.timerange !== undefined && currentFilters.timerange !== '' && currentFilters.timerange !== 'all');

  if (hasActiveFilters) {
    deleteBtn.removeAttribute('disabled');
    deleteBtn.setAttribute('title', 'Gefilterte Logs löschen');
  } else {
    deleteBtn.setAttribute('disabled', 'true');
    deleteBtn.setAttribute('title', 'Bitte Filter setzen um Logs zu löschen');
  }
}

// Initialize on page load
(() => {
  // Auth check
  const token = localStorage.getItem('token') ?? localStorage.getItem('accessToken');
  const userRole = localStorage.getItem('userRole');

  if (token === null || token === '' || userRole !== 'root') {
    window.location.href = '/login';
    return;
  }

  // Make functions available globally
  (window as unknown as LogsWindow).applyFilters = applyFilters;
  (window as unknown as LogsWindow).resetFilters = resetFilters;
  (window as unknown as LogsWindow).deleteFilteredLogs = deleteFilteredLogs;
  (window as unknown as LogsWindow).loadPreviousPage = loadPreviousPage;
  (window as unknown as LogsWindow).loadNextPage = loadNextPage;
  (window as unknown as LogsWindow).showFullDetails = showFullDetails;
  (window as unknown as LogsWindow).confirmDeleteLogs = confirmDeleteLogs;

  // Load logs on page load
  document.addEventListener('DOMContentLoaded', () => {
    void loadLogs();
    setupFilterListeners();
    updateDeleteButtonState();
  });

  // Event delegation for dynamically generated content
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle show details
    const detailsBtn = target.closest<HTMLElement>('[data-action="show-details"]');
    if (detailsBtn) {
      const details = detailsBtn.dataset.details;
      if (details !== undefined && details !== '') {
        (window as unknown as LogsWindow).showFullDetails(details);
      }
    }

    // Handle delete filtered logs
    const deleteBtn = target.closest<HTMLElement>('[data-action="delete-filtered"]');
    if (deleteBtn) {
      (window as unknown as LogsWindow).deleteFilteredLogs();
    }

    // Handle reset filters
    const resetBtn = target.closest<HTMLElement>('[data-action="reset-filters"]');
    if (resetBtn) {
      (window as unknown as LogsWindow).resetFilters();
    }

    // Handle apply filters
    const applyBtn = target.closest<HTMLElement>('[data-action="apply-filters"]');
    if (applyBtn) {
      (window as unknown as LogsWindow).applyFilters();
    }

    // Handle load previous page
    const prevBtn = target.closest<HTMLElement>('[data-action="load-previous-page"]');
    if (prevBtn) {
      (window as unknown as LogsWindow).loadPreviousPage();
    }

    // Handle load next page
    const nextBtn = target.closest<HTMLElement>('[data-action="load-next-page"]');
    if (nextBtn) {
      (window as unknown as LogsWindow).loadNextPage();
    }

    // Handle confirm delete
    const confirmBtn = target.closest<HTMLElement>('[data-action="confirm-delete"]');
    if (confirmBtn) {
      void (window as unknown as LogsWindow).confirmDeleteLogs();
    }
  });
})();
