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
import { documentAPI } from './api';

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
   * @param documentId - Document ID (numeric)
   */
  public markAsRead(documentId: number): void {
    const docIndex = this.state.documents.findIndex((d) => d.id === documentId);
    if (docIndex !== -1) {
      // eslint-disable-next-line security/detect-object-injection
      const doc = this.state.documents[docIndex];
      if (doc !== undefined && !doc.isRead) {
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

    // Filter by search query with smart scoring (Windows Explorer style)
    const searchQuery = this.state.searchQuery;
    if (searchQuery !== '') {
      // Score each document and filter out non-matches (score = 0)
      const scoredDocs = filtered
        .map((doc: Document) => ({
          doc,
          score: this.getSearchScore(doc, searchQuery),
        }))
        .filter((item: { doc: Document; score: number }) => item.score > 0);

      // Sort by score first (highest first), then by user preference
      scoredDocs.sort((a: { doc: Document; score: number }, b: { doc: Document; score: number }) => {
        if (a.score !== b.score) {
          return b.score - a.score; // Higher score first
        }
        return this.compareDocuments(a.doc, b.doc, this.state.sortOption);
      });

      filtered = scoredDocs.map((item: { doc: Document; score: number }) => item.doc);
    } else {
      // Normal sort without search
      filtered.sort((a, b) => this.compareDocuments(a, b, this.state.sortOption));
    }

    this.updateState({ filteredDocuments: filtered });
  }

  /**
   * Check if document matches category (NEW: clean structure, refactored 2025-01-10)
   * Direct 1:1 mapping - no translation layer needed!
   */
  private matchesCategory(doc: Document, category: DocumentCategory): boolean {
    if (category === 'all') {
      return true;
    }

    // NEW: Direct comparison with accessScope - perfect 1:1 mapping!
    // Sidebar category === database access_scope === backend field
    return doc.accessScope === category;
  }

  /**
   * Get search score for document (Windows Explorer style)
   * Higher score = better match
   *
   * Scoring:
   * - 100: Filename starts with query (highest priority)
   * - 50: Filename contains query
   * - 25: Category/uploader/metadata contains query
   * - 0: No match
   *
   * Best Practice 2025: Prefix matching with priority scoring
   */
  private getSearchScore(doc: Document, query: string): number {
    const filenameLower = doc.filename.toLowerCase();
    const categoryLower = doc.category.toLowerCase();
    const uploaderLower = doc.uploaderName.toLowerCase();
    const yearStr = doc.salaryYear !== null && doc.salaryYear !== undefined ? `${doc.salaryYear}` : '';
    const monthStr =
      doc.salaryMonth !== null && doc.salaryMonth !== undefined && doc.salaryMonth !== 0 ? `${doc.salaryMonth}` : '';

    // Highest priority: Filename starts with query
    if (filenameLower.startsWith(query)) {
      return 100;
    }

    // High priority: Filename contains query
    if (filenameLower.includes(query)) {
      return 50;
    }

    // Medium priority: Category, uploader, or metadata contains query
    if (
      categoryLower.includes(query) ||
      uploaderLower.includes(query) ||
      yearStr.includes(query) ||
      monthStr.includes(query)
    ) {
      return 25;
    }

    // No match
    return 0;
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
  public async refreshDocuments(): Promise<void> {
    this.setLoading(true);
    this.setError(null);

    try {
      console.info('[StateManager] Refreshing documents after upload...');

      // Fetch fresh documents from backend
      const documents = await documentAPI.fetchDocuments();

      console.info(`[StateManager] Loaded ${documents.length} documents after refresh`);

      // DEBUG: Log first document (newest) with all relevant fields
      const newest = documents[0];
      if (newest !== undefined) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const uploadDate = new Date(newest.uploadedAt);
        const isRecent = uploadDate >= sevenDaysAgo;

        console.log('[StateManager DEBUG] Newest document:', {
          id: newest.id,
          filename: newest.filename,
          uploadedAt: newest.uploadedAt,
          uploadDateParsed: uploadDate.toISOString(),
          isRead: newest.isRead,
          uploadedBy: newest.uploadedBy,
          isRecent,
          shouldShowNewBadge: isRecent && !newest.isRead,
          sevenDaysAgo: sevenDaysAgo.toISOString(),
        });
      }

      // Update state with fresh data
      this.setDocuments(documents);
      this.setLoading(false);
    } catch (error) {
      console.error('[StateManager] Failed to refresh documents:', error);
      this.setError(error instanceof Error ? error.message : 'Fehler beim Laden');
      this.setLoading(false);
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
