/**
 * Blackboard Widget Component
 * Displays latest blackboard entries in a compact format for dashboard
 * Uses sticky-note-component.ts for rendering (Single Source of Truth)
 */

import type { BlackboardEntry } from './types';
import { createStickyNote } from './sticky-note-component';

/**
 * Blackboard Widget - Uses API v2 types only (camelCase)
 * No backward compatibility - backend uses dbToApi field mapping
 */
class BlackboardWidget {
  private container: HTMLElement | null;
  private entries: BlackboardEntry[] = [];
  private sidebarCollapsed: boolean;

  constructor(containerId: string) {
    this.container = document.querySelector(`#${containerId}`);
    this.entries = [];
    // Check sidebar state from localStorage immediately
    this.sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    void this.init();
  }

  async init(): Promise<void> {
    this.render();
    await this.loadEntries();

    // Listen for sidebar toggle events
    this.setupSidebarListener();
  }

  private setupSidebarListener(): void {
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
            void this.loadEntries();
          }
        }
      });
    });

    observer.observe(sidebar, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  private render(): void {
    if (this.container === null) return;

    this.container.innerHTML = `
            <div class="card card--blackboard">
                <div class="card__header">
                    <h3 class="card__title">
                        <i class="fas fa-thumbtack"></i>
                        Schwarzes Brett
                    </h3>
                    <a href="/blackboard" class="card--blackboard__link">
                        Alle anzeigen <i class="fas fa-arrow-right"></i>
                    </a>
                </div>
                <div id="blackboard-widget-content">
                    <div class="card--blackboard__loading">
                        <div class="spinner-ring spinner-ring--md"></div>
                        <p>Lade Einträge...</p>
                    </div>
                </div>
            </div>
        `;
  }

  private async loadEntries(): Promise<void> {
    const contentElement = document.querySelector('#blackboard-widget-content');

    try {
      // Check if apiClient is available
      if (!window.apiClient) {
        console.error('API Client not available');
        throw new Error('API Client not initialized');
      }

      // Use pre-determined sidebar state
      const limit = this.sidebarCollapsed ? 5 : 4;

      // Use API v2 client
      this.entries = await window.apiClient.get(`/blackboard/dashboard?limit=${limit}`);
      this.renderEntries();
    } catch (error) {
      console.error('Error loading blackboard entries:', error);
      if (contentElement !== null) {
        contentElement.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state__icon"><i class="fas fa-exclamation-circle"></i></div>
                    <h3 class="empty-state__title">Fehler beim Laden</h3>
                    <p class="empty-state__description">Die Einträge konnten nicht geladen werden.</p>
                </div>
            `;
      }
    }
  }

  private renderEntries(): void {
    const contentElement = document.querySelector('#blackboard-widget-content');
    if (contentElement === null || this.container === null) return;

    const widgetElement = this.container.querySelector('.card--blackboard');

    if (this.entries.length === 0) {
      contentElement.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state__icon"><i class="fas fa-sticky-note"></i></div>
                    <h3 class="empty-state__title">Keine aktuellen Einträge</h3>
                    <p class="empty-state__description">Es gibt derzeit keine Neuigkeiten am Schwarzen Brett.</p>
                </div>
            `;
      return;
    }

    // Create container for sticky notes
    const containerDiv = document.createElement('div');
    containerDiv.className = 'sticky-notes-container';

    // Use shared sticky-note component for each entry
    // size: 'large' + maxContentLength default = same appearance as blackboard page
    this.entries.forEach((entry) => {
      const stickyNote = createStickyNote(entry, {
        size: 'large',
        showActions: false,
        showAttachmentPreview: true,
        onClick: (e) => {
          this.openEntry(e.id, e.uuid);
        },
      });
      containerDiv.append(stickyNote);
    });

    // Clear and append content
    contentElement.textContent = '';
    contentElement.append(containerDiv);

    // Initialize lazy loading for images
    this.initLazyLoading();

    // Mark widget as loaded to enable transitions
    if (widgetElement) {
      setTimeout(() => {
        widgetElement.classList.add('loaded');
      }, 50);
    }
  }

  private initLazyLoading(): void {
    // Use Intersection Observer for lazy loading images
    const lazyImages = this.container?.querySelectorAll('img[data-src]');
    if (!lazyImages) return;

    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const dataSrc = img.dataset['src'];
            if (dataSrc !== undefined && dataSrc !== '') {
              img.src = dataSrc;
              delete img.dataset['src'];
            }
            observer.unobserve(img);
          }
        });
      });

      lazyImages.forEach((img) => {
        imageObserver.observe(img);
      });
    } else {
      // Fallback for browsers without IntersectionObserver
      lazyImages.forEach((img) => {
        const imgElement = img as HTMLImageElement;
        const dataSrc = imgElement.dataset['src'];
        if (dataSrc !== undefined && dataSrc !== '') {
          imgElement.src = dataSrc;
          delete imgElement.dataset['src'];
        }
      });
    }
  }

  private openEntry(entryId: number, entryUuid?: string): void {
    // Navigate to blackboard detail page with UUID
    const identifier = entryUuid ?? entryId;
    window.location.href = `/blackboard-detail?uuid=${encodeURIComponent(identifier)}`;
  }

  public refresh(): void {
    void this.loadEntries();
  }
}

/**
 * Auto-initialize function that can be called anytime
 */
function initializeBlackboardWidget(): void {
  if (document.querySelector('#blackboard-widget-container') && !window.blackboardWidget) {
    // Wait for apiClient to be available (max 5 seconds)
    let attempts = 0;
    const maxAttempts = 50;
    const checkApiClient = setInterval(() => {
      attempts++;
      if (window.apiClient) {
        clearInterval(checkApiClient);
        console.log('BlackboardWidget: Initializing with API Client');
        window.blackboardWidget = new BlackboardWidget('blackboard-widget-container');
      } else if (attempts >= maxAttempts) {
        clearInterval(checkApiClient);
        console.error('BlackboardWidget: API Client not available after 5 seconds');
      }
    }, 100);
  }
}

// Try to initialize on DOMContentLoaded (for direct script includes)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeBlackboardWidget);
} else {
  // DOM is already loaded (for dynamically loaded scripts)
  initializeBlackboardWidget();
}

// Export the initialization function for manual calls
window.initializeBlackboardWidget = initializeBlackboardWidget;

// Export class for use in other modules
export { BlackboardWidget, initializeBlackboardWidget };
