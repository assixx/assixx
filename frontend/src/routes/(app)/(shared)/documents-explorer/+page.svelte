<script lang="ts">
  /**
   * Documents Explorer - Page Component (Thin Presentation Layer)
   * SSR: Data loaded in +page.server.ts
   * Level 3 Hybrid: SSR initial + client-side filtering/sorting
   *
   * All state logic lives in _lib/state.svelte.ts (state module pattern)
   * This component handles: SSR sync, DOM effects, template rendering
   */
  import { onMount, untrack } from 'svelte';

  import PermissionDenied from '$lib/components/PermissionDenied.svelte';

  import ChatFoldersList from './_lib/ChatFoldersList.svelte';
  import { SORT_OPTIONS, CATEGORY_LABELS, MESSAGES } from './_lib/constants';
  import DeleteConfirmModal from './_lib/DeleteConfirmModal.svelte';
  import DocumentGridView from './_lib/DocumentGridView.svelte';
  import DocumentListView from './_lib/DocumentListView.svelte';
  import EditModal from './_lib/EditModal.svelte';
  import FolderSidebar from './_lib/FolderSidebar.svelte';
  import PreviewModal from './_lib/PreviewModal.svelte';
  import { docExplorerState } from './_lib/state.svelte';
  import UploadModal from './_lib/UploadModal.svelte';

  import type { PageData } from './$types';

  // ==========================================================================
  // SSR DATA → STATE SYNC
  // ==========================================================================

  const { data }: { data: PageData } = $props();

  const permissionDenied = $derived(data.permissionDenied);

  // Derived SSR data as baseline (re-evaluates on invalidateAll)
  const ssrDocuments = $derived(data.documents);
  const ssrChatFolders = $derived(data.chatFolders);
  const ssrUser = $derived(data.currentUser ?? null);

  // Sync SSR → state store (untrack prevents circular dependency)
  $effect(() => {
    const docs = ssrDocuments;
    const folders = ssrChatFolders;
    const user = ssrUser;

    untrack(() => {
      docExplorerState.initFromSSR(docs, folders, user);
    });
  });

  // ==========================================================================
  // DOM-DEPENDENT EFFECTS (must stay in component)
  // ==========================================================================

  /** Close sort dropdown on outside click */
  $effect(() => {
    if (docExplorerState.sortDropdownOpen) {
      const handleOutsideClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const el = document.getElementById('sort-dropdown');
        if (el !== null && !el.contains(target)) {
          docExplorerState.setSortDropdownOpen(false);
        }
      };
      document.addEventListener('click', handleOutsideClick, true);
      return () => {
        document.removeEventListener('click', handleOutsideClick, true);
      };
    }
  });

  /** Global keyboard handler for preview navigation */
  function handleKeydown(e: KeyboardEvent): void {
    if (docExplorerState.showPreviewModal) {
      if (e.key === 'ArrowLeft') docExplorerState.navigatePreviewPrev();
      else if (e.key === 'ArrowRight') docExplorerState.navigatePreviewNext();
    }
  }

  /** Extract search query from input event and delegate to state */
  function onSearchInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    docExplorerState.handleSearchInput(input.value);
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  onMount(() => {
    docExplorerState.loadSavedViewMode();
  });
</script>

<svelte:head>
  <title>{MESSAGES.PAGE_TITLE}</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

{#if permissionDenied}
  <PermissionDenied addonName="die Dokumente" />
{:else}
  <div class="container">
    <div class="card">
      <!-- Card Header -->
      <div class="card__header">
        <div class="mb-4">
          <h2 class="card__title">
            <i class="fas fa-folder-open mr-2"></i>
            Dokumente Explorer
          </h2>
          <p class="mt-2 text-(--color-text-secondary)">
            Dokumente hochladen und verwalten
          </p>
        </div>

        <!-- Toolbar -->
        <div class="border-t border-(--border-color) pt-4">
          <div class="flex items-center justify-between gap-4">
            <div class="flex flex-1 items-center gap-3">
              <div class="search-input max-w-md flex-1">
                <i class="search-input__icon fas fa-search"></i>
                <input
                  type="search"
                  id="search-input"
                  class="search-input__field"
                  placeholder="Dokumente durchsuchen..."
                  autocomplete="off"
                  value={docExplorerState.searchQuery}
                  oninput={onSearchInput}
                />
                <button
                  type="button"
                  class="search-input__clear"
                  class:hidden={!docExplorerState.searchQuery}
                  onclick={docExplorerState.clearSearch}
                  aria-label="Suche löschen"
                >
                  <i class="fas fa-times"></i>
                </button>
              </div>
              {#if docExplorerState.showUploadButton}
                <button
                  type="button"
                  id="upload-btn"
                  class="btn btn-upload"
                  onclick={docExplorerState.handleUploadOpen}
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
                  class:action-icon--active={docExplorerState.viewMode ===
                    'list'}
                  aria-label="Listen-Ansicht"
                  title="Listen-Ansicht"
                  onclick={() => {
                    docExplorerState.setViewMode('list');
                  }}
                >
                  <i class="fas fa-list"></i>
                </button>
                <button
                  type="button"
                  class="action-icon"
                  class:action-icon--active={docExplorerState.viewMode ===
                    'grid'}
                  aria-label="Grid-Ansicht"
                  title="Grid-Ansicht"
                  onclick={() => {
                    docExplorerState.setViewMode('grid');
                  }}
                >
                  <i class="fas fa-th"></i>
                </button>
              </div>

              <div
                class="dropdown"
                id="sort-dropdown"
              >
                <div
                  class="dropdown__trigger gap-2"
                  role="button"
                  tabindex="0"
                  onclick={(e) => {
                    e.stopPropagation();
                    docExplorerState.toggleSortDropdown();
                  }}
                  onkeydown={(e) => {
                    if (e.key === 'Enter')
                      docExplorerState.toggleSortDropdown();
                  }}
                >
                  <span>{docExplorerState.currentSortLabel}</span>
                  <i class="fas fa-chevron-down"></i>
                </div>
                <div
                  class="dropdown__menu"
                  class:active={docExplorerState.sortDropdownOpen}
                >
                  {#each SORT_OPTIONS as option (option.value)}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="dropdown__option"
                      onclick={() => {
                        docExplorerState.handleSortOptionSelect(option.value);
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
          <div class="mt-4 flex items-center gap-6 text-sm">
            <div class="flex items-center gap-2">
              <svg
                class="text-primary-500 h-5 w-5"
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
              <span class="text-content-secondary text-sm"
                >{docExplorerState.stats.total} Dokumente</span
              >
            </div>
            {#if docExplorerState.stats.unread > 0}
              <div class="flex items-center gap-2">
                <span class="text-warning-500 text-sm"
                  >{docExplorerState.stats.unread} Ungelesen</span
                >
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Card Body -->
      <div class="card__body">
        <!-- Breadcrumb Navigation -->
        <nav
          class="breadcrumb mb-2"
          aria-label="Ordnerpfad"
        >
          {#if docExplorerState.currentCategory === 'all'}
            <span
              class="breadcrumb__item breadcrumb__item--active"
              aria-current="page"
            >
              <i
                class="fas fa-folder breadcrumb__icon"
                aria-hidden="true"
              ></i>
              {CATEGORY_LABELS.all}
            </span>
          {:else}
            <button
              type="button"
              class="breadcrumb__item"
              onclick={() => {
                docExplorerState.navigateToCategory('all');
              }}
            >
              <i
                class="fas fa-folder breadcrumb__icon"
                aria-hidden="true"
              ></i>
              {CATEGORY_LABELS.all}
            </button>
            <span
              class="breadcrumb__separator"
              aria-hidden="true"
            >
              <i class="fas fa-chevron-right"></i>
            </span>
            {#if docExplorerState.selectedConversationId !== null && docExplorerState.selectedChatFolderName !== null}
              <button
                type="button"
                class="breadcrumb__item"
                onclick={docExplorerState.backToFolders}
              >
                {CATEGORY_LABELS[docExplorerState.currentCategory]}
              </button>
              <span
                class="breadcrumb__separator"
                aria-hidden="true"
              >
                <i class="fas fa-chevron-right"></i>
              </span>
              <span
                class="breadcrumb__item breadcrumb__item--active"
                aria-current="page"
              >
                <i
                  class="fas fa-comments breadcrumb__icon"
                  aria-hidden="true"
                ></i>
                {docExplorerState.selectedChatFolderName}
              </span>
            {:else}
              <span
                class="breadcrumb__item breadcrumb__item--active"
                aria-current="page"
              >
                {CATEGORY_LABELS[docExplorerState.currentCategory]}
              </span>
            {/if}
          {/if}
        </nav>

        <div class="flex h-[600px]">
          <!-- Sidebar -->
          <FolderSidebar
            currentCategory={docExplorerState.currentCategory}
            categoryCounts={docExplorerState.categoryCounts}
            chatFoldersTotalCount={docExplorerState.chatFoldersTotalCount}
            onnavigate={docExplorerState.navigateToCategory}
          />

          <!-- Content Area -->
          <div class="flex flex-1 flex-col">
            <div class="flex-1 overflow-y-auto p-2">
              {#if docExplorerState.loading}
                <div class="flex items-center justify-center p-8">
                  <div class="spinner-ring spinner-ring--md"></div>
                </div>
              {:else if docExplorerState.error}
                <div class="flex h-full items-center justify-center">
                  <div class="text-center">
                    <i
                      class="fas fa-exclamation-triangle text-error-500 mb-4 text-4xl"
                    ></i>
                    <p class="text-content-secondary mb-4">
                      {docExplorerState.error}
                    </p>
                    <button
                      type="button"
                      class="btn btn-primary"
                      onclick={() => docExplorerState.loadDocuments()}
                      >{MESSAGES.BTN_RETRY}</button
                    >
                  </div>
                </div>
              {:else if docExplorerState.isViewingChatFolders}
                <div class:hidden={docExplorerState.viewMode !== 'list'}>
                  <ChatFoldersList
                    folders={docExplorerState.chatFolders}
                    showBackToAll={true}
                    onfolderClick={docExplorerState.loadChatAttachments}
                    onbackToAll={() => {
                      docExplorerState.navigateToCategory('all');
                    }}
                  />
                </div>
              {:else}
                <div class:hidden={docExplorerState.viewMode !== 'list'}>
                  <DocumentListView
                    documents={docExplorerState.filteredDocuments}
                    currentUser={docExplorerState.currentUser}
                    showActions={docExplorerState.showActions}
                    showBackToFolders={docExplorerState.selectedConversationId !==
                      null}
                    onpreview={docExplorerState.handlePreviewOpen}
                    ondownload={docExplorerState.handleDownloadClick}
                    onedit={docExplorerState.handleEditClick}
                    ondelete={docExplorerState.handleDeleteDocument}
                    onbackToFolders={docExplorerState.backToFolders}
                  />
                </div>
                <div class:hidden={docExplorerState.viewMode !== 'grid'}>
                  <DocumentGridView
                    documents={docExplorerState.filteredDocuments}
                    currentUser={docExplorerState.currentUser}
                    showActions={docExplorerState.showActions}
                    onpreview={docExplorerState.handlePreviewOpen}
                    ondownload={docExplorerState.handleDownloadClick}
                    onedit={docExplorerState.handleEditClick}
                    ondelete={docExplorerState.handleDeleteDocument}
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
    show={docExplorerState.showPreviewModal}
    document={docExplorerState.selectedDocument}
    onclose={docExplorerState.closePreview}
    ondownload={docExplorerState.downloadDocument}
    onprev={docExplorerState.navigatePreviewPrev}
    onnext={docExplorerState.navigatePreviewNext}
    currentIndex={docExplorerState.previewIndex >= 0 ?
      docExplorerState.previewIndex
    : undefined}
    totalCount={docExplorerState.previewTotalCount}
  />

  <UploadModal
    show={docExplorerState.showUploadModal}
    onclose={docExplorerState.closeUploadModal}
    onsubmit={docExplorerState.handleUploadSubmit}
  />

  <EditModal
    show={docExplorerState.showEditModal}
    document={docExplorerState.editingDocument}
    submitting={docExplorerState.editSubmitting}
    onclose={docExplorerState.closeEditModal}
    onsubmit={docExplorerState.handleEditSubmit}
  />

  <DeleteConfirmModal
    show={docExplorerState.showDeleteConfirmModal}
    document={docExplorerState.deletingDocument}
    submitting={docExplorerState.deleteSubmitting}
    onclose={docExplorerState.closeDeleteConfirmModal}
    onconfirm={docExplorerState.confirmDeleteDocument}
  />
{/if}

<style>
  /* Folder Sidebar (child component: FolderSidebar) */
  :global(.folder-item) {
    transition: all 0.2s ease;
    cursor: pointer;

    margin-bottom: 4px;
    border-radius: 6px;

    background: oklch(63.68% 0.0001 263.28 / 12%);
  }

  :global(.folder-item:hover) {
    transform: translateX(2px);
    background: oklch(63.68% 0.0001 263.28 / 30%) !important;
  }

  /* User Info in Tables */
  :global(.data-table .user-info) {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
  }

  :global(.data-table .user-info .user-name) {
    display: inline-block;
    width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.data-table .user-info .badge) {
    flex-shrink: 0;
  }
</style>
