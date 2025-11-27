/* eslint-disable max-lines */
/**
 * KVP Detail UI Utilities
 * Contains all rendering methods and data conversion utilities for KVP detail page
 */

import { setHTML } from '../../../utils/dom-utils';
import { getAuthToken } from '../../auth';
import { showInfoModal } from '../../utils/alerts';

// CSS class constants
const MODAL_ACTIVE_CLASS = 'modal-overlay--active';

// Re-export types that UI functions need
export interface KvpAPIResponse {
  id?: number;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  org_level?: string;
  orgLevel?: string;
  org_id?: number;
  orgId?: number;
  is_shared?: number;
  isShared?: number;
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

export interface KvpSuggestion {
  id: number;
  title: string;
  description: string;
  status: 'new' | 'in_review' | 'approved' | 'implemented' | 'rejected' | 'archived';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  orgLevel: 'company' | 'department' | 'area' | 'team';
  orgId: number;
  isShared: number; // 0 = private (only creator + team leader), 1 = shared
  departmentId: number;
  departmentName: string;
  areaId?: number | undefined;
  areaName?: string | undefined;
  teamId?: number | undefined;
  teamName?: string | undefined;
  submittedBy: number;
  submittedByName: string;
  submittedByLastname: string;
  categoryId: number;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  sharedBy?: number | undefined;
  sharedByName?: string | undefined;
  sharedAt?: string | undefined;
  createdAt: string;
  expectedBenefit?: string | undefined;
  estimatedCost?: number | undefined;
  actualSavings?: number | undefined;
  implementationDate?: string | undefined;
  assignedTo?: number | undefined;
  rejectionReason?: string | undefined;
  roi?: number | undefined;
}

export interface Comment {
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

export interface Attachment {
  id: number;
  fileUuid: string; // NEW: Secure UUID for downloads
  suggestionId: number;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  uploadedBy: number;
  firstName: string; // From users table JOIN
  lastName: string; // From users table JOIN
  uploadedAt: string;
}

// Data Conversion Functions
export function convertBasicFields(
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

export function convertOrgFields(
  s: KvpAPIResponse,
): Pick<KvpSuggestion, 'orgLevel' | 'orgId' | 'isShared' | 'departmentId' | 'departmentName' | 'teamId' | 'teamName'> {
  return {
    orgLevel: (s.org_level ?? s.orgLevel ?? 'company') as KvpSuggestion['orgLevel'],
    orgId: s.org_id ?? s.orgId ?? 0,
    isShared: s.is_shared ?? s.isShared ?? 0,
    departmentId: s.department_id ?? s.departmentId ?? 0,
    departmentName: s.department_name ?? s.departmentName ?? '',
    teamId: s.team_id ?? s.teamId,
    teamName: s.team_name ?? s.teamName,
  };
}

export function convertUserFields(
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

export function convertCategoryFields(
  s: KvpAPIResponse,
): Pick<KvpSuggestion, 'categoryId' | 'categoryName' | 'categoryIcon' | 'categoryColor'> {
  return {
    categoryId: s.category_id ?? s.categoryId ?? 0,
    categoryName: s.category_name ?? s.categoryName ?? '',
    categoryIcon: s.category_icon ?? s.categoryIcon ?? '',
    categoryColor: s.category_color ?? s.categoryColor ?? '',
  };
}

export function convertFinancialFields(
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

export function convertSuggestionToCamelCase(suggestion: Record<string, unknown>): KvpSuggestion {
  const s = suggestion as KvpAPIResponse;

  return {
    ...convertBasicFields(s),
    ...convertOrgFields(s),
    ...convertUserFields(s),
    ...convertCategoryFields(s),
    ...convertFinancialFields(s),
  };
}

// Rendering Functions
export function renderComments(comments: Comment[], container: HTMLElement): void {
  if (comments.length === 0) {
    setHTML(container, '<p class="empty-state">Noch keine Kommentare</p>');
    return;
  }

  setHTML(
    container,
    comments
      .map((comment) => {
        const initials = `${comment.firstName[0] ?? 'U'}${comment.lastName[0] ?? 'N'}`.toUpperCase();
        const avatarColor = comment.id % 10; // Design System: 10 color variants
        const commentClass = comment.isInternal ? 'comment-item comment-internal' : 'comment-item';

        return `
      <div class="${commentClass}">
        <div class="comment-header">
          <div class="comment-author">
            <div class="avatar avatar--sm avatar--color-${avatarColor}">
              <span class="avatar__initials">${initials}</span>
            </div>
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
          ${escapeHtml(comment.comment)}
        </div>
      </div>
    `;
      })
      .join(''),
  );
}

export function renderPhotoGallery(photos: Attachment[], photoSection: HTMLElement, photoGallery: HTMLElement): void {
  photoSection.style.display = '';

  const token = getAuthToken();
  const tokenParam = token !== null && token !== '' ? token : '';

  setHTML(
    photoGallery,
    photos
      .map(
        (photo, index) => `
      <div class="photo-thumbnail" data-action="open-lightbox" data-url="/api/v2/kvp/attachments/${photo.fileUuid}/download?token=${encodeURIComponent(tokenParam)}">
        <img src="/api/v2/kvp/attachments/${photo.fileUuid}/download?token=${encodeURIComponent(tokenParam)}"
             alt="${escapeHtml(photo.fileName)}"
             loading="lazy">
        ${index === 0 && photos.length > 1 ? `<span class="photo-count">${photos.length} Fotos</span>` : ''}
      </div>
    `,
      )
      .join(''),
  );
}

export function renderOtherAttachments(
  otherFiles: Attachment[],
  attachmentsCard: HTMLElement,
  container: HTMLElement,
): HTMLElement {
  attachmentsCard.style.display = '';

  setHTML(
    container,
    otherFiles
      .map((attachment) => {
        const fileIcon = getFileIcon(attachment.fileType);
        const fileSize = formatFileSize(attachment.fileSize);

        return `
        <div class="attachment-item" data-uuid="${attachment.fileUuid}">
          <i class="${fileIcon}"></i>
          <div class="attachment-info">
            <div class="attachment-name">${escapeHtml(attachment.fileName)}</div>
            <div class="attachment-meta">
              ${fileSize} • ${attachment.firstName} ${attachment.lastName}
            </div>
          </div>
          <i class="fas fa-download"></i>
        </div>
      `;
      })
      .join(''),
  );

  return container;
}

export function updateVisibilityBadgeIcon(
  icon: Element,
  orgLevel: string,
  visibilityText: Element,
  suggestion?: KvpSuggestion,
): void {
  // If not shared (private), show lock icon and "Privat"
  if (suggestion?.isShared === 0) {
    icon.className = 'fas fa-lock';
    visibilityText.textContent = 'Privat';
    return;
  }

  // If shared, show org level info
  if (orgLevel === 'team') {
    icon.className = 'fas fa-users';
    visibilityText.textContent = suggestion?.teamName ?? 'Team';
  } else if (orgLevel === 'department') {
    icon.className = 'fas fa-building';
    visibilityText.textContent = suggestion?.departmentName ?? '';
  } else if (orgLevel === 'area') {
    icon.className = 'fas fa-sitemap';
    visibilityText.textContent = suggestion?.areaName ?? 'Bereich';
  } else {
    icon.className = 'fas fa-globe';
    visibilityText.textContent = 'Firmenweit';
  }
}

// Utility Functions
export function getStatusText(status: string): string {
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

export function getPriorityText(priority: string): string {
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

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function getShareLevelText(orgLevel: string): string {
  if (orgLevel === 'company') return 'Firmenebene';
  if (orgLevel === 'department') return 'Abteilungsebene';
  return 'Teamebene';
}

export function hasImplementationDate(suggestion?: KvpSuggestion): boolean {
  return (
    suggestion?.implementationDate !== undefined &&
    suggestion.implementationDate !== '' &&
    (suggestion.implementationDate as string | null) !== null
  );
}

/* ========================================
   UI INTERACTIONS - Added 2025-11-14
   Extracted from inline JavaScript
   Updated 2025-11-26: Preview Modal (like documents-explorer)
   ======================================== */

/* PREVIEW MODAL MANAGEMENT */

/** Current attachment being previewed - needed for download */
let currentPreviewAttachment: Attachment | null = null;

/** All loaded attachments - used to find attachment by UUID for photo gallery */
let loadedAttachments: Attachment[] = [];

/**
 * Store attachments for later lookup (called from renderer after loading)
 */
export function setLoadedAttachments(attachments: Attachment[]): void {
  loadedAttachments = attachments;
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
 * Build KVP download URL with auth token
 */
function buildKvpDownloadUrl(fileUuid: string): string {
  const token = getAuthToken();
  const tokenParam = token !== null && token !== '' ? encodeURIComponent(token) : '';
  return `/api/v2/kvp/attachments/${fileUuid}/download?token=${tokenParam}`;
}

/**
 * Update modal header elements for KVP attachment
 */
function updateKvpModalHeader(attachment: Attachment, fileType: 'pdf' | 'image' | 'other'): void {
  const titleEl = document.getElementById('preview-title');
  const iconEl = document.getElementById('preview-icon');
  const sizeEl = document.getElementById('preview-size');
  const uploaderEl = document.getElementById('preview-uploader');

  titleEl?.replaceChildren(attachment.fileName);
  if (iconEl !== null) iconEl.className = getPreviewIcon(fileType) + ' mr-2';

  const sizeSpan = sizeEl?.querySelector('span');
  sizeSpan?.replaceChildren(formatFileSize(attachment.fileSize));

  const uploaderSpan = uploaderEl?.querySelector('span');
  uploaderSpan?.replaceChildren(`${attachment.firstName} ${attachment.lastName}`);
}

/**
 * Show preview content based on file type
 */
function showKvpPreviewContent(fileType: 'pdf' | 'image' | 'other', downloadUrl: string, filename: string): void {
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
export function openPreviewModal(attachment: Attachment): void {
  const modal = document.getElementById('preview-modal');
  if (modal === null) return;

  currentPreviewAttachment = attachment;

  const downloadUrl = buildKvpDownloadUrl(attachment.fileUuid);
  const fileType = getPreviewFileType(attachment.fileName, attachment.fileType);

  updateKvpModalHeader(attachment, fileType);
  showKvpPreviewContent(fileType, downloadUrl, attachment.fileName);

  modal.classList.add(MODAL_ACTIVE_CLASS);
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
  modal.classList.remove(MODAL_ACTIVE_CLASS);
  document.body.style.overflow = '';
}

/**
 * Download current preview attachment
 */
function downloadCurrentAttachment(): void {
  if (currentPreviewAttachment === null) return;

  const token = getAuthToken();
  const tokenParam = token !== null && token !== '' ? encodeURIComponent(token) : '';
  const downloadUrl = `/api/v2/kvp/attachments/${currentPreviewAttachment.fileUuid}/download?token=${tokenParam}`;

  // Create temporary link and trigger download
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = currentPreviewAttachment.fileName;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Initialize preview modal event listeners
 */
function initPreviewModal(): void {
  const modal = document.getElementById('preview-modal');

  // Close on overlay click
  modal?.addEventListener('click', (e: MouseEvent) => {
    if (e.target === modal) {
      closePreviewModal();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && modal?.classList.contains(MODAL_ACTIVE_CLASS) === true) {
      closePreviewModal();
    }
  });
}

/* LEGACY LIGHTBOX - kept for backwards compatibility with photo gallery */
export function openLightbox(src: string): void {
  // Photo gallery now uses the preview modal too
  // Extract UUID from URL - format: /api/v2/kvp/attachments/{uuid}/download?token=...
  const uuidMatch = /attachments\/([^/]+)\/download/.exec(src);
  const fileUuid = uuidMatch?.[1] ?? '';

  // Try to find the attachment in loaded attachments (has real filename)
  const foundAttachment = loadedAttachments.find((att) => att.fileUuid === fileUuid);

  if (foundAttachment !== undefined) {
    // Found the attachment - use it with real filename
    openPreviewModal(foundAttachment);
  } else {
    // Fallback: create temp attachment with generic name
    const tempAttachment: Attachment = {
      id: 0,
      fileUuid: fileUuid,
      suggestionId: 0,
      fileName: 'Bild',
      filePath: src,
      fileType: 'image/jpeg',
      fileSize: 0,
      uploadedBy: 0,
      firstName: '',
      lastName: '',
      uploadedAt: '',
    };
    openPreviewModal(tempAttachment);
  }
}

export function closeLightbox(): void {
  closePreviewModal();
}

/* SHARE MODAL MANAGEMENT */
export function openShareModal(): void {
  const shareModal = document.querySelector<HTMLElement>('#shareModal');
  if (shareModal !== null) {
    // Design System pattern: remove hidden + add active class
    shareModal.removeAttribute('hidden');
    shareModal.classList.add(MODAL_ACTIVE_CLASS);
    // NOTE: Organization data is pre-loaded by share-modal.ts before this is called
    // No need to dispatch loadOrgData event (would cause infinite loop)
  }
}

export function closeShareModal(): void {
  const shareModal = document.querySelector<HTMLElement>('#shareModal');
  if (shareModal === null) return;

  shareModal.classList.remove(MODAL_ACTIVE_CLASS);
  shareModal.setAttribute('hidden', '');

  // Reset selections
  document.querySelectorAll<HTMLInputElement>('input[name="orgLevel"]').forEach((input) => (input.checked = false));

  // Reset custom dropdowns
  resetShareDropdown('#teamDropdown', '#teamTrigger span', 'Team auswählen...');
  resetShareDropdown('#departmentDropdown', '#departmentTrigger span', 'Abteilung auswählen...');
}

/**
 * Reset a share modal dropdown to its default state
 */
function resetShareDropdown(dropdownId: string, triggerSelector: string, defaultText: string): void {
  const dropdown = document.querySelector<HTMLElement>(dropdownId);
  if (dropdown === null) return;

  dropdown.setAttribute('hidden', '');
  const trigger = document.querySelector<HTMLElement>(triggerSelector);
  if (trigger !== null) trigger.textContent = defaultText;
}

export async function confirmShare(): Promise<void> {
  const selectedLevel = document.querySelector<HTMLInputElement>('input[name="orgLevel"]:checked');
  if (selectedLevel === null) {
    await showInfoModal('Bitte wählen Sie eine Organisationsebene aus.');
    return;
  }

  let orgId: number | null = null;
  const level = selectedLevel.value;

  if (level === 'team') {
    const teamTrigger = document.querySelector<HTMLElement>('#teamTrigger');
    const orgIdStr = teamTrigger?.getAttribute('data-value') ?? null;
    if (orgIdStr === null || orgIdStr === '') {
      await showInfoModal('Bitte wählen Sie ein Team aus.');
      return;
    }
    orgId = Number.parseInt(orgIdStr, 10);
  } else if (level === 'department') {
    const departmentTrigger = document.querySelector<HTMLElement>('#departmentTrigger');
    const orgIdStr = departmentTrigger?.getAttribute('data-value') ?? null;
    if (orgIdStr === null || orgIdStr === '') {
      await showInfoModal('Bitte wählen Sie eine Abteilung aus.');
      return;
    }
    orgId = Number.parseInt(orgIdStr, 10);
  } else if (level === 'area') {
    const areaTrigger = document.querySelector<HTMLElement>('#areaTrigger');
    const orgIdStr = areaTrigger?.getAttribute('data-value') ?? null;
    if (orgIdStr === null || orgIdStr === '') {
      await showInfoModal('Bitte wählen Sie einen Bereich aus.');
      return;
    }
    orgId = Number.parseInt(orgIdStr, 10);
  }

  // Dispatch share event with data
  window.dispatchEvent(
    new CustomEvent('shareKvp', {
      detail: { orgLevel: level, orgId: orgId },
    }),
  );

  closeShareModal();
}

function initShareModal(): void {
  // Show/hide custom dropdowns based on radio selection
  document.querySelectorAll<HTMLInputElement>('input[name="orgLevel"]').forEach((input) => {
    input.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const teamDropdown = document.querySelector<HTMLElement>('#teamDropdown');
      const departmentDropdown = document.querySelector<HTMLElement>('#departmentDropdown');
      const areaDropdown = document.querySelector<HTMLElement>('#areaDropdown');

      // Hide all dropdowns first
      if (teamDropdown !== null) teamDropdown.setAttribute('hidden', '');
      if (departmentDropdown !== null) departmentDropdown.setAttribute('hidden', '');
      if (areaDropdown !== null) areaDropdown.setAttribute('hidden', '');

      // Show selected dropdown
      if (target.value === 'team' && teamDropdown !== null) {
        teamDropdown.removeAttribute('hidden');
      } else if (target.value === 'department' && departmentDropdown !== null) {
        departmentDropdown.removeAttribute('hidden');
      } else if (target.value === 'area' && areaDropdown !== null) {
        areaDropdown.removeAttribute('hidden');
      }
    });
  });
}

/* DROPDOWN MANAGEMENT */
function toggleDropdown(type: string): void {
  const display = document.querySelector<HTMLElement>(`${type}Display`);
  const dropdown = document.querySelector<HTMLElement>(`${type}Dropdown`);

  if (display === null || dropdown === null) return;

  // Close all other dropdowns
  document.querySelectorAll<HTMLElement>('.dropdown-display, .dropdown__trigger').forEach((d) => {
    if (d !== display) d.classList.remove('active');
  });
  document.querySelectorAll<HTMLElement>('.dropdown-options, .dropdown__menu').forEach((d) => {
    if (d !== dropdown) d.classList.remove('active');
  });

  display.classList.toggle('active');
  dropdown.classList.toggle('active');
}

function selectStatus(value: string, text: string): void {
  const statusDisplay = document.querySelector<HTMLElement>('#statusDisplay');
  const statusValue = document.querySelector<HTMLInputElement>('#statusValue');
  const statusDropdown = document.querySelector<HTMLElement>('#statusDropdown');

  if (statusDisplay !== null) {
    const span = statusDisplay.querySelector('span');
    if (span !== null) {
      span.textContent = text;
    }
  }

  if (statusValue !== null) {
    statusValue.value = value;
  }

  if (statusDisplay !== null) statusDisplay.classList.remove('active');
  if (statusDropdown !== null) statusDropdown.classList.remove('active');

  // Trigger status update event
  const event = new CustomEvent('statusChange', { detail: { status: value } });
  document.dispatchEvent(event);
}

function initDropdowns(): void {
  // Click outside to close
  document.addEventListener('click', function (e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('.custom-dropdown') === null && target.closest('.dropdown') === null) {
      document.querySelectorAll<HTMLElement>('.dropdown-display, .dropdown__trigger').forEach((d) => {
        d.classList.remove('active');
      });
      document.querySelectorAll<HTMLElement>('.dropdown-options, .dropdown__menu').forEach((d) => {
        d.classList.remove('active');
      });
    }
  });
}

/* EVENT DELEGATION */
/**
 * Handle Design System dropdown trigger clicks
 * @returns true if event was handled, false otherwise
 */
function handleDropdownTriggerClick(target: HTMLElement, e: MouseEvent): boolean {
  const dropdownTrigger = target.closest<HTMLElement>('.dropdown__trigger');
  if (dropdownTrigger === null) return false;

  e.preventDefault();
  e.stopPropagation();
  const dropdown = dropdownTrigger.closest('.dropdown');
  if (dropdown !== null) {
    const menu = dropdown.querySelector<HTMLElement>('.dropdown__menu');
    const isActive = menu?.classList.contains('active') ?? false;

    // Close all dropdowns first
    document.querySelectorAll('.dropdown__trigger.active').forEach((t) => {
      t.classList.remove('active');
    });
    document.querySelectorAll('.dropdown__menu.active').forEach((m) => {
      m.classList.remove('active');
    });

    // Toggle current dropdown
    if (!isActive) {
      dropdownTrigger.classList.add('active');
      if (menu !== null) menu.classList.add('active');
    }
  }
  return true;
}

/**
 * Extract label from dropdown option
 */
function getDropdownOptionLabel(dropdownOption: HTMLElement): string {
  const dataLabel = dropdownOption.dataset['label'];
  const textLabel = dropdownOption.textContent.trim();
  return dataLabel !== undefined && dataLabel !== '' ? dataLabel : textLabel;
}

/**
 * Update dropdown UI (trigger text and hidden input)
 */
function updateDropdownUI(dropdown: Element, label: string, value: string): void {
  const trigger = dropdown.querySelector('.dropdown__trigger');
  const triggerSpan = dropdown.querySelector('.dropdown__trigger span');
  if (triggerSpan !== null) triggerSpan.textContent = label;

  // Store value in hidden input (if exists)
  const hiddenInput = dropdown.querySelector<HTMLInputElement>('input[type="hidden"]');
  if (hiddenInput !== null) hiddenInput.value = value;

  // Also store value as data-attribute on trigger (for Share Modal compatibility)
  if (trigger !== null && trigger instanceof HTMLElement) {
    trigger.setAttribute('data-value', value);
  }
}

/**
 * Close dropdown menu
 */
function closeDropdownMenu(dropdown: Element): void {
  const menu = dropdown.querySelector('.dropdown__menu');
  const triggerEl = dropdown.querySelector('.dropdown__trigger');
  if (triggerEl !== null) triggerEl.classList.remove('active');
  if (menu !== null) menu.classList.remove('active');
}

/**
 * Handle Design System dropdown option selection
 * @returns true if event was handled, false otherwise
 */
function handleDropdownOptionClick(target: HTMLElement, e: MouseEvent): boolean {
  const dropdownOption = target.closest<HTMLElement>('.dropdown__option');
  if (dropdownOption === null) return false;

  e.preventDefault();
  const dropdown = dropdownOption.closest('.dropdown');
  if (dropdown === null) return true;

  const action = dropdownOption.dataset['action'] ?? '';
  const value = dropdownOption.dataset['value'] ?? '';
  const label = getDropdownOptionLabel(dropdownOption);

  updateDropdownUI(dropdown, label, value);
  closeDropdownMenu(dropdown);

  // Handle action-specific logic
  if (action === 'select-status') {
    selectStatus(value, label);
  }

  return true;
}

/**
 * Handle legacy dropdown and status actions (backwards compatibility)
 * @returns true if event was handled, false otherwise
 */
function handleLegacyActions(target: HTMLElement): boolean {
  // Handle toggle dropdown (old pattern)
  const toggleBtn = target.closest<HTMLElement>('[data-action="toggle-dropdown"]');
  if (toggleBtn !== null) {
    const dropdownType = toggleBtn.dataset['dropdown'];
    if (dropdownType !== undefined) {
      toggleDropdown(`#${dropdownType}`);
    }
    return true;
  }

  // Handle select status (old pattern)
  const statusOption = target.closest<HTMLElement>('[data-action="select-status"]');
  if (statusOption !== null && statusOption.closest('.dropdown__option') === null) {
    const value = statusOption.dataset['value'] ?? '';
    const label = statusOption.dataset['label'] ?? '';
    selectStatus(value, label);
    return true;
  }

  return false;
}

/**
 * Handle modal and lightbox action buttons
 * @returns true if event was handled, false otherwise
 */
function handleModalActions(target: HTMLElement): boolean {
  // Handle close preview modal (new Design System pattern)
  const closePreviewBtn = target.closest<HTMLElement>('[data-action="close-preview-modal"]');
  if (closePreviewBtn !== null) {
    closePreviewModal();
    return true;
  }

  // Handle download from preview modal
  const downloadPreviewBtn = target.closest<HTMLElement>('[data-action="download-preview"]');
  if (downloadPreviewBtn !== null) {
    downloadCurrentAttachment();
    return true;
  }

  // Handle close share modal
  const closeShareBtn = target.closest<HTMLElement>('[data-action="close-share-modal"]');
  if (closeShareBtn !== null) {
    closeShareModal();
    return true;
  }

  // Handle confirm share
  const confirmShareBtn = target.closest<HTMLElement>('[data-action="confirm-share"]');
  if (confirmShareBtn !== null) {
    void confirmShare(); // async function - use void to ignore promise
    return true;
  }

  // Handle open lightbox from photo gallery (now uses preview modal)
  const openLightboxBtn = target.closest<HTMLElement>('[data-action="open-lightbox"]');
  if (openLightboxBtn !== null) {
    const url = openLightboxBtn.dataset['url'];
    if (url !== undefined) {
      openLightbox(url);
    }
    return true;
  }

  return false;
}

/**
 * Initialize event delegation for all page interactions
 * Delegates click events to specialized handlers for better maintainability
 */
function initEventDelegation(): void {
  document.addEventListener('click', function (e: MouseEvent) {
    const target = e.target as HTMLElement;

    // Handle Design System dropdown trigger
    if (handleDropdownTriggerClick(target, e)) return;

    // Handle Design System dropdown option selection
    if (handleDropdownOptionClick(target, e)) return;

    // Handle legacy dropdown and status actions
    if (handleLegacyActions(target)) return;

    // Handle modal and lightbox actions
    handleModalActions(target);
  });
}

/* INITIALIZATION */
export function initUIInteractions(): void {
  initPreviewModal();
  initShareModal();
  initDropdowns();
  initEventDelegation();

  console.log('[KVP Detail UI] Interactions initialized');
}

// Auto-initialize if module is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUIInteractions);
} else {
  initUIInteractions();
}
