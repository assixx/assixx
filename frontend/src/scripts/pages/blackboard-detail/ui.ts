/* eslint-disable max-lines */
/**
 * Blackboard Detail UI Utilities
 * Contains types, rendering methods and utilities for blackboard detail page
 */

import { setHTML } from '../../../utils/dom-utils';
import { getAuthToken } from '../../auth';

// ============================================================================
// Types
// ============================================================================

export interface BlackboardEntry {
  id: number;
  uuid: string;
  tenantId: number;
  title: string;
  content: string;
  orgLevel: 'company' | 'department' | 'team' | 'area';
  orgId: number | null;
  expiresAt: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  color: string;
  status: 'active' | 'archived';
  authorId: number;
  // Author fields from API (matches backend CONCAT query)
  authorName?: string; // Username
  authorFirstName?: string;
  authorLastName?: string;
  authorFullName?: string; // CONCAT(first_name, ' ', last_name)
  departmentName?: string;
  teamName?: string;
  areaName?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  // Confirmation tracking (from backend JOIN with blackboard_confirmations)
  isConfirmed?: boolean;
  confirmedAt?: string | null;
}

export interface BlackboardComment {
  id: number;
  entryId: number;
  userId: number;
  comment: string;
  isInternal: boolean;
  createdAt: string;
  // Match KVP format
  firstName?: string;
  lastName?: string;
  role?: string;
  profilePicture?: string | null;
}

export interface BlackboardAttachment {
  id: number;
  entryId?: number;
  // Documents API returns these fields
  uuid?: string; // Document record UUID
  fileUuid: string; // File UUID for download URL
  filename: string; // API uses lowercase
  originalName: string;
  filePath?: string;
  fileType?: string; // Legacy field name (optional)
  mimeType: string; // Documents API field name (primary)
  fileSize: number;
  uploadedBy: number;
  uploadedByName: string; // Full name "Aaron Swarz"
  uploaderFirstName?: string;
  uploaderLastName?: string;
  createdBy?: number;
  uploadedAt: string;
}

export interface User {
  id: number;
  role: 'root' | 'admin' | 'employee';
  tenantId: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'fas fa-image';
  if (mimeType === 'application/pdf') return 'fas fa-file-pdf';
  if (mimeType.includes('word')) return 'fas fa-file-word';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fas fa-file-excel';
  return 'fas fa-file';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function getPriorityText(priority: string): string {
  switch (priority) {
    case 'low':
      return 'Niedrig';
    case 'medium':
      return 'Mittel';
    case 'high':
      return 'Hoch';
    case 'urgent':
      return 'Dringend';
    default:
      return priority;
  }
}

export function getPriorityBadgeClass(priority: string): string {
  const priorityMap = new Map<string, string>([
    ['low', 'badge--priority-low'],
    ['medium', 'badge--priority-normal'],
    ['normal', 'badge--priority-normal'],
    ['high', 'badge--priority-high'],
    ['urgent', 'badge--priority-urgent'],
  ]);
  return priorityMap.get(priority) ?? 'badge--priority-normal';
}

export function getOrgLevelText(orgLevel: string, entry?: BlackboardEntry): string {
  switch (orgLevel) {
    case 'company':
      return 'Firmenweit';
    case 'department':
      return entry?.departmentName ?? 'Abteilung';
    case 'team':
      return entry?.teamName ?? 'Team';
    case 'area':
      return entry?.areaName ?? 'Bereich';
    default:
      return orgLevel;
  }
}

export function getVisibilityBadgeClass(orgLevel: string): string {
  const visibilityMap = new Map<string, string>([
    ['team', 'badge--visibility-team'],
    ['department', 'badge--visibility-department'],
    ['area', 'badge--visibility-area'],
    ['company', 'badge--visibility-company'],
  ]);
  return visibilityMap.get(orgLevel) ?? 'badge--visibility-company';
}

// ============================================================================
// Rendering Functions
// ============================================================================

/**
 * Create avatar HTML - with profile picture if available, otherwise initials
 */
function createAvatarHtml(
  profilePicture: string | null | undefined,
  firstName: string,
  lastName: string,
  avatarColor: number,
): string {
  const fullName = `${firstName} ${lastName}`;

  // If profile picture exists, show image
  if (profilePicture !== null && profilePicture !== undefined && profilePicture !== '') {
    return `
      <div class="avatar avatar--sm">
        <img src="${escapeHtml(profilePicture)}" alt="${escapeHtml(fullName)}" class="avatar__image">
      </div>
    `;
  }

  // Otherwise show initials
  const initials = `${firstName[0] ?? 'U'}${lastName[0] ?? 'N'}`.toUpperCase();
  return `
    <div class="avatar avatar--sm avatar--color-${avatarColor}">
      <span class="avatar__initials">${initials}</span>
    </div>
  `;
}

export function renderComments(comments: BlackboardComment[], container: HTMLElement): void {
  if (comments.length === 0) {
    setHTML(container, '<p class="text-muted">Keine Kommentare vorhanden.</p>');
    return;
  }

  setHTML(
    container,
    comments
      .map((comment) => {
        const firstName = comment.firstName ?? 'U';
        const lastName = comment.lastName ?? 'N';
        const avatarColor = comment.id % 10; // Design System: 10 color variants
        const commentClass = comment.isInternal ? 'comment-item comment-internal' : 'comment-item';
        const avatarHtml = createAvatarHtml(comment.profilePicture, firstName, lastName, avatarColor);

        return `
      <div class="${commentClass}">
        <div class="comment-header">
          <div class="comment-author">
            ${avatarHtml}
            <div>
              <strong>${escapeHtml(firstName)} ${escapeHtml(lastName)}</strong>
              ${comment.isInternal ? '<span class="internal-badge">Intern</span>' : ''}
            </div>
          </div>
          <span class="comment-date">${formatDateTime(comment.createdAt)}</span>
        </div>
        <div class="comment-content">${escapeHtml(comment.comment)}</div>
      </div>
    `;
      })
      .join(''),
  );
}

export function renderPhotoGallery(
  photos: BlackboardAttachment[],
  photoSection: HTMLElement,
  photoGallery: HTMLElement,
): void {
  photoSection.removeAttribute('hidden');

  const token = getAuthToken();
  const tokenParam = token !== null && token !== '' ? token : '';

  setHTML(
    photoGallery,
    photos
      .map(
        (photo, index) => `
      <div class="photo-thumbnail" data-action="open-lightbox" data-url="/api/v2/blackboard/attachments/${photo.fileUuid}/download?token=${encodeURIComponent(tokenParam)}">
        <img src="/api/v2/blackboard/attachments/${photo.fileUuid}/download?token=${encodeURIComponent(tokenParam)}"
             alt="${escapeHtml(photo.filename)}"
             loading="lazy">
        ${index === 0 && photos.length > 1 ? `<span class="photo-count">${photos.length} Fotos</span>` : ''}
      </div>
    `,
      )
      .join(''),
  );
}

export function renderOtherAttachments(
  files: BlackboardAttachment[],
  attachmentsCard: HTMLElement,
  container: HTMLElement,
): void {
  attachmentsCard.removeAttribute('hidden');

  setHTML(
    container,
    files
      .map((attachment) => {
        // Use mimeType (documents API) - fileType is legacy/optional
        const mimeType = attachment.mimeType;
        const fileIcon = getFileIcon(mimeType);
        const fileSize = formatFileSize(attachment.fileSize);
        const isPDF = mimeType === 'application/pdf';
        const isImage = mimeType.startsWith('image/');
        const canPreview = isPDF || isImage;

        return `
        <div class="attachment-item" data-file-uuid="${attachment.fileUuid}" data-preview="${canPreview}" data-type="${mimeType}" data-name="${escapeHtml(attachment.filename)}">
          <i class="${fileIcon}"></i>
          <div class="attachment-info">
            <div class="attachment-name">${escapeHtml(attachment.filename)}</div>
            <div class="attachment-meta">
              ${fileSize} • ${escapeHtml(attachment.uploadedByName)}
            </div>
          </div>
        </div>
      `;
      })
      .join(''),
  );
}

// ============================================================================
// Preview Modal Functions (Design System - like documents-explorer)
// ============================================================================

/** Current attachment being previewed - needed for download */
let currentPreviewAttachment: BlackboardAttachment | null = null;

/** All loaded attachments - used to find attachment by UUID for photo gallery */
let loadedAttachments: BlackboardAttachment[] = [];

/**
 * Store attachments for later lookup (called after loading)
 */
export function setLoadedAttachments(attachments: BlackboardAttachment[]): void {
  loadedAttachments = attachments;
}

/**
 * Get attachment by UUID from loaded attachments
 */
export function getAttachmentByUuid(uuid: string): BlackboardAttachment | undefined {
  return loadedAttachments.find((att) => att.fileUuid === uuid);
}

/**
 * Get file type category for preview
 */
function getPreviewFileType(fileName: string, mimeType: string): 'pdf' | 'image' | 'other' {
  const extension = fileName.toLowerCase().split('.').pop() ?? '';

  if (extension === 'pdf' || mimeType === 'application/pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension) || mimeType.startsWith('image/')) return 'image';
  return 'other';
}

/**
 * Get icon class based on file type
 */
function getPreviewIcon(fileType: 'pdf' | 'image' | 'other'): string {
  const iconMap = {
    pdf: 'fas fa-file-pdf text-error-500',
    image: 'fas fa-image text-success-500',
    other: 'fas fa-file text-content-secondary',
  } as const;
  // eslint-disable-next-line security/detect-object-injection -- fileType is constrained union type, not user input
  return iconMap[fileType];
}

/**
 * Build download URL with auth token
 */
function buildDownloadUrl(fileUuid: string): string {
  const token = getAuthToken();
  const tokenParam = token !== null && token !== '' ? encodeURIComponent(token) : '';
  return `/api/v2/blackboard/attachments/${fileUuid}/download?token=${tokenParam}`;
}

/**
 * Update modal header elements
 */
function updateModalHeader(attachment: BlackboardAttachment, fileType: 'pdf' | 'image' | 'other'): void {
  const titleEl = document.getElementById('preview-title');
  const iconEl = document.getElementById('preview-icon');
  const sizeEl = document.getElementById('preview-size');
  const uploaderEl = document.getElementById('preview-uploader');

  titleEl?.replaceChildren(attachment.filename);
  if (iconEl !== null) iconEl.className = getPreviewIcon(fileType) + ' mr-2';

  const sizeSpan = sizeEl?.querySelector('span');
  sizeSpan?.replaceChildren(formatFileSize(attachment.fileSize));

  const uploaderSpan = uploaderEl?.querySelector('span');
  uploaderSpan?.replaceChildren(attachment.uploadedByName);
}

/**
 * Show preview content based on file type
 */
function showPreviewContent(fileType: 'pdf' | 'image' | 'other', downloadUrl: string, filename: string): void {
  const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement | null;
  const imageContainer = document.getElementById('preview-image-container');
  const image = document.getElementById('preview-image') as HTMLImageElement | null;
  const noPreview = document.getElementById('preview-no-preview');

  // Hide all containers first
  iframe?.classList.add('hidden');
  imageContainer?.classList.add('hidden');
  noPreview?.classList.add('hidden');

  // Show appropriate preview
  if (fileType === 'pdf' && iframe !== null) {
    iframe.classList.remove('hidden');
    iframe.src = downloadUrl;
  } else if (fileType === 'image' && imageContainer !== null && image !== null) {
    imageContainer.classList.remove('hidden');
    image.src = downloadUrl;
    image.alt = filename;
  } else if (noPreview !== null) {
    noPreview.classList.remove('hidden');
  }
}

/**
 * Open preview modal for an attachment
 */
export function openPreviewModal(attachment: BlackboardAttachment): void {
  const modal = document.getElementById('preview-modal');
  if (modal === null) return;

  currentPreviewAttachment = attachment;

  const downloadUrl = buildDownloadUrl(attachment.fileUuid);
  const fileType = getPreviewFileType(attachment.filename, attachment.mimeType);

  updateModalHeader(attachment, fileType);
  showPreviewContent(fileType, downloadUrl, attachment.filename);

  modal.classList.add('modal-overlay--active');
  document.body.style.overflow = 'hidden';
}

/**
 * Close preview modal
 */
export function closePreviewModal(): void {
  const modal = document.getElementById('preview-modal');
  const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement | null;
  const image = document.getElementById('preview-image') as HTMLImageElement | null;

  if (modal === null) return;

  // Clear preview content to stop loading/playback
  if (iframe !== null) {
    iframe.onerror = null;
    iframe.src = '';
  }
  if (image !== null) {
    image.onerror = null;
    image.src = '';
  }

  // Clear current attachment
  currentPreviewAttachment = null;

  // Hide modal (Design System pattern)
  modal.classList.remove('modal-overlay--active');
  document.body.style.overflow = '';
}

/**
 * Download current preview attachment
 */
function downloadCurrentAttachment(): void {
  if (currentPreviewAttachment === null) return;

  const token = getAuthToken();
  const tokenParam = token !== null && token !== '' ? encodeURIComponent(token) : '';
  const downloadUrl = `/api/v2/blackboard/attachments/${currentPreviewAttachment.fileUuid}/download?token=${tokenParam}`;

  // Create temporary link and trigger download
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = currentPreviewAttachment.filename;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Open lightbox (legacy - now uses preview modal)
 */
export function openLightbox(src: string): void {
  // Extract UUID from URL - format: /api/v2/blackboard/attachments/{uuid}/download?token=...
  const uuidMatch = /attachments\/([^/]+)\/download/.exec(src);
  const fileUuid = uuidMatch?.[1] ?? '';

  // Try to find the attachment in loaded attachments (has real filename)
  const foundAttachment = loadedAttachments.find((att) => att.fileUuid === fileUuid);

  if (foundAttachment !== undefined) {
    // Found the attachment - use it with real filename
    openPreviewModal(foundAttachment);
  } else {
    // Fallback: create temp attachment with generic name
    const tempAttachment: BlackboardAttachment = {
      id: 0,
      fileUuid: fileUuid,
      filename: 'Bild',
      originalName: 'Bild',
      mimeType: 'image/jpeg',
      fileSize: 0,
      uploadedBy: 0,
      uploadedByName: '',
      uploadedAt: '',
    };
    openPreviewModal(tempAttachment);
  }
}

export function closeLightbox(): void {
  closePreviewModal();
}

// ============================================================================
// UI Event Initialization
// ============================================================================

export function initUIInteractions(): void {
  // Initialize preview modal event listeners
  const modal = document.getElementById('preview-modal');

  // Close on overlay click
  modal?.addEventListener('click', (e: MouseEvent) => {
    if (e.target === modal) {
      closePreviewModal();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && modal?.classList.contains('modal-overlay--active') === true) {
      closePreviewModal();
    }
  });

  // Event delegation for all click actions
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // Close preview modal (new Design System pattern)
    if (target.closest('[data-action="close-preview-modal"]') !== null) {
      closePreviewModal();
      return;
    }

    // Download from preview modal
    if (target.closest('[data-action="download-preview"]') !== null) {
      downloadCurrentAttachment();
      return;
    }

    // Open lightbox from photo gallery (now uses preview modal)
    const lightboxTrigger = target.closest<HTMLElement>('[data-action="open-lightbox"]');
    if (lightboxTrigger !== null) {
      const url = lightboxTrigger.dataset['url'];
      if (url !== undefined && url !== '') {
        openLightbox(url);
      }
    }
  });

  console.info('[Blackboard Detail UI] Interactions initialized');
}

// Auto-initialize if module is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUIInteractions);
} else {
  initUIInteractions();
}
