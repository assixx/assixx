/**
 * Blackboard Widget Component
 * Displays latest blackboard entries in a compact format for dashboard
 */

class BlackboardWidget {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.entries = [];
    this.loading = false;
    // Check sidebar state from localStorage immediately
    this.sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
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
          // Update our state and reload entries
          const newCollapsedState = sidebar.classList.contains('collapsed');
          if (newCollapsedState !== this.sidebarCollapsed) {
            this.sidebarCollapsed = newCollapsedState;
            this.loadEntries();
          }
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
                    <a href="/blackboard" class="blackboard-widget-link">
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
      // Use pre-determined sidebar state
      const limit = this.sidebarCollapsed ? 5 : 3;

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
    const widgetElement = this.container.querySelector('.blackboard-widget');

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

    // Initialize lazy loading for images
    this.initLazyLoading();

    // Add click handlers
    this.entries.forEach((entry) => {
      const noteElement = document.getElementById(`mini-note-${entry.id}`);
      if (noteElement) {
        noteElement.addEventListener('click', () => this.openEntry(entry.id));
      }
    });

    // Mark widget as loaded to enable transitions
    if (widgetElement) {
      setTimeout(() => {
        widgetElement.classList.add('loaded');
      }, 50);
    }
  }

  initLazyLoading() {
    // Use Intersection Observer for lazy loading images
    const lazyImages = this.container.querySelectorAll('img[data-src]');

    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            observer.unobserve(img);
          }
        });
      });

      lazyImages.forEach((img) => imageObserver.observe(img));
    } else {
      // Fallback for browsers without IntersectionObserver
      lazyImages.forEach((img) => {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      });
    }
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

    // Check if this is a direct attachment entry
    const isDirectAttachment = contentText && contentText.startsWith('[Attachment:');
    let contentHtml = '';

    if (isDirectAttachment && entry.attachments && entry.attachments.length > 0) {
      // Handle direct attachment display
      const attachment = entry.attachments[0];
      const isImage = attachment.mime_type.startsWith('image/');
      const isPDF = attachment.mime_type === 'application/pdf';

      if (isImage) {
        contentHtml = `
          <div class="mini-note-attachment">
            <img data-src="/api/blackboard/attachments/${attachment.id}/preview" 
                 alt="${this.escapeHtml(attachment.original_name)}" 
                 style="width: 100%; height: auto; max-height: 120px; object-fit: cover; border-radius: 4px;"
                 loading="lazy"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div style="display: none; flex-direction: column; align-items: center; justify-content: center; height: 80px; color: #666;">
              <i class="fas fa-image" style="font-size: 24px; margin-bottom: 5px;"></i>
              <span style="font-size: 10px;">Bild</span>
            </div>
          </div>
        `;
      } else if (isPDF) {
        contentHtml = `
          <div class="mini-note-attachment" style="position: relative; height: 120px; background: #f5f5f5; border-radius: 4px; overflow: hidden;">
            <object data="/api/blackboard/attachments/${attachment.id}/preview" 
                    type="application/pdf" 
                    style="width: 100%; height: 100%; pointer-events: none;">
              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #666;">
                <i class="fas fa-file-pdf" style="font-size: 32px; color: #dc3545; margin-bottom: 5px;"></i>
                <div style="font-size: 10px;">PDF-Dokument</div>
              </div>
            </object>
          </div>
        `;
      }
    } else {
      // Regular text content
      const maxContentLength = 80;
      const truncatedContent =
        contentText.length > maxContentLength ? `${contentText.substring(0, maxContentLength)}...` : contentText;
      contentHtml = `<div class="mini-note-content">${this.escapeHtml(truncatedContent)}</div>`;
    }

    // Add attachment indicator if there are attachments but not a direct attachment
    let attachmentIndicator = '';
    if (!isDirectAttachment && entry.attachment_count && entry.attachment_count > 0) {
      attachmentIndicator = `
        <div class="mini-note-attachments">
          <i class="fas fa-paperclip"></i>
          <span>${entry.attachment_count}</span>
        </div>
      `;
    }

    return `
            <div class="mini-note ${color} ${isDirectAttachment ? 'has-attachment' : ''}" id="mini-note-${entry.id}">
                <div class="mini-pushpin"></div>
                <div class="mini-note-title">${this.escapeHtml(entry.title)}</div>
                ${contentHtml}
                ${attachmentIndicator}
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
    window.location.href = `/blackboard?entry=${entryId}`;
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
