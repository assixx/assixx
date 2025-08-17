/**
 * Document Base Component
 * Shared functionality for all document category pages
 */

import type { Document } from '../types/api.types';

import { fetchWithAuth, showError, showSuccess } from './auth';

// Document scope type
export type DocumentScope = 'all' | 'company' | 'department' | 'team' | 'personal' | 'payroll';
export type SortOption = 'newest' | 'oldest' | 'name' | 'size';
export type ViewMode = 'active' | 'archived' | 'all';

// Base class for document pages
export class DocumentBase {
  protected allDocuments: Document[] = [];
  protected filteredDocuments: Document[] = [];
  protected currentScope: DocumentScope;
  protected currentSort: SortOption = 'newest';
  protected currentSearch = '';
  protected pageTitle: string;
  protected pageSubtitle: string;
  protected showSearch: boolean;
  protected currentViewMode: ViewMode = 'active';
  protected favoriteDocIds = new Set<number>();

  constructor(scope: DocumentScope, title: string, subtitle: string, showSearch = true) {
    this.currentScope = scope;
    this.pageTitle = title;
    this.pageSubtitle = subtitle;
    this.showSearch = showSearch;
  }

  /**
   * Initialize documents page
   */
  async initialize(): Promise<void> {
    try {
      this.loadFavorites();
      this.updatePageHeader();
      if (this.currentScope !== 'all') {
        await this.loadDocuments();
        this.updateStats();
        this.renderDocuments();
      }
      this.setupEventListeners();
      this.addViewModeToggle();
    } catch (error) {
      console.error('Error initializing documents:', error);
      showError('Fehler beim Laden der Dokumente');
    }
  }

  /**
   * Update page header
   */
  protected updatePageHeader(): void {
    const titleElement = document.querySelector('#page-title');
    const subtitleElement = document.querySelector('#page-subtitle');

    if (titleElement) {
      titleElement.textContent = this.pageTitle;
    }
    if (subtitleElement) {
      subtitleElement.textContent = this.pageSubtitle;
    }

    // Hide/show search based on page type
    const searchContainer = document.querySelector('#search-container');
    if (searchContainer) {
      searchContainer.style.display = this.showSearch ? 'block' : 'none';
    }
  }

  /**
   * Add view mode toggle buttons
   */
  protected addViewModeToggle(): void {
    const controlLeft = document.querySelector('.control-left');
    if (!controlLeft || this.currentScope === 'all') return;

    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'view-mode-toggle';
    toggleContainer.innerHTML = `
      <button class="toggle-btn active" data-mode="active" onclick="window.documentBase?.setViewMode('active')">
        <i class="fas fa-folder"></i> Aktive
      </button>
      <button class="toggle-btn" data-mode="archived" onclick="window.documentBase?.setViewMode('archived')">
        <i class="fas fa-archive"></i> Archiviert
      </button>
      <button class="toggle-btn" data-mode="all" onclick="window.documentBase?.setViewMode('all')">
        <i class="fas fa-folder-open"></i> Alle
      </button>
    `;

    controlLeft.append(toggleContainer);

    // Make instance available globally for onclick handlers
    window.documentBase = this;
  }

  /**
   * Set up event listeners
   */
  protected setupEventListeners(): void {
    // Search input (only for search page)
    if (this.currentScope === 'all') {
      const searchInput = document.querySelector('#searchInput');
      if (searchInput) {
        searchInput.addEventListener('input', (e: Event) => {
          const target = e.target as HTMLInputElement | null;
          if (target) {
            this.currentSearch = target.value.toLowerCase();
            void this.performSearch();
          }
        });

        // Focus on search input
        searchInput.focus();
      }
    }

    // Sort dropdown
    const sortDropdown = document.querySelector('#sortDropdown');
    if (sortDropdown) {
      sortDropdown.addEventListener('click', (e) => {
        const target = e.target as HTMLElement | null;
        if (target?.classList.contains('dropdown-option') === true) {
          const sortValue = target.dataset.sort as SortOption | undefined;
          if (sortValue !== undefined) {
            this.currentSort = sortValue;
            this.sortDocuments();
            this.renderDocuments();
            this.updateSortDisplay(target.textContent !== '' ? target.textContent : 'Sortierung');
          }
        }
      });
    }

    // Click outside to close dropdowns
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (target && !target.closest('.custom-dropdown')) {
        this.closeAllDropdowns();
      }
    });
  }

  /**
   * Load documents from API
   */
  protected async loadDocuments(): Promise<void> {
    try {
      const useV2Documents = window.FEATURE_FLAGS?.USE_API_V2_DOCUMENTS;
      const endpoint = useV2Documents === true ? '/api/v2/documents' : '/api/documents/v2';
      const response = await fetchWithAuth(endpoint);

      if (!response.ok) {
        throw new Error('Failed to load documents');
      }

      const result = (await response.json()) as { data?: Document[]; documents?: Document[] };

      // Backend returns {data: Document[], pagination: {...}}
      this.allDocuments = result.data ?? result.documents ?? [];

      // Filter based on scope
      this.filterDocumentsByScope();
    } catch (error) {
      console.error('Error loading documents:', error);
      throw error;
    }
  }

  /**
   * Filter documents by current scope
   */
  protected filterDocumentsByScope(): void {
    let filtered = this.allDocuments;

    // Filter by scope/category
    if (this.currentScope === 'payroll') {
      // Special filter for payroll documents (Gehaltsabrechnungen)
      filtered = filtered.filter((doc) => doc.category === 'salary');
    } else {
      filtered = filtered.filter((doc) => doc.scope === this.currentScope);
    }

    // Filter by view mode
    if (this.currentViewMode === 'active') {
      filtered = filtered.filter((doc) => doc.is_archived !== true);
    } else if (this.currentViewMode === 'archived') {
      filtered = filtered.filter((doc) => doc.is_archived === true);
    }
    // 'all' mode shows everything

    this.filteredDocuments = filtered;
  }

  /**
   * Perform search across all documents
   */
  protected async performSearch(): Promise<void> {
    if (this.currentSearch.trim() === '') {
      this.filteredDocuments = [];
      this.renderDocuments();
      return;
    }

    try {
      // Load all documents if not loaded
      if (this.allDocuments.length === 0) {
        await this.loadDocuments();
      }

      // Search across all documents
      this.filteredDocuments = this.allDocuments.filter(
        (doc) =>
          doc.file_name.toLowerCase().includes(this.currentSearch) ||
          doc.description?.toLowerCase().includes(this.currentSearch) === true ||
          doc.uploaded_by_name?.toLowerCase().includes(this.currentSearch) === true,
      );

      // Sort results
      this.sortDocuments();

      // Render results
      this.renderDocuments();
    } catch (error) {
      console.error('Error performing search:', error);
      showError('Fehler bei der Suche');
    }
  }

  /**
   * Update statistics
   */
  protected updateStats(): void {
    const totalDocs = this.filteredDocuments.length;
    const unreadDocs = this.filteredDocuments.filter((doc) => doc.is_read !== true).length;

    // Calculate documents from this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const recentDocs = this.filteredDocuments.filter((doc) => new Date(doc.created_at) >= oneWeekAgo).length;

    // Update UI
    this.updateCount('totalDocs', totalDocs);
    this.updateCount('unreadDocs', unreadDocs);
    this.updateCount('recentDocs', recentDocs);
  }

  /**
   * Update count element
   */
  protected updateCount(elementId: string, count: number): void {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = count.toString();
    }
  }

  /**
   * Sort documents
   */
  protected sortDocuments(): void {
    switch (this.currentSort) {
      case 'newest':
        this.filteredDocuments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        this.filteredDocuments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'name':
        this.filteredDocuments.sort((a, b) => a.file_name.localeCompare(b.file_name));
        break;
      case 'size':
        this.filteredDocuments.sort((a, b) => b.file_size - a.file_size);
        break;
    }
  }

  /**
   * Render documents grid
   */
  protected renderDocuments(): void {
    const container = document.querySelector('#documentsContainer');
    if (!container) return;

    if (this.filteredDocuments.length === 0) {
      const emptyMessage =
        this.currentScope === 'all' && this.currentSearch !== ''
          ? 'Keine Dokumente gefunden. Versuchen Sie eine andere Suche.'
          : 'Keine Dokumente in dieser Kategorie vorhanden.';

      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-folder-open"></i>
          <h3>${this.currentScope === 'all' ? 'Suche starten' : 'Keine Dokumente'}</h3>
          <p>${emptyMessage}</p>
        </div>
      `;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'documents-grid';

    this.filteredDocuments.forEach((doc) => {
      grid.append(this.createDocumentCard(doc));
    });

    container.innerHTML = '';
    container.append(grid);
  }

  /**
   * Create document card element
   */
  protected createDocumentCard(doc: Document): HTMLElement {
    const card = document.createElement('div');
    card.className = 'document-card';
    card.onclick = () => {
      this.viewDocument(doc.id);
    };

    const icon = this.getFileIcon(doc.mime_type ?? doc.file_name);
    const readBadge = doc.is_read !== true ? '<span class="document-badge unread">NEU</span>' : '';
    const archivedBadge = doc.is_archived === true ? '<span class="document-badge archived">ARCHIVIERT</span>' : '';
    const scopeInfo =
      this.currentScope === 'all' ? `<div class="document-scope">${this.getScopeLabel(doc.scope)}</div>` : '';
    const isFavorite = this.favoriteDocIds.has(doc.id);

    card.innerHTML = `
      ${readBadge}
      ${archivedBadge}
      <button class="favorite-btn ${isFavorite ? 'active' : ''}" onclick="event.stopPropagation(); window.documentBase?.toggleFavorite(${doc.id})" title="${isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}">
        <i class="${isFavorite ? 'fas' : 'far'} fa-star"></i>
      </button>
      <div class="document-icon">
        <i class="${icon}"></i>
      </div>
      <h3 class="document-title" title="${this.escapeHtml(doc.file_name)}">
        ${this.escapeHtml(doc.file_name)}
      </h3>
      ${scopeInfo}
      <div class="document-meta">
        <div class="document-meta-item">
          <i class="fas fa-calendar"></i>
          <span>${this.formatDate(doc.created_at)}</span>
        </div>
        <div class="document-meta-item">
          <i class="fas fa-user"></i>
          <span>${this.escapeHtml(doc.uploaded_by_name ?? 'System')}</span>
        </div>
        ${
          doc.file_size !== 0
            ? `
          <div class="document-meta-item">
            <i class="fas fa-weight"></i>
            <span>${this.formatFileSize(doc.file_size)}</span>
          </div>
        `
            : ''
        }
      </div>
    `;

    return card;
  }

  /**
   * View document in modal
   */
  protected viewDocument(documentId: number): void {
    try {
      const doc = this.allDocuments.find((d) => d.id === documentId);
      if (!doc) {
        showError('Dokument nicht gefunden');
        return;
      }

      // Mark as read
      const useV2Documents = window.FEATURE_FLAGS?.USE_API_V2_DOCUMENTS;
      const endpoint =
        useV2Documents === true ? `/api/v2/documents/${documentId}/read` : `/api/documents/${documentId}/read`;
      fetchWithAuth(endpoint, { method: 'POST' })
        .then(() => {
          // Update local state
          doc.is_read = true;
          this.updateStats();
          this.renderDocuments();
        })
        .catch(console.error);

      // Show document preview modal
      this.showDocumentModal(doc);
    } catch (error) {
      console.error('Error viewing document:', error);
      showError('Fehler beim Öffnen des Dokuments');
    }
  }

  /**
   * Show document preview modal
   */
  protected showDocumentModal(doc: Document): void {
    const modal = document.querySelector('#documentPreviewModal');
    if (!modal) return;

    // Update modal content
    this.updateElement('modalDocumentTitle', doc.file_name !== '' ? doc.file_name : 'Dokument');
    this.updateElement('modalFileName', doc.file_name);
    this.updateElement('modalFileSize', this.formatFileSize(doc.file_size));
    this.updateElement('modalUploadedBy', doc.uploaded_by_name ?? 'System');
    this.updateElement('modalUploadDate', this.formatDate(doc.created_at));

    // Setup preview
    const previewFrame = document.querySelector('#documentPreviewFrame');
    const previewError = document.querySelector('#previewError');

    if (previewFrame && previewError) {
      const useV2Documents = window.FEATURE_FLAGS?.USE_API_V2_DOCUMENTS;
      const endpoint =
        useV2Documents === true ? `/api/v2/documents/preview/${doc.id}` : `/api/documents/preview/${doc.id}`;
      fetchWithAuth(endpoint)
        .then(async (response) => {
          if (!response.ok) throw new Error('Preview failed');
          return response.blob();
        })
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          previewFrame.src = blobUrl;
          previewFrame.style.display = 'block';
          previewError.style.display = 'none';
          previewFrame.dataset.blobUrl = blobUrl;
        })
        .catch((error: unknown) => {
          console.error('Preview error:', error);
          previewFrame.style.display = 'none';
          previewError.style.display = 'block';
        });
    }

    // Store document ID for download
    const downloadBtn = document.querySelector('#downloadButton');
    if (downloadBtn) {
      downloadBtn.dataset.documentId = doc.id.toString();
    }

    // Show modal
    modal.style.display = 'flex';
  }

  /**
   * Helper methods
   */
  protected getFileIcon(mimeOrName: string): string {
    const mime = mimeOrName.toLowerCase();

    if (mime.includes('pdf')) return 'fas fa-file-pdf';
    if (mime.includes('word') || mime.endsWith('.doc') || mime.endsWith('.docx')) return 'fas fa-file-word';
    if (mime.includes('excel') || mime.endsWith('.xls') || mime.endsWith('.xlsx')) return 'fas fa-file-excel';
    if (mime.includes('powerpoint') || mime.endsWith('.ppt') || mime.endsWith('.pptx')) return 'fas fa-file-powerpoint';
    if (mime.includes('image') || /\.(jpg|jpeg|png|gif|svg)$/.test(mime)) return 'fas fa-file-image';
    if (mime.includes('video')) return 'fas fa-file-video';
    if (mime.includes('audio')) return 'fas fa-file-audio';
    if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z')) return 'fas fa-file-archive';
    if (mime.includes('text') || mime.endsWith('.txt')) return 'fas fa-file-alt';

    return 'fas fa-file';
  }

  protected getScopeLabel(scope: string): string {
    switch (scope) {
      case 'company':
        return 'Firma';
      case 'department':
        return 'Abteilung';
      case 'team':
        return 'Team';
      case 'personal':
        return 'Persönlich';
      default:
        return 'Allgemein';
    }
  }

  protected formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  protected formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  protected escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  protected updateElement(id: string, value: string | number): void {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value.toString();
    }
  }

  protected updateSortDisplay(text: string): void {
    const display = document.querySelector('#sortDisplay');
    if (display) {
      const span = display.querySelector('span');
      if (span) {
        span.textContent = text;
      }
    }
  }

  protected closeAllDropdowns(): void {
    document.querySelectorAll('.dropdown-display').forEach((d) => {
      d.classList.remove('active');
    });
    document.querySelectorAll('.dropdown-options').forEach((d) => {
      d.classList.remove('active');
    });
  }

  /**
   * Set view mode
   */
  public setViewMode(mode: ViewMode): void {
    this.currentViewMode = mode;

    // Update toggle buttons
    document.querySelectorAll('.view-mode-toggle .toggle-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Re-filter and render
    this.filterDocumentsByScope();
    this.updateStats();
    this.renderDocuments();
  }

  /**
   * Load favorites from localStorage
   */
  protected loadFavorites(): void {
    const stored = localStorage.getItem('favoriteDocuments');
    if (stored !== null && stored !== '') {
      try {
        const favorites = JSON.parse(stored) as number[];
        this.favoriteDocIds = new Set(favorites);
      } catch (error) {
        console.error('Error loading favorites:', error);
      }
    }
  }

  /**
   * Save favorites to localStorage
   */
  protected saveFavorites(): void {
    localStorage.setItem('favoriteDocuments', JSON.stringify([...this.favoriteDocIds]));
  }

  /**
   * Toggle favorite status
   */
  public toggleFavorite(docId: number): void {
    if (this.favoriteDocIds.has(docId)) {
      this.favoriteDocIds.delete(docId);
      showSuccess('Aus Favoriten entfernt');
    } else {
      this.favoriteDocIds.add(docId);
      showSuccess('Zu Favoriten hinzugefügt');
    }
    this.saveFavorites();
    this.renderDocuments();
  }
}

// Global functions for window
declare global {
  interface Window {
    closeDocumentModal: () => void;
    downloadDocument: (docId?: string | number) => void;
    toggleDropdown: (type: string) => void;
    documentBase?: DocumentBase;
  }
}

// Close document modal
window.closeDocumentModal = function (): void {
  const modal = document.querySelector('#documentPreviewModal');
  if (modal) {
    modal.style.display = 'none';

    // Clean up blob URL
    const previewFrame = document.querySelector('#documentPreviewFrame');
    if (previewFrame) {
      const blobUrl = previewFrame.dataset.blobUrl;
      if (blobUrl !== undefined && blobUrl !== '') {
        URL.revokeObjectURL(blobUrl);
        delete previewFrame.dataset.blobUrl;
      }
      previewFrame.src = '';
    }
  }
};

// Download document
window.downloadDocument = function (docId?: string | number): void {
  void (async () => {
    let documentId: string;

    if (docId !== undefined) {
      documentId = String(docId);
    } else {
      const downloadBtn = document.querySelector('#downloadButton');
      if (!downloadBtn) {
        console.error('Download button not found');
        return;
      }
      const dataId = downloadBtn.dataset.documentId;
      if (dataId === null || dataId === '') {
        console.error('No document ID found');
        return;
      }
      documentId = dataId;
    }

    try {
      const useV2Documents = window.FEATURE_FLAGS?.USE_API_V2_DOCUMENTS;
      const endpoint =
        useV2Documents === true ? `/api/v2/documents/download/${documentId}` : `/api/documents/download/${documentId}`;
      const response = await fetchWithAuth(endpoint);

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'document.pdf';
      link.style.display = 'none';
      document.body.append(link);
      link.click();

      setTimeout(() => {
        link.remove();
        window.URL.revokeObjectURL(url);
      }, 100);

      showSuccess('Dokument wird heruntergeladen');
    } catch (error) {
      console.error('Error downloading document:', error);
      showError('Fehler beim Herunterladen des Dokuments');
    }
  })();
};

// Toggle dropdown
window.toggleDropdown = function (type: string): void {
  const display = document.getElementById(`${type}Display`);
  const dropdown = document.getElementById(`${type}Dropdown`);

  if (!display || !dropdown) return;

  // Close all other dropdowns
  document.querySelectorAll('.dropdown-display').forEach((d) => {
    if (d !== display) d.classList.remove('active');
  });
  document.querySelectorAll('.dropdown-options').forEach((d) => {
    if (d !== dropdown) d.classList.remove('active');
  });

  display.classList.toggle('active');
  dropdown.classList.toggle('active');
};
