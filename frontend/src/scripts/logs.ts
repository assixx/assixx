// Logs page functionality

// Auth check
const token = localStorage.getItem('token');
const userRole = localStorage.getItem('userRole');

if (!token || userRole !== 'root') {
  window.location.href = '/pages/login.html';
}

interface LogEntry {
  id: number;
  user_id: number;
  user_name: string;
  user_role: string;
  action: string;
  entity_type?: string;
  entity_id?: number;
  details?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

interface LogsResponse {
  success: boolean;
  data: {
    logs: LogEntry[];
    pagination: {
      limit: number;
      offset: number;
      total: number;
      hasMore: boolean;
    };
  };
}

let currentOffset = 0;
const limit = 50;
let currentFilters: any = {};

// Make functions available globally
(window as any).applyFilters = applyFilters;
(window as any).resetFilters = resetFilters;
(window as any).deleteFilteredLogs = deleteFilteredLogs;
(window as any).loadPreviousPage = loadPreviousPage;
(window as any).loadNextPage = loadNextPage;
(window as any).showFullDetails = showFullDetails;
(window as any).confirmDeleteLogs = confirmDeleteLogs;

// Load logs on page load
document.addEventListener('DOMContentLoaded', () => {
  loadLogs();
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
    if (currentFilters.user) {
      params.append('user_id', currentFilters.user);
    }
    if (currentFilters.action && currentFilters.action !== 'all') {
      params.append('action', currentFilters.action);
    }
    if (currentFilters.entity_type && currentFilters.entity_type !== 'all') {
      params.append('entity_type', currentFilters.entity_type);
    }
    if (currentFilters.timerange && currentFilters.timerange !== 'all') {
      params.append('timerange', currentFilters.timerange);
    }

    const response = await fetch(`/api/logs?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const result: LogsResponse = await response.json();

      if (result.success && result.data) {
        displayLogs(result.data.logs);
        updatePagination(result.data.pagination);
      }
    } else {
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
            const date = new Date(log.created_at);
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
                <div>${log.user_name}</div>
                <span class="role-badge role-${log.user_role}">${getRoleLabel(log.user_role)}</span>
              </td>
              <td>
                <span class="action-badge action-${log.action}">${getActionLabel(log.action)}</span>
              </td>
              <td>${log.entity_type || '-'}</td>
              <td>
                ${
                  log.details
                    ? (() => {
                        // Check if details is JSON or plain text
                        try {
                          JSON.parse(log.details);
                          // It's JSON, show with click handler
                          return `<span class="details-preview" onclick="showFullDetails('${btoa(log.details)}')" style="cursor: pointer; text-decoration: underline; color: var(--primary-color);">
                        ${log.details.length > 50 ? log.details.substring(0, 50) + '...' : log.details}
                      </span>`;
                        } catch {
                          // It's plain text, just show it
                          return `<span style="color: var(--text-secondary);">${log.details}</span>`;
                        }
                      })()
                    : '-'
                }
              </td>
              <td>
                <span style="font-size: 12px; color: var(--text-secondary);">
                  ${log.ip_address || '-'}
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
function updatePagination(pagination: any) {
  const container = document.getElementById('pagination-container');
  const prevBtn = document.getElementById('prev-btn') as HTMLButtonElement;
  const nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
  const info = document.getElementById('pagination-info');

  if (!container) return;

  container.style.display = 'flex';

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  if (info) {
    info.textContent = `Seite ${currentPage} von ${totalPages} (${pagination.total} Einträge)`;
  }

  if (prevBtn) {
    prevBtn.disabled = pagination.offset === 0;
  }

  if (nextBtn) {
    nextBtn.disabled = !pagination.hasMore;
  }
}

// Apply filters
function applyFilters() {
  const userFilter = (document.getElementById('filter-user') as HTMLInputElement)?.value;
  const actionFilter = (document.getElementById('filter-action') as HTMLInputElement)?.value;
  const entityFilter = (document.getElementById('filter-entity') as HTMLInputElement)?.value;
  const timerangeFilter = (document.getElementById('filter-timerange') as HTMLInputElement)?.value;

  currentFilters = {};

  // Add filters - 'all' is treated as a special active filter
  if (userFilter) currentFilters.user = userFilter;
  if (actionFilter && actionFilter !== '') currentFilters.action = actionFilter;
  if (entityFilter && entityFilter !== '') currentFilters.entity_type = entityFilter;
  if (timerangeFilter && timerangeFilter !== '') currentFilters.timerange = timerangeFilter;

  // Update delete button state
  updateDeleteButtonState();

  currentOffset = 0;
  loadLogs();
}

// Reset filters
function resetFilters() {
  const userInput = document.getElementById('filter-user') as HTMLInputElement;
  const actionInput = document.getElementById('filter-action') as HTMLInputElement;
  const entityInput = document.getElementById('filter-entity') as HTMLInputElement;
  const timerangeInput = document.getElementById('filter-timerange') as HTMLInputElement;

  if (userInput) userInput.value = '';
  if (actionInput) actionInput.value = 'all';
  if (entityInput) entityInput.value = 'all';
  if (timerangeInput) timerangeInput.value = 'all';

  // Reset dropdown displays
  const actionDisplay = document.getElementById('actionDisplay');
  const entityDisplay = document.getElementById('entityDisplay');
  const timerangeDisplay = document.getElementById('timerangeDisplay');

  if (actionDisplay) actionDisplay.querySelector('span')!.textContent = 'Alle Aktionen';
  if (entityDisplay) entityDisplay.querySelector('span')!.textContent = 'Alle Typen';
  if (timerangeDisplay) timerangeDisplay.querySelector('span')!.textContent = 'Alle Zeit';

  // Reset dropdown selections
  const dropdowns = document.querySelectorAll('.dropdown-option');
  dropdowns.forEach((option) => option.classList.remove('selected'));

  currentFilters = {};
  currentOffset = 0;

  // Update delete button state
  updateDeleteButtonState();

  loadLogs();
}

// Delete filtered logs
async function deleteFilteredLogs() {
  // Check if any filters are applied
  if (Object.keys(currentFilters).length === 0) {
    alert(
      'Keine Filter aktiv!\n\nBitte wählen Sie mindestens einen spezifischen Filter aus (nicht "Alle"), um Logs zu löschen.\n\nDas Löschen ALLER Logs ohne Filter ist aus Sicherheitsgründen nicht erlaubt.',
    );
    return;
  }

  // Show delete confirmation modal
  const modal = document.getElementById('deleteLogsModal');
  const activeFiltersDisplay = document.getElementById('activeFiltersDisplay');

  if (modal && activeFiltersDisplay) {
    // Build filter display
    let filterHTML = '<ul style="list-style: none; padding: 0; margin: 0; color: var(--text-primary);">';

    if (currentFilters.user) {
      filterHTML += `<li>• <strong>Benutzer:</strong> ${currentFilters.user}</li>`;
    }
    if (currentFilters.action) {
      const actionLabels: { [key: string]: string } = {
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
      filterHTML += `<li>• <strong>Aktion:</strong> ${actionLabels[currentFilters.action] || currentFilters.action}</li>`;
    }
    if (currentFilters.entity_type) {
      const entityLabel = currentFilters.entity_type === 'all' ? 'Alle Typen' : currentFilters.entity_type;
      filterHTML += `<li>• <strong>Entitätstyp:</strong> ${entityLabel}</li>`;
    }
    if (currentFilters.timerange) {
      const timeLabels: { [key: string]: string } = {
        all: 'Alle Zeit',
        today: 'Heute',
        yesterday: 'Gestern',
        week: 'Letzte 7 Tage',
        month: 'Letzter Monat',
        '3months': 'Letzte 3 Monate',
        '6months': 'Letzte 6 Monate',
        year: 'Letztes Jahr',
      };
      filterHTML += `<li>• <strong>Zeitraum:</strong> ${timeLabels[currentFilters.timerange] || currentFilters.timerange}</li>`;
    }

    filterHTML += '</ul>';
    activeFiltersDisplay.innerHTML = filterHTML;

    // Show modal
    modal.classList.add('active');

    // Reset confirmation input
    const confirmInput = document.getElementById('deleteLogsConfirmation') as HTMLInputElement;
    const passwordSection = document.getElementById('passwordConfirmSection');
    const passwordInput = document.getElementById('deleteLogsPassword') as HTMLInputElement;

    if (confirmInput) {
      confirmInput.value = '';
      confirmInput.focus();
    }

    // Show password field only if "Alle Aktionen" is selected
    if (passwordSection && passwordInput) {
      if (currentFilters.action === 'all') {
        passwordSection.style.display = 'block';
        passwordInput.value = '';
      } else {
        passwordSection.style.display = 'none';
        passwordInput.value = '';
      }
    }
  }
}

// Confirm delete logs (called from modal)
async function confirmDeleteLogs() {
  const confirmBtn = document.getElementById('confirmDeleteLogsBtn') as HTMLButtonElement;
  const passwordInput = document.getElementById('deleteLogsPassword') as HTMLInputElement;

  // Check if password is required (when action = 'all')
  if (currentFilters.action === 'all') {
    if (!passwordInput || !passwordInput.value) {
      alert('❌ Bitte geben Sie Ihr Root-Passwort ein!');
      return;
    }
  }

  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Lösche...';
  }

  try {
    // Build query params for deletion - don't send 'all' to backend
    const params = new URLSearchParams();
    if (currentFilters.user) params.append('user_id', currentFilters.user);
    if (currentFilters.action && currentFilters.action !== 'all') params.append('action', currentFilters.action);
    if (currentFilters.entity_type && currentFilters.entity_type !== 'all')
      params.append('entity_type', currentFilters.entity_type);
    if (currentFilters.timerange && currentFilters.timerange !== 'all')
      params.append('timerange', currentFilters.timerange);

    // Prepare request options
    const requestOptions: RequestInit = {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    // Add password to body if deleting all actions
    if (currentFilters.action === 'all' && passwordInput?.value) {
      requestOptions.body = JSON.stringify({
        password: passwordInput.value,
      });
    }

    const response = await fetch(`/api/logs?${params}`, requestOptions);

    if (response.ok) {
      const result = await response.json();

      // Close modal
      const modal = document.getElementById('deleteLogsModal');
      if (modal) {
        modal.classList.remove('active');
      }

      // Show success message
      alert(`✅ ${result.deletedCount || 0} Logs wurden erfolgreich gelöscht.`);

      // Reload logs to show updated list
      currentOffset = 0;
      loadLogs();
    } else {
      const error = await response.json();
      alert(`❌ Fehler beim Löschen der Logs: ${error.error || 'Unbekannter Fehler'}`);
    }
  } catch (error) {
    console.error('Error deleting logs:', error);
    alert('❌ Netzwerkfehler beim Löschen der Logs.');
  } finally {
    // Reset button state
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i class="fas fa-trash"></i> Logs löschen';
    }
  }
}

// Load previous page
function loadPreviousPage() {
  if (currentOffset >= limit) {
    currentOffset -= limit;
    loadLogs();
  }
}

// Load next page
function loadNextPage() {
  currentOffset += limit;
  loadLogs();
}

// Helper function to get readable action labels
function getActionLabel(action: string): string {
  const actionLabels: { [key: string]: string } = {
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
  return actionLabels[action] || action;
}

// Helper function to get readable role labels
function getRoleLabel(role: string): string {
  const roleLabels: { [key: string]: string } = {
    root: 'Root',
    admin: 'Admin',
    employee: 'Mitarbeiter',
  };
  return roleLabels[role] || role;
}

// Show full details in a modal or alert
function showFullDetails(encodedDetails: string) {
  try {
    const details = atob(encodedDetails);
    const parsed = JSON.parse(details);
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
        <div class="modal-body" style="padding: 20px;">
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
  } catch (error) {
    // If it's not JSON, just show the raw text
    alert(atob(encodedDetails));
  }
}

// Update delete button state based on active filters
function updateDeleteButtonState() {
  const deleteBtn = document.querySelector('.btn-danger[onclick="deleteFilteredLogs()"]') as HTMLButtonElement;
  if (deleteBtn) {
    const hasActiveFilters = Object.keys(currentFilters).length > 0;
    deleteBtn.disabled = !hasActiveFilters;

    if (hasActiveFilters) {
      deleteBtn.style.opacity = '1';
      deleteBtn.style.cursor = 'pointer';
      deleteBtn.title = 'Löscht alle Logs die den aktuellen Filtern entsprechen';
    } else {
      deleteBtn.style.opacity = '0.5';
      deleteBtn.style.cursor = 'not-allowed';
      deleteBtn.title = 'Wählen Sie zuerst spezifische Filter aus';
    }
  }
}
