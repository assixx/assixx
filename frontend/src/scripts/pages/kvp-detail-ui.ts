/**
 * KVP Detail UI Utilities
 * Contains all rendering methods and data conversion utilities for KVP detail page
 */

import { setHTML } from '../../utils/dom-utils';
import { getAuthToken } from '../auth';

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
  roi?: number;
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
      <div class="photo-thumbnail" data-action="open-lightbox" data-url="/api/v2/kvp/attachments/${photo.id}/download?token=${encodeURIComponent(tokenParam)}">
        <img src="/api/v2/kvp/attachments/${photo.id}/download?token=${encodeURIComponent(tokenParam)}"
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
        <div class="attachment-item" data-id="${attachment.id}">
          <i class="${fileIcon}"></i>
          <div class="attachment-info">
            <div class="attachment-name">${escapeHtml(attachment.fileName)}</div>
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

  return container;
}

export function updateVisibilityBadgeIcon(
  icon: Element,
  orgLevel: string,
  visibilityText: Element,
  suggestion?: KvpSuggestion,
): void {
  if (orgLevel === 'team') {
    icon.className = 'fas fa-users';
    visibilityText.textContent = suggestion?.teamName ?? 'Team';
  } else if (orgLevel === 'department') {
    icon.className = 'fas fa-building';
    visibilityText.textContent = suggestion?.departmentName ?? '';
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
