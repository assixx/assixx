/**
 * Blackboard Modal Management
 * Handles all modal operations (create/edit/view/delete entry modals)
 * Following MANAGE pattern (like manage/areas/forms.ts)
 */

import { $$id, setSafeHTML, escapeHtml } from '../../utils/dom-utils';
import type { BlackboardEntry } from './types';

// ============================================================================
// Constants
// ============================================================================

const MODAL_ACTIVE_CLASS = 'modal-overlay--active';

// ============================================================================
// Entry Modal Functions
// ============================================================================

/**
 * Show Add Entry Modal
 */
export function showAddEntryModal(): void {
  const modal = $$id('entryFormModal'); // Fixed ID to match HTML
  const form = $$id('entryForm') as HTMLFormElement | null;

  if (form !== null) {
    form.reset();
  }

  // Remove hidden attribute and add active class
  modal?.removeAttribute('hidden');
  modal?.classList.add(MODAL_ACTIVE_CLASS);

  console.info('[Modals] Add entry modal opened');
}

/**
 * Show Edit Entry Modal
 */
export function showEditEntryModal(entry: BlackboardEntry): void {
  const modal = $$id('entryFormModal'); // Fixed ID to match HTML

  if (modal === null) return;

  // Remove hidden attribute and add active class
  modal.removeAttribute('hidden');
  modal.classList.add(MODAL_ACTIVE_CLASS);

  // Populate form (handled by forms.ts)
  console.info('[Modals] Edit entry modal opened for ID:', entry.id);
}

/**
 * Close Entry Modal
 */
export function closeEntryModal(): void {
  const modal = $$id('entryFormModal'); // Fixed ID to match HTML
  const form = $$id('entryForm') as HTMLFormElement | null;

  if (modal !== null) {
    modal.classList.remove(MODAL_ACTIVE_CLASS);
    // Add hidden attribute after animation
    setTimeout(() => {
      modal.setAttribute('hidden', '');
    }, 300);
  }

  if (form !== null) {
    form.reset();
  }

  console.info('[Modals] Entry modal closed');
}

// ============================================================================
// View Entry Modal Functions
// ============================================================================

/**
 * Show View Entry Modal (detailed view)
 */
export function showViewEntryModal(entry: BlackboardEntry): void {
  const modal = $$id('entryDetailModal'); // Fixed ID to match HTML

  if (modal === null) {
    console.warn('[Modals] View entry modal not found');
    return;
  }

  // Remove hidden attribute and add active class
  modal.removeAttribute('hidden');
  modal.classList.add(MODAL_ACTIVE_CLASS);

  console.info('[Modals] View entry modal opened for ID:', entry.id);
}

/**
 * Close View Entry Modal
 */
export function closeViewEntryModal(): void {
  const modal = $$id('entryDetailModal'); // Fixed ID to match HTML

  if (modal !== null) {
    modal.classList.remove(MODAL_ACTIVE_CLASS);
    // Add hidden attribute after animation
    setTimeout(() => {
      modal.setAttribute('hidden', '');
    }, 300);
  }

  console.info('[Modals] View entry modal closed');
}

// ============================================================================
// Delete Confirmation Modal Functions
// ============================================================================

/**
 * Show Delete Confirmation Modal
 */
export function showDeleteModal(id: number, title: string): void {
  const modal = $$id('deleteEntryModal'); // Fixed ID to match HTML
  const deleteIdInput = $$id('deleteEntryId') as HTMLInputElement | null; // Fixed ID to match HTML
  const messageEl = $$id('deleteEntryMessage'); // Fixed ID to match HTML

  if (modal === null) {
    console.warn('[Modals] Delete confirmation modal not found');
    return;
  }

  if (deleteIdInput !== null) {
    deleteIdInput.value = id.toString();
  }

  if (messageEl !== null) {
    messageEl.textContent = `Möchten Sie den Eintrag "${title}" wirklich löschen?`;
  }

  // Remove hidden attribute and add active class
  modal.removeAttribute('hidden');
  modal.classList.add(MODAL_ACTIVE_CLASS);

  console.info('[Modals] Delete confirmation modal opened for ID:', id);
}

/**
 * Close Delete Modal
 */
export function closeDeleteModal(): void {
  const modal = $$id('deleteEntryModal'); // Fixed ID to match HTML
  const deleteIdInput = $$id('deleteEntryId') as HTMLInputElement | null; // Fixed ID to match HTML

  if (modal !== null) {
    modal.classList.remove(MODAL_ACTIVE_CLASS);
    // Add hidden attribute after animation
    setTimeout(() => {
      modal.setAttribute('hidden', '');
    }, 300);
  }

  if (deleteIdInput !== null) {
    deleteIdInput.value = '';
  }

  console.info('[Modals] Delete confirmation modal closed');
}

// ============================================================================
// Generic Modal Utilities
// ============================================================================

/**
 * Close all modals
 */
export function closeAllModals(): void {
  const modals = document.querySelectorAll('.modal-overlay');

  modals.forEach((modal) => {
    modal.classList.remove(MODAL_ACTIVE_CLASS);
  });

  console.info('[Modals] All modals closed');
}

/**
 * Setup modal event listeners (close buttons, backdrop clicks)
 */
export function setupModalEventListeners(): void {
  // Close button event delegation
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle modal close buttons
    const closeBtn = target.closest('[data-action="close-modal"]');
    if (closeBtn) {
      const modalId = (closeBtn as HTMLElement).dataset['modalId'];
      if (modalId !== undefined && modalId !== '') {
        const modal = $$id(modalId);
        modal?.classList.remove(MODAL_ACTIVE_CLASS);
      }
      return;
    }

    // Handle backdrop clicks (close on click outside)
    if (target.classList.contains('modal-overlay')) {
      target.classList.remove(MODAL_ACTIVE_CLASS);
    }
  });

  // ESC key to close modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });

  console.info('[Modals] Event listeners initialized');
}

// ============================================================================
// Attachment Preview Modal Functions (NEW 2025-11-24)
// ============================================================================

/**
 * Create preview modal element if it doesn't exist
 */
function getOrCreatePreviewModal(): HTMLElement {
  let modal = $$id('attachmentPreviewModal');

  if (modal === null) {
    modal = document.createElement('div');
    modal.id = 'attachmentPreviewModal';
    modal.className = 'modal-overlay';
    modal.setAttribute('hidden', '');
    modal.innerHTML = `
      <div class="modal modal--lg">
        <div class="modal__header">
          <h2 class="modal__title" id="attachmentPreviewTitle">Vorschau</h2>
          <button class="btn btn-icon" data-action="close-preview-modal" aria-label="Schließen">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal__body p-0" id="attachmentPreviewBody"></div>
      </div>
    `;
    document.body.append(modal);
  }

  return modal;
}

/**
 * Render preview content based on mime type
 */
function renderPreviewContent(bodyEl: HTMLElement, previewUrl: string, mimeType: string, filename: string): void {
  const safeUrl = escapeHtml(previewUrl);
  const safeName = escapeHtml(filename);

  if (mimeType.startsWith('image/')) {
    setSafeHTML(
      bodyEl,
      `<div class="flex items-center justify-center p-4 bg-black/5 min-h-[400px]">
        <img src="${safeUrl}" alt="${safeName}" class="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg" loading="lazy" />
      </div>`,
    );
  } else if (mimeType === 'application/pdf') {
    setSafeHTML(bodyEl, `<iframe src="${safeUrl}" class="w-full h-[70vh] border-0" title="${safeName}"></iframe>`);
  } else {
    setSafeHTML(
      bodyEl,
      `<div class="p-8 text-center">
        <i class="fas fa-file-download text-6xl text-content-secondary mb-4"></i>
        <p class="mb-4">Diese Datei kann nicht als Vorschau angezeigt werden.</p>
        <a href="${safeUrl}" class="btn btn-primary" download="${safeName}">
          <i class="fas fa-download mr-2"></i> Herunterladen
        </a>
      </div>`,
    );
  }
}

/**
 * Show Attachment Preview Modal
 * Displays images inline and PDFs in iframe
 */
export function showAttachmentPreviewModal(previewUrl: string, mimeType: string, filename: string): void {
  const modal = getOrCreatePreviewModal();
  const titleEl = $$id('attachmentPreviewTitle');
  const bodyEl = $$id('attachmentPreviewBody');

  if (titleEl !== null) {
    titleEl.textContent = filename;
  }

  if (bodyEl !== null) {
    renderPreviewContent(bodyEl, previewUrl, mimeType, filename);
  }

  modal.removeAttribute('hidden');
  modal.classList.add(MODAL_ACTIVE_CLASS);
  console.info('[Modals] Attachment preview modal opened:', filename);
}

/**
 * Close Attachment Preview Modal
 */
export function closeAttachmentPreviewModal(): void {
  const modal = $$id('attachmentPreviewModal');

  if (modal !== null) {
    modal.classList.remove(MODAL_ACTIVE_CLASS);
    // Add hidden attribute after animation
    setTimeout(() => {
      modal.setAttribute('hidden', '');
      // Clear iframe/image to stop loading
      const bodyEl = $$id('attachmentPreviewBody');
      if (bodyEl !== null) {
        bodyEl.innerHTML = '';
      }
    }, 300);
  }

  console.info('[Modals] Attachment preview modal closed');
}

/**
 * Setup preview modal event listeners
 */
export function setupPreviewModalListeners(): void {
  // Delegate click on preview buttons
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle preview button clicks
    const previewBtn = target.closest('.attachment-preview-btn');
    if (previewBtn) {
      e.preventDefault();
      const url = (previewBtn as HTMLElement).dataset['previewUrl'];
      const mimeType = (previewBtn as HTMLElement).dataset['mimeType'];
      const filename = (previewBtn as HTMLElement).dataset['filename'];

      if (url !== undefined && mimeType !== undefined && filename !== undefined) {
        showAttachmentPreviewModal(url, mimeType, filename);
      }
      return;
    }

    // Handle close preview modal button
    const closePreviewBtn = target.closest('[data-action="close-preview-modal"]');
    if (closePreviewBtn) {
      closeAttachmentPreviewModal();
      return;
    }

    // Handle backdrop click for preview modal
    if (target.id === 'attachmentPreviewModal') {
      closeAttachmentPreviewModal();
    }
  });

  console.info('[Modals] Preview modal listeners initialized');
}

// ============================================================================
// Dropdown Click-Outside Handler
// ============================================================================

/**
 * Setup dropdown click-outside-to-close
 */
export function setupDropdownClickOutside(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.custom-dropdown')) {
      document.querySelectorAll('.dropdown-display').forEach((d) => {
        d.classList.remove('active');
      });
      document.querySelectorAll('.dropdown-options').forEach((d) => {
        d.classList.remove('active');
      });
    }
  });

  console.info('[Modals] Dropdown click-outside handler initialized');
}
