<script lang="ts">
  import { showSuccessAlert, showErrorAlert } from '$lib/utils';

  import { createDummy, deleteDummy, listDummies, logApiError, updateDummy } from './_lib/api';
  import { createDummyMessages } from './_lib/constants';
  import DeleteConfirmModal from './_lib/DeleteConfirmModal.svelte';
  import DummyFormModal from './_lib/DummyFormModal.svelte';
  import DummyTable from './_lib/DummyTable.svelte';
  import SearchBar from './_lib/SearchBar.svelte';
  import StatusFilterTabs from './_lib/StatusFilterTabs.svelte';

  import type { PageData } from './$types';
  import type {
    CreateDummyPayload,
    DummyFormData,
    DummyUser,
    UpdateDummyPayload,
  } from './_lib/types';

  // =============================================================================
  // SSR DATA
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // Hierarchy labels from layout data inheritance (A6)
  const labels = $derived(data.hierarchyLabels);
  const messages = $derived(createDummyMessages(labels));

  // =============================================================================
  // CLIENT STATE
  // =============================================================================

  let clientDummies = $state<DummyUser[] | null>(null);
  let statusFilter = $state<number | 'all'>('all');
  let searchTerm = $state('');
  let currentPage = $state(1);
  let clientTotalPages = $state<number | null>(null);
  let loading = $state(false);

  // Modal state
  let showFormModal = $state(false);
  let formMode = $state<'create' | 'edit'>('create');
  let editingDummy = $state<DummyUser | null>(null);
  let submitting = $state(false);

  // Delete flow
  let showDeleteModal = $state(false);
  let deletingDummy = $state<DummyUser | null>(null);

  // =============================================================================
  // DERIVED
  // =============================================================================

  const dummies = $derived(clientDummies ?? data.dummies);
  const teams = $derived(data.teams);
  const totalPages = $derived(clientTotalPages ?? data.totalPages);

  // =============================================================================
  // DATA LOADING
  // =============================================================================

  async function loadDummies(): Promise<void> {
    loading = true;
    try {
      const filters: { isActive?: number | 'all'; search?: string } = {};
      if (statusFilter !== 'all') filters.isActive = statusFilter;
      if (searchTerm !== '') filters.search = searchTerm;

      const result = await listDummies(currentPage, 20, filters);
      clientDummies = result.items;
      const ps = result.pageSize > 0 ? result.pageSize : 20;
      clientTotalPages = Math.ceil(result.total / ps);
    } catch (err: unknown) {
      logApiError('loadDummies', err);
      showErrorAlert('Fehler beim Laden der Dummy-Benutzer');
    } finally {
      loading = false;
    }
  }

  function handleStatusFilter(value: number | 'all'): void {
    statusFilter = value;
    currentPage = 1;
    void loadDummies();
  }

  function handleSearch(term: string): void {
    searchTerm = term;
    currentPage = 1;
    void loadDummies();
  }

  function handlePageChange(page: number): void {
    currentPage = page;
    void loadDummies();
  }

  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================

  function openCreateModal(): void {
    formMode = 'create';
    editingDummy = null;
    showFormModal = true;
  }

  function openEditModal(dummy: DummyUser): void {
    formMode = 'edit';
    editingDummy = dummy;
    showFormModal = true;
  }

  function openDeleteModal(dummy: DummyUser): void {
    deletingDummy = dummy;
    showDeleteModal = true;
  }

  function closeFormModal(): void {
    showFormModal = false;
    editingDummy = null;
  }

  function closeDeleteModal(): void {
    showDeleteModal = false;
    deletingDummy = null;
  }

  async function handleSave(formData: DummyFormData): Promise<void> {
    submitting = true;
    try {
      if (formMode === 'edit' && editingDummy !== null) {
        const payload: UpdateDummyPayload = {
          displayName: formData.displayName,
          teamIds: formData.teamIds,
          isActive: formData.isActive,
        };
        if (formData.password !== '') {
          payload.password = formData.password;
        }
        await updateDummy(editingDummy.uuid, payload);
        showSuccessAlert('Dummy-Benutzer aktualisiert');
      } else {
        const payload: CreateDummyPayload = {
          displayName: formData.displayName,
          password: formData.password,
          teamIds: formData.teamIds.length > 0 ? formData.teamIds : undefined,
        };
        await createDummy(payload);
        showSuccessAlert('Dummy-Benutzer erstellt');
      }
      closeFormModal();
      await loadDummies();
    } catch (err: unknown) {
      logApiError('saveDummy', err);
      showErrorAlert('Fehler beim Speichern');
    } finally {
      submitting = false;
    }
  }

  async function handleDeleteConfirm(): Promise<void> {
    if (deletingDummy === null) return;
    submitting = true;
    try {
      await deleteDummy(deletingDummy.uuid);
      showSuccessAlert('Dummy-Benutzer wurde gelöscht');
      closeDeleteModal();
      await loadDummies();
    } catch (err: unknown) {
      logApiError('deleteDummy', err);
      showErrorAlert('Fehler beim Löschen');
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>{messages.PAGE_TITLE}</title>
</svelte:head>

<div class="container">
  <div class="card">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-desktop mr-2"></i>
        {messages.HEADING}
      </h2>
      <p class="mt-2 text-(--color-text-secondary)">
        {messages.HEADING_SUBTITLE}
      </p>

      <div
        class="mt-6 flex flex-col items-stretch gap-4 md:flex-row md:items-center md:justify-between"
      >
        <StatusFilterTabs
          activeFilter={statusFilter}
          onfilter={handleStatusFilter}
        />
        <div class="max-w-80">
          <SearchBar
            value={searchTerm}
            onsearch={handleSearch}
          />
        </div>
      </div>
    </div>

    <div class="card__body">
      {#if loading}
        <div class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-spinner fa-spin"></i>
          </div>
          <p class="empty-state__description">{messages.LOADING}</p>
        </div>
      {:else if dummies.length === 0}
        <div class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-desktop"></i>
          </div>
          <h3 class="empty-state__title">{messages.EMPTY_TITLE}</h3>
          <p class="empty-state__description">
            {messages.EMPTY_DESCRIPTION}
          </p>
          <button
            type="button"
            class="btn btn-primary"
            onclick={openCreateModal}
          >
            <i class="fas fa-plus mr-1"></i>
            Dummy-Benutzer erstellen
          </button>
        </div>
      {:else}
        <DummyTable
          {messages}
          {dummies}
          onedit={openEditModal}
          ondelete={openDeleteModal}
        />

        <!-- Pagination -->
        {#if totalPages > 1}
          <nav
            class="pagination mt-6"
            aria-label="Seitennavigation"
          >
            <button
              type="button"
              class="pagination__btn pagination__btn--prev"
              disabled={currentPage <= 1}
              onclick={() => {
                handlePageChange(currentPage - 1);
              }}
            >
              <i class="fas fa-chevron-left"></i>
              Zurück
            </button>
            <div class="pagination__pages">
              {#each Array.from({ length: totalPages }, (_: unknown, i: number) => i + 1) as page (page)}
                <button
                  type="button"
                  class="pagination__page"
                  class:pagination__page--active={page === currentPage}
                  onclick={() => {
                    handlePageChange(page);
                  }}
                >
                  {page}
                </button>
              {/each}
            </div>
            <button
              type="button"
              class="pagination__btn pagination__btn--next"
              disabled={currentPage >= totalPages}
              onclick={() => {
                handlePageChange(currentPage + 1);
              }}
            >
              Weiter
              <i class="fas fa-chevron-right"></i>
            </button>
          </nav>
        {/if}
      {/if}
    </div>
  </div>
</div>

<!-- FAB: Create Dummy -->
<button
  type="button"
  class="btn-float"
  aria-label={messages.BTN_CREATE}
  onclick={openCreateModal}
>
  <i class="fas fa-plus"></i>
</button>

<!-- Form Modal (Create/Edit) -->
<DummyFormModal
  show={showFormModal}
  mode={formMode}
  dummy={editingDummy}
  {teams}
  {submitting}
  onclose={closeFormModal}
  onsave={(formData: DummyFormData) => {
    void handleSave(formData);
  }}
/>

<!-- Delete Confirmation -->
<DeleteConfirmModal
  show={showDeleteModal}
  {submitting}
  oncancel={closeDeleteModal}
  onconfirm={() => {
    void handleDeleteConfirm();
  }}
/>
