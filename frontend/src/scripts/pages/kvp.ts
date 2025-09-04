/**
 * KVP Page Script
 * Handles KVP suggestions with department-based visibility
 */

import { ApiClient } from '../../utils/api-client';
import { $$ } from '../../utils/dom-utils';
import { getAuthToken } from '../auth';
import notificationService from '../services/notification.service';
import { showConfirm } from '../utils/alerts';

interface User {
  id: number;
  role: 'root' | 'admin' | 'employee';
  tenantId: number;
  departmentId: number | null; // Make it explicitly nullable but always present
}

interface KvpSuggestion {
  id: number;
  title: string;
  description: string;
  status: 'new' | 'in_review' | 'approved' | 'implemented' | 'rejected' | 'archived';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  orgLevel: 'company' | 'department' | 'team';
  orgId: number;
  departmentId: number;
  departmentName: string;
  teamId?: number;
  teamName?: string;
  submittedBy: number;
  submittedByName: string;
  submittedByLastname: string;
  categoryId: number;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  sharedBy?: number;
  sharedByName?: string;
  sharedAt?: string;
  createdAt: string;
  expectedBenefit?: string;
  estimatedCost?: number;
  actualSavings?: number;
  attachmentCount?: number;
  roi?: number; // NEW in v2!
}

interface KvpCategory {
  id: number;
  name: string;
  icon?: string;
  color: string;
}

interface Department {
  id: number;
  name: string;
}

interface KvpWindow extends Window {
  selectCategory: (id: string, name: string) => void;
  selectDepartment: (id: string, name: string) => void;
  showCreateModal: () => void;
  hideCreateModal: () => void;
  selectedPhotos?: File[];
}

class KvpPage {
  private apiClient: ApiClient;
  private currentUser: User | null = null;
  private currentFilter = 'all';
  private suggestions: KvpSuggestion[] = [];
  private categories: KvpCategory[] = [];
  private departments: Department[] = [];
  private useV2API = true;
  private currentTeamId: number | null = null;

  constructor() {
    this.apiClient = ApiClient.getInstance();
    // Check feature flag for v2 API
    const w = window as Window & { FEATURE_FLAGS?: { USE_API_V2_KVP?: boolean } };
    this.useV2API = w.FEATURE_FLAGS?.USE_API_V2_KVP !== false;
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      // Get current user
      this.currentUser = await this.getCurrentUser();

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

  private async getCurrentUser(): Promise<User | null> {
    try {
      if (this.useV2API) {
        // Get full user data including departmentId
        const userData = await this.apiClient.get<User & { departmentId?: number }>('/users/me');
        console.log('User data from /users/me:', userData);
        return userData;
      } else {
        // v1 fallback
        const token = getAuthToken();
        const response = await fetch('/api/users/me', {
          headers: {
            Authorization: `Bearer ${token ?? ''}`,
          },
        });

        if (!response.ok) throw new Error('Failed to get user info');

        interface V1UserResponse {
          user: User & {
            tenant_id?: number;
            department_id?: number;
          };
        }
        const data = (await response.json()) as V1UserResponse;
        // Convert snake_case to camelCase for v1
        return {
          ...data.user,
          tenantId: (data.user as { tenant_id?: number }).tenant_id ?? data.user.tenantId,
          departmentId: (data.user as { department_id?: number }).department_id ?? data.user.departmentId,
        };
      }
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
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

    // Add role-based class to body for CSS targeting
    document.body.classList.remove('role-admin', 'role-employee', 'role-root');
    document.body.classList.add(`role-${effectiveRole}`);

    // Show/hide admin elements
    const adminElements = document.querySelectorAll('.admin-only');
    const adminInfoBox = $$('#adminInfoBox');
    const statsOverview = $$('#statsOverview');
    const createBtn = $$('#createNewBtn');

    // Check effective role instead of actual role
    if (effectiveRole === 'admin' || effectiveRole === 'root') {
      adminElements.forEach((el) => ((el as HTMLElement).style.display = ''));
      if (adminInfoBox) adminInfoBox.style.display = '';
      if (statsOverview) statsOverview.style.display = '';
    } else {
      adminElements.forEach((el) => ((el as HTMLElement).style.display = 'none'));
      if (adminInfoBox) adminInfoBox.style.display = 'none';
      if (statsOverview) statsOverview.style.display = 'none';
    }

    // Show create button for employees (including role-switched admins)
    if (effectiveRole === 'employee') {
      if (createBtn) createBtn.style.display = '';
    } else {
      if (createBtn) createBtn.style.display = 'none';
    }
  }

  private async loadCategories(): Promise<void> {
    try {
      let categories: KvpCategory[];

      if (this.useV2API) {
        // v2 API
        categories = await this.apiClient.get<KvpCategory[]>('/kvp/categories');
      } else {
        // v1 fallback
        const token = getAuthToken();
        const response = await fetch('/api/kvp/categories', {
          headers: {
            Authorization: `Bearer ${token ?? ''}`,
          },
        });

        if (!response.ok) throw new Error('Failed to load categories');

        const data = (await response.json()) as { categories?: KvpCategory[] };
        categories = data.categories ?? [];
      }

      this.categories = categories;

      // Populate category dropdown
      const categoryDropdown = document.querySelector('#categoryDropdown');
      if (categoryDropdown) {
        // Keep the first "Alle Kategorien" option
        const firstOption = categoryDropdown.querySelector('.dropdown-option');
        categoryDropdown.innerHTML = '';
        if (firstOption) categoryDropdown.append(firstOption);

        // Add categories
        this.categories.forEach((category) => {
          const option = document.createElement('div');
          option.className = 'dropdown-option';
          option.onclick = () => {
            (window as unknown as KvpWindow).selectCategory(category.id.toString(), category.name);
          };
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
      let departments: Department[];

      if (this.useV2API) {
        // v2 API
        departments = await this.apiClient.get<Department[]>('/departments');
      } else {
        // v1 fallback
        const token = getAuthToken();
        const response = await fetch('/api/departments', {
          headers: {
            Authorization: `Bearer ${token ?? ''}`,
          },
        });

        if (!response.ok) throw new Error('Failed to load departments');

        const data = (await response.json()) as { departments?: Department[] };
        departments = data.departments ?? [];
      }

      this.departments = departments;

      // Populate department dropdown
      const departmentDropdown = document.querySelector('#departmentDropdown');
      if (departmentDropdown) {
        // Keep the first "Alle Abteilungen" option
        const firstOption = departmentDropdown.querySelector('.dropdown-option');
        departmentDropdown.innerHTML = '';
        if (firstOption) departmentDropdown.append(firstOption);

        // Add departments
        this.departments.forEach((dept) => {
          const option = document.createElement('div');
          option.className = 'dropdown-option';
          option.onclick = () => {
            (window as unknown as KvpWindow).selectDepartment(dept.id.toString(), dept.name);
          };
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
      const params = new URLSearchParams({
        filter: this.currentFilter,
      });

      // Add additional filters
      const statusFilterEl = document.querySelector('#statusFilterValue');
      const categoryFilterEl = document.querySelector('#categoryFilterValue');
      const departmentFilterEl = document.querySelector('#departmentFilterValue');
      const searchFilterEl = document.querySelector('#searchFilter');

      const statusFilter = statusFilterEl instanceof HTMLInputElement ? statusFilterEl.value : '';
      const categoryFilter = categoryFilterEl instanceof HTMLInputElement ? categoryFilterEl.value : '';
      const departmentFilter = departmentFilterEl instanceof HTMLInputElement ? departmentFilterEl.value : '';
      const searchFilter = searchFilterEl instanceof HTMLInputElement ? searchFilterEl.value : '';

      if (statusFilter !== '') params.append('status', statusFilter);
      if (categoryFilter !== '') {
        params.append(this.useV2API ? 'categoryId' : 'category_id', categoryFilter);
      }
      if (departmentFilter !== '') {
        params.append(this.useV2API ? 'departmentId' : 'department_id', departmentFilter);
      }
      if (searchFilter !== '') params.append('search', searchFilter);
      if (this.currentFilter === 'archived') {
        params.append(this.useV2API ? 'includeArchived' : 'include_archived', 'true');
      }

      let suggestions: KvpSuggestion[];

      if (this.useV2API) {
        // v2 API
        suggestions = await this.apiClient.get<KvpSuggestion[]>(`/kvp?${params}`);
      } else {
        // v1 fallback
        const token = getAuthToken();
        const response = await fetch(`/api/kvp?${params}`, {
          headers: {
            Authorization: `Bearer ${token ?? ''}`,
          },
        });

        if (!response.ok) throw new Error('Failed to load suggestions');

        const data = (await response.json()) as { suggestions?: KvpSuggestion[] };
        // Convert snake_case to camelCase for v1
        suggestions = (data.suggestions ?? []).map((s) => this.convertSuggestionToCamelCase(s));
      }

      this.suggestions = suggestions;

      this.renderSuggestions();
      this.updateBadges();
    } catch (error) {
      console.error('Error loading suggestions:', error);
      this.showError('Fehler beim Laden der Vorschläge');
    }
  }

  private convertSuggestionToCamelCase(suggestion: unknown): KvpSuggestion {
    // Type guard for v1 API response with snake_case fields
    interface V1Suggestion {
      id: number;
      title: string;
      description: string;
      status: string;
      priority: string;
      org_level?: string;
      orgLevel?: string;
      org_id?: number;
      orgId?: number;
      department_id?: number;
      departmentId?: number;
      department_name?: string;
      departmentName?: string;
      submitted_by?: number;
      submittedBy?: number;
      submitted_by_name?: string;
      submittedByName?: string;
      submitted_by_lastname?: string;
      submittedByLastname?: string;
      category_id?: number;
      categoryId?: number;
      category_name?: string;
      categoryName?: string;
      category_icon?: string;
      categoryIcon?: string;
      category_color?: string;
      categoryColor?: string;
      shared_by?: number;
      sharedBy?: number;
      shared_by_name?: string;
      sharedByName?: string;
      shared_at?: string;
      sharedAt?: string;
      created_at?: string;
      createdAt?: string;
      expected_benefit?: string;
      expectedBenefit?: string;
      estimated_cost?: number;
      estimatedCost?: number;
      actual_savings?: number;
      actualSavings?: number;
      attachment_count?: number;
      attachmentCount?: number;
      roi?: number;
    }

    const s = suggestion as V1Suggestion;
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      status: s.status as KvpSuggestion['status'],
      priority: s.priority as KvpSuggestion['priority'],
      orgLevel: (s.org_level ?? s.orgLevel ?? 'department') as KvpSuggestion['orgLevel'],
      orgId: s.org_id ?? s.orgId ?? 0,
      departmentId: s.department_id ?? s.departmentId ?? 0,
      departmentName: s.department_name ?? s.departmentName ?? '',
      submittedBy: s.submitted_by ?? s.submittedBy ?? 0,
      submittedByName: s.submitted_by_name ?? s.submittedByName ?? '',
      submittedByLastname: s.submitted_by_lastname ?? s.submittedByLastname ?? '',
      categoryId: s.category_id ?? s.categoryId ?? 0,
      categoryName: s.category_name ?? s.categoryName ?? '',
      categoryIcon: s.category_icon ?? s.categoryIcon ?? '',
      categoryColor: s.category_color ?? s.categoryColor ?? '',
      sharedBy: s.shared_by ?? s.sharedBy,
      sharedByName: s.shared_by_name ?? s.sharedByName,
      sharedAt: s.shared_at ?? s.sharedAt,
      createdAt: s.created_at ?? s.createdAt ?? '',
      expectedBenefit: s.expected_benefit ?? s.expectedBenefit,
      estimatedCost: s.estimated_cost ?? s.estimatedCost,
      actualSavings: s.actual_savings ?? s.actualSavings,
      attachmentCount: s.attachment_count ?? s.attachmentCount,
      roi: s.roi,
    };
  }

  private renderSuggestions(): void {
    const container = $$('#suggestionsContainer');
    const emptyState = $$('#emptyState');

    if (!container || !emptyState) return;

    if (this.suggestions.length === 0) {
      container.innerHTML = '';
      emptyState.style.display = '';
      return;
    }

    emptyState.style.display = 'none';

    // eslint-disable-next-line no-unsanitized/property -- User content is escaped with escapeHtml
    container.innerHTML = this.suggestions
      .map((suggestion) => {
        const statusClass = suggestion.status.replace('_', '');
        const visibilityIcon = suggestion.orgLevel === 'company' ? 'fa-globe' : 'fa-users';
        const visibilityText =
          suggestion.orgLevel === 'company'
            ? 'Firmenweit'
            : suggestion.orgLevel === 'department' && suggestion.departmentName !== ''
              ? suggestion.departmentName
              : suggestion.teamName !== undefined && suggestion.teamName !== ''
                ? suggestion.teamName
                : 'Team';

        return `
        <div class="glass-card kvp-card" data-id="${suggestion.id}">
          <div class="status-badge ${statusClass}">${this.getStatusText(suggestion.status)}</div>

          <div class="suggestion-header">
            <h3 class="suggestion-title">${this.escapeHtml(suggestion.title)}</h3>
            <div class="suggestion-meta">
              <span><i class="fas fa-user"></i> ${suggestion.submittedByName} ${suggestion.submittedByLastname}</span>
              <span><i class="fas fa-calendar"></i> ${new Date(suggestion.createdAt).toLocaleDateString('de-DE')}</span>
              ${
                suggestion.attachmentCount !== undefined && suggestion.attachmentCount > 0
                  ? `<span><i class="fas fa-camera"></i> ${suggestion.attachmentCount} Foto${suggestion.attachmentCount > 1 ? 's' : ''}</span>`
                  : ''
              }
            </div>
            <div class="visibility-badge ${suggestion.orgLevel}">
              <i class="fas ${visibilityIcon}"></i> ${visibilityText}
              ${suggestion.sharedByName !== undefined && suggestion.sharedByName !== '' ? `<span> - Geteilt von ${suggestion.sharedByName}</span>` : ''}
            </div>
          </div>

          <div class="suggestion-description">
            ${this.escapeHtml(suggestion.description)}
          </div>

          <div class="suggestion-footer">
            <div class="category-tag" style="background: ${suggestion.categoryColor}20; color: ${suggestion.categoryColor}; border: 1px solid ${suggestion.categoryColor};">
              ${suggestion.categoryIcon}
              ${suggestion.categoryName}
            </div>

            <div class="action-buttons">
              ${this.renderActionButtons(suggestion)}
            </div>
          </div>
        </div>
      `;
      })
      .join('');

    // Add click handlers
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

    // Add action button handlers
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
      if (this.useV2API) {
        // v2 API
        await this.apiClient.post(`/kvp/${id}/share`, {});
      } else {
        // v1 fallback
        const token = getAuthToken();
        const response = await fetch(`/api/kvp/${id}/share`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token ?? ''}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) throw new Error('Failed to share suggestion');
      }

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
      if (this.useV2API) {
        // v2 API
        await this.apiClient.post(`/kvp/${id}/unshare`, {});
      } else {
        // v1 fallback
        const token = getAuthToken();
        const response = await fetch(`/api/kvp/${id}/unshare`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token ?? ''}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) throw new Error('Failed to unshare suggestion');
      }

      this.showSuccess('Teilen wurde rückgängig gemacht');
      await this.loadSuggestions();
    } catch (error) {
      console.error('Error unsharing suggestion:', error);
      this.showError('Fehler beim Rückgängigmachen');
    }
  }

  private async loadStatistics(): Promise<void> {
    try {
      let statsData: unknown;
      if (this.useV2API) {
        // v2 API wraps response in data property
        const response = await this.apiClient.get('/kvp/dashboard/stats');
        statsData = response;
      } else {
        // v1 fallback
        const token = getAuthToken();
        const response = await fetch('/api/kvp/stats', {
          headers: {
            Authorization: `Bearer ${token ?? ''}`,
          },
        });

        if (!response.ok) throw new Error('Failed to load statistics');
        statsData = await response.json();
      }

      interface V1Status {
        new?: number;
        in_review?: number;
        implemented?: number;
        approved?: number;
        rejected?: number;
        archived?: number;
      }

      interface V2Status {
        new?: number;
        inReview?: number;
        approved?: number;
        implemented?: number;
        rejected?: number;
        archived?: number;
      }

      interface StatsResponse {
        company?: {
          total: number;
          byStatus: V1Status | V2Status;
          totalSavings: number;
        };
        total?: number; // v2 might have flat structure
        byStatus?: V2Status;
        totalSavings?: number;
      }

      const rawData = statsData as StatsResponse;

      // Normalize the data structure - v2 may have flat structure
      const data = rawData.company
        ? rawData
        : {
            company: {
              total: rawData.total ?? 0,
              byStatus: rawData.byStatus ?? {},
              totalSavings: rawData.totalSavings ?? 0,
            },
          };

      // Update statistics display
      const totalEl = $$('#totalSuggestions');
      const openEl = $$('#openSuggestions');
      const implementedEl = $$('#implementedSuggestions');
      const savingsEl = $$('#totalSavings');

      if (totalEl instanceof HTMLElement && data.company) totalEl.textContent = data.company.total.toString();
      if (openEl instanceof HTMLElement && data.company) {
        const byStatus = data.company.byStatus as V1Status & V2Status;
        const newCount = byStatus.new ?? 0;
        // Handle both v1 (in_review) and v2 (inReview) formats
        const inReviewCount = byStatus.inReview ?? byStatus.in_review ?? 0;
        openEl.textContent = (newCount + inReviewCount).toString();
      }
      if (implementedEl instanceof HTMLElement && data.company) {
        implementedEl.textContent = (data.company.byStatus.implemented ?? 0).toString();
      }
      if (savingsEl instanceof HTMLElement && data.company)
        savingsEl.textContent = new Intl.NumberFormat('de-DE', {
          style: 'currency',
          currency: 'EUR',
        }).format(data.company.totalSavings);
    } catch (error) {
      console.error('Error loading statistics:', error);
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
    // Filter buttons
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

    // Secondary filters - Listen to the hidden input value changes
    ['statusFilterValue', 'categoryFilterValue', 'departmentFilterValue'].forEach((id) => {
      const element = $$(`#${id}`);
      if (element) {
        element.addEventListener('change', () => {
          void this.loadSuggestions();
        });
      }
    });

    // Search filter with debounce
    let searchTimeout: number;
    const searchInput = $$('#searchFilter');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = window.setTimeout(() => {
          void this.loadSuggestions();
        }, 300);
      });
    }

    // Create new buttons (both header and floating)
    const createBtn = document.querySelector('#createNewBtn');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        void this.openCreateModal();
      });
    }

    const createBtnHeader = document.querySelector('#createNewBtnHeader');
    if (createBtnHeader) {
      createBtnHeader.addEventListener('click', () => {
        void this.openCreateModal();
      });
    }

    // Create form submission
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
    return div.innerHTML;
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
    // Check if employee needs team validation - ALL employees need this check!
    const effectiveRole = this.getEffectiveRole();

    if (effectiveRole === 'employee') {
      // Try to get team info from employee-accessible endpoint
      try {
        // Use /api/v2/users/me endpoint which is accessible by employees and returns team info
        interface UserMeResponse {
          id?: number;
          teamId?: number;
          team_id?: number;
          teamName?: string;
          team?: { id: number };
          teams?: { id: number; team_id?: number }[];
        }

        const userInfo = await this.apiClient.get<UserMeResponse>('/users/me');
        console.log('User /me response:', userInfo);

        // Check various possible field names for team ID
        const teamId =
          userInfo.teamId ??
          userInfo.team_id ??
          userInfo.team?.id ??
          userInfo.teams?.[0]?.id ??
          userInfo.teams?.[0]?.team_id;

        if (teamId !== undefined && teamId > 0) {
          this.currentTeamId = teamId;
        } else {
          // No team found - check if user is a team lead
          // This happens when an admin/root role-switches to employee but is a team_lead_id
          const originalRole = localStorage.getItem('userRole');

          if (originalRole === 'admin' || originalRole === 'root') {
            try {
              // Check if user is a team lead
              const teamsResponse = await this.apiClient.get<
                {
                  id: number;
                  team_lead_id?: number;
                  teamLeadId?: number;
                  leaderId?: number;
                }[]
              >('/teams');

              console.log('Checking if user is team lead. User ID:', userInfo.id);
              console.log('Teams response:', teamsResponse);

              const userTeam = teamsResponse.find(
                (team) =>
                  team.team_lead_id === userInfo.id || team.teamLeadId === userInfo.id || team.leaderId === userInfo.id,
              );

              if (userTeam) {
                console.log('User is team lead of team:', userTeam.id);
                this.currentTeamId = userTeam.id;
              } else {
                // Not a team lead either
                notificationService.error(
                  'Kein Team zugeordnet',
                  'Sie wurden keinem Team zugeordnet. Bitte wenden Sie sich an Ihren Administrator.',
                  5000,
                );
                return;
              }
            } catch (error) {
              console.error('Could not check team lead status:', error);
              notificationService.error(
                'Kein Team zugeordnet',
                'Sie wurden keinem Team zugeordnet. Bitte wenden Sie sich an Ihren Administrator.',
                5000,
              );
              return;
            }
          } else {
            // Regular employee without team
            notificationService.error(
              'Kein Team zugeordnet',
              'Sie wurden keinem Team zugeordnet. Bitte wenden Sie sich an Ihren Administrator.',
              5000,
            );
            return;
          }
        }
      } catch (error) {
        console.error('Could not get employee team info:', error);
        // For now, show error - backend needs to provide team info for employees
        notificationService.error(
          'Fehler',
          'Team-Information konnte nicht abgerufen werden. Bitte versuchen Sie es später erneut.',
          5000,
        );
        return;
      }
    }
    // Reset form
    const form = $$('#createKvpForm');
    if (form instanceof HTMLFormElement) form.reset();

    // Load categories into dropdown
    const categoryDropdown = $$('#kvpCategoryDropdown');
    if (categoryDropdown && this.categories.length > 0) {
      // eslint-disable-next-line no-unsanitized/property -- User content is escaped with escapeHtml
      categoryDropdown.innerHTML = this.categories
        .map(
          (category) => `
        <div class="dropdown-option" onclick="selectKvpCategory('${category.id}', '${this.escapeHtml(category.name)}')">
          ${category.icon ?? '💡'} ${this.escapeHtml(category.name)}
        </div>
      `,
        )
        .join('');
    }

    // Show modal
    (window as unknown as KvpWindow).showCreateModal();
  }

  private async createSuggestion(): Promise<void> {
    try {
      const form = $$('#createKvpForm');
      if (!(form instanceof HTMLFormElement)) {
        this.showError('Form nicht gefunden');
        return;
      }
      const formData = new FormData(form);

      // Validate required fields
      const title = formData.get('title');
      const description = formData.get('description');
      const categoryId = formData.get('category_id');

      if (title === null || title === '' || description === null || description === '') {
        this.showError('Bitte füllen Sie Titel und Beschreibung aus');
        return;
      }

      // Prepare data - cast to string since we validated they're not null
      const titleStr = title as string;
      const descStr = description as string;
      const catIdStr = categoryId as string | null;
      const priorityValue = formData.get('priority');
      const benefitValue = formData.get('expected_benefit');
      const costValue = formData.get('estimated_cost');

      // Add organization level and ID based on role
      const effectiveRole = this.getEffectiveRole();
      let orgLevel = 'team';
      let orgId = 0;

      if (effectiveRole === 'employee' && this.currentTeamId !== null && this.currentTeamId > 0) {
        orgLevel = 'team';
        orgId = this.currentTeamId;
      } else if (effectiveRole === 'admin' || effectiveRole === 'root') {
        // For admin/root, default to company level (can be changed later)
        orgLevel = 'company';
        orgId = this.currentUser?.tenantId ?? 0;
      }

      const data = {
        title: titleStr.trim(),
        description: descStr.trim(),
        categoryId: catIdStr !== null && catIdStr !== '' ? Number.parseInt(catIdStr, 10) : null, // API v2 expects camelCase
        priority: priorityValue !== null && priorityValue !== '' ? (priorityValue as string) : 'normal',
        expectedBenefit: benefitValue !== null && benefitValue !== '' ? (benefitValue as string) : null, // API v2 expects camelCase
        estimatedCost: costValue !== null && costValue !== '' ? (costValue as string) : null, // API v2 now accepts text with currency symbols
        orgLevel: orgLevel,
        orgId: orgId,
        departmentId: this.currentUser?.departmentId ?? null, // Add department_id from current user
      };

      // Debug: Log what we're sending
      console.log('Current user object:', this.currentUser);
      console.log('Current user departmentId:', this.currentUser?.departmentId);
      console.log('Sending KVP data to API:', data);
      console.log('Data.departmentId being sent:', data.departmentId);

      // Submit to API
      let suggestionId: number;

      if (this.useV2API) {
        // v2 API
        const result = await this.apiClient.post<{ id: number }>('/kvp', data);
        suggestionId = result.id;
      } else {
        // v1 fallback
        const token = getAuthToken();
        const response = await fetch('/api/kvp', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token ?? ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const error = (await response.json()) as { message?: string };
          throw new Error(error.message ?? 'Fehler beim Erstellen des Vorschlags');
        }

        const result = (await response.json()) as { suggestion: { id: number } };
        suggestionId = result.suggestion.id;
      }

      // Upload photos if any
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

      // Success
      this.showSuccess('Ihr Vorschlag wurde erfolgreich eingereicht');
      (window as unknown as KvpWindow).hideCreateModal();

      // Clear photo selection
      (window as unknown as KvpWindow).selectedPhotos = [];
      const photoPreview = document.querySelector('#photoPreview');
      if (photoPreview) photoPreview.innerHTML = '';

      // Reload suggestions
      await this.loadSuggestions();
    } catch (error) {
      console.error('Error creating suggestion:', error);

      // Handle validation errors specifically
      if (error instanceof Error && error.message === 'Validation failed') {
        interface ValidationError extends Error {
          details?: {
            field: string;
            message: string;
          }[];
        }
        const apiError = error as ValidationError;
        if (apiError.details !== undefined && Array.isArray(apiError.details)) {
          const errorMessages = apiError.details.map((detail) => {
            if (detail.field === 'title') {
              return 'Titel: Muss zwischen 3 und 255 Zeichen lang sein';
            } else if (detail.field === 'description') {
              return 'Beschreibung: Muss zwischen 10 und 5000 Zeichen lang sein';
            }
            return detail.message;
          });
          this.showError('Bitte korrigieren Sie folgende Eingaben:\n' + errorMessages.join('\n'));
        } else {
          this.showError('Validierungsfehler: Bitte überprüfen Sie Ihre Eingaben');
        }
      } else {
        this.showError(error instanceof Error ? error.message : 'Fehler beim Erstellen des Vorschlags');
      }
    }
  }

  private async uploadPhotos(suggestionId: number, photos: File[]): Promise<void> {
    console.info('Uploading photos:', photos.length, 'photos for suggestion', suggestionId);

    const formData = new FormData();
    photos.forEach((photo, index) => {
      console.info(`Adding photo ${index}:`, photo.name, photo.size, photo.type);
      formData.append('files', photo);
    });

    try {
      if (this.useV2API) {
        // v2 API
        console.info('Sending photo upload request to v2 API');
        await this.apiClient.upload(`/kvp/${suggestionId}/attachments`, formData);
      } else {
        // v1 fallback
        const token = getAuthToken();
        console.info('Sending photo upload request to:', `/api/kvp/${suggestionId}/attachments`);
        const response = await fetch(`/api/kvp/${suggestionId}/attachments`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token ?? ''}`,
          },
          body: formData,
        });

        console.info('Upload response status:', response.status);
        const responseData = (await response.json()) as { message?: string };
        console.info('Upload response data:', responseData);

        if (!response.ok) {
          console.error('Fehler beim Hochladen der Fotos:', responseData);
          throw new Error(responseData.message ?? 'Upload fehlgeschlagen');
        }
      }
    } catch (error) {
      console.error('Error uploading photos:', error);
      throw error;
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new KvpPage();
});
