/**
 * KVP Data Module
 * Handles data fetching, processing, and rendering of suggestions
 */

import { $$, setHTML } from '../../utils/dom-utils';
import { KvpApiService } from './api';
import type { User, KvpSuggestion, KvpCategory, Department, StatsResponse, V1Status, V2Status } from './types';

export class KvpDataManager {
  private apiService: KvpApiService;
  private currentUser: User | null;
  private currentFilter: string;

  public suggestions: KvpSuggestion[] = [];
  public categories: KvpCategory[] = [];
  public departments: Department[] = [];

  constructor(apiService: KvpApiService, currentUser: User | null, currentFilter: string) {
    this.apiService = apiService;
    this.currentUser = currentUser;
    this.currentFilter = currentFilter;
  }

  /**
   * Load categories from API and populate dropdown
   */
  async loadCategories(): Promise<void> {
    try {
      this.categories = await this.apiService.loadCategories();

      // Populate category dropdown (Design System)
      const categoryDropdown = document.querySelector('#categoryDropdown');
      if (categoryDropdown) {
        // Keep the first "Alle Kategorien" option
        const firstOption = categoryDropdown.querySelector('.dropdown__option');
        setHTML(categoryDropdown as HTMLElement, '');
        if (firstOption) categoryDropdown.append(firstOption);

        // Add categories with Design System classes
        this.categories.forEach((category) => {
          const option = document.createElement('div');
          option.className = 'dropdown__option';
          option.dataset.action = 'select-category';
          option.dataset.value = category.id.toString();
          option.textContent = category.name;
          categoryDropdown.append(option);
        });
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  /**
   * Load departments from API and populate dropdown (admin only)
   */
  async loadDepartments(effectiveRole: string): Promise<void> {
    if (effectiveRole === 'employee') return;

    try {
      this.departments = await this.apiService.loadDepartments();

      // Populate department dropdown (Design System)
      const departmentDropdown = document.querySelector('#departmentDropdown');
      if (departmentDropdown) {
        // Keep the first "Alle Abteilungen" option
        const firstOption = departmentDropdown.querySelector('.dropdown__option');
        setHTML(departmentDropdown as HTMLElement, '');
        if (firstOption) departmentDropdown.append(firstOption);

        // Add departments with Design System classes
        this.departments.forEach((dept) => {
          const option = document.createElement('div');
          option.className = 'dropdown__option';
          option.dataset.action = 'select-department';
          option.dataset.value = dept.id.toString();
          option.textContent = dept.name;
          departmentDropdown.append(option);
        });
      }
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  }

  /**
   * Load suggestions from API with filters
   */
  async loadSuggestions(
    getFilterValues: () => { status: string; category: string; department: string; search: string },
  ): Promise<void> {
    try {
      const params = this.buildSuggestionParams(getFilterValues);
      const suggestions = await this.apiService.fetchSuggestions(params);

      this.suggestions = suggestions;
      this.renderSuggestions();
      this.updateBadges();
    } catch (error) {
      console.error('Error loading suggestions:', error);
      throw error;
    }
  }

  /**
   * Get API field name based on v1/v2 version
   */
  private getFieldName(v2Name: string, v1Name: string): string {
    return this.apiService.useV2API ? v2Name : v1Name;
  }

  /**
   * Build URL search params for API request
   */
  private buildSuggestionParams(
    getFilterValues: () => { status: string; category: string; department: string; search: string },
  ): URLSearchParams {
    const params = new URLSearchParams({
      filter: this.currentFilter,
    });

    const filters = getFilterValues();

    if (filters.status !== '') params.append('status', filters.status);
    if (filters.category !== '') {
      params.append(this.getFieldName('categoryId', 'category_id'), filters.category);
    }
    if (filters.department !== '') {
      params.append(this.getFieldName('departmentId', 'department_id'), filters.department);
    }
    if (filters.search !== '') params.append('search', filters.search);

    if (this.currentFilter === 'archived') {
      params.append(this.getFieldName('includeArchived', 'include_archived'), 'true');
    }

    return params;
  }

  /**
   * Render suggestions to the DOM
   */
  renderSuggestions(): void {
    const container = $$('#suggestionsContainer');
    const emptyState = $$('#emptyState');

    if (!container || !emptyState) return;

    if (this.suggestions.length === 0) {
      setHTML(container, '');
      emptyState.removeAttribute('hidden');
      return;
    }

    emptyState.setAttribute('hidden', '');

    const suggestionsHTML = this.suggestions.map((s) => this.renderSuggestionCard(s)).join('');
    setHTML(container, suggestionsHTML);
  }

  /**
   * Render a single suggestion card
   */
  private renderSuggestionCard(suggestion: KvpSuggestion): string {
    const statusClass = suggestion.status.replace('_', '');
    const { icon: visibilityIcon, text: visibilityText } = this.getVisibilityInfo(suggestion);
    const attachmentSpan =
      suggestion.attachmentCount !== undefined && suggestion.attachmentCount > 0
        ? `<span><i class="fas fa-camera"></i> ${suggestion.attachmentCount} Foto${suggestion.attachmentCount > 1 ? 's' : ''}</span>`
        : '';
    const sharedSpan =
      suggestion.sharedByName !== undefined && suggestion.sharedByName !== ''
        ? `<span> - Geteilt von ${suggestion.sharedByName}</span>`
        : '';

    return `
      <div class="custom-glass-card kvp-card" data-id="${suggestion.id}">
        <div class="status-badge ${statusClass}">${this.getStatusText(suggestion.status)}</div>
        <div class="suggestion-header">
          <h3 class="suggestion-title">${this.escapeHtml(suggestion.title)}</h3>
          <div class="suggestion-meta">
            <span><i class="fas fa-user"></i> ${suggestion.submittedByName} ${suggestion.submittedByLastname}</span>
            <span><i class="fas fa-calendar"></i> ${new Date(suggestion.createdAt).toLocaleDateString('de-DE')}</span>
            ${attachmentSpan}
          </div>
          <div class="visibility-badge ${suggestion.orgLevel}">
            <i class="fas ${visibilityIcon}"></i> ${visibilityText}${sharedSpan}
          </div>
        </div>
        <div class="suggestion-description">${this.escapeHtml(suggestion.description)}</div>
        <div class="suggestion-footer">
          <div class="category-tag" style="background: ${suggestion.categoryColor}20; color: ${suggestion.categoryColor}; border: 1px solid ${suggestion.categoryColor};">
            ${suggestion.categoryIcon}
            ${suggestion.categoryName}
          </div>
          <div class="action-buttons" data-suggestion-id="${suggestion.id}">
            <!-- Action buttons populated dynamically -->
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get visibility info for suggestion
   */
  private getVisibilityInfo(suggestion: KvpSuggestion): { icon: string; text: string } {
    const icon = suggestion.orgLevel === 'company' ? 'fa-globe' : 'fa-users';
    const text =
      suggestion.orgLevel === 'company'
        ? 'Firmenweit'
        : suggestion.orgLevel === 'department' && suggestion.departmentName !== ''
          ? suggestion.departmentName
          : suggestion.teamName !== undefined && suggestion.teamName !== ''
            ? suggestion.teamName
            : 'Team';
    return { icon, text };
  }

  /**
   * Get status text translation
   */
  private getStatusText(status: string): string {
    switch (status) {
      case 'new':
        return 'Neu';
      case 'in_review':
        return 'In Prüfung';
      case 'approved':
        return 'Genehmigt';
      case 'implemented':
        return 'Umgesetzt';
      case 'rejected':
        return 'Abgelehnt';
      case 'archived':
        return 'Archiviert';
      default:
        return status;
    }
  }

  /**
   * Escape HTML for safe rendering
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Update badge counts
   */
  updateBadges(): void {
    // Count suggestions by filter
    const counts = {
      all: this.suggestions.length,
      mine: this.suggestions.filter((s) => s.submittedBy === this.currentUser?.id).length,
      department: this.suggestions.filter((s) => s.orgLevel === 'department').length,
      company: this.suggestions.filter((s) => s.orgLevel === 'company').length,
      archived: this.suggestions.filter((s) => s.status === 'archived').length,
    };

    // Update badge elements
    const badgeAll = $$('#badgeAll');
    const badgeMine = $$('#badgeMine');
    const badgeDepartment = $$('#badgeDepartment');
    const badgeCompany = $$('#badgeCompany');
    const badgeArchived = $$('#badgeArchived');

    if (badgeAll) badgeAll.textContent = counts.all.toString();
    if (badgeMine) badgeMine.textContent = counts.mine.toString();
    if (badgeDepartment) badgeDepartment.textContent = counts.department.toString();
    if (badgeCompany) badgeCompany.textContent = counts.company.toString();
    if (badgeArchived) badgeArchived.textContent = counts.archived.toString();
  }

  /**
   * Load and display statistics (admin only)
   */
  async loadStatistics(): Promise<void> {
    try {
      const statsData = await this.apiService.fetchStatistics();
      const data = this.apiService.normalizeStatsData(statsData);
      this.updateStatisticsDisplay(data);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  }

  /**
   * Update statistics display in DOM
   */
  private updateStatisticsDisplay(data: StatsResponse): void {
    const totalEl = $$('#totalSuggestions');
    const openEl = $$('#openSuggestions');
    const implementedEl = $$('#implementedSuggestions');
    const savingsEl = $$('#totalSavings');

    if (totalEl instanceof HTMLElement && data.company) {
      totalEl.textContent = data.company.total.toString();
    }
    if (openEl instanceof HTMLElement && data.company) {
      const byStatus = data.company.byStatus as V1Status & V2Status;
      const newCount = byStatus.new ?? 0;
      const inReviewCount = byStatus.inReview ?? byStatus.in_review ?? 0;
      openEl.textContent = (newCount + inReviewCount).toString();
    }
    if (implementedEl instanceof HTMLElement && data.company) {
      implementedEl.textContent = (data.company.byStatus.implemented ?? 0).toString();
    }
    if (savingsEl instanceof HTMLElement && data.company) {
      savingsEl.textContent = new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
      }).format(data.company.totalSavings);
    }
  }

  /**
   * Update current filter
   */
  setCurrentFilter(filter: string): void {
    this.currentFilter = filter;
  }
}
