<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { showSuccessAlert, showErrorAlert, showWarningAlert } from '$lib/stores/toast.js';

  // Page-specific CSS
  import '../../../styles/documents-explorer.css';

  // Import from _lib/ modules
  import type {
    Document,
    DocumentCategory,
    ViewMode,
    SortOption,
    ChatFolder,
    CurrentUser,
  } from './_lib/types';
  import {
    FOLDER_DEFINITIONS,
    SORT_OPTIONS,
    SORT_LABELS,
    UPLOAD_CATEGORY_OPTIONS,
    CATEGORY_MAPPINGS,
    DB_CATEGORY_LABELS,
    MESSAGES,
    MIN_LIST_ROWS,
  } from './_lib/constants';
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
  import { applyAllFilters, calculateCategoryCounts, calculateStats } from './_lib/filters';
  import {
    formatDate,
    formatDateTime,
    formatRelativeDate,
    formatFileSize,
    getDisplayName,
    getFileType,
    getFileTypeDisplayInfo,
    isDocumentNew,
    truncateFilename,
    validateFile,
    validateUserForCategory,
    buildUploadFormData,
    canUpload,
    canSeeActions,
    canEditDocument,
    canDeleteDocument,
  } from './_lib/utils';

  // =============================================================================
  // SVELTE 5 RUNES - State
  // =============================================================================

  // Document Data
  let allDocuments = $state<Document[]>([]);
  let filteredDocuments = $state<Document[]>([]);

  // Chat Folders
  let chatFolders = $state<ChatFolder[]>([]);
  let chatFoldersLoaded = $state(false);
  let selectedConversationId = $state<number | null>(null);

  // User Info
  let currentUser = $state<CurrentUser | null>(null);
  let userRole = $state<string | null>(null);

  // Loading and Error States
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Filter State
  let currentCategory = $state<DocumentCategory>('all');
  let searchQuery = $state('');
  let sortOption = $state<SortOption>('newest');
  let viewMode = $state<ViewMode>('list');

  // Selected Document (for preview)
  let selectedDocument = $state<Document | null>(null);

  // Modal States
  let showPreviewModal = $state(false);
  let showUploadModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteConfirmModal = $state(false);

  // Delete Confirmation State
  let deletingDocument = $state<Document | null>(null);
  let deleteSubmitting = $state(false);

  // Edit Modal State
  let editingDocument = $state<Document | null>(null);
  let editDocName = $state('');
  let editCategory = $state('');
  let editTags = $state('');
  let editSubmitting = $state(false);
  let editCategoryDropdownOpen = $state(false);

  // Dropdown States
  let sortDropdownOpen = $state(false);
  let uploadCategoryDropdownOpen = $state(false);

  // Upload Form State
  let uploadFile = $state<File | null>(null);
  let uploadCategory = $state('');
  let uploadDocName = $state('');
  let uploadDescription = $state('');
  let uploadTags = $state('');
  let uploadSalaryYear = $state<number>(new Date().getFullYear());
  let uploadSalaryMonth = $state<number>(new Date().getMonth() + 1);
  let uploadSubmitting = $state(false);
  let uploadProgress = $state(0);

  // Search debounce timer
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  // Category counts for sidebar
  const categoryCounts = $derived(calculateCategoryCounts(allDocuments));

  // Document stats for quick stats
  const stats = $derived(calculateStats(filteredDocuments));

  // Chat folder total count
  const chatFoldersTotalCount = $derived(
    chatFolders.reduce((sum, f) => sum + f.attachmentCount, 0),
  );

  // Sort label for button
  const currentSortLabel = $derived(SORT_LABELS[sortOption]);

  // Show upload button
  const showUploadButton = $derived(canUpload(userRole));

  // Show action menu
  const showActions = $derived(canSeeActions(userRole));

  // Is viewing chat folders (not attachments)
  const isViewingChatFolders = $derived(
    currentCategory === 'chat' && selectedConversationId === null,
  );

  // Upload category requires payroll period
  const uploadRequiresPayrollPeriod = $derived(
    CATEGORY_MAPPINGS[uploadCategory]?.requiresPayrollPeriod === true,
  );

  // Placeholder rows needed for list view
  const placeholderRowCount = $derived(Math.max(0, MIN_LIST_ROWS - filteredDocuments.length));

  // =============================================================================
  // FILTER APPLICATION
  // =============================================================================

  function applyFilters() {
    filteredDocuments = applyAllFilters(allDocuments, currentCategory, searchQuery, sortOption);
  }

  // =============================================================================
  // API FUNCTIONS
  // =============================================================================

  async function loadDocuments() {
    loading = true;
    error = null;

    try {
      allDocuments = await apiFetchDocuments();
      applyFilters();
    } catch (err) {
      console.error('[DocumentsExplorer] Error loading documents:', err);
      if (isSessionExpiredError(err)) {
        goto('/login?session=expired');
        return;
      }
      error = err instanceof Error ? err.message : MESSAGES.ERROR_LOAD_FAILED;
    } finally {
      loading = false;
    }
  }

  async function loadChatFolders() {
    if (chatFoldersLoaded) return;

    try {
      chatFolders = await apiFetchChatFolders();
      chatFoldersLoaded = true;
    } catch (err) {
      console.error('[DocumentsExplorer] Error loading chat folders:', err);
      chatFoldersLoaded = true;
    }
  }

  async function loadChatAttachments(conversationId: number) {
    loading = true;
    selectedConversationId = conversationId;

    try {
      allDocuments = await apiFetchChatAttachments(conversationId);
      applyFilters();
    } catch (err) {
      console.error('[DocumentsExplorer] Error loading chat attachments:', err);
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
      // Update local state
      allDocuments = allDocuments.map((doc) =>
        doc.id === documentId ? { ...doc, isRead: true } : doc,
      );
      applyFilters();
    } catch (err) {
      console.error('[DocumentsExplorer] Error marking as read:', err);
    }
  }

  // =============================================================================
  // CATEGORY NAVIGATION
  // =============================================================================

  function navigateToCategory(category: DocumentCategory) {
    if (currentCategory === category) return;

    currentCategory = category;
    selectedConversationId = null;

    // For chat category, load folders if not loaded
    if (category === 'chat' && !chatFoldersLoaded) {
      loadChatFolders();
    }

    // Reset to all documents for this category (not chat attachments)
    if (category !== 'chat') {
      applyFilters();
    } else if (selectedConversationId === null) {
      // Show chat folders instead of documents
      filteredDocuments = [];
    }
  }

  function backToFolders() {
    selectedConversationId = null;
    filteredDocuments = [];
  }

  // =============================================================================
  // SEARCH HANDLING
  // =============================================================================

  function handleSearchInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const query = input.value;

    if (searchDebounceTimer !== null) {
      clearTimeout(searchDebounceTimer);
    }

    searchDebounceTimer = setTimeout(() => {
      searchQuery = query;
      applyFilters();
    }, 150);
  }

  function clearSearch() {
    searchQuery = '';
    applyFilters();
  }

  // =============================================================================
  // SORT HANDLING
  // =============================================================================

  function handleSortChange(option: SortOption) {
    sortOption = option;
    sortDropdownOpen = false;
    applyFilters();
  }

  // =============================================================================
  // VIEW MODE TOGGLE (with localStorage persistence)
  // =============================================================================

  function setViewMode(mode: ViewMode) {
    viewMode = mode;
    // Persist to localStorage
    localStorage.setItem('documents-view-mode', mode);
  }

  function loadSavedViewMode() {
    const saved = localStorage.getItem('documents-view-mode');
    if (saved === 'list' || saved === 'grid') {
      viewMode = saved;
    }
  }

  // =============================================================================
  // PREVIEW MODAL
  // =============================================================================

  function openPreview(doc: Document) {
    selectedDocument = doc;
    showPreviewModal = true;

    if (!doc.isRead) {
      markAsRead(doc.id);
    }
  }

  function closePreview() {
    showPreviewModal = false;
    selectedDocument = null;
  }

  function downloadDocument(doc: Document) {
    const token = localStorage.getItem('accessToken');
    const downloadUrl =
      token !== null ? `${doc.downloadUrl}?token=${encodeURIComponent(token)}` : doc.downloadUrl;

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = doc.filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleDeleteDocument(doc: Document, e: MouseEvent) {
    e.stopPropagation();

    // Permission check
    if (!canDeleteDocument(doc, currentUser)) {
      showWarningAlert('Sie haben keine Berechtigung, dieses Dokument zu löschen');
      return;
    }

    // Open confirmation modal instead of native confirm
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
      // Remove from local state
      allDocuments = allDocuments.filter((d) => d.id !== deletingDocument?.id);
      applyFilters();
      closeDeleteConfirmModal();
    } catch (err) {
      console.error('[DocumentsExplorer] Delete failed:', err);
      showErrorAlert(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
    } finally {
      deleteSubmitting = false;
    }
  }

  function handleDownloadClick(doc: Document, e: MouseEvent) {
    e.stopPropagation();
    downloadDocument(doc);
  }

  function handlePreviewClick(doc: Document, e: MouseEvent) {
    e.stopPropagation();
    openPreview(doc);
  }

  // =============================================================================
  // EDIT MODAL
  // =============================================================================

  function openEditModal(doc: Document, e: MouseEvent) {
    e.stopPropagation();

    // Permission check
    if (!canEditDocument(doc, currentUser)) {
      showWarningAlert('Sie haben keine Berechtigung, dieses Dokument zu bearbeiten');
      return;
    }

    editingDocument = doc;
    editDocName = doc.filename;
    editCategory = doc.category;
    editTags = doc.tags?.join(', ') ?? '';
    editCategoryDropdownOpen = false;
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    editingDocument = null;
    editDocName = '';
    editCategory = '';
    editTags = '';
    editCategoryDropdownOpen = false;
  }

  function selectEditCategory(category: string) {
    editCategory = category;
    editCategoryDropdownOpen = false;
  }

  async function handleEditSubmit() {
    if (!editingDocument) return;

    if (!editDocName.trim()) {
      showWarningAlert('Bitte geben Sie einen Dokumentnamen ein');
      return;
    }

    editSubmitting = true;

    try {
      // Parse tags from comma-separated string
      const parsedTags = editTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      await apiUpdateDocument(editingDocument.id, {
        documentName: editDocName.trim(),
        category: editCategory,
        tags: parsedTags,
      });

      showSuccessAlert('Dokument erfolgreich aktualisiert');
      closeEditModal();
      await loadDocuments();
    } catch (err) {
      console.error('[DocumentsExplorer] Update failed:', err);
      showErrorAlert(err instanceof Error ? err.message : 'Aktualisieren fehlgeschlagen');
    } finally {
      editSubmitting = false;
    }
  }

  // =============================================================================
  // UPLOAD MODAL
  // =============================================================================

  function openUploadModal() {
    showUploadModal = true;
    loadCurrentUser();
  }

  function closeUploadModal() {
    showUploadModal = false;
    resetUploadForm();
  }

  function resetUploadForm() {
    uploadFile = null;
    uploadCategory = '';
    uploadDocName = '';
    uploadDescription = '';
    uploadTags = '';
    uploadSalaryYear = new Date().getFullYear();
    uploadSalaryMonth = new Date().getMonth() + 1;
    uploadProgress = 0;
    uploadCategoryDropdownOpen = false;
  }

  function handleFileDrop(e: DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
  }

  function handleFileInputChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
  }

  function handleFileSelected(file: File) {
    const validation = validateFile(file);
    if (!validation.valid) {
      showWarningAlert(validation.error ?? MESSAGES.UPLOAD_INVALID_TYPE);
      return;
    }

    uploadFile = file;

    // Auto-fill document name if empty
    if (!uploadDocName) {
      uploadDocName = file.name.replace(/\.[^/.]+$/, '');
    }
  }

  function clearFileSelection() {
    uploadFile = null;
  }

  function selectUploadCategory(category: string) {
    uploadCategory = category;
    uploadCategoryDropdownOpen = false;
  }

  async function handleUploadSubmit() {
    if (!uploadFile) {
      showWarningAlert(MESSAGES.UPLOAD_NO_FILE);
      return;
    }

    if (!uploadCategory) {
      showWarningAlert(MESSAGES.UPLOAD_NO_CATEGORY);
      return;
    }

    if (!currentUser) {
      showErrorAlert('Benutzerdaten nicht geladen');
      return;
    }

    // Validate category requirements
    const mapping = CATEGORY_MAPPINGS[uploadCategory];
    if (mapping) {
      const validation = validateUserForCategory(mapping, currentUser);
      if (!validation.valid) {
        showWarningAlert(validation.error ?? '');
        return;
      }

      if (mapping.requiresPayrollPeriod === true && (!uploadSalaryYear || !uploadSalaryMonth)) {
        showWarningAlert(MESSAGES.UPLOAD_SELECT_PAYROLL_PERIOD);
        return;
      }
    }

    // Build form data
    const formData = buildUploadFormData(
      uploadFile,
      uploadCategory,
      currentUser,
      uploadDocName,
      uploadDescription,
      uploadTags,
      uploadRequiresPayrollPeriod ? uploadSalaryYear : undefined,
      uploadRequiresPayrollPeriod ? uploadSalaryMonth : undefined,
    );

    if (!formData) {
      showErrorAlert('Ungültige Kategorie');
      return;
    }

    uploadSubmitting = true;

    try {
      await apiUploadDocument(formData, (progress) => {
        uploadProgress = progress;
      });

      showSuccessAlert(MESSAGES.UPLOAD_SUCCESS);
      closeUploadModal();
      await loadDocuments();
    } catch (err) {
      console.error('[DocumentsExplorer] Upload failed:', err);
      showErrorAlert(err instanceof Error ? err.message : MESSAGES.ERROR_UPLOAD_FAILED);
    } finally {
      uploadSubmitting = false;
    }
  }

  // =============================================================================
  // OUTSIDE CLICK HANDLERS
  // =============================================================================

  $effect(() => {
    if (sortDropdownOpen || uploadCategoryDropdownOpen || editCategoryDropdownOpen) {
      const handleOutsideClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;

        if (sortDropdownOpen) {
          const el = document.getElementById('sort-dropdown');
          if (el && !el.contains(target)) sortDropdownOpen = false;
        }

        if (uploadCategoryDropdownOpen) {
          const el = document.getElementById('upload-category-dropdown');
          if (el && !el.contains(target)) uploadCategoryDropdownOpen = false;
        }

        if (editCategoryDropdownOpen) {
          const el = document.getElementById('edit-category-dropdown');
          if (el && !el.contains(target)) editCategoryDropdownOpen = false;
        }
      };

      document.addEventListener('click', handleOutsideClick);
      return () => document.removeEventListener('click', handleOutsideClick);
    }
  });

  // =============================================================================
  // KEYBOARD HANDLERS
  // =============================================================================

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (showDeleteConfirmModal) closeDeleteConfirmModal();
      else if (showEditModal) closeEditModal();
      else if (showUploadModal) closeUploadModal();
      else if (showPreviewModal) closePreview();
    }
  }

  // =============================================================================
  // LIFECYCLE
  // =============================================================================

  onMount(() => {
    const token = localStorage.getItem('accessToken');
    const role = localStorage.getItem('userRole');

    if (!token) {
      goto('/login');
      return;
    }

    userRole = role;

    // Load saved view mode preference
    loadSavedViewMode();

    // Load current user for permission checks
    loadCurrentUser();

    loadDocuments();
    loadChatFolders();
  });
</script>

<svelte:head>
  <title>{MESSAGES.PAGE_TITLE}</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<!-- 1:1 Legacy Structure: container > card > card__header + card__body -->
<div class="container">
  <div class="card">
    <!-- Card Header -->
    <div class="card__header">
      <!-- Title Section -->
      <div class="mb-4">
        <h2 class="card__title">
          <i class="fas fa-folder-open mr-2"></i>
          Dokumente Explorer
        </h2>
        <p class="text-[var(--color-text-secondary)] mt-2">Dokumente hochladen und verwalten</p>
      </div>

      <!-- Toolbar Section -->
      <div class="border-t border-[var(--border-color)] pt-4">
        <div class="flex items-center justify-between gap-4">
          <!-- Left: Search -->
          <div class="flex items-center gap-3 flex-1">
            <!-- Search Input -->
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
                class="search-input__clear"
                id="search-clear"
                class:hidden={!searchQuery}
                onclick={clearSearch}
                aria-label="Suche löschen"
              >
                <i class="fas fa-times"></i>
              </button>
            </div>

            <!-- Upload Button (Admin/Root only) -->
            {#if showUploadButton}
              <button id="upload-btn" class="btn btn-upload" onclick={openUploadModal}>
                <i class="fas fa-upload mr-2"></i>
                Hochladen
              </button>
            {/if}
          </div>

          <!-- Right: View Toggle & Sort -->
          <div class="flex items-center gap-3">
            <!-- View Toggle -->
            <div class="flex gap-1">
              <button
                id="view-list-btn"
                class="action-icon"
                class:action-icon--active={viewMode === 'list'}
                data-view="list"
                aria-label="Listen-Ansicht"
                title="Listen-Ansicht"
                onclick={() => setViewMode('list')}
              >
                <i class="fas fa-list"></i>
              </button>
              <button
                id="view-grid-btn"
                class="action-icon"
                class:action-icon--active={viewMode === 'grid'}
                data-view="grid"
                aria-label="Grid-Ansicht"
                title="Grid-Ansicht"
                onclick={() => setViewMode('grid')}
              >
                <i class="fas fa-th"></i>
              </button>
            </div>

            <!-- Sort Dropdown -->
            <div class="dropdown" id="sort-dropdown">
              <div
                id="sort-btn"
                class="dropdown__trigger gap-2"
                role="button"
                tabindex="0"
                onclick={(e) => {
                  e.stopPropagation();
                  sortDropdownOpen = !sortDropdownOpen;
                }}
                onkeydown={(e) => e.key === 'Enter' && (sortDropdownOpen = !sortDropdownOpen)}
              >
                <span id="sort-label">{currentSortLabel}</span>
                <i class="fas fa-chevron-down"></i>
              </div>
              <div id="sort-menu" class="dropdown__menu" class:active={sortDropdownOpen}>
                {#each SORT_OPTIONS as option (option.value)}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="dropdown__option"
                    data-sort={option.value}
                    onclick={() => handleSortChange(option.value)}
                  >
                    {option.label}
                  </div>
                {/each}
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Stats - populated by JavaScript (toolbar.ts) -->
        <div id="quick-stats" class="flex items-center gap-6 mt-4 text-sm">
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
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
        <!-- Left Sidebar: Folder Navigation -->
        <div class="w-64 bg-[var(--background-secondary)] border-r border-[var(--border-color)]">
          <!-- Folder Tree - populated by JavaScript (sidebar.ts) -->
          <nav id="folder-tree" class="p-2">
            <ul class="space-y-1">
              {#each FOLDER_DEFINITIONS as folder (folder.category)}
                {@const count =
                  folder.category === 'chat'
                    ? chatFoldersTotalCount
                    : (categoryCounts[folder.category] ?? 0)}
                {@const isActive = folder.category === currentCategory}
                <li>
                  <button
                    class="folder-item w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-left {isActive
                      ? 'bg-surface-3 text-primary-500'
                      : 'text-content-primary hover:bg-surface-3'}"
                    data-category={folder.category}
                    onclick={() => navigateToCategory(folder.category)}
                  >
                    <span class={isActive ? 'text-primary-500' : 'text-content-secondary'}>
                      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                      {@html folder.icon}
                    </span>
                    <span class="text-sm {isActive ? 'font-medium' : ''}">{folder.label}</span>
                    <span class="ml-auto text-xs text-content-tertiary">{count}</span>
                  </button>
                </li>
              {/each}
            </ul>
          </nav>
        </div>

        <!-- Right Content Area -->
        <div class="flex-1 flex flex-col">
          <!-- Documents Grid/List Container -->
          <div class="flex-1 overflow-y-auto p-2">
            {#if loading}
              <div id="loading-state" class="flex items-center justify-center p-8">
                <div class="spinner-ring spinner-ring--md"></div>
              </div>
            {:else if error}
              <div id="error-state" class="flex items-center justify-center h-full">
                <div class="text-center">
                  <i class="fas fa-exclamation-triangle text-4xl text-error-500 mb-4"></i>
                  <p class="text-content-secondary mb-4">{error}</p>
                  <button class="btn btn-primary" onclick={() => loadDocuments()}>
                    {MESSAGES.BTN_RETRY}
                  </button>
                </div>
              </div>
            {:else if isViewingChatFolders}
              <!-- Chat Folders View (1:1 Legacy structure) -->
              <div id="list-view" class:hidden={viewMode !== 'list'}>
                <div class="overflow-x-auto">
                  <table
                    class="data-table data-table--striped data-table--hover data-table--bordered"
                  >
                    <thead>
                      <tr>
                        <th>{MESSAGES.TH_NAME}</th>
                        <th>Typ</th>
                        <th>{MESSAGES.TH_SIZE}</th>
                        <th>{MESSAGES.TH_DATE}</th>
                        <th>{MESSAGES.TH_ACTIONS}</th>
                      </tr>
                    </thead>
                    <tbody id="list-rows">
                      {#each chatFolders as folder (folder.conversationId)}
                        {@const displayName = folder.isGroup
                          ? (folder.groupName ?? 'Gruppenname')
                          : folder.participantName}
                        {@const icon = folder.isGroup
                          ? '<i class="fas fa-users" style="font-size: 16px; color: var(--color-content-secondary); margin-left: 4px;"></i>'
                          : '<i class="fas fa-user" style="font-size: 16px; color: var(--color-content-secondary); margin-left: 4px;"></i>'}
                        <tr
                          class="chat-folder-row cursor-pointer hover:bg-surface-2"
                          onclick={() => loadChatAttachments(folder.conversationId)}
                        >
                          <td>
                            <div class="flex items-center gap-3">
                              <svg
                                class="w-6 h-6 text-amber-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                                ></path>
                              </svg>
                              <div class="flex items-center gap-2 min-w-0">
                                <span class="font-medium" title={displayName}>{displayName}</span>
                                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                {@html icon}
                              </div>
                            </div>
                          </td>
                          <td>{MESSAGES.CHAT_CONVERSATION}</td>
                          <td>{folder.attachmentCount} {MESSAGES.CHAT_FILES_COUNT}</td>
                          <td>-</td>
                          <td></td>
                        </tr>
                      {/each}

                      {#if chatFolders.length === 0}
                        <tr>
                          <td colspan="5" class="text-center">
                            {MESSAGES.EMPTY_DESCRIPTION}
                          </td>
                        </tr>
                      {/if}
                    </tbody>
                  </table>
                </div>
              </div>
            {:else if filteredDocuments.length === 0}
              <div id="empty-state" class="flex items-center justify-center h-full">
                <div class="text-center">
                  <i class="fas fa-folder-open text-4xl text-content-tertiary mb-4"></i>
                  <h3 class="text-lg font-medium text-content-primary mb-2">
                    {MESSAGES.EMPTY_TITLE}
                  </h3>
                  <p class="text-content-secondary">{MESSAGES.EMPTY_DESCRIPTION}</p>
                </div>
              </div>
            {:else}
              <!-- List View -->
              <div id="list-view" class:hidden={viewMode !== 'list'}>
                <div class="overflow-x-auto">
                  <table
                    class="data-table data-table--striped data-table--hover data-table--bordered"
                  >
                    <thead>
                      <tr>
                        <th>{MESSAGES.TH_NAME}</th>
                        <th>{MESSAGES.TH_CATEGORY}</th>
                        <th>{MESSAGES.TH_TAGS}</th>
                        <th>{MESSAGES.TH_SIZE}</th>
                        <th>{MESSAGES.TH_DATE}</th>
                        <th>{MESSAGES.TH_ACTIONS}</th>
                      </tr>
                    </thead>
                    <tbody id="list-rows">
                      {#if selectedConversationId !== null}
                        <!-- Back to folders row -->
                        <tr class="back-to-folders-row cursor-pointer" onclick={backToFolders}>
                          <td>
                            <div class="flex items-center gap-3">
                              <i
                                class="fas fa-level-up-alt"
                                style="font-size: 24px; color: var(--color-content-secondary);"
                              ></i>
                              <span class="font-medium text-content-secondary">..</span>
                            </div>
                          </td>
                          <td class="text-content-tertiary">Übergeordneter Ordner</td>
                          <td></td>
                          <td></td>
                          <td></td>
                          <td></td>
                        </tr>
                      {/if}

                      {#each filteredDocuments as doc (doc.id)}
                        {@const isNew = isDocumentNew(doc)}
                        <tr
                          class="document-row cursor-pointer"
                          data-document-id={doc.id}
                          data-read={doc.isRead}
                          onclick={() => openPreview(doc)}
                        >
                          <td>
                            <div class="flex items-center gap-3">
                              <i
                                class="fas fa-file-alt flex-shrink-0"
                                style="font-size: 24px; color: var(--color-icon-primary);"
                              ></i>
                              <div class="flex items-center gap-2 min-w-0">
                                <span
                                  class={!doc.isRead ? 'font-semibold' : ''}
                                  title={getDisplayName(doc)}
                                >
                                  {getDisplayName(doc)}
                                </span>
                                {#if isNew}
                                  <span
                                    class="badge badge--success"
                                    style="font-size: 11px; padding: 2px 8px;">Neu</span
                                  >
                                {/if}
                                {#if !doc.isRead}
                                  <span
                                    class="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0"
                                    title="Ungelesen"
                                  ></span>
                                {/if}
                              </div>
                            </div>
                          </td>
                          <td>{DB_CATEGORY_LABELS[doc.category] ?? doc.category}</td>
                          <td>
                            {#if doc.tags && doc.tags.length > 0}
                              <div class="flex flex-wrap gap-1">
                                {#each doc.tags.slice(0, 3) as tag (tag)}
                                  <span class="badge badge--info" style="padding: 2px 6px;"
                                    >{tag}</span
                                  >
                                {/each}
                                {#if doc.tags.length > 3}
                                  <span class="text-xs text-content-tertiary"
                                    >+{doc.tags.length - 3}</span
                                  >
                                {/if}
                              </div>
                            {:else}
                              <span class="text-content-tertiary">-</span>
                            {/if}
                          </td>
                          <td>{formatFileSize(doc.size)}</td>
                          <td>{formatDate(doc.uploadedAt)}</td>
                          <td>
                            {#if showActions}
                              <div class="flex items-center gap-1">
                                <!-- Preview: always visible -->
                                <button
                                  class="action-icon action-icon--info"
                                  title="Vorschau"
                                  aria-label="Vorschau anzeigen"
                                  onclick={(e) => handlePreviewClick(doc, e)}
                                >
                                  <i class="fas fa-eye"></i>
                                </button>
                                <!-- Download: always visible -->
                                <button
                                  class="action-icon action-icon--info"
                                  title="Herunterladen"
                                  aria-label="Dokument herunterladen"
                                  onclick={(e) => handleDownloadClick(doc, e)}
                                >
                                  <i class="fas fa-download"></i>
                                </button>
                                <!-- Edit: only if user has permission -->
                                {#if canEditDocument(doc, currentUser)}
                                  <button
                                    class="action-icon action-icon--edit"
                                    title="Bearbeiten"
                                    aria-label="Dokument bearbeiten"
                                    onclick={(e) => openEditModal(doc, e)}
                                  >
                                    <i class="fas fa-edit"></i>
                                  </button>
                                {/if}
                                <!-- Delete: only if user has permission -->
                                {#if canDeleteDocument(doc, currentUser)}
                                  <button
                                    class="action-icon action-icon--delete"
                                    title="Löschen"
                                    aria-label="Dokument löschen"
                                    onclick={(e) => handleDeleteDocument(doc, e)}
                                  >
                                    <i class="fas fa-trash"></i>
                                  </button>
                                {/if}
                              </div>
                            {/if}
                          </td>
                        </tr>
                      {/each}

                      <!-- Placeholder rows (20 minimum for striped appearance) -->
                      {#each Array(placeholderRowCount) as _, i (i)}
                        <tr class="placeholder-row">
                          <td>&nbsp;</td>
                          <td>&nbsp;</td>
                          <td>&nbsp;</td>
                          <td>&nbsp;</td>
                          <td>&nbsp;</td>
                          <td>&nbsp;</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Grid View -->
              <div
                id="grid-view"
                class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                class:hidden={viewMode !== 'grid'}
              >
                {#each filteredDocuments as doc (doc.id)}
                  {@const isNew = isDocumentNew(doc)}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="document-card bg-surface-2 border border-border-subtle rounded-lg p-4 hover:shadow-lg cursor-pointer transition-all duration-200"
                    data-document-id={doc.id}
                    onclick={() => openPreview(doc)}
                  >
                    <div class="flex items-start justify-between mb-4">
                      <div class="flex items-center gap-3">
                        <i class="fas fa-file-alt text-primary-500 text-3xl"></i>
                        <div class="flex flex-col gap-1">
                          {#if isNew}
                            <span
                              class="px-2 py-0.5 bg-success-100 text-success-700 text-xs font-medium rounded"
                              >Neu</span
                            >
                          {/if}
                          {#if !doc.isRead}
                            <span
                              class="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded"
                              >Ungelesen</span
                            >
                          {/if}
                        </div>
                      </div>
                      {#if showActions}
                        <div class="flex items-center gap-1">
                          <!-- Preview: always visible -->
                          <button
                            class="action-icon action-icon--info"
                            title="Vorschau"
                            aria-label="Vorschau anzeigen"
                            onclick={(e) => handlePreviewClick(doc, e)}
                          >
                            <i class="fas fa-eye"></i>
                          </button>
                          <!-- Download: always visible -->
                          <button
                            class="action-icon action-icon--info"
                            title="Herunterladen"
                            aria-label="Dokument herunterladen"
                            onclick={(e) => handleDownloadClick(doc, e)}
                          >
                            <i class="fas fa-download"></i>
                          </button>
                          <!-- Edit: only if user has permission -->
                          {#if canEditDocument(doc, currentUser)}
                            <button
                              class="action-icon action-icon--edit"
                              title="Bearbeiten"
                              aria-label="Dokument bearbeiten"
                              onclick={(e) => openEditModal(doc, e)}
                            >
                              <i class="fas fa-edit"></i>
                            </button>
                          {/if}
                          <!-- Delete: only if user has permission -->
                          {#if canDeleteDocument(doc, currentUser)}
                            <button
                              class="action-icon action-icon--delete"
                              title="Löschen"
                              aria-label="Dokument löschen"
                              onclick={(e) => handleDeleteDocument(doc, e)}
                            >
                              <i class="fas fa-trash"></i>
                            </button>
                          {/if}
                        </div>
                      {/if}
                    </div>
                    <div class="mb-4">
                      <h3
                        class="text-sm font-medium text-content-primary truncate mb-1 {!doc.isRead
                          ? 'font-semibold'
                          : ''}"
                        title={getDisplayName(doc)}
                      >
                        {truncateFilename(getDisplayName(doc), 30)}
                      </h3>
                      <p class="text-xs text-content-secondary">{doc.category}</p>
                    </div>
                    <div class="flex items-center justify-between text-xs text-content-tertiary">
                      <span>{formatFileSize(doc.size)}</span>
                      <span>{formatRelativeDate(doc.uploadedAt)}</span>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
          <!-- End of overflow-y-auto p-2 -->
        </div>
        <!-- End of flex flex-1 flex-col -->
      </div>
      <!-- End of flex h-[600px] -->
    </div>
    <!-- End of card__body -->
  </div>
  <!-- End of card -->
</div>
<!-- End of container -->

<!-- Preview Modal -->
{#if showPreviewModal && selectedDocument}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    id="preview-modal"
    class="modal-overlay modal-overlay--active"
    onclick={(e) => e.target === e.currentTarget && closePreview()}
  >
    <div class="ds-modal ds-modal--xl" onclick={(e) => e.stopPropagation()}>
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          <i class="fas fa-file-pdf mr-2 text-error-500"></i>
          <span id="preview-title">{selectedDocument.filename}</span>
        </h3>
        <button
          class="ds-modal__close"
          id="preview-close"
          onclick={closePreview}
          aria-label="Schließen"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body p-0">
        <!-- PDF Viewer iframe - Full width/height for optimal viewing -->
        {#if getFileType(selectedDocument) === 'pdf'}
          {@const token = localStorage.getItem('accessToken')}
          {@const previewUrl =
            token !== null
              ? `${selectedDocument.previewUrl ?? selectedDocument.downloadUrl}?token=${encodeURIComponent(token)}`
              : (selectedDocument.previewUrl ?? selectedDocument.downloadUrl)}
          <iframe
            id="preview-iframe"
            src={previewUrl}
            class="block w-full h-[70vh] min-h-[600px] border-none"
            title="Dokumentenvorschau"
          ></iframe>
        {:else if getFileType(selectedDocument) === 'image'}
          <!-- Image Viewer - For JPG/PNG files -->
          {@const token = localStorage.getItem('accessToken')}
          {@const previewUrl =
            token !== null
              ? `${selectedDocument.previewUrl ?? selectedDocument.downloadUrl}?token=${encodeURIComponent(token)}`
              : (selectedDocument.previewUrl ?? selectedDocument.downloadUrl)}
          <div
            id="preview-image-container"
            class="h-[70vh] min-h-[600px] w-full flex items-center justify-center bg-surface-1"
          >
            <img
              id="preview-image"
              src={previewUrl}
              alt={selectedDocument.filename}
              class="max-w-full max-h-full object-contain block"
            />
          </div>
        {:else}
          <!-- No Preview Message - For DOCX/XLSX files -->
          <div
            id="preview-no-preview"
            class="h-[70vh] min-h-[600px] w-full flex items-center justify-center bg-surface-1"
          >
            <div class="text-center text-content-secondary">
              <i class="fas fa-file-alt text-6xl mb-4"></i>
              <p class="text-lg">{MESSAGES.PREVIEW_NO_PREVIEW}</p>
              <p class="text-sm mt-2">{MESSAGES.PREVIEW_NO_PREVIEW_DESC}</p>
            </div>
          </div>
        {/if}

        <!-- Document Metadata Footer (inside modal body, below iframe) -->
        <div class="p-4 bg-surface-2 border-t border-border-subtle">
          <div class="flex items-center gap-6 text-sm text-content-secondary">
            <span id="preview-size" class="flex items-center gap-2">
              <i class="fas fa-file-archive"></i>
              <span>{formatFileSize(selectedDocument.size)}</span>
            </span>
            <span id="preview-date" class="flex items-center gap-2">
              <i class="fas fa-calendar-alt"></i>
              <span>{formatDateTime(selectedDocument.uploadedAt)}</span>
            </span>
            <span id="preview-uploader" class="flex items-center gap-2">
              <i class="fas fa-user"></i>
              <span>{selectedDocument.uploaderName}</span>
            </span>
          </div>
        </div>
      </div>
      <div class="ds-modal__footer">
        <button class="btn btn-cancel" id="preview-cancel" onclick={closePreview}>
          <i class="fas fa-times mr-2"></i>
          {MESSAGES.PREVIEW_CLOSE}
        </button>
        <button
          class="btn btn-modal"
          id="preview-download"
          onclick={() => selectedDocument && downloadDocument(selectedDocument)}
        >
          <i class="fas fa-download mr-2"></i>
          {MESSAGES.PREVIEW_DOWNLOAD}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Upload Modal -->
{#if showUploadModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    id="upload-modal"
    class="modal-overlay modal-overlay--active"
    onclick={(e) => e.target === e.currentTarget && closeUploadModal()}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <form
      id="upload-form"
      class="ds-modal ds-modal--lg"
      onclick={(e) => e.stopPropagation()}
      onsubmit={(e) => {
        e.preventDefault();
        handleUploadSubmit();
      }}
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">{MESSAGES.UPLOAD_TITLE}</h3>
        <button
          type="button"
          class="ds-modal__close"
          id="upload-close"
          onclick={closeUploadModal}
          aria-label="Schließen"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body">
        <div id="upload-form-container">
          <!-- Upload Area / Drag & Drop Zone -->
          <div
            id="upload-dropzone"
            class="file-upload-zone"
            role="button"
            tabindex="0"
            ondragover={(e) => e.preventDefault()}
            ondrop={handleFileDrop}
            onclick={() => document.getElementById('file-input')?.click()}
            onkeydown={(e) => e.key === 'Enter' && document.getElementById('file-input')?.click()}
          >
            <input
              type="file"
              class="file-upload-zone__input"
              id="file-input"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png"
              onchange={handleFileInputChange}
            />
            <label for="file-input" class="file-upload-zone__label">
              <div class="file-upload-zone__icon">
                <i class="fas fa-cloud-upload-alt"></i>
              </div>
              <div class="file-upload-zone__text">
                <p class="file-upload-zone__title">Datei hier ablegen oder klicken zum Auswählen</p>
                <p class="file-upload-zone__subtitle">PDF, Word, Excel, JPG, PNG</p>
              </div>
            </label>
            <p class="file-upload-zone__helper">
              Erlaubt: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG • Max. 10 MB
            </p>
          </div>

          <!-- Selected File Display (Design System: file-upload-list) -->
          {#if uploadFile}
            {@const extension = uploadFile.name.split('.').pop()?.toLowerCase() ?? ''}
            {@const displayInfo = getFileTypeDisplayInfo(uploadFile.type, extension)}
            <div id="selected-file" class="file-upload-list file-upload-list--compact">
              <div class="file-upload-item">
                <div id="file-preview" class="file-upload-item__preview {displayInfo.cssClass}">
                  <i id="file-icon" class={displayInfo.iconClass}></i>
                </div>
                <div class="file-upload-item__info">
                  <div id="file-name" class="file-upload-item__name">{uploadFile.name}</div>
                  <div id="file-size" class="file-upload-item__meta">
                    {formatFileSize(uploadFile.size)}
                  </div>
                </div>
                <button
                  type="button"
                  id="remove-file"
                  class="file-upload-item__remove"
                  aria-label="Datei entfernen"
                  onclick={clearFileSelection}
                >
                  <i class="fas fa-times"></i>
                </button>
              </div>
            </div>
          {/if}

          <!-- Upload Progress -->
          {#if uploadSubmitting}
            <div
              id="upload-progress"
              class="p-4 bg-[var(--background-secondary)] rounded-lg border border-[var(--color-border)]"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="text-[var(--color-text-primary)] text-sm">Hochladen...</span>
                <span id="progress-text" class="text-[var(--color-text-secondary)] text-sm"
                  >{uploadProgress}%</span
                >
              </div>
              <div class="progress h-2">
                <div id="progress-bar" class="progress__bar" style="width: {uploadProgress}%"></div>
              </div>
            </div>
          {/if}

          <!-- Category Selection - Custom Dropdown -->
          <div class="form-field">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="form-field__label form-field__label--required">Kategorie</label>
            <div class="dropdown w-full" id="upload-category-dropdown">
              <button
                type="button"
                id="category-dropdown"
                class="dropdown__trigger w-full gap-2"
                onclick={(e) => {
                  e.stopPropagation();
                  uploadCategoryDropdownOpen = !uploadCategoryDropdownOpen;
                }}
              >
                <span class="flex items-center gap-2">
                  <i class="fas fa-folder"></i>
                  <span id="category-text">
                    {#if uploadCategory}
                      {UPLOAD_CATEGORY_OPTIONS.find((o) => o.value === uploadCategory)?.label ??
                        MESSAGES.UPLOAD_CATEGORY_PLACEHOLDER}
                    {:else}
                      {MESSAGES.UPLOAD_CATEGORY_PLACEHOLDER}
                    {/if}
                  </span>
                </span>
                <i class="fas fa-chevron-down"></i>
              </button>
              <div class="dropdown__menu" class:active={uploadCategoryDropdownOpen}>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="dropdown__option"
                  data-value="company"
                  onclick={() => selectUploadCategory('company')}
                >
                  <i class="fas fa-briefcase"></i>
                  Firma (alle sehen)
                </div>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="dropdown__option"
                  data-value="department"
                  onclick={() => selectUploadCategory('department')}
                >
                  <i class="fas fa-building"></i>
                  Abteilung (nur meine Abteilung)
                </div>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="dropdown__option"
                  data-value="team"
                  onclick={() => selectUploadCategory('team')}
                >
                  <i class="fas fa-users"></i>
                  Team (nur mein Team)
                </div>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="dropdown__option"
                  data-value="personal"
                  onclick={() => selectUploadCategory('personal')}
                >
                  <i class="fas fa-user"></i>
                  Persönlich (nur ich)
                </div>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="dropdown__option"
                  data-value="payroll"
                  onclick={() => selectUploadCategory('payroll')}
                >
                  <i class="fas fa-money-bill-wave"></i>
                  Gehaltsabrechnung (nur ich)
                </div>
              </div>
            </div>
            <input
              type="hidden"
              id="category-input"
              name="category"
              value={uploadCategory}
              required
            />
          </div>

          <!-- Document Name -->
          <div class="form-field">
            <label class="form-field__label form-field__label--required" for="doc-name"
              >Dokumentname</label
            >
            <input
              type="text"
              id="doc-name"
              name="name"
              class="form-field__control"
              placeholder="z.B. Arbeitsvertrag 2025"
              bind:value={uploadDocName}
              required
            />
            <small class="form-field__message">Der Name wird in der Dokumentenliste angezeigt</small
            >
          </div>

          <!-- Description -->
          <div class="form-field">
            <label class="form-field__label" for="doc-description">Beschreibung</label>
            <textarea
              id="doc-description"
              name="description"
              class="form-field__control"
              rows="3"
              placeholder="Optionale Beschreibung des Dokuments..."
              bind:value={uploadDescription}
            ></textarea>
          </div>

          <!-- Payroll Extra Fields (hidden by default, shown when payroll selected) -->
          {#if uploadRequiresPayrollPeriod}
            <div class="form-field" id="payroll-fields">
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <label class="form-field__label form-field__label--required"
                >Zeitraum für Gehaltsabrechnung</label
              >
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="form-field__label text-sm" for="salary-year">Jahr</label>
                  <select
                    id="salary-year"
                    name="salary_year"
                    class="form-field__control"
                    bind:value={uploadSalaryYear}
                  >
                    {#each Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i) as year (year)}
                      <option value={year}>{year}</option>
                    {/each}
                  </select>
                </div>
                <div>
                  <label class="form-field__label text-sm" for="salary-month">Monat</label>
                  <select
                    id="salary-month"
                    name="salary_month"
                    class="form-field__control"
                    bind:value={uploadSalaryMonth}
                  >
                    <option value={1}>Januar</option>
                    <option value={2}>Februar</option>
                    <option value={3}>März</option>
                    <option value={4}>April</option>
                    <option value={5}>Mai</option>
                    <option value={6}>Juni</option>
                    <option value={7}>Juli</option>
                    <option value={8}>August</option>
                    <option value={9}>September</option>
                    <option value={10}>Oktober</option>
                    <option value={11}>November</option>
                    <option value={12}>Dezember</option>
                  </select>
                </div>
              </div>
              <small class="form-field__message">Wird nur für Gehaltsabrechnungen benötigt</small>
            </div>
          {/if}

          <!-- Tags -->
          <div class="form-field">
            <label class="form-field__label" for="doc-tags">Tags</label>
            <input
              type="text"
              id="doc-tags"
              name="tags"
              class="form-field__control"
              placeholder="z.B. vertrag, 2025, personal (kommagetrennt)"
              bind:value={uploadTags}
            />
            <small class="form-field__message">Tags helfen beim späteren Suchen und Filtern</small>
          </div>
        </div>
      </div>
      <div class="ds-modal__footer">
        <button type="button" class="btn btn-cancel" id="upload-cancel" onclick={closeUploadModal}
          >{MESSAGES.UPLOAD_CANCEL}</button
        >
        <button type="submit" class="btn btn-modal" id="upload-submit" disabled={uploadSubmitting}>
          <i class="fas fa-cloud-upload-alt mr-2"></i>
          Hochladen
        </button>
      </div>
    </form>
  </div>
{/if}

<!-- Edit Modal -->
{#if showEditModal && editingDocument}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    id="edit-modal"
    class="modal-overlay modal-overlay--active"
    onclick={(e) => e.target === e.currentTarget && closeEditModal()}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <form
      id="edit-form"
      class="ds-modal ds-modal--md"
      onclick={(e) => e.stopPropagation()}
      onsubmit={(e) => {
        e.preventDefault();
        handleEditSubmit();
      }}
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          <i class="fas fa-edit mr-2"></i>
          Dokument bearbeiten
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          onclick={closeEditModal}
          aria-label="Schließen"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body">
        <!-- Document Name -->
        <div class="form-field">
          <label class="form-field__label form-field__label--required" for="edit-doc-name"
            >Dokumentname</label
          >
          <input
            type="text"
            id="edit-doc-name"
            name="name"
            class="form-field__control"
            placeholder="z.B. Arbeitsvertrag 2025"
            bind:value={editDocName}
            required
          />
        </div>

        <!-- Category Selection - Custom Dropdown -->
        <div class="form-field">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="form-field__label form-field__label--required">Kategorie</label>
          <div class="dropdown w-full" id="edit-category-dropdown">
            <button
              type="button"
              class="dropdown__trigger w-full gap-2"
              onclick={(e) => {
                e.stopPropagation();
                editCategoryDropdownOpen = !editCategoryDropdownOpen;
              }}
            >
              <span class="flex items-center gap-2">
                <i class="fas fa-folder"></i>
                <span>
                  {#if editCategory}
                    {DB_CATEGORY_LABELS[editCategory] ?? editCategory}
                  {:else}
                    Kategorie wählen...
                  {/if}
                </span>
              </span>
              <i class="fas fa-chevron-down"></i>
            </button>
            <div class="dropdown__menu" class:active={editCategoryDropdownOpen}>
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="dropdown__option"
                data-value="general"
                onclick={() => selectEditCategory('general')}
              >
                <i class="fas fa-folder"></i>
                Allgemein
              </div>
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="dropdown__option"
                data-value="work"
                onclick={() => selectEditCategory('work')}
              >
                <i class="fas fa-briefcase"></i>
                Arbeit
              </div>
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="dropdown__option"
                data-value="personal"
                onclick={() => selectEditCategory('personal')}
              >
                <i class="fas fa-user"></i>
                Persönlich
              </div>
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="dropdown__option"
                data-value="salary"
                onclick={() => selectEditCategory('salary')}
              >
                <i class="fas fa-money-bill-wave"></i>
                Gehalt
              </div>
            </div>
          </div>
        </div>

        <!-- Tags -->
        <div class="form-field">
          <label class="form-field__label" for="edit-doc-tags">Tags</label>
          <input
            type="text"
            id="edit-doc-tags"
            name="tags"
            class="form-field__control"
            placeholder="z.B. vertrag, 2025, personal (kommagetrennt)"
            bind:value={editTags}
          />
          <small class="form-field__message">Tags helfen beim späteren Suchen und Filtern</small>
        </div>

        <!-- Info about current file -->
        <div class="p-3 bg-surface-2 rounded-lg border border-border-subtle">
          <div class="text-sm text-content-secondary">
            <div class="flex items-center gap-2 mb-1">
              <i class="fas fa-file"></i>
              <span>Originaldatei: {editingDocument.storedFilename}</span>
            </div>
            <div class="flex items-center gap-2">
              <i class="fas fa-calendar"></i>
              <span>Hochgeladen: {formatDateTime(editingDocument.uploadedAt)}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="ds-modal__footer">
        <button type="button" class="btn btn-cancel" onclick={closeEditModal}> Abbrechen </button>
        <button type="submit" class="btn btn-modal" disabled={editSubmitting}>
          {#if editSubmitting}
            <span class="spinner-ring spinner-ring--sm mr-2"></span>
          {:else}
            <i class="fas fa-save mr-2"></i>
          {/if}
          Speichern
        </button>
      </div>
    </form>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirmModal && deletingDocument}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay modal-overlay--active"
    onclick={(e) => e.target === e.currentTarget && closeDeleteConfirmModal()}
  >
    <div class="confirm-modal confirm-modal--danger" onclick={(e) => e.stopPropagation()}>
      <div class="confirm-modal__icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h3 class="confirm-modal__title">Dokument löschen?</h3>
      <p class="confirm-modal__message">
        <strong>ACHTUNG:</strong> Diese Aktion kann nicht rückgängig gemacht werden!
        <br /><br />
        Das Dokument <strong>"{deletingDocument.filename}"</strong> wird unwiderruflich gelöscht.
      </p>
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel"
          onclick={closeDeleteConfirmModal}
          disabled={deleteSubmitting}
        >
          Abbrechen
        </button>
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--danger"
          onclick={confirmDeleteDocument}
          disabled={deleteSubmitting}
        >
          {#if deleteSubmitting}
            <span class="spinner-ring spinner-ring--sm mr-2"></span>
          {:else}
            <i class="fas fa-trash mr-2"></i>
          {/if}
          Endgültig löschen
        </button>
      </div>
    </div>
  </div>
{/if}
