// =============================================================================
// DOCUMENTS EXPLORER - UI STATE MODULE
// Factory function singleton pattern (Svelte 5 runes)
// Manages: modals, view mode, sort dropdown, ephemeral UI state
// =============================================================================

import type { Document, ViewMode } from './types';

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

// eslint-disable-next-line max-lines-per-function -- Factory function pattern: closure scope provides read-only encapsulation via getters
function createDocExplorerUiState() {
  // ---------------------------------------------------------------------------
  // STATE (closure scope, exposed via getters)
  // ---------------------------------------------------------------------------

  let viewMode = $state<ViewMode>('list');
  let sortDropdownOpen = $state(false);

  // Preview modal
  let selectedDocument = $state<Document | null>(null);
  let showPreviewModal = $state(false);

  // Upload modal
  let showUploadModal = $state(false);

  // Edit modal
  let showEditModal = $state(false);
  let editingDocument = $state<Document | null>(null);
  let editSubmitting = $state(false);

  // Delete confirm modal
  let showDeleteConfirmModal = $state(false);
  let deletingDocument = $state<Document | null>(null);
  let deleteSubmitting = $state(false);

  // ---------------------------------------------------------------------------
  // VIEW MODE
  // ---------------------------------------------------------------------------

  function setViewMode(mode: ViewMode): void {
    viewMode = mode;
    localStorage.setItem('documents-view-mode', mode);
  }

  function loadSavedViewMode(): void {
    const saved = localStorage.getItem('documents-view-mode');
    if (saved === 'list' || saved === 'grid') viewMode = saved;
  }

  // ---------------------------------------------------------------------------
  // SORT DROPDOWN
  // ---------------------------------------------------------------------------

  function setSortDropdownOpen(open: boolean): void {
    sortDropdownOpen = open;
  }

  function toggleSortDropdown(): void {
    sortDropdownOpen = !sortDropdownOpen;
  }

  // ---------------------------------------------------------------------------
  // PREVIEW MODAL
  // ---------------------------------------------------------------------------

  function openPreview(doc: Document): void {
    selectedDocument = doc;
    showPreviewModal = true;
  }

  function closePreview(): void {
    showPreviewModal = false;
    selectedDocument = null;
  }

  // ---------------------------------------------------------------------------
  // UPLOAD MODAL
  // ---------------------------------------------------------------------------

  function openUploadModal(): void {
    showUploadModal = true;
  }

  function closeUploadModal(): void {
    showUploadModal = false;
  }

  // ---------------------------------------------------------------------------
  // EDIT MODAL
  // ---------------------------------------------------------------------------

  function openEditModal(doc: Document): void {
    editingDocument = doc;
    showEditModal = true;
  }

  function closeEditModal(): void {
    showEditModal = false;
    editingDocument = null;
  }

  function setEditSubmitting(value: boolean): void {
    editSubmitting = value;
  }

  // ---------------------------------------------------------------------------
  // DELETE CONFIRM MODAL
  // ---------------------------------------------------------------------------

  function openDeleteModal(doc: Document): void {
    deletingDocument = doc;
    showDeleteConfirmModal = true;
  }

  function closeDeleteConfirmModal(): void {
    showDeleteConfirmModal = false;
    deletingDocument = null;
  }

  function setDeleteSubmitting(value: boolean): void {
    deleteSubmitting = value;
  }

  // ---------------------------------------------------------------------------
  // RESET
  // ---------------------------------------------------------------------------

  function reset(): void {
    viewMode = 'list';
    sortDropdownOpen = false;
    selectedDocument = null;
    showPreviewModal = false;
    showUploadModal = false;
    showEditModal = false;
    editingDocument = null;
    editSubmitting = false;
    showDeleteConfirmModal = false;
    deletingDocument = null;
    deleteSubmitting = false;
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  return {
    // Getters
    get viewMode() {
      return viewMode;
    },
    get sortDropdownOpen() {
      return sortDropdownOpen;
    },
    get selectedDocument() {
      return selectedDocument;
    },
    get showPreviewModal() {
      return showPreviewModal;
    },
    get showUploadModal() {
      return showUploadModal;
    },
    get showEditModal() {
      return showEditModal;
    },
    get editingDocument() {
      return editingDocument;
    },
    get editSubmitting() {
      return editSubmitting;
    },
    get showDeleteConfirmModal() {
      return showDeleteConfirmModal;
    },
    get deletingDocument() {
      return deletingDocument;
    },
    get deleteSubmitting() {
      return deleteSubmitting;
    },

    // Methods
    setViewMode,
    loadSavedViewMode,
    setSortDropdownOpen,
    toggleSortDropdown,
    openPreview,
    closePreview,
    openUploadModal,
    closeUploadModal,
    openEditModal,
    closeEditModal,
    setEditSubmitting,
    openDeleteModal,
    closeDeleteConfirmModal,
    setDeleteSubmitting,
    reset,
  };
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const uiState = createDocExplorerUiState();
