/**
 * Documents Explorer - State Management
 *
 * Central state manager using Observer pattern for reactive updates
 * All state changes go through this module to ensure consistency
 *
 * @module explorer/state
 */

import type {
  AppState,
  Document,
  DocumentCategory,
  DocumentStats,
  SortOption,
  StateObserver,
  UserRole,
  ViewMode,
} from './types';

/**
 * State Manager
 * Singleton pattern for centralized state management
 */
class StateManager {
  private state: AppState;
  private observers = new Set<StateObserver>();

  constructor() {
    // Initialize default state
    this.state = {
      currentCategory: 'all',
      viewMode: 'list', // Default to list view (Windows Details style)
      sortOption: 'newest',
      searchQuery: '',
      documents: [],
      filteredDocuments: [],
      isLoading: true,
      error: null,
      selectedDocument: null,
      userRole: null,
      stats: {
        total: 0,
        unread: 0,
        thisWeek: 0,
      },
    };
  }

  /**
   * Get current state (read-only)
   * Returns a frozen copy to prevent direct mutations
   */
  public getState(): Readonly<AppState> {
    return Object.freeze({ ...this.state });
  }

  /**
   * Subscribe to state changes
   * @param observer - Callback function to invoke on state change
   * @returns Unsubscribe function
   */
  public subscribe(observer: StateObserver): () => void {
    this.observers.add(observer);

    // Return unsubscribe function
    return () => {
      this.observers.delete(observer);
    };
  }

  /**
   * Notify all observers of state change
   */
  private notify(): void {
    const frozenState = this.getState();
    this.observers.forEach((observer) => {
      try {
        observer(frozenState);
      } catch (error) {
        console.error('Error in state observer:', error);
      }
    });
  }

  /**
   * Update state (private - use specific setters)
   * @param updates - Partial state updates
   */
  private updateState(updates: Partial<AppState>): void {
    this.state = {
      ...this.state,
      ...updates,
    };
    this.notify();
  }

  /**
   * Set user role
   * @param role - User role from auth (can be null if not authenticated)
   */
  public setUserRole(role: UserRole | null): void {
    this.updateState({ userRole: role });
  }

  /**
   * Set loading state
   * @param isLoading - Loading flag
   */
  public setLoading(isLoading: boolean): void {
    this.updateState({ isLoading });
  }

  /**
   * Set error state
   * @param error - Error message or null
   */
  public setError(error: string | null): void {
    this.updateState({ error, isLoading: false });
  }

  /**
   * Set documents
   * Updates documents and recalculates filtered/sorted list
   * @param documents - Array of documents
   */
  public setDocuments(documents: Document[]): void {
    this.state.documents = documents;
    this.state.stats = this.calculateStats(documents);
    this.applyFiltersAndSort();
  }

  /**
   * Set current category
   * @param category - Document category to display
   */
  public setCategory(category: DocumentCategory): void {
    this.state.currentCategory = category;
    this.applyFiltersAndSort();
  }

  /**
   * Set view mode
   * @param viewMode - 'list' or 'grid'
   */
  public setViewMode(viewMode: ViewMode): void {
    this.updateState({ viewMode });
    // Persist to localStorage
    localStorage.setItem('documents-view-mode', viewMode);
  }

  /**
   * Set sort option
   * @param sortOption - Sort method
   */
  public setSortOption(sortOption: SortOption): void {
    this.state.sortOption = sortOption;
    this.applyFiltersAndSort();
  }

  /**
   * Set search query
   * @param query - Search string
   */
  public setSearchQuery(query: string): void {
    this.state.searchQuery = query.toLowerCase().trim();
    this.applyFiltersAndSort();
  }

  /**
   * Set selected document (for preview modal)
   * @param document - Document to preview or null to close
   */
  public setSelectedDocument(document: Document | null): void {
    this.updateState({ selectedDocument: document });
  }

  /**
   * Mark document as read
   * @param documentId - UUID of document
   */
  public markAsRead(documentId: string): void {
    const docIndex = this.state.documents.findIndex((d) => d.id === documentId);
    if (docIndex !== -1) {
      // eslint-disable-next-line security/detect-object-injection
      const doc = this.state.documents[docIndex];
      if (!doc.isRead) {
        // Safe: docIndex is validated by findIndex !== -1
        const documents = [...this.state.documents];
        // eslint-disable-next-line security/detect-object-injection
        documents[docIndex] = { ...doc, isRead: true };
        this.state.documents = documents;
        this.state.stats.unread = Math.max(0, this.state.stats.unread - 1);
        this.applyFiltersAndSort();
      }
    }
  }

  /**
   * Apply filters and sorting to documents
   * Updates filteredDocuments based on current state
   */
  private applyFiltersAndSort(): void {
    let filtered = [...this.state.documents];

    // Filter by category
    if (this.state.currentCategory !== 'all') {
      filtered = filtered.filter((doc) => this.matchesCategory(doc, this.state.currentCategory));
    }

    // Filter by search query - searchQuery is always string (never null/undefined)
    const searchQuery = this.state.searchQuery;
    if (searchQuery !== '') {
      filtered = filtered.filter((doc) => this.matchesSearch(doc, searchQuery));
    }

    // Sort
    filtered.sort((a, b) => this.compareDocuments(a, b, this.state.sortOption));

    this.updateState({ filteredDocuments: filtered });
  }

  /**
   * Check if document matches category
   */
  private matchesCategory(doc: Document, category: DocumentCategory): boolean {
    const categoryMap: Record<string, DocumentCategory> = {
      user: 'personal',
      team: 'team',
      department: 'department',
      company: 'company',
    };

    // Special handling for payroll category
    if (category === 'payroll') {
      return (
        doc.category.toLowerCase().includes('gehalt') ||
        doc.category.toLowerCase().includes('payroll') ||
        doc.category.toLowerCase().includes('lohn')
      );
    }

    const mappedCategory = categoryMap[doc.recipientType];
    return mappedCategory === category;
  }

  /**
   * Check if document matches search query
   */
  private matchesSearch(doc: Document, query: string): boolean {
    const searchableText = [
      doc.filename,
      doc.category,
      doc.uploaderName,
      `${doc.year}`,
      doc.month !== null && doc.month !== 0 ? `${doc.month}` : '',
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(query);
  }

  /**
   * Compare documents for sorting
   */
  private compareDocuments(a: Document, b: Document, sortOption: SortOption): number {
    switch (sortOption) {
      case 'newest':
        return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();

      case 'oldest':
        return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();

      case 'name':
        return a.filename.localeCompare(b.filename, 'de');

      case 'size':
        return b.size - a.size;

      default:
        return 0;
    }
  }

  /**
   * Calculate statistics for documents
   */
  private calculateStats(documents: Document[]): DocumentStats {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return {
      total: documents.length,
      unread: documents.filter((d) => !d.isRead).length,
      thisWeek: documents.filter((d) => new Date(d.uploadedAt) >= oneWeekAgo).length,
    };
  }

  /**
   * Load saved view mode from localStorage
   */
  public loadSavedViewMode(): void {
    const saved = localStorage.getItem('documents-view-mode');
    if (saved === 'list' || saved === 'grid') {
      this.setViewMode(saved);
    }
  }

  /**
   * Refresh documents from API
   * Used after upload or when retry button is clicked
   */
  public refreshDocuments(): void {
    this.setLoading(true);
    this.setError(null);

    try {
      // Will be implemented by API module
      // For now, just clear loading state
      this.setLoading(false);
    } catch (error) {
      this.setError(error instanceof Error ? error.message : 'Fehler beim Laden');
    }
  }

  /**
   * Reset state to defaults
   * Used for cleanup or testing
   */
  public reset(): void {
    this.state = {
      currentCategory: 'all',
      viewMode: 'list',
      sortOption: 'newest',
      searchQuery: '',
      documents: [],
      filteredDocuments: [],
      isLoading: true,
      error: null,
      selectedDocument: null,
      userRole: null,
      stats: {
        total: 0,
        unread: 0,
        thisWeek: 0,
      },
    };
    this.notify();
  }
}

// Singleton instance
export const stateManager = new StateManager();

// Export type for testing/mocking
export type { StateManager };
