/**
 * KVP Page Main Entry Point
 * Orchestrates all KVP functionality with clean separation of concerns
 *
 * Architecture (Best Practice 2025):
 * - api.ts: API communications
 * - types.ts: Type definitions
 * - ui.ts: UI helpers (dropdown, modal, photos)
 * - data.ts: Data fetching & rendering
 * - forms.ts: Form handling & validation
 * - index.ts: Main orchestrator (this file)
 */

import { $$, setHTML } from '../../utils/dom-utils';
import notificationService from '../services/notification.service';
import { showConfirm } from '../utils/alerts';
import { KvpApiService } from './api';
import { KvpDataManager } from './data';
import { KvpFormsManager } from './forms';
import { kvpUIHelpers } from './ui';
import type { User } from './types';

class KvpPage {
  private apiService: KvpApiService;
  private dataManager: KvpDataManager | null = null;
  private formsManager: KvpFormsManager | null = null;
  private currentUser: User | null = null;
  private currentFilter = 'all';

  constructor() {
    this.apiService = new KvpApiService();
    void this.init();
  }

  /**
   * Initialize KVP page
   */
  private async init(): Promise<void> {
    try {
      // Get current user
      this.currentUser = await this.apiService.getCurrentUser();

      // Initialize managers
      this.dataManager = new KvpDataManager(this.apiService, this.currentUser, this.currentFilter);
      this.formsManager = new KvpFormsManager(this.apiService, this.currentUser, this.dataManager.categories);

      // Setup UI based on role
      this.setupRoleBasedUI();

      // Load initial data
      await Promise.all([
        this.dataManager.loadCategories(),
        this.dataManager.loadDepartments(this.getEffectiveRole()),
        this.loadSuggestions(),
      ]);

      // Update forms manager with loaded categories
      this.formsManager = new KvpFormsManager(this.apiService, this.currentUser, this.dataManager.categories);

      // Setup event listeners
      this.setupEventListeners();

      // Load statistics if admin (but not in employee mode)
      const effectiveRole = this.getEffectiveRole();
      if (effectiveRole === 'admin' || effectiveRole === 'root') {
        void this.dataManager.loadStatistics();
      }
    } catch (error) {
      console.error('Error initializing KVP page:', error);
      this.showError('Fehler beim Laden der Seite');
    }
  }

  /**
   * Get effective role (considering role switch)
   */
  private getEffectiveRole(): string {
    if (!this.currentUser) return 'employee';

    // Check if admin or root has switched to employee role
    if (
      (this.currentUser.role === 'admin' || this.currentUser.role === 'root') &&
      sessionStorage.getItem('roleSwitch') === 'employee'
    ) {
      return 'employee';
    }

    // Check localStorage for activeRole (more reliable for root users)
    const activeRole = localStorage.getItem('activeRole');
    if (activeRole !== null && activeRole !== '' && activeRole !== this.currentUser.role) {
      return activeRole;
    }

    return this.currentUser.role;
  }

  /**
   * Setup UI based on role
   */
  private setupRoleBasedUI(): void {
    if (!this.currentUser) return;

    const effectiveRole = this.getEffectiveRole();
    this.updateBodyClasses(effectiveRole);
    this.configureUIElementsByRole(effectiveRole);
  }

  /**
   * Update body classes for role-based styling
   */
  private updateBodyClasses(effectiveRole: string): void {
    document.body.classList.remove('role-admin', 'role-employee', 'role-root');
    document.body.classList.add(`role-${effectiveRole}`);
  }

  /**
   * Configure UI elements based on role
   */
  private configureUIElementsByRole(effectiveRole: string): void {
    const isAdminOrRoot = effectiveRole === 'admin' || effectiveRole === 'root';
    const isEmployee = effectiveRole === 'employee';

    this.toggleAdminElements(isAdminOrRoot);
    this.toggleCreateButton(isEmployee);
  }

  /**
   * Toggle admin-only elements (only info box and stats, not UI filters)
   */
  private toggleAdminElements(show: boolean): void {
    const adminInfoBox = $$('#adminInfoBox');
    const statsOverview = $$('#statsOverview');

    // Admin Info Box - only for admins
    if (adminInfoBox) {
      if (show) {
        adminInfoBox.removeAttribute('hidden');
      } else {
        adminInfoBox.setAttribute('hidden', '');
      }
    }

    // Stats Overview - only for admins
    if (statsOverview) {
      if (show) {
        statsOverview.removeAttribute('hidden');
      } else {
        statsOverview.setAttribute('hidden', '');
      }
    }
  }

  /**
   * Toggle create button for employees
   */
  private toggleCreateButton(show: boolean): void {
    const createBtn = $$('#createNewBtn');
    if (createBtn) {
      if (show) {
        createBtn.removeAttribute('hidden');
        createBtn.style.display = '';
      } else {
        createBtn.setAttribute('hidden', '');
        createBtn.style.display = 'none';
      }
    }
  }

  /**
   * Load suggestions with current filters
   */
  private async loadSuggestions(): Promise<void> {
    if (!this.dataManager) return;

    try {
      await this.dataManager.loadSuggestions(() => this.getFilterValues());
      this.attachSuggestionEventHandlers();
    } catch (error) {
      console.error('Error loading suggestions:', error);
      this.showError('Fehler beim Laden der Vorschläge');
    }
  }

  /**
   * Get current filter values
   */
  private getFilterValues(): { status: string; category: string; department: string; search: string } {
    const statusFilterEl = $$('#statusFilterValue');
    const categoryFilterEl = $$('#categoryFilterValue');
    const departmentFilterEl = $$('#departmentFilterValue');
    const searchFilterEl = $$('#searchFilter');

    return {
      status: statusFilterEl instanceof HTMLInputElement ? statusFilterEl.value : '',
      category: categoryFilterEl instanceof HTMLInputElement ? categoryFilterEl.value : '',
      department: departmentFilterEl instanceof HTMLInputElement ? departmentFilterEl.value : '',
      search: searchFilterEl instanceof HTMLInputElement ? searchFilterEl.value : '',
    };
  }

  /**
   * Attach event handlers to suggestion cards
   */
  private attachSuggestionEventHandlers(): void {
    const container = $$('#suggestionsContainer');
    if (!container) return;

    // Card click handlers
    container.querySelectorAll('.kvp-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.action-btn')) {
          const cardEl = card as HTMLElement;
          const uuid = cardEl.dataset['uuid']; // NEW: Use UUID instead of numeric ID
          if (uuid !== undefined && uuid !== '') this.viewSuggestion(uuid);
        }
      });
    });

    // Action button handlers
    container.querySelectorAll('[data-suggestion-id]').forEach((actionButtons) => {
      this.renderActionButtonsForSuggestion(actionButtons as HTMLElement);
    });
  }

  /**
   * Render action buttons for a suggestion
   */
  private renderActionButtonsForSuggestion(actionButtons: HTMLElement): void {
    const suggestionId = Number.parseInt(actionButtons.dataset['suggestionId'] ?? '0', 10);
    const suggestion = this.dataManager?.suggestions.find((s) => s.id === suggestionId);
    if (!suggestion || !this.currentUser) return;

    const effectiveRole = this.getEffectiveRole();
    const buttons: string[] = [];

    // View button for all
    buttons.push(`
      <button class="action-btn" data-action="view" data-uuid="${suggestion.uuid}">
        <i class="fas fa-eye"></i> Ansehen
      </button>
    `);

    // Share button for admins (but not in employee mode)
    if ((effectiveRole === 'admin' || effectiveRole === 'root') && suggestion.orgLevel === 'department') {
      buttons.push(`
        <button class="action-btn share" data-action="share" data-id="${suggestion.id}">
          <i class="fas fa-share-alt"></i> Teilen
        </button>
      `);
    }

    // Unshare button for the original sharer (root can always unshare)
    if (
      suggestion.orgLevel === 'company' &&
      (effectiveRole === 'root' || suggestion.sharedBy === this.currentUser.id)
    ) {
      buttons.push(`
        <button class="action-btn" data-action="unshare" data-id="${suggestion.id}">
          <i class="fas fa-undo"></i> Teilen rückgängig
        </button>
      `);
    }

    setHTML(actionButtons, buttons.join(''));

    // Attach click handlers
    actionButtons.querySelectorAll('.action-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const btnEl = btn as HTMLElement;
        const action = btnEl.dataset['action'];
        const uuid = btnEl.dataset['uuid']; // For view action
        const id = btnEl.dataset['id']; // For share/unshare actions

        if (action !== undefined && action !== '') {
          if (action === 'view' && uuid !== undefined && uuid !== '') {
            void this.handleAction(action, uuid);
          } else if (id !== undefined && id !== '') {
            void this.handleAction(action, Number.parseInt(id, 10));
          }
        }
      });
    });
  }

  /**
   * Handle action button clicks
   * @param action - The action to perform (view, share, unshare)
   * @param idOrUuid - Either numeric ID (for share/unshare) or string UUID (for view)
   */
  private async handleAction(action: string, idOrUuid: number | string): Promise<void> {
    switch (action) {
      case 'view':
        this.viewSuggestion(idOrUuid as string);
        break;
      case 'share':
        await this.shareSuggestion(idOrUuid as number);
        break;
      case 'unshare':
        await this.unshareSuggestion(idOrUuid as number);
        break;
    }
  }

  /**
   * View suggestion detail page
   * NEW: Uses UUID for secure, non-guessable URLs
   */
  private viewSuggestion(uuid: string): void {
    window.location.href = `/kvp-detail?uuid=${uuid}`;
  }

  /**
   * Share suggestion company-wide
   */
  private async shareSuggestion(id: number): Promise<void> {
    const confirmed = await showConfirm('Möchten Sie diesen Vorschlag wirklich firmenweit teilen?');
    if (!confirmed) return;

    try {
      await this.apiService.shareSuggestion(id);
      this.showSuccess('Vorschlag wurde firmenweit geteilt');
      await this.loadSuggestions();
    } catch (error) {
      console.error('Error sharing suggestion:', error);
      this.showError('Fehler beim Teilen des Vorschlags');
    }
  }

  /**
   * Unshare suggestion
   */
  private async unshareSuggestion(id: number): Promise<void> {
    const confirmed = await showConfirm(
      'Möchten Sie das Teilen wirklich rückgängig machen? Der Vorschlag wird wieder nur für das ursprüngliche Team sichtbar sein.',
    );
    if (!confirmed) return;

    try {
      await this.apiService.unshareSuggestion(id);
      this.showSuccess('Teilen wurde rückgängig gemacht');
      await this.loadSuggestions();
    } catch (error) {
      console.error('Error unsharing suggestion:', error);
      this.showError('Fehler beim Rückgängigmachen');
    }
  }

  /**
   * Setup all event listeners
   */
  private setupEventListeners(): void {
    this.setupFilterButtons();
    this.setupSecondaryFilters();
    this.setupSearchFilter();
    this.setupKvpCategorySelection();
    this.setupCreateButtons();
  }

  /**
   * Setup filter button listeners (Design System toggle-group)
   */
  private setupFilterButtons(): void {
    document.querySelectorAll('.toggle-group__btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.toggle-group__btn').forEach((b) => {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        if (btn instanceof HTMLElement) {
          this.currentFilter = btn.dataset['filter'] ?? 'all';
          if (this.dataManager) {
            this.dataManager.setCurrentFilter(this.currentFilter);
          }
        }
        void this.loadSuggestions();
      });
    });
  }

  /**
   * Setup secondary filter listeners
   */
  private setupSecondaryFilters(): void {
    ['statusFilterValue', 'categoryFilterValue', 'departmentFilterValue'].forEach((id) => {
      const element = $$(`#${id}`);
      if (element) {
        element.addEventListener('change', () => void this.loadSuggestions());
      }
    });
  }

  /**
   * Setup search filter listener with debounce
   */
  private setupSearchFilter(): void {
    let searchTimeout: number;
    const searchInput = $$('#searchFilter');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = window.setTimeout(() => void this.loadSuggestions(), 300);
      });
    }
  }

  /**
   * Setup KVP category selection in modal
   */
  private setupKvpCategorySelection(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const kvpCategoryOption = target.closest('[data-action="select-kvp-category"]');
      if (kvpCategoryOption instanceof HTMLElement) {
        const value = kvpCategoryOption.dataset['value'];
        const text = kvpCategoryOption.dataset['text'];
        if (value !== undefined && value !== '' && text !== undefined && text !== '') {
          kvpUIHelpers.selectDropdownValue('kvpCategory', value, text);
        }
      }
    });
  }

  /**
   * Setup create button listeners
   */
  private setupCreateButtons(): void {
    const createBtn = $$('#createNewBtn');
    if (createBtn) {
      createBtn.addEventListener('click', () => void this.openCreateModal());
    }

    const createBtnHeader = $$('#createNewBtnHeader');
    if (createBtnHeader) {
      createBtnHeader.addEventListener('click', () => void this.openCreateModal());
    }

    const createForm = $$('#createKvpForm');
    if (createForm !== null) {
      createForm.addEventListener('submit', (e) => {
        e.preventDefault();
        void this.createSuggestion();
      });
    }
  }

  /**
   * Open create modal
   */
  private async openCreateModal(): Promise<void> {
    if (!this.formsManager) return;
    await this.formsManager.openCreateModal(() => this.getEffectiveRole());
  }

  /**
   * Create suggestion from form
   */
  private async createSuggestion(): Promise<void> {
    if (!this.formsManager) return;
    await this.formsManager.createSuggestion(
      () => this.getEffectiveRole(),
      async () => {
        await this.loadSuggestions();
      },
    );
  }

  /**
   * Show success message
   */
  private showSuccess(message: string): void {
    console.info(message);
    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.textContent = message;
    document.body.append(notification);
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    notificationService.error('Fehler', message, 4000);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new KvpPage();
});
