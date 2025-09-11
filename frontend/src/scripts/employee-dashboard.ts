/**
 * Employee Dashboard Script
 * Handles employee-specific functionality and document management
 */

import type { User, Document } from '../types/api.types';
import { apiClient } from '../utils/api-client';
import { getAuthToken, showError } from './auth';
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
  const documentTableBody = $$id('recent-documents');
  const logoutBtn = $$id('logout-btn') as HTMLButtonElement | null;
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

  // Logout button
  if (logoutBtn !== null) {
    logoutBtn.addEventListener('click', (e) => {
      void (async () => {
        e.preventDefault();
        // Direct logout without confirmation
        try {
          // Import and use the logout function from auth module
          const { logout } = await import('./auth.js');
          await logout();
        } catch (error) {
          console.error('Logout error:', error);
          // Fallback
          window.location.href = '/login';
        }
      })();
    });
  } else {
    console.error('Logout-Button nicht gefunden');
  }

  // Load initial data
  void loadEmployeeInfo();
  void loadDocuments();

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
      const employeeInfo = await apiClient.get<EmployeeInfo>('/users/me');
      displayEmployeeInfo(employeeInfo);
    } catch (error) {
      console.error('Fehler beim Laden der Mitarbeiterinformationen:', error);
      showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    }
  }

  /**
   * Display employee information
   */
  function displayEmployeeInfo(info: EmployeeInfo): void {
    try {
      // Update username in header
      const employeeName = document.querySelector('#employee-name');
      if (employeeName) {
        const fullName = `${info.first_name ?? ''} ${info.last_name ?? ''}`.trim();
        employeeName.textContent = fullName !== '' ? fullName : info.username;
      }

      // Update username in welcome message
      const userName = document.querySelector('#user-name');
      if (userName) {
        userName.textContent = info.first_name ?? info.username;
      }

      // Update employee details if container exists
      const employeeDetails = $$id('employee-details');
      if (employeeDetails) {
        setHTML(
          employeeDetails,
          `
          <p><strong>Name:</strong> ${escapeHtml(info.first_name ?? '')} ${escapeHtml(info.last_name ?? '')}</p>
          <p><strong>E-Mail:</strong> ${escapeHtml(info.email)}</p>
          ${info.department !== undefined && info.department !== '' ? `<p><strong>Abteilung:</strong> ${escapeHtml(info.department)}</p>` : ''}
          ${info.team !== undefined && info.team !== '' ? `<p><strong>Team:</strong> ${escapeHtml(info.team)}</p>` : ''}
          ${info.position !== undefined && info.position !== '' ? `<p><strong>Position:</strong> ${escapeHtml(info.position)}</p>` : ''}
        `,
        );
      }

      // Update document count if exists
      const docCount = document.querySelector('#doc-count');
      if (docCount && info.documents_count !== undefined) {
        docCount.textContent = info.documents_count.toString();
      }
    } catch (error) {
      console.error('Fehler beim Anzeigen der Mitarbeiterinformationen:', error);
    }
  }

  /**
   * Load employee documents
   */
  async function loadDocuments(): Promise<void> {
    try {
      const documents = await apiClient.get<Document[]>('/documents/my-documents');
      displayDocuments(documents);
    } catch (error) {
      console.error('Fehler beim Laden der Dokumente:', error);
    }
  }

  /**
   * Display documents in table
   */
  function displayDocuments(documents: Document[]): void {
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
              <button class="btn btn-sm btn-primary" onclick="downloadDocument('${doc.id}')">
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

    return `${Number.parseFloat((bytes / Math.pow(k, sizeIndex)).toFixed(2))} ${sizes[sizeIndex]}`;
  }
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
