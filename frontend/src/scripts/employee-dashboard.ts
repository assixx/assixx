/**
 * Employee Dashboard Script
 * Handles employee-specific functionality and document management
 */

import type { User, Document } from '../types/api.types';
import { getAuthToken, removeAuthToken } from './auth';
import { formatDate, escapeHtml } from './common';
import { showError, showInfo } from './auth';

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
function downloadDocument(docId: string | number): void {
  const token = getAuthToken();
  if (!token) return;

  // Create a download link and trigger it
  const link = document.createElement('a');
  link.href = `/api/documents/${docId}/download`;
  link.download = '';
  link.style.display = 'none';

  // Add authorization header
  link.setAttribute('download', '');

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const documentTableBody = document.getElementById('recent-documents') as HTMLTableSectionElement;
  const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;
  const searchForm = document.getElementById('search-form') as HTMLFormElement;
  const searchInput = document.getElementById('search-input') as HTMLInputElement;

  // Search functionality - only add if search form exists
  if (searchForm && searchInput) {
    searchForm.addEventListener('submit', async (e: Event) => {
      e.preventDefault();
      const query = searchInput.value.trim();

      if (query) {
        await searchDocuments(query);
      }
    });
  }

  // Logout button
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Möchten Sie sich wirklich abmelden?')) {
        removeAuthToken();
        localStorage.removeItem('role');
        window.location.href = '/pages/login.html';
      }
    });
  } else {
    console.error('Logout-Button nicht gefunden');
  }

  // Load initial data
  loadEmployeeInfo();
  loadDocuments();

  /**
   * Search documents
   */
  async function searchDocuments(query: string): Promise<void> {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`/api/documents/search?query=${encodeURIComponent(query)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const documents: Document[] = await response.json();
        displayDocuments(documents);
      } else {
        const error = await response.json();
        showError(error.message || 'Fehler bei der Dokumentensuche');
      }
    } catch (error) {
      console.error('Fehler bei der Dokumentensuche:', error);
      showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    }
  }

  /**
   * Load employee information
   */
  async function loadEmployeeInfo(): Promise<void> {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch('/api/user/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const employeeInfo: EmployeeInfo = await response.json();
        displayEmployeeInfo(employeeInfo);
      } else {
        const error = await response.json();
        showError(error.message || 'Fehler beim Laden der Mitarbeiterinformationen');
      }
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
      const employeeName = document.getElementById('employee-name');
      if (employeeName) {
        const fullName = `${info.first_name || ''} ${info.last_name || ''}`.trim();
        employeeName.textContent = fullName || info.username;
      }

      // Update username in welcome message
      const userName = document.getElementById('user-name');
      if (userName) {
        userName.textContent = info.first_name || info.username;
      }

      // Update employee details if container exists
      const employeeDetails = document.getElementById('employee-details');
      if (employeeDetails) {
        employeeDetails.innerHTML = `
          <p><strong>Name:</strong> ${escapeHtml(info.first_name || '')} ${escapeHtml(info.last_name || '')}</p>
          <p><strong>E-Mail:</strong> ${escapeHtml(info.email)}</p>
          ${info.department ? `<p><strong>Abteilung:</strong> ${escapeHtml(info.department)}</p>` : ''}
          ${info.team ? `<p><strong>Team:</strong> ${escapeHtml(info.team)}</p>` : ''}
          ${info.position ? `<p><strong>Position:</strong> ${escapeHtml(info.position)}</p>` : ''}
        `;
      }

      // Update document count if exists
      const docCount = document.getElementById('doc-count');
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
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch('/api/documents/my-documents', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const documents: Document[] = await response.json();
        displayDocuments(documents);
      } else {
        console.error('Fehler beim Laden der Dokumente');
      }
    } catch (error) {
      console.error('Fehler beim Laden der Dokumente:', error);
    }
  }

  /**
   * Display documents in table
   */
  function displayDocuments(documents: Document[]): void {
    if (!documentTableBody) return;

    if (documents.length === 0) {
      documentTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center">Keine Dokumente gefunden.</td>
        </tr>
      `;
      return;
    }

    documentTableBody.innerHTML = documents
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
      .join('');
  }

  /**
   * Format file size
   */
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
});

// Export functions to window for backwards compatibility
if (typeof window !== 'undefined') {
  (window as any).downloadDocument = downloadDocument;
}
