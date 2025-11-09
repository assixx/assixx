/**
 * Documents Explorer - Grid View Module
 *
 * Google Drive-style card grid view
 * Alternative view mode to list view
 *
 * @module explorer/grid
 */

import type { Document } from './types';
import { stateManager } from './state';
import { isAdmin } from '../../../utils/auth-helpers';
import { setSafeHTML } from '../../../utils/dom-utils';
import { tokenManager } from '../../../utils/token-manager';

/**
 * Grid View Manager
 * Renders documents in card-based grid layout
 */
class GridViewManager {
  private gridCardsEl: HTMLElement | null = null;
  private actionMenuEl: HTMLElement | null = null;
  private currentDocumentId: string | null = null;

  /**
   * Initialize grid view
   */
  public init(): void {
    this.gridCardsEl = document.getElementById('grid-cards');

    if (!this.gridCardsEl) {
      console.error('Grid cards container not found');
      return;
    }

    // Setup action menu
    this.actionMenuEl = document.getElementById('document-action-menu');
    if (this.actionMenuEl) {
      this.setupActionMenuListeners();
    }

    // Subscribe to state changes
    stateManager.subscribe((state) => {
      if (state.viewMode === 'grid') {
        this.render(state.filteredDocuments, state.isLoading, state.error);
      }
    });

    // Initial render (if grid view is active)
    const state = stateManager.getState();
    if (state.viewMode === 'grid') {
      this.render(state.filteredDocuments, state.isLoading, state.error);
    }
  }

  /**
   * Render grid view
   */
  private render(documents: Document[], isLoading: boolean, error: string | null): void {
    if (!this.gridCardsEl) return;

    // Show/hide state containers
    this.toggleStateContainers(documents.length, isLoading, error);

    if (isLoading || error !== null || documents.length === 0) {
      this.gridCardsEl.innerHTML = '';
      return;
    }

    // Render document cards
    const cardsHTML = documents.map((doc) => this.createDocumentCard(doc)).join('');
    setSafeHTML(this.gridCardsEl, cardsHTML);

    // Attach click handlers
    this.attachCardClickHandlers();
  }

  /**
   * Create document card HTML
   */
  private createDocumentCard(doc: Document): string {
    const date = this.formatRelativeDate(doc.uploadedAt);
    const size = this.formatFileSize(doc.size);
    const isNewDoc = this.isDocumentNew(doc.uploadedAt);
    const showActions = isAdmin();

    return `
      <div
        class="document-card bg-surface-2 border border-border-subtle rounded-lg p-4 hover:shadow-lg cursor-pointer transition-all duration-200"
        data-document-id="${doc.id}"
        data-read="${doc.isRead}"
      >
        <!-- Card Header: Icon & Badge -->
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <svg class="w-10 h-10 text-error-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"></path>
              <path fill="#fff" d="M14 2v6h6"></path>
            </svg>
            <div class="flex flex-col gap-1">
              ${isNewDoc ? '<span class="px-2 py-0.5 bg-success-100 text-success-700 text-xs font-medium rounded">Neu</span>' : ''}
              ${!doc.isRead ? '<span class="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded">Ungelesen</span>' : ''}
            </div>
          </div>
          ${
            showActions
              ? `
            <button
              class="action-menu-btn text-content-tertiary hover:text-content-primary transition-colors"
              data-document-id="${doc.id}"
              title="Aktionen"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path>
              </svg>
            </button>
          `
              : ''
          }
        </div>

        <!-- Card Body: Document Info -->
        <div class="mb-3">
          <h3 class="text-sm font-medium text-content-primary truncate mb-1 ${!doc.isRead ? 'font-semibold' : ''}" title="${this.escapeHtml(doc.filename)}">
            ${this.truncateFilename(doc.filename, 40)}
          </h3>
          <p class="text-xs text-content-secondary">${this.escapeHtml(doc.category)}</p>
        </div>

        <!-- Card Footer: Metadata -->
        <div class="flex items-center justify-between text-xs text-content-tertiary">
          <span>${size}</span>
          <span>${date}</span>
        </div>
      </div>
    `;
  }

  /**
   * Attach click handlers to cards
   */
  private attachCardClickHandlers(): void {
    if (!this.gridCardsEl) return;

    const cards = this.gridCardsEl.querySelectorAll('.document-card');
    cards.forEach((card) => {
      // Click on card opens preview
      card.addEventListener('click', (e) => {
        // Don't trigger if clicking action button
        if ((e.target as HTMLElement).closest('.action-menu-btn')) {
          return;
        }

        const documentId = card.getAttribute('data-document-id');
        if (documentId !== null && documentId !== '') {
          this.openPreview(documentId);
        }
      });
    });

    // Attach action menu handlers
    const actionBtns = this.gridCardsEl.querySelectorAll('.action-menu-btn');
    actionBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const documentId = btn.getAttribute('data-document-id');
        if (documentId !== null && documentId !== '') {
          this.showActionMenu(documentId, btn as HTMLElement);
        }
      });
    });
  }

  /**
   * Open document preview modal
   */
  private openPreview(documentId: string): void {
    const state = stateManager.getState();
    // Use filteredDocuments to match what's displayed in the grid
    // Convert both to strings to handle type mismatch (HTML attributes are always strings)
    const doc = state.filteredDocuments.find((d) => String(d.id) === documentId);

    if (doc) {
      stateManager.setSelectedDocument(doc);
      stateManager.markAsRead(documentId);
    }
  }

  /**
   * Show action menu for document (Windows Explorer style context menu)
   */
  private showActionMenu(documentId: string, buttonEl: HTMLElement): void {
    if (!this.actionMenuEl) return;

    // Store current document ID for action handlers
    this.currentDocumentId = documentId;

    // Position menu next to button (right-aligned to prevent overflow)
    const buttonRect = buttonEl.getBoundingClientRect();
    this.actionMenuEl.style.top = `${buttonRect.bottom + 5}px`;
    // Right-align menu with button to prevent going off-screen
    this.actionMenuEl.style.left = 'auto';
    this.actionMenuEl.style.right = `${window.innerWidth - buttonRect.right}px`;

    // Show menu
    this.actionMenuEl.style.display = 'block';
    // Add active class after display for smooth transition
    setTimeout(() => {
      if (this.actionMenuEl) {
        this.actionMenuEl.classList.add('active');
      }
    }, 10);
  }

  /**
   * Hide action menu
   */
  private hideActionMenu(): void {
    if (!this.actionMenuEl) return;

    this.actionMenuEl.classList.remove('active');
    setTimeout(() => {
      if (this.actionMenuEl) {
        this.actionMenuEl.style.display = 'none';
      }
    }, 200); // Wait for transition
    this.currentDocumentId = null;
  }

  /**
   * Setup action menu event listeners
   */
  private setupActionMenuListeners(): void {
    if (!this.actionMenuEl) return;

    // Click on menu options
    this.actionMenuEl.addEventListener('click', (e) => {
      const option = (e.target as HTMLElement).closest('.dropdown__option');
      if (!option) return;

      const action = option.getAttribute('data-action');
      if (!action || !this.currentDocumentId) return;

      this.handleActionMenuClick(action, this.currentDocumentId);
      this.hideActionMenu();
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (
        this.actionMenuEl &&
        this.actionMenuEl.classList.contains('active') &&
        !this.actionMenuEl.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest('.action-menu-btn')
      ) {
        this.hideActionMenu();
      }
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.actionMenuEl?.classList.contains('active')) {
        this.hideActionMenu();
      }
    });
  }

  /**
   * Handle action menu clicks
   */
  private handleActionMenuClick(action: string, documentId: string): void {
    const state = stateManager.getState();
    const doc = state.filteredDocuments.find((d) => String(d.id) === documentId);
    if (!doc) return;

    switch (action) {
      case 'download':
        this.downloadDocument(doc);
        break;
      case 'delete':
        // TODO: Implement delete functionality
        console.log('Delete document:', documentId);
        alert('Löschen-Funktion folgt noch');
        break;
      case 'move':
        // TODO: Implement move functionality
        console.log('Move document:', documentId);
        alert('Verschieben-Funktion folgt noch');
        break;
      default:
        console.warn('Unknown action:', action);
    }
  }

  /**
   * Download document
   */
  private downloadDocument(doc: Document): void {
    // Append access token as query parameter (window.open can't send headers)
    const token = tokenManager.getAccessToken();
    const downloadUrl = token !== null ? `${doc.downloadUrl}?token=${encodeURIComponent(token)}` : doc.downloadUrl;
    window.open(downloadUrl, '_blank');
  }

  /**
   * Toggle state containers (loading, empty, error)
   */
  private toggleStateContainers(docCount: number, isLoading: boolean, error: string | null): void {
    const loadingState = document.getElementById('loading-state');
    const emptyState = document.getElementById('empty-state');
    const errorState = document.getElementById('error-state');

    if (loadingState) {
      loadingState.classList.toggle('hidden', !isLoading);
    }

    if (emptyState) {
      emptyState.classList.toggle('hidden', isLoading || error !== null || docCount > 0);
    }

    if (errorState) {
      errorState.classList.toggle('hidden', error === null);
      if (error !== null) {
        const errorMessage = document.getElementById('error-message');
        if (errorMessage) {
          errorMessage.textContent = error;
        }
      }
    }
  }

  /**
   * Format date as relative time (e.g., "vor 2 Tagen")
   */
  private formatRelativeDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Heute';
    } else if (diffDays === 1) {
      return 'Gestern';
    } else if (diffDays < 7) {
      return `vor ${diffDays} Tagen`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `vor ${weeks} ${weeks === 1 ? 'Woche' : 'Wochen'}`;
    } else {
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    // Handle invalid/missing values defensively
    if (Number.isNaN(bytes) || bytes < 0) {
      return 'Unbekannt';
    }

    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = Math.round((bytes / Math.pow(k, i)) * 100) / 100;
    // Safe: i is bounded by sizes array length
    // eslint-disable-next-line security/detect-object-injection
    const unit = sizes[i] ?? 'Bytes';

    return `${size} ${unit}`;
  }

  /**
   * Check if document is new (uploaded in last 7 days)
   */
  private isDocumentNew(uploadedAt: string): boolean {
    const uploadDate = new Date(uploadedAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return uploadDate >= sevenDaysAgo;
  }

  /**
   * Truncate filename to max length
   */
  private truncateFilename(filename: string, maxLength: number): string {
    if (filename.length <= maxLength) {
      return this.escapeHtml(filename);
    }

    const extension = filename.slice(filename.lastIndexOf('.'));
    const nameWithoutExt = filename.slice(0, filename.lastIndexOf('.'));
    const truncated = nameWithoutExt.slice(0, maxLength - extension.length - 3) + '...';

    return this.escapeHtml(truncated + extension);
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Singleton instance
export const gridViewManager = new GridViewManager();

// Export type for testing/mocking
export type { GridViewManager };
