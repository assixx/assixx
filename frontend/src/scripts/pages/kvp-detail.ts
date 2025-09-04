/**
 * KVP Detail Page Script
 * Handles detailed view of KVP suggestions
 */

import { ApiClient } from '../../utils/api-client';
import { $$, setHTML, getData } from '../../utils/dom-utils';
import { getAuthToken } from '../auth';
import { showSuccessAlert, showErrorAlert, showConfirm } from '../utils/alerts';

interface User {
  id: number;
  role: 'root' | 'admin' | 'employee';
  tenantId: number;
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

  private convertSuggestionToCamelCase(suggestion: Record<string, unknown>): KvpSuggestion {
    // Following the pattern from api-mappers.ts for safe type conversion
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

    const s = suggestion as KvpAPIResponse;

    return {
      id: s.id ?? 0,
      title: s.title ?? '',
      description: s.description ?? '',
      status: (s.status ?? 'new') as KvpSuggestion['status'],
      priority: (s.priority ?? 'normal') as KvpSuggestion['priority'],
      orgLevel: (s.org_level ?? s.orgLevel ?? 'company') as KvpSuggestion['orgLevel'],
      orgId: s.org_id ?? s.orgId ?? 0,
      departmentId: s.department_id ?? s.departmentId ?? 0,
      departmentName: s.department_name ?? s.departmentName ?? '',
      teamId: s.team_id ?? s.teamId,
      teamName: s.team_name ?? s.teamName,
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
      implementationDate: s.implementation_date ?? s.implementationDate,
      assignedTo: s.assigned_to ?? s.assignedTo,
      rejectionReason: s.rejection_reason ?? s.rejectionReason,
      roi: s.roi,
    };
  }

  private renderSuggestion(): void {
    if (!this.suggestion) return;

    // Basic info
    const titleEl = $$('#suggestionTitle');
    const submittedByEl = $$('#submittedBy');
    const createdAtEl = $$('#createdAt');
    const departmentEl = $$('#department');

    if (titleEl) titleEl.textContent = this.suggestion.title;
    if (submittedByEl)
      submittedByEl.textContent = `${this.suggestion.submittedByName} ${this.suggestion.submittedByLastname}`;
    if (createdAtEl) createdAtEl.textContent = new Date(this.suggestion.createdAt).toLocaleDateString('de-DE');
    if (departmentEl) departmentEl.textContent = this.suggestion.departmentName;

    // Status and Priority
    const statusBadge = $$('#statusBadge');
    if (statusBadge) {
      statusBadge.className = `status-badge ${this.suggestion.status.replace('_', '')}`;
      statusBadge.textContent = this.getStatusText(this.suggestion.status);
    }

    const priorityBadge = $$('#priorityBadge');
    if (priorityBadge) {
      priorityBadge.className = `priority-badge ${this.suggestion.priority}`;
      priorityBadge.textContent = this.getPriorityText(this.suggestion.priority);
    }

    // Visibility Badge
    const visibilityBadge = $$('#visibilityBadge');
    const visibilityText = $$('#visibilityText');
    if (visibilityBadge && visibilityText) {
      const orgLevel = this.suggestion.orgLevel;
      visibilityBadge.className = `visibility-badge ${orgLevel}`;

      // Set icon and text based on org level
      const icon = visibilityBadge.querySelector('i');
      if (icon) {
        if (orgLevel === 'team') {
          icon.className = 'fas fa-users';
          visibilityText.textContent = this.suggestion.teamName ?? 'Team';
        } else if (orgLevel === 'department') {
          icon.className = 'fas fa-building';
          visibilityText.textContent = this.suggestion.departmentName;
        } else {
          icon.className = 'fas fa-globe';
          visibilityText.textContent = 'Firmenweit';
        }
      }
    }

    // Visibility info
    const visibilityInfo = $$('#visibilityInfo');
    if (!visibilityInfo) return;
    if (this.suggestion.orgLevel === 'company') {
      setHTML(
        visibilityInfo,
        `<div class="visibility-badge company">
          <i class="fas fa-globe"></i> Firmenweit geteilt
          ${
            this.suggestion.sharedByName !== undefined && this.suggestion.sharedByName !== ''
              ? `<span> von ${this.suggestion.sharedByName} am ${this.suggestion.sharedAt !== undefined && this.suggestion.sharedAt !== '' ? new Date(this.suggestion.sharedAt).toLocaleDateString('de-DE') : ''}</span>`
              : ''
          }
        </div>`,
      );
    } // else {
    // setHTML(
    // visibilityInfo,
    //`<div class="visibility-badge department">
    //<i class="fas fa-building"></i> Abteilung: ${this.suggestion.departmentName}
    //</div>`,
    //);
    //}

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
    if (
      (this.suggestion.estimatedCost !== undefined && this.suggestion.estimatedCost !== 0) ||
      (this.suggestion.actualSavings !== undefined && this.suggestion.actualSavings !== 0)
    ) {
      const financialSection = document.querySelector('#financialSection');
      if (financialSection instanceof HTMLElement) financialSection.style.display = '';

      if (this.suggestion.estimatedCost !== undefined && this.suggestion.estimatedCost !== 0) {
        const estimatedCostEl = document.querySelector('#estimatedCost');
        if (estimatedCostEl) {
          estimatedCostEl.textContent = new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
          }).format(this.suggestion.estimatedCost);
        }
      }

      if (this.suggestion.actualSavings !== undefined && this.suggestion.actualSavings !== 0) {
        const actualSavingsEl = document.querySelector('#actualSavings');
        if (actualSavingsEl) {
          actualSavingsEl.textContent = new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
          }).format(this.suggestion.actualSavings);
        }
      }
    }

    // Details sidebar
    const categoryEl = document.querySelector('#category');
    if (categoryEl instanceof HTMLElement) {
      setHTML(
        categoryEl,
        `<span style="color: ${this.suggestion.categoryColor}">
          <i class="${this.suggestion.categoryIcon}"></i>
          ${this.suggestion.categoryName}
        </span>`,
      );
    }

    // For non-admins, just show the status text
    const statusElement = document.querySelector('#status');
    const statusDropdownContainer = document.querySelector('#statusDropdownContainer');
    const statusDisplay = document.querySelector('#statusDisplay');

    if (!statusElement || !statusDropdownContainer || !statusDisplay) return;

    if (this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'root')) {
      // Hide the status text and show the dropdown for admins
      if (statusElement instanceof HTMLElement) statusElement.style.display = 'none';
      if (statusDropdownContainer instanceof HTMLElement) statusDropdownContainer.style.display = '';

      // Update the dropdown display text
      const statusSpan = statusDisplay.querySelector('span');
      if (statusSpan) statusSpan.textContent = this.getStatusText(this.suggestion.status);
      const statusValue = document.querySelector('#statusValue');
      if (statusValue) statusValue.setAttribute('value', this.suggestion.status);
    } else {
      // Show only the status text for regular users
      statusElement.textContent = this.getStatusText(this.suggestion.status);
      if (statusDropdownContainer instanceof HTMLElement) statusDropdownContainer.style.display = 'none';
    }

    if (this.suggestion.assignedTo !== undefined && this.suggestion.assignedTo !== 0) {
      const assignedToItem = document.querySelector('#assignedToItem');
      if (assignedToItem instanceof HTMLElement) assignedToItem.style.display = '';
      // TODO: Load assigned user name
    }

    // Check for valid implementation date (not undefined, null, or empty string)
    if (
      this.suggestion.implementationDate !== undefined &&
      this.suggestion.implementationDate !== '' &&
      // Type assertion needed because API can return null even though type says string | undefined
      (this.suggestion.implementationDate as string | null) !== null
    ) {
      const implementationItem = document.querySelector('#implementationItem');
      const implementationDate = document.querySelector('#implementationDate');
      if (implementationItem instanceof HTMLElement) implementationItem.style.display = '';
      if (implementationDate) {
        // Store in a const to avoid type issues
        const dateValue = this.suggestion.implementationDate;
        implementationDate.textContent = new Date(dateValue).toLocaleDateString('de-DE');
      }
    }

    if (this.suggestion.rejectionReason !== undefined && this.suggestion.rejectionReason !== '') {
      const rejectionItem = document.querySelector('#rejectionItem');
      const rejectionReason = document.querySelector('#rejectionReason');
      if (rejectionItem instanceof HTMLElement) rejectionItem.style.display = '';
      if (rejectionReason) rejectionReason.textContent = this.suggestion.rejectionReason;
    }
  }

  private setupRoleBasedUI(): void {
    if (!this.currentUser || !this.suggestion) return;

    // Check if user is admin/root OR the author of the suggestion
    const isAdminOrRoot = this.currentUser.role === 'admin' || this.currentUser.role === 'root';
    const isAuthor = this.currentUser.id === this.suggestion.submittedBy;
    const canComment = isAdminOrRoot || isAuthor;

    // Show/hide comment form based on permissions
    const commentForm = document.querySelector('#commentForm');
    if (commentForm instanceof HTMLElement) {
      commentForm.style.display = canComment ? '' : 'none';
    }

    // Show/hide admin elements (only for admin/root, NOT for employee authors)
    const adminElements = document.querySelectorAll('.admin-only');
    if (isAdminOrRoot) {
      adminElements.forEach((el) => ((el as HTMLElement).style.display = ''));

      // Show actions card
      const actionsCard = document.querySelector('#actionsCard');
      if (actionsCard instanceof HTMLElement) actionsCard.style.display = '';

      // Configure share/unshare buttons
      const shareBtn = document.querySelector('#shareBtn');
      const unshareBtn = document.querySelector('#unshareBtn');

      // Add info message for limited permissions
      if (
        this.suggestion.orgLevel === 'company' &&
        this.currentUser.role === 'admin' &&
        this.suggestion.submittedBy !== this.currentUser.id
      ) {
        // Admin but not the author - show info message
        const statusDropdown = document.querySelector('#statusDropdown');
        if (statusDropdown) {
          const infoDiv = document.createElement('div');
          infoDiv.className = 'alert alert-info mt-2';
          infoDiv.innerHTML =
            '<i class="fas fa-info-circle"></i> Nur der Verfasser dieses Vorschlags kann Änderungen vornehmen.';
          statusDropdown.parentElement?.append(infoDiv);
        }
      }

      // Handle share/unshare button visibility based on org level
      if (this.suggestion.orgLevel === 'team') {
        // Team level: can share but not unshare (it's already at lowest level)
        if (shareBtn instanceof HTMLElement) shareBtn.style.display = '';
        if (unshareBtn instanceof HTMLElement) unshareBtn.style.display = 'none';
      } else if (this.suggestion.orgLevel === 'department') {
        // Department level: can share to company or unshare to team
        if (shareBtn instanceof HTMLElement) shareBtn.style.display = '';
        if (
          (this.currentUser.role === 'root' || this.suggestion.sharedBy === this.currentUser.id) &&
          unshareBtn instanceof HTMLElement
        ) {
          unshareBtn.style.display = '';
        } else if (unshareBtn instanceof HTMLElement) {
          unshareBtn.style.display = 'none';
        }
      } else {
        // Company level: can only unshare (already at highest level)
        if (shareBtn instanceof HTMLElement) shareBtn.style.display = 'none';
        if (
          (this.currentUser.role === 'root' || this.suggestion.sharedBy === this.currentUser.id) &&
          unshareBtn instanceof HTMLElement
        ) {
          unshareBtn.style.display = '';
        } else if (unshareBtn instanceof HTMLElement) {
          unshareBtn.style.display = 'none';
        }
      }
    } else {
      // For employees (including authors), hide admin-only elements
      adminElements.forEach((el) => ((el as HTMLElement).style.display = 'none'));

      // Hide actions card for employees
      const actionsCard = document.querySelector('#actionsCard');
      if (actionsCard instanceof HTMLElement) actionsCard.style.display = 'none';
    }
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

  private renderAttachments(attachments: Attachment[]): void {
    if (attachments.length === 0) return;

    // Filter photo attachments
    const photoTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const photos = attachments.filter((att) => photoTypes.includes(att.fileType));
    const otherFiles = attachments.filter((att) => !photoTypes.includes(att.fileType));

    // Render photo gallery
    if (photos.length > 0) {
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
        <div class="photo-thumbnail" onclick="window.openLightbox('/api/v2/kvp/attachments/${photo.id}/download?token=${encodeURIComponent(tokenParam)}')">
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

    // Render other attachments
    if (otherFiles.length > 0) {
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

  private setupEventListeners(): void {
    // Comment form
    const commentForm = document.querySelector('#commentForm');
    if (commentForm) {
      commentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        void (async () => {
          await this.addComment();
        })();
      });
    }

    // Action buttons
    document.querySelector('#editBtn')?.addEventListener('click', () => {
      // TODO: Navigate to edit page
      console.warn('Bearbeiten-Funktion noch nicht implementiert');
      this.showError('Bearbeiten-Funktion noch nicht implementiert');
    });

    document.querySelector('#shareBtn')?.addEventListener('click', () => {
      this.openShareModal();
    });

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
    // Load organizations first
    void this.loadOrganizations();

    // Pre-select current organization level
    if (this.suggestion !== null) {
      const { orgLevel, departmentId, teamId } = this.suggestion;

      // Select the radio button
      const radioBtn = document.querySelector<HTMLInputElement>(
        `#share${orgLevel.charAt(0).toUpperCase() + orgLevel.slice(1)}`,
      );
      if (radioBtn !== null) {
        radioBtn.checked = true;

        // Show the appropriate select and pre-select value
        if (orgLevel === 'team' && teamId !== undefined) {
          const teamSelect = document.querySelector<HTMLSelectElement>('#teamSelect');
          if (teamSelect !== null) {
            teamSelect.style.display = 'block';
            // Value will be selected after teams are loaded
            teamSelect.dataset.preselect = String(teamId);
          }
        } else if (orgLevel === 'department') {
          const deptSelect = document.querySelector<HTMLSelectElement>('#departmentSelect');
          if (deptSelect !== null) {
            deptSelect.style.display = 'block';
            // Value will be selected after departments are loaded
            deptSelect.dataset.preselect = String(departmentId);
          }
        }
      }
    }

    // Open modal using global function
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

  private async shareSuggestion(orgLevel: 'company' | 'department' | 'team', orgId: number | null): Promise<void> {
    try {
      // Determine the correct orgId based on level
      let finalOrgId = orgId;
      if (orgLevel === 'company' && this.currentUser !== null) {
        finalOrgId = this.currentUser.tenantId;
      }

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
        this.showSuccess(
          `Vorschlag wurde auf ${orgLevel === 'company' ? 'Firmenebene' : orgLevel === 'department' ? 'Abteilungsebene' : 'Teamebene'} geteilt`,
        );
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
      // Only allow admins and root users to update status
      if (!this.currentUser || (this.currentUser.role !== 'admin' && this.currentUser.role !== 'root')) {
        this.showError('Keine Berechtigung zum Ändern des Status');
        return;
      }

      interface UpdateData {
        status: string;
        rejectionReason?: string;
      }

      const updateData: UpdateData = {
        status: newStatus,
      };

      // If status is rejected, ask for rejection reason
      if (newStatus === 'rejected') {
        const reason = await this.showPromptDialog('Bitte geben Sie einen Ablehnungsgrund an:');
        if (reason === null || reason.trim() === '') {
          this.showError('Ein Ablehnungsgrund ist erforderlich');
          // Reset dropdown
          const statusDisplay = document.querySelector('#statusDisplay');
          if (statusDisplay && this.suggestion) {
            const statusSpan = statusDisplay.querySelector('span');
            if (statusSpan) statusSpan.textContent = this.getStatusText(this.suggestion.status);
            const statusValue = document.querySelector('#statusValue');
            if (statusValue) statusValue.setAttribute('value', this.suggestion.status);
          }
          return;
        }
        updateData.rejectionReason = reason.trim();
      }

      try {
        const data = await this.apiClient.put<{ suggestion: KvpSuggestion }>(`/kvp/${this.suggestionId}`, updateData);
        this.suggestion = data.suggestion;
      } catch (error: unknown) {
        // Handle specific error cases
        if (error instanceof Error && error.message.includes('403')) {
          if (
            this.suggestion !== null &&
            this.suggestion.orgLevel === 'company' &&
            this.suggestion.submittedBy !== this.currentUser.id
          ) {
            throw new Error('Nur der Verfasser dieses Vorschlags kann den Status ändern');
          } else {
            throw new Error('Sie haben keine Berechtigung, diesen Vorschlag zu bearbeiten');
          }
        }
        throw error;
      }

      // Update the status badge
      const statusBadge = document.querySelector('#statusBadge');
      if (!statusBadge) return;
      statusBadge.className = `status-badge ${newStatus.replace('_', '')}`;
      statusBadge.textContent = this.getStatusText(newStatus);

      // Update rejection reason display
      const rejectionItem = document.querySelector('#rejectionItem');
      const rejectionReason = document.querySelector('#rejectionReason');

      if (newStatus === 'rejected' && updateData.rejectionReason !== undefined && updateData.rejectionReason !== '') {
        if (rejectionItem instanceof HTMLElement) rejectionItem.style.display = '';
        if (rejectionReason) rejectionReason.textContent = updateData.rejectionReason;
      } else if (newStatus !== 'rejected' && rejectionItem instanceof HTMLElement) {
        rejectionItem.style.display = 'none';
      }

      this.showSuccess(`Status geändert zu: ${this.getStatusText(newStatus)}`);
    } catch (error) {
      console.error('Error updating status:', error);
      // Show specific error message
      if (error instanceof Error) {
        this.showError(error.message);
      } else {
        this.showError('Fehler beim Aktualisieren des Status');
      }

      // Reset dropdown to original value on error
      const statusDisplay = document.querySelector('#statusDisplay');
      if (statusDisplay && this.suggestion) {
        const statusSpan = statusDisplay.querySelector('span');
        if (statusSpan) statusSpan.textContent = this.getStatusText(this.suggestion.status);
        const statusValue = document.querySelector('#statusValue');
        if (statusValue) statusValue.setAttribute('value', this.suggestion.status);
      }
    }
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
