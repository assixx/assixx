/**
 * KVP Detail Renderer
 * Handles all DOM rendering operations for KVP detail page
 */

import { $$, setHTML, getData } from '../../../utils/dom-utils';
import {
  type KvpSuggestion,
  type Comment,
  type Attachment,
  renderComments,
  renderPhotoGallery,
  renderOtherAttachments,
  updateVisibilityBadgeIcon,
  getStatusText,
  getPriorityText,
  formatCurrency,
  hasImplementationDate,
} from './ui';

interface User {
  id: number;
  role: 'root' | 'admin' | 'employee';
  tenantId: number;
}

/**
 * Get Design System badge class for status
 * Maps status values to badge--kvp-* classes
 */
function getStatusBadgeClass(status: string): string {
  const statusMap = new Map<string, string>([
    ['new', 'badge--kvp-new'],
    ['in_review', 'badge--kvp-in-review'],
    ['approved', 'badge--kvp-approved'],
    ['implemented', 'badge--kvp-implemented'],
    ['rejected', 'badge--kvp-rejected'],
    ['archived', 'badge--kvp-archived'],
  ]);
  // Map.get() is safe - status comes from backend enum
  return statusMap.get(status) ?? 'badge--kvp-new';
}

/**
 * Get Design System badge class for priority
 * Maps priority values to badge--priority-* classes
 */
function getPriorityBadgeClass(priority: string): string {
  const priorityMap = new Map<string, string>([
    ['low', 'badge--priority-low'],
    ['normal', 'badge--priority-normal'],
    ['high', 'badge--priority-high'],
    ['urgent', 'badge--priority-urgent'],
  ]);
  return priorityMap.get(priority) ?? 'badge--priority-normal';
}

/**
 * Get Design System badge class for visibility (org level)
 * Maps orgLevel values to badge--visibility-* classes
 */
function getVisibilityBadgeClass(orgLevel: string): string {
  const visibilityMap = new Map<string, string>([
    ['team', 'badge--visibility-team'],
    ['department', 'badge--visibility-department'],
    ['area', 'badge--visibility-area'],
    ['company', 'badge--visibility-company'],
  ]);
  return visibilityMap.get(orgLevel) ?? 'badge--visibility-team';
}

export class KvpDetailRenderer {
  private suggestion: KvpSuggestion | null = null;
  private currentUser: User | null = null;

  setSuggestion(suggestion: KvpSuggestion | null): void {
    this.suggestion = suggestion;
  }

  setCurrentUser(user: User | null): void {
    this.currentUser = user;
  }

  renderSuggestion(): void {
    if (!this.suggestion) return;

    this.renderBasicInfo();
    this.renderBadges();
    this.renderContent();
    this.renderDetailsAndStatus();
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

  private renderBadges(): void {
    this.renderStatusBadge();
    this.renderPriorityBadge();
    this.renderVisibilityBadge();
    this.renderVisibilityInfo();
  }

  private renderStatusBadge(): void {
    if (!this.suggestion) return;
    const statusBadge = $$('#statusBadge');
    if (statusBadge) {
      const badgeClass = getStatusBadgeClass(this.suggestion.status);
      statusBadge.className = `badge ${badgeClass}`;
      statusBadge.textContent = getStatusText(this.suggestion.status);
    }
  }

  private renderPriorityBadge(): void {
    if (!this.suggestion) return;
    const priorityBadge = $$('#priorityBadge');
    if (priorityBadge) {
      const badgeClass = getPriorityBadgeClass(this.suggestion.priority);
      priorityBadge.className = `badge ${badgeClass}`;
      priorityBadge.textContent = getPriorityText(this.suggestion.priority);
    }
  }

  private renderVisibilityBadge(): void {
    if (!this.suggestion) return;
    const visibilityBadge = $$('#visibilityBadge');
    const visibilityText = $$('#visibilityText');
    if (visibilityBadge && visibilityText) {
      const orgLevel = this.suggestion.orgLevel;
      const badgeClass = getVisibilityBadgeClass(orgLevel);
      visibilityBadge.className = `badge ${badgeClass}`;

      const icon = visibilityBadge.querySelector('i');
      if (icon) {
        updateVisibilityBadgeIcon(icon, orgLevel, visibilityText, this.suggestion);
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

  private renderContent(): void {
    if (!this.suggestion) return;

    // Description
    const descriptionEl = document.querySelector('#description');
    if (descriptionEl) descriptionEl.textContent = this.suggestion.description;

    // Expected benefit
    if (this.suggestion.expectedBenefit !== undefined && this.suggestion.expectedBenefit !== '') {
      const benefitSection = document.querySelector('#benefitSection');
      const expectedBenefit = document.querySelector('#expectedBenefit');
      if (benefitSection instanceof HTMLElement) benefitSection.removeAttribute('hidden');
      if (expectedBenefit) expectedBenefit.textContent = this.suggestion.expectedBenefit;
    }

    // Financial info
    this.renderFinancialInfo();
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

  private showFinancialSection(): void {
    const financialSection = document.querySelector('#financialSection');
    if (financialSection instanceof HTMLElement) {
      financialSection.removeAttribute('hidden');
    }
  }

  private renderEstimatedCost(cost: number): void {
    const estimatedCostEl = document.querySelector('#estimatedCost');
    if (estimatedCostEl) {
      estimatedCostEl.textContent = formatCurrency(cost);
    }
  }

  private renderActualSavings(savings: number): void {
    const actualSavingsEl = document.querySelector('#actualSavings');
    if (actualSavingsEl) {
      actualSavingsEl.textContent = formatCurrency(savings);
    }
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
      `<div class="category-tag" style="background: ${this.suggestion.categoryColor}20; color: ${this.suggestion.categoryColor}; border: 1px solid ${this.suggestion.categoryColor};">
        ${this.suggestion.categoryIcon}
        ${this.suggestion.categoryName}
      </div>`,
    );
  }

  renderStatus(): void {
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

    if (statusElement instanceof HTMLElement) statusElement.setAttribute('hidden', '');
    if (statusDropdownContainer instanceof HTMLElement) statusDropdownContainer.removeAttribute('hidden');

    const statusSpan = statusDisplay.querySelector('span');
    if (statusSpan) statusSpan.textContent = getStatusText(this.suggestion.status);

    const statusValue = document.querySelector('#statusValue');
    if (statusValue) statusValue.setAttribute('value', this.suggestion.status);
  }

  private renderRegularStatus(statusElement: Element, statusDropdownContainer: Element): void {
    if (!this.suggestion) return;

    statusElement.textContent = getStatusText(this.suggestion.status);
    if (statusDropdownContainer instanceof HTMLElement) statusDropdownContainer.setAttribute('hidden', '');
  }

  private renderAssignedTo(): void {
    if (!this.suggestion) return;
    if (this.suggestion.assignedTo === undefined || this.suggestion.assignedTo === 0) return;

    const assignedToItem = document.querySelector('#assignedToItem');
    if (assignedToItem instanceof HTMLElement) {
      assignedToItem.removeAttribute('hidden');
    }
    // TODO: Load assigned user name
  }

  private renderImplementationDate(): void {
    if (!this.suggestion) return;
    if (!hasImplementationDate(this.suggestion)) return;

    const implementationItem = document.querySelector('#implementationItem');
    const implementationDate = document.querySelector('#implementationDate');

    if (implementationItem instanceof HTMLElement) {
      implementationItem.removeAttribute('hidden');
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

  private renderRejectionReason(): void {
    if (!this.suggestion) return;
    if (this.suggestion.rejectionReason === undefined || this.suggestion.rejectionReason === '') return;

    const rejectionItem = document.querySelector('#rejectionItem');
    const rejectionReason = document.querySelector('#rejectionReason');

    if (rejectionItem instanceof HTMLElement) {
      rejectionItem.removeAttribute('hidden');
    }

    if (rejectionReason) {
      rejectionReason.textContent = this.suggestion.rejectionReason;
    }
  }

  renderCommentsWrapper(comments: Comment[]): void {
    const container = document.querySelector('#commentList');
    if (!container || !(container instanceof HTMLElement)) return;
    renderComments(comments, container);
  }

  renderPhotoGalleryWrapper(photos: Attachment[]): void {
    const photoSection = document.querySelector('#photoSection');
    const photoGallery = document.querySelector('#photoGallery');

    if (photoSection instanceof HTMLElement && photoGallery instanceof HTMLElement) {
      renderPhotoGallery(photos, photoSection, photoGallery);
    }
  }

  renderOtherAttachmentsWrapper(otherFiles: Attachment[], onDownload: (fileUuid: string) => void): HTMLElement | null {
    const attachmentsCard = document.querySelector('#attachmentsCard');
    const container = document.querySelector('#attachmentList');

    if (attachmentsCard instanceof HTMLElement && container instanceof HTMLElement) {
      const updatedContainer = renderOtherAttachments(otherFiles, attachmentsCard, container);

      // Add click handlers
      updatedContainer.querySelectorAll('.attachment-item').forEach((item) => {
        item.addEventListener('click', () => {
          const uuid = getData(item as HTMLElement, 'uuid');
          if (uuid !== undefined && uuid !== '') {
            onDownload(uuid);
          }
        });
      });

      return updatedContainer;
    }

    return null;
  }

  renderAttachments(attachments: Attachment[], onDownload: (fileUuid: string) => void): void {
    if (attachments.length === 0) return;

    // Filter photo attachments
    const photoTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const photos = attachments.filter((att) => photoTypes.includes(att.fileType));
    const otherFiles = attachments.filter((att) => !photoTypes.includes(att.fileType));

    // Render photo gallery
    if (photos.length > 0) {
      this.renderPhotoGalleryWrapper(photos);
    }

    // Render other attachments
    if (otherFiles.length > 0) {
      this.renderOtherAttachmentsWrapper(otherFiles, onDownload);
    }
  }

  updateStatusBadge(newStatus: string): void {
    const statusBadge = document.querySelector('#statusBadge');
    if (!statusBadge) return;

    // Use Design System badge class (not raw status value)
    const badgeClass = getStatusBadgeClass(newStatus);
    statusBadge.className = `badge ${badgeClass}`;
    statusBadge.textContent = getStatusText(newStatus);
  }

  updateRejectionReasonDisplay(newStatus: string, rejectionReason?: string): void {
    const rejectionItem = document.querySelector('#rejectionItem');
    const rejectionReasonEl = document.querySelector('#rejectionReason');

    if (newStatus === 'rejected' && rejectionReason !== undefined && rejectionReason !== '') {
      if (rejectionItem instanceof HTMLElement) rejectionItem.removeAttribute('hidden');
      if (rejectionReasonEl) rejectionReasonEl.textContent = rejectionReason;
    } else if (newStatus !== 'rejected' && rejectionItem instanceof HTMLElement) {
      rejectionItem.setAttribute('hidden', '');
    }
  }

  resetStatusDropdown(): void {
    const statusDisplay = document.querySelector('#statusDisplay');
    if (!statusDisplay || !this.suggestion) return;

    const statusSpan = statusDisplay.querySelector('span');
    if (statusSpan) statusSpan.textContent = getStatusText(this.suggestion.status);

    const statusValue = document.querySelector('#statusValue');
    if (statusValue) statusValue.setAttribute('value', this.suggestion.status);
  }
}
