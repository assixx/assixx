/**
 * Employee Dashboard Script
 * Handles employee-specific functionality and document management
 */

import type { User, Document } from '../types/api.types';
import { apiClient } from '../utils/api-client';
import { getAuthToken, showError, loadUserInfo } from './auth';
import { formatDate, escapeHtml } from './common';
import { $$id, setHTML } from '../utils/dom-utils';

interface EmployeeInfo extends User {
  department?: string;
  team?: string;
  supervisor?: string;
  documents_count?: number;
  recent_documents?: Document[];
}

/**
 * Download a document
 */
function downloadDocument(docId?: string | number): void {
  if (docId === undefined) {
    console.error('No document ID provided');
    return;
  }

  const token = getAuthToken();
  if (token === null || token === '') return;

  // Create a download link with proper API version and authorization
  const useV2 = window.FEATURE_FLAGS?.USE_API_V2_DOCUMENTS;
  const apiPrefix = useV2 === true ? '/api/v2' : '/api';

  const link = document.createElement('a');
  link.href = `${apiPrefix}/documents/${docId}/download`;
  link.download = '';
  link.style.display = 'none';

  // Add authorization header via query parameter for download
  // Note: This is a workaround since we can't set headers on anchor tag downloads
  link.href += `?token=${encodeURIComponent(token)}`;

  document.body.append(link);
  link.click();
  link.remove();
}

/**
 * Search documents
 */
async function searchDocuments(query: string): Promise<void> {
  try {
    const documents = await apiClient.get<Document[]>(`/documents/search?query=${encodeURIComponent(query)}`);
    displayDocuments(documents);
  } catch (error) {
    console.error('Fehler bei der Dokumentensuche:', error);
    showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
  }
}

/**
 * Load employee information
 */
async function loadEmployeeInfo(): Promise<void> {
  try {
    // Use cached user data from auth.js to prevent duplicate API calls
    const employeeInfo = (await loadUserInfo()) as EmployeeInfo;
    displayEmployeeInfo(employeeInfo);
  } catch (error) {
    console.error('Fehler beim Laden der Mitarbeiterinformationen:', error);
    showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
  }
}

/**
 * Get full name for display
 */
function getDisplayName(info: EmployeeInfo): string {
  const fullName = `${info.first_name ?? ''} ${info.last_name ?? ''}`.trim();
  return fullName !== '' ? fullName : info.username;
}

/**
 * Update employee name elements
 */
function updateNameElements(info: EmployeeInfo): void {
  const employeeName = document.querySelector('#employee-name');
  if (employeeName) {
    employeeName.textContent = getDisplayName(info);
  }

  // #user-name is handled by unified-navigation - removed to prevent race condition
}

/**
 * Generate employee details HTML
 */
function generateEmployeeDetailsHTML(info: EmployeeInfo): string {
  const parts = [
    `<p><strong>Name:</strong> ${escapeHtml(info.first_name ?? '')} ${escapeHtml(info.last_name ?? '')}</p>`,
    `<p><strong>E-Mail:</strong> ${escapeHtml(info.email)}</p>`,
  ];

  if (info.department !== undefined && info.department !== '') {
    parts.push(`<p><strong>Abteilung:</strong> ${escapeHtml(info.department)}</p>`);
  }

  if (info.team !== undefined && info.team !== '') {
    parts.push(`<p><strong>Team:</strong> ${escapeHtml(info.team)}</p>`);
  }

  if (info.position !== undefined && info.position !== '') {
    parts.push(`<p><strong>Position:</strong> ${escapeHtml(info.position)}</p>`);
  }

  return parts.join('\n');
}

/**
 * Update employee details section
 */
function updateEmployeeDetails(info: EmployeeInfo): void {
  const employeeDetails = $$id('employee-details');
  if (employeeDetails) {
    setHTML(employeeDetails, generateEmployeeDetailsHTML(info));
  }
}

/**
 * Update document count
 */
function updateDocumentCount(count: number | undefined): void {
  if (count === undefined) return;

  const docCount = document.querySelector('#doc-count');
  if (docCount) {
    docCount.textContent = count.toString();
  }
}

/**
 * Display employee information
 */
function displayEmployeeInfo(info: EmployeeInfo): void {
  try {
    updateNameElements(info);
    updateEmployeeDetails(info);
    updateDocumentCount(info.documents_count);
  } catch (error) {
    console.error('Fehler beim Anzeigen der Mitarbeiterinformationen:', error);
  }
}

/**
 * Load employee documents
 */
async function loadDocuments(): Promise<void> {
  try {
    const documents = await apiClient.get<Document[]>('/documents');
    displayDocuments(documents);
  } catch (error) {
    console.error('Fehler beim Laden der Dokumente:', error);
  }
}

/**
 * Display documents in table
 */
function displayDocuments(documents: Document[]): void {
  const documentTableBody = $$id('recent-documents');
  if (documentTableBody === null) return;

  if (documents.length === 0) {
    documentTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center">Keine Dokumente gefunden.</td>
      </tr>
    `;
    return;
  }

  setHTML(
    documentTableBody,
    documents
      .map((doc) => {
        const uploadDate = formatDate(doc.created_at);
        const fileSize = formatFileSize(doc.file_size);

        return `
        <tr>
          <td>${escapeHtml(doc.file_name)}</td>
          <td>${escapeHtml(doc.category)}</td>
          <td>${uploadDate}</td>
          <td>${fileSize}</td>
          <td>
            <button class="btn btn-sm btn-primary" data-action="download-document" data-doc-id="${doc.id}">
              <i class="fas fa-download"></i> Download
            </button>
          </td>
        </tr>
      `;
      })
      .join(''),
  );
}

/**
 * Format file size
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const sizeIndex = Math.min(i, sizes.length - 1);

  // eslint-disable-next-line security/detect-object-injection -- sizeIndex ist begrenzt auf 0-3 durch Math.min(), kein User-Input, 100% sicher
  return `${Number.parseFloat((bytes / Math.pow(k, sizeIndex)).toFixed(2))} ${sizes[sizeIndex]}`;
}

document.addEventListener('DOMContentLoaded', () => {
  // Debug logging
  console.info('[Employee Dashboard] Starting initialization...');

  // Check if admin is viewing as employee
  const userRole = localStorage.getItem('userRole');
  const activeRole = localStorage.getItem('activeRole');
  const token = localStorage.getItem('token');

  console.info('[Employee Dashboard] Role Check:', {
    userRole,
    activeRole,
    token: token !== null && token !== '' ? 'exists' : 'missing',
    pathname: window.location.pathname,
  });

  const isAdminAsEmployee = userRole === 'admin' && activeRole === 'employee';

  console.info('[Employee Dashboard] Is Admin as Employee:', isAdminAsEmployee);

  // Show role indicator for admins
  if (isAdminAsEmployee) {
    const roleIndicator = $$id('role-indicator');
    const switchBtn = $$id('role-switch-btn');

    if (roleIndicator) {
      roleIndicator.style.display = 'inline-flex';
    }
    if (switchBtn !== null) {
      switchBtn.style.display = 'flex';
    }
  }

  // DOM elements
  const searchForm = $$id('search-form') as HTMLFormElement | null;
  const searchInput = $$id('search-input') as HTMLInputElement | null;

  // Search functionality - only add if search form exists
  if (searchForm !== null && searchInput !== null) {
    searchForm.addEventListener('submit', (e) => {
      void (async () => {
        e.preventDefault();
        const query = searchInput.value.trim();

        if (query !== '') {
          await searchDocuments(query);
        }
      })();
    });
  }

  // Load initial data
  void loadEmployeeInfo();
  void loadDocuments();

  // Event delegation for document download buttons
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-action="download-document"]');

    if (button instanceof HTMLButtonElement) {
      const docId = button.dataset.docId;
      if (docId !== undefined) {
        downloadDocument(docId);
      }
    }
  });
});

// Extend window for employee dashboard functions
declare global {
  interface Window {
    downloadDocument: (docId?: string | number) => void;
  }
}

// Export functions to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.downloadDocument = downloadDocument;
}
