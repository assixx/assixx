/**
 * Blackboard Module - Main Entry Point
 * Orchestrates all blackboard functionality following MANAGE pattern
 * Clean architecture: types → api → data → modals/forms → ui → filters
 */

// ============================================================================
// Exports - Types (for widget.ts)
// ============================================================================

export * from './types';

// ============================================================================
// Exports - Widget (used in dashboards)
// ============================================================================

export { BlackboardWidget, initializeBlackboardWidget } from './widget';

// ============================================================================
// Imports for Initialization
// ============================================================================

// CRITICAL: Import zoom.ts to enable zoom functionality
// Without this import, zoom.ts is never loaded by Vite bundler
import './zoom';

import { ApiClient } from '../../utils/api-client';
import { setSafeHTML } from '../../utils/dom-utils';
import { loadUserInfo } from '../auth';
import { blackboardState, loadEntries, loadOrganizationData } from './data';
import {
  setupModalEventListeners,
  setupDropdownClickOutside,
  setupPreviewModalListeners,
  showAddEntryModal,
  showEditEntryModal,
  showDeleteModal,
  showDeleteConfirmModal,
  closeDeleteConfirmModal,
  closeViewEntryModal,
} from './modals';
import { initializeFilters, handlePageChange } from './filters';
import { renderBlackboardGrid, showLoadingIndicator, hideLoadingIndicator, renderPagination } from './ui';
import {
  handleEntryFormSubmit,
  handleDeleteEntry,
  handleFileSelect,
  handleConfirmEntry,
  resetEntryForm,
  populateEntryForm,
  initOrganizationMultiSelects,
  initEntryPriorityDropdown,
} from './forms';

// ============================================================================
// Main Initialization
// ============================================================================

/**
 * Initialize blackboard system
 */
async function initializeBlackboard(): Promise<void> {
  console.info('[Blackboard] Initializing...');

  try {
    // Get API client
    const apiClient = ApiClient.getInstance();

    // Get user info (use cached auth function to prevent duplicate API calls)
    const userInfo = await loadUserInfo();
    const isAdmin = userInfo.role === 'admin' || userInfo.role === 'root';

    // Initialize state with role for permission checks
    // Note: canEditEntry checks for 'root' role OR author, not admin
    blackboardState.initialize(apiClient, userInfo.id, isAdmin, userInfo.role);

    // Load organization data (departments, teams)
    await loadOrganizationData(apiClient);

    // Setup event listeners
    setupEventListeners();

    // Setup modal event listeners
    setupModalEventListeners();
    setupDropdownClickOutside();
    setupPreviewModalListeners(); // NEW 2025-11-24: Attachment preview modal

    // Initialize multi-select dropdowns and custom priority dropdowns
    initOrganizationMultiSelects();
    initEntryPriorityDropdown();

    // Setup filters
    initializeFilters();

    // Initial load of entries
    await loadEntriesAndRender();

    console.info('[Blackboard] Initialization complete');
  } catch (error) {
    console.error('[Blackboard] Initialization error:', error);
  }
}

/**
 * Load entries and render UI
 */
async function loadEntriesAndRender(): Promise<void> {
  showLoadingIndicator();

  await loadEntries();

  hideLoadingIndicator();
  renderBlackboardGrid();
  renderPagination();
}

// ============================================================================
// Event Listeners
// ============================================================================

/**
 * Handle new entry button click
 */
function handleNewEntryClick(): void {
  resetEntryForm();
  showAddEntryModal();
}

/**
 * Handle edit entry button click
 */
function handleEditEntryClick(target: HTMLElement): void {
  const editBtn = target.closest('[data-action="edit-entry"]');
  if (editBtn !== null) {
    const entryIdValue = (editBtn as HTMLElement).dataset['entryId'];
    if (entryIdValue !== undefined) {
      const entryId = Number.parseInt(entryIdValue, 10);
      const entry = blackboardState.getEntryById(entryId);
      if (entry !== undefined) {
        populateEntryForm(entry);
        showEditEntryModal(entry);
      }
    }
  }
}

/**
 * Handle delete entry button click
 */
function handleDeleteEntryClick(target: HTMLElement): void {
  const deleteBtn = target.closest('[data-action="delete-entry"]');
  if (deleteBtn !== null) {
    const entryIdValue = (deleteBtn as HTMLElement).dataset['entryId'];
    if (entryIdValue !== undefined) {
      const entryId = Number.parseInt(entryIdValue, 10);
      const entry = blackboardState.getEntryById(entryId);
      if (entry !== undefined) {
        showDeleteModal(entry.id, entry.title);
      }
    }
  }
}

/**
 * Handle proceed delete click (Step 1 → Step 2, double-check pattern)
 */
function handleProceedDeleteClick(): void {
  showDeleteConfirmModal();
}

/**
 * Handle confirm delete click (Step 2 - actually delete)
 */
async function handleConfirmDeleteClick(): Promise<void> {
  const deleteIdInput = document.querySelector('#deleteEntryId'); // Fixed ID to match HTML
  if (deleteIdInput !== null) {
    const inputValue = (deleteIdInput as HTMLInputElement).value;
    if (inputValue !== '') {
      const entryId = Number.parseInt(inputValue, 10);
      await handleDeleteEntry(entryId);
      closeDeleteConfirmModal(); // Close the confirm modal (step 2)
      await loadEntriesAndRender();
    }
  }
}

/**
 * Handle view entry click (click on card)
 * 2025-11-24: Changed from modal to dedicated detail page navigation
 */
function handleViewEntryClick(target: HTMLElement): void {
  const entryCard = target.closest('.pinboard-sticky');
  if (entryCard !== null) {
    const item = entryCard.closest('[data-entry-id]');
    if (item !== null) {
      const entryIdValue = (item as HTMLElement).dataset['entryId'];
      if (entryIdValue !== undefined) {
        const entryId = Number.parseInt(entryIdValue, 10);
        const entry = blackboardState.getEntryById(entryId);
        if (entry !== undefined) {
          // Navigate to dedicated detail page instead of modal
          window.location.href = `/blackboard-detail?uuid=${entry.uuid}`;
        }
      }
    }
  }
}

/**
 * Handle confirm entry button click
 */
async function handleConfirmEntryClick(target: HTMLElement): Promise<void> {
  const confirmBtn = target.closest('[data-action="confirm-entry"]');
  if (confirmBtn !== null) {
    const entryIdValue = (confirmBtn as HTMLElement).dataset['entryId'];
    if (entryIdValue !== undefined) {
      const entryId = Number.parseInt(entryIdValue, 10);
      await handleConfirmEntry(entryId);
      closeViewEntryModal();
      await loadEntriesAndRender();
    }
  }
}

/**
 * Handle pagination button click
 */
function handlePaginationClick(target: HTMLElement): void {
  const pageBtn = target.closest('[data-action="change-page"]');
  if (pageBtn !== null) {
    const pageValue = (pageBtn as HTMLElement).dataset['page'];
    if (pageValue !== undefined) {
      const page = Number.parseInt(pageValue, 10);
      handlePageChange(page);
    }
  }
}

/**
 * Clear and disable organization selects
 */
function disableOrgSelects(
  areaSelect: HTMLSelectElement | null,
  deptSelect: HTMLSelectElement | null,
  teamSelect: HTMLSelectElement | null,
): void {
  if (areaSelect) {
    areaSelect.value = '';
    areaSelect.disabled = true;
    Array.from(areaSelect.options).forEach((opt) => (opt.selected = false));
  }
  if (deptSelect) {
    deptSelect.value = '';
    deptSelect.disabled = true;
    Array.from(deptSelect.options).forEach((opt) => (opt.selected = false));
  }
  if (teamSelect) {
    teamSelect.value = '';
    teamSelect.disabled = true;
    Array.from(teamSelect.options).forEach((opt) => (opt.selected = false));
  }
}

/**
 * Enable organization selects
 */
function enableOrgSelects(
  areaSelect: HTMLSelectElement | null,
  deptSelect: HTMLSelectElement | null,
  teamSelect: HTMLSelectElement | null,
): void {
  if (areaSelect) areaSelect.disabled = false;
  if (deptSelect) deptSelect.disabled = false;
  if (teamSelect) teamSelect.disabled = false;
}

/**
 * Setup company-wide toggle for entry modal
 */
function setupEntryCompanyToggle(): void {
  const entryCompanyToggle = document.querySelector<HTMLInputElement>('#entry-company-wide');
  if (!entryCompanyToggle) return;

  entryCompanyToggle.addEventListener('change', () => {
    const areaSelect = document.querySelector<HTMLSelectElement>('#entry-area-select');
    const deptSelect = document.querySelector<HTMLSelectElement>('#entry-department-select');
    const teamSelect = document.querySelector<HTMLSelectElement>('#entry-team-select');

    if (entryCompanyToggle.checked) {
      disableOrgSelects(areaSelect, deptSelect, teamSelect);
    } else {
      enableOrgSelects(areaSelect, deptSelect, teamSelect);
    }
  });
}

/**
 * Setup global click event delegation
 */
function setupClickDelegation(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    if (target.closest('[data-action="new-entry"]')) {
      handleNewEntryClick();
    } else if (target.closest('[data-action="edit-entry"]')) {
      handleEditEntryClick(target);
    } else if (target.closest('[data-action="delete-entry"]')) {
      handleDeleteEntryClick(target);
    } else if (target.closest('[data-action="proceed-delete"]')) {
      // Step 1 → Step 2 (double-check pattern)
      handleProceedDeleteClick();
    } else if (target.closest('[data-action="confirm-delete"]')) {
      // Step 2 → actually delete
      void handleConfirmDeleteClick();
    } else if (target.closest('.pinboard-sticky')) {
      handleViewEntryClick(target);
    } else if (target.closest('[data-action="confirm-entry"]')) {
      void handleConfirmEntryClick(target);
    } else if (target.closest('[data-action="change-page"]')) {
      handlePaginationClick(target);
    }
  });
}

/**
 * Setup form submission handlers
 */
function setupFormHandlers(): void {
  // Entry form submission (HTML uses camelCase IDs)
  const entryForm = document.querySelector('#entryForm');
  if (entryForm) {
    entryForm.addEventListener('submit', (e) => {
      void (async () => {
        await handleEntryFormSubmit(e);
        await loadEntriesAndRender();
      })();
    });
  }

  // File input for attachments
  const fileInput = document.querySelector('#attachmentInput');
  if (fileInput) {
    fileInput.addEventListener('change', handleFileSelect);
  }

  // Setup drag & drop for file upload zone
  setupFileUploadDragDrop();
}

/**
 * Setup drag & drop for file upload zone (Design System)
 */
function setupFileUploadDragDrop(): void {
  const dropZone = document.querySelector('#attachmentDropZone');
  const fileInput = document.querySelector<HTMLInputElement>('#attachmentInput');
  const previewContainer = document.querySelector<HTMLElement>('#attachmentPreview');

  if (!dropZone || !fileInput) return;

  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  // Add dragover state (Design System class)
  ['dragenter', 'dragover'].forEach((eventName) => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.add('file-upload-zone--dragover');
    });
  });

  // Remove dragover state
  ['dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove('file-upload-zone--dragover');
    });
  });

  // Handle dropped files
  dropZone.addEventListener('drop', (e) => {
    const dt = (e as DragEvent).dataTransfer;
    if (dt?.files && dt.files.length > 0) {
      // Transfer files to the hidden input
      const dataTransfer = new DataTransfer();
      Array.from(dt.files).forEach((file) => dataTransfer.items.add(file));
      fileInput.files = dataTransfer.files;

      // Trigger change event to update state
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // Update preview when files change
  fileInput.addEventListener('change', () => {
    if (!previewContainer) return;

    const files = fileInput.files;
    if (!files || files.length === 0) {
      previewContainer.setAttribute('hidden', '');
      previewContainer.innerHTML = '';
      return;
    }

    // Render file preview list (Design System format)
    previewContainer.removeAttribute('hidden');
    const html = Array.from(files)
      .map((file) => renderFilePreviewItem(file))
      .join('');
    setSafeHTML(previewContainer, html);

    // Add remove button handlers
    previewContainer.querySelectorAll('.file-upload-item__remove').forEach((btn, index) => {
      btn.addEventListener('click', () => {
        removeFileAtIndex(fileInput, index, previewContainer);
      });
    });
  });

  console.info('[Blackboard] File upload drag & drop initialized');
}

/**
 * Render a single file preview item (Design System format)
 */
function renderFilePreviewItem(file: File): string {
  const isImage = file.type.startsWith('image/');
  const isPDF = file.type === 'application/pdf';
  const sizeKB = (file.size / 1024).toFixed(1);
  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
  const sizeText = file.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

  let iconClass = 'fas fa-file';
  let previewClass = '';
  if (isPDF) {
    iconClass = 'fas fa-file-pdf';
    previewClass = 'file-upload-item__preview--pdf';
  } else if (isImage) {
    iconClass = 'fas fa-image';
  }

  return `
    <div class="file-upload-item">
      <div class="file-upload-item__preview ${previewClass}">
        <i class="${iconClass}"></i>
      </div>
      <div class="file-upload-item__info">
        <div class="file-upload-item__name">${escapeHtmlLocal(file.name)}</div>
        <div class="file-upload-item__meta">${sizeText}</div>
      </div>
      <button type="button" class="file-upload-item__remove" aria-label="Datei entfernen">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
}

/**
 * Remove file at index from file input
 */
function removeFileAtIndex(fileInput: HTMLInputElement, index: number, _previewContainer: Element): void {
  const dt = new DataTransfer();
  const files = fileInput.files;

  if (files) {
    Array.from(files).forEach((file, i) => {
      if (i !== index) {
        dt.items.add(file);
      }
    });
  }

  fileInput.files = dt.files;
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Escape HTML for safe rendering
 */
function escapeHtmlLocal(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Setup color picker for entry form
 */
function setupColorPicker(): void {
  // Use event delegation for color picker
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const colorOption = target.closest('.color-option');

    if (colorOption instanceof HTMLElement) {
      // Get the color value
      const selectedColor = colorOption.dataset['color'];
      if (selectedColor === undefined || selectedColor === '') return;

      // Remove active class from all options
      document.querySelectorAll('.color-option').forEach((option) => {
        option.classList.remove('active');
        option.setAttribute('aria-checked', 'false');
      });

      // Add active class to selected option
      colorOption.classList.add('active');
      colorOption.setAttribute('aria-checked', 'true');

      // Update hidden input
      const colorInput = document.querySelector<HTMLInputElement>('#entryColor');
      if (colorInput) {
        colorInput.value = selectedColor;
        console.info('[Blackboard] Color selected:', selectedColor);
      }
    }
  });
}

/**
 * Setup custom event listeners for edit/delete actions from sticky-note-component
 * These events are dispatched by ui.ts handleEditEntry/handleDeleteEntry
 */
function setupCustomEventListeners(): void {
  // Listen for edit entry custom event
  document.addEventListener('blackboard:edit-entry', ((
    e: CustomEvent<{ entry: ReturnType<typeof blackboardState.getEntryById> }>,
  ) => {
    const entry = e.detail.entry;
    if (entry !== undefined) {
      populateEntryForm(entry);
      showEditEntryModal(entry);
      console.info('[Blackboard] Edit entry event handled for ID:', entry.id);
    }
  }) as EventListener);

  // Listen for delete entry custom event
  document.addEventListener('blackboard:delete-entry', ((
    e: CustomEvent<{ entry: ReturnType<typeof blackboardState.getEntryById> }>,
  ) => {
    const entry = e.detail.entry;
    if (entry !== undefined) {
      showDeleteModal(entry.id, entry.title);
      console.info('[Blackboard] Delete entry event handled for ID:', entry.id);
    }
  }) as EventListener);

  console.info('[Blackboard] Custom event listeners initialized');
}

/**
 * Setup all event listeners using event delegation
 */
function setupEventListeners(): void {
  setupClickDelegation();
  setupFormHandlers();
  setupEntryCompanyToggle();
  setupColorPicker();
  setupCustomEventListeners();
  console.info('[Blackboard] Event listeners initialized');
}

// ============================================================================
// Auto-Initialize on DOM Ready
// ============================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void initializeBlackboard();
  });
} else {
  void initializeBlackboard();
}

console.info('[Blackboard] Module loaded');
