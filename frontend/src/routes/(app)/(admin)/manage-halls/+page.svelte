<script lang="ts">
  /**
   * Manage Halls - Page Component
   * @module manage-halls/+page
   *
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   */
  import { invalidateAll } from '$app/navigation';

  import HighlightText from '$lib/components/HighlightText.svelte';
  import { showWarningAlert, showErrorAlert, showSuccessAlert } from '$lib/stores/toast';

  import {
    buildHallPayload,
    saveHall as apiSaveHall,
    deleteHall as apiDeleteHall,
  } from './_lib/api';
  import { createMessages } from './_lib/constants';
  import DeleteModals from './_lib/DeleteModals.svelte';
  import { applyAllFilters } from './_lib/filters';
  import HallModal from './_lib/HallModal.svelte';
  import {
    getStatusBadgeClass,
    getStatusLabel,
    getAreaDisplay,
    populateFormFromHall,
    getDefaultFormValues,
  } from './_lib/utils';

  import type { PageData } from './$types';
  import type { StatusFilter, FormIsActiveStatus } from './_lib/types';

  // =============================================================================
  // SSR DATA
  // =============================================================================

  const { data }: { data: PageData } = $props();

  const allHalls = $derived(data.halls);

  // Hierarchy labels from layout data inheritance (A6)
  const labels = $derived(data.hierarchyLabels);
  const messages = $derived(createMessages(labels));

  // =============================================================================
  // UI STATE
  // =============================================================================

  const error = $state<string | null>(null);

  let currentStatusFilter: StatusFilter = $state('active');
  let currentSearchQuery = $state('');

  let searchOpen = $state(false);

  let showHallModal = $state(false);
  let showDeleteModal = $state(false);

  let currentEditId: number | null = $state(null);
  let deleteHallId: number | null = $state(null);

  let formName = $state('');
  let formDescription = $state('');
  let formIsActive: FormIsActiveStatus = $state(1);

  let submitting = $state(false);

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const isEditMode = $derived(currentEditId !== null);
  const modalTitle = $derived(isEditMode ? messages.MODAL_TITLE_EDIT : messages.MODAL_TITLE_ADD);

  const filteredHalls = $derived(
    applyAllFilters(allHalls, currentStatusFilter, currentSearchQuery),
  );

  // =============================================================================
  // API FUNCTIONS
  // =============================================================================

  async function saveHall(): Promise<void> {
    submitting = true;
    if (!formName.trim()) {
      showWarningAlert(messages.VALIDATION_NAME_REQUIRED);
      submitting = false;
      return;
    }
    const payload = buildHallPayload({
      name: formName,
      description: formDescription,
      areaId: null,
      isActive: formIsActive,
    });
    const result = await apiSaveHall(payload, currentEditId);
    if (result.success) {
      closeHallModal();
      await invalidateAll();
      showSuccessAlert(isEditMode ? 'Aktualisiert' : 'Erstellt');
    } else if (result.error !== null) {
      showErrorAlert(result.error);
    }
    submitting = false;
  }

  async function deleteHall(): Promise<void> {
    const idToDelete = deleteHallId;
    if (idToDelete === null) return;
    deleteHallId = null;
    showDeleteModal = false;

    const result = await apiDeleteHall(idToDelete);
    if (result.success) {
      await invalidateAll();
      showSuccessAlert('Erfolgreich gelöscht');
    } else if (result.error !== null) {
      showErrorAlert(result.error);
    }
  }

  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================

  function openAddModal() {
    currentEditId = null;
    resetForm();
    showHallModal = true;
  }

  function openEditModal(hallId: number) {
    const hall = allHalls.find((h) => h.id === hallId);
    if (!hall) return;
    currentEditId = hallId;
    const formData = populateFormFromHall(hall);
    formName = formData.name;
    formDescription = formData.description;
    formIsActive = formData.isActive;
    showHallModal = true;
  }

  function openDeleteModal(hallId: number) {
    deleteHallId = hallId;
    showDeleteModal = true;
  }

  function closeHallModal() {
    showHallModal = false;
    currentEditId = null;
    resetForm();
  }

  function closeDeleteModalFn() {
    showDeleteModal = false;
    deleteHallId = null;
  }

  function resetForm() {
    const defaults = getDefaultFormValues();
    formName = defaults.name;
    formDescription = defaults.description;
    formIsActive = defaults.isActive;
  }

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  function handleStatusToggle(status: StatusFilter): void {
    currentStatusFilter = status;
  }

  function handleSearchInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    currentSearchQuery = input.value;
    searchOpen = currentSearchQuery.trim().length > 0;
  }

  function clearSearch(): void {
    currentSearchQuery = '';
    searchOpen = false;
  }

  function handleSearchResultClick(hallId: number) {
    openEditModal(hallId);
    searchOpen = false;
    currentSearchQuery = '';
  }

  async function handleFormSubmit(e: Event): Promise<void> {
    e.preventDefault();
    await saveHall();
  }

  // =============================================================================
  // OUTSIDE CLICK HANDLER
  // =============================================================================

  $effect(() => {
    if (searchOpen) {
      const handleOutsideClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const el = document.querySelector('.search-input-wrapper');
        if (el && !el.contains(target)) searchOpen = false;
      };
      document.addEventListener('click', handleOutsideClick, true);
      return () => {
        document.removeEventListener('click', handleOutsideClick, true);
      };
    }
  });
</script>

<svelte:head>
  <title>{messages.PAGE_TITLE}</title>
</svelte:head>

<div class="container">
  <div class="card">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-warehouse mr-2"></i>
        {messages.PAGE_HEADING}
      </h2>
      <p class="mt-2 text-(--color-text-secondary)">
        {messages.PAGE_DESCRIPTION}
      </p>

      <div class="mt-6 flex items-center justify-between gap-4">
        <!-- Status Toggle Group -->
        <div
          class="toggle-group"
          id="hall-status-toggle"
        >
          <button
            type="button"
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'active'}
            title={`Aktive ${messages.PAGE_HEADING}`}
            onclick={() => {
              handleStatusToggle('active');
            }}
          >
            <i class="fas fa-check"></i>
            {messages.FILTER_ACTIVE}
          </button>
          <button
            type="button"
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'inactive'}
            title={`Inaktive ${messages.PAGE_HEADING}`}
            onclick={() => {
              handleStatusToggle('inactive');
            }}
          >
            <i class="fas fa-times"></i>
            {messages.FILTER_INACTIVE}
          </button>
          <button
            type="button"
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'archived'}
            title={`Archivierte ${messages.PAGE_HEADING}`}
            onclick={() => {
              handleStatusToggle('archived');
            }}
          >
            <i class="fas fa-archive"></i>
            {messages.FILTER_ARCHIVED}
          </button>
          <button
            type="button"
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'all'}
            title={`Alle ${messages.PAGE_HEADING}`}
            onclick={() => {
              handleStatusToggle('all');
            }}
          >
            <i class="fas fa-warehouse"></i>
            {messages.FILTER_ALL}
          </button>
        </div>

        <!-- Search Input -->
        <div
          class="search-input-wrapper max-w-80"
          class:search-input-wrapper--open={searchOpen}
        >
          <div
            class="search-input"
            id="hall-search-container"
          >
            <i class="search-input__icon fas fa-search"></i>
            <input
              type="search"
              id="hall-search"
              class="search-input__field"
              placeholder={messages.SEARCH_PLACEHOLDER}
              autocomplete="off"
              value={currentSearchQuery}
              oninput={handleSearchInput}
            />
            <button
              class="search-input__clear"
              class:search-input__clear--visible={currentSearchQuery.length > 0}
              type="button"
              aria-label="Suche löschen"
              onclick={clearSearch}
            >
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div
            class="search-input__results"
            id="hall-search-results"
          >
            {#if currentSearchQuery && filteredHalls.length === 0}
              <div class="search-input__no-results">
                {messages.SEARCH_NO_RESULTS} "{currentSearchQuery}"
              </div>
            {:else if currentSearchQuery}
              {#each filteredHalls.slice(0, 5) as hall (hall.id)}
                <button
                  type="button"
                  class="search-input__result-item"
                  onclick={() => {
                    handleSearchResultClick(hall.id);
                  }}
                >
                  <div class="search-result-item">
                    <div class="search-result-item__name">
                      <HighlightText
                        text={hall.name}
                        query={currentSearchQuery}
                      />
                    </div>
                    <div class="search-result-item__email">
                      {getAreaDisplay(hall.areaName)}
                    </div>
                  </div>
                </button>
              {/each}
              {#if filteredHalls.length > 5}
                <div class="search-result-item__more py-2">
                  {messages.moreResults(filteredHalls.length - 5)}
                </div>
              {/if}
            {/if}
          </div>
        </div>
      </div>
    </div>

    <div class="card__body">
      {#if error}
        <div class="p-6 text-center">
          <i class="fas fa-exclamation-triangle mb-4 text-4xl text-(--color-danger)"></i>
          <p class="text-(--color-text-secondary)">{error}</p>
          <button
            type="button"
            class="btn btn-primary mt-4"
            onclick={() => invalidateAll()}>{messages.BTN_RETRY}</button
          >
        </div>
      {:else if filteredHalls.length === 0}
        <div
          id="halls-empty"
          class="empty-state"
        >
          <div class="empty-state__icon"><i class="fas fa-warehouse"></i></div>
          <h3 class="empty-state__title">{messages.NO_HALLS_FOUND}</h3>
          <p class="empty-state__description">
            {messages.CREATE_FIRST_HALL}
          </p>
          <button
            type="button"
            class="btn btn-primary"
            onclick={openAddModal}
          >
            <i class="fas fa-plus"></i>
            {messages.BTN_ADD_HALL}
          </button>
        </div>
      {:else}
        <div id="halls-table-content">
          <div class="table-responsive">
            <table
              class="data-table data-table--hover data-table--striped data-table--actions-hover"
              id="halls-table"
            >
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">{messages.TH_NAME}</th>
                  <th scope="col">{messages.TH_DESCRIPTION}</th>
                  <th scope="col">{messages.TH_STATUS}</th>
                  <th scope="col">{messages.TH_AREA}</th>
                  <th scope="col">{messages.TH_DEPARTMENTS}</th>
                  <th scope="col">{messages.TH_ACTIONS}</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredHalls as hall (hall.id)}
                  <tr>
                    <td><code class="text-muted">{hall.id}</code></td>
                    <td>
                      <div class="font-medium text-(--color-text-primary)">
                        {hall.name}
                      </div>
                    </td>
                    <td>
                      <div class="text-sm text-(--color-text-secondary)">
                        {hall.description ?? '-'}
                      </div>
                    </td>
                    <td>
                      <span class="badge {getStatusBadgeClass(hall.isActive)}"
                        >{getStatusLabel(hall.isActive)}</span
                      >
                    </td>
                    <td>
                      <span
                        class="badge {(
                          hall.areaName !== null &&
                          hall.areaName !== undefined &&
                          hall.areaName !== ''
                        ) ?
                          'badge--info'
                        : 'badge--secondary'}"
                        title={hall.areaName ?? messages.NO_AREA}
                      >
                        {getAreaDisplay(hall.areaName)}
                      </span>
                    </td>
                    <td>
                      <span
                        class="badge {(hall.departmentCount ?? 0) > 0 ?
                          'badge--info'
                        : 'badge--secondary'}"
                        title={hall.departmentNames ?? 'Keine zugeordnet'}
                      >
                        {hall.departmentCount ?? 0}
                        {labels.department}
                      </span>
                    </td>
                    <td>
                      <div class="flex gap-2">
                        <button
                          type="button"
                          class="action-icon action-icon--edit"
                          title="Bearbeiten"
                          aria-label="Bearbeiten"
                          onclick={() => {
                            openEditModal(hall.id);
                          }}
                        >
                          <i class="fas fa-edit"></i>
                        </button>
                        <button
                          type="button"
                          class="action-icon action-icon--delete"
                          title="Löschen"
                          aria-label="Löschen"
                          onclick={() => {
                            openDeleteModal(hall.id);
                          }}
                        >
                          <i class="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Floating Action Button -->
<button
  type="button"
  class="btn-float"
  onclick={openAddModal}
  aria-label={messages.BTN_ADD_HALL}
>
  <i class="fas fa-plus"></i>
</button>

<!-- Add/Edit Hall Modal -->
<HallModal
  show={showHallModal}
  {isEditMode}
  {modalTitle}
  bind:formName
  bind:formDescription
  bind:formIsActive
  {submitting}
  {messages}
  onclose={closeHallModal}
  onsubmit={handleFormSubmit}
/>

<!-- Delete Modal -->
<DeleteModals
  show={showDeleteModal}
  oncancel={closeDeleteModalFn}
  onconfirm={deleteHall}
/>
