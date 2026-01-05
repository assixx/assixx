/* eslint-disable max-lines */
/**
 * Documents Explorer - List View Module
 *
 * Windows Explorer Details-style table view with sortable columns
 * Default view mode for the Documents Explorer
 * UPDATED 2025-12-04: Added chat folder view support
 *
 * @module explorer/list
 */

import type { Document, ChatFolder, CurrentUser } from './types';
import { stateManager } from './state';
import { sidebarManager } from './sidebar';
import { isAdmin } from '../../../utils/auth-helpers';
import { tokenManager } from '../../../utils/token-manager';
import { permissionsManager } from './permissions';
import { documentAPI } from './api';

/**
 * Data attribute name for document ID (prevents sonarjs/no-duplicate-string)
 */
const DATA_DOCUMENT_ID = 'data-document-id';

/**
 * DB category value labels (for display in table)
 * Matches SvelteKit DB_CATEGORY_LABELS
 */
const DB_CATEGORY_LABELS: Record<string, string> = {
  general: 'Allgemein',
  work: 'Arbeit',
  personal: 'Persönlich',
  salary: 'Gehalt',
  blackboard: 'Schwarzes Brett',
  chat: 'Chat',
};

/**
 * List View Manager
 * Renders documents in table-like list view
 */
class ListViewManager {
  private listRowsEl: HTMLElement | null = null;
  private actionMenuEl: HTMLElement | null = null;
  private currentDocumentId: string | null = null;
  private currentUser: CurrentUser | null = null;

  /**
   * Initialize list view
   */
  public init(): void {
    this.listRowsEl = document.getElementById('list-rows');

    if (!this.listRowsEl) {
      console.error('List rows container not found');
      return;
    }

    // Setup action menu (legacy, still used for context menu)
    this.actionMenuEl = document.getElementById('document-action-menu');
    if (this.actionMenuEl) {
      this.setupActionMenuListeners();
    }

    // Attach event handlers once (event delegation)
    this.attachRowClickHandlers();

    // Load current user for permission checks (async, non-blocking)
    void this.loadCurrentUser();

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
   * Load current user for permission checks
   * NEW 2025-12-23: Like SvelteKit, needed for per-document permissions
   */
  private async loadCurrentUser(): Promise<void> {
    try {
      this.currentUser = await documentAPI.getCurrentUser();
      // Re-render to update action buttons with correct permissions
      const state = stateManager.getState();
      if (state.viewMode === 'list') {
        this.render(state.filteredDocuments, state.isLoading, state.error);
      }
    } catch (error) {
      console.error('[ListView] Failed to load current user:', error);
    }
  }

  /**
   * Render list view
   * UPDATED 2025-12-04: Added chat folder view support
   */
  private render(documents: Document[], isLoading: boolean, error: string | null): void {
    if (!this.listRowsEl) return;

    const state = stateManager.getState();
    const isChatCategory = state.currentCategory === 'chat';
    const selectedConversationId = sidebarManager.getSelectedConversationId();

    // Debug logging only in development - reduced verbosity
    if (documents.length > 0) {
      console.log('[ListView] Rendering', documents.length, 'documents, category:', state.currentCategory);
    }

    // Check for error (error is string | null, so only need null check)
    const hasError = error !== null;

    // Special handling for chat category: show folders when no conversation selected
    if (isChatCategory && selectedConversationId === null) {
      this.renderChatFolders(isLoading);
      return;
    }

    // Show/hide state containers
    this.toggleStateContainers(documents.length, isLoading, error);

    if (isLoading || hasError) {
      this.listRowsEl.innerHTML = '';
      return;
    }

    // Add "back to folders" row if viewing chat attachments
    let backRowHTML = '';
    if (isChatCategory && selectedConversationId !== null) {
      backRowHTML = this.createBackToFoldersRow();
    }

    // Render document rows
    // Safe: All user data is escaped via escapeHtml() in createDocumentRow()
    // Must use direct innerHTML for table rows (DOMPurify strips <tr>/<td> context)
    const rowsHTML = backRowHTML + documents.map((doc) => this.createDocumentRow(doc)).join('');

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
   * Render chat folders view
   * NEW 2025-12-04: Shows conversation folders in main list
   */
  private renderChatFolders(isLoading: boolean): void {
    if (!this.listRowsEl) return;

    const chatFolders = sidebarManager.getChatFolders();
    const foldersLoaded = sidebarManager.isChatFoldersLoaded();

    // Show/hide state containers
    this.toggleStateContainers(chatFolders.length, isLoading || !foldersLoaded, null);

    if (isLoading || !foldersLoaded) {
      this.listRowsEl.innerHTML = '';
      return;
    }

    // Render folder rows
    const rowsHTML = chatFolders.map((folder) => this.createChatFolderRow(folder)).join('');

    // Add placeholder rows
    const MIN_ROWS = 20;
    const placeholderCount = Math.max(0, MIN_ROWS - chatFolders.length);
    const placeholderHTML = Array.from({ length: placeholderCount })
      .map(() => this.createPlaceholderRow())
      .join('');

    // eslint-disable-next-line no-unsanitized/property
    this.listRowsEl.innerHTML = rowsHTML + placeholderHTML;
  }

  /**
   * Create chat folder row HTML (folder icon style)
   * NEW 2025-12-04
   * UPDATED 2025-12-23: 6 columns to match Tags column addition
   */
  private createChatFolderRow(folder: ChatFolder): string {
    const displayName = folder.isGroup ? (folder.groupName ?? 'Gruppenname') : folder.participantName;
    const icon = folder.isGroup
      ? '<i class="fas fa-users" style="font-size: 16px; color: var(--color-content-secondary); margin-left: 4px;"></i>'
      : '<i class="fas fa-user" style="font-size: 16px; color: var(--color-content-secondary); margin-left: 4px;"></i>';

    return `
      <tr
        class="chat-folder-row cursor-pointer hover:bg-surface-2"
        data-conversation-id="${folder.conversationId}"
      >
        <!-- Name Column -->
        <td>
          <div class="flex items-center gap-3">
            <svg class="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
            </svg>
            <div class="flex items-center gap-2 min-w-0">
              <span class="font-medium" title="${this.escapeHtml(displayName)}">
                ${this.escapeHtml(displayName)}
              </span>
              ${icon}
            </div>
          </div>
        </td>

        <!-- Type Column -->
        <td>Chat-Konversation</td>

        <!-- Tags Column -->
        <td>-</td>

        <!-- Size Column (attachment count) -->
        <td>${folder.attachmentCount} Dateien</td>

        <!-- Date Column -->
        <td>-</td>

        <!-- Actions Column -->
        <td></td>
      </tr>
    `;
  }

  /**
   * Create "back to folders" row for navigation
   * NEW 2025-12-04: Allows navigation back from attachments to folder view
   * UPDATED 2025-12-23: 6 columns to match Tags column addition
   */
  private createBackToFoldersRow(): string {
    return `
      <tr class="back-to-folders-row cursor-pointer hover:bg-surface-2" title="Zurück zur Ordner-Übersicht">
        <!-- Name Column -->
        <td>
          <div class="flex items-center gap-3">
            <i class="fas fa-level-up-alt" style="font-size: 24px; color: var(--color-content-secondary);"></i>
            <span class="font-medium text-content-secondary">..</span>
          </div>
        </td>

        <!-- Type Column -->
        <td class="text-content-tertiary">Übergeordneter Ordner</td>

        <!-- Tags Column -->
        <td></td>

        <!-- Size Column -->
        <td></td>

        <!-- Date Column -->
        <td></td>

        <!-- Actions Column -->
        <td></td>
      </tr>
    `;
  }

  /**
   * Create placeholder row (empty row with stripes)
   * UPDATED 2025-12-23: 6 columns to match Tags column addition
   */
  private createPlaceholderRow(): string {
    return `
      <tr class="placeholder-row">
        <td>&nbsp;</td>
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
   * UPDATED 2025-12-23: Inline action buttons like SvelteKit with per-document permissions
   * UPDATED 2025-12-23: Added Tags column like SvelteKit
   */
  private createDocumentRow(doc: Document): string {
    const date = this.formatDate(doc.uploadedAt);
    const size = this.formatFileSize(doc.size);
    const isNewDoc = this.isDocumentNew(doc);
    const showActions = isAdmin();

    // Per-document permission checks (like SvelteKit)
    const canEdit = permissionsManager.canEditSpecificDocument(doc, this.currentUser);
    const canDelete = permissionsManager.canDeleteSpecificDocument(doc, this.currentUser);

    // Category label (like SvelteKit DB_CATEGORY_LABELS)
    const categoryLabel = DB_CATEGORY_LABELS[doc.category] ?? doc.category;

    // Tags rendering (like SvelteKit - max 3 badges + "+X")
    const tags = this.getDocumentTags(doc);
    const tagsHTML = this.renderTags(tags);

    return `
      <tr
        class="document-row cursor-pointer"
        data-document-id="${doc.id}"
        data-read="${doc.isRead}"
      >
        <!-- Name Column -->
        <td>
          <div class="flex items-center gap-3">
            <i class="fas fa-file-alt flex-shrink-0" style="font-size: 24px; color: var(--color-icon-primary);"></i>
            <div class="flex items-center gap-2 min-w-0">
              <span class="${!doc.isRead ? 'font-semibold' : ''}" title="${this.escapeHtml(this.getDisplayName(doc))}">
                ${this.escapeHtml(this.getDisplayName(doc))}
              </span>
              ${isNewDoc ? '<span class="badge badge--success" style="font-size: 11px; padding: 2px 8px;">Neu</span>' : ''}
              ${!doc.isRead ? '<span class="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0" title="Ungelesen"></span>' : ''}
            </div>
          </div>
        </td>

        <!-- Category Column -->
        <td>${this.escapeHtml(categoryLabel)}</td>

        <!-- Tags Column (NEW like SvelteKit) -->
        <td>${tagsHTML}</td>

        <!-- Size Column -->
        <td>${size}</td>

        <!-- Date Column -->
        <td>${date}</td>

        <!-- Actions Column - Inline buttons like SvelteKit -->
        <td>${this.createActionButtonsHTML(doc.id, showActions, canEdit, canDelete)}</td>
      </tr>
    `;
  }

  /**
   * Create action buttons HTML for document row
   * Extracted to reduce createDocumentRow line count
   */
  private createActionButtonsHTML(docId: number, showActions: boolean, canEdit: boolean, canDelete: boolean): string {
    if (!showActions) return '';

    const previewBtn = `<button class="action-icon action-icon--info action-preview-btn" data-document-id="${docId}" title="Vorschau" aria-label="Vorschau anzeigen"><i class="fas fa-eye"></i></button>`;
    const downloadBtn = `<button class="action-icon action-icon--info action-download-btn" data-document-id="${docId}" title="Herunterladen" aria-label="Dokument herunterladen"><i class="fas fa-download"></i></button>`;
    const editBtn = canEdit
      ? `<button class="action-icon action-icon--edit action-edit-btn" data-document-id="${docId}" title="Bearbeiten" aria-label="Dokument bearbeiten"><i class="fas fa-edit"></i></button>`
      : '';
    const deleteBtn = canDelete
      ? `<button class="action-icon action-icon--delete action-delete-btn" data-document-id="${docId}" title="Löschen" aria-label="Dokument löschen"><i class="fas fa-trash"></i></button>`
      : '';

    return `<div class="flex items-center gap-1">${previewBtn}${downloadBtn}${editBtn}${deleteBtn}</div>`;
  }

  /**
   * Get document tags as array
   * Backend may return tags as array or JSON string
   */
  private getDocumentTags(doc: Document): string[] {
    const rawTags = doc.tags;

    if (rawTags === undefined) return [];

    if (Array.isArray(rawTags)) {
      return rawTags.filter((t): t is string => typeof t === 'string');
    }

    if (rawTags !== '') {
      try {
        const parsed: unknown = JSON.parse(rawTags);
        if (Array.isArray(parsed)) {
          return parsed.filter((t): t is string => typeof t === 'string');
        }
      } catch {
        // Not JSON, treat as single tag
        return [rawTags];
      }
    }

    return [];
  }

  /**
   * Render tags as badge HTML (like SvelteKit - max 3 + "+X")
   */
  private renderTags(tags: string[]): string {
    if (tags.length === 0) {
      return '<span class="text-content-tertiary">-</span>';
    }

    const visibleTags = tags.slice(0, 3);
    const remainingCount = tags.length - 3;

    let html = '<div class="flex flex-wrap gap-1">';

    for (const tag of visibleTags) {
      html += `<span class="badge badge--info" style="padding: 2px 6px;">${this.escapeHtml(tag)}</span>`;
    }

    if (remainingCount > 0) {
      html += `<span class="text-xs text-content-tertiary">+${remainingCount}</span>`;
    }

    html += '</div>';
    return html;
  }

  /**
   * Try to handle an action button click with the given selector and handler
   * Returns true if button was found and handled, false otherwise
   */
  private tryHandleActionButton(
    target: HTMLElement,
    e: Event,
    selector: string,
    handler: (documentId: string, element: Element) => void,
  ): boolean {
    const button = target.closest(selector);
    if (!button) return false;

    e.stopPropagation();
    const documentId = button.getAttribute(DATA_DOCUMENT_ID);
    if (documentId !== null && documentId !== '') {
      handler(documentId, button);
    }
    return true;
  }

  /**
   * Handle action button click - delegates to specific handlers
   * UPDATED 2025-12-23: Refactored to reduce cognitive complexity
   */
  private handleActionButtonClick(target: HTMLElement, e: Event): boolean {
    // Preview button
    if (
      this.tryHandleActionButton(target, e, '.action-preview-btn', (id) => {
        this.openPreview(id);
      })
    ) {
      return true;
    }

    // Download button
    if (
      this.tryHandleActionButton(target, e, '.action-download-btn', (id) => {
        this.handleDownloadAction(id);
      })
    ) {
      return true;
    }

    // Edit button
    if (
      this.tryHandleActionButton(target, e, '.action-edit-btn', () => {
        alert('Bearbeiten-Funktion wird noch implementiert');
      })
    ) {
      return true;
    }

    // Delete button
    if (
      this.tryHandleActionButton(target, e, '.action-delete-btn', (id) => {
        this.handleDeleteDocument(id);
      })
    ) {
      return true;
    }

    // Legacy: Menu button (backwards compatibility)
    if (
      this.tryHandleActionButton(target, e, '.action-menu-btn', (id, el) => {
        this.showActionMenu(id, el as HTMLElement);
      })
    ) {
      return true;
    }

    return false;
  }

  /**
   * Handle download action - finds document and triggers download
   */
  private handleDownloadAction(documentId: string): void {
    const state = stateManager.getState();
    const doc = state.filteredDocuments.find((d) => String(d.id) === documentId);
    if (doc) {
      this.downloadDocument(doc);
    }
  }

  /**
   * Handle delete document action
   * NEW 2025-12-23: Like SvelteKit, with confirmation
   */
  private handleDeleteDocument(documentId: string): void {
    const state = stateManager.getState();
    const doc = state.filteredDocuments.find((d) => String(d.id) === documentId);
    if (!doc) return;

    // Permission check
    if (!permissionsManager.canDeleteSpecificDocument(doc, this.currentUser)) {
      alert('Sie haben keine Berechtigung, dieses Dokument zu löschen');
      return;
    }

    // Confirmation dialog
    const confirmed = confirm(
      `ACHTUNG: Diese Aktion kann nicht rückgängig gemacht werden!\n\nDas Dokument "${doc.filename}" wird unwiderruflich gelöscht.\n\nFortfahren?`,
    );

    if (confirmed) {
      void this.deleteDocument(doc);
    }
  }

  /**
   * Delete document via API
   * NEW 2025-12-23: Actual delete implementation
   */
  private async deleteDocument(doc: Document): Promise<void> {
    try {
      await documentAPI.deleteDocument(String(doc.id));
      // Remove from state and re-render
      const state = stateManager.getState();
      const updatedDocuments = state.documents.filter((d) => d.id !== doc.id);
      stateManager.setDocuments(updatedDocuments);
      alert('Dokument erfolgreich gelöscht');
    } catch (error) {
      console.error('[ListView] Delete failed:', error);
      alert(error instanceof Error ? error.message : 'Löschen fehlgeschlagen');
    }
  }

  /**
   * Handle chat folder or back navigation click
   */
  private handleChatNavigationClick(target: HTMLElement): boolean {
    // Check if "back to folders" row was clicked
    if (target.closest('.back-to-folders-row')) {
      sidebarManager.resetConversationSelection();
      return true;
    }

    // Check if chat folder row was clicked
    const folderRow = target.closest('.chat-folder-row');
    if (folderRow) {
      const conversationId = folderRow.getAttribute('data-conversation-id');
      if (conversationId !== null && conversationId !== '') {
        void sidebarManager.selectChatConversation(Number(conversationId));
      }
      return true;
    }

    return false;
  }

  /**
   * Handle document row click
   */
  private handleDocumentRowClick(target: HTMLElement): void {
    const row = target.closest('.document-row');
    if (row) {
      const documentId = row.getAttribute(DATA_DOCUMENT_ID);
      if (documentId !== null && documentId !== '') {
        this.openPreview(documentId);
      }
    }
  }

  /**
   * Attach click handlers to rows using event delegation
   * UPDATED 2025-12-04: Added chat folder click handlers
   */
  private attachRowClickHandlers(): void {
    if (!this.listRowsEl) {
      console.error('❌ listRowsEl is null, cannot attach handlers');
      return;
    }

    // Use event delegation on tbody for better performance
    this.listRowsEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      if (this.handleActionButtonClick(target, e)) return;
      if (this.handleChatNavigationClick(target)) return;
      this.handleDocumentRowClick(target);
    });
  }

  /**
   * Open document preview modal
   */
  private openPreview(documentId: string): void {
    const state = stateManager.getState();

    // Use filteredDocuments to match what's displayed in the table
    // Convert both to strings to handle type mismatch (HTML attributes are always strings)
    const doc = state.filteredDocuments.find((d) => String(d.id) === documentId);

    if (doc) {
      stateManager.setSelectedDocument(doc);
      stateManager.markAsRead(doc.id); // Use doc.id (number) instead of documentId (string)
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
      if (action === null || action === '' || this.currentDocumentId === null || this.currentDocumentId === '') return;

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
      if (e.key === 'Escape' && this.actionMenuEl?.classList.contains('active') === true) {
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
        // DELETE FEATURE: Requires backend DELETE /api/v2/documents/:id endpoint + permission check
        // Currently shows placeholder alert until backend endpoint is ready
        alert('Löschen-Funktion folgt noch');
        break;
      case 'move':
        // MOVE FEATURE: Not planned for current phase - requires folder system architecture
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
   * Check if document should show "Neu" badge
   * Badge shows when: (uploaded in last 7 days) AND (user has NOT read it yet)
   */
  private isDocumentNew(doc: Document): boolean {
    // Check if uploaded in last 7 days
    const uploadDate = new Date(doc.uploadedAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const isRecent = uploadDate >= sevenDaysAgo;

    // Show badge only if recent AND not yet read by current user
    return isRecent && !doc.isRead;
  }

  /**
   * Extract file extension from stored filename (UUID-based)
   */
  private getFileExtension(storedFilename: string): string {
    const lastDot = storedFilename.lastIndexOf('.');
    return lastDot !== -1 ? storedFilename.substring(lastDot) : '';
  }

  /**
   * Get display name with extension (original name + extension from stored filename)
   * Only appends extension if filename doesn't already have one
   * Example: "testfile" + ".pdf" = "testfile.pdf"
   * Example: "testfile.pdf" stays "testfile.pdf" (no double extension)
   */
  private getDisplayName(doc: Document): string {
    // Check if filename already has an extension
    const filenameHasExtension = doc.filename.lastIndexOf('.') > 0;
    if (filenameHasExtension) {
      return doc.filename; // Already has extension, don't add again
    }
    // No extension in filename, add from stored filename
    const extension = this.getFileExtension(doc.storedFilename);
    return doc.filename + extension;
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
