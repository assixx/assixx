// Logs page functionality
import { showError, showSuccess } from '../scripts/auth';
import { ApiClient } from '../utils/api-client';

(() => {
  // Initialize API client
  const apiClient = ApiClient.getInstance();
  // Auth check
  const token = localStorage.getItem('token') ?? localStorage.getItem('accessToken');
  const userRole = localStorage.getItem('userRole');

  if (token === null || token === '' || userRole !== 'root') {
    window.location.href = '/login';
    return;
  }

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

  let currentOffset = 0;
  const limit = 50;
  interface Filters {
    user?: string;
    action?: string;
    entity_type?: string;
    timerange?: string;
  }

  let currentFilters: Filters = {};

  // Make functions available globally
  interface LogsWindow extends Window {
    applyFilters: typeof applyFilters;
    resetFilters: typeof resetFilters;
    deleteFilteredLogs: typeof deleteFilteredLogs;
    loadPreviousPage: typeof loadPreviousPage;
    loadNextPage: typeof loadNextPage;
    showFullDetails: typeof showFullDetails;
    confirmDeleteLogs: typeof confirmDeleteLogs;
  }

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

  // Setup filter listeners
  function setupFilterListeners() {
    const filterInputs = ['filter-user', 'filter-action', 'filter-entity', 'filter-timerange'];

    filterInputs.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            applyFilters();
          }
        });
      }
    });
  }

  // Load logs
  async function loadLogs() {
    const container = document.getElementById('logs-table-container');
    if (!container) return;

    container.innerHTML = `
    <div class="loading">
      <div class="loading-spinner"></div>
      <p>Logs werden geladen...</p>
    </div>
  `;

    try {
      // Build query params
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
      if (
        currentFilters.timerange !== undefined &&
        currentFilters.timerange !== '' &&
        currentFilters.timerange !== 'all'
      ) {
        const now = new Date();
        const endDate = now.toISOString();
        let startDate: string;

        const HOUR_IN_MS = 60 * 60 * 1000;
        const DAY_IN_MS = 24 * HOUR_IN_MS;
        const WEEK_IN_MS = 7 * DAY_IN_MS;
        const MONTH_IN_MS = 30 * DAY_IN_MS;

        switch (currentFilters.timerange) {
          case '24h':
            startDate = new Date(now.getTime() - DAY_IN_MS).toISOString();
            break;
          case '7d':
            startDate = new Date(now.getTime() - WEEK_IN_MS).toISOString();
            break;
          case '30d':
            startDate = new Date(now.getTime() - MONTH_IN_MS).toISOString();
            break;
          default:
            startDate = new Date(now.getTime() - DAY_IN_MS).toISOString();
        }

        params.append('startDate', startDate);
        params.append('endDate', endDate);
      }

      // Use apiClient which will automatically use v2 if feature flag is enabled
      try {
        const result: LogsResponse = await apiClient.request(`/logs?${params}`);

        displayLogs(result.logs);
        updatePagination(result.pagination);
      } catch (error) {
        console.error('Error loading logs:', error);
        container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <div class="empty-state-text">Fehler beim Laden der Logs</div>
        </div>
      `;
      }
    } catch (error) {
      console.error('Error loading logs:', error);
      container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-text">Netzwerkfehler</div>
        <div class="empty-state-subtext">Bitte versuchen Sie es später erneut</div>
      </div>
    `;
    }
  }

  // Display logs in table
  function displayLogs(logs: LogEntry[]) {
    const container = document.getElementById('logs-table-container');
    if (!container) return;

    if (logs.length === 0) {
      container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">Keine Logs gefunden</div>
        <div class="empty-state-subtext">Versuchen Sie andere Filtereinstellungen</div>
      </div>
    `;
      return;
    }

    container.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Zeitstempel</th>
          <th>Benutzer</th>
          <th>Aktion</th>
          <th>Typ</th>
          <th>Details</th>
          <th>IP-Adresse</th>
        </tr>
      </thead>
      <tbody>
        ${logs
          .map((log) => {
            const date = new Date(log.createdAt);
            const dateString = date.toLocaleDateString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            });
            const timeString = date.toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return `
            <tr>
              <td>
                <div>${dateString}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">${timeString}</div>
              </td>
              <td>
                <div>${log.userName}</div>
                <span class="role-badge role-${log.userRole}">${getRoleLabel(log.userRole)}</span>
              </td>
              <td>
                <span class="action-badge action-${log.action}">${getActionLabel(log.action)}</span>
              </td>
              <td>${log.entityType ?? '-'}</td>
              <td>
                ${
                  log.newValues !== undefined ||
                  log.oldValues !== undefined ||
                  (log.details !== undefined && log.details !== '')
                    ? (() => {
                        // For v2 API, use newValues/oldValues
                        const details =
                          log.details ??
                          (log.newValues !== undefined
                            ? JSON.stringify(log.newValues)
                            : log.oldValues !== undefined
                              ? JSON.stringify(log.oldValues)
                              : '');

                        // Check if details is JSON or plain text
                        try {
                          const parsedDetails =
                            typeof details === 'string' ? (JSON.parse(details) as LogDetails) : (details as LogDetails);

                          // Format KVP details specially
                          if (log.action === 'kvp_created' || log.action === 'kvp_shared') {
                            let formatted = '';
                            if (parsedDetails.title !== undefined && parsedDetails.title !== '') {
                              formatted = `"${parsedDetails.title}"`;
                            }
                            if (parsedDetails.shared_to !== undefined && parsedDetails.shared_to !== '') {
                              formatted = `Geteilt an: ${parsedDetails.shared_to === 'company' ? 'Firmenweit' : parsedDetails.shared_to}`;
                            }
                            return `<span style="color: var(--text-secondary);">${formatted}</span>`;
                          }

                          // For login/logout show simplified info
                          if (log.action === 'login' || log.action === 'logout') {
                            if (parsedDetails.login_method !== undefined && parsedDetails.login_method !== '') {
                              return `<span style="color: var(--text-secondary);">Method: ${parsedDetails.login_method}</span>`;
                            }
                            if (parsedDetails.role !== undefined && parsedDetails.role !== '') {
                              return `<span style="color: var(--text-secondary);">Role: ${parsedDetails.role}</span>`;
                            }
                          }

                          // For other JSON details, show with click handler
                          const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);
                          return `<span class="details-preview" onclick="showFullDetails('${btoa(detailsStr)}')" style="cursor: pointer; text-decoration: underline; color: var(--primary-color);">
                        ${detailsStr.length > 50 ? `${detailsStr.substring(0, 50)}...` : detailsStr}
                      </span>`;
                        } catch {
                          // It's plain text, just show it
                          const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);
                          return `<span style="color: var(--text-secondary);">${detailsStr}</span>`;
                        }
                      })()
                    : '-'
                }
              </td>
              <td>
                <span style="font-size: 12px; color: var(--text-secondary);">
                  ${log.ipAddress ?? '-'}
                </span>
              </td>
            </tr>
          `;
          })
          .join('')}
      </tbody>
    </table>
  `;
  }

  // Update pagination
  interface Pagination {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  }

  function updatePagination(pagination: Pagination) {
    const container = document.getElementById('pagination-container');
    const prevBtn = document.getElementById('prev-btn') as HTMLButtonElement | null;
    const nextBtn = document.getElementById('next-btn') as HTMLButtonElement | null;
    const info = document.getElementById('pagination-info');

    if (!container) return;

    container.style.display = 'flex';

    const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
    const totalPages = Math.ceil(pagination.total / pagination.limit);

    if (info) {
      info.textContent = `Seite ${currentPage} von ${totalPages} (${pagination.total} Einträge)`;
    }

    if (prevBtn !== null) {
      prevBtn.disabled = pagination.offset === 0;
    }

    if (nextBtn !== null) {
      nextBtn.disabled = !pagination.hasMore;
    }
  }

  // Apply filters
  function applyFilters() {
    const userFilter = (document.getElementById('filter-user') as HTMLInputElement | null)?.value;
    const actionFilter = (document.getElementById('filter-action') as HTMLInputElement | null)?.value;
    const entityFilter = (document.getElementById('filter-entity') as HTMLInputElement | null)?.value;
    const timerangeFilter = (document.getElementById('filter-timerange') as HTMLInputElement | null)?.value;

    console.info('applyFilters called with:', { userFilter, actionFilter, entityFilter, timerangeFilter });

    currentFilters = {};

    // Add filters - 'all' SHOULD be treated as an active filter for delete button!
    if (userFilter !== undefined && userFilter !== '') currentFilters.user = userFilter;
    // WICHTIG: Auch 'all' als aktiven Filter speichern, damit der Delete-Button aktiviert wird
    if (actionFilter !== undefined && actionFilter !== '') currentFilters.action = actionFilter; // Removed check for empty string
    if (entityFilter !== undefined && entityFilter !== '') currentFilters.entity_type = entityFilter; // Removed check for empty string
    if (timerangeFilter !== undefined && timerangeFilter !== '') currentFilters.timerange = timerangeFilter; // Removed check for empty string

    console.info('currentFilters after setting:', currentFilters);

    // Update delete button state
    updateDeleteButtonState();

    currentOffset = 0;
    void loadLogs();
  }

  // Reset filters
  function resetFilters() {
    const userInput = document.getElementById('filter-user') as HTMLInputElement | null;
    const actionInput = document.getElementById('filter-action') as HTMLInputElement | null;
    const entityInput = document.getElementById('filter-entity') as HTMLInputElement | null;
    const timerangeInput = document.getElementById('filter-timerange') as HTMLInputElement | null;

    if (userInput !== null) userInput.value = '';
    if (actionInput !== null) actionInput.value = 'all';
    if (entityInput !== null) entityInput.value = 'all';
    if (timerangeInput !== null) timerangeInput.value = 'all';

    // Reset dropdown displays
    const actionDisplay = document.getElementById('actionDisplay');
    const entityDisplay = document.getElementById('entityDisplay');
    const timerangeDisplay = document.getElementById('timerangeDisplay');

    if (actionDisplay) {
      const span = actionDisplay.querySelector('span');
      if (span) span.textContent = 'Alle Aktionen';
    }
    if (entityDisplay) {
      const span = entityDisplay.querySelector('span');
      if (span) span.textContent = 'Alle Typen';
    }
    if (timerangeDisplay) {
      const span = timerangeDisplay.querySelector('span');
      if (span) span.textContent = 'Alle Zeit';
    }

    // Reset dropdown selections
    const dropdowns = document.querySelectorAll('.dropdown-option');
    dropdowns.forEach((option) => {
      option.classList.remove('selected');
    });

    currentFilters = {};
    currentOffset = 0;

    // Update delete button state
    updateDeleteButtonState();

    void loadLogs();
  }

  // Delete filtered logs
  function deleteFilteredLogs() {
    // Check if any filters are applied
    if (Object.keys(currentFilters).length === 0) {
      showError(
        'Keine Filter aktiv! Bitte wählen Sie mindestens einen spezifischen Filter aus (nicht "Alle"), um Logs zu löschen.',
      );
      return;
    }

    // Show delete confirmation modal
    const modal = document.getElementById('deleteLogsModal');
    const activeFiltersDisplay = document.getElementById('activeFiltersDisplay');

    if (modal && activeFiltersDisplay) {
      // Build filter display
      let filterHTML = '<ul style="list-style: none; padding: 0; margin: 0; color: var(--text-primary);">';

      if (currentFilters.user !== undefined && currentFilters.user !== '') {
        filterHTML += `<li>• <strong>Benutzer:</strong> ${currentFilters.user}</li>`;
      }
      if (currentFilters.action !== undefined && currentFilters.action !== '') {
        const actionLabels: Record<string, string> = {
          all: 'Alle Aktionen',
          login: 'Anmeldung',
          logout: 'Abmeldung',
          create: 'Erstellt',
          update: 'Aktualisiert',
          delete: 'Gelöscht',
          upload: 'Hochgeladen',
          download: 'Heruntergeladen',
          view: 'Angesehen',
          assign: 'Zugewiesen',
          unassign: 'Entfernt',
        };
        filterHTML += `<li>• <strong>Aktion:</strong> ${actionLabels[currentFilters.action] ?? currentFilters.action}</li>`;
      }
      if (currentFilters.entity_type !== undefined && currentFilters.entity_type !== '') {
        const entityLabel = currentFilters.entity_type === 'all' ? 'Alle Typen' : currentFilters.entity_type;
        filterHTML += `<li>• <strong>Entitätstyp:</strong> ${entityLabel}</li>`;
      }
      if (currentFilters.timerange !== undefined && currentFilters.timerange !== '') {
        const timeLabels: Record<string, string> = {
          all: 'Alle Zeit',
          today: 'Heute',
          yesterday: 'Gestern',
          week: 'Letzte 7 Tage',
          month: 'Letzter Monat',
          '3months': 'Letzte 3 Monate',
          '6months': 'Letzte 6 Monate',
          year: 'Letztes Jahr',
        };
        filterHTML += `<li>• <strong>Zeitraum:</strong> ${timeLabels[currentFilters.timerange] ?? currentFilters.timerange}</li>`;
      }

      filterHTML += '</ul>';
      activeFiltersDisplay.innerHTML = filterHTML;

      // Show modal
      modal.classList.add('active');

      // Reset confirmation input
      const confirmInput = document.getElementById('deleteLogsConfirmation') as HTMLInputElement | null;
      const passwordSection = document.getElementById('passwordConfirmSection');
      const passwordInput = document.getElementById('deleteLogsPassword') as HTMLInputElement | null;

      if (confirmInput !== null) {
        confirmInput.value = '';
        confirmInput.focus();
      }

      // v2 API requires password for ALL delete operations
      if (passwordSection && passwordInput !== null) {
        passwordSection.style.display = 'block';
        passwordInput.value = '';
        passwordInput.focus();
      }
    }
  }

  // Confirm delete logs (called from modal)
  async function confirmDeleteLogs() {
    const confirmBtn = document.getElementById('confirmDeleteLogsBtn') as HTMLButtonElement | null;
    const passwordInput = document.getElementById('deleteLogsPassword') as HTMLInputElement | null;

    // v2 API requires password for ALL delete operations
    if (passwordInput === null || passwordInput.value === '') {
      showError('❌ Bitte geben Sie Ihr Root-Passwort ein!');
      return;
    }

    if (confirmBtn !== null) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Lösche...';
    }

    try {
      // Check if we're deleting ALL logs (all filters are 'all' or empty)
      const isDeletingAll =
        (currentFilters.user === undefined || currentFilters.user === '') &&
        (currentFilters.action === undefined || currentFilters.action === 'all') &&
        (currentFilters.entity_type === undefined || currentFilters.entity_type === 'all') &&
        (currentFilters.timerange === undefined || currentFilters.timerange === 'all');

      console.info('confirmDeleteLogs - Current filters:', currentFilters);
      console.info('confirmDeleteLogs - isDeletingAll:', isDeletingAll);

      // v2 API expects ALL filters in the body, not as query params

      // Prepare request options
      const requestOptions: RequestInit = {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token ?? ''}`,
          'Content-Type': 'application/json',
        },
      };

      interface DeleteLogsBody {
        confirmPassword: string;
        userId?: number;
        tenantId?: number;
        action?: string;
        entityType?: string;
        olderThanDays?: number;
      }

      const bodyData: DeleteLogsBody = {
        confirmPassword: passwordInput.value, // Always use the actual password
      };

      // Add filters to body based on what's selected
      // v2 API now supports all filters in body
      if (currentFilters.user !== undefined && currentFilters.user !== '') {
        bodyData.userId = parseInt(currentFilters.user, 10);
      }

      // Now the backend supports action and entityType directly!
      if (currentFilters.action !== undefined && currentFilters.action !== '' && currentFilters.action !== 'all') {
        bodyData.action = currentFilters.action;
        console.info(`Deleting logs with action="${currentFilters.action}"`);
      }

      if (
        currentFilters.entity_type !== undefined &&
        currentFilters.entity_type !== '' &&
        currentFilters.entity_type !== 'all'
      ) {
        bodyData.entityType = currentFilters.entity_type; // Note: camelCase for v2 API
        console.info(`Deleting logs with entityType="${currentFilters.entity_type}"`);
      }

      // Handle timerange filter properly - convert to days
      if (
        currentFilters.timerange !== undefined &&
        currentFilters.timerange !== '' &&
        currentFilters.timerange !== 'all'
      ) {
        switch (currentFilters.timerange) {
          case '24h':
            bodyData.olderThanDays = 1; // Delete logs older than 1 day
            break;
          case '7d':
            bodyData.olderThanDays = 7; // Delete logs older than 7 days
            break;
          case '30d':
            bodyData.olderThanDays = 30; // Delete logs older than 30 days
            break;
          default:
            // For "today" or other specific ranges, use 0 to delete all matching logs
            bodyData.olderThanDays = 0;
        }
        console.info(`Timerange filter "${currentFilters.timerange}" -> olderThanDays: ${bodyData.olderThanDays}`);
      }

      // If deleting ALL logs (no specific filters), use olderThanDays=0
      if (
        isDeletingAll ||
        (bodyData.userId === undefined &&
          bodyData.tenantId === undefined &&
          bodyData.action === undefined &&
          bodyData.entityType === undefined &&
          bodyData.olderThanDays === undefined)
      ) {
        bodyData.olderThanDays = 0; // This will delete all logs (no age restriction)
        console.info('Ensuring at least one filter is provided - using olderThanDays: 0 (delete all)');
      }

      requestOptions.body = JSON.stringify(bodyData);
      console.info('confirmDeleteLogs - Final body data:', bodyData);

      // Use apiClient for v2 API
      // Note: We're not passing query params since v2 expects everything in body
      try {
        const result = await apiClient.request<{ deletedCount: number }>('/logs', requestOptions);

        // Close modal
        const modal = document.getElementById('deleteLogsModal');
        if (modal) {
          modal.classList.remove('active');
        }

        // Show success message
        showSuccess(`✅ ${result.deletedCount} Logs wurden erfolgreich gelöscht.`);

        // Reload logs to show updated list
        currentOffset = 0;
        void loadLogs();
      } catch (apiError) {
        console.error('Delete logs error:', apiError);
        let errorMessage = 'Unbekannter Fehler';

        if (apiError !== null && apiError !== undefined && typeof apiError === 'object' && 'message' in apiError) {
          errorMessage = String(apiError.message);
        } else if (apiError instanceof Error) {
          errorMessage = apiError.message;
        } else if (typeof apiError === 'string') {
          errorMessage = apiError;
        }

        // Special handling for common errors
        if (errorMessage.includes('Invalid password') || errorMessage.includes('Unauthorized')) {
          errorMessage = 'Falsches Passwort';
        } else if (errorMessage.includes('Validation failed')) {
          errorMessage = 'Validierungsfehler - bitte prüfen Sie Ihre Eingaben';
        }

        showError(`❌ Fehler beim Löschen der Logs: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error deleting logs:', error);
      showError('❌ Netzwerkfehler beim Löschen der Logs.');
    } finally {
      // Reset button state
      if (confirmBtn !== null) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fas fa-trash"></i> Logs löschen';
      }
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

  // Helper function to get readable action labels
  function getActionLabel(action: string): string {
    const actionLabels: Record<string, string> = {
      login: 'Anmeldung',
      logout: 'Abmeldung',
      create: 'Erstellt',
      update: 'Aktualisiert',
      delete: 'Gelöscht',
      upload: 'Hochgeladen',
      download: 'Heruntergeladen',
      view: 'Angesehen',
      assign: 'Zugewiesen',
      unassign: 'Entfernt',
      kvp_created: 'KVP Erstellt',
      kvp_shared: 'KVP Geteilt',
    };
    return actionLabels[action] ?? action;
  }

  // Helper function to get readable role labels
  function getRoleLabel(role: string): string {
    const roleLabels: Record<string, string> = {
      root: 'Root',
      admin: 'Admin',
      employee: 'Mitarbeiter',
    };
    return roleLabels[role] ?? role;
  }

  // Show full details in a modal or alert
  function showFullDetails(encodedDetails: string) {
    try {
      const details = atob(encodedDetails);
      const parsed = JSON.parse(details) as unknown;
      const formatted = JSON.stringify(parsed, null, 2);

      // Create a modal to show the full details
      const modal = document.createElement('div');
      modal.className = 'modal active';
      modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Log Details</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body" style="padding: 24px;">
          <pre style="color: var(--text-primary); background: rgba(0, 0, 0, 0.3); padding: 15px; border-radius: 8px; overflow-x: auto; max-height: 400px;">${formatted}</pre>
        </div>
      </div>
    `;
      document.body.appendChild(modal);

      // Close modal on outside click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    } catch {
      // If it's not JSON, just show the raw text in modal
      const decodedText = atob(encodedDetails);
      const modal = document.createElement('div');
      modal.className = 'modal active';
      modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Log Details</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body" style="padding: 24px;">
          <pre style="color: var(--text-primary); background: rgba(0, 0, 0, 0.3); padding: 15px; border-radius: 8px; overflow-x: auto; max-height: 400px;">${decodedText}</pre>
        </div>
      </div>
    `;
      document.body.appendChild(modal);
    }
  }

  // Update delete button state based on active filters
  function updateDeleteButtonState() {
    const deleteBtn = document.querySelector('.btn-danger[onclick="deleteFilteredLogs()"]');
    if (deleteBtn) {
      const hasActiveFilters = Object.keys(currentFilters).length > 0;
      (deleteBtn as HTMLButtonElement).disabled = !hasActiveFilters;

      if (hasActiveFilters) {
        (deleteBtn as HTMLElement).style.opacity = '1';
        (deleteBtn as HTMLElement).style.cursor = 'pointer';
        (deleteBtn as HTMLElement).title = 'Löscht alle Logs die den aktuellen Filtern entsprechen';
      } else {
        (deleteBtn as HTMLElement).style.opacity = '0.5';
        (deleteBtn as HTMLElement).style.cursor = 'not-allowed';
        (deleteBtn as HTMLElement).title = 'Wählen Sie zuerst spezifische Filter aus';
      }
    }
  }
})();
