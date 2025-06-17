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
(window as any).loadPreviousPage = loadPreviousPage;
(window as any).loadNextPage = loadNextPage;

// Load logs on page load
document.addEventListener('DOMContentLoaded', () => {
  loadLogs();
  setupFilterListeners();
});

// Setup filter listeners
function setupFilterListeners() {
  const filterInputs = ['filter-user', 'filter-action', 'filter-entity', 'filter-timerange'];
  
  filterInputs.forEach(id => {
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

    // Add filters
    if (currentFilters.user) {
      params.append('user_id', currentFilters.user);
    }
    if (currentFilters.action) {
      params.append('action', currentFilters.action);
    }
    if (currentFilters.entity_type) {
      params.append('entity_type', currentFilters.entity_type);
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
        ${logs.map(log => {
          const date = new Date(log.created_at);
          const dateString = date.toLocaleDateString('de-DE', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
          });
          const timeString = date.toLocaleTimeString('de-DE', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
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
              <td>${log.details || '-'}</td>
              <td>
                <span style="font-size: 12px; color: var(--text-secondary);">
                  ${log.ip_address || '-'}
                </span>
              </td>
            </tr>
          `;
        }).join('')}
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
  const actionFilter = (document.getElementById('filter-action') as HTMLSelectElement)?.value;
  const entityFilter = (document.getElementById('filter-entity') as HTMLSelectElement)?.value;
  const timerangeFilter = (document.getElementById('filter-timerange') as HTMLSelectElement)?.value;

  currentFilters = {
    user: userFilter,
    action: actionFilter,
    entity_type: entityFilter,
    timerange: timerangeFilter,
  };

  currentOffset = 0;
  loadLogs();
}

// Reset filters
function resetFilters() {
  (document.getElementById('filter-user') as HTMLInputElement).value = '';
  (document.getElementById('filter-action') as HTMLSelectElement).value = '';
  (document.getElementById('filter-entity') as HTMLSelectElement).value = '';
  (document.getElementById('filter-timerange') as HTMLSelectElement).value = '';

  currentFilters = {};
  currentOffset = 0;
  loadLogs();
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
    'login': 'Anmeldung',
    'logout': 'Abmeldung',
    'create': 'Erstellt',
    'update': 'Aktualisiert',
    'delete': 'Gelöscht',
    'upload': 'Hochgeladen',
    'download': 'Heruntergeladen',
    'view': 'Angesehen',
    'assign': 'Zugewiesen',
    'unassign': 'Entfernt'
  };
  return actionLabels[action] || action;
}

// Helper function to get readable role labels
function getRoleLabel(role: string): string {
  const roleLabels: { [key: string]: string } = {
    'root': 'Root',
    'admin': 'Admin',
    'employee': 'Mitarbeiter'
  };
  return roleLabels[role] || role;
}