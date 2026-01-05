// =============================================================================
// DOCUMENTS EXPLORER - UTILITY FUNCTIONS
// =============================================================================

import type {
  Document,
  DocumentCategory,
  FileTypeDisplayInfo,
  CategoryMapping,
  UploadFormData,
  CurrentUser,
} from './types';
import { CATEGORY_LABELS, CATEGORY_MAPPINGS, ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from './constants';

// =============================================================================
// DATE FORMATTING
// =============================================================================

/**
 * Format date for table display (DD.MM.YYYY)
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format date with time for preview modal
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format date as relative time (e.g., "vor 2 Tagen")
 * Used in grid view
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Heute';
  } else if (diffDays === 1) {
    return 'Gestern';
  } else if (diffDays < 7) {
    return `vor ${diffDays} Tagen`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `vor ${weeks} ${weeks === 1 ? 'Woche' : 'Wochen'}`;
  }
  return formatDate(dateString);
}

// =============================================================================
// FILE SIZE FORMATTING
// =============================================================================

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (Number.isNaN(bytes) || bytes < 0) {
    return 'Unbekannt';
  }

  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = Math.round((bytes / Math.pow(k, i)) * 100) / 100;
  const unit = sizes[i] ?? 'Bytes';

  return `${size} ${unit}`;
}

// =============================================================================
// FILE TYPE HELPERS
// =============================================================================

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.substring(lastDot + 1).toLowerCase() : '';
}

/**
 * Get display name with extension
 * Ensures filename always has extension from stored filename
 */
export function getDisplayName(doc: Document): string {
  const filenameHasExtension = doc.filename.lastIndexOf('.') > 0;
  if (filenameHasExtension) {
    return doc.filename;
  }
  const lastDot = doc.storedFilename.lastIndexOf('.');
  const extension = lastDot !== -1 ? doc.storedFilename.substring(lastDot) : '';
  return doc.filename + extension;
}

/**
 * Get file type for preview (pdf, image, document)
 */
export function getFileType(doc: Document): 'pdf' | 'image' | 'document' {
  const extension = getFileExtension(doc.storedFilename);

  if (extension === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) return 'image';
  return 'document';
}

/**
 * Get file type display info for upload preview
 */
export function getFileTypeDisplayInfo(mimeType: string, extension: string): FileTypeDisplayInfo {
  if (mimeType === 'application/pdf' || extension === 'pdf') {
    return { cssClass: 'file-upload-item__preview--pdf', iconClass: 'fas fa-file-pdf' };
  }

  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  if (mimeType.startsWith('image/') || imageExtensions.includes(extension)) {
    return { cssClass: 'file-upload-item__preview--image', iconClass: 'fas fa-file-image' };
  }

  const wordExtensions = ['doc', 'docx'];
  if (mimeType.includes('word') || wordExtensions.includes(extension)) {
    return { cssClass: 'file-upload-item__preview--word', iconClass: 'fas fa-file-word' };
  }

  const excelExtensions = ['xls', 'xlsx'];
  if (
    mimeType.includes('excel') ||
    mimeType.includes('spreadsheet') ||
    excelExtensions.includes(extension)
  ) {
    return { cssClass: 'file-upload-item__preview--excel', iconClass: 'fas fa-file-excel' };
  }

  return { cssClass: '', iconClass: 'fas fa-file' };
}

// =============================================================================
// DOCUMENT HELPERS
// =============================================================================

/**
 * Check if document should show "Neu" badge
 * Badge shows when: (uploaded in last 7 days) AND (user has NOT read it yet)
 */
export function isDocumentNew(doc: Document): boolean {
  const uploadDate = new Date(doc.uploadedAt);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const isRecent = uploadDate >= sevenDaysAgo;

  return isRecent && !doc.isRead;
}

/**
 * Truncate filename to max length
 */
export function truncateFilename(filename: string, maxLength: number): string {
  if (filename.length <= maxLength) {
    return filename;
  }

  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) {
    return filename.slice(0, maxLength - 3) + '...';
  }

  const extension = filename.slice(lastDot);
  const nameWithoutExt = filename.slice(0, lastDot);
  const truncated = nameWithoutExt.slice(0, maxLength - extension.length - 3) + '...';

  return truncated + extension;
}

// =============================================================================
// CATEGORY HELPERS
// =============================================================================

/**
 * Get category label for display
 */
export function getCategoryLabel(category: DocumentCategory): string {
  return CATEGORY_LABELS[category] ?? category;
}

// =============================================================================
// UPLOAD VALIDATION
// =============================================================================

/**
 * Validate file for upload
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Nur PDF, Word, Excel, JPG und PNG Dateien sind erlaubt!',
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'Datei ist zu groß! Maximale Größe: 5 MB',
    };
  }

  return { valid: true };
}

/**
 * Validate user has required field for upload category
 */
export function validateUserForCategory(
  mapping: CategoryMapping,
  user: CurrentUser,
): { valid: boolean; error?: string } {
  if (mapping.requiresField === undefined) {
    return { valid: true };
  }

  if (mapping.requiresField === 'teamId' && (user.teamId === null || user.teamId === undefined)) {
    return {
      valid: false,
      error: 'Sie müssen einem Team zugeordnet sein, um Team-Dokumente hochzuladen!',
    };
  }

  if (
    mapping.requiresField === 'departmentId' &&
    (user.departmentId === null || user.departmentId === undefined)
  ) {
    return {
      valid: false,
      error: 'Sie müssen einer Abteilung zugeordnet sein, um Abteilungs-Dokumente hochzuladen!',
    };
  }

  return { valid: true };
}

/**
 * Build UploadFormData from form state
 */
export function buildUploadFormData(
  file: File,
  category: string,
  user: CurrentUser,
  documentName: string,
  description: string,
  tags: string,
  salaryYear?: number,
  salaryMonth?: number,
): UploadFormData | null {
  const mapping = CATEGORY_MAPPINGS[category];
  if (mapping === undefined) {
    return null;
  }

  // Parse tags from comma-separated string
  const parsedTags = tags
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const uploadData: UploadFormData = {
    file,
    accessScope: mapping.accessScope,
    category: mapping.categoryValue,
    documentName: documentName || null,
    description: description || null,
    tags: parsedTags.length > 0 ? parsedTags : undefined,
  };

  // Auto-populate IDs based on access scope
  switch (mapping.accessScope) {
    case 'personal':
    case 'payroll':
      uploadData.ownerUserId = user.id;
      break;
    case 'team':
      if (user.teamId !== null && user.teamId !== undefined) {
        uploadData.targetTeamId = user.teamId;
      }
      break;
    case 'department':
      if (user.departmentId !== null && user.departmentId !== undefined) {
        uploadData.targetDepartmentId = user.departmentId;
      }
      break;
  }

  // Add payroll period if required
  if (mapping.requiresPayrollPeriod === true) {
    if (salaryYear !== undefined && salaryMonth !== undefined) {
      uploadData.salaryYear = salaryYear;
      uploadData.salaryMonth = salaryMonth;
    }
  }

  return uploadData;
}

// =============================================================================
// HTML ESCAPE
// =============================================================================

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// =============================================================================
// PERMISSION HELPERS
// =============================================================================

/**
 * Check if user is admin (root or admin role)
 */
export function isAdmin(role: string | null): boolean {
  return role === 'root' || role === 'admin';
}

/**
 * Check if user can upload documents
 */
export function canUpload(role: string | null): boolean {
  return isAdmin(role);
}

/**
 * Check if user can see action menu
 */
export function canSeeActions(role: string | null): boolean {
  return isAdmin(role);
}

/**
 * Check if user can edit a specific document
 *
 * Permission logic:
 * - root: can edit all documents
 * - admin with hasFullAccess=true: can edit all documents
 * - admin with hasFullAccess=false: can only edit own documents
 * - employee: can only edit own documents
 *
 * @param doc - The document to check
 * @param user - Current user (null if not loaded)
 * @returns true if user can edit
 */
export function canEditDocument(doc: Document, user: CurrentUser | null): boolean {
  if (user === null) return false;

  // root can edit everything
  if (user.role === 'root') return true;

  // Owner can always edit their own documents
  if (doc.uploadedBy === user.id) return true;

  // admin with hasFullAccess can edit all documents
  if (user.role === 'admin' && user.hasFullAccess === true) return true;

  return false;
}

/**
 * Check if user can delete a specific document
 *
 * Permission logic (same as edit):
 * - root: can delete all documents
 * - admin with hasFullAccess=true: can delete all documents
 * - admin with hasFullAccess=false: can only delete own documents
 * - employee: can only delete own documents
 *
 * @param doc - The document to check
 * @param user - Current user (null if not loaded)
 * @returns true if user can delete
 */
export function canDeleteDocument(doc: Document, user: CurrentUser | null): boolean {
  // Same logic as edit for now
  return canEditDocument(doc, user);
}
