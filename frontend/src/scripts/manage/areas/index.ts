/**
 * Area Management - Main Controller
 * Handles area CRUD operations for admin dashboard
 *
 * Migration Complete: 2025-10-29
 * - Refactored from single 495-line file to modular 5-file structure
 * - api/forms/index/types/ui layers (like teams/departments)
 * - 100% Design System compliant
 */

import { ApiClient } from '../../../utils/api-client';
import { showErrorAlert, showSuccessAlert } from '../../utils/alerts';
import { isAdmin } from '../../../utils/auth-helpers';
import type { Area } from './types';
import {
  renderAreasTable,
  toggleTableVisibility,
  showLoading,
  loadParentAreas,
  renderSearchResults,
  closeSearchResults,
} from './ui';
import { showAddAreaModal, showEditAreaModal, closeAreaModal, showDeleteModal, closeDeleteModal } from './forms';
import { AreaAPI } from './api';

class AreasManager {
  private readonly api: AreaAPI;
  public areas: Area[] = [];
  public currentAreaId: number | null = null;

  constructor() {
    // Check authentication
    const token = localStorage.getItem('token');
    if (token === null || token === '' || !isAdmin()) {
      window.location.href = '/login';
      // Early return - api not initialized, but constructor will exit
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
      this.api = null as any;
      return;
    }

    const apiClient = ApiClient.getInstance();
    this.api = new AreaAPI(apiClient);
    this.initializeEventListeners();
    void this.loadAreas();
  }

  /**
   * Initialize all event listeners
   */
  private initializeEventListeners(): void {
    this.initFloatingActionButton();
    this.initModalCloseButtons();
    this.initTableActions();
    this.initFormSubmit();
    this.initDeleteConfirmation();
    this.initForceDeleteConfirmation();
    this.initToggleGroup();
    this.initSearchInput();
  }

  /**
   * Initialize floating action button and empty state button for adding areas
   */
  private initFloatingActionButton(): void {
    // Floating button (bottom right)
    document.querySelector('#add-area-btn')?.addEventListener('click', () => {
      this.currentAreaId = null;
      showAddAreaModal();
      loadParentAreas(this.areas);
    });

    // Empty state button
    document.querySelector('#empty-state-add-btn')?.addEventListener('click', () => {
      this.currentAreaId = null;
      showAddAreaModal();
      loadParentAreas(this.areas);
    });
  }

  /**
   * Initialize modal close buttons
   */
  private initModalCloseButtons(): void {
    // Area Modal Close
    document.querySelector('#close-area-modal')?.addEventListener('click', () => {
      closeAreaModal();
    });
    document.querySelector('#cancel-area-modal')?.addEventListener('click', () => {
      closeAreaModal();
    });

    // Delete Modal Close
    document.querySelector('#close-delete-modal')?.addEventListener('click', () => {
      closeDeleteModal();
    });
    document.querySelector('#cancel-delete-modal')?.addEventListener('click', () => {
      closeDeleteModal();
    });

    // Force Delete Modal Close
    document.querySelector('#cancel-force-delete')?.addEventListener('click', () => {
      this.closeForceDeleteModal();
    });

    // Close on outside click
    document.querySelector('#area-modal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        closeAreaModal();
      }
    });

    document.querySelector('#delete-area-modal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        closeDeleteModal();
      }
    });

    document.querySelector('#force-delete-warning-modal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.closeForceDeleteModal();
      }
    });
  }

  /**
   * Initialize table action buttons (Edit/Delete) via event delegation
   */
  private initTableActions(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Handle edit area (from table)
      const editBtn = target.closest<HTMLElement>('[data-action="edit-area"]');
      if (editBtn) {
        const areaId = editBtn.dataset.areaId;
        if (areaId !== undefined) {
          this.editArea(Number.parseInt(areaId, 10));
        }
        return;
      }

      // Handle edit from search results
      const searchResultItem = target.closest<HTMLElement>('[data-action="edit-from-search"]');
      if (searchResultItem) {
        const areaId = searchResultItem.dataset.areaId;
        if (areaId !== undefined) {
          closeSearchResults();
          this.editArea(Number.parseInt(areaId, 10));
        }
        return;
      }

      // Handle delete area
      const deleteBtn = target.closest<HTMLElement>('[data-action="delete-area"]');
      if (deleteBtn) {
        const areaId = deleteBtn.dataset.areaId;
        if (areaId !== undefined) {
          this.showConfirmDeleteModal(Number.parseInt(areaId, 10));
        }
      }
    });
  }

  /**
   * Initialize form submit handler
   */
  private initFormSubmit(): void {
    const form = document.querySelector<HTMLFormElement>('#area-form');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.saveArea();
    });
  }

  /**
   * Initialize delete confirmation button
   */
  private initDeleteConfirmation(): void {
    document.querySelector('#confirm-delete-area')?.addEventListener('click', () => {
      const deleteIdInput = document.querySelector<HTMLInputElement>('#delete-area-id');
      if (deleteIdInput !== null && deleteIdInput.value !== '') {
        void this.deleteArea(Number.parseInt(deleteIdInput.value, 10));
      }
    });
  }

  /**
   * Initialize force delete confirmation button
   */
  private initForceDeleteConfirmation(): void {
    document.querySelector('#confirm-force-delete')?.addEventListener('click', () => {
      const forceDeleteIdInput = document.querySelector<HTMLInputElement>('#force-delete-area-id');
      if (forceDeleteIdInput !== null && forceDeleteIdInput.value !== '') {
        void this.executeForceDelete(Number.parseInt(forceDeleteIdInput.value, 10));
      }
    });
  }

  /**
   * Load all areas from API
   */
  async loadAreas(): Promise<void> {
    try {
      showLoading(true);

      this.areas = await this.api.fetchAll();
      console.log('[AREAS] Loaded areas from API:', this.areas.length);
      console.log('[AREAS] First area:', this.areas[0]);

      // Apply current filter after loading (same pattern as manage-departments)
      const activeButton = document.querySelector('#area-status-toggle .toggle-group__btn.active');
      const currentStatus = (activeButton?.getAttribute('data-status') ?? 'active') as 'active' | 'inactive' | 'all';
      console.log('[AREAS] Active button status:', currentStatus);
      this.filterByStatus(currentStatus);
    } catch (error) {
      console.error('Error loading areas:', error);
      showErrorAlert('Fehler beim Laden der Bereiche');
      this.areas = [];
      this.renderFilteredAreas([]);
    } finally {
      showLoading(false);
    }
  }

  /**
   * Edit area - open modal with pre-populated data
   */
  editArea(id: number): void {
    const area = this.areas.find((a) => a.id === id);
    if (area === undefined) {
      showErrorAlert('Bereich nicht gefunden');
      return;
    }

    this.currentAreaId = id;
    showEditAreaModal(area);
    loadParentAreas(this.areas, id, area.parent_id ?? undefined);
  }

  /**
   * Save area (Create or Update)
   */
  async saveArea(): Promise<void> {
    const form = document.querySelector<HTMLFormElement>('#area-form');
    if (form === null) return;

    try {
      const formData = new FormData(form);

      const descriptionValue = formData.get('description') as string;
      const addressValue = formData.get('address') as string;
      const capacityValue = formData.get('capacity') as string;
      const parentIdValue = formData.get('parent_id') as string;

      // Build area data for API (uses camelCase isActive as expected by backend)
      const areaData = {
        name: formData.get('name') as string,
        description: descriptionValue !== '' ? descriptionValue : undefined,
        type: formData.get('type') as Area['type'],
        capacity: capacityValue !== '' ? Number.parseInt(capacityValue, 10) : undefined,
        address: addressValue !== '' ? addressValue : undefined,
        parent_id: parentIdValue !== '' ? Number.parseInt(parentIdValue, 10) : undefined,
        isActive: (formData.get('status') as string) === 'active',
      } as Partial<Area> & { isActive?: boolean };

      if (this.currentAreaId !== null) {
        // Update existing area
        await this.api.update(this.currentAreaId, areaData);
      } else {
        // Create new area
        await this.api.create(areaData);
      }

      closeAreaModal();
      await this.loadAreas();
    } catch (error) {
      console.error('Error saving area:', error);
      showErrorAlert('Fehler beim Speichern des Bereichs');
    }
  }

  /**
   * Initialize toggle group for status filtering
   */
  private initToggleGroup(): void {
    const toggleGroup = document.querySelector('#area-status-toggle');
    if (toggleGroup === null) return;

    toggleGroup.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest<HTMLElement>('.toggle-group__btn');
      if (button === null) return;

      // Update active state
      toggleGroup.querySelectorAll('.toggle-group__btn').forEach((btn) => {
        btn.classList.remove('active');
      });
      button.classList.add('active');

      // Filter areas by status
      const status = button.dataset.status as 'active' | 'inactive' | 'all';
      this.filterByStatus(status);
    });
  }

  /**
   * Initialize search input with debouncing
   */
  private initSearchInput(): void {
    const searchInput = document.querySelector<HTMLInputElement>('#area-search');
    const clearButton = document.querySelector('#area-search-clear');
    const searchContainer = document.querySelector('#area-search-container');

    if (searchInput === null) return;

    let debounceTimer: NodeJS.Timeout;

    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim();

      // Update container classes for styling
      if (query.length > 0) {
        searchContainer?.classList.add('search-input--has-value');
      } else {
        searchContainer?.classList.remove('search-input--has-value');
      }

      // Debounce search
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.searchAreas(query);
      }, 300);
    });

    // Clear button
    clearButton?.addEventListener('click', () => {
      searchInput.value = '';
      searchContainer?.classList.remove('search-input--has-value');
      this.searchAreas('');
    });
  }

  /**
   * Filter areas by status
   */
  private filterByStatus(status: 'active' | 'inactive' | 'all'): void {
    console.log('[AREAS] filterByStatus called with status:', status);
    console.log('[AREAS] Total areas to filter:', this.areas.length);

    let filtered: Area[];

    if (status === 'all') {
      filtered = this.areas;
    } else {
      const isActive = status === 'active' ? 1 : 0;
      console.log('[AREAS] Looking for is_active =', isActive);
      filtered = this.areas.filter((area) => {
        console.log(
          '[AREAS] Area',
          area.name,
          '- is_active:',
          area.is_active,
          'type:',
          typeof area.is_active,
          'match:',
          area.is_active === isActive,
        );
        return area.is_active === isActive;
      });
    }

    console.log('[AREAS] Filtered areas count:', filtered.length);
    this.renderFilteredAreas(filtered);
  }

  /**
   * Search areas by name, description, address, type
   */
  private searchAreas(query: string): void {
    if (query === '') {
      // Close search results dropdown
      closeSearchResults();
      // Get current status filter
      const activeButton = document.querySelector('#area-status-toggle .toggle-group__btn.active');
      const status = (activeButton?.getAttribute('data-status') ?? 'active') as 'active' | 'inactive' | 'all';
      this.filterByStatus(status);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = this.areas.filter((area) => {
      return (
        area.name.toLowerCase().includes(lowerQuery) ||
        area.description?.toLowerCase().includes(lowerQuery) === true ||
        area.address?.toLowerCase().includes(lowerQuery) === true ||
        area.type.toLowerCase().includes(lowerQuery)
      );
    });

    // Show search results dropdown
    renderSearchResults(filtered, query);

    // Also update table
    this.renderFilteredAreas(filtered);
  }

  /**
   * Render filtered areas
   */
  private renderFilteredAreas(filtered: Area[]): void {
    if (filtered.length === 0) {
      toggleTableVisibility(false);
      return;
    }

    toggleTableVisibility(true);
    renderAreasTable(filtered);
  }

  /**
   * Show delete confirmation modal
   */
  showConfirmDeleteModal(id: number): void {
    const area = this.areas.find((a) => a.id === id);
    if (area === undefined) return;

    showDeleteModal(id, area.name);
  }

  /**
   * Confirm delete area (first attempt without force)
   */
  async confirmDeleteArea(id: number): Promise<void> {
    try {
      await this.api.delete(id);
      await this.handleDeleteSuccess();
    } catch (error) {
      const errorObj = error as { message?: string; code?: string; details?: Record<string, unknown> };

      if (
        errorObj.code === 'HAS_DEPENDENCIES' ||
        errorObj.message?.includes('dependencies') === true ||
        errorObj.message?.includes('Abhängigkeiten') === true
      ) {
        const details = errorObj.details ?? {};
        const totalDependencies = typeof details.totalDependencies === 'number' ? details.totalDependencies : 0;
        this.showForceDeleteWarning(id, totalDependencies, details);
      } else {
        this.handleDeleteError(error);
      }
    }
  }

  /**
   * Delete area (without force - will be called by confirm button)
   */
  async deleteArea(id: number): Promise<void> {
    await this.confirmDeleteArea(id);
  }

  /**
   * Handle successful deletion
   */
  private async handleDeleteSuccess(): Promise<void> {
    showSuccessAlert('Bereich erfolgreich gelöscht');
    closeDeleteModal();
    await this.loadAreas();
  }

  /**
   * Build dependency message from details object
   */
  private buildDependencyMessage(details: Record<string, unknown>): string {
    // Static list of dependencies (safe from injection - keys are constants)
    const dependencies = [
      { key: 'childAreas' as const, label: 'Unterbereiche' },
      { key: 'departments' as const, label: 'Abteilungen' },
      { key: 'machines' as const, label: 'Maschinen' },
      { key: 'shifts' as const, label: 'Schichten' },
      { key: 'shiftPlans' as const, label: 'Schichtpläne' },
      { key: 'shiftFavorites' as const, label: 'Favoriten' },
    ] as const;

    const messages = dependencies
      .map(({ key, label }) => {
        // Safe: key is a compile-time constant from static array above
        // eslint-disable-next-line security/detect-object-injection
        const count = details[key];
        return typeof count === 'number' && count > 0 ? `${count} ${label}` : null;
      })
      .filter((msg): msg is string => msg !== null);

    return messages.join(', ');
  }

  /**
   * Show force delete warning modal
   */
  private showForceDeleteWarning(id: number, totalDependencies: number, details: Record<string, unknown>): void {
    const modal = document.querySelector('#force-delete-warning-modal');
    const messageEl = document.querySelector('#force-delete-warning-message');
    const areaIdInput = document.querySelector<HTMLInputElement>('#force-delete-area-id');

    if (modal === null || messageEl === null || areaIdInput === null) {
      showErrorAlert('Force-Delete-Modal nicht gefunden');
      return;
    }

    const dependencyList = this.buildDependencyMessage(details);
    const message = `Dieser Bereich wird von ${totalDependencies} ${totalDependencies === 1 ? 'Element' : 'Elementen'} verwendet (${dependencyList}). Möchten Sie den Bereich trotzdem löschen? Alle Zuordnungen werden automatisch entfernt.`;

    messageEl.textContent = message;
    areaIdInput.value = id.toString();

    // Close the first delete modal and show warning modal
    closeDeleteModal();
    modal.classList.add('modal-overlay--active');
  }

  /**
   * Close force delete modal
   */
  private closeForceDeleteModal(): void {
    const modal = document.querySelector('#force-delete-warning-modal');
    if (modal) {
      modal.classList.remove('modal-overlay--active');
    }
  }

  /**
   * Execute force delete (with force=true parameter)
   */
  async executeForceDelete(id: number): Promise<void> {
    try {
      // Delete with force=true query parameter
      await this.api.delete(id, true);

      showSuccessAlert('Bereich und alle Zuordnungen erfolgreich gelöscht');
      this.closeForceDeleteModal();
      await this.loadAreas();
    } catch (error) {
      console.error('Error force deleting area:', error);
      showErrorAlert('Fehler beim Löschen des Bereichs');
      this.closeForceDeleteModal();
    }
  }

  /**
   * Handle delete errors
   */
  private handleDeleteError(error: unknown): void {
    const errorObj = error as { message?: string; code?: string };

    if (errorObj.code === 'FOREIGN_KEY_CONSTRAINT' || errorObj.message?.includes('foreign key') === true) {
      showErrorAlert(
        'Bereich kann nicht gelöscht werden, da noch Zuordnungen existieren. Bitte kontaktieren Sie den Administrator.',
      );
    } else {
      console.error('Error deleting area:', error);
      showErrorAlert('Fehler beim Löschen des Bereichs');
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new AreasManager();
});
