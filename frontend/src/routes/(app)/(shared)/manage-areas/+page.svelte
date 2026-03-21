<script lang="ts">
  /**
   * Manage Areas - Page Component
   * @module manage-areas/+page
   *
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   */
  import { invalidateAll } from '$app/navigation';

  import HighlightText from '$lib/components/HighlightText.svelte';
  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
  import { showErrorAlert, showSuccessAlert } from '$lib/stores/toast';

  // =============================================================================
  // IMPORTS FROM _LIB
  // =============================================================================

  import {
    buildAreaPayload,
    saveArea,
    assignDepartmentsToArea,
    assignHallsToArea,
    deleteArea as apiDeleteArea,
    forceDeleteArea as apiForceDeleteArea,
  } from './_lib/api';
  import AreaModal from './_lib/AreaModal.svelte';
  import { createMessages } from './_lib/constants';
  import DeleteModals from './_lib/DeleteModals.svelte';
  import { filterByStatus, filterBySearch } from './_lib/filters';
  import {
    getStatusBadgeClass,
    getStatusLabel,
    getTypeLabel,
    getHallIdsForArea,
    populateFormFromArea,
    getDefaultFormValues,
  } from './_lib/utils';

  import type { PageData } from './$types';
  import type {
    Area,
    AdminUser,
    Department,
    Hall,
    StatusFilter,
    AreaType,
    FormIsActiveStatus,
  } from './_lib/types';

  // =============================================================================
  // SSR DATA - Level 3: $derived from props (single source of truth)
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // SSR data via $derived - updates when invalidateAll() is called
  const areas = $derived<Area[]>(data.areas);
  const areaLeads = $derived<AdminUser[]>(data.areaLeads);
  const allDepartments = $derived<Department[]>(data.departments);
  const allHalls = $derived<Hall[]>(data.halls);

  // Hierarchy labels from layout data inheritance (A6)
  const labels = $derived(data.hierarchyLabels);
  const messages = $derived(createMessages(labels));

  // =============================================================================
  // UI STATE - Filtering and form state (client-side only)
  // =============================================================================

  let statusFilter: StatusFilter = $state('active');
  let searchQuery = $state('');
  let submitting = $state(false);

  // Modal states
  let showAreaModal = $state(false);
  let showDeleteModal = $state(false);
  let showForceDeleteModal = $state(false);

  // Search dropdown state
  let searchResultsOpen = $state(false);

  // Edit mode
  let editingAreaId: number | null = $state(null);
  let deletingAreaId: number | null = $state(null);
  let forceDeleteMessage = $state('');

  // Form fields
  let formName = $state('');
  let formDescription = $state('');
  let formAreaLeadId: number | null = $state(null);
  let formType: AreaType = $state('other');
  let formCapacity: number | null = $state(null);
  let formAddress = $state('');
  let formDepartmentIds: number[] = $state([]);
  let formHallIds: number[] = $state([]);
  let formIsActive: FormIsActiveStatus = $state(1);

  // =============================================================================
  // COMPUTED / DERIVED
  // =============================================================================

  const isEditMode = $derived(editingAreaId !== null);
  const modalTitle = $derived(isEditMode ? messages.MODAL_TITLE_EDIT : messages.MODAL_TITLE_ADD);
  // Filter areas by status
  const statusFilteredAreas = $derived.by(() => filterByStatus(areas, statusFilter));

  // Filter by search query
  const filteredAreas = $derived.by(() => filterBySearch(statusFilteredAreas, searchQuery));

  // Search results (max 5)
  const searchResults = $derived(filteredAreas.slice(0, 5));
  const hasMoreResults = $derived(filteredAreas.length > 5);

  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================

  function openAddModal() {
    editingAreaId = null;
    resetForm();
    showAreaModal = true;
  }

  function openEditModal(id: number): void {
    const area = areas.find((a) => a.id === id);
    if (!area) return;

    editingAreaId = id;
    const formData = populateFormFromArea(area, allDepartments, allHalls);
    formName = formData.name;
    formDescription = formData.description;
    formAreaLeadId = formData.areaLeadId;
    formType = formData.type;
    formCapacity = formData.capacity;
    formAddress = formData.address;
    formDepartmentIds = formData.departmentIds;
    formHallIds = formData.hallIds;
    formIsActive = formData.isActive;

    showAreaModal = true;
  }

  function closeAreaModal() {
    showAreaModal = false;
    resetForm();
  }

  function resetForm() {
    const defaults = getDefaultFormValues();
    formName = defaults.name;
    formDescription = defaults.description;
    formAreaLeadId = defaults.areaLeadId;
    formType = defaults.type;
    formCapacity = defaults.capacity;
    formAddress = defaults.address;
    formDepartmentIds = defaults.departmentIds;
    formHallIds = defaults.hallIds;
    formIsActive = defaults.isActive;
    editingAreaId = null;
  }

  function openDeleteModal(id: number) {
    deletingAreaId = id;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    deletingAreaId = null;
  }

  function closeForceDeleteModal() {
    showForceDeleteModal = false;
    deletingAreaId = null;
    forceDeleteMessage = '';
  }

  // =============================================================================
  // FORM HANDLERS
  // =============================================================================

  async function handleFormSubmit(e: Event) {
    e.preventDefault();
    if (submitting) return;

    submitting = true;

    try {
      const payload = buildAreaPayload({
        name: formName,
        description: formDescription,
        areaLeadId: formAreaLeadId,
        type: formType,
        capacity: formCapacity,
        address: formAddress,
        departmentIds: formDepartmentIds,
        hallIds: formHallIds,
        isActive: formIsActive,
      });

      const result = await saveArea(payload, editingAreaId);

      if (result.success && result.areaId !== null) {
        // Assign departments + halls via dedicated endpoints
        await Promise.all([
          assignDepartmentsToArea(result.areaId, formDepartmentIds),
          assignHallsToArea(result.areaId, formHallIds),
        ]);

        showSuccessAlert(isEditMode ? messages.SUCCESS_UPDATED : messages.SUCCESS_CREATED);
        closeAreaModal();
        await invalidateAll();
      } else if (result.success) {
        // Fallback: area saved but no ID returned (shouldn't happen)
        showSuccessAlert(isEditMode ? messages.SUCCESS_UPDATED : messages.SUCCESS_CREATED);
        closeAreaModal();
        await invalidateAll();
      } else if (result.error !== null) {
        showErrorAlert(result.error);
      }
    } finally {
      // eslint-disable-next-line require-atomic-updates -- Guard clause at function start prevents concurrent execution
      submitting = false;
    }
  }

  async function deleteArea() {
    if (deletingAreaId === null) return;

    const result = await apiDeleteArea(deletingAreaId);

    if (result.success) {
      showSuccessAlert(messages.SUCCESS_DELETED);
      closeDeleteModal();
      // Level 3: Trigger SSR refetch
      await invalidateAll();
    } else if (result.hasDependencies === true) {
      forceDeleteMessage = result.dependencyMessage ?? messages.FORCE_DELETE_DEFAULT_MESSAGE;
      showDeleteModal = false;
      showForceDeleteModal = true;
    } else if (result.error !== null) {
      showErrorAlert(result.error);
      closeDeleteModal();
    }
  }

  async function forceDeleteArea() {
    if (deletingAreaId === null) return;

    const result = await apiForceDeleteArea(deletingAreaId);

    if (result.success) {
      showSuccessAlert(messages.SUCCESS_DELETED);
      closeForceDeleteModal();
      // Level 3: Trigger SSR refetch
      await invalidateAll();
    } else if (result.error !== null) {
      showErrorAlert(result.error);
      closeForceDeleteModal();
    }
  }

  // =============================================================================
  // STATUS FILTER HANDLER
  // =============================================================================

  function setStatusFilter(filter: StatusFilter) {
    statusFilter = filter;
  }

  // =============================================================================
  // SEARCH HANDLERS
  // =============================================================================

  function handleSearchFocus() {
    if (searchQuery.trim()) searchResultsOpen = true;
  }

  function handleSearchInput() {
    searchResultsOpen = searchQuery.trim().length > 0;
  }

  function clearSearch() {
    searchQuery = '';
    searchResultsOpen = false;
  }

  function handleSearchResultClick(id: number) {
    searchResultsOpen = false;
    searchQuery = '';
    openEditModal(id);
  }

  // =============================================================================
  // OUTSIDE CLICK EFFECT
  // =============================================================================

  $effect(() => {
    if (searchResultsOpen) {
      const handleOutsideClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.search-input-wrapper')) {
          searchResultsOpen = false;
        }
      };
      document.addEventListener('click', handleOutsideClick, true);
      return () => {
        document.removeEventListener('click', handleOutsideClick, true);
      };
    }
  });
</script>

{#if data.permissionDenied}
  <PermissionDenied addonName="die Bereichsverwaltung" />
{:else}
  <div class="container">
    <div class="card">
      <!-- Card Header -->
      <div class="card__header">
        <h2 class="card__title">
          <i class="fas fa-map-marked-alt mr-2"></i>
          {messages.PAGE_TITLE}
        </h2>
        <p class="mt-2 text-(--color-text-secondary)">
          {messages.PAGE_DESCRIPTION}
        </p>

        <!-- Controls Section -->
        <div class="mt-6 flex flex-wrap items-center justify-between gap-4">
          <!-- Status Filter Toggle -->
          <div class="toggle-group">
            <button
              type="button"
              class="toggle-group__btn"
              class:active={statusFilter === 'active'}
              onclick={() => {
                setStatusFilter('active');
              }}
              title={messages.FILTER_ACTIVE_TITLE}
            >
              <i class="fas fa-check"></i>
              {messages.FILTER_ACTIVE}
            </button>
            <button
              type="button"
              class="toggle-group__btn"
              class:active={statusFilter === 'inactive'}
              onclick={() => {
                setStatusFilter('inactive');
              }}
              title={messages.FILTER_INACTIVE_TITLE}
            >
              <i class="fas fa-times"></i>
              {messages.FILTER_INACTIVE}
            </button>
            <button
              type="button"
              class="toggle-group__btn"
              class:active={statusFilter === 'archived'}
              onclick={() => {
                setStatusFilter('archived');
              }}
              title={messages.FILTER_ARCHIVED_TITLE}
            >
              <i class="fas fa-archive"></i>
              {messages.FILTER_ARCHIVED}
            </button>
            <button
              type="button"
              class="toggle-group__btn"
              class:active={statusFilter === 'all'}
              onclick={() => {
                setStatusFilter('all');
              }}
              title={messages.FILTER_ALL_TITLE}
            >
              <i class="fas fa-map-marked-alt"></i>
              {messages.FILTER_ALL}
            </button>
          </div>

          <!-- Search Input -->
          <div
            class="search-input-wrapper max-w-80"
            class:search-input-wrapper--open={searchResultsOpen}
          >
            <div class="search-input">
              <i class="search-input__icon fas fa-search"></i>
              <input
                type="search"
                class="search-input__field"
                placeholder={messages.SEARCH_PLACEHOLDER}
                autocomplete="off"
                bind:value={searchQuery}
                onfocus={handleSearchFocus}
                oninput={handleSearchInput}
              />
              {#if searchQuery}
                <button
                  class="search-input__clear"
                  type="button"
                  aria-label="Suche löschen"
                  onclick={clearSearch}
                >
                  <i class="fas fa-times"></i>
                </button>
              {/if}
            </div>

            <!-- Search Results Dropdown -->
            {#if searchResultsOpen && searchQuery.trim()}
              <div class="search-input__results">
                {#if searchResults.length === 0}
                  <div class="search-input__no-results">
                    {messages.SEARCH_NO_RESULTS} "{searchQuery}"
                  </div>
                {:else}
                  {#each searchResults as area (area.id)}
                    <button
                      type="button"
                      class="search-input__result-item"
                      onclick={() => {
                        handleSearchResultClick(area.id);
                      }}
                    >
                      <div class="search-result-item">
                        <div class="search-result-item__name">
                          <HighlightText
                            text={area.name}
                            query={searchQuery}
                          />
                        </div>
                        <div class="search-result-item__email">
                          {getTypeLabel(area.type)}
                        </div>
                        <div class="search-result-item__meta">
                          <span class="badge {getStatusBadgeClass(area.isActive)}"
                            >{getStatusLabel(area.isActive)}</span
                          >
                        </div>
                      </div>
                    </button>
                  {/each}
                  {#if hasMoreResults}
                    <div class="search-result-item__more py-2">
                      {messages.moreResults(filteredAreas.length - 5)}
                    </div>
                  {/if}
                {/if}
              </div>
            {/if}
          </div>
        </div>
      </div>

      <div class="card__body">
        {#if filteredAreas.length === 0}
          <!-- Empty State -->
          <div class="empty-state">
            <div class="empty-state__icon">
              <i class="fas fa-map-marked-alt"></i>
            </div>
            <h3 class="empty-state__title">{messages.NO_AREAS_FOUND}</h3>
            <p class="empty-state__description">{messages.CREATE_FIRST_AREA}</p>
            <button
              type="button"
              class="btn btn-primary"
              onclick={openAddModal}
            >
              <i class="fas fa-plus"></i>
              {messages.BTN_ADD_AREA}
            </button>
          </div>
        {:else}
          <!-- Table Content -->
          <div class="table-responsive">
            <table class="data-table data-table--striped">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{messages.TH_NAME}</th>
                  <th>{messages.TH_DESCRIPTION}</th>
                  <th>{messages.TH_AREA_LEAD}</th>
                  <th>{messages.TH_TYPE}</th>
                  <th class="text-center">{messages.TH_CAPACITY}</th>
                  <th>{messages.TH_HALLS}</th>
                  <th>{messages.TH_DEPARTMENTS}</th>
                  <th>{messages.TH_STATUS}</th>
                  <th>{messages.TH_ACTIONS}</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredAreas as area (area.id)}
                  <tr data-area-id={area.id}>
                    <td><code class="text-muted">{area.id}</code></td>
                    <td>
                      <div class="font-medium text-(--color-text-primary)">
                        {area.name}
                      </div>
                    </td>
                    <td>
                      <div class="text-sm text-(--color-text-secondary)">
                        {area.description ?? '-'}
                      </div>
                    </td>
                    <td>
                      <div class="text-(--color-text-secondary)">
                        {area.areaLeadName ?? '-'}
                      </div>
                    </td>
                    <td>
                      <span class="badge badge--info">{getTypeLabel(area.type)}</span>
                    </td>
                    <td class="text-center">{area.capacity ?? '-'}</td>
                    <td>
                      {#if getHallIdsForArea(area.id, allHalls).length === 0}
                        <span
                          class="badge badge--secondary"
                          title="Keine zugeordnet">{messages.NO_HALLS}</span
                        >
                      {:else}
                        <span class="badge badge--info">
                          {getHallIdsForArea(area.id, allHalls).length === 1 ?
                            messages.ONE_HALL
                          : messages.multipleHalls(getHallIdsForArea(area.id, allHalls).length)}
                        </span>
                      {/if}
                    </td>
                    <td>
                      {#if Number(area.departmentCount ?? 0) === 0}
                        <span
                          class="badge badge--secondary"
                          title="Keine zugeordnet">{messages.NO_DEPARTMENTS}</span
                        >
                      {:else}
                        <span
                          class="badge badge--info"
                          title={area.departmentNames ?? ''}
                        >
                          {messages.multipleDepartments(Number(area.departmentCount ?? 0))}
                        </span>
                      {/if}
                    </td>
                    <td>
                      <span class="badge {getStatusBadgeClass(area.isActive)}"
                        >{getStatusLabel(area.isActive)}</span
                      >
                    </td>
                    <td>
                      <div class="flex gap-2">
                        <button
                          type="button"
                          class="action-icon action-icon--edit"
                          title="Bearbeiten"
                          aria-label="Bearbeiten"
                          onclick={() => {
                            openEditModal(area.id);
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
                            openDeleteModal(area.id);
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
        {/if}
      </div>
    </div>
  </div>

  <!-- Floating Action Button -->
  <button
    type="button"
    class="btn-float"
    onclick={openAddModal}
    aria-label="Hinzufügen"
  >
    <i class="fas fa-plus"></i>
  </button>

  <!-- Add/Edit Area Modal -->
  <AreaModal
    show={showAreaModal}
    {isEditMode}
    {modalTitle}
    {messages}
    bind:formName
    bind:formDescription
    bind:formAreaLeadId
    bind:formType
    bind:formCapacity
    bind:formDepartmentIds
    bind:formHallIds
    bind:formIsActive
    {areaLeads}
    {allDepartments}
    {allHalls}
    {submitting}
    onclose={closeAreaModal}
    onsubmit={handleFormSubmit}
  />

  <!-- Delete Modals -->
  <DeleteModals
    show={showDeleteModal}
    {showForceDeleteModal}
    {forceDeleteMessage}
    {messages}
    oncancel={closeDeleteModal}
    onconfirm={deleteArea}
    onCloseForceDelete={closeForceDeleteModal}
    onForceDelete={forceDeleteArea}
  />
{/if}
