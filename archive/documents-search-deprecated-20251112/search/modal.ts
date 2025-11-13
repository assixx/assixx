/**
 * Document Preview Modal Logic
 * Handles opening, closing, and preview functionality
 */

import { showErrorAlert } from '../../utils/alerts';
import type { Document } from '../shared/types';
import { formatDate, formatFileSize } from '../shared/ui-helpers';

// DOM Elements
let modal: HTMLElement | null = null;
let modalOverlay: HTMLElement | null = null;
let modalTitle: HTMLElement | null = null;
let modalFileName: HTMLElement | null = null;
let modalFileSize: HTMLElement | null = null;
let modalUploadedBy: HTMLElement | null = null;
let modalUploadDate: HTMLElement | null = null;
let downloadButton: HTMLButtonElement | null = null;

// Current document
let currentDocument: Document | null = null;

/**
 * Initialize modal DOM references
 */
export function initializeModal(): void {
  modal = document.querySelector<HTMLElement>('#documentPreviewModal .ds-modal');
  modalOverlay = document.querySelector<HTMLElement>('#documentPreviewModal');
  modalTitle = document.querySelector<HTMLElement>('#modalDocumentTitle');
  modalFileName = document.querySelector<HTMLElement>('#modalFileName');
  modalFileSize = document.querySelector<HTMLElement>('#modalFileSize');
  modalUploadedBy = document.querySelector<HTMLElement>('#modalUploadedBy');
  modalUploadDate = document.querySelector<HTMLElement>('#modalUploadDate');
  downloadButton = document.querySelector<HTMLButtonElement>('#downloadButton');

  // Setup event listeners
  setupModalEventListeners();
}

/**
 * Setup modal event listeners
 */
function setupModalEventListeners(): void {
  // Close buttons
  const closeButtons = document.querySelectorAll<HTMLElement>('[data-action="close-document-modal"]');
  closeButtons.forEach((btn) => {
    btn.addEventListener('click', closeModal);
  });

  // Download button
  downloadButton?.addEventListener('click', () => {
    void handleDownload();
  });

  // Close on overlay click
  modalOverlay?.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay?.classList.contains('modal-overlay--active') === true) {
      closeModal();
    }
  });
}

/**
 * Open modal with document
 * @param doc - Document to preview
 */
export function openModal(doc: Document): void {
  if (modalOverlay === null || modal === null) {
    console.error('[Modal] Modal elements not found');
    return;
  }

  currentDocument = doc;

  // Update modal content
  updateModalContent(doc);

  // Show modal
  modalOverlay.classList.add('modal-overlay--active');
  document.body.classList.add('overflow-hidden'); // Prevent body scroll

  // Note: markAsRead API not implemented in backend yet
  console.info('[Modal] Document opened:', doc.id);
}

/**
 * Close modal
 */
export function closeModal(): void {
  if (modalOverlay === null) return;

  modalOverlay.classList.remove('modal-overlay--active');
  document.body.classList.remove('overflow-hidden'); // Restore body scroll

  currentDocument = null;
}

/**
 * Update modal content with document data
 * @param doc - Document data
 */
function updateModalContent(doc: Document): void {
  // Title
  if (modalTitle !== null) {
    modalTitle.textContent = doc.file_name;
  }

  // File name
  if (modalFileName !== null) {
    modalFileName.textContent = doc.file_name;
  }

  // File size
  if (modalFileSize !== null) {
    modalFileSize.textContent = formatFileSize(doc.file_size);
  }

  // Uploaded by
  if (modalUploadedBy !== null) {
    modalUploadedBy.textContent = doc.uploaded_by_name ?? 'System';
  }

  // Upload date
  if (modalUploadDate !== null) {
    modalUploadDate.textContent = formatDate(doc.created_at);
  }
}

/**
 * Handle document download with authentication
 */
async function handleDownload(): Promise<void> {
  if (currentDocument === null) return;

  try {
    console.info('[Modal] Starting download:', currentDocument.file_name);

    // Get auth token from localStorage
    const token = localStorage.getItem('accessToken');
    // Safe: Only checking for token existence (not comparing secret values)
    // eslint-disable-next-line security/detect-possible-timing-attacks
    if (token === null) {
      showErrorAlert('Authentifizierung erforderlich');
      return;
    }

    const downloadUrl = `/api/v2/documents/${currentDocument.id}/download`;

    // Fetch with auth token
    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    // Get blob from response
    const blob = await response.blob();
    console.info('[Modal] Blob size:', blob.size, 'bytes, type:', blob.type);

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = currentDocument.file_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup
    window.URL.revokeObjectURL(url);

    console.info('[Modal] Download completed:', currentDocument.file_name);
  } catch (error) {
    console.error('[Modal] Download error:', error);
    showErrorAlert('Fehler beim Herunterladen des Dokuments');
  }
}
