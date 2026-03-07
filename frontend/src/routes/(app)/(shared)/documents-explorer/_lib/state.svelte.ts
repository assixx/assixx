// =============================================================================
// DOCUMENTS EXPLORER - STATE AGGREGATOR
// Unified API + cross-cutting operations that touch both data and UI
// =============================================================================

import { invalidateAll } from '$app/navigation';

import {
  showSuccessAlert,
  showErrorAlert,
  showWarningAlert,
} from '$lib/stores/toast';
import { createLogger } from '$lib/utils/logger';

import {
  deleteDocument as apiDeleteDocument,
  updateDocument as apiUpdateDocument,
  uploadDocument as apiUploadDocument,
} from './api';
import { MESSAGES } from './constants';
import { dataState } from './state-data.svelte';
import { uiState } from './state-ui.svelte';
import {
  canDeleteDocument,
  canEditDocument,
  buildUploadFormData,
  validateUploadData,
  downloadDocument,
} from './utils';

import type { Document, EditData, SortOption, UploadData } from './types';

const log = createLogger('DocExplorerState');

// =============================================================================
// CROSS-CUTTING OPERATIONS
// =============================================================================

/**
 * Open preview and mark document as read if unread
 */
function handlePreviewOpen(doc: Document): void {
  uiState.openPreview(doc);
  if (!doc.isRead) void dataState.markAsRead(doc.id);
}

/** Navigate to previous document in filtered list (circular) */
function navigatePreviewPrev(): void {
  const docs = dataState.filteredDocuments;
  const current = uiState.selectedDocument;
  if (current === null || docs.length <= 1) return;
  const idx = docs.findIndex((d) => d.id === current.id);
  if (idx === -1) return;
  const prevDoc = docs[idx === 0 ? docs.length - 1 : idx - 1];
  uiState.openPreview(prevDoc);
  if (!prevDoc.isRead) void dataState.markAsRead(prevDoc.id);
}

/** Navigate to next document in filtered list (circular) */
function navigatePreviewNext(): void {
  const docs = dataState.filteredDocuments;
  const current = uiState.selectedDocument;
  if (current === null || docs.length <= 1) return;
  const idx = docs.findIndex((d) => d.id === current.id);
  if (idx === -1) return;
  const nextDoc = docs[idx === docs.length - 1 ? 0 : idx + 1];
  uiState.openPreview(nextDoc);
  if (!nextDoc.isRead) void dataState.markAsRead(nextDoc.id);
}

/**
 * Handle delete button click: permission check + open confirm modal
 */
function handleDeleteDocument(doc: Document, e: MouseEvent): void {
  e.stopPropagation();
  if (!canDeleteDocument(doc, dataState.currentUser)) {
    showWarningAlert(
      'Sie haben keine Berechtigung, dieses Dokument zu löschen',
    );
    return;
  }
  uiState.openDeleteModal(doc);
}

/**
 * Confirm and execute document deletion
 */
async function confirmDeleteDocument(): Promise<void> {
  const doc = uiState.deletingDocument;
  if (doc === null) return;

  uiState.setDeleteSubmitting(true);
  try {
    await apiDeleteDocument(doc.id);
    showSuccessAlert('Dokument erfolgreich gelöscht');
    uiState.closeDeleteConfirmModal();
    await invalidateAll();
    await dataState.loadDocuments();
  } catch (err: unknown) {
    log.error({ err }, 'Delete failed');
    showErrorAlert(
      err instanceof Error ? err.message : 'Löschen fehlgeschlagen',
    );
  } finally {
    uiState.setDeleteSubmitting(false);
  }
}

/**
 * Handle edit button click: permission check + open edit modal
 */
function handleEditClick(doc: Document, e: MouseEvent): void {
  e.stopPropagation();
  if (!canEditDocument(doc, dataState.currentUser)) {
    showWarningAlert(
      'Sie haben keine Berechtigung, dieses Dokument zu bearbeiten',
    );
    return;
  }
  uiState.openEditModal(doc);
}

/**
 * Submit document edit: validate + API call + reload
 */
async function handleEditSubmit(data: EditData): Promise<void> {
  if (uiState.editingDocument === null) return;
  if (!data.documentName.trim()) {
    showWarningAlert('Bitte geben Sie einen Dokumentnamen ein');
    return;
  }

  uiState.setEditSubmitting(true);
  try {
    await apiUpdateDocument(uiState.editingDocument.id, data);
    showSuccessAlert('Dokument erfolgreich aktualisiert');
    uiState.closeEditModal();
    await invalidateAll();
    await dataState.loadDocuments();
  } catch (err: unknown) {
    log.error({ err }, 'Update failed');
    showErrorAlert(
      err instanceof Error ? err.message : 'Aktualisieren fehlgeschlagen',
    );
  } finally {
    uiState.setEditSubmitting(false);
  }
}

/**
 * Open upload modal and refresh user data
 */
function handleUploadOpen(): void {
  uiState.openUploadModal();
  void dataState.loadCurrentUser();
}

/**
 * Submit document upload: validate + API call + reload
 */
async function handleUploadSubmit(data: UploadData): Promise<void> {
  const result = validateUploadData(data, dataState.currentUser);
  if (!result.valid) {
    if (result.type === 'warning') {
      showWarningAlert(result.error);
    } else {
      showErrorAlert(result.error);
    }
    return;
  }

  const { file, category, user, requiresPayroll } = result.data;
  const formData = buildUploadFormData(
    file,
    category,
    user,
    data.docName,
    data.description,
    data.tags,
    requiresPayroll ? data.salaryYear : undefined,
    requiresPayroll ? data.salaryMonth : undefined,
  );

  if (formData === null) {
    showErrorAlert('Ungültige Kategorie');
    return;
  }

  try {
    await apiUploadDocument(formData);
    showSuccessAlert(MESSAGES.UPLOAD_SUCCESS);
    uiState.closeUploadModal();
    await invalidateAll();
    await dataState.loadDocuments();
  } catch (err: unknown) {
    log.error({ err }, 'Upload failed');
    showErrorAlert(
      err instanceof Error ? err.message : MESSAGES.ERROR_UPLOAD_FAILED,
    );
  }
}

/**
 * Handle download click with event propagation stop
 */
function handleDownloadClick(doc: Document, e: MouseEvent): void {
  e.stopPropagation();
  downloadDocument(doc);
}

/**
 * Handle sort option select: update sort + close dropdown
 */
function handleSortOptionSelect(option: SortOption): void {
  dataState.handleSortChange(option);
  uiState.setSortDropdownOpen(false);
}

// =============================================================================
// UNIFIED STATE OBJECT
// Delegates to dataState/uiState with unified getter API
// =============================================================================

export const docExplorerState = {
  // ---------------------------------------------------------------------------
  // DATA GETTERS
  // ---------------------------------------------------------------------------
  get allDocuments() {
    return dataState.allDocuments;
  },
  get filteredDocuments() {
    return dataState.filteredDocuments;
  },
  get chatFolders() {
    return dataState.chatFolders;
  },
  get selectedConversationId() {
    return dataState.selectedConversationId;
  },
  get currentUser() {
    return dataState.currentUser;
  },
  get userRole() {
    return dataState.userRole;
  },
  get loading() {
    return dataState.loading;
  },
  get error() {
    return dataState.error;
  },
  get currentCategory() {
    return dataState.currentCategory;
  },
  get searchQuery() {
    return dataState.searchQuery;
  },
  get sortOption() {
    return dataState.sortOption;
  },

  // Data derived
  get categoryCounts() {
    return dataState.categoryCounts;
  },
  get stats() {
    return dataState.stats;
  },
  get chatFoldersTotalCount() {
    return dataState.chatFoldersTotalCount;
  },
  get currentSortLabel() {
    return dataState.currentSortLabel;
  },
  get showUploadButton() {
    return dataState.showUploadButton;
  },
  get showActions() {
    return dataState.showActions;
  },
  get isViewingChatFolders() {
    return dataState.isViewingChatFolders;
  },
  get selectedChatFolderName() {
    return dataState.selectedChatFolderName;
  },

  // ---------------------------------------------------------------------------
  // UI GETTERS
  // ---------------------------------------------------------------------------
  get viewMode() {
    return uiState.viewMode;
  },
  get sortDropdownOpen() {
    return uiState.sortDropdownOpen;
  },
  get selectedDocument() {
    return uiState.selectedDocument;
  },
  get showPreviewModal() {
    return uiState.showPreviewModal;
  },
  get showUploadModal() {
    return uiState.showUploadModal;
  },
  get showEditModal() {
    return uiState.showEditModal;
  },
  get editingDocument() {
    return uiState.editingDocument;
  },
  get editSubmitting() {
    return uiState.editSubmitting;
  },
  get showDeleteConfirmModal() {
    return uiState.showDeleteConfirmModal;
  },
  get deletingDocument() {
    return uiState.deletingDocument;
  },
  get deleteSubmitting() {
    return uiState.deleteSubmitting;
  },
  get previewIndex() {
    const current = uiState.selectedDocument;
    if (current === null) return -1;
    return dataState.filteredDocuments.findIndex((d) => d.id === current.id);
  },
  get previewTotalCount() {
    return dataState.filteredDocuments.length;
  },

  // ---------------------------------------------------------------------------
  // DATA METHODS
  // ---------------------------------------------------------------------------
  initFromSSR: dataState.initFromSSR,
  loadDocuments: dataState.loadDocuments,
  loadChatFolders: dataState.loadChatFolders,
  loadChatAttachments: dataState.loadChatAttachments,
  navigateToCategory: dataState.navigateToCategory,
  backToFolders: dataState.backToFolders,
  handleSearchInput: dataState.handleSearchInput,
  clearSearch: dataState.clearSearch,
  // ---------------------------------------------------------------------------
  // UI METHODS
  // ---------------------------------------------------------------------------
  setViewMode: uiState.setViewMode,
  loadSavedViewMode: uiState.loadSavedViewMode,
  setSortDropdownOpen: uiState.setSortDropdownOpen,
  toggleSortDropdown: uiState.toggleSortDropdown,
  closePreview: uiState.closePreview,
  closeUploadModal: uiState.closeUploadModal,
  closeEditModal: uiState.closeEditModal,
  closeDeleteConfirmModal: uiState.closeDeleteConfirmModal,

  // ---------------------------------------------------------------------------
  // CROSS-CUTTING OPERATIONS
  // ---------------------------------------------------------------------------
  handlePreviewOpen,
  navigatePreviewPrev,
  navigatePreviewNext,
  handleDeleteDocument,
  confirmDeleteDocument,
  handleEditClick,
  handleEditSubmit,
  handleUploadOpen,
  handleUploadSubmit,
  handleDownloadClick,
  handleSortOptionSelect,
  downloadDocument,
};
