// =============================================================================
// DOCUMENTS EXPLORER - UTILITY FUNCTIONS
// =============================================================================

import {
  CATEGORY_LABELS,
  CATEGORY_MAPPINGS,
  MESSAGES,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE,
} from './constants';

import type {
  Document,
  DocumentCategory,
  FileTypeDisplayInfo,
  CategoryMapping,
  UploadFormData,
  UploadData,
  CurrentUser,
  ValidatedUploadData,
  UploadValidationResult,
} from './types';

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
export function getFileTypeDisplayInfo(
  mimeType: string,
  extension: string,
): FileTypeDisplayInfo {
  if (mimeType === 'application/pdf' || extension === 'pdf') {
    return {
      cssClass: 'file-upload-item__preview--pdf',
      iconClass: 'fas fa-file-pdf',
    };
  }

  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  if (mimeType.startsWith('image/') || imageExtensions.includes(extension)) {
    return {
      cssClass: 'file-upload-item__preview--image',
      iconClass: 'fas fa-file-image',
    };
  }

  const wordExtensions = ['doc', 'docx'];
  if (mimeType.includes('word') || wordExtensions.includes(extension)) {
    return {
      cssClass: 'file-upload-item__preview--word',
      iconClass: 'fas fa-file-word',
    };
  }

  const excelExtensions = ['xls', 'xlsx'];
  if (
    mimeType.includes('excel') ||
    mimeType.includes('spreadsheet') ||
    excelExtensions.includes(extension)
  ) {
    return {
      cssClass: 'file-upload-item__preview--excel',
      iconClass: 'fas fa-file-excel',
    };
  }

  return { cssClass: '', iconClass: 'fas fa-file' };
}

// =============================================================================
// DOCUMENT HELPERS
// =============================================================================

/**
 * Check if document should show "Neu" badge
 * Badge shows when: (uploaded in last 61 days) AND (user has NOT read it yet)
 */
export function isDocumentNew(doc: Document): boolean {
  const uploadDate = new Date(doc.uploadedAt);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 61);
  const isRecent = uploadDate >= cutoffDate;

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
  const truncated =
    nameWithoutExt.slice(0, maxLength - extension.length - 3) + '...';

  return truncated + extension;
}

// =============================================================================
// CATEGORY HELPERS
// =============================================================================

/**
 * Get category label for display
 */
export function getCategoryLabel(category: DocumentCategory): string {
  return CATEGORY_LABELS[category];
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

  if (
    mapping.requiresField === 'teamId' &&
    (user.teamId === null || user.teamId === undefined)
  ) {
    return {
      valid: false,
      error:
        'Sie müssen einem Team zugeordnet sein, um Team-Dokumente hochzuladen!',
    };
  }

  if (
    mapping.requiresField === 'departmentId' &&
    (user.departmentId === null || user.departmentId === undefined)
  ) {
    return {
      valid: false,
      error:
        'Sie müssen einer Abteilung zugeordnet sein, um Abteilungs-Dokumente hochzuladen!',
    };
  }

  return { valid: true };
}

/**
 * Parse tags from comma-separated string
 */
function parseTags(tags: string): string[] {
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Populate target IDs based on access scope
 */
function populateTargetIds(
  uploadData: UploadFormData,
  accessScope: string,
  user: CurrentUser,
): void {
  if (accessScope === 'personal' || accessScope === 'payroll') {
    uploadData.ownerUserId = user.id;
    return;
  }

  if (
    accessScope === 'team' &&
    user.teamId !== null &&
    user.teamId !== undefined
  ) {
    uploadData.targetTeamId = user.teamId;
    return;
  }

  if (
    accessScope === 'department' &&
    user.departmentId !== null &&
    user.departmentId !== undefined
  ) {
    uploadData.targetDepartmentId = user.departmentId;
  }
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
  if (!(category in CATEGORY_MAPPINGS)) {
    return null;
  }
  const mapping = CATEGORY_MAPPINGS[category];

  const parsedTags = parseTags(tags);

  const uploadData: UploadFormData = {
    file,
    accessScope: mapping.accessScope,
    category: mapping.categoryValue,
    documentName: documentName || null,
    description: description || null,
    tags: parsedTags.length > 0 ? parsedTags : undefined,
  };

  populateTargetIds(uploadData, mapping.accessScope, user);

  if (
    mapping.requiresPayrollPeriod === true &&
    salaryYear !== undefined &&
    salaryMonth !== undefined
  ) {
    uploadData.salaryYear = salaryYear;
    uploadData.salaryMonth = salaryMonth;
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
 */
export function canEditDocument(
  doc: Document,
  user: CurrentUser | null,
): boolean {
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
 */
export function canDeleteDocument(
  doc: Document,
  user: CurrentUser | null,
): boolean {
  // Same logic as edit for now
  return canEditDocument(doc, user);
}

// =============================================================================
// UPLOAD VALIDATION
// =============================================================================

/**
 * Validate upload data before submission
 * Checks: file selected, category selected, user loaded, user has required fields, payroll period
 */
export function validateUploadData(
  data: UploadData,
  user: CurrentUser | null,
): UploadValidationResult {
  if (data.file === null) {
    return { valid: false, error: MESSAGES.UPLOAD_NO_FILE, type: 'warning' };
  }
  if (data.category === '') {
    return {
      valid: false,
      error: MESSAGES.UPLOAD_NO_CATEGORY,
      type: 'warning',
    };
  }
  if (user === null) {
    return {
      valid: false,
      error: 'Benutzerdaten nicht geladen',
      type: 'error',
    };
  }

  const mapping = CATEGORY_MAPPINGS[data.category];
  const validation = validateUserForCategory(mapping, user);
  if (!validation.valid) {
    return { valid: false, error: validation.error ?? '', type: 'warning' };
  }
  if (
    mapping.requiresPayrollPeriod === true &&
    (data.salaryYear === 0 || data.salaryMonth === 0)
  ) {
    return {
      valid: false,
      error: MESSAGES.UPLOAD_SELECT_PAYROLL_PERIOD,
      type: 'warning',
    };
  }

  return {
    valid: true,
    data: {
      file: data.file,
      category: data.category,
      user,
      requiresPayroll: mapping.requiresPayrollPeriod === true,
    } satisfies ValidatedUploadData,
  };
}

// =============================================================================
// DOCUMENT DOWNLOAD
// =============================================================================

/**
 * Trigger document download via DOM link creation
 * Cookie-based auth: accessToken cookie sent automatically on same-origin request
 * No token in URL = no token in logs/history
 */
export function downloadDocument(doc: Document): void {
  const link = document.createElement('a');
  link.href = doc.downloadUrl;
  link.download = doc.filename;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
