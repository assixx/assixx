/**
 * KVP Detail Page Script
 * Handles detailed view of KVP suggestions
 */

import { ApiClient } from '../../utils/api-client';
import { $$, setHTML, getData } from '../../utils/dom-utils';
import { getAuthToken } from '../auth';
import { showSuccessAlert, showErrorAlert, showConfirm } from '../utils/alerts';

// Extend Window interface for openLightbox function
declare global {
  interface Window {
    openLightbox?: (url: string) => void;
  }
}

interface User {
  id: number;
  role: 'root' | 'admin' | 'employee';
  tenantId: number;
}

interface KvpAPIResponse {
  id?: number;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  org_level?: string;
  orgLevel?: string;
  org_id?: number;
  orgId?: number;
  department_id?: number;
  departmentId?: number;
  department_name?: string;
  departmentName?: string;
  team_id?: number;
  teamId?: number;
  team_name?: string;
  teamName?: string;
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
  implementation_date?: string;
  implementationDate?: string;
  assigned_to?: number;
  assignedTo?: number;
  rejection_reason?: string;
  rejectionReason?: string;
  roi?: number;
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
  implementationDate?: string;
  assignedTo?: number;
  rejectionReason?: string;
  roi?: number; // NEW in v2!
}

interface Comment {
  id: number;
  suggestionId: number;
  userId: number;
  firstName: string;
  lastName: string;
  profilePictureUrl?: string;
  comment: string;
  isInternal: boolean;
  createdAt: string;
}

interface Attachment {
  id: number;
  suggestionId: number;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  uploadedBy: number;
  uploadedByName: string;
  uploadedByLastname: string;
  uploadedAt: string;
}

class KvpDetailPage {
  private apiClient: ApiClient;
  private currentUser: User | null = null;
  private suggestionId = 0;
  private suggestion: KvpSuggestion | null = null;
  private useV2API = true;

  constructor() {
    this.apiClient = ApiClient.getInstance();
    // Check feature flag for v2 API
    const w = window as Window & { FEATURE_FLAGS?: { USE_API_V2_KVP?: boolean } };
    this.useV2API = w.FEATURE_FLAGS?.USE_API_V2_KVP !== false;
    // Get suggestion ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    if (id === null || id === '' || Number.isNaN(Number.parseInt(id, 10))) {
      this.showError('Ungültige Vorschlags-ID');
      setTimeout(() => (window.location.href = '/kvp'), 2000);
      return;
    }

    this.suggestionId = Number.parseInt(id, 10);
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      // Get current user
      this.currentUser = await this.getCurrentUser();

      // Load suggestion details
      await this.loadSuggestion();

      // Setup UI based on role
      this.setupRoleBasedUI();

      // Load related data
      await Promise.all([this.loadComments(), this.loadAttachments()]);

      // Setup event listeners
      this.setupEventListeners();
    } catch (error) {
      console.error('Error initializing KVP detail page:', error);
      this.showError('Fehler beim Laden der Seite');
    }
  }

  private async getCurrentUser(): Promise<User | null> {
    try {
      if (this.useV2API) {
        return await this.apiClient.get<User>('/users/me');
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
          user: User & { tenant_id?: number };
        }
        const data = (await response.json()) as V1UserResponse;
        // Convert snake_case to camelCase for v1
        return {
          ...data.user,
          tenantId: data.user.tenant_id ?? data.user.tenantId,
        };
      }
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  private async loadSuggestion(): Promise<void> {
    try {
      if (this.useV2API) {
        this.suggestion = await this.apiClient.get<KvpSuggestion>(`/kvp/${this.suggestionId}`);
      } else {
        // v1 fallback
        const token = getAuthToken();
        const response = await fetch(`/api/kvp/${this.suggestionId}`, {
          headers: {
            Authorization: `Bearer ${token ?? ''}`,
          },
        });

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('Keine Berechtigung');
          }
          throw new Error('Failed to load suggestion');
        }

        const v1Suggestion = (await response.json()) as Record<string, unknown>;
        // Convert snake_case to camelCase
        this.suggestion = this.convertSuggestionToCamelCase(v1Suggestion);
      }
      this.renderSuggestion();
    } catch (error) {
      console.error('Error loading suggestion:', error);
      this.showError(error instanceof Error ? error.message : 'Fehler beim Laden des Vorschlags');
      setTimeout(() => (window.location.href = '/kvp'), 2000);
    }
  }

  private convertBasicFields(
    s: KvpAPIResponse,
  ): Pick<KvpSuggestion, 'id' | 'title' | 'description' | 'status' | 'priority' | 'createdAt'> {
    return {
      id: s.id ?? 0,
      title: s.title ?? '',
      description: s.description ?? '',
      status: (s.status ?? 'new') as KvpSuggestion['status'],
      priority: (s.priority ?? 'normal') as KvpSuggestion['priority'],
      createdAt: s.created_at ?? s.createdAt ?? '',
    };
  }

  private convertOrgFields(
    s: KvpAPIResponse,
  ): Pick<KvpSuggestion, 'orgLevel' | 'orgId' | 'departmentId' | 'departmentName' | 'teamId' | 'teamName'> {
    return {
      orgLevel: (s.org_level ?? s.orgLevel ?? 'company') as KvpSuggestion['orgLevel'],
      orgId: s.org_id ?? s.orgId ?? 0,
      departmentId: s.department_id ?? s.departmentId ?? 0,
      departmentName: s.department_name ?? s.departmentName ?? '',
      teamId: s.team_id ?? s.teamId,
      teamName: s.team_name ?? s.teamName,
    };
  }

  private convertUserFields(
    s: KvpAPIResponse,
  ): Pick<
    KvpSuggestion,
    'submittedBy' | 'submittedByName' | 'submittedByLastname' | 'sharedBy' | 'sharedByName' | 'sharedAt'
  > {
    return {
      submittedBy: s.submitted_by ?? s.submittedBy ?? 0,
      submittedByName: s.submitted_by_name ?? s.submittedByName ?? '',
      submittedByLastname: s.submitted_by_lastname ?? s.submittedByLastname ?? '',
      sharedBy: s.shared_by ?? s.sharedBy,
      sharedByName: s.shared_by_name ?? s.sharedByName,
      sharedAt: s.shared_at ?? s.sharedAt,
    };
  }

  private convertCategoryFields(
    s: KvpAPIResponse,
  ): Pick<KvpSuggestion, 'categoryId' | 'categoryName' | 'categoryIcon' | 'categoryColor'> {
    return {
      categoryId: s.category_id ?? s.categoryId ?? 0,
      categoryName: s.category_name ?? s.categoryName ?? '',
      categoryIcon: s.category_icon ?? s.categoryIcon ?? '',
      categoryColor: s.category_color ?? s.categoryColor ?? '',
    };
  }

  private convertFinancialFields(
    s: KvpAPIResponse,
  ): Pick<
    KvpSuggestion,
    | 'expectedBenefit'
    | 'estimatedCost'
    | 'actualSavings'
    | 'implementationDate'
    | 'assignedTo'
    | 'rejectionReason'
    | 'roi'
  > {
    return {
      expectedBenefit: s.expected_benefit ?? s.expectedBenefit,
      estimatedCost: s.estimated_cost ?? s.estimatedCost,
      actualSavings: s.actual_savings ?? s.actualSavings,
      implementationDate: s.implementation_date ?? s.implementationDate,
      assignedTo: s.assigned_to ?? s.assignedTo,
      rejectionReason: s.rejection_reason ?? s.rejectionReason,
      roi: s.roi,
    };
  }

  private convertSuggestionToCamelCase(suggestion: Record<string, unknown>): KvpSuggestion {
    const s = suggestion as KvpAPIResponse;

    return {
      ...this.convertBasicFields(s),
      ...this.convertOrgFields(s),
      ...this.convertUserFields(s),
      ...this.convertCategoryFields(s),
      ...this.convertFinancialFields(s),
    };
  }

  private renderBasicInfo(): void {
    if (!this.suggestion) return;

    const titleEl = $$('#suggestionTitle');
    const submittedByEl = $$('#submittedBy');
    const createdAtEl = $$('#createdAt');
    const departmentEl = $$('#department');

    if (titleEl) titleEl.textContent = this.suggestion.title;
    if (submittedByEl)
      submittedByEl.textContent = `${this.suggestion.submittedByName} ${this.suggestion.submittedByLastname}`;
    if (createdAtEl) createdAtEl.textContent = new Date(this.suggestion.createdAt).toLocaleDateString('de-DE');
    if (departmentEl) departmentEl.textContent = this.suggestion.departmentName;
  }

  private updateVisibilityBadgeIcon(icon: Element, orgLevel: string, visibilityText: Element): void {
    if (orgLevel === 'team') {
      icon.className = 'fas fa-users';
      visibilityText.textContent = this.suggestion?.teamName ?? 'Team';
    } else if (orgLevel === 'department') {
      icon.className = 'fas fa-building';
      visibilityText.textContent = this.suggestion?.departmentName ?? '';
    } else {
      icon.className = 'fas fa-globe';
      visibilityText.textContent = 'Firmenweit';
    }
  }

  private renderStatusBadge(): void {
    if (!this.suggestion) return;
    const statusBadge = $$('#statusBadge');
    if (statusBadge) {
      statusBadge.className = `status-badge ${this.suggestion.status.replace('_', '')}`;
      statusBadge.textContent = this.getStatusText(this.suggestion.status);
    }
  }

  private renderPriorityBadge(): void {
    if (!this.suggestion) return;
    const priorityBadge = $$('#priorityBadge');
    if (priorityBadge) {
      priorityBadge.className = `priority-badge ${this.suggestion.priority}`;
      priorityBadge.textContent = this.getPriorityText(this.suggestion.priority);
    }
  }

  private renderVisibilityBadge(): void {
    if (!this.suggestion) return;
    const visibilityBadge = $$('#visibilityBadge');
    const visibilityText = $$('#visibilityText');
    if (visibilityBadge && visibilityText) {
      const orgLevel = this.suggestion.orgLevel;
      visibilityBadge.className = `visibility-badge ${orgLevel}`;

      const icon = visibilityBadge.querySelector('i');
      if (icon) {
        this.updateVisibilityBadgeIcon(icon, orgLevel, visibilityText);
      }
    }
  }

  private renderVisibilityInfo(): void {
    if (!this.suggestion) return;
    const visibilityInfo = $$('#visibilityInfo');
    if (!visibilityInfo || this.suggestion.orgLevel !== 'company') return;

    const sharedByInfo =
      this.suggestion.sharedByName !== undefined && this.suggestion.sharedByName !== ''
        ? `<span> von ${this.suggestion.sharedByName} am ${this.suggestion.sharedAt !== undefined && this.suggestion.sharedAt !== '' ? new Date(this.suggestion.sharedAt).toLocaleDateString('de-DE') : ''}</span>`
        : '';

    setHTML(
      visibilityInfo,
      `<div class="visibility-badge company">
        <i class="fas fa-globe"></i> Firmenweit geteilt
        ${sharedByInfo}
      </div>`,
    );
  }

  private renderBadges(): void {
    this.renderStatusBadge();
    this.renderPriorityBadge();
    this.renderVisibilityBadge();
    this.renderVisibilityInfo();
  }

  private showFinancialSection(): void {
    const financialSection = document.querySelector('#financialSection');
    if (financialSection instanceof HTMLElement) {
      financialSection.style.display = '';
    }
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }

  private renderEstimatedCost(cost: number): void {
    const estimatedCostEl = document.querySelector('#estimatedCost');
    if (estimatedCostEl) {
      estimatedCostEl.textContent = this.formatCurrency(cost);
    }
  }

  private renderActualSavings(savings: number): void {
    const actualSavingsEl = document.querySelector('#actualSavings');
    if (actualSavingsEl) {
      actualSavingsEl.textContent = this.formatCurrency(savings);
    }
  }

  private renderFinancialInfo(): void {
    if (!this.suggestion) return;

    const hasEstimatedCost = this.suggestion.estimatedCost !== undefined && this.suggestion.estimatedCost !== 0;
    const hasActualSavings = this.suggestion.actualSavings !== undefined && this.suggestion.actualSavings !== 0;

    if (!hasEstimatedCost && !hasActualSavings) return;

    this.showFinancialSection();

    if (hasEstimatedCost && this.suggestion.estimatedCost !== undefined) {
      this.renderEstimatedCost(this.suggestion.estimatedCost);
    }

    if (hasActualSavings && this.suggestion.actualSavings !== undefined) {
      this.renderActualSavings(this.suggestion.actualSavings);
    }
  }

  private renderContent(): void {
    if (!this.suggestion) return;

    // Description
    const descriptionEl = document.querySelector('#description');
    if (descriptionEl) descriptionEl.textContent = this.suggestion.description;

    // Expected benefit
    if (this.suggestion.expectedBenefit !== undefined && this.suggestion.expectedBenefit !== '') {
      const benefitSection = document.querySelector('#benefitSection');
      const expectedBenefit = document.querySelector('#expectedBenefit');
      if (benefitSection instanceof HTMLElement) benefitSection.style.display = '';
      if (expectedBenefit) expectedBenefit.textContent = this.suggestion.expectedBenefit;
    }

    // Financial info
    this.renderFinancialInfo();
  }

  private renderDetailsAndStatus(): void {
    if (!this.suggestion) return;

    this.renderCategory();
    this.renderStatus();
    this.renderAssignedTo();
    this.renderImplementationDate();
    this.renderRejectionReason();
  }

  private renderCategory(): void {
    if (!this.suggestion) return;

    const categoryEl = document.querySelector('#category');
    if (!(categoryEl instanceof HTMLElement)) return;

    setHTML(
      categoryEl,
      `<span style="color: ${this.suggestion.categoryColor}">
        <i class="${this.suggestion.categoryIcon}"></i>
        ${this.suggestion.categoryName}
      </span>`,
    );
  }

  private renderStatus(): void {
    if (!this.suggestion) return;

    const statusElement = document.querySelector('#status');
    const statusDropdownContainer = document.querySelector('#statusDropdownContainer');
    const statusDisplay = document.querySelector('#statusDisplay');

    if (!statusElement || !statusDropdownContainer || !statusDisplay) return;

    const isAdmin = this.isUserAdmin();

    if (isAdmin) {
      this.renderAdminStatus(statusElement, statusDropdownContainer, statusDisplay);
    } else {
      this.renderRegularStatus(statusElement, statusDropdownContainer);
    }
  }

  private isUserAdmin(): boolean {
    return !!(this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'root'));
  }

  private renderAdminStatus(statusElement: Element, statusDropdownContainer: Element, statusDisplay: Element): void {
    if (!this.suggestion) return;

    if (statusElement instanceof HTMLElement) statusElement.style.display = 'none';
    if (statusDropdownContainer instanceof HTMLElement) statusDropdownContainer.style.display = '';

    const statusSpan = statusDisplay.querySelector('span');
    if (statusSpan) statusSpan.textContent = this.getStatusText(this.suggestion.status);

    const statusValue = document.querySelector('#statusValue');
    if (statusValue) statusValue.setAttribute('value', this.suggestion.status);
  }

  private renderRegularStatus(statusElement: Element, statusDropdownContainer: Element): void {
    if (!this.suggestion) return;

    statusElement.textContent = this.getStatusText(this.suggestion.status);
    if (statusDropdownContainer instanceof HTMLElement) statusDropdownContainer.style.display = 'none';
  }

  private renderAssignedTo(): void {
    if (!this.suggestion) return;
    if (this.suggestion.assignedTo === undefined || this.suggestion.assignedTo === 0) return;

    const assignedToItem = document.querySelector('#assignedToItem');
    if (assignedToItem instanceof HTMLElement) {
      assignedToItem.style.display = '';
    }
    // TODO: Load assigned user name
  }

  private renderImplementationDate(): void {
    if (!this.suggestion) return;
    if (!this.hasImplementationDate()) return;

    const implementationItem = document.querySelector('#implementationItem');
    const implementationDate = document.querySelector('#implementationDate');

    if (implementationItem instanceof HTMLElement) {
      implementationItem.style.display = '';
    }

    if (
      implementationDate !== null &&
      this.suggestion.implementationDate !== undefined &&
      this.suggestion.implementationDate !== ''
    ) {
      const dateValue = this.suggestion.implementationDate;
      implementationDate.textContent = new Date(dateValue).toLocaleDateString('de-DE');
    }
  }

  private hasImplementationDate(): boolean {
    return (
      this.suggestion?.implementationDate !== undefined &&
      this.suggestion.implementationDate !== '' &&
      (this.suggestion.implementationDate as string | null) !== null
    );
  }

  private renderRejectionReason(): void {
    if (!this.suggestion) return;
    if (this.suggestion.rejectionReason === undefined || this.suggestion.rejectionReason === '') return;

    const rejectionItem = document.querySelector('#rejectionItem');
    const rejectionReason = document.querySelector('#rejectionReason');

    if (rejectionItem instanceof HTMLElement) {
      rejectionItem.style.display = '';
    }

    if (rejectionReason) {
      rejectionReason.textContent = this.suggestion.rejectionReason;
    }
  }

  private renderSuggestion(): void {
    if (!this.suggestion) return;

    this.renderBasicInfo();
    this.renderBadges();
    this.renderContent();
    this.renderDetailsAndStatus();
  }

  private setupRoleBasedUI(): void {
    if (!this.currentUser || !this.suggestion) return;

    const isAdminOrRoot = this.isUserAdminOrRoot();
    const isAuthor = this.isUserAuthor();
    const canComment = isAdminOrRoot || isAuthor;

    this.configureCommentForm(canComment);
    this.configureAdminElements(isAdminOrRoot);

    if (isAdminOrRoot) {
      this.configureLimitedPermissionsMessage();
      this.configureShareButtons();
    }
  }

  private isUserAdminOrRoot(): boolean {
    return this.currentUser?.role === 'admin' || this.currentUser?.role === 'root';
  }

  private isUserAuthor(): boolean {
    return this.currentUser?.id === this.suggestion?.submittedBy;
  }

  private configureCommentForm(canComment: boolean): void {
    const commentForm = document.querySelector('#commentForm');
    if (!(commentForm instanceof HTMLElement)) return;

    if (canComment) {
      commentForm.classList.remove('hidden');
      commentForm.style.display = '';
    } else {
      commentForm.classList.add('hidden');
      commentForm.style.display = 'none';
    }
  }

  private configureAdminElements(isAdminOrRoot: boolean): void {
    const adminElements = document.querySelectorAll('.admin-only');
    const actionsCard = document.querySelector('#actionsCard');

    if (isAdminOrRoot) {
      adminElements.forEach((el) => ((el as HTMLElement).style.display = ''));
      if (actionsCard instanceof HTMLElement) actionsCard.style.display = '';
    } else {
      adminElements.forEach((el) => ((el as HTMLElement).style.display = 'none'));
      if (actionsCard instanceof HTMLElement) actionsCard.style.display = 'none';
    }
  }

  private configureLimitedPermissionsMessage(): void {
    if (!this.currentUser || !this.suggestion) return;

    const shouldShowMessage =
      this.suggestion.orgLevel === 'company' &&
      this.currentUser.role === 'admin' &&
      this.suggestion.submittedBy !== this.currentUser.id;

    if (!shouldShowMessage) return;

    const statusDropdown = document.querySelector('#statusDropdown');
    if (!statusDropdown) return;

    const infoDiv = document.createElement('div');
    infoDiv.className = 'alert alert-info mt-2';
    infoDiv.innerHTML =
      '<i class="fas fa-info-circle"></i> Nur der Verfasser dieses Vorschlags kann Änderungen vornehmen.';
    statusDropdown.parentElement?.append(infoDiv);
  }

  private configureShareButtons(): void {
    if (!this.suggestion) return;

    const shareBtn = document.querySelector('#shareBtn');
    const unshareBtn = document.querySelector('#unshareBtn');

    switch (this.suggestion.orgLevel) {
      case 'team':
        this.configureTeamLevelButtons(shareBtn, unshareBtn);
        break;
      case 'department':
        this.configureDepartmentLevelButtons(shareBtn, unshareBtn);
        break;
      default:
        this.configureCompanyLevelButtons(shareBtn, unshareBtn);
        break;
    }
  }

  private configureTeamLevelButtons(shareBtn: Element | null, unshareBtn: Element | null): void {
    if (shareBtn instanceof HTMLElement) shareBtn.style.display = '';
    if (unshareBtn instanceof HTMLElement) unshareBtn.style.display = 'none';
  }

  private configureDepartmentLevelButtons(shareBtn: Element | null, unshareBtn: Element | null): void {
    if (shareBtn instanceof HTMLElement) shareBtn.style.display = '';

    const canUnshare = this.canUserUnshare();
    if (unshareBtn instanceof HTMLElement) {
      unshareBtn.style.display = canUnshare ? '' : 'none';
    }
  }

  private configureCompanyLevelButtons(shareBtn: Element | null, unshareBtn: Element | null): void {
    if (shareBtn instanceof HTMLElement) shareBtn.style.display = 'none';

    const canUnshare = this.canUserUnshare();
    if (unshareBtn instanceof HTMLElement) {
      unshareBtn.style.display = canUnshare ? '' : 'none';
    }
  }

  private canUserUnshare(): boolean {
    return !!(
      this.currentUser &&
      this.suggestion &&
      (this.currentUser.role === 'root' || this.suggestion.sharedBy === this.currentUser.id)
    );
  }

  private async loadComments(): Promise<void> {
    try {
      const comments = await this.apiClient.get<Comment[]>(`/kvp/${this.suggestionId}/comments`);
      this.renderComments(comments);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  }

  private renderComments(comments: Comment[]): void {
    const container = document.querySelector('#commentList');
    if (!container) return;

    if (comments.length === 0) {
      setHTML(container as HTMLElement, '<p class="empty-state">Noch keine Kommentare</p>');
      return;
    }

    setHTML(
      container as HTMLElement,
      comments
        .map((comment) => {
          const initials = `${comment.firstName[0]}${comment.lastName[0]}`.toUpperCase();
          const commentClass = comment.isInternal ? 'comment-item comment-internal' : 'comment-item';

          return `
        <div class="${commentClass}">
          <div class="comment-header">
            <div class="comment-author">
              <div class="user-avatar avatar-initials">${initials}</div>
              <div>
                <strong>${comment.firstName} ${comment.lastName}</strong>
                ${comment.isInternal ? '<span class="internal-badge">Intern</span>' : ''}
              </div>
            </div>
            <span class="comment-date">
              ${new Date(comment.createdAt).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <div class="comment-content">
            ${this.escapeHtml(comment.comment)}
          </div>
        </div>
      `;
        })
        .join(''),
    );
  }

  private async loadAttachments(): Promise<void> {
    try {
      const attachments = await this.apiClient.get<Attachment[]>(`/kvp/${this.suggestionId}/attachments`);
      this.renderAttachments(attachments);
    } catch (error) {
      console.error('Error loading attachments:', error);
    }
  }

  private renderPhotoGallery(photos: Attachment[]): void {
    const photoSection = document.querySelector('#photoSection');
    const photoGallery = document.querySelector('#photoGallery');

    if (photoSection instanceof HTMLElement) photoSection.style.display = '';
    if (!photoGallery) return;

    const token = getAuthToken();
    const tokenParam = token !== null && token !== '' ? token : '';

    setHTML(
      photoGallery as HTMLElement,
      photos
        .map(
          (photo, index) => `
        <div class="photo-thumbnail" data-action="open-lightbox" data-url="/api/v2/kvp/attachments/${photo.id}/download?token=${encodeURIComponent(tokenParam)}">
          <img src="/api/v2/kvp/attachments/${photo.id}/download?token=${encodeURIComponent(tokenParam)}"
               alt="${this.escapeHtml(photo.fileName)}"
               loading="lazy">
          ${index === 0 && photos.length > 1 ? `<span class="photo-count">${photos.length} Fotos</span>` : ''}
        </div>
      `,
        )
        .join(''),
    );
  }

  private renderOtherAttachments(otherFiles: Attachment[]): void {
    const attachmentsCard = document.querySelector('#attachmentsCard');
    const container = document.querySelector('#attachmentList');

    if (attachmentsCard instanceof HTMLElement) attachmentsCard.style.display = '';
    if (!container) return;

    setHTML(
      container as HTMLElement,
      otherFiles
        .map((attachment) => {
          const fileIcon = this.getFileIcon(attachment.fileType);
          const fileSize = this.formatFileSize(attachment.fileSize);

          return `
          <div class="attachment-item" data-id="${attachment.id}">
            <i class="${fileIcon}"></i>
            <div class="attachment-info">
              <div class="attachment-name">${this.escapeHtml(attachment.fileName)}</div>
              <div class="attachment-meta">
                ${fileSize} • ${attachment.uploadedByName} ${attachment.uploadedByLastname}
              </div>
            </div>
            <i class="fas fa-download"></i>
          </div>
        `;
        })
        .join(''),
    );

    // Add click handlers
    container.querySelectorAll('.attachment-item').forEach((item) => {
      item.addEventListener('click', () => {
        const id = getData(item as HTMLElement, 'id');
        if (id !== undefined && id !== '') {
          this.downloadAttachment(Number.parseInt(id, 10));
        }
      });
    });
  }

  private renderAttachments(attachments: Attachment[]): void {
    if (attachments.length === 0) return;

    // Filter photo attachments
    const photoTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const photos = attachments.filter((att) => photoTypes.includes(att.fileType));
    const otherFiles = attachments.filter((att) => !photoTypes.includes(att.fileType));

    // Render photo gallery
    if (photos.length > 0) {
      this.renderPhotoGallery(photos);
    }

    // Render other attachments
    if (otherFiles.length > 0) {
      this.renderOtherAttachments(otherFiles);
    }
  }

  private downloadAttachment(attachmentId: number): void {
    try {
      const token = getAuthToken();
      if (token === null || token === '') {
        this.showError('Nicht authentifiziert');
        return;
      }
      // Add token as query parameter for authentication
      window.open(`/api/v2/kvp/attachments/${attachmentId}/download?token=${encodeURIComponent(token)}`, '_blank');
    } catch (error) {
      console.error('Error downloading attachment:', error);
      this.showError('Fehler beim Download');
    }
  }

  private setupCommentFormListener(): void {
    const commentForm = document.querySelector('#commentForm');
    if (commentForm) {
      commentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        void (async () => {
          await this.addComment();
        })();
      });
    }
  }

  private setupLightboxListener(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const thumbnail = target.closest('[data-action="open-lightbox"]');

      if (thumbnail instanceof HTMLElement) {
        const url = thumbnail.dataset.url;
        if (url !== undefined && url !== '' && typeof window.openLightbox === 'function') {
          window.openLightbox(url);
        }
      }
    });
  }

  private setupActionButtons(): void {
    document.querySelector('#editBtn')?.addEventListener('click', () => {
      // TODO: Navigate to edit page
      console.warn('Bearbeiten-Funktion noch nicht implementiert');
      this.showError('Bearbeiten-Funktion noch nicht implementiert');
    });

    document.querySelector('#shareBtn')?.addEventListener('click', () => {
      this.openShareModal();
    });

    document.querySelector('#unshareBtn')?.addEventListener('click', () => {
      void (async () => {
        await this.unshareSuggestion();
      })();
    });

    document.querySelector('#archiveBtn')?.addEventListener('click', () => {
      void (async () => {
        await this.archiveSuggestion();
      })();
    });
  }

  private setupCustomEventListeners(): void {
    // Listen for share event from modal
    window.addEventListener('shareKvp', (event: Event) => {
      const customEvent = event as CustomEvent;
      interface ShareDetail {
        orgLevel: 'company' | 'department' | 'team';
        orgId: number | null;
      }
      const detail = customEvent.detail as ShareDetail;
      void this.shareSuggestion(detail.orgLevel, detail.orgId);
    });

    // Listen for load organization data event
    window.addEventListener('loadOrgData', () => {
      void this.loadOrganizations();
    });

    // Status change listener for custom dropdown
    document.addEventListener('statusChange', (e: Event) => {
      void (async () => {
        const customEvent = e as CustomEvent;
        interface StatusChangeDetail {
          status: string;
        }

        const detail = customEvent.detail as StatusChangeDetail | null;
        if (detail?.status !== undefined && detail.status !== '') {
          await this.updateStatus(detail.status);
        }
      })();
    });
  }

  private setupEventListeners(): void {
    this.setupCommentFormListener();
    this.setupLightboxListener();
    this.setupActionButtons();
    this.setupCustomEventListeners();
  }

  private async addComment(): Promise<void> {
    const input = document.querySelector('#commentInput');

    if (!(input instanceof HTMLTextAreaElement)) return;
    const comment = input.value.trim();
    if (comment === '') return;

    try {
      await this.apiClient.post(`/kvp/${this.suggestionId}/comments`, {
        comment,
      });

      // Clear form
      input.value = '';

      // Reload comments
      await this.loadComments();

      this.showSuccess('Kommentar hinzugefügt');
    } catch (error) {
      console.error('Error adding comment:', error);
      this.showError('Fehler beim Hinzufügen des Kommentars');
    }
  }

  private openShareModal(): void {
    void this.loadOrganizations();
    this.preselectOrganization();
    this.triggerModalOpen();
  }

  private preselectOrganization(): void {
    if (this.suggestion === null) return;

    const { orgLevel, departmentId, teamId } = this.suggestion;
    const radioBtn = document.querySelector<HTMLInputElement>(
      `#share${orgLevel.charAt(0).toUpperCase() + orgLevel.slice(1)}`,
    );

    if (radioBtn === null) return;

    radioBtn.checked = true;
    this.preselectOrgLevel(orgLevel, teamId, departmentId);
  }

  private preselectOrgLevel(orgLevel: string, teamId?: number, departmentId?: number): void {
    if (orgLevel === 'team') {
      this.preselectTeam(teamId);
    } else if (orgLevel === 'department') {
      this.preselectDepartment(departmentId);
    }
  }

  private preselectTeam(teamId?: number): void {
    if (teamId === undefined) return;

    const teamSelect = document.querySelector<HTMLSelectElement>('#teamSelect');
    if (teamSelect === null) return;

    teamSelect.style.display = 'block';
    teamSelect.dataset.preselect = String(teamId);
  }

  private preselectDepartment(departmentId?: number): void {
    if (departmentId === undefined) return;

    const deptSelect = document.querySelector<HTMLSelectElement>('#departmentSelect');
    if (deptSelect === null) return;

    deptSelect.style.display = 'block';
    deptSelect.dataset.preselect = String(departmentId);
  }

  private triggerModalOpen(): void {
    const w = window as Window & { openShareModal?: () => void };
    if (w.openShareModal !== undefined) {
      w.openShareModal();
    }
  }

  private async loadOrganizations(): Promise<void> {
    try {
      // Load teams
      const teams = await this.apiClient.get<{ id: number; name: string }[]>('/teams');
      const teamSelect = document.querySelector<HTMLSelectElement>('#teamSelect');
      if (teamSelect !== null && Array.isArray(teams)) {
        teamSelect.innerHTML = '<option value="">Team auswählen...</option>';
        teams.forEach((team) => {
          const option = document.createElement('option');
          option.value = String(team.id);
          option.textContent = team.name;
          teamSelect.append(option);
        });

        // Pre-select if needed
        const preselect = teamSelect.dataset.preselect;
        if (preselect !== undefined) {
          teamSelect.value = preselect;
          delete teamSelect.dataset.preselect;
        }
      }

      // Load departments
      const departments = await this.apiClient.get<{ id: number; name: string }[]>('/departments');
      const deptSelect = document.querySelector<HTMLSelectElement>('#departmentSelect');
      if (deptSelect !== null && Array.isArray(departments)) {
        deptSelect.innerHTML = '<option value="">Abteilung auswählen...</option>';
        departments.forEach((dept) => {
          const option = document.createElement('option');
          option.value = String(dept.id);
          option.textContent = dept.name;
          deptSelect.append(option);
        });

        // Pre-select if needed
        const preselect = deptSelect.dataset.preselect;
        if (preselect !== undefined) {
          deptSelect.value = preselect;
          delete deptSelect.dataset.preselect;
        }
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
    }
  }

  private determineFinalOrgId(orgLevel: string, orgId: number | null): number | null {
    if (orgLevel === 'company' && this.currentUser !== null) {
      return this.currentUser.tenantId;
    }
    return orgId;
  }

  private getShareLevelText(orgLevel: string): string {
    if (orgLevel === 'company') return 'Firmenebene';
    if (orgLevel === 'department') return 'Abteilungsebene';
    return 'Teamebene';
  }

  private async shareSuggestion(orgLevel: 'company' | 'department' | 'team', orgId: number | null): Promise<void> {
    try {
      const finalOrgId = this.determineFinalOrgId(orgLevel, orgId);

      if (finalOrgId === null) {
        this.showError('Ungültige Organisation ausgewählt');
        return;
      }

      // Use v2 API with PUT method
      const result = await this.apiClient.put(`/kvp/${this.suggestionId}/share`, {
        orgLevel,
        orgId: finalOrgId,
      });

      if (result !== null && result !== undefined) {
        this.showSuccess(`Vorschlag wurde auf ${this.getShareLevelText(orgLevel)} geteilt`);
        // Reload page to update UI
        await this.loadSuggestion();
        this.setupRoleBasedUI();
      }
    } catch (error) {
      console.error('Error sharing suggestion:', error);
      this.showError('Fehler beim Teilen des Vorschlags');
    }
  }

  private async unshareSuggestion(): Promise<void> {
    const confirmed = await this.showConfirmDialog('Möchten Sie das Teilen wirklich rückgängig machen?');
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/kvp/${this.suggestionId}/unshare`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to unshare suggestion');

      this.showSuccess('Teilen wurde rückgängig gemacht');

      // Reload page to update UI
      await this.loadSuggestion();
      this.setupRoleBasedUI();
    } catch (error) {
      console.error('Error unsharing suggestion:', error);
      this.showError('Fehler beim Rückgängigmachen');
    }
  }

  private async archiveSuggestion(): Promise<void> {
    const confirmed = await this.showConfirmDialog('Möchten Sie diesen Vorschlag wirklich archivieren?');
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/kvp/${this.suggestionId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
        },
      });

      if (!response.ok) throw new Error('Failed to archive suggestion');

      this.showSuccess('Vorschlag wurde archiviert');

      // Navigate back to list
      setTimeout(() => (window.location.href = '/kvp'), 1500);
    } catch (error) {
      console.error('Error archiving suggestion:', error);
      this.showError('Fehler beim Archivieren');
    }
  }

  private async updateStatus(newStatus: string): Promise<void> {
    try {
      if (!this.hasStatusUpdatePermission()) {
        this.showError('Keine Berechtigung zum Ändern des Status');
        return;
      }

      const updateData = await this.buildStatusUpdateData(newStatus);
      if (!updateData) {
        this.resetStatusDropdown();
        return;
      }

      await this.performStatusUpdate(updateData);
      this.updateStatusUI(newStatus, updateData.rejectionReason);
      this.showSuccess(`Status geändert zu: ${this.getStatusText(newStatus)}`);
    } catch (error) {
      this.handleStatusUpdateError(error);
    }
  }

  private hasStatusUpdatePermission(): boolean {
    return !!(this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'root'));
  }

  private async buildStatusUpdateData(newStatus: string): Promise<{ status: string; rejectionReason?: string } | null> {
    const updateData: { status: string; rejectionReason?: string } = {
      status: newStatus,
    };

    if (newStatus === 'rejected') {
      const rejectionReason = await this.getRejectionReason();
      if (rejectionReason === null) return null;
      updateData.rejectionReason = rejectionReason;
    }

    return updateData;
  }

  private async getRejectionReason(): Promise<string | null> {
    const reason = await this.showPromptDialog('Bitte geben Sie einen Ablehnungsgrund an:');
    if (reason === null || reason.trim() === '') {
      this.showError('Ein Ablehnungsgrund ist erforderlich');
      return null;
    }
    return reason.trim();
  }

  private async performStatusUpdate(updateData: { status: string; rejectionReason?: string }): Promise<void> {
    try {
      const data = await this.apiClient.put<{ suggestion: KvpSuggestion }>(`/kvp/${this.suggestionId}`, updateData);
      this.suggestion = data.suggestion;
    } catch (error: unknown) {
      this.throwStatusUpdateError(error);
    }
  }

  private throwStatusUpdateError(error: unknown): never {
    if (error instanceof Error && error.message.includes('403')) {
      const isCompanyLevel = this.suggestion?.orgLevel === 'company';
      const isNotAuthor = this.suggestion?.submittedBy !== this.currentUser?.id;

      if (isCompanyLevel && isNotAuthor) {
        throw new Error('Nur der Verfasser dieses Vorschlags kann den Status ändern');
      } else {
        throw new Error('Sie haben keine Berechtigung, diesen Vorschlag zu bearbeiten');
      }
    }
    throw error;
  }

  private updateStatusUI(newStatus: string, rejectionReason?: string): void {
    this.updateStatusBadge(newStatus);
    this.updateRejectionReasonDisplay(newStatus, rejectionReason);
  }

  private updateStatusBadge(newStatus: string): void {
    const statusBadge = document.querySelector('#statusBadge');
    if (!statusBadge) return;

    statusBadge.className = `status-badge ${newStatus.replace('_', '')}`;
    statusBadge.textContent = this.getStatusText(newStatus);
  }

  private updateRejectionReasonDisplay(newStatus: string, rejectionReason?: string): void {
    const rejectionItem = document.querySelector('#rejectionItem');
    const rejectionReasonEl = document.querySelector('#rejectionReason');

    if (newStatus === 'rejected' && rejectionReason !== undefined && rejectionReason !== '') {
      if (rejectionItem instanceof HTMLElement) rejectionItem.style.display = '';
      if (rejectionReasonEl) rejectionReasonEl.textContent = rejectionReason;
    } else if (newStatus !== 'rejected' && rejectionItem instanceof HTMLElement) {
      rejectionItem.style.display = 'none';
    }
  }

  private handleStatusUpdateError(error: unknown): void {
    console.error('Error updating status:', error);

    if (error instanceof Error) {
      this.showError(error.message);
    } else {
      this.showError('Fehler beim Aktualisieren des Status');
    }

    this.resetStatusDropdown();
  }

  private resetStatusDropdown(): void {
    const statusDisplay = document.querySelector('#statusDisplay');
    if (!statusDisplay || !this.suggestion) return;

    const statusSpan = statusDisplay.querySelector('span');
    if (statusSpan) statusSpan.textContent = this.getStatusText(this.suggestion.status);

    const statusValue = document.querySelector('#statusValue');
    if (statusValue) statusValue.setAttribute('value', this.suggestion.status);
  }

  private getStatusText(status: string): string {
    // Safely access with switch statement to avoid object injection
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

  private getPriorityText(priority: string): string {
    // Safely access with switch statement to avoid object injection
    switch (priority) {
      case 'low':
        return 'Niedrig';
      case 'normal':
        return 'Normal';
      case 'high':
        return 'Hoch';
      case 'urgent':
        return 'Dringend';
      default:
        return priority;
    }
  }

  private getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'fas fa-image';
    if (mimeType === 'application/pdf') return 'fas fa-file-pdf';
    if (mimeType.includes('word')) return 'fas fa-file-word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fas fa-file-excel';
    return 'fas fa-file';
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private showSuccess(message: string): void {
    showSuccessAlert(message);
  }

  private showError(message: string): void {
    showErrorAlert(message);
  }

  private async showConfirmDialog(message: string): Promise<boolean> {
    // Use the consistent confirm dialog from alerts.ts
    return await showConfirm(message);
  }

  private async showPromptDialog(message: string): Promise<string | null> {
    // TODO: Implement custom prompt dialog
    // For now, return empty string to avoid using native prompt
    console.warn('Prompt dialog not implemented:', message);
    return await Promise.resolve(''); // Return empty string as default
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new KvpDetailPage();
});
