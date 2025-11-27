/**
 * Sticky Note Component
 * Single Source of Truth for rendering blackboard entries
 * Used by: Dashboard Widget + Blackboard Page
 *
 * @example
 * const note = createStickyNote(entry, {
 *   size: 'mini',
 *   showActions: false,
 *   onClick: (entry) => openDetail(entry)
 * });
 * container.append(note);
 */

import type { BlackboardEntry, EntryColor, OrgLevel, Priority } from './types';

// ============================================================================
// Types
// ============================================================================

export interface StickyNoteOptions {
  /** Size variant: 'mini' for dashboard, 'large' for blackboard page */
  size?: 'mini' | 'large';
  /** Show edit/delete action buttons */
  showActions?: boolean;
  /** Custom click handler */
  onClick?: (entry: BlackboardEntry) => void;
  /** Custom edit handler */
  onEdit?: (entry: BlackboardEntry) => void;
  /** Custom delete handler */
  onDelete?: (entry: BlackboardEntry) => void;
  /** Maximum content length before truncation */
  maxContentLength?: number;
  /** Show direct attachment preview instead of content text */
  showAttachmentPreview?: boolean;
}

interface AttachmentLike {
  id?: number;
  fileUuid?: string;
  filename?: string;
  originalName?: string;
  mimeType: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format date for display (German locale)
 */
function formatDate(dateString: string | undefined): string {
  if (dateString === undefined || dateString === '') return '';

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Parse content text (handles Buffer objects from API)
 */
function parseContentText(contentText: unknown): string {
  if (typeof contentText !== 'object' || contentText === null) {
    return String(contentText);
  }

  // Handle Buffer object from API
  if (
    typeof contentText === 'object' &&
    'type' in contentText &&
    contentText.type === 'Buffer' &&
    'data' in contentText &&
    Array.isArray(contentText.data)
  ) {
    return String.fromCharCode(...(contentText.data as number[]));
  }

  return JSON.stringify(contentText);
}

/**
 * Get CSS class for color variant
 */
function getColorClass(color: EntryColor): string {
  return `sticky-note--${color}`;
}

/**
 * Get display label for org level
 */
function getOrgLevelLabel(orgLevel: OrgLevel): string {
  switch (orgLevel) {
    case 'company':
      return 'Firma';
    case 'department':
      return 'Abteilung';
    case 'team':
      return 'Team';
    case 'area':
      return 'Bereich';
  }
}

/**
 * Get display label for priority
 */
function getPriorityLabel(priority: Priority): string {
  switch (priority) {
    case 'low':
      return 'Niedrig';
    case 'medium':
      return 'Normal';
    case 'high':
      return 'Hoch';
    case 'urgent':
      return 'Dringend';
  }
}

// ============================================================================
// Sub-Component Creators
// ============================================================================

/**
 * Create indicators element (attachments + comments count)
 */
function createIndicators(attachmentCount: number, commentCount: number): HTMLElement {
  const indicators = document.createElement('div');
  indicators.className = 'sticky-note__indicators';

  if (attachmentCount > 0) {
    const attachments = document.createElement('div');
    attachments.className = 'sticky-note__attachments';
    // eslint-disable-next-line no-unsanitized/property -- Static HTML with numeric count
    attachments.innerHTML = `<i class="fas fa-paperclip"></i><span>${String(attachmentCount)}</span>`;
    indicators.append(attachments);
  }

  if (commentCount > 0) {
    const comments = document.createElement('div');
    comments.className = 'sticky-note__comments';
    // eslint-disable-next-line no-unsanitized/property -- Static HTML with numeric count
    comments.innerHTML = `<i class="fas fa-comments"></i><span>${String(commentCount)}</span>`;
    indicators.append(comments);
  }

  return indicators;
}

/**
 * Create footer element (author + date + badges)
 */
function createFooter(
  authorFullName: string | undefined,
  authorName: string | undefined,
  createdAt: string,
  orgLevel: OrgLevel,
  priority: Priority,
): HTMLElement {
  const footer = document.createElement('div');
  footer.className = 'sticky-note__footer';

  // Top row: Badges (right aligned)
  const badgesRow = document.createElement('div');
  badgesRow.className = 'sticky-note__badges';

  const priorityBadge = document.createElement('span');
  priorityBadge.className = `sticky-note__badge sticky-note__badge--priority-${priority}`;
  priorityBadge.textContent = getPriorityLabel(priority);
  badgesRow.append(priorityBadge);

  const orgBadge = document.createElement('span');
  orgBadge.className = `sticky-note__badge sticky-note__badge--org-${orgLevel}`;
  orgBadge.textContent = getOrgLevelLabel(orgLevel);
  badgesRow.append(orgBadge);

  footer.append(badgesRow);

  // Bottom row: Author (left) + Date (right)
  const footerRow = document.createElement('div');
  footerRow.className = 'sticky-note__footer-row';

  const authorSpan = document.createElement('span');
  authorSpan.className = 'sticky-note__author';
  const authorIcon = document.createElement('i');
  authorIcon.className = 'fas fa-user';
  authorSpan.append(authorIcon);
  authorSpan.append(` ${escapeHtml(authorFullName ?? authorName ?? 'Unbekannt')}`);
  footerRow.append(authorSpan);

  const dateSpan = document.createElement('span');
  dateSpan.className = 'sticky-note__date';
  dateSpan.textContent = formatDate(createdAt);
  footerRow.append(dateSpan);

  footer.append(footerRow);

  return footer;
}

/**
 * Create action buttons (edit/delete)
 */
function createActionButtons(
  entry: BlackboardEntry,
  onEdit: ((entry: BlackboardEntry) => void) | undefined,
  onDelete: ((entry: BlackboardEntry) => void) | undefined,
): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'sticky-note__actions';

  if (onEdit !== undefined) {
    const editBtn = document.createElement('button');
    editBtn.className = 'sticky-note__action sticky-note__action--edit';
    editBtn.title = 'Bearbeiten';
    const editIcon = document.createElement('i');
    editIcon.className = 'fas fa-edit';
    editBtn.append(editIcon);
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onEdit(entry);
    });
    actions.append(editBtn);
  }

  if (onDelete !== undefined) {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'sticky-note__action sticky-note__action--delete';
    deleteBtn.title = 'Löschen';
    const deleteIcon = document.createElement('i');
    deleteIcon.className = 'fas fa-trash';
    deleteBtn.append(deleteIcon);
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onDelete(entry);
    });
    actions.append(deleteBtn);
  }

  return actions;
}

/**
 * Create content element (text or attachment preview)
 * JS truncation for both sizes - mini gets fewer chars, large gets more
 */
function createContentElement(
  entry: BlackboardEntry,
  contentText: string,
  isDirectAttachment: boolean,
  showAttachmentPreview: boolean,
  maxContentLength: number,
): HTMLElement {
  const hasAttachments = entry.attachments !== undefined && entry.attachments.length > 0;
  const shouldShowPreview = isDirectAttachment && showAttachmentPreview && hasAttachments;

  if (shouldShowPreview && entry.attachments !== undefined) {
    const attachment = entry.attachments[0];
    if (attachment !== undefined) {
      return createAttachmentPreview(attachment);
    }
  }

  const content = document.createElement('div');
  content.className = 'sticky-note__content';

  // JS truncation for both sizes - CSS line-clamp is unreliable
  // Large notes get more characters than mini notes
  const truncated = contentText.length > maxContentLength;
  content.textContent = truncated ? `${contentText.substring(0, maxContentLength)}...` : contentText;
  return content;
}

/**
 * Create attachment preview element
 */
function createAttachmentPreview(attachment: AttachmentLike): HTMLElement {
  const preview = document.createElement('div');
  preview.className = 'sticky-note__attachment-preview';

  const attachmentId = String(attachment.id ?? attachment.fileUuid ?? '');
  const displayName = attachment.originalName ?? attachment.filename ?? 'Datei';
  const safeId = escapeHtml(attachmentId);
  const safeName = escapeHtml(displayName);

  if (attachment.mimeType.startsWith('image/')) {
    // eslint-disable-next-line no-unsanitized/property -- All dynamic values escaped via escapeHtml
    preview.innerHTML = `
      <img src="/api/blackboard/attachments/${safeId}/preview"
           alt="${safeName}"
           style="width: 100%; height: auto; max-height: 120px; object-fit: cover; border-radius: 4px;"
           loading="lazy"
           onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
      <div style="display: none; flex-direction: column; align-items: center; justify-content: center; height: 80px; color: #666;">
        <i class="fas fa-image" style="font-size: 24px; margin-bottom: 5px;"></i>
        <span style="font-size: 10px;">Bild</span>
      </div>
    `;
  } else if (attachment.mimeType === 'application/pdf') {
    // eslint-disable-next-line no-unsanitized/property -- All dynamic values escaped via escapeHtml
    preview.innerHTML = `
      <div style="position: relative; height: 120px; background: #f5f5f5; border-radius: 4px; overflow: hidden;">
        <object data="/api/blackboard/attachments/${safeId}/preview"
                type="application/pdf"
                style="width: 100%; height: 100%; pointer-events: none;">
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #666;">
            <i class="fas fa-file-pdf" style="font-size: 32px; color: #dc3545; margin-bottom: 5px;"></i>
            <div style="font-size: 10px;">PDF-Dokument</div>
          </div>
        </object>
      </div>
    `;
  } else {
    // eslint-disable-next-line no-unsanitized/property -- displayName escaped via escapeHtml
    preview.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 80px; color: #666;">
        <i class="fas fa-file" style="font-size: 24px; margin-bottom: 5px;"></i>
        <span style="font-size: 10px;">${safeName}</span>
      </div>
    `;
  }

  return preview;
}

// ============================================================================
// Main Component Function
// ============================================================================

/**
 * Create a sticky note element for a blackboard entry
 *
 * @param entry - The blackboard entry data
 * @param options - Configuration options
 * @returns HTMLElement - The complete sticky note element
 */
export function createStickyNote(entry: BlackboardEntry, options: StickyNoteOptions = {}): HTMLElement {
  const {
    size = 'mini',
    showActions = false,
    onClick,
    onEdit,
    onDelete,
    maxContentLength = 150,
    showAttachmentPreview = false,
  } = options;

  const contentText = parseContentText(entry.content);
  const isDirectAttachment = contentText.startsWith('[Attachment:');

  // Create main container
  const note = document.createElement('div');
  note.className = `sticky-note ${getColorClass(entry.color)} sticky-note--${size}`;
  if (isDirectAttachment && showAttachmentPreview) {
    note.classList.add('has-attachment');
  }
  note.id = `sticky-note-${entry.id}`;
  note.dataset['entryId'] = String(entry.id);
  note.dataset['entryUuid'] = entry.uuid;

  // Pushpin
  const pin = document.createElement('div');
  pin.className = 'sticky-note__pin';
  note.append(pin);

  // Title
  const title = document.createElement('div');
  title.className = 'sticky-note__title';
  title.textContent = entry.title;
  note.append(title);

  // Content or attachment preview
  note.append(createContentElement(entry, contentText, isDirectAttachment, showAttachmentPreview, maxContentLength));

  // Indicators (attachments + comments)
  const attachmentCount = entry.attachmentCount ?? 0;
  const commentCount = entry.commentCount ?? 0;
  const showAttachmentIndicator = attachmentCount > 0 && !isDirectAttachment;

  if (showAttachmentIndicator || commentCount > 0) {
    note.append(createIndicators(showAttachmentIndicator ? attachmentCount : 0, commentCount));
  }

  // Footer
  note.append(createFooter(entry.authorFullName, entry.authorName, entry.createdAt, entry.orgLevel, entry.priority));

  // Action buttons
  if (showActions && (onEdit !== undefined || onDelete !== undefined)) {
    note.append(createActionButtons(entry, onEdit, onDelete));
  }

  // Click handler
  if (onClick !== undefined) {
    note.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.sticky-note__actions') === null) {
        onClick(entry);
      }
    });
  }

  return note;
}

// ============================================================================
// Exports
// ============================================================================

export { escapeHtml, formatDate, parseContentText };
