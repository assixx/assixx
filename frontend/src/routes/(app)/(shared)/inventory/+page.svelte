<script lang="ts">
  /**
   * Inventory Lists Overview - Page Component
   * @module inventory/+page
   *
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   * Card-based layout showing all inventory lists with status counts.
   */
  import { goto, invalidateAll } from '$app/navigation';

  import HighlightText from '$lib/components/HighlightText.svelte';
  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
  import { showErrorAlert, showSuccessAlert } from '$lib/stores/toast';
  import { createLogger } from '$lib/utils/logger';

  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  const log = createLogger('InventoryPage');

  // Local modules
  import {
    buildCreatePayload,
    buildUpdatePayload,
    deleteList as apiDeleteList,
    saveList as apiSaveList,
  } from './_lib/api';
  import { MESSAGES } from './_lib/constants';
  import { applyAllFilters } from './_lib/filters';
  import ListCard from './_lib/ListCard.svelte';
  import ListModal from './_lib/ListModal.svelte';
  import { tagsState } from './_lib/state.svelte';
  import TagFilterDropdown from './_lib/TagFilterDropdown.svelte';
  import TagsManagementModal from './_lib/TagsManagementModal.svelte';
  import { getDefaultFormValues, populateFormFromList } from './_lib/utils';

  import type { PageData } from './$types';
  import type { FormIsActiveStatus, StatusFilter } from './_lib/types';

  // =============================================================================
  // SSR DATA - Level 3: $derived from props (single source of truth)
  // =============================================================================

  const { data }: { data: PageData } = $props();

  const allLists = $derived(data.lists);

  // Sync the SSR-loaded tag catalog into shared state on every data change
  // (initial load + invalidateAll() refreshes after mutations).
  $effect(() => {
    tagsState.set(data.tags);
  });

  // Permission: all roles can read, write/delete depends on addon permissions
  // Optimistic client-side gating — actual enforcement is server-side via @RequirePermission
  const canWrite = $derived(data.user?.role === 'root' || data.user?.role === 'admin');
  const canDelete = $derived(data.user?.role === 'root' || data.user?.role === 'admin');

  // =============================================================================
  // UI STATE - Filtering and form state (client-side only)
  // =============================================================================

  const error = $state<string | null>(null);

  // Filter State
  let currentStatusFilter = $state<StatusFilter>('active');
  let currentSearchQuery = $state('');
  let searchOpen = $state(false);
  let selectedFilterTagIds = $state<string[]>([]);

  // Modal States
  let showListModal = $state(false);
  let showDeleteModal = $state(false);
  let showTagsModal = $state(false);

  // Edit State
  let currentEditId = $state<string | null>(null);
  let deleteListId = $state<string | null>(null);

  // Form Fields
  let formTitle = $state('');
  let formDescription = $state('');
  let formCodePrefix = $state('');
  let formCodeSeparator = $state('-');
  let formCodeDigits = $state(3);
  let formIcon = $state('');
  let formIsActive = $state<FormIsActiveStatus>(1);
  let formTagIds = $state<string[]>([]);

  let submitting = $state(false);

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const isEditMode = $derived(currentEditId !== null);
  const modalTitle = $derived(isEditMode ? MESSAGES.MODAL_TITLE_EDIT : MESSAGES.MODAL_TITLE_ADD);

  const filteredLists = $derived(
    applyAllFilters(allLists, currentStatusFilter, currentSearchQuery, selectedFilterTagIds),
  );

  // =============================================================================
  // API FUNCTIONS - Level 3: invalidateAll() after mutations
  // =============================================================================

  async function handleFormSubmit(formData: {
    title: string;
    description: string;
    codePrefix: string;
    codeSeparator: string;
    codeDigits: number;
    icon: string;
    isActive: FormIsActiveStatus;
    tagIds: string[];
  }): Promise<void> {
    submitting = true;

    try {
      const payload =
        isEditMode ? buildUpdatePayload({ ...formData }) : buildCreatePayload(formData);

      await apiSaveList(payload, currentEditId);
      closeListModal();
      await invalidateAll();
      showSuccessAlert(isEditMode ? MESSAGES.SUCCESS_UPDATED : MESSAGES.SUCCESS_CREATED);
    } catch (err: unknown) {
      log.error({ err }, 'Error saving list');
      showErrorAlert(err instanceof Error ? err.message : MESSAGES.ERROR_SAVING);
    } finally {
      submitting = false;
    }
  }

  async function handleDelete(): Promise<void> {
    const listId = deleteListId;
    if (listId === null) return;

    try {
      await apiDeleteList(listId);
      showDeleteModal = false;
      if (deleteListId === listId) deleteListId = null;
      await invalidateAll();
      showSuccessAlert(MESSAGES.SUCCESS_DELETED);
    } catch (err: unknown) {
      log.error({ err }, 'Error deleting list');
      showErrorAlert(MESSAGES.ERROR_DELETING);
    }
  }

  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================

  function openAddModal(): void {
    currentEditId = null;
    resetForm();
    showListModal = true;
  }

  function openEditModal(listId: string): void {
    const list = allLists.find((l) => l.id === listId);
    if (list === undefined) return;

    currentEditId = listId;
    const values = populateFormFromList(list);
    formTitle = values.title;
    formDescription = values.description;
    formCodePrefix = values.codePrefix;
    formCodeSeparator = values.codeSeparator;
    formCodeDigits = values.codeDigits;
    formIcon = values.icon;
    formIsActive = values.isActive;
    formTagIds = values.tagIds;
    showListModal = true;
  }

  function openDeleteModal(listId: string): void {
    deleteListId = listId;
    showDeleteModal = true;
  }

  function closeListModal(): void {
    showListModal = false;
    currentEditId = null;
    resetForm();
  }

  function closeDeleteModal(): void {
    showDeleteModal = false;
    deleteListId = null;
  }

  function resetForm(): void {
    const defaults = getDefaultFormValues();
    formTitle = defaults.title;
    formDescription = defaults.description;
    formCodePrefix = defaults.codePrefix;
    formCodeSeparator = defaults.codeSeparator;
    formCodeDigits = defaults.codeDigits;
    formIcon = defaults.icon;
    formIsActive = defaults.isActive;
    formTagIds = defaults.tagIds;
  }

  async function handleTagsModalClose(): Promise<void> {
    showTagsModal = false;
    // Tags may have been renamed or deleted — refresh the list payload so
    // ListCards reflect the new tag names/icons (and removed tags vanish).
    await invalidateAll();
  }

  function openList(listId: string): void {
    void goto(`/inventory/lists/${listId}`);
  }

  // =============================================================================
  // STATUS TOGGLE HANDLER
  // =============================================================================

  function handleStatusToggle(status: StatusFilter): void {
    currentStatusFilter = status;
  }

  // =============================================================================
  // SEARCH HANDLERS
  // =============================================================================

  function handleSearchInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    currentSearchQuery = input.value;
    searchOpen = currentSearchQuery.trim().length > 0;
  }

  function clearSearch(): void {
    currentSearchQuery = '';
    searchOpen = false;
  }

  // =============================================================================
  // OUTSIDE CLICK HANDLER FOR SEARCH
  // =============================================================================

  $effect(() => {
    if (searchOpen) {
      const handleOutsideClick = (e: MouseEvent): void => {
        const target = e.target as HTMLElement;
        const el = document.querySelector('.search-input-wrapper');
        if (el !== null && !el.contains(target)) searchOpen = false;
      };

      document.addEventListener('click', handleOutsideClick, true);
      return () => {
        document.removeEventListener('click', handleOutsideClick, true);
      };
    }
  });
</script>

<svelte:head>
  <title>{MESSAGES.PAGE_TITLE} - Assixx</title>
</svelte:head>

{#if data.permissionDenied}
  <PermissionDenied addonName="das Inventar" />
{:else}
  <div class="container">
    <div class="card">
      <div class="card__header">
        <h2 class="card__title">
          <i class="fas fa-boxes-stacked mr-2"></i>
          {MESSAGES.PAGE_TITLE}
        </h2>
        <p class="mt-2 text-(--color-text-secondary)">
          {MESSAGES.PAGE_DESCRIPTION}
        </p>

        <div class="mt-6 flex items-center justify-between gap-4">
          <!-- Status Toggle Group -->
          <div
            class="toggle-group"
            id="inventory-status-toggle"
          >
            <button
              type="button"
              class="toggle-group__btn"
              class:active={currentStatusFilter === 'active'}
              title={MESSAGES.FILTER_ACTIVE_TITLE}
              onclick={() => {
                handleStatusToggle('active');
              }}
            >
              <i class="fas fa-check-circle"></i>
              Aktive
            </button>
            <button
              type="button"
              class="toggle-group__btn"
              class:active={currentStatusFilter === 'inactive'}
              title={MESSAGES.FILTER_INACTIVE_TITLE}
              onclick={() => {
                handleStatusToggle('inactive');
              }}
            >
              <i class="fas fa-times-circle"></i>
              Inaktive
            </button>
            <button
              type="button"
              class="toggle-group__btn"
              class:active={currentStatusFilter === 'archived'}
              title={MESSAGES.FILTER_ARCHIVED_TITLE}
              onclick={() => {
                handleStatusToggle('archived');
              }}
            >
              <i class="fas fa-archive"></i>
              Archiviert
            </button>
            <button
              type="button"
              class="toggle-group__btn"
              class:active={currentStatusFilter === 'all'}
              title={MESSAGES.FILTER_ALL_TITLE}
              onclick={() => {
                handleStatusToggle('all');
              }}
            >
              <i class="fas fa-list"></i>
              Alle
            </button>
          </div>

          <!-- Tag Filter + Manage -->
          <div class="flex items-center gap-2">
            <TagFilterDropdown
              selectedIds={selectedFilterTagIds}
              onchange={(ids: string[]) => {
                selectedFilterTagIds = ids;
              }}
            />
            {#if canWrite}
              <button
                type="button"
                class="btn btn-info"
                onclick={() => {
                  showTagsModal = true;
                }}
                title={MESSAGES.TAGS_MANAGE_BTN}
              >
                <i class="fas fa-tags mr-1"></i>
                {MESSAGES.TAGS_MANAGE_BTN}
              </button>
            {/if}
          </div>

          <!-- Search Input -->
          <div
            class="search-input-wrapper max-w-80"
            class:search-input-wrapper--open={searchOpen}
          >
            <div
              class="search-input"
              id="inventory-search-container"
            >
              <i class="search-input__icon fas fa-search"></i>
              <input
                type="search"
                id="inventory-search"
                class="search-input__field"
                placeholder={MESSAGES.SEARCH_PLACEHOLDER}
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
              id="inventory-search-results"
            >
              {#if currentSearchQuery && filteredLists.length === 0}
                <div class="search-input__no-results">
                  {MESSAGES.SEARCH_NO_RESULTS} "{currentSearchQuery}"
                </div>
              {:else if currentSearchQuery}
                {#each filteredLists.slice(0, 5) as list (list.id)}
                  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                  <div
                    class="search-input__result-item"
                    onclick={() => {
                      searchOpen = false;
                      currentSearchQuery = '';
                      openList(list.id);
                    }}
                  >
                    <i class="fas fa-boxes-stacked text-blue-500"></i>
                    <span>
                      <HighlightText
                        text={list.title}
                        query={currentSearchQuery}
                      />
                    </span>
                    {#if list.tags.length > 0}
                      <span class="ml-2 text-sm text-(--color-text-secondary)"
                        >&rarr; {list.tags.map((t) => t.name).join(', ')}</span
                      >
                    {/if}
                  </div>
                {/each}
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
              onclick={() => void invalidateAll()}>Erneut versuchen</button
            >
          </div>
        {:else if filteredLists.length === 0}
          <div
            id="inventory-empty"
            class="empty-state"
          >
            <div class="empty-state__icon">
              <i class="fas fa-boxes-stacked"></i>
            </div>
            <h3 class="empty-state__title">{MESSAGES.NO_LISTS_FOUND}</h3>
            <p class="empty-state__description">{MESSAGES.CREATE_FIRST_LIST}</p>
            {#if canWrite}
              <button
                type="button"
                class="btn btn-primary"
                onclick={openAddModal}
              >
                <i class="fas fa-plus"></i>
                {MESSAGES.BTN_ADD}
              </button>
            {/if}
          </div>
        {:else}
          <div class="inventory-grid">
            {#each filteredLists as list (list.id)}
              <ListCard
                {list}
                canEdit={canWrite}
                {canDelete}
                onedit={openEditModal}
                ondelete={openDeleteModal}
                onopen={openList}
              />
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>

  {#if canWrite}
    <!-- Floating Action Button -->
    <button
      type="button"
      class="btn-float"
      onclick={openAddModal}
      aria-label="Neue Liste erstellen"
    >
      <i class="fas fa-plus"></i>
    </button>
  {/if}

  <!-- Add/Edit List Modal -->
  {#if showListModal}
    <ListModal
      {isEditMode}
      {modalTitle}
      {formTitle}
      {formDescription}
      {formCodePrefix}
      {formCodeSeparator}
      {formCodeDigits}
      {formIcon}
      {formIsActive}
      {formTagIds}
      {submitting}
      onclose={closeListModal}
      onsubmit={handleFormSubmit}
    />
  {/if}

  <!-- Tags Management Modal -->
  {#if showTagsModal}
    <TagsManagementModal onclose={() => void handleTagsModalClose()} />
  {/if}

  <!-- Delete Confirm Modal -->
  <ConfirmModal
    show={showDeleteModal}
    id="delete-inventory-list-modal"
    title={MESSAGES.DELETE_CONFIRM_TITLE}
    variant="danger"
    icon="fa-exclamation-triangle"
    onconfirm={() => void handleDelete()}
    oncancel={closeDeleteModal}
  >
    <p>{MESSAGES.DELETE_CONFIRM_MESSAGE}</p>
  </ConfirmModal>
{/if}

<style>
  .inventory-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.25rem;
    padding: 0.25rem;
  }

  @media (width <= 640px) {
    .inventory-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
