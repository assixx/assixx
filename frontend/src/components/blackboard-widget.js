/**
 * Blackboard Widget Component
 * Displays recent blackboard entries on dashboards
 */

// HTML-Entities escapen
function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) {
    return '';
  }
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

class BlackboardWidget {
  constructor(containerId, limit = 3, isDashboard = true) {
    this.container = document.querySelector(`#${containerId}`);
    this.limit = limit;
    this.isDashboard = isDashboard;

    if (!this.container) {
      console.error(`Container with ID '${containerId}' not found`);
      return;
    }

    this.loadEntries();
  }

  /**
   * Load blackboard entries from the API
   */
  async loadEntries() {
    try {
      // Show loading indicator
      this.container.innerHTML = `
        <div class="text-center p-3">
          <div class="spinner-border spinner-border-sm text-primary" role="status">
            <span class="visually-hidden">Wird geladen...</span>
          </div>
          <span class="ms-2">Lade Einträge...</span>
        </div>
      `;

      // Get token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No token found');
      }

      // Fetch entries
      const response = await fetch(`/api/blackboard/dashboard?limit=${this.limit}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load entries');
      }

      const entries = await response.json();

      // Display entries
      this.displayEntries(entries);
    } catch (error) {
      console.error('Error loading blackboard entries:', error);
      this.container.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-circle me-2"></i>
          Fehler beim Laden der Einträge
        </div>
      `;
    }
  }

  /**
   * Display entries in the widget
   */
  displayEntries(entries) {
    if (!entries || entries.length === 0) {
      this.container.innerHTML = `
        <div class="text-center p-3">
          <p class="text-muted mb-0">Keine Einträge vorhanden</p>
        </div>
      `;
      return;
    }

    // For dashboard, show card-based design
    if (this.isDashboard) {
      this.renderDashboardWidget(entries);
    } else {
      // For non-dashboard, show simple list
      this.renderSimpleList(entries);
    }
  }

  /**
   * Render dashboard style widget
   */
  /**
   * Get priority class based on priority level
   */
  getPriorityClass(priority) {
    switch (priority) {
      case 'low':
        return 'border-success';
      case 'normal':
        return 'border-primary';
      case 'high':
        return 'border-warning';
      case 'urgent':
        return 'border-danger';
      default:
        return '';
    }
  }

  /**
   * Get level badge HTML based on org level
   */
  getLevelBadge(orgLevel) {
    switch (orgLevel) {
      case 'company':
        return '<span class="badge bg-primary">Firma</span>';
      case 'department':
        return '<span class="badge bg-warning">Abteilung</span>';
      case 'team':
        return '<span class="badge bg-success">Team</span>';
      default:
        return '';
    }
  }

  /**
   * Format entry HTML
   */
  formatEntryHtml(entry) {
    const createdDate = new Date(entry.created_at);
    const formattedDate = createdDate.toLocaleDateString('de-DE');
    const priorityClass = this.getPriorityClass(entry.priority);
    const levelBadge = this.getLevelBadge(entry.org_level);
    const unreadBadge =
      entry.requires_confirmation && !entry.is_confirmed ? '<span class="badge bg-danger ms-2">Ungelesen</span>' : '';

    const confirmButton =
      entry.requires_confirmation && !entry.is_confirmed
        ? `<button class="btn btn-sm btn-outline-success ms-2 confirm-entry-btn" data-id="${escapeHtml(String(entry.id))}">
             Bestätigen
           </button>`
        : '';

    return `
      <div class="blackboard-entry card mb-3 ${priorityClass}">
        <div class="card-body">
          <h5 class="card-title">${escapeHtml(entry.title)} ${unreadBadge}</h5>
          <div class="entry-meta mb-2">
            ${levelBadge}
            <small class="text-muted ms-2">${formattedDate}</small>
          </div>
          <p class="card-text">${escapeHtml(this.truncateText(entry.content, 100))}</p>
          <div class="entry-actions">
            <a href="/blackboard?id=${escapeHtml(String(entry.id))}" class="btn btn-sm btn-primary">Details</a>
            ${confirmButton}
          </div>
        </div>
      </div>
    `;
  }

  renderDashboardWidget(entries) {
    let html = '';

    // Header if on dashboard
    if (this.isDashboard) {
      html += `
        <div class="widget-header">
          <h3 class="widget-title">
            <i class="fas fa-clipboard-list me-2"></i>Ankündigungen
          </h3>
          <a href="/blackboard" class="widget-action">Alle anzeigen</a>
        </div>
      `;
    }

    html += '<div class="blackboard-entries">';

    entries.forEach((entry) => {
      html += this.formatEntryHtml(entry);
    });

    html += '</div>';

    // eslint-disable-next-line no-unsanitized/property -- HTML is sanitized via escapeHtml function
    this.container.innerHTML = html;

    // Add event listeners for confirmation buttons
    this.container.querySelectorAll('.confirm-entry-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const entryId = e.target.dataset.id;
        this.confirmEntry(entryId);
      });
    });
  }

  /**
   * Render simple list style widget
   */
  renderSimpleList(entries) {
    let html = '<ul class="list-group">';

    entries.forEach((entry) => {
      // Format date
      const createdDate = new Date(entry.created_at);
      const formattedDate = createdDate.toLocaleDateString('de-DE');

      // Prepare priority class
      let priorityClass = '';
      if (entry.priority === 'urgent') {
        priorityClass = 'border-left-danger';
      } else if (entry.priority === 'high') {
        priorityClass = 'border-left-warning';
      }

      // Prepare unread indicator
      const unreadIndicator = entry.requires_confirmation && !entry.is_confirmed ? 'list-group-item-warning' : '';

      html += `
        <li class="list-group-item d-flex justify-content-between align-items-center ${priorityClass} ${unreadIndicator}">
          <div>
            <a href="/blackboard?id=${escapeHtml(String(entry.id))}" class="blackboard-entry-link">
              ${escapeHtml(entry.title)}
            </a>
            <small class="d-block text-muted">${formattedDate}</small>
          </div>
          ${
            entry.requires_confirmation && !entry.is_confirmed
              ? `<button class="btn btn-sm btn-outline-success confirm-entry-btn" data-id="${escapeHtml(String(entry.id))}">
                 <i class="fas fa-check"></i>
               </button>`
              : ''
          }
        </li>
      `;
    });

    html += '</ul>';

    // eslint-disable-next-line no-unsanitized/property -- HTML is sanitized via escapeHtml function
    this.container.innerHTML = html;

    // Add event listeners for confirmation buttons
    this.container.querySelectorAll('.confirm-entry-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const entryId = e.target.dataset.id;
        this.confirmEntry(entryId);
      });
    });
  }

  /**
   * Confirm a blackboard entry as read
   */
  async confirmEntry(entryId) {
    try {
      // Get token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No token found');
      }

      const response = await fetch(`/api/blackboard/${entryId}/confirm`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to confirm entry');
      }

      // Reload entries
      this.loadEntries();
    } catch (error) {
      console.error('Error confirming entry:', error);

      showError('Fehler bei der Lesebestätigung.');
    }
  }

  /**
   * Truncate text to a specific length
   */
  truncateText(text, maxLength) {
    // Remove HTML tags
    const plainText = text.replace(/<[^>]+(>|$)/g, '');

    if (plainText.length <= maxLength) {
      return plainText;
    }

    return `${plainText.substring(0, maxLength - 3)}...`;
  }
}

// Export the component
window.BlackboardWidget = BlackboardWidget;
