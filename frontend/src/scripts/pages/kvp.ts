/**
 * KVP Page Script
 * Handles KVP suggestions UI and user interactions
 */

import { $$, setHTML } from '../../utils/dom-utils';
import notificationService from '../services/notification.service';
import { showConfirm } from '../utils/alerts';
import { KvpApiService } from './kvp-api';
import type {
  User,
  KvpSuggestion,
  KvpCategory,
  Department,
  KvpWindow,
  V1Status,
  V2Status,
  StatsResponse,
  UserMeResponse,
  TeamResponse,
  ValidationError,
} from './kvp-types';

class KvpPage {
  private apiService: KvpApiService;
  private currentUser: User | null = null;
  private currentFilter = 'all';
  private suggestions: KvpSuggestion[] = [];
  private categories: KvpCategory[] = [];
  private departments: Department[] = [];
  private currentTeamId: number | null = null;

  constructor() {
    this.apiService = new KvpApiService();
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      // Get current user
      this.currentUser = await this.apiService.getCurrentUser();

      // Setup UI based on role
      this.setupRoleBasedUI();

      // Load initial data
      await Promise.all([this.loadCategories(), this.loadDepartments(), this.loadSuggestions()]);

      // Setup event listeners
      this.setupEventListeners();

      // Load statistics if admin (but not in employee mode)
      const effectiveRole = this.getEffectiveRole();
      if (effectiveRole === 'admin' || effectiveRole === 'root') {
        void this.loadStatistics();
      }
    } catch (error) {
      console.error('Error initializing KVP page:', error);
      this.showError('Fehler beim Laden der Seite');
    }
  }

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

  private setupRoleBasedUI(): void {
    if (!this.currentUser) return;

    const effectiveRole = this.getEffectiveRole();
    this.updateBodyClasses(effectiveRole);
    this.configureUIElementsByRole(effectiveRole);
  }

  private updateBodyClasses(effectiveRole: string): void {
    document.body.classList.remove('role-admin', 'role-employee', 'role-root');
    document.body.classList.add(`role-${effectiveRole}`);
  }

  private configureUIElementsByRole(effectiveRole: string): void {
    const isAdminOrRoot = effectiveRole === 'admin' || effectiveRole === 'root';
    const isEmployee = effectiveRole === 'employee';

    this.toggleAdminElements(isAdminOrRoot);
    this.toggleCreateButton(isEmployee);
  }

  private toggleAdminElements(show: boolean): void {
    const adminElements = document.querySelectorAll('.admin-only');
    const adminInfoBox = $$('#adminInfoBox');
    const statsOverview = $$('#statsOverview');

    const displayValue = show ? '' : 'none';

    adminElements.forEach((el) => ((el as HTMLElement).style.display = displayValue));
    if (adminInfoBox) adminInfoBox.style.display = displayValue;
    if (statsOverview) statsOverview.style.display = displayValue;
  }

  private toggleCreateButton(show: boolean): void {
    const createBtn = $$('#createNewBtn');
    if (createBtn) {
      createBtn.style.display = show ? '' : 'none';
    }
  }

  private async loadCategories(): Promise<void> {
    try {
      this.categories = await this.apiService.loadCategories();

      // Populate category dropdown
      const categoryDropdown = document.querySelector('#categoryDropdown');
      if (categoryDropdown) {
        // Keep the first "Alle Kategorien" option
        const firstOption = categoryDropdown.querySelector('.dropdown-option');
        setHTML(categoryDropdown as HTMLElement, '');
        if (firstOption) categoryDropdown.append(firstOption);

        // Add categories
        this.categories.forEach((category) => {
          const option = document.createElement('div');
          option.className = 'dropdown-option';
          option.dataset.action = 'select-category';
          option.dataset.value = category.id.toString();
          option.dataset.text = category.name;
          option.textContent = category.name;
          categoryDropdown.append(option);
        });
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  private async loadDepartments(): Promise<void> {
    const effectiveRole = this.getEffectiveRole();
    if (effectiveRole === 'employee') return;

    try {
      this.departments = await this.apiService.loadDepartments();

      // Populate department dropdown
      const departmentDropdown = document.querySelector('#departmentDropdown');
      if (departmentDropdown) {
        // Keep the first "Alle Abteilungen" option
        const firstOption = departmentDropdown.querySelector('.dropdown-option');
        setHTML(departmentDropdown as HTMLElement, '');
        if (firstOption) departmentDropdown.append(firstOption);

        // Add departments
        this.departments.forEach((dept) => {
          const option = document.createElement('div');
          option.className = 'dropdown-option';
          option.dataset.action = 'select-department';
          option.dataset.value = dept.id.toString();
          option.dataset.text = dept.name;
          option.textContent = dept.name;
          departmentDropdown.append(option);
        });
      }
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  }

  private async loadSuggestions(): Promise<void> {
    try {
      const params = this.buildSuggestionParams();
      const suggestions = await this.fetchSuggestions(params);

      this.suggestions = suggestions;
      this.renderSuggestions();
      this.updateBadges();
    } catch (error) {
      console.error('Error loading suggestions:', error);
      this.showError('Fehler beim Laden der Vorschläge');
    }
  }

  private buildSuggestionParams(): URLSearchParams {
    const params = new URLSearchParams({
      filter: this.currentFilter,
    });

    this.addFilterParams(params);

    const useV2API = this.apiService.useV2API;
    if (this.currentFilter === 'archived') {
      params.append(useV2API ? 'includeArchived' : 'include_archived', 'true');
    }

    return params;
  }

  private addFilterParams(params: URLSearchParams): void {
    const filters = this.getFilterValues();
    const useV2API = this.apiService.useV2API;

    if (filters.status !== '') params.append('status', filters.status);
    if (filters.category !== '') {
      params.append(useV2API ? 'categoryId' : 'category_id', filters.category);
    }
    if (filters.department !== '') {
      params.append(useV2API ? 'departmentId' : 'department_id', filters.department);
    }
    if (filters.search !== '') params.append('search', filters.search);
  }

  private getFilterValues(): { status: string; category: string; department: string; search: string } {
    const statusFilterEl = document.querySelector('#statusFilterValue');
    const categoryFilterEl = document.querySelector('#categoryFilterValue');
    const departmentFilterEl = document.querySelector('#departmentFilterValue');
    const searchFilterEl = document.querySelector('#searchFilter');

    return {
      status: statusFilterEl instanceof HTMLInputElement ? statusFilterEl.value : '',
      category: categoryFilterEl instanceof HTMLInputElement ? categoryFilterEl.value : '',
      department: departmentFilterEl instanceof HTMLInputElement ? departmentFilterEl.value : '',
      search: searchFilterEl instanceof HTMLInputElement ? searchFilterEl.value : '',
    };
  }

  private async fetchSuggestions(params: URLSearchParams): Promise<KvpSuggestion[]> {
    return await this.apiService.fetchSuggestions(params);
  }

  private renderSuggestions(): void {
    const container = $$('#suggestionsContainer');
    const emptyState = $$('#emptyState');

    if (!container || !emptyState) return;

    if (this.suggestions.length === 0) {
      setHTML(container, '');
      emptyState.style.display = '';
      return;
    }

    emptyState.style.display = 'none';

    const suggestionsHTML = this.suggestions.map((s) => this.renderSuggestionCard(s)).join('');
    setHTML(container, suggestionsHTML);
    this.attachSuggestionEventHandlers(container);
  }

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
      <div class="glass-card kvp-card" data-id="${suggestion.id}">
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
          <div class="action-buttons">${this.renderActionButtons(suggestion)}</div>
        </div>
      </div>
    `;
  }

  private attachSuggestionEventHandlers(container: HTMLElement): void {
    container.querySelectorAll('.kvp-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.action-btn')) {
          const cardEl = card as HTMLElement;
          const id = cardEl.dataset.id;
          if (id !== undefined && id !== '') this.viewSuggestion(Number.parseInt(id, 10));
        }
      });
    });

    container.querySelectorAll('.action-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const btnEl = btn as HTMLElement;
        const action = btnEl.dataset.action;
        const id = btnEl.dataset.id;
        if (action !== undefined && action !== '' && id !== undefined && id !== '') {
          void this.handleAction(action, Number.parseInt(id, 10));
        }
      });
    });
  }

  private renderActionButtons(suggestion: KvpSuggestion): string {
    const buttons: string[] = [];

    if (!this.currentUser) return '';

    const effectiveRole = this.getEffectiveRole();

    // View button for all
    buttons.push(`
      <button class="action-btn" data-action="view" data-id="${suggestion.id}">
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

    return buttons.join('');
  }

  private async handleAction(action: string, id: number): Promise<void> {
    switch (action) {
      case 'view':
        this.viewSuggestion(id);
        break;
      case 'share':
        await this.shareSuggestion(id);
        break;
      case 'unshare':
        await this.unshareSuggestion(id);
        break;
    }
  }

  private viewSuggestion(id: number): void {
    // Navigate to detail view
    window.location.href = `/kvp-detail?id=${id}`;
  }

  private async shareSuggestion(id: number): Promise<void> {
    const confirmed = await this.showConfirmDialog('Möchten Sie diesen Vorschlag wirklich firmenweit teilen?');
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

  private async unshareSuggestion(id: number): Promise<void> {
    const confirmed = await this.showConfirmDialog(
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

  private async loadStatistics(): Promise<void> {
    try {
      const statsData = await this.fetchStatistics();
      const data = this.normalizeStatsData(statsData);
      this.updateStatisticsDisplay(data);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  }

  private async fetchStatistics(): Promise<unknown> {
    return await this.apiService.fetchStatistics();
  }

  private normalizeStatsData(statsData: unknown): StatsResponse {
    return this.apiService.normalizeStatsData(statsData);
  }

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

  private updateBadges(): void {
    // Count suggestions by filter
    const counts = {
      all: this.suggestions.length,
      mine: this.suggestions.filter((s) => s.submittedBy === this.currentUser?.id).length,
      department: this.suggestions.filter((s) => s.orgLevel === 'department').length,
      company: this.suggestions.filter((s) => s.orgLevel === 'company').length,
      archived: this.suggestions.filter((s) => s.status === 'archived').length,
    };

    // Update badge counts
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

  private setupEventListeners(): void {
    this.setupFilterButtons();
    // eslint-disable-next-line max-lines
    this.setupSecondaryFilters();
    this.setupSearchFilter();
    this.setupKvpCategorySelection();
    this.setupCreateButtons();
  }

  private setupFilterButtons(): void {
    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach((b) => {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        if (btn instanceof HTMLElement) {
          this.currentFilter = btn.dataset.filter ?? 'all';
        }
        void this.loadSuggestions();
      });
    });
  }

  private setupSecondaryFilters(): void {
    ['statusFilterValue', 'categoryFilterValue', 'departmentFilterValue'].forEach((id) => {
      const element = $$(`#${id}`);
      if (element) {
        element.addEventListener('change', () => void this.loadSuggestions());
      }
    });
  }

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

  private setupKvpCategorySelection(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const kvpCategoryOption = target.closest('[data-action="select-kvp-category"]');
      if (kvpCategoryOption instanceof HTMLElement) {
        const value = kvpCategoryOption.dataset.value;
        const text = kvpCategoryOption.dataset.text;
        if (value !== undefined && value !== '' && text !== undefined && text !== '') {
          const kvpWindow = window as unknown as KvpWindow;
          if (kvpWindow.selectKvpCategory) kvpWindow.selectKvpCategory(value, text);
        }
      }
    });
  }

  private setupCreateButtons(): void {
    const createBtn = document.querySelector('#createNewBtn');
    if (createBtn) {
      createBtn.addEventListener('click', () => void this.openCreateModal());
    }

    const createBtnHeader = document.querySelector('#createNewBtnHeader');
    if (createBtnHeader) {
      createBtnHeader.addEventListener('click', () => void this.openCreateModal());
    }

    const createForm = document.querySelector('#createKvpForm');
    if (createForm !== null) {
      createForm.addEventListener('submit', (e) => {
        e.preventDefault();
        void (async () => {
          await this.createSuggestion();
        })();
      });
    }
  }

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

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.textContent;
  }

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

  private showError(message: string): void {
    // Use notification service instead of custom implementation
    notificationService.error('Fehler', message, 4000);
  }

  private showConfirmDialog(message: string): Promise<boolean> {
    // Use the consistent confirm dialog from alerts.ts
    return showConfirm(message);
  }

  private async openCreateModal(): Promise<void> {
    const effectiveRole = this.getEffectiveRole();

    if (effectiveRole === 'employee') {
      const hasTeam = await this.validateEmployeeTeam();
      if (!hasTeam) return;
    }

    this.showModalAfterValidation();
  }

  private async validateEmployeeTeam(): Promise<boolean> {
    try {
      const userInfo = await this.fetchUserInfo();
      const teamId = this.extractTeamId(userInfo);

      if (teamId !== undefined && teamId > 0) {
        this.currentTeamId = teamId;
        return true;
      }

      return await this.checkTeamLeadStatus(userInfo);
    } catch (error) {
      console.error('Could not get employee team info:', error);
      this.showNoTeamError();
      return false;
    }
  }

  private async fetchUserInfo(): Promise<UserMeResponse> {
    return await this.apiService.fetchUserInfo();
  }

  private extractTeamId(userInfo: UserMeResponse): number | undefined {
    console.log('User /me response:', userInfo);

    return (
      userInfo.teamId ??
      userInfo.team_id ??
      userInfo.team?.id ??
      userInfo.teams?.[0]?.id ??
      userInfo.teams?.[0]?.team_id
    );
  }

  private async checkTeamLeadStatus(userInfo: UserMeResponse): Promise<boolean> {
    const originalRole = localStorage.getItem('userRole');

    if (originalRole !== 'admin' && originalRole !== 'root') {
      this.showNoTeamError();
      return false;
    }

    try {
      const userTeam = await this.findUserTeamAsLead(userInfo.id);

      if (userTeam) {
        console.log('User is team lead of team:', userTeam.id);
        this.currentTeamId = userTeam.id;
        return true;
      }

      this.showNoTeamError();
      return false;
    } catch (error) {
      console.error('Could not check team lead status:', error);
      this.showNoTeamError();
      return false;
    }
  }

  private async findUserTeamAsLead(userId?: number): Promise<TeamResponse | undefined> {
    if (userId === undefined || userId === 0) return undefined;

    const teamsResponse = await this.apiService.fetchTeams();
    console.log('Checking if user is team lead. User ID:', userId);
    console.log('Teams response:', teamsResponse);

    return teamsResponse.find(
      (team) => team.team_lead_id === userId || team.teamLeadId === userId || team.leaderId === userId,
    );
  }

  private showNoTeamError(): void {
    notificationService.error(
      'Kein Team zugeordnet',
      'Sie wurden keinem Team zugeordnet. Bitte wenden Sie sich an Ihren Administrator.',
      5000,
    );
  }

  private showModalAfterValidation(): void {
    // Reset form
    const form = $$('#createKvpForm');
    if (form instanceof HTMLFormElement) form.reset();

    // Load categories into dropdown
    const categoryDropdown = $$('#kvpCategoryDropdown');
    if (categoryDropdown && this.categories.length > 0) {
      const categoryOptions = this.categories
        .map(
          (category) => `
        <div class="dropdown-option" data-action="select-kvp-category" data-value="${category.id}" data-text="${this.escapeHtml(category.name)}">
          ${category.icon ?? '💡'} ${this.escapeHtml(category.name)}
        </div>
      `,
        )
        .join('');
      setHTML(categoryDropdown, categoryOptions);
    }

    // Show modal
    (window as unknown as KvpWindow).showCreateModal();
  }

  private async createSuggestion(): Promise<void> {
    try {
      const formData = this.getFormData();
      if (!formData) return;

      const validatedData = this.validateFormData(formData);
      if (!validatedData) return;

      const suggestionData = this.prepareSuggestionData(formData, validatedData);
      const suggestionId = await this.submitSuggestion(suggestionData);

      await this.handlePhotoUpload(suggestionId);
      await this.handleSuggestionSuccess();
    } catch (error) {
      this.handleSuggestionError(error);
    }
  }

  private getFormData(): FormData | null {
    const form = $$('#createKvpForm');
    if (!(form instanceof HTMLFormElement)) {
      this.showError('Form nicht gefunden');
      return null;
    }
    return new FormData(form);
  }

  private validateFormData(formData: FormData): { title: string; description: string } | null {
    const title = formData.get('title');
    const description = formData.get('description');

    if (title === null || title === '' || description === null || description === '') {
      this.showError('Bitte füllen Sie Titel und Beschreibung aus');
      return null;
    }

    return { title: title as string, description: description as string };
  }

  private prepareSuggestionData(
    formData: FormData,
    validatedData: { title: string; description: string },
  ): Record<string, unknown> {
    const categoryId = formData.get('category_id');
    const priorityValue = formData.get('priority');
    const benefitValue = formData.get('expected_benefit');
    const costValue = formData.get('estimated_cost');

    const { orgLevel, orgId } = this.determineOrgLevel();

    const data = {
      title: validatedData.title.trim(),
      description: validatedData.description.trim(),
      categoryId: categoryId !== null && categoryId !== '' ? Number.parseInt(categoryId as string, 10) : null,
      priority: priorityValue !== null && priorityValue !== '' ? (priorityValue as string) : 'normal',
      expectedBenefit: benefitValue !== null && benefitValue !== '' ? (benefitValue as string) : null,
      estimatedCost: costValue !== null && costValue !== '' ? (costValue as string) : null,
      orgLevel: orgLevel,
      orgId: orgId,
      departmentId: this.currentUser?.departmentId ?? null,
    };

    this.logSuggestionData(data);
    return data;
  }

  private determineOrgLevel(): { orgLevel: string; orgId: number } {
    const effectiveRole = this.getEffectiveRole();

    if (effectiveRole === 'employee' && this.currentTeamId !== null && this.currentTeamId > 0) {
      return { orgLevel: 'team', orgId: this.currentTeamId };
    }

    if (effectiveRole === 'admin' || effectiveRole === 'root') {
      return { orgLevel: 'company', orgId: this.currentUser?.tenantId ?? 0 };
    }

    return { orgLevel: 'team', orgId: 0 };
  }

  private logSuggestionData(data: Record<string, unknown>): void {
    console.log('Current user object:', this.currentUser);
    console.log('Current user departmentId:', this.currentUser?.departmentId);
    console.log('Sending KVP data to API:', data);
    console.log('Data.departmentId being sent:', data.departmentId);
  }

  private async submitSuggestion(data: Record<string, unknown>): Promise<number> {
    return await this.apiService.submitSuggestion(data);
  }

  private async handlePhotoUpload(suggestionId: number): Promise<void> {
    const selectedPhotos = (window as unknown as KvpWindow).selectedPhotos;

    console.info('Check selectedPhotos:', selectedPhotos);
    console.info('Window.selectedPhotos type:', typeof (window as unknown as KvpWindow).selectedPhotos);
    console.info('Photos count:', selectedPhotos ? selectedPhotos.length : 0);

    if (selectedPhotos && selectedPhotos.length > 0) {
      console.info('Uploading photos for suggestion:', suggestionId);
      await this.uploadPhotos(suggestionId, selectedPhotos);
    } else {
      console.info('No photos to upload');
    }
  }

  private async handleSuggestionSuccess(): Promise<void> {
    this.showSuccess('Ihr Vorschlag wurde erfolgreich eingereicht');
    (window as unknown as KvpWindow).hideCreateModal();

    (window as unknown as KvpWindow).selectedPhotos = [];
    const photoPreview = document.querySelector('#photoPreview');
    if (photoPreview) setHTML(photoPreview as HTMLElement, '');

    await this.loadSuggestions();
  }

  private handleSuggestionError(error: unknown): void {
    console.error('Error creating suggestion:', error);

    if (this.isValidationError(error)) {
      this.handleValidationError(error as Error);
    } else {
      this.showError(error instanceof Error ? error.message : 'Fehler beim Erstellen des Vorschlags');
    }
  }

  private isValidationError(error: unknown): boolean {
    return error instanceof Error && error.message === 'Validation failed';
  }

  private handleValidationError(error: Error): void {
    const apiError = error as ValidationError;
    if (apiError.details !== undefined && Array.isArray(apiError.details)) {
      const errorMessages = apiError.details.map((detail) => this.formatValidationMessage(detail));
      this.showError('Bitte korrigieren Sie folgende Eingaben:\n' + errorMessages.join('\n'));
    } else {
      this.showError('Validierungsfehler: Bitte überprüfen Sie Ihre Eingaben');
    }
  }

  private formatValidationMessage(detail: { field: string; message: string }): string {
    if (detail.field === 'title') {
      return 'Titel: Muss zwischen 3 und 255 Zeichen lang sein';
    }
    if (detail.field === 'description') {
      return 'Beschreibung: Muss zwischen 10 und 5000 Zeichen lang sein';
    }
    return detail.message;
  }

  private async uploadPhotos(suggestionId: number, photos: File[]): Promise<void> {
    await this.apiService.uploadPhotos(suggestionId, photos);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new KvpPage();
});
