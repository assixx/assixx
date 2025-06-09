/**
 * Blackboard Widget Component
 * Displays latest blackboard entries in a compact format for dashboard
 */

class BlackboardWidget {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.entries = [];
    this.loading = false;
    this.init();
  }

  async init() {
    this.render();
    await this.loadEntries();

    // Listen for sidebar toggle events
    this.setupSidebarListener();
  }

  setupSidebarListener() {
    // Use MutationObserver to detect sidebar class changes
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          // Sidebar state changed, reload entries
          this.loadEntries();
        }
      });
    });

    observer.observe(sidebar, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  render() {
    this.container.innerHTML = `
            <div class="blackboard-widget">
                <div class="blackboard-widget-header">
                    <h3 class="blackboard-widget-title">
                        <i class="fas fa-thumbtack"></i>
                        Schwarzes Brett
                    </h3>
                    <a href="/pages/blackboard.html" class="blackboard-widget-link">
                        Alle anzeigen <i class="fas fa-arrow-right"></i>
                    </a>
                </div>
                <div id="blackboard-widget-content">
                    <div class="blackboard-widget-loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Lade Einträge...</p>
                    </div>
                </div>
            </div>
        `;
  }

  async loadEntries() {
    this.loading = true;
    const contentElement = document.getElementById('blackboard-widget-content');

    try {
      // Check if sidebar is collapsed
      const sidebar = document.querySelector('.sidebar');
      const isCollapsed = sidebar && sidebar.classList.contains('collapsed');
      const limit = isCollapsed ? 5 : 3;

      const response = await fetch(`/api/blackboard/dashboard?limit=${limit}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load entries');
      }

      this.entries = await response.json();
      this.renderEntries();
    } catch (error) {
      console.error('Error loading blackboard entries:', error);
      contentElement.innerHTML = `
                <div class="blackboard-widget-empty">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Fehler beim Laden der Einträge</p>
                </div>
            `;
    } finally {
      this.loading = false;
    }
  }

  renderEntries() {
    const contentElement = document.getElementById('blackboard-widget-content');

    if (this.entries.length === 0) {
      contentElement.innerHTML = `
                <div class="blackboard-widget-empty">
                    <i class="fas fa-sticky-note"></i>
                    <p>Keine aktuellen Einträge</p>
                </div>
            `;
      return;
    }

    const notesHtml = this.entries.map((entry) => this.createMiniNote(entry)).join('');
    contentElement.innerHTML = `
            <div class="mini-notes-container">
                ${notesHtml}
            </div>
        `;

    // Add click handlers
    this.entries.forEach((entry) => {
      const noteElement = document.getElementById(`mini-note-${entry.id}`);
      if (noteElement) {
        noteElement.addEventListener('click', () => this.openEntry(entry.id));
      }
    });
  }

  createMiniNote(entry) {
    const colors = ['yellow', 'blue', 'green', 'red', 'orange', 'pink'];
    const color = entry.color || colors[Math.floor(Math.random() * colors.length)];

    // Format date
    const date = new Date(entry.created_at);
    const formattedDate = date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
    });

    // Handle content that might be an object
    let contentText = entry.content;
    if (typeof contentText === 'object' && contentText !== null) {
      // If it's a Buffer object or similar
      if (contentText.type === 'Buffer' && Array.isArray(contentText.data)) {
        contentText = String.fromCharCode.apply(null, contentText.data);
      } else {
        contentText = JSON.stringify(contentText);
      }
    }

    // Truncate content
    const maxContentLength = 80;
    const truncatedContent =
      contentText.length > maxContentLength ? `${contentText.substring(0, maxContentLength)}...` : contentText;

    return `
            <div class="mini-note ${color}" id="mini-note-${entry.id}">
                <div class="mini-pushpin"></div>
                <div class="mini-note-title">${this.escapeHtml(entry.title)}</div>
                <div class="mini-note-content">${this.escapeHtml(truncatedContent)}</div>
                <div class="mini-note-meta">
                    <span class="mini-note-priority">
                        <span class="priority-dot ${entry.priority}"></span>
                        ${this.getPriorityLabel(entry.priority)}
                    </span>
                    <span>${formattedDate}</span>
                </div>
            </div>
        `;
  }

  getPriorityLabel(priority) {
    const labels = {
      urgent: 'Dringend',
      high: 'Hoch',
      normal: 'Normal',
      low: 'Niedrig',
    };
    return labels[priority] || 'Normal';
  }

  openEntry(entryId) {
    // Navigate to blackboard page with entry ID
    window.location.href = `/pages/blackboard.html?entry=${entryId}`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  refresh() {
    this.loadEntries();
  }
}

// Auto-initialize if container exists
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('blackboard-widget-container')) {
    window.blackboardWidget = new BlackboardWidget('blackboard-widget-container');
  }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BlackboardWidget;
}
