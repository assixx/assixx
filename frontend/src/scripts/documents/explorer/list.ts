/**
 * Documents Explorer - List View Module
 *
 * Windows Explorer Details-style table view with sortable columns
 * Default view mode for the Documents Explorer
 *
 * @module explorer/list
 */

import type { Document } from './types';
import { stateManager } from './state';
import { isAdmin } from '../../../utils/auth-helpers';
import { tokenManager } from '../../../utils/token-manager';

/**
 * List View Manager
 * Renders documents in table-like list view
 */
class ListViewManager {
  private listRowsEl: HTMLElement | null = null;
  private actionMenuEl: HTMLElement | null = null;
  private currentDocumentId: string | null = null;

  /**
   * Initialize list view
   */
  public init(): void {
    this.listRowsEl = document.getElementById('list-rows');

    if (!this.listRowsEl) {
      console.error('List rows container not found');
      return;
    }

    // Setup action menu
    this.actionMenuEl = document.getElementById('document-action-menu');
    if (this.actionMenuEl) {
      this.setupActionMenuListeners();
    }

    // Attach event handlers once (event delegation)
    this.attachRowClickHandlers();

    // Subscribe to state changes
    stateManager.subscribe((state) => {
      if (state.viewMode === 'list') {
        this.render(state.filteredDocuments, state.isLoading, state.error);
      }
    });

    // Initial render
    const state = stateManager.getState();
    if (state.viewMode === 'list') {
      this.render(state.filteredDocuments, state.isLoading, state.error);
    }
  }

  /**
   * Render list view
   */
  private render(documents: Document[], isLoading: boolean, error: string | null): void {
    if (!this.listRowsEl) return;

    // Show/hide state containers
    this.toggleStateContainers(documents.length, isLoading, error);

    // Check for error (error is string | null, so only need null check)
    const hasError = error !== null;
    if (isLoading || hasError) {
      this.listRowsEl.innerHTML = '';
      return;
    }

    // Render document rows
    // Safe: All user data is escaped via escapeHtml() in createDocumentRow()
    // Must use direct innerHTML for table rows (DOMPurify strips <tr>/<td> context)
    const rowsHTML = documents.map((doc) => this.createDocumentRow(doc)).join('');

    // Add placeholder rows to fill table (like Windows Explorer)
    // Always show at least 20 rows so stripes are visible even with no files
    const MIN_ROWS = 20;
    const placeholderCount = Math.max(0, MIN_ROWS - documents.length);
    const placeholderHTML = Array.from({ length: placeholderCount })
      .map(() => this.createPlaceholderRow())
      .join('');

    // eslint-disable-next-line no-unsanitized/property
    this.listRowsEl.innerHTML = rowsHTML + placeholderHTML;
  }

  /**
   * Create placeholder row (empty row with stripes)
   */
  private createPlaceholderRow(): string {
    return `
      <tr class="placeholder-row">
        <td>&nbsp;</td>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
      </tr>
    `;
  }

  /**
   * Create document row HTML (proper table row)
   */
  private createDocumentRow(doc: Document): string {
    const date = this.formatDate(doc.uploadedAt);
    const size = this.formatFileSize(doc.size);
    const isNewDoc = this.isDocumentNew(doc.uploadedAt);
    const showActions = isAdmin();

    // Determine icon color based on file type
    const iconColor = 'text-error-500'; // PDF red

    return `
      <tr
        class="document-row cursor-pointer"
        data-document-id="${doc.id}"
        data-read="${doc.isRead}"
      >
        <!-- Name Column -->
        <td>
          <div class="flex items-center gap-3">
            <svg class="w-6 h-6 ${iconColor} flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"></path>
              <path fill="#fff" d="M14 2v6h6"></path>
            </svg>
            <div class="flex items-center gap-2 min-w-0">
              <span class="${!doc.isRead ? 'font-semibold' : ''}" title="${this.escapeHtml(doc.filename)}">
                ${this.escapeHtml(doc.filename)}
              </span>
              ${isNewDoc ? '<span class="badge badge--success" style="font-size: 11px; padding: 2px 8px;">Neu</span>' : ''}
              ${!doc.isRead ? '<span class="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0" title="Ungelesen"></span>' : ''}
            </div>
          </div>
        </td>

        <!-- Category Column -->
        <td>${this.escapeHtml(doc.category)}</td>

        <!-- Size Column -->
        <td>${size}</td>

        <!-- Date Column -->
        <td>${date}</td>

        <!-- Actions Column -->
        <td>
          ${
            showActions
              ? `
            <button
              class="action-icon action-menu-btn"
              data-document-id="${doc.id}"
              title="Aktionen"
              aria-label="Dokumentaktionen"
            >
              <i class="fas fa-ellipsis-v"></i>
            </button>
          `
              : ''
          }
        </td>
      </tr>
    `;
  }

  /**
   * Attach click handlers to rows using event delegation
   */
  private attachRowClickHandlers(): void {
    if (!this.listRowsEl) {
      console.error('❌ listRowsEl is null, cannot attach handlers');
      return;
    }

    console.log('✅ Attaching event delegation to tbody:', this.listRowsEl);

    // Use event delegation on tbody for better performance
    this.listRowsEl.addEventListener('click', (e) => {
      console.log('🖱️ Click detected on tbody');
      const target = e.target as HTMLElement;

      // Check if action button was clicked
      const actionBtn = target.closest('.action-menu-btn');
      if (actionBtn) {
        console.log('🔘 Action button clicked:', actionBtn);
        e.stopPropagation();
        const documentId = actionBtn.getAttribute('data-document-id');
        if (documentId !== null && documentId !== '') {
          console.log('📄 Opening action menu for document:', documentId);
          this.showActionMenu(documentId, actionBtn as HTMLElement);
        }
        return;
      }

      // Check if row was clicked
      const row = target.closest('.document-row');
      if (row) {
        console.log('📋 Row clicked:', row);
        const documentId = row.getAttribute('data-document-id');
        if (documentId !== null && documentId !== '') {
          console.log('👁️ Opening preview for document:', documentId);
          this.openPreview(documentId);
        }
      }
    });
  }

  /**
   * Open document preview modal
   */
  private openPreview(documentId: string): void {
    console.log('🔍 openPreview called with documentId:', documentId);
    const state = stateManager.getState();
    console.log('📊 Current state:', {
      totalDocs: state.documents.length,
      filteredDocs: state.filteredDocuments.length,
      viewMode: state.viewMode,
    });

    // Use filteredDocuments to match what's displayed in the table
    // Convert both to strings to handle type mismatch (HTML attributes are always strings)
    const doc = state.filteredDocuments.find((d) => String(d.id) === documentId);
    console.log('📄 Found document:', doc);

    if (doc) {
      console.log('✅ Setting selected document and marking as read');
      stateManager.setSelectedDocument(doc);
      stateManager.markAsRead(documentId);
    } else {
      console.error('❌ Document not found in filteredDocuments!');
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
      // Check for error (error is string | null)
      const hasError = error !== null;
      emptyState.classList.toggle('hidden', isLoading || hasError || docCount > 0);
    }

    if (errorState) {
      // Check for error (error is string | null)
      const hasError = error !== null;
      errorState.classList.toggle('hidden', !hasError);
      if (hasError) {
        const errorMessage = document.getElementById('error-message');
        if (errorMessage) {
          errorMessage.textContent = error;
        }
      }
    }
  }

  /**
   * Format date for display
   */
  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
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

    // Safe: i is bounded by sizes array length
    // eslint-disable-next-line security/detect-object-injection
    const sizeLabel = sizes[i] ?? 'Bytes';
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizeLabel}`;
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
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Singleton instance
export const listViewManager = new ListViewManager();

// Export type for testing/mocking
export type { ListViewManager };
