/**
 * Documents page functionality
 * Central document management with smart filters
 */

import { fetchWithAuth, showError, showSuccess } from './auth';
import type { Document } from '../types/api.types';

// Document scope type
type DocumentScope = 'all' | 'company' | 'department' | 'team' | 'personal' | 'payroll';
type SortOption = 'newest' | 'oldest' | 'name' | 'size';

// State management
let allDocuments: Document[] = [];
let filteredDocuments: Document[] = [];
let currentFilter: DocumentScope = 'all';
let currentSort: SortOption = 'newest';
let currentSearch = '';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initializeDocuments();
  setupEventListeners();
});

/**
 * Initialize documents page
 */
async function initializeDocuments(): Promise<void> {
  try {
    await loadDocuments();
    updateStats();
    renderDocuments();
  } catch (error) {
    console.error('Error initializing documents:', error);
    showError('Fehler beim Laden der Dokumente');
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners(): void {
  // Filter pills
  const filterPills = document.querySelectorAll('.filter-pill');
  filterPills.forEach((pill) => {
    pill.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const filter = target.dataset.filter as DocumentScope;
      if (filter) {
        setActiveFilter(filter);
      }
    });
  });

  // Search input
  const searchInput = document.getElementById('searchInput') as HTMLInputElement;
  if (searchInput) {
    searchInput.addEventListener(
      'input',
      debounce((e) => {
        if (e instanceof Event) {
          const target = e.target as HTMLInputElement;
          currentSearch = target.value.toLowerCase();
          applyFilters();
        }
      }, 300),
    );
  }

  // Click outside to close dropdowns
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.custom-dropdown')) {
      closeAllDropdowns();
    }
  });
}

/**
 * Load documents from API
 */
async function loadDocuments(): Promise<void> {
  try {
    const response = await fetchWithAuth('/api/documents/v2');

    if (!response.ok) {
      throw new Error('Failed to load documents');
    }

    const data = await response.json();
    allDocuments = data.documents ?? [];

    // Update document counts
    updateCounts();
  } catch (error) {
    console.error('Error loading documents:', error);
    throw error;
  }
}

/**
 * Update filter counts
 */
function updateCounts(): void {
  const counts = {
    all: allDocuments.length,
    company: 0,
    department: 0,
    team: 0,
    personal: 0,
    payroll: 0,
  };

  allDocuments.forEach((doc) => {
    if (doc.scope === 'company') counts.company++;
    else if (doc.scope === 'department') counts.department++;
    else if (doc.scope === 'team') counts.team++;
    else if (doc.scope === 'personal') counts.personal++;

    // Count payroll documents (Gehaltsabrechnungen) based on category
    if (doc.category === 'salary') counts.payroll++;
  });

  // Update UI
  updateCount('countAll', counts.all);
  updateCount('countCompany', counts.company);
  updateCount('countDepartment', counts.department);
  updateCount('countTeam', counts.team);
  updateCount('countPersonal', counts.personal);
  updateCount('countPayroll', counts.payroll);
}

/**
 * Update count element
 */
function updateCount(elementId: string, count: number): void {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = count.toString();
  }
}

/**
 * Update statistics
 */
function updateStats(): void {
  const totalDocs = allDocuments.length;
  const unreadDocs = allDocuments.filter((doc) => !doc.is_read).length;

  // Calculate documents from this week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const recentDocs = allDocuments.filter((doc) => new Date(doc.created_at) >= oneWeekAgo).length;

  // Update UI
  updateCount('totalDocs', totalDocs);
  updateCount('unreadDocs', unreadDocs);
  updateCount('recentDocs', recentDocs);
}

/**
 * Set active filter
 */
function setActiveFilter(filter: DocumentScope): void {
  currentFilter = filter;

  // Update UI
  document.querySelectorAll('.filter-pill').forEach((pill) => {
    pill.classList.remove('active');
  });

  const activePill = document.querySelector(`[data-filter="${filter}"]`);
  if (activePill) {
    activePill.classList.add('active');
  }

  applyFilters();
}

/**
 * Apply filters and search
 */
function applyFilters(): void {
  filteredDocuments = allDocuments;

  // Apply scope filter
  if (currentFilter !== 'all') {
    if (currentFilter === 'payroll') {
      // Special filter for payroll documents (Gehaltsabrechnungen)
      filteredDocuments = filteredDocuments.filter((doc) => doc.category === 'salary');
    } else {
      filteredDocuments = filteredDocuments.filter((doc) => doc.scope === currentFilter);
    }
  }

  // Apply search filter
  if (currentSearch) {
    filteredDocuments = filteredDocuments.filter(
      (doc) =>
        doc.file_name.toLowerCase().includes(currentSearch) ||
        doc.description?.toLowerCase().includes(currentSearch) ||
        doc.uploaded_by_name?.toLowerCase().includes(currentSearch),
    );
  }

  // Apply sort
  sortDocuments();

  // Render
  renderDocuments();
}

/**
 * Sort documents
 */
function sortDocuments(): void {
  switch (currentSort) {
    case 'newest':
      filteredDocuments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      break;
    case 'oldest':
      filteredDocuments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      break;
    case 'name':
      filteredDocuments.sort((a, b) => a.file_name.localeCompare(b.file_name));
      break;
    case 'size':
      filteredDocuments.sort((a, b) => (b.file_size || 0) - (a.file_size || 0));
      break;
  }
}

/**
 * Render documents grid
 */
function renderDocuments(): void {
  const container = document.getElementById('documentsContainer');
  if (!container) return;

  if (filteredDocuments.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-folder-open"></i>
        <h3>Keine Dokumente gefunden</h3>
        <p>Es gibt keine Dokumente, die Ihren Filterkriterien entsprechen.</p>
      </div>
    `;
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'documents-grid';

  filteredDocuments.forEach((doc) => {
    grid.appendChild(createDocumentCard(doc));
  });

  container.innerHTML = '';
  container.appendChild(grid);
}

/**
 * Create document card element
 */
function createDocumentCard(doc: Document): HTMLElement {
  const card = document.createElement('div');
  card.className = 'document-card';
  card.onclick = () => viewDocument(doc.id);

  const icon = getFileIcon(doc.mime_type ?? doc.file_name);
  const readBadge = !doc.is_read ? '<span class="document-badge unread">NEU</span>' : '';

  card.innerHTML = `
    ${readBadge}
    <div class="document-icon">
      <i class="${icon}"></i>
    </div>
    <h3 class="document-title" title="${escapeHtml(doc.file_name)}">
      ${escapeHtml(doc.file_name)}
    </h3>
    <div class="document-meta">
      <div class="document-meta-item">
        <i class="fas fa-calendar"></i>
        <span>${formatDate(doc.created_at)}</span>
      </div>
      <div class="document-meta-item">
        <i class="fas fa-user"></i>
        <span>${escapeHtml(doc.uploaded_by_name || 'System')}</span>
      </div>
      ${
        doc.file_size
          ? `
        <div class="document-meta-item">
          <i class="fas fa-weight"></i>
          <span>${formatFileSize(doc.file_size)}</span>
        </div>
      `
          : ''
      }
      <div class="document-meta-item">
        <i class="fas fa-layer-group"></i>
        <span>${getScopeLabel(doc.scope)}</span>
      </div>
    </div>
  `;

  return card;
}

/**
 * Get file icon based on mime type or filename
 */
function getFileIcon(mimeOrName: string): string {
  const mime = mimeOrName.toLowerCase();

  if (mime.includes('pdf')) return 'fas fa-file-pdf';
  if (mime.includes('word') || mime.endsWith('.doc') || mime.endsWith('.docx')) return 'fas fa-file-word';
  if (mime.includes('excel') || mime.endsWith('.xls') || mime.endsWith('.xlsx')) return 'fas fa-file-excel';
  if (mime.includes('powerpoint') || mime.endsWith('.ppt') || mime.endsWith('.pptx')) return 'fas fa-file-powerpoint';
  if (mime.includes('image') || /\.(jpg|jpeg|png|gif|svg)$/.test(mime)) return 'fas fa-file-image';
  if (mime.includes('video')) return 'fas fa-file-video';
  if (mime.includes('audio')) return 'fas fa-file-audio';
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z')) return 'fas fa-file-archive';
  if (mime.includes('text') || mime.endsWith('.txt')) return 'fas fa-file-alt';

  return 'fas fa-file';
}

/**
 * Get scope label
 */
function getScopeLabel(scope: string): string {
  switch (scope) {
    case 'company':
      return 'Firma';
    case 'department':
      return 'Abteilung';
    case 'team':
      return 'Team';
    case 'personal':
      return 'Persönlich';
    default:
      return 'Allgemein';
  }
}

// Store current document data
let currentDocument: Document | null = null;

/**
 * View document in modal
 */
async function viewDocument(documentId: number): Promise<void> {
  try {
    // Find the document in our data
    const doc = allDocuments.find((d) => d.id === documentId);
    if (!doc) {
      showError('Dokument nicht gefunden');
      return;
    }

    currentDocument = doc;

    // Mark as read
    fetchWithAuth(`/api/documents/${documentId}/read`, { method: 'POST' })
      .then(() => {
        // Update local state
        doc.is_read = true;
        updateStats();
        renderDocuments();
      })
      .catch(console.error);

    // Show modal with document info
    showDocumentModal(doc);
  } catch (error) {
    console.error('Error viewing document:', error);
    showError('Fehler beim Öffnen des Dokuments');
  }
}

/**
 * Show document preview modal
 */
function showDocumentModal(doc: Document): void {
  // Update modal content
  const modal = document.getElementById('documentPreviewModal');
  if (!modal) return;

  // Update info
  updateElement('modalDocumentTitle', doc.file_name || 'Dokument');
  updateElement('modalFileName', doc.file_name);
  updateElement('modalFileSize', formatFileSize(doc.file_size || 0));
  updateElement('modalUploadedBy', doc.uploaded_by_name || 'System');
  updateElement('modalUploadDate', formatDate(doc.created_at));

  // Setup preview
  const previewFrame = document.getElementById('documentPreviewFrame') as HTMLIFrameElement;
  const previewError = document.getElementById('previewError');

  if (previewFrame && previewError) {
    // Create preview URL with authentication token
    const token = localStorage.getItem('token');
    if (!token) {
      previewFrame.style.display = 'none';
      previewError.style.display = 'block';
      return;
    }

    // Try to show PDF preview with authentication
    const previewUrl = `/api/documents/preview/${doc.id}`;

    // For iframe, we need to handle authentication differently
    // First, try to fetch the document
    fetchWithAuth(previewUrl)
      .then((response) => {
        if (!response.ok) throw new Error('Preview failed');
        return response.blob();
      })
      .then((blob) => {
        // Create object URL from blob
        const blobUrl = URL.createObjectURL(blob);
        previewFrame.src = blobUrl;
        previewFrame.style.display = 'block';
        previewError.style.display = 'none';

        // Clean up blob URL when modal closes
        previewFrame.dataset.blobUrl = blobUrl;
      })
      .catch((error) => {
        console.error('Preview error:', error);
        previewFrame.style.display = 'none';
        previewError.style.display = 'block';
      });
  }

  // Store document ID for download
  const downloadBtn = document.getElementById('downloadButton');
  if (downloadBtn) {
    downloadBtn.setAttribute('data-document-id', doc.id.toString());
  }

  // Show modal
  modal.style.display = 'flex';
}

/**
 * Close document modal
 */
function closeDocumentModal(): void {
  const modal = document.getElementById('documentPreviewModal');
  if (modal) {
    modal.style.display = 'none';

    // Clear iframe and clean up blob URL
    const previewFrame = document.getElementById('documentPreviewFrame') as HTMLIFrameElement;
    if (previewFrame) {
      // Clean up blob URL if exists
      const blobUrl = previewFrame.dataset.blobUrl;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        delete previewFrame.dataset.blobUrl;
      }
      previewFrame.src = '';
    }
  }

  currentDocument = null;
}

/**
 * Download current document
 */
async function downloadDocument(docId?: string | number): Promise<void> {
  let documentId: string;

  if (docId) {
    // Called with parameter from employee-dashboard
    documentId = String(docId);
  } else {
    // Called without parameter from documents page
    const downloadBtn = document.getElementById('downloadButton');
    if (!downloadBtn) {
      console.error('Download button not found');
      return;
    }

    const dataId = downloadBtn.getAttribute('data-document-id');
    if (!dataId) {
      console.error('No document ID found');
      return;
    }
    documentId = dataId;
  }

  try {
    console.log('Downloading document:', documentId);

    // Check if we have a token
    const token = localStorage.getItem('token');
    if (!token) {
      showError('Nicht angemeldet. Bitte melden Sie sich erneut an.');
      window.location.href = '/login';
      return;
    }

    // Fetch with authentication
    const response = await fetchWithAuth(`/api/documents/download/${documentId}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Download response error:', response.status, errorText);
      throw new Error(`Download failed: ${response.status}`);
    }

    // Get the blob
    const blob = await response.blob();

    // Check if blob is valid
    if (blob.size === 0) {
      throw new Error('Downloaded file is empty');
    }

    // Create object URL
    const url = window.URL.createObjectURL(blob);

    // Create download link
    const link = document.createElement('a');
    link.href = url;
    link.download = currentDocument?.file_name ?? 'document.pdf';
    link.style.display = 'none';
    document.body.appendChild(link);

    // Trigger download
    link.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 100);

    showSuccess('Dokument wird heruntergeladen');
  } catch (error) {
    console.error('Error downloading document:', error);
    if (error instanceof TypeError && error.message.includes('NetworkError')) {
      showError('Netzwerkfehler beim Herunterladen. Bitte überprüfen Sie Ihre Verbindung.');
    } else {
      showError('Fehler beim Herunterladen des Dokuments');
    }
  }
}

/**
 * Update element text content
 */
function updateElement(id: string, value: string | number): void {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value.toString();
  }
}

/**
 * Toggle dropdown
 */
window.toggleDropdown = function (type: string): void {
  const display = document.getElementById(`${type}Display`);
  const dropdown = document.getElementById(`${type}Dropdown`);

  if (!display || !dropdown) return;

  // Close all other dropdowns
  closeAllDropdowns();

  display.classList.toggle('active');
  dropdown.classList.toggle('active');
};

/**
 * Select sort option
 */
window.selectSort = function (value: SortOption, text: string): void {
  currentSort = value;

  const display = document.getElementById('sortDisplay');
  const dropdown = document.getElementById('sortDropdown');
  const input = document.getElementById('sortValue') as HTMLInputElement;

  if (display && dropdown && input) {
    const span = display.querySelector('span');
    if (span) {
      span.textContent = text;
    }
    input.value = value;
    display.classList.remove('active');
    dropdown.classList.remove('active');
  }

  applyFilters();
};

/**
 * Close all dropdowns
 */
function closeAllDropdowns(): void {
  document.querySelectorAll('.dropdown-display').forEach((d) => d.classList.remove('active'));
  document.querySelectorAll('.dropdown-options').forEach((d) => d.classList.remove('active'));
}

/**
 * Format date
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Debounce function
 */
function debounce<T extends (...args: unknown[]) => unknown>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Extend window for global functions
declare global {
  interface Window {
    toggleDropdown: (type: string) => void;
    selectSort: (value: SortOption, text: string) => void;
    closeDocumentModal: () => void;
    downloadDocument: (docId?: string | number) => void;
  }
}

// Make functions available globally
window.closeDocumentModal = closeDocumentModal;
window.downloadDocument = downloadDocument;

export { loadDocuments, setActiveFilter, viewDocument };
