/**
 * Blackboard Detail Renderer
 * Handles all DOM rendering operations for blackboard detail page
 */

import { setHTML } from '../../../utils/dom-utils';
import {
  type BlackboardEntry,
  type BlackboardComment,
  type BlackboardAttachment,
  type User,
  renderComments,
  renderPhotoGallery,
  renderOtherAttachments,
  getPriorityText,
  getPriorityBadgeClass,
  getOrgLevelText,
  getVisibilityBadgeClass,
  formatDate,
  formatDateTime,
  escapeHtml,
  setLoadedAttachments,
  openPreviewModal,
} from './ui';

/**
 * DOM renderer for blackboard detail page
 */
export class BlackboardDetailRenderer {
  private entry: BlackboardEntry | null = null;
  private currentUser: User | null = null;

  setEntry(entry: BlackboardEntry | null): void {
    this.entry = entry;
  }

  setCurrentUser(user: User | null): void {
    this.currentUser = user;
  }

  /**
   * Render full entry details
   */
  renderEntry(): void {
    if (this.entry === null) return;

    this.renderHeader();
    this.renderDetails();
    this.renderContent();
  }

  /**
   * Render header section (title, author, date, priority)
   */
  private renderHeader(): void {
    if (this.entry === null) return;

    // Title
    const titleEl = document.querySelector('#entryTitle');
    if (titleEl !== null) {
      titleEl.textContent = this.entry.title;
    }

    // Author - use authorFullName from API (first_name + last_name)
    const authorEl = document.querySelector('#authorName');
    if (authorEl !== null) {
      const authorDisplay = this.entry.authorFullName ?? this.entry.authorName ?? 'Unbekannt';
      authorEl.textContent = authorDisplay;
    }

    // Created date
    const createdAtEl = document.querySelector('#createdAt');
    if (createdAtEl !== null) {
      createdAtEl.textContent = formatDate(this.entry.createdAt);
    }

    // Priority badge
    const priorityBadge = document.querySelector('#priorityBadge');
    if (priorityBadge !== null) {
      const badgeClass = getPriorityBadgeClass(this.entry.priority);
      priorityBadge.className = `badge ${badgeClass}`;
      priorityBadge.textContent = getPriorityText(this.entry.priority);
    }
  }

  /**
   * Render details section (visibility, expiration, tags)
   */
  private renderDetails(): void {
    if (this.entry === null) return;

    this.renderOrgLevel();
    this.renderExpirationDate();
    this.renderTags();
  }

  /**
   * Render organization level / visibility with badge
   */
  private renderOrgLevel(): void {
    if (this.entry === null) return;
    const orgLevelEl = document.querySelector('#orgLevel');
    if (orgLevelEl !== null) {
      const badgeClass = getVisibilityBadgeClass(this.entry.orgLevel);
      orgLevelEl.className = `badge ${badgeClass}`;
      orgLevelEl.textContent = getOrgLevelText(this.entry.orgLevel, this.entry);
    }
  }

  /**
   * Render expiration date if set
   */
  private renderExpirationDate(): void {
    if (this.entry === null) return;
    if (this.entry.expiresAt === null || this.entry.expiresAt === '') return;

    const expiresItem = document.querySelector('#expiresAtItem');
    const expiresEl = document.querySelector('#expiresAt');
    if (expiresItem instanceof HTMLElement) {
      expiresItem.removeAttribute('hidden');
    }
    if (expiresEl !== null) {
      expiresEl.textContent = formatDate(this.entry.expiresAt);
    }
  }

  /**
   * Render tags if any exist
   */
  private renderTags(): void {
    if (this.entry === null) return;
    if (this.entry.tags === undefined || this.entry.tags.length === 0) return;

    const tagsItem = document.querySelector('#tagsItem');
    const tagsEl = document.querySelector('#tags');
    if (tagsItem instanceof HTMLElement) {
      tagsItem.removeAttribute('hidden');
    }
    if (tagsEl !== null) {
      const tagsHtml = this.entry.tags
        .map((tag) => `<span class="badge badge--tag">${escapeHtml(tag)}</span>`)
        .join(' ');
      setHTML(tagsEl as HTMLElement, tagsHtml);
    }
  }

  /**
   * Render content section
   */
  private renderContent(): void {
    if (this.entry === null) return;

    const contentEl = document.querySelector('#entryContent');
    if (contentEl !== null) {
      // Preserve line breaks and escape HTML
      const formattedContent = escapeHtml(this.entry.content).replace(/\n/g, '<br>');
      setHTML(contentEl as HTMLElement, formattedContent);
    }
  }

  /**
   * Render comments list
   */
  renderComments(comments: BlackboardComment[]): void {
    const container = document.querySelector('#commentList');
    if (container === null || !(container instanceof HTMLElement)) return;
    renderComments(comments, container);

    // Update comment count badge
    const countBadge = document.querySelector('#commentCount');
    if (countBadge !== null) {
      countBadge.textContent = String(comments.length);
    }
  }

  /**
   * Render attachments (photos + other files)
   * Note: onDownload and onPreview callbacks kept for backwards compatibility but no longer used
   */
  renderAttachments(
    attachments: BlackboardAttachment[],
    _onDownload: (uuid: string) => void,
    _onPreview: (uuid: string, name: string, type: string) => void,
  ): void {
    if (attachments.length === 0) return;

    // Store all attachments for lookup by UUID (used by photo gallery click handler)
    setLoadedAttachments(attachments);

    // Filter photo attachments by mimeType (documents API)
    const photoTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const photos = attachments.filter((att) => photoTypes.includes(att.mimeType));
    const otherFiles = attachments.filter((att) => !photoTypes.includes(att.mimeType));

    // Render photo gallery
    if (photos.length > 0) {
      const photoSection = document.querySelector('#photoSection');
      const photoGallery = document.querySelector('#photoGallery');
      if (photoSection instanceof HTMLElement && photoGallery instanceof HTMLElement) {
        renderPhotoGallery(photos, photoSection, photoGallery);
      }
    }

    // Render other attachments
    if (otherFiles.length > 0) {
      const attachmentsCard = document.querySelector('#attachmentsCard');
      const attachmentList = document.querySelector('#attachmentList');
      if (attachmentsCard instanceof HTMLElement && attachmentList instanceof HTMLElement) {
        renderOtherAttachments(otherFiles, attachmentsCard, attachmentList);

        // Add click handlers - open preview modal directly with attachment object
        attachmentList.querySelectorAll('.attachment-item').forEach((item) => {
          item.addEventListener('click', () => {
            const el = item as HTMLElement;
            const fileUuid = el.dataset['fileUuid'] ?? '';

            if (fileUuid === '') return;

            // Find the attachment object by UUID
            const attachment = otherFiles.find((att) => att.fileUuid === fileUuid);
            if (attachment !== undefined) {
              openPreviewModal(attachment);
            }
          });
        });
      }
    }
  }

  /**
   * Render confirmation status
   */
  renderConfirmationStatus(confirmed: boolean, confirmedAt: string | null): void {
    const statusContainer = document.querySelector('#confirmationStatus');
    if (statusContainer === null) return;

    if (confirmed) {
      const dateText = confirmedAt !== null ? formatDateTime(confirmedAt) : '';
      setHTML(
        statusContainer as HTMLElement,
        `
        <div class="confirmation-done mb-4">
          <i class="fas fa-check-circle text-success"></i>
          <span>Bereits als gelesen markiert</span>
          ${dateText !== '' ? `<span class="text-muted text-sm">${dateText}</span>` : ''}
        </div>
        <button class="btn btn-light w-full text-sm" id="unconfirmBtn" data-action="unconfirm-entry">
          <i class="fas fa-undo"></i>
          Als ungelesen markieren
        </button>
      `,
      );
    } else {
      setHTML(
        statusContainer as HTMLElement,
        `
        <button class="btn btn-upload w-full" id="confirmBtn" data-action="confirm-entry">
          <i class="fas fa-check"></i>
          Als gelesen markieren
        </button>
      `,
      );
    }
  }

  /**
   * Show/hide admin actions based on user role
   */
  setupAdminUI(): void {
    const isAdmin =
      this.currentUser !== null && (this.currentUser.role === 'admin' || this.currentUser.role === 'root');

    const actionsCard = document.querySelector('#actionsCard');
    if (actionsCard instanceof HTMLElement) {
      if (isAdmin) {
        actionsCard.removeAttribute('hidden');
      } else {
        actionsCard.setAttribute('hidden', '');
      }
    }
  }

  /**
   * Update page title with entry title
   */
  updatePageTitle(): void {
    if (this.entry === null) return;
    document.title = `${this.entry.title} - Schwarzes Brett - Assixx`;
  }
}
