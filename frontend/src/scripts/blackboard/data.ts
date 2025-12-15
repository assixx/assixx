/**
 * Blackboard Data Layer
 * Handles data fetching, state management, and business logic
 * Following MANAGE pattern with centralized state
 */

import type { ApiClient } from '../../utils/api-client';
import { BlackboardAPI } from './api';
import type { BlackboardEntry, Department, Team, Area, FilterState, PaginationState, EntryQueryOptions } from './types';

/**
 * Blackboard State Manager
 * Centralized state for the blackboard system
 */
class BlackboardState {
  // ============================================================================
  // Singleton Pattern
  // ============================================================================

  private static instance: BlackboardState | null = null;

  public static getInstance(): BlackboardState {
    this.instance ??= new BlackboardState();
    return this.instance;
  }

  // ============================================================================
  // State Properties
  // ============================================================================

  // API instance
  public api: BlackboardAPI | null = null;

  // Entry data
  private entries: BlackboardEntry[] = [];
  private selectedEntry: BlackboardEntry | null = null;

  // Organization data
  private departments: Department[] = [];
  private teams: Team[] = [];
  private areas: Area[] = [];

  // User info
  private currentUserId: number | null = null;
  private isAdmin: boolean = false;
  private userRole: string = 'employee';

  // Filter state
  private filterState: FilterState = {
    status: 'active',
    filter: 'all',
    search: '',
    sortBy: 'created_at',
    sortDir: 'DESC',
  };

  // Pagination state
  private paginationState: PaginationState = {
    currentPage: 1,
    totalPages: 1,
    limit: 10,
    total: 0,
  };

  // Loading state
  private isLoading: boolean = false;

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize state with API client
   * @param apiClient - API client instance
   * @param userId - Current user ID
   * @param isAdminUser - Whether user is admin or root
   * @param role - User's actual role (root, admin, employee)
   */
  public initialize(apiClient: ApiClient, userId: number, isAdminUser: boolean, role: string): void {
    this.api = new BlackboardAPI(apiClient);
    this.currentUserId = userId;
    this.isAdmin = isAdminUser;
    this.userRole = role;
    console.info('[BlackboardState] Initialized with role:', role);
  }

  // ============================================================================
  // Entries
  // ============================================================================

  /**
   * Get all entries
   */
  public getEntries(): BlackboardEntry[] {
    return this.entries;
  }

  /**
   * Set entries
   */
  public setEntries(entries: BlackboardEntry[]): void {
    this.entries = entries;
  }

  /**
   * Get entry by ID
   */
  public getEntryById(id: number): BlackboardEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  /**
   * Add entry to state
   */
  public addEntry(entry: BlackboardEntry): void {
    this.entries.unshift(entry); // Add to beginning
  }

  /**
   * Update entry in state
   */
  public updateEntry(id: number, updatedEntry: BlackboardEntry): void {
    const index = this.entries.findIndex((e) => e.id === id);
    if (index !== -1) {
      // eslint-disable-next-line security/detect-object-injection -- index comes from findIndex(), checked for -1, not user input
      this.entries[index] = updatedEntry;
    }
  }

  /**
   * Remove entry from state
   */
  public removeEntry(id: number): void {
    this.entries = this.entries.filter((e) => e.id !== id);
  }

  /**
   * Get selected entry
   */
  public getSelectedEntry(): BlackboardEntry | null {
    return this.selectedEntry;
  }

  /**
   * Set selected entry
   */
  public setSelectedEntry(entry: BlackboardEntry | null): void {
    this.selectedEntry = entry;
  }

  // ============================================================================
  // Organization Data
  // ============================================================================

  /**
   * Get departments
   */
  public getDepartments(): Department[] {
    return this.departments;
  }

  /**
   * Set departments
   */
  public setDepartments(departments: Department[]): void {
    this.departments = departments;
  }

  /**
   * Get teams
   */
  public getTeams(): Team[] {
    return this.teams;
  }

  /**
   * Set teams
   */
  public setTeams(teams: Team[]): void {
    this.teams = teams;
  }

  /**
   * Get areas
   */
  public getAreas(): Area[] {
    return this.areas;
  }

  /**
   * Set areas
   */
  public setAreas(areas: Area[]): void {
    this.areas = areas;
  }

  // ============================================================================
  // Filter State
  // ============================================================================

  /**
   * Get filter state
   */
  public getFilterState(): FilterState {
    return { ...this.filterState };
  }

  /**
   * Update filter state
   */
  public updateFilterState(updates: Partial<FilterState>): void {
    this.filterState = { ...this.filterState, ...updates };
  }

  /**
   * Reset filters to default
   */
  public resetFilters(): void {
    this.filterState = {
      status: 'active',
      filter: 'all',
      search: '',
      sortBy: 'created_at',
      sortDir: 'DESC',
    };
  }

  // ============================================================================
  // Pagination State
  // ============================================================================

  /**
   * Get pagination state
   */
  public getPaginationState(): PaginationState {
    return { ...this.paginationState };
  }

  /**
   * Update pagination state
   */
  public updatePaginationState(updates: Partial<PaginationState>): void {
    this.paginationState = { ...this.paginationState, ...updates };
  }

  // ============================================================================
  // User Info
  // ============================================================================

  /**
   * Get current user ID
   */
  public getCurrentUserId(): number | null {
    return this.currentUserId;
  }

  /**
   * Check if current user is admin
   */
  public isCurrentUserAdmin(): boolean {
    return this.isAdmin;
  }

  /**
   * Get current user role
   */
  public getCurrentUserRole(): string {
    return this.userRole;
  }

  /**
   * Check if user can modify entry (edit or delete)
   * Only ADMIN or ROOT role can modify (matches backend requireRoleV2(['admin', 'root']))
   * Note: Author check removed - employees cannot edit even their own entries per backend rules
   */
  private canModifyEntry(_entry: BlackboardEntry): boolean {
    // Only admin or root can modify entries (consistent with backend API)
    return this.userRole === 'admin' || this.userRole === 'root';
  }

  /**
   * Check if user can edit entry
   */
  public canEditEntry(entry: BlackboardEntry): boolean {
    return this.canModifyEntry(entry);
  }

  /**
   * Check if user can delete entry
   */
  public canDeleteEntry(entry: BlackboardEntry): boolean {
    return this.canModifyEntry(entry);
  }

  // ============================================================================
  // Loading State
  // ============================================================================

  /**
   * Get loading state
   */
  public isCurrentlyLoading(): boolean {
    return this.isLoading;
  }

  /**
   * Set loading state
   */
  public setLoading(loading: boolean): void {
    this.isLoading = loading;
  }

  // ============================================================================
  // Private Constructor (Singleton)
  // ============================================================================

  private constructor() {
    // Private constructor prevents direct instantiation
  }
}

// ============================================================================
// Data Fetching Functions
// ============================================================================

/**
 * Load entries with current filters
 */
export async function loadEntries(): Promise<void> {
  const state = BlackboardState.getInstance();

  if (!state.api) {
    console.error('[BlackboardData] API not initialized');
    return;
  }

  state.setLoading(true);

  try {
    const filterState = state.getFilterState();
    const paginationState = state.getPaginationState();

    const options: EntryQueryOptions = {
      status: filterState.status,
      filter: filterState.filter,
      search: filterState.search,
      sortBy: filterState.sortBy,
      sortDir: filterState.sortDir,
      page: paginationState.currentPage,
      limit: paginationState.limit,
      priority: filterState.priority,
    };

    const response = await state.api.fetchAll(options);

    state.setEntries(response.entries);
    state.updatePaginationState({
      total: response.pagination.total,
      totalPages: response.pagination.totalPages,
      currentPage: response.pagination.page,
      limit: response.pagination.limit,
    });

    console.info(`[BlackboardData] Loaded ${response.entries.length} entries`);
  } catch (error) {
    console.error('[BlackboardData] Error loading entries:', error);
  } finally {
    state.setLoading(false);
  }
}

/**
 * Load entry by ID
 */
export async function loadEntryById(id: number): Promise<BlackboardEntry | null> {
  const state = BlackboardState.getInstance();

  if (!state.api) {
    console.error('[BlackboardData] API not initialized');
    return null;
  }

  const entry = await state.api.getById(id);
  if (entry) {
    state.setSelectedEntry(entry);
  }
  return entry;
}

/**
 * Load departments, teams, and areas for dropdowns
 */
export async function loadOrganizationData(apiClient: ApiClient): Promise<void> {
  const state = BlackboardState.getInstance();

  try {
    // Load departments
    const departments = await apiClient.get<Department[]>('/departments');
    state.setDepartments(Array.isArray(departments) ? departments : []);

    // Load teams
    const teams = await apiClient.get<Team[]>('/teams');
    state.setTeams(Array.isArray(teams) ? teams : []);

    // Load areas
    const areas = await apiClient.get<Area[]>('/areas');
    state.setAreas(Array.isArray(areas) ? areas : []);

    console.info('[BlackboardData] Loaded organization data');
  } catch (error) {
    console.error('[BlackboardData] Error loading organization data:', error);
  }
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Singleton instance for easy access
 */
export const blackboardState = BlackboardState.getInstance();

/**
 * Export class for testing
 */
export { BlackboardState };
