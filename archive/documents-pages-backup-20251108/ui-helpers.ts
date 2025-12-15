/**
 * Documents Shared UI Helpers
 * Reusable UI utility functions
 */

/**
 * Format date to German locale
 * @param dateString - ISO date string
 * @returns Formatted date (DD.MM.YYYY)
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
 * Format file size in bytes to human-readable format
 * @param bytes - File size in bytes
 * @returns Formatted file size (e.g. "1.5 MB")
 */
export function formatFileSize(bytes: number | undefined): string {
  // Handle undefined or invalid values
  if (bytes === undefined || Number.isNaN(bytes) || bytes === 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // eslint-disable-next-line security/detect-object-injection -- i is mathematically bounded by log calculation
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Escape HTML to prevent XSS
 * @param text - Text to escape
 * @returns Escaped HTML string
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get human-readable label for document scope
 * @param scope - Document scope
 * @returns German label
 */
export function getScopeLabel(scope: string): string {
  switch (scope) {
    case 'company':
      return 'Firma';
    case 'department':
      return 'Abteilung';
    case 'team':
      return 'Team';
    case 'personal':
      return 'Persönlich';
    case 'payroll':
      return 'Gehalt';
    default:
      return 'Allgemein';
  }
}

/**
 * Get file icon class based on file extension
 * @param fileName - File name with extension
 * @returns Font Awesome icon class
 */
export function getFileIcon(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';

  const iconMap: Record<string, string> = {
    pdf: 'fas fa-file-pdf',
    doc: 'fas fa-file-word',
    docx: 'fas fa-file-word',
    xls: 'fas fa-file-excel',
    xlsx: 'fas fa-file-excel',
    ppt: 'fas fa-file-powerpoint',
    pptx: 'fas fa-file-powerpoint',
    jpg: 'fas fa-file-image',
    jpeg: 'fas fa-file-image',
    png: 'fas fa-file-image',
    gif: 'fas fa-file-image',
    zip: 'fas fa-file-archive',
    rar: 'fas fa-file-archive',
    txt: 'fas fa-file-alt',
    csv: 'fas fa-file-csv',
  };

  // Safe: Read-only access to known icon map, with fallback value
  // eslint-disable-next-line security/detect-object-injection
  return iconMap[extension] ?? 'fas fa-file';
}
