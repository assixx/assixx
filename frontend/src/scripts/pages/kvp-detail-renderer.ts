/**
 * KVP Detail Renderer
 * Handles all DOM rendering operations for KVP detail page
 */

import { $$, setHTML, getData } from '../../utils/dom-utils';
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
} from './kvp-detail-ui';

interface User {
  id: number;
  role: 'root' | 'admin' | 'employee';
  tenantId: number;
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
      statusBadge.className = `status-badge ${this.suggestion.status.replace('_', '')}`;
      statusBadge.textContent = getStatusText(this.suggestion.status);
    }
  }

  private renderPriorityBadge(): void {
    if (!this.suggestion) return;
    const priorityBadge = $$('#priorityBadge');
    if (priorityBadge) {
      priorityBadge.className = `priority-badge ${this.suggestion.priority}`;
      priorityBadge.textContent = getPriorityText(this.suggestion.priority);
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
      if (benefitSection instanceof HTMLElement) benefitSection.style.display = '';
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
      financialSection.style.display = '';
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
      `<span style="color: ${this.suggestion.categoryColor}">
        <i class="${this.suggestion.categoryIcon}"></i>
        ${this.suggestion.categoryName}
      </span>`,
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

    if (statusElement instanceof HTMLElement) statusElement.style.display = 'none';
    if (statusDropdownContainer instanceof HTMLElement) statusDropdownContainer.style.display = '';

    const statusSpan = statusDisplay.querySelector('span');
    if (statusSpan) statusSpan.textContent = getStatusText(this.suggestion.status);

    const statusValue = document.querySelector('#statusValue');
    if (statusValue) statusValue.setAttribute('value', this.suggestion.status);
  }

  private renderRegularStatus(statusElement: Element, statusDropdownContainer: Element): void {
    if (!this.suggestion) return;

    statusElement.textContent = getStatusText(this.suggestion.status);
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
    if (!hasImplementationDate(this.suggestion)) return;

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

  renderOtherAttachmentsWrapper(otherFiles: Attachment[], onDownload: (id: number) => void): HTMLElement | null {
    const attachmentsCard = document.querySelector('#attachmentsCard');
    const container = document.querySelector('#attachmentList');

    if (attachmentsCard instanceof HTMLElement && container instanceof HTMLElement) {
      const updatedContainer = renderOtherAttachments(otherFiles, attachmentsCard, container);

      // Add click handlers
      updatedContainer.querySelectorAll('.attachment-item').forEach((item) => {
        item.addEventListener('click', () => {
          const id = getData(item as HTMLElement, 'id');
          if (id !== undefined && id !== '') {
            onDownload(Number.parseInt(id, 10));
          }
        });
      });

      return updatedContainer;
    }

    return null;
  }

  renderAttachments(attachments: Attachment[], onDownload: (id: number) => void): void {
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

    statusBadge.className = `status-badge ${newStatus.replace('_', '')}`;
    statusBadge.textContent = getStatusText(newStatus);
  }

  updateRejectionReasonDisplay(newStatus: string, rejectionReason?: string): void {
    const rejectionItem = document.querySelector('#rejectionItem');
    const rejectionReasonEl = document.querySelector('#rejectionReason');

    if (newStatus === 'rejected' && rejectionReason !== undefined && rejectionReason !== '') {
      if (rejectionItem instanceof HTMLElement) rejectionItem.style.display = '';
      if (rejectionReasonEl) rejectionReasonEl.textContent = rejectionReason;
    } else if (newStatus !== 'rejected' && rejectionItem instanceof HTMLElement) {
      rejectionItem.style.display = 'none';
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
