/**
 * Documents Explorer - Toolbar Module
 *
 * Manages search, filter, sort, and view toggle
 * Subscribes to state changes and user interactions
 *
 * @module explorer/toolbar
 */

import type { SortOption, ViewMode } from './types';
import { stateManager } from './state';
import { getUserRole, isAdmin } from '../../../utils/auth-helpers';
import { setHTML } from '../../../utils/dom-utils';

/**
 * Toolbar Manager
 * Handles all toolbar interactions and state updates
 */
class ToolbarManager {
  private searchInput: HTMLInputElement | null = null;
  private uploadBtn: HTMLButtonElement | null = null;
  private filterBtn: HTMLButtonElement | null = null;
  private sortBtn: HTMLButtonElement | null = null;
  private sortLabel: HTMLSpanElement | null = null;
  private sortMenu: HTMLElement | null = null;
  private viewListBtn: HTMLButtonElement | null = null;
  private viewGridBtn: HTMLButtonElement | null = null;
  private quickStatsEl: HTMLElement | null = null;

  private searchDebounceTimer: number | null = null;

  /**
   * Initialize toolbar
   */
  public init(): void {
    // Get DOM elements - use querySelector for proper type inference
    this.searchInput = document.querySelector<HTMLInputElement>('#search-input');
    this.uploadBtn = document.querySelector<HTMLButtonElement>('#upload-btn');
    this.filterBtn = document.querySelector<HTMLButtonElement>('#filter-btn');
    this.sortBtn = document.querySelector<HTMLButtonElement>('#sort-btn');
    this.sortLabel = document.querySelector<HTMLSpanElement>('#sort-label');
    this.sortMenu = document.getElementById('sort-menu');
    this.viewListBtn = document.querySelector<HTMLButtonElement>('#view-list-btn');
    this.viewGridBtn = document.querySelector<HTMLButtonElement>('#view-grid-btn');
    this.quickStatsEl = document.getElementById('quick-stats');

    // Check for required elements
    if (!this.searchInput) {
      console.error('Toolbar elements not found');
      return;
    }

    // Setup role-based UI
    this.setupRoleBasedUI();

    // Attach event listeners
    this.attachSearchHandler();
    this.attachUploadHandler();
    this.attachFilterHandler();
    this.attachSortHandlers();
    this.attachViewToggleHandlers();

    // Subscribe to state changes
    stateManager.subscribe((state) => {
      this.updateViewToggle(state.viewMode);
      this.renderQuickStats();
    });

    // Initial render
    this.renderSortMenu();
    this.renderQuickStats();
  }

  /**
   * Setup role-based UI (show upload button for admin/root)
   */
  private setupRoleBasedUI(): void {
    const role = getUserRole();
    // getUserRole returns UserRole | null, which is compatible
    stateManager.setUserRole(role);

    if (this.uploadBtn) {
      if (isAdmin()) {
        this.uploadBtn.classList.remove('hidden');
      } else {
        this.uploadBtn.classList.add('hidden');
      }
    }
  }

  /**
   * Attach search input handler with debouncing
   */
  private attachSearchHandler(): void {
    if (!this.searchInput) return;

    this.searchInput.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value;

      // Clear previous timer
      if (this.searchDebounceTimer !== null) {
        window.clearTimeout(this.searchDebounceTimer);
      }

      // Debounce search (300ms)
      this.searchDebounceTimer = window.setTimeout(() => {
        stateManager.setSearchQuery(query);
      }, 300);
    });

    // Clear search on Escape key
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.searchInput) {
        this.searchInput.value = '';
        stateManager.setSearchQuery('');
      }
    });
  }

  /**
   * Attach upload button handler
   */
  private attachUploadHandler(): void {
    if (!this.uploadBtn) return;

    this.uploadBtn.addEventListener('click', () => {
      // Will be handled by upload-modal.ts
      const uploadModal = document.getElementById('upload-modal');
      if (uploadModal) {
        uploadModal.classList.remove('hidden');
      }
    });
  }

  /**
   * Attach filter button handler
   */
  private attachFilterHandler(): void {
    if (!this.filterBtn) return;

    this.filterBtn.addEventListener('click', () => {
      // TODO: Implement filter panel/modal
      console.log('Filter clicked - to be implemented');
    });
  }

  /**
   * Attach sort button and menu handlers
   */
  private attachSortHandlers(): void {
    if (!this.sortBtn || !this.sortMenu) return;

    // Toggle sort menu - using Design System pattern
    this.sortBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.sortMenu?.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (this.sortMenu && !this.sortMenu.contains(e.target as Node)) {
        this.sortMenu.classList.remove('active');
      }
    });

    // Attach option click handlers
    this.sortMenu.addEventListener('click', (e) => {
      const option = (e.target as HTMLElement).closest('[data-sort]');
      if (option) {
        const sortValue = option.getAttribute('data-sort');
        // getAttribute returns string | null, cast only after null check
        if (sortValue !== null && sortValue !== '') {
          stateManager.setSortOption(sortValue as SortOption);
          this.updateSortLabel(sortValue as SortOption);
          this.sortMenu?.classList.remove('active');
        }
      }
    });
  }

  /**
   * Attach view toggle handlers
   */
  private attachViewToggleHandlers(): void {
    if (!this.viewListBtn || !this.viewGridBtn) return;

    this.viewListBtn.addEventListener('click', () => {
      stateManager.setViewMode('list');
    });

    this.viewGridBtn.addEventListener('click', () => {
      stateManager.setViewMode('grid');
    });
  }

  /**
   * Render sort menu
   */
  private renderSortMenu(): void {
    if (!this.sortMenu) return;

    const options: { value: SortOption; label: string }[] = [
      { value: 'newest', label: 'Neueste zuerst' },
      { value: 'oldest', label: 'Älteste zuerst' },
      { value: 'name', label: 'Nach Name' },
      { value: 'size', label: 'Nach Größe' },
    ];

    const sortMenuContent = options
      .map(
        (opt) => `
          <div
            class="dropdown__option"
            data-sort="${opt.value}"
          >
            ${opt.label}
          </div>
        `,
      )
      .join('');

    // Use safe HTML setter
    setHTML(this.sortMenu, sortMenuContent);
  }

  /**
   * Update sort label
   */
  private updateSortLabel(sortOption: SortOption): void {
    if (!this.sortLabel) return;

    const labels: Record<SortOption, string> = {
      newest: 'Sortieren: Neueste',
      oldest: 'Sortieren: Älteste',
      name: 'Sortieren: Name',
      size: 'Sortieren: Größe',
    };

    // Safe: sortOption is typed as SortOption union
    // eslint-disable-next-line security/detect-object-injection
    this.sortLabel.textContent = labels[sortOption];
  }

  /**
   * Update view toggle buttons
   */
  private updateViewToggle(viewMode: ViewMode): void {
    if (!this.viewListBtn || !this.viewGridBtn) return;

    // Update button states using action-icon pattern
    if (viewMode === 'list') {
      this.viewListBtn.classList.add('action-icon--active');
      this.viewGridBtn.classList.remove('action-icon--active');
    } else {
      this.viewListBtn.classList.remove('action-icon--active');
      this.viewGridBtn.classList.add('action-icon--active');
    }

    // Toggle view containers
    const listView = document.getElementById('list-view');
    const gridView = document.getElementById('grid-view');

    if (listView && gridView) {
      if (viewMode === 'list') {
        listView.classList.remove('hidden');
        gridView.classList.add('hidden');
      } else {
        listView.classList.add('hidden');
        gridView.classList.remove('hidden');
      }
    }
  }

  /**
   * Render quick stats in header
   */
  private renderQuickStats(): void {
    if (!this.quickStatsEl) return;

    const state = stateManager.getState();

    const quickStatsContent = `
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        <span class="text-sm text-content-secondary">${state.filteredDocuments.length} Dokumente</span>
      </div>
      ${
        state.stats.unread > 0
          ? `
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-warning-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
          </svg>
          <span class="text-sm text-content-secondary">${state.stats.unread} Ungelesen</span>
        </div>
      `
          : ''
      }
      ${
        state.stats.thisWeek > 0
          ? `
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span class="text-sm text-content-secondary">${state.stats.thisWeek} Diese Woche</span>
        </div>
      `
          : ''
      }
    `;

    // Use safe HTML setter
    setHTML(this.quickStatsEl, quickStatsContent);
  }
}

// Singleton instance
export const toolbarManager = new ToolbarManager();

// Export type for testing/mocking
export type { ToolbarManager };
