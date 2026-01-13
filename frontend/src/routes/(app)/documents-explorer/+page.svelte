<script lang="ts">
  /**
   * Documents Explorer - Page Component
   * SSR: Data loaded in +page.server.ts
   * Level 3 Hybrid: SSR initial + client-side filtering/sorting
   */
  import { onMount } from 'svelte';

  import { goto, invalidateAll } from '$app/navigation';

  import { showSuccessAlert, showErrorAlert, showWarningAlert } from '$lib/stores/toast';
  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('DocumentsExplorerPage');

  // Page-specific CSS
  import '../../../styles/documents-explorer.css';

  // Import from _lib/ modules
  import {
    fetchDocuments as apiFetchDocuments,
    markDocumentAsRead as apiMarkAsRead,
    fetchChatFolders as apiFetchChatFolders,
    fetchChatAttachments as apiFetchChatAttachments,
    uploadDocument as apiUploadDocument,
    deleteDocument as apiDeleteDocument,
    updateDocument as apiUpdateDocument,
    getCurrentUser as apiGetCurrentUser,
    isSessionExpiredError,
  } from './_lib/api';
  import ChatFoldersList from './_lib/ChatFoldersList.svelte';
  import { SORT_OPTIONS, SORT_LABELS, CATEGORY_MAPPINGS, MESSAGES } from './_lib/constants';
  import DeleteConfirmModal from './_lib/DeleteConfirmModal.svelte';
  import DocumentGridView from './_lib/DocumentGridView.svelte';
  import DocumentListView from './_lib/DocumentListView.svelte';
  import EditModal from './_lib/EditModal.svelte';
  import { applyAllFilters, calculateCategoryCounts, calculateStats } from './_lib/filters';
  import FolderSidebar from './_lib/FolderSidebar.svelte';
  import PreviewModal from './_lib/PreviewModal.svelte';
  import UploadModal from './_lib/UploadModal.svelte';
  import {
    validateUserForCategory,
    buildUploadFormData,
    canUpload,
    canSeeActions,
    canEditDocument,
    canDeleteDocument,
  } from './_lib/utils';

  // Import Components

  import type { PageData } from './$types';
  import type {
    EditData,
    UploadData,
    Document,
    DocumentCategory,
    ViewMode,
    SortOption,
    ChatFolder,
    CurrentUser,
  } from './_lib/types';

  // ==========================================================================
  // SSR DATA (initial values from server)
  // ==========================================================================

  const { data }: { data: PageData } = $props();

  // Derived SSR data as baseline
  const ssrDocuments = $derived(data.documents);
  const ssrChatFolders = $derived(data.chatFolders);
  const ssrUser = $derived(data.currentUser ?? null);

  // ==========================================================================
  // HYBRID STATE - SSR initial, client updates for filtering/sorting
  // ==========================================================================

  let allDocuments = $state<Document[]>([]);
  let filteredDocuments = $state<Document[]>([]);
  let chatFolders = $state<ChatFolder[]>([]);
  let chatFoldersLoaded = $state(true);
  let selectedConversationId = $state<number | null>(null);
  let currentUser = $state<CurrentUser | null>(null);
  let userRole = $state<string | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Initialize from SSR on first render
  $effect(() => {
    if (allDocuments.length === 0 && ssrDocuments.length > 0) {
      allDocuments = [...ssrDocuments];
      filteredDocuments = applyAllFilters(ssrDocuments, 'all', '', 'newest');
    }
    if (chatFolders.length === 0 && ssrChatFolders.length > 0) {
      chatFolders = [...ssrChatFolders];
    }
    if (currentUser === null && ssrUser !== null) {
      currentUser = {
        id: ssrUser.id,
        tenantId: 0,
        role: ssrUser.role,
      };
      userRole = ssrUser.role;
    }
  });
  let currentCategory = $state<DocumentCategory>('all');
  let searchQuery = $state('');
  let sortOption = $state<SortOption>('newest');
  let viewMode = $state<ViewMode>('list');
  let selectedDocument = $state<Document | null>(null);
  let showPreviewModal = $state(false);
  let showUploadModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteConfirmModal = $state(false);
  let deletingDocument = $state<Document | null>(null);
  let deleteSubmitting = $state(false);
  let editingDocument = $state<Document | null>(null);
  let editSubmitting = $state(false);
  let sortDropdownOpen = $state(false);
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // DERIVED VALUES
  const categoryCounts = $derived(calculateCategoryCounts(allDocuments));
  const stats = $derived(calculateStats(filteredDocuments));
  const chatFoldersTotalCount = $derived(
    chatFolders.reduce((sum, f) => sum + f.attachmentCount, 0),
  );
  const currentSortLabel = $derived(SORT_LABELS[sortOption]);
  const showUploadButton = $derived(canUpload(userRole));
  const showActions = $derived(canSeeActions(userRole));
  const isViewingChatFolders = $derived(
    currentCategory === 'chat' && selectedConversationId === null,
  );

  function applyFilters() {
    filteredDocuments = applyAllFilters(allDocuments, currentCategory, searchQuery, sortOption);
  }

  // API FUNCTIONS
  async function loadDocuments() {
    loading = true;
    error = null;
    try {
      allDocuments = await apiFetchDocuments();
      applyFilters();
    } catch (err) {
      log.error({ err }, 'Error loading documents');
      if (isSessionExpiredError(err)) {
        return void goto('/login?session=expired');
      }
      error = err instanceof Error ? err.message : MESSAGES.ERROR_LOAD_FAILED;
    } finally {
      loading = false;
    }
  }

  async function loadChatFolders() {
    if (chatFoldersLoaded) return;
    chatFoldersLoaded = true; // Set before await to prevent race condition
    try {
      chatFolders = await apiFetchChatFolders();
    } catch (err) {
      log.error({ err }, 'Error loading chat folders');
    }
  }

  async function loadChatAttachments(conversationId: number) {
    loading = true;
    selectedConversationId = conversationId;
    try {
      allDocuments = await apiFetchChatAttachments(conversationId);
      applyFilters();
    } catch (err) {
      log.error({ err }, 'Error loading chat attachments');
      error = MESSAGES.ERROR_LOAD_FAILED;
    } finally {
      loading = false;
    }
  }

  async function loadCurrentUser() {
    currentUser = await apiGetCurrentUser();
  }

  async function markAsRead(documentId: number) {
    try {
      await apiMarkAsRead(documentId);
      allDocuments = allDocuments.map((doc) =>
        doc.id === documentId ? { ...doc, isRead: true } : doc,
      );
      applyFilters();
    } catch (err) {
      log.error({ err }, 'Error marking as read');
    }
  }

  // CATEGORY NAVIGATION
  function navigateToCategory(category: DocumentCategory) {
    if (currentCategory === category) return;
    currentCategory = category;
    selectedConversationId = null;
    if (category === 'chat' && !chatFoldersLoaded) {
      void loadChatFolders();
    }
    if (category !== 'chat') {
      applyFilters();
    } else {
      // Switching to chat category - clear documents until conversation selected
      filteredDocuments = [];
    }
  }

  function backToFolders() {
    selectedConversationId = null;
    filteredDocuments = [];
  }

  // SEARCH HANDLING
  function handleSearchInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const query = input.value;
    if (searchDebounceTimer !== null) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      searchQuery = query;
      applyFilters();
    }, 150);
  }

  function clearSearch() {
    searchQuery = '';
    applyFilters();
  }

  function handleSortChange(option: SortOption) {
    sortOption = option;
    sortDropdownOpen = false;
    applyFilters();
  }

  function setViewMode(mode: ViewMode) {
    viewMode = mode;
    localStorage.setItem('documents-view-mode', mode);
  }

  function loadSavedViewMode() {
    const saved = localStorage.getItem('documents-view-mode');
    if (saved === 'list' || saved === 'grid') viewMode = saved;
  }

  // DOCUMENT ACTIONS
  function openPreview(doc: Document) {
    selectedDocument = doc;
    showPreviewModal = true;
    if (!doc.isRead) void markAsRead(doc.id);
  }

  function closePreview() {
    showPreviewModal = false;
    selectedDocument = null;
  }

  function downloadDocument(doc: Document) {
    // Cookie-based auth: accessToken cookie sent automatically on same-origin request
    // No token in URL = no token in logs/history
    const link = document.createElement('a');
    link.href = doc.downloadUrl;
    link.download = doc.filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleDownloadClick(doc: Document, e: MouseEvent) {
    e.stopPropagation();
    downloadDocument(doc);
  }

  function handleDeleteDocument(doc: Document, e: MouseEvent) {
    e.stopPropagation();
    if (!canDeleteDocument(doc, currentUser)) {
      showWarningAlert('Sie haben keine Berechtigung, dieses Dokument zu löschen');
      return;
    }
    deletingDocument = doc;
    showDeleteConfirmModal = true;
  }

  function closeDeleteConfirmModal() {
    showDeleteConfirmModal = false;
    deletingDocument = null;
  }

  async function confirmDeleteDocument() {
    if (!deletingDocument) return;
    deleteSubmitting = true;
    try {
      await apiDeleteDocument(deletingDocument.id);
      showSuccessAlert('Dokument erfolgreich gelöscht');
      closeDeleteConfirmModal();
      await invalidateAll();
      allDocuments = allDocuments.filter((d) => d.id !== deletingDocument?.id);
      applyFilters();
    } catch (err) {
      log.error({ err }, 'Delete failed');
      showErrorAlert(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
    } finally {
      deleteSubmitting = false;
    }
  }

  function openEditModal(doc: Document, e: MouseEvent) {
    e.stopPropagation();
    if (!canEditDocument(doc, currentUser)) {
      showWarningAlert('Sie haben keine Berechtigung, dieses Dokument zu bearbeiten');
      return;
    }
    editingDocument = doc;
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    editingDocument = null;
  }

  async function handleEditSubmit(data: EditData) {
    if (!editingDocument) return;
    if (!data.documentName.trim()) {
      showWarningAlert('Bitte geben Sie einen Dokumentnamen ein');
      return;
    }
    editSubmitting = true;
    try {
      await apiUpdateDocument(editingDocument.id, data);
      showSuccessAlert('Dokument erfolgreich aktualisiert');
      closeEditModal();
      await invalidateAll();
      await loadDocuments();
    } catch (err) {
      log.error({ err }, 'Update failed');
      showErrorAlert(err instanceof Error ? err.message : 'Aktualisieren fehlgeschlagen');
    } finally {
      editSubmitting = false;
    }
  }

  // UPLOAD HANDLING
  function openUploadModal() {
    showUploadModal = true;
    void loadCurrentUser();
  }

  function closeUploadModal() {
    showUploadModal = false;
  }

  /** Validated upload data with guaranteed non-null values */
  interface ValidatedUploadData {
    file: File;
    category: string;
    user: CurrentUser;
    requiresPayroll: boolean;
  }

  /** Validation result: either error info or validated data */
  type UploadValidationResult =
    | { valid: false; error: string; type: 'warning' | 'error' }
    | { valid: true; data: ValidatedUploadData };

  /** Validate upload data before submission */
  function validateUploadData(data: UploadData, user: CurrentUser | null): UploadValidationResult {
    if (data.file === null) {
      return { valid: false, error: MESSAGES.UPLOAD_NO_FILE, type: 'warning' };
    }
    if (data.category === '') {
      return { valid: false, error: MESSAGES.UPLOAD_NO_CATEGORY, type: 'warning' };
    }
    if (user === null) {
      return { valid: false, error: 'Benutzerdaten nicht geladen', type: 'error' };
    }

    const mapping = CATEGORY_MAPPINGS[data.category];
    const validation = validateUserForCategory(mapping, user);
    if (!validation.valid) {
      return { valid: false, error: validation.error ?? '', type: 'warning' };
    }
    if (
      mapping.requiresPayrollPeriod === true &&
      (data.salaryYear === 0 || data.salaryMonth === 0)
    ) {
      return { valid: false, error: MESSAGES.UPLOAD_SELECT_PAYROLL_PERIOD, type: 'warning' };
    }

    return {
      valid: true,
      data: {
        file: data.file,
        category: data.category,
        user,
        requiresPayroll: mapping.requiresPayrollPeriod === true,
      },
    };
  }

  async function handleUploadSubmit(data: UploadData) {
    const result = validateUploadData(data, currentUser);
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
      closeUploadModal();
      await invalidateAll();
      await loadDocuments();
    } catch (err) {
      log.error({ err }, 'Upload failed');
      showErrorAlert(err instanceof Error ? err.message : MESSAGES.ERROR_UPLOAD_FAILED);
    }
  }

  // OUTSIDE CLICK & KEYBOARD HANDLERS
  $effect(() => {
    if (sortDropdownOpen) {
      const handleOutsideClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const el = document.getElementById('sort-dropdown');
        if (el && !el.contains(target)) sortDropdownOpen = false;
      };
      document.addEventListener('click', handleOutsideClick);
      return () => {
        document.removeEventListener('click', handleOutsideClick);
      };
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (showDeleteConfirmModal) closeDeleteConfirmModal();
      else if (showEditModal) closeEditModal();
      else if (showUploadModal) closeUploadModal();
      else if (showPreviewModal) closePreview();
    }
  }

  // LIFECYCLE
  onMount(() => {
    // Load saved view mode preference (client-side only)
    loadSavedViewMode();
    // Note: Documents, chat folders, and current user are loaded via SSR
  });
</script>

<svelte:head>
  <title>{MESSAGES.PAGE_TITLE}</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="container">
  <div class="card">
    <!-- Card Header -->
    <div class="card__header">
      <div class="mb-4">
        <h2 class="card__title">
          <i class="fas fa-folder-open mr-2"></i>
          Dokumente Explorer
        </h2>
        <p class="text-[var(--color-text-secondary)] mt-2">Dokumente hochladen und verwalten</p>
      </div>

      <!-- Toolbar -->
      <div class="border-t border-[var(--border-color)] pt-4">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-3 flex-1">
            <div class="search-input flex-1 max-w-md">
              <i class="search-input__icon fas fa-search"></i>
              <input
                type="search"
                id="search-input"
                class="search-input__field"
                placeholder="Dokumente durchsuchen..."
                autocomplete="off"
                value={searchQuery}
                oninput={handleSearchInput}
              />
              <button
                type="button"
                class="search-input__clear"
                class:hidden={!searchQuery}
                onclick={clearSearch}
                aria-label="Suche löschen"
              >
                <i class="fas fa-times"></i>
              </button>
            </div>
            {#if showUploadButton}
              <button
                type="button"
                id="upload-btn"
                class="btn btn-upload"
                onclick={openUploadModal}
              >
                <i class="fas fa-upload mr-2"></i>
                Hochladen
              </button>
            {/if}
          </div>

          <div class="flex items-center gap-3">
            <div class="flex gap-1">
              <button
                type="button"
                class="action-icon"
                class:action-icon--active={viewMode === 'list'}
                aria-label="Listen-Ansicht"
                title="Listen-Ansicht"
                onclick={() => {
                  setViewMode('list');
                }}
              >
                <i class="fas fa-list"></i>
              </button>
              <button
                type="button"
                class="action-icon"
                class:action-icon--active={viewMode === 'grid'}
                aria-label="Grid-Ansicht"
                title="Grid-Ansicht"
                onclick={() => {
                  setViewMode('grid');
                }}
              >
                <i class="fas fa-th"></i>
              </button>
            </div>

            <div class="dropdown" id="sort-dropdown">
              <div
                class="dropdown__trigger gap-2"
                role="button"
                tabindex="0"
                onclick={(e) => {
                  e.stopPropagation();
                  sortDropdownOpen = !sortDropdownOpen;
                }}
                onkeydown={(e) => e.key === 'Enter' && (sortDropdownOpen = !sortDropdownOpen)}
              >
                <span>{currentSortLabel}</span>
                <i class="fas fa-chevron-down"></i>
              </div>
              <div class="dropdown__menu" class:active={sortDropdownOpen}>
                {#each SORT_OPTIONS as option (option.value)}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="dropdown__option"
                    onclick={() => {
                      handleSortChange(option.value);
                    }}
                  >
                    {option.label}
                  </div>
                {/each}
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Stats -->
        <div class="flex items-center gap-6 mt-4 text-sm">
          <div class="flex items-center gap-2">
            <svg
              class="w-5 h-5 text-primary-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0
                  01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              ></path>
            </svg>
            <span class="text-sm text-content-secondary">{stats.total} Dokumente</span>
          </div>
          {#if stats.unread > 0}
            <div class="flex items-center gap-2">
              <span class="text-sm text-warning-500">{stats.unread} Ungelesen</span>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Card Body -->
    <div class="card__body">
      <div class="flex h-[600px]">
        <!-- Sidebar -->
        <FolderSidebar
          {currentCategory}
          {categoryCounts}
          {chatFoldersTotalCount}
          onnavigate={navigateToCategory}
        />

        <!-- Content Area -->
        <div class="flex-1 flex flex-col">
          <div class="flex-1 overflow-y-auto p-2">
            {#if loading}
              <div class="flex items-center justify-center p-8">
                <div class="spinner-ring spinner-ring--md"></div>
              </div>
            {:else if error}
              <div class="flex items-center justify-center h-full">
                <div class="text-center">
                  <i class="fas fa-exclamation-triangle text-4xl text-error-500 mb-4"></i>
                  <p class="text-content-secondary mb-4">{error}</p>
                  <button type="button" class="btn btn-primary" onclick={() => loadDocuments()}
                    >{MESSAGES.BTN_RETRY}</button
                  >
                </div>
              </div>
            {:else if isViewingChatFolders}
              <div class:hidden={viewMode !== 'list'}>
                <ChatFoldersList folders={chatFolders} onfolderClick={loadChatAttachments} />
              </div>
            {:else}
              <div class:hidden={viewMode !== 'list'}>
                <DocumentListView
                  documents={filteredDocuments}
                  {currentUser}
                  {showActions}
                  showBackToFolders={selectedConversationId !== null}
                  onpreview={openPreview}
                  ondownload={handleDownloadClick}
                  onedit={openEditModal}
                  ondelete={handleDeleteDocument}
                  onbackToFolders={backToFolders}
                />
              </div>
              <div class:hidden={viewMode !== 'grid'}>
                <DocumentGridView
                  documents={filteredDocuments}
                  {currentUser}
                  {showActions}
                  onpreview={openPreview}
                  ondownload={handleDownloadClick}
                  onedit={openEditModal}
                  ondelete={handleDeleteDocument}
                />
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Modals -->
<PreviewModal
  show={showPreviewModal}
  document={selectedDocument}
  onclose={closePreview}
  ondownload={downloadDocument}
/>

<UploadModal show={showUploadModal} onclose={closeUploadModal} onsubmit={handleUploadSubmit} />

<EditModal
  show={showEditModal}
  document={editingDocument}
  submitting={editSubmitting}
  onclose={closeEditModal}
  onsubmit={handleEditSubmit}
/>

<DeleteConfirmModal
  show={showDeleteConfirmModal}
  document={deletingDocument}
  submitting={deleteSubmitting}
  onclose={closeDeleteConfirmModal}
  onconfirm={confirmDeleteDocument}
/>
