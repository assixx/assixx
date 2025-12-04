/* eslint-disable max-lines */
/**
 * Admin Teams Management
 * Handles team CRUD operations for admin dashboard
 *
 * Migration Complete: 2025-01-28
 * - Filter Buttons → Toggle Group (Design System)
 * - Search Input → Design System Component with clear button and results dropdown
 * - Modal Toggle → modal-overlay--active (Design System)
 * - Dropdowns → .active class toggle (Design System)
 */

import { ApiClient } from '../../../utils/api-client';
import { showSuccessAlert, showErrorAlert } from '../../utils/alerts';
import type { Team, WindowWithTeamHandlers } from './types';
import { toggleTableVisibility, createTeamRow } from './ui';
import { setTeamsManager } from './data';
import { setupEditTeam, setupDeleteTeam, setupShowTeamModal, setupCloseTeamModal, setupSaveTeam } from './forms';

// Constants
const DELETE_TEAM_MODAL_ID = '#delete-team-modal';
const MODAL_ACTIVE_CLASS = 'modal-overlay--active';

class TeamsManager {
  public apiClient: ApiClient; // Made public for access in global functions
  private teams: Team[] = [];
  private filteredTeams: Team[] = [];
  private currentFilter: 'all' | 'active' | 'inactive' | 'archived' = 'active'; // Default to active
  private searchTerm = '';

  constructor() {
    this.apiClient = ApiClient.getInstance();
    // Always use API v2 (v1 removed)
    this.initializeEventListeners();
    // Load teams initially
    void this.loadTeams();
  }

  private initializeEventListeners() {
    // Add button
    document.querySelector('#add-team-btn')?.addEventListener('click', () => {
      void (window as WindowWithTeamHandlers).showTeamModal?.();
    });

    // Empty state add button
    document.querySelector('#empty-state-add-btn')?.addEventListener('click', () => {
      void (window as WindowWithTeamHandlers).showTeamModal?.();
    });

    // Modal close buttons
    document.querySelector('#close-team-modal')?.addEventListener('click', () => {
      (window as WindowWithTeamHandlers).closeTeamModal?.();
    });
    document.querySelector('#cancel-team-modal')?.addEventListener('click', () => {
      (window as WindowWithTeamHandlers).closeTeamModal?.();
    });

    // Form submit
    document.querySelector('#team-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      void (window as WindowWithTeamHandlers).saveTeam?.();
    });

    // Double-check delete pattern (Step 1 + Step 2)
    this.initDeleteConfirmation();

    // Force Delete Warning Modal
    document.querySelector('#confirm-force-delete')?.addEventListener('click', () => {
      const teamIdInput = document.querySelector<HTMLInputElement>('#force-delete-team-id');
      if (teamIdInput !== null && teamIdInput.value !== '') {
        void this.executeForceDelete(Number.parseInt(teamIdInput.value, 10));
      }
    });
    document.querySelector('#cancel-force-delete')?.addEventListener('click', () => {
      this.closeForceDeleteModal();
    });
    // Close force delete modal when clicking outside
    document.querySelector('#force-delete-warning-modal')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'force-delete-warning-modal') {
        this.closeForceDeleteModal();
      }
    });

    // Toggle Group - Status Filter (Design System)
    this.initStatusToggle();

    // Search Input (Design System)
    this.initSearchInput();

    // Event delegation for team actions
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      this.handleTeamAction(target);
    });
  }

  /**
   * Initialize delete confirmation buttons (double-check pattern)
   */
  private initDeleteConfirmation(): void {
    // Delete Modal Step 1: Close buttons
    document.querySelector('#close-delete-modal')?.addEventListener('click', () => {
      const modal = document.querySelector(DELETE_TEAM_MODAL_ID);
      if (modal) modal.classList.remove(MODAL_ACTIVE_CLASS);
    });
    document.querySelector('#cancel-delete-modal')?.addEventListener('click', () => {
      const modal = document.querySelector(DELETE_TEAM_MODAL_ID);
      if (modal) modal.classList.remove(MODAL_ACTIVE_CLASS);
    });

    // Delete Modal Step 1: Proceed to second confirmation
    document.querySelector('#proceed-delete-team')?.addEventListener('click', () => {
      const firstModal = document.querySelector(DELETE_TEAM_MODAL_ID);
      if (firstModal) firstModal.classList.remove(MODAL_ACTIVE_CLASS);
      const confirmModal = document.querySelector('#delete-team-confirm-modal');
      confirmModal?.classList.add(MODAL_ACTIVE_CLASS);
    });

    // Delete Modal Step 2: Cancel button
    document.querySelector('#cancel-delete-confirm')?.addEventListener('click', () => {
      const confirmModal = document.querySelector('#delete-team-confirm-modal');
      confirmModal?.classList.remove(MODAL_ACTIVE_CLASS);
    });

    // Delete Modal Step 2: Final confirmation - actually delete
    document.querySelector('#confirm-delete-team-final')?.addEventListener('click', () => {
      const deleteInput = document.querySelector<HTMLInputElement>('#delete-team-id');
      if (deleteInput !== null && deleteInput.value !== '') {
        const confirmModal = document.querySelector('#delete-team-confirm-modal');
        confirmModal?.classList.remove(MODAL_ACTIVE_CLASS);
        void this.confirmDeleteTeam(Number.parseInt(deleteInput.value, 10));
      }
    });
  }

  /**
   * Initialize status toggle buttons (Design System Toggle Group)
   */
  private initStatusToggle(): void {
    const toggleGroup = document.querySelector('#team-status-toggle');
    if (toggleGroup === null) {
      console.warn('[initStatusToggle] Toggle group not found');
      return;
    }

    toggleGroup.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest<HTMLElement>('.toggle-group__btn');
      if (button === null) return;

      const status = button.dataset['status'] as 'all' | 'active' | 'inactive' | undefined;
      if (status === undefined) return;

      // Update active button
      toggleGroup.querySelectorAll('.toggle-group__btn').forEach((btn) => {
        btn.classList.remove('active');
      });
      button.classList.add('active');

      // Update filter and re-render
      this.currentFilter = status;
      this.filterAndRenderTeams();
    });
  }

  /**
   * Initialize search input with live search (Design System)
   */
  private initSearchInput(): void {
    const searchInput = document.querySelector('#team-search');
    const searchContainer = document.querySelector('#team-search-container');
    const clearButton = document.querySelector('#team-search-clear');
    const resultsContainer = document.querySelector('#team-search-results');

    if (searchInput === null || !(searchInput instanceof HTMLInputElement)) {
      console.warn('[initSearchInput] Search input not found');
      return;
    }

    // Input event - live search
    searchInput.addEventListener('input', () => {
      const query = searchInput.value;
      this.searchTerm = query;

      // Toggle has-value class
      if (query.length > 0) {
        searchContainer?.classList.add('search-input--has-value');
      } else {
        searchContainer?.classList.remove('search-input--has-value');
      }

      // Apply filters and re-render
      this.filterAndRenderTeams();

      // Render search results preview
      if (query.length > 0 && resultsContainer !== null) {
        this.renderSearchResults(this.filteredTeams);
      } else {
        this.closeSearchResults();
      }
    });

    // Clear button
    clearButton?.addEventListener('click', () => {
      searchInput.value = '';
      this.searchTerm = '';
      searchContainer?.classList.remove('search-input--has-value');
      this.filterAndRenderTeams();
      this.closeSearchResults();
      searchInput.focus();
    });

    // Close results on outside click
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (
        searchContainer !== null &&
        !searchContainer.contains(target) &&
        resultsContainer !== null &&
        !resultsContainer.contains(target)
      ) {
        this.closeSearchResults();
      }
    });
  }

  /**
   * Render search results preview dropdown
   */
  private renderSearchResults(teams: Team[]): void {
    const resultsContainer = document.querySelector('#team-search-results');
    if (resultsContainer === null) return;

    const limitedResults = teams.slice(0, 5); // Max 5 results

    if (limitedResults.length === 0) {
      resultsContainer.innerHTML = `
        <div class="search-input__result-item search-input__result-item--empty">
          Keine Teams gefunden
        </div>
      `;
      resultsContainer.classList.add('active');
      return;
    }

    const html = limitedResults
      .map(
        (team) => `
        <div class="search-input__result-item" data-action="edit-team" data-team-id="${team.id}">
          <i class="fas fa-users-cog text-blue-500"></i>
          <span>${team.name}</span>
          ${team.departmentName !== undefined && team.departmentName !== '' ? `<span class="text-[var(--color-text-secondary)] text-sm ml-2">→ ${team.departmentName}</span>` : ''}
        </div>
      `,
      )
      .join('');

    // eslint-disable-next-line no-unsanitized/property -- Safe: We control all data in html
    resultsContainer.innerHTML = html;
    resultsContainer.classList.add('active');

    // Handle result click - open edit modal
    resultsContainer.querySelectorAll('.search-input__result-item').forEach((item) => {
      item.addEventListener('click', () => {
        const teamId = (item as HTMLElement).dataset['teamId'];
        if (teamId !== undefined && teamId !== '') {
          const w = window as unknown as WindowWithTeamHandlers;
          if (w.editTeam !== undefined) {
            void w.editTeam(Number.parseInt(teamId, 10));
          }
          this.closeSearchResults();

          // Clear search input
          const searchInput = document.querySelector<HTMLInputElement>('#team-search-input');
          const searchContainer = document.querySelector<HTMLElement>('.search-input-wrapper');
          if (searchInput !== null) {
            searchInput.value = '';
          }
          if (searchContainer !== null) {
            searchContainer.classList.remove('search-input--has-value');
          }
        }
      });
    });
  }

  /**
   * Close search results dropdown
   */
  private closeSearchResults(): void {
    const resultsContainer = document.querySelector('#team-search-results');
    resultsContainer?.classList.remove('active');
  }

  /**
   * Filter teams by status and search term
   * UPDATED: Using unified isActive status (2025-12-02)
   * Status: 0=inactive, 1=active, 3=archived, 4=deleted
   */
  private filterTeams(): Team[] {
    let filtered = this.teams;

    // Filter by unified isActive status
    switch (this.currentFilter) {
      case 'active':
        filtered = filtered.filter((team) => team.isActive === 1);
        break;
      case 'inactive':
        filtered = filtered.filter((team) => team.isActive === 0);
        break;
      case 'archived':
        filtered = filtered.filter((team) => team.isActive === 3);
        break;
      case 'all':
      default:
        // Show all except deleted (isActive !== 4)
        filtered = filtered.filter((team) => team.isActive !== 4);
        break;
    }

    // Filter by search term
    if (this.searchTerm.length > 0) {
      const searchLower = this.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (team) =>
          team.name.toLowerCase().includes(searchLower) ||
          (team.departmentName?.toLowerCase().includes(searchLower) ?? false) ||
          (team.leaderName?.toLowerCase().includes(searchLower) ?? false),
      );
    }

    return filtered;
  }

  /**
   * Filter and render teams
   */
  private filterAndRenderTeams(): void {
    this.filteredTeams = this.filterTeams();
    this.renderTeamsTable();
  }

  private handleDropdownToggle(target: HTMLElement): void {
    const dropdownTrigger = target.closest<HTMLElement>('.dropdown__trigger');
    if (!dropdownTrigger) return;

    const dropdown = dropdownTrigger.parentElement;
    if (!dropdown) return;

    const menu = dropdown.querySelector('.dropdown__menu');
    if (!menu) return;

    // Toggle active class
    menu.classList.toggle('active');

    // Close other dropdowns
    document.querySelectorAll('.dropdown__menu.active').forEach((otherMenu) => {
      if (otherMenu !== menu) {
        otherMenu.classList.remove('active');
      }
    });
  }

  private handleEditTeam(target: HTMLElement, w: WindowWithTeamHandlers): void {
    const editBtn = target.closest<HTMLElement>('[data-action="edit-team"]');
    if (!editBtn) return;

    const teamId = editBtn.dataset['teamId'];
    if (teamId !== undefined && w.editTeam) {
      void w.editTeam(Number.parseInt(teamId, 10));
    }
  }

  private handleDeleteTeam(target: HTMLElement, w: WindowWithTeamHandlers): void {
    const deleteBtn = target.closest<HTMLElement>('[data-action="delete-team"]');
    if (!deleteBtn) return;

    const teamId = deleteBtn.dataset['teamId'];
    if (teamId !== undefined && w.deleteTeam) {
      w.deleteTeam(Number.parseInt(teamId, 10));
    }
  }

  private handleTeamAction(target: HTMLElement): void {
    const w = window as WindowWithTeamHandlers;

    this.handleDropdownToggle(target);
    this.handleEditTeam(target, w);
    this.handleDeleteTeam(target, w);
  }

  async loadTeams(): Promise<void> {
    try {
      // Show loading
      const loadingEl = document.querySelector('#teams-loading');
      loadingEl?.classList.remove('u-hidden');

      // ApiClient adds /api/v2 prefix automatically
      // Backend already returns camelCase via fieldMapping
      const response = await this.apiClient.request<Team[]>('/teams', {
        method: 'GET',
      });

      // Hide loading
      loadingEl?.classList.add('u-hidden');

      this.teams = response;

      this.filterAndRenderTeams();
    } catch (error) {
      // Hide loading
      const loadingEl = document.querySelector('#teams-loading');
      loadingEl?.classList.add('u-hidden');

      console.error('Error loading teams:', error);
      showErrorAlert('Fehler beim Laden der Teams');
    }
  }

  private renderTeamsTable() {
    const tableContent = document.querySelector('#teams-table-content');
    if (tableContent === null) return;

    if (this.filteredTeams.length === 0) {
      toggleTableVisibility(false, this.currentFilter);
      tableContent.innerHTML = '';
      return;
    }

    toggleTableVisibility(true, this.currentFilter);

    const tableHTML = `
      <div class="table-responsive">
        <table class="data-table data-table--striped">
          <thead>
            <tr>
              <th>Name</th>
              <th>Abteilung</th>
              <th>Team-Lead</th>
              <th>Mitglieder</th>
              <th>Maschinen</th>
              <th>Status</th>
              <th>Erstellt am</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${this.filteredTeams.map((team) => createTeamRow(team)).join('')}
          </tbody>
        </table>
      </div>
    `;

    // eslint-disable-next-line no-unsanitized/property -- Safe: We control all data in tableHTML
    tableContent.innerHTML = tableHTML;

    // Initialize tooltips after rendering table
    initDataTooltips();
  }

  async createTeam(teamData: Partial<Team>): Promise<Team> {
    try {
      const response = await this.apiClient.request<Team>('/teams', {
        method: 'POST',
        body: JSON.stringify(teamData),
      });

      showSuccessAlert('Team erfolgreich erstellt');
      await this.loadTeams();
      return response;
    } catch (error) {
      console.error('Error creating team:', error);
      showErrorAlert('Fehler beim Erstellen des Teams');
      throw error;
    }
  }

  async updateTeam(id: number, teamData: Partial<Team>): Promise<Team> {
    try {
      const response = await this.apiClient.request<Team>(`/teams/${id}`, {
        method: 'PUT',
        body: JSON.stringify(teamData),
      });

      showSuccessAlert('Team erfolgreich aktualisiert');
      await this.loadTeams();
      return response;
    } catch (error) {
      console.error('Error updating team:', error);
      showErrorAlert('Fehler beim Aktualisieren des Teams');
      throw error;
    }
  }

  deleteTeam(id: number): void {
    // Show confirmation modal
    const modal = document.querySelector(DELETE_TEAM_MODAL_ID);
    const deleteInput = document.querySelector<HTMLInputElement>('#delete-team-id');

    if (modal === null || deleteInput === null) {
      showErrorAlert('Löschbestätigungs-Modal nicht gefunden');
      return;
    }

    // Set the team ID in the hidden input
    deleteInput.value = id.toString();

    // Show the modal
    modal.classList.add(MODAL_ACTIVE_CLASS);
  }

  private closeDeleteModal(): void {
    const modal = document.querySelector(DELETE_TEAM_MODAL_ID);
    if (modal) {
      modal.classList.remove(MODAL_ACTIVE_CLASS);
    }
  }

  private async handleDeleteSuccess(): Promise<void> {
    showSuccessAlert('Team erfolgreich gelöscht');
    this.closeDeleteModal();
    await this.loadTeams();
  }

  private showForceDeleteWarning(id: number, memberCount: number | string): void {
    const modal = document.querySelector('#force-delete-warning-modal');
    const messageEl = document.querySelector('#force-delete-warning-message');
    const teamIdInput = document.querySelector<HTMLInputElement>('#force-delete-team-id');

    if (modal === null || messageEl === null || teamIdInput === null) {
      showErrorAlert('Force-Delete-Modal nicht gefunden');
      return;
    }

    // Update message with member count
    const message = `Das Team hat ${memberCount} Mitglieder. Möchten Sie das Team trotzdem löschen? Alle Mitglieder werden automatisch aus dem Team entfernt.`;
    messageEl.textContent = message;

    // Store team ID
    teamIdInput.value = id.toString();

    // Close the first delete modal and show warning modal
    this.closeDeleteModal();
    modal.classList.add(MODAL_ACTIVE_CLASS);
  }

  private closeForceDeleteModal(): void {
    const modal = document.querySelector('#force-delete-warning-modal');
    if (modal) {
      modal.classList.remove(MODAL_ACTIVE_CLASS);
    }
  }

  async executeForceDelete(id: number): Promise<void> {
    try {
      await this.apiClient.request(`/teams/${id}?force=true`, {
        method: 'DELETE',
      });

      showSuccessAlert('Team und alle Mitgliederzuordnungen erfolgreich gelöscht');
      this.closeForceDeleteModal();
      await this.loadTeams();
    } catch (error) {
      console.error('Error force deleting team:', error);
      showErrorAlert('Fehler beim Löschen des Teams');
      this.closeForceDeleteModal();
    }
  }

  private handleDeleteError(error: unknown): void {
    const errorObj = error as { message?: string; code?: string };

    if (
      errorObj.code === 'FOREIGN_KEY_CONSTRAINT' ||
      errorObj.message?.includes('foreign key') === true ||
      errorObj.message?.includes('Cannot delete team with machines') === true
    ) {
      showErrorAlert('Team kann nicht gelöscht werden, da noch Zuordnungen (Maschinen) existieren');
    } else {
      console.error('Error deleting team:', error);
      showErrorAlert('Fehler beim Löschen des Teams');
    }
  }

  async confirmDeleteTeam(id: number): Promise<void> {
    try {
      await this.apiClient.request(`/teams/${id}`, {
        method: 'DELETE',
      });
      await this.handleDeleteSuccess();
    } catch (error) {
      const errorObj = error as { message?: string; code?: string; details?: { memberCount?: number } };

      if (errorObj.message?.includes('Cannot delete team with members') === true) {
        const memberCount = errorObj.details?.memberCount ?? 'einige';
        this.showForceDeleteWarning(id, memberCount);
      } else {
        this.handleDeleteError(error);
      }
    }
  }

  async getTeamDetails(id: number): Promise<Team | null> {
    try {
      return await this.apiClient.request<Team>(`/teams/${id}`, {
        method: 'GET',
      });
    } catch (error) {
      console.error('Error getting team details:', error);
      showErrorAlert('Fehler beim Laden der Teamdetails');
      return null;
    }
  }
}

// Initialize when DOM is ready
let teamsManager: TeamsManager | null = null;

document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if we're on the manage-teams page
  if (window.location.pathname === '/manage-teams' || window.location.pathname.includes('manage-teams')) {
    teamsManager = new TeamsManager();

    // Make teamsManager available to data.ts and forms.ts
    setTeamsManager(teamsManager);

    // Setup all window handlers
    setupEditTeam();
    setupDeleteTeam();
    setupShowTeamModal();
    setupCloseTeamModal();
    setupSaveTeam();
  }
});

/**
 * Initialize Design System tooltips from data-tooltip attributes
 * Converts data-tooltip="text" to proper tooltip HTML structure
 */
function initDataTooltips(): void {
  const elements = document.querySelectorAll('[data-tooltip]');

  elements.forEach((element) => {
    const tooltipText = element.getAttribute('data-tooltip');

    if (tooltipText === null || tooltipText === '') {
      return;
    }

    // CRITICAL: Inside scroll containers (overflow:auto), position:absolute tooltips
    // will ALWAYS be clipped - no matter if top or bottom.
    // Solution: Use native title attribute which browser renders outside any container
    const isInsideScrollContainer = element.closest('.table-responsive') !== null;

    if (isInsideScrollContainer) {
      // Use native title - browser handles positioning, never clipped
      element.setAttribute('title', tooltipText);
      element.removeAttribute('data-tooltip');
      return;
    }

    // For elements NOT in scroll containers: use custom tooltip
    const tooltipPosition = element.getAttribute('data-tooltip-position') ?? 'top';

    // Wrap element if not already wrapped
    const isAlreadyWrapped = element.parentElement?.classList.contains('tooltip') ?? false;

    if (!isAlreadyWrapped) {
      const wrapper = document.createElement('div');
      wrapper.className = 'tooltip';

      // Replace element with wrapper using element.before()
      element.before(wrapper);
      wrapper.appendChild(element);

      // Create tooltip content
      const tooltipContent = document.createElement('div');
      tooltipContent.className = `tooltip__content tooltip__content--${tooltipPosition} tooltip__content--multiline`;
      tooltipContent.setAttribute('role', 'tooltip');
      // Use textContent for multiline support - preserves newlines
      tooltipContent.textContent = tooltipText;

      wrapper.appendChild(tooltipContent);
    }
  });
}

export { TeamsManager };
