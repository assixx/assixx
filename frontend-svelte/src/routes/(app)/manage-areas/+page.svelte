<script lang="ts">
  import { onMount } from 'svelte';
  import { showErrorAlert } from '$lib/stores/toast.js';

  // =============================================================================
  // IMPORTS FROM _LIB
  // =============================================================================

  import type {
    Area,
    AdminUser,
    Department,
    StatusFilter,
    AreaType,
    FormIsActiveStatus,
  } from './_lib/types';
  import { TYPE_OPTIONS, MESSAGES } from './_lib/constants';
  import {
    loadAreas as apiLoadAreas,
    loadAreaLeads as apiLoadAreaLeads,
    loadDepartments as apiLoadDepartments,
    buildAreaPayload,
    saveArea,
    deleteArea as apiDeleteArea,
    forceDeleteArea as apiForceDeleteArea,
  } from './_lib/api';
  import { filterByStatus, filterBySearch } from './_lib/filters';
  import {
    getStatusBadgeClass,
    getStatusLabel,
    getTypeLabel,
    highlightMatch,
    getAreaLeadDisplayName,
    populateFormFromArea,
    getDefaultFormValues,
  } from './_lib/utils';

  // =============================================================================
  // STATE
  // =============================================================================

  let areas: Area[] = $state([]);
  let areaLeads: AdminUser[] = $state([]);
  let allDepartments: Department[] = $state([]);

  let statusFilter: StatusFilter = $state('active');
  let searchQuery = $state('');
  let loading = $state(true);
  let submitting = $state(false);

  // Modal states
  let showAreaModal = $state(false);
  let showDeleteModal = $state(false);
  let showDeleteConfirmModal = $state(false);
  let showForceDeleteModal = $state(false);

  // Dropdown states
  let typeDropdownOpen = $state(false);
  let statusDropdownOpen = $state(false);
  let areaLeadDropdownOpen = $state(false);
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
  let formIsActive: FormIsActiveStatus = $state(1);

  // =============================================================================
  // COMPUTED / DERIVED
  // =============================================================================

  const isEditMode = $derived(editingAreaId !== null);
  const modalTitle = $derived(isEditMode ? MESSAGES.MODAL_TITLE_EDIT : MESSAGES.MODAL_TITLE_ADD);

  // Filter areas by status
  const statusFilteredAreas = $derived.by(() => {
    return filterByStatus(areas, statusFilter);
  });

  // Filter by search query
  const filteredAreas = $derived.by(() => {
    return filterBySearch(statusFilteredAreas, searchQuery);
  });

  // Search results (max 5)
  const searchResults = $derived(filteredAreas.slice(0, 5));
  const hasMoreResults = $derived(filteredAreas.length > 5);

  // Get area lead display name for dropdown
  const areaLeadDisplayName = $derived.by(() => {
    return getAreaLeadDisplayName(formAreaLeadId, areaLeads);
  });

  // =============================================================================
  // API FUNCTIONS
  // =============================================================================

  async function loadAreas() {
    loading = true;
    const result = await apiLoadAreas();
    areas = result.areas;
    if (result.error) {
      showErrorAlert(result.error);
    }
    loading = false;
  }

  async function loadAreaLeads() {
    const result = await apiLoadAreaLeads();
    areaLeads = result.users;
  }

  async function loadDepartments() {
    const result = await apiLoadDepartments();
    allDepartments = result.departments;
  }

  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================

  function openAddModal() {
    editingAreaId = null;
    resetForm();
    showAreaModal = true;
  }

  async function openEditModal(id: number) {
    const area = areas.find((a) => a.id === id);
    if (!area) return;

    editingAreaId = id;
    const formData = populateFormFromArea(area, allDepartments);
    formName = formData.name;
    formDescription = formData.description;
    formAreaLeadId = formData.areaLeadId;
    formType = formData.type;
    formCapacity = formData.capacity;
    formAddress = formData.address;
    formDepartmentIds = formData.departmentIds;
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
    formIsActive = defaults.isActive;
    editingAreaId = null;
    typeDropdownOpen = false;
    statusDropdownOpen = false;
    areaLeadDropdownOpen = false;
  }

  function openDeleteModal(id: number) {
    deletingAreaId = id;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
  }

  function proceedToDeleteConfirm() {
    showDeleteModal = false;
    showDeleteConfirmModal = true;
  }

  function closeDeleteConfirmModal() {
    showDeleteConfirmModal = false;
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

    const payload = buildAreaPayload({
      name: formName,
      description: formDescription,
      areaLeadId: formAreaLeadId,
      type: formType,
      capacity: formCapacity,
      address: formAddress,
      departmentIds: formDepartmentIds,
      isActive: formIsActive,
    });

    const result = await saveArea(payload, editingAreaId);

    if (result.success) {
      closeAreaModal();
      await loadAreas();
      await loadDepartments();
    } else if (result.error) {
      showErrorAlert(result.error);
    }

    submitting = false;
  }

  async function deleteArea() {
    if (!deletingAreaId) return;

    const result = await apiDeleteArea(deletingAreaId);

    if (result.success) {
      closeDeleteConfirmModal();
      await loadAreas();
    } else if (result.hasDependencies) {
      forceDeleteMessage = result.dependencyMessage ?? MESSAGES.FORCE_DELETE_DEFAULT_MESSAGE;
      showDeleteConfirmModal = false;
      showForceDeleteModal = true;
    } else if (result.error) {
      showErrorAlert(result.error);
      closeDeleteConfirmModal();
    }
  }

  async function forceDeleteArea() {
    if (!deletingAreaId) return;

    const result = await apiForceDeleteArea(deletingAreaId);

    if (result.success) {
      closeForceDeleteModal();
      await loadAreas();
    } else if (result.error) {
      showErrorAlert(result.error);
      closeForceDeleteModal();
    }
  }

  // =============================================================================
  // DROPDOWN HANDLERS
  // =============================================================================

  function selectType(type: AreaType) {
    formType = type;
    typeDropdownOpen = false;
  }

  function selectStatus(status: FormIsActiveStatus) {
    formIsActive = status;
    statusDropdownOpen = false;
  }

  function selectAreaLead(id: number | null) {
    formAreaLeadId = id;
    areaLeadDropdownOpen = false;
  }

  function setStatusFilter(filter: StatusFilter) {
    statusFilter = filter;
  }

  // =============================================================================
  // SEARCH HANDLERS
  // =============================================================================

  function handleSearchFocus() {
    if (searchQuery.trim()) {
      searchResultsOpen = true;
    }
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
  // OVERLAY CLICK HANDLERS
  // =============================================================================

  function handleModalOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      closeAreaModal();
    }
  }

  function handleDeleteOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      closeDeleteModal();
    }
  }

  function handleDeleteConfirmOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      closeDeleteConfirmModal();
    }
  }

  function handleForceDeleteOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      closeForceDeleteModal();
    }
  }

  // =============================================================================
  // OUTSIDE CLICK EFFECT
  // =============================================================================

  $effect(() => {
    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as HTMLElement;

      // Close type dropdown
      if (typeDropdownOpen && !target.closest('#type-dropdown')) {
        typeDropdownOpen = false;
      }

      // Close status dropdown
      if (statusDropdownOpen && !target.closest('#status-dropdown')) {
        statusDropdownOpen = false;
      }

      // Close area lead dropdown
      if (areaLeadDropdownOpen && !target.closest('#area-lead-dropdown')) {
        areaLeadDropdownOpen = false;
      }

      // Close search results
      if (searchResultsOpen && !target.closest('.search-input-wrapper')) {
        searchResultsOpen = false;
      }
    }

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  });

  // =============================================================================
  // LIFECYCLE
  // =============================================================================

  onMount(() => {
    loadAreas();
    loadAreaLeads();
    loadDepartments();
  });
</script>

<!-- ============================================================================= -->
<!-- TEMPLATE -->
<!-- ============================================================================= -->

<div class="container">
  <div class="card">
    <!-- Card Header -->
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-map-marked-alt mr-2"></i>
        {MESSAGES.PAGE_TITLE}
      </h2>
      <p class="text-[var(--color-text-secondary)] mt-2">{MESSAGES.PAGE_DESCRIPTION}</p>

      <!-- Controls Section -->
      <div class="flex gap-4 items-center justify-between mt-6 flex-wrap">
        <!-- Status Filter Toggle -->
        <div class="toggle-group">
          <button
            class="toggle-group__btn"
            class:active={statusFilter === 'active'}
            onclick={() => setStatusFilter('active')}
            title="Aktive Bereiche"
          >
            <i class="fas fa-check"></i>
            {MESSAGES.FILTER_ACTIVE}
          </button>
          <button
            class="toggle-group__btn"
            class:active={statusFilter === 'inactive'}
            onclick={() => setStatusFilter('inactive')}
            title="Inaktive Bereiche"
          >
            <i class="fas fa-times"></i>
            {MESSAGES.FILTER_INACTIVE}
          </button>
          <button
            class="toggle-group__btn"
            class:active={statusFilter === 'archived'}
            onclick={() => setStatusFilter('archived')}
            title="Archivierte Bereiche"
          >
            <i class="fas fa-archive"></i>
            {MESSAGES.FILTER_ARCHIVED}
          </button>
          <button
            class="toggle-group__btn"
            class:active={statusFilter === 'all'}
            onclick={() => setStatusFilter('all')}
            title="Alle Bereiche"
          >
            <i class="fas fa-map-marked-alt"></i>
            {MESSAGES.FILTER_ALL}
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
              placeholder={MESSAGES.SEARCH_PLACEHOLDER}
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
                  {MESSAGES.SEARCH_NO_RESULTS} "{searchQuery}"
                </div>
              {:else}
                {#each searchResults as area (area.id)}
                  <button
                    type="button"
                    class="search-input__result-item"
                    onclick={() => handleSearchResultClick(area.id)}
                  >
                    <div class="flex flex-col gap-1">
                      <div class="font-medium text-[var(--color-text-primary)]">
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -- Safe: highlightMatch uses escapeHtml internally -->
                        {@html highlightMatch(area.name, searchQuery)}
                      </div>
                      <div class="text-[0.813rem] text-[var(--color-text-secondary)]">
                        {getTypeLabel(area.type)}
                        {#if area.address}· {area.address}{/if}
                      </div>
                      <div class="text-xs">
                        <span class="badge {getStatusBadgeClass(area.is_active)}"
                          >{getStatusLabel(area.is_active)}</span
                        >
                      </div>
                    </div>
                  </button>
                {/each}
                {#if hasMoreResults}
                  <div
                    class="text-[0.813rem] text-[var(--color-primary)] text-center py-2 border-t border-[rgb(255_255_255/5%)]"
                  >
                    {MESSAGES.MORE_RESULTS(filteredAreas.length - 5)}
                  </div>
                {/if}
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </div>

    <div class="card__body">
      <!-- Loading State -->
      {#if loading}
        <div class="spinner-container">
          <div class="spinner-ring spinner-ring--md"></div>
          <p class="mt-2 text-[var(--color-text-secondary)]">{MESSAGES.LOADING}</p>
        </div>
      {:else if filteredAreas.length === 0}
        <!-- Empty State -->
        <div class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-map-marked-alt"></i>
          </div>
          <h3 class="empty-state__title">{MESSAGES.NO_AREAS_FOUND}</h3>
          <p class="empty-state__description">{MESSAGES.CREATE_FIRST_AREA}</p>
          <button class="btn btn-primary" onclick={openAddModal}>
            <i class="fas fa-plus"></i>
            {MESSAGES.BTN_ADD_AREA}
          </button>
        </div>
      {:else}
        <!-- Table Content -->
        <div class="table-responsive">
          <table class="data-table data-table--striped">
            <thead>
              <tr>
                <th>{MESSAGES.TH_NAME}</th>
                <th>{MESSAGES.TH_DESCRIPTION}</th>
                <th>{MESSAGES.TH_AREA_LEAD}</th>
                <th>{MESSAGES.TH_TYPE}</th>
                <th class="text-center">{MESSAGES.TH_CAPACITY}</th>
                <th>{MESSAGES.TH_ADDRESS}</th>
                <th>{MESSAGES.TH_DEPARTMENTS}</th>
                <th>{MESSAGES.TH_STATUS}</th>
                <th>{MESSAGES.TH_ACTIONS}</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredAreas as area (area.id)}
                <tr data-area-id={area.id}>
                  <td>
                    <div class="font-medium text-[var(--color-text-primary)]">{area.name}</div>
                  </td>
                  <td>
                    <div class="text-[var(--color-text-secondary)] text-sm">
                      {area.description ?? '-'}
                    </div>
                  </td>
                  <td>
                    <div class="text-[var(--color-text-secondary)]">
                      {area.area_lead_name ?? '-'}
                    </div>
                  </td>
                  <td>
                    <span class="badge badge--info">{getTypeLabel(area.type)}</span>
                  </td>
                  <td class="text-center">{area.capacity ?? '-'}</td>
                  <td>
                    <div class="text-sm">{area.address ?? '-'}</div>
                  </td>
                  <td>
                    {#if (area.department_count ?? 0) === 0}
                      <span class="badge badge--secondary" title="Keine Abteilungen zugeordnet"
                        >{MESSAGES.NO_DEPARTMENTS}</span
                      >
                    {:else}
                      <span class="badge badge--info" title={area.department_names ?? ''}>
                        {area.department_count === 1
                          ? MESSAGES.ONE_DEPARTMENT
                          : MESSAGES.MULTIPLE_DEPARTMENTS(area.department_count ?? 0)}
                      </span>
                    {/if}
                  </td>
                  <td>
                    <span class="badge {getStatusBadgeClass(area.is_active)}"
                      >{getStatusLabel(area.is_active)}</span
                    >
                  </td>
                  <td>
                    <div class="flex gap-2">
                      <button
                        class="action-icon action-icon--edit"
                        title="Bearbeiten"
                        aria-label="Bereich bearbeiten"
                        onclick={() => openEditModal(area.id)}
                      >
                        <i class="fas fa-edit"></i>
                      </button>
                      <button
                        class="action-icon action-icon--delete"
                        title="Löschen"
                        aria-label="Bereich löschen"
                        onclick={() => openDeleteModal(area.id)}
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
<button class="btn-float" onclick={openAddModal} aria-label="Bereich hinzufügen">
  <i class="fas fa-plus"></i>
</button>

<!-- Add/Edit Area Modal -->
<div
  id="area-modal"
  class="modal-overlay"
  class:modal-overlay--active={showAreaModal}
  role="dialog"
  aria-modal="true"
  aria-labelledby="area-modal-title"
  tabindex="-1"
  onclick={handleModalOverlayClick}
  onkeydown={(e) => e.key === 'Escape' && closeAreaModal()}
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
  <form
    id="area-form"
    class="ds-modal"
    onclick={(e) => e.stopPropagation()}
    onsubmit={handleFormSubmit}
  >
    <div class="ds-modal__header">
      <h3 class="ds-modal__title" id="area-modal-title">{modalTitle}</h3>
      <button type="button" class="ds-modal__close" aria-label="Schließen" onclick={closeAreaModal}>
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="ds-modal__body">
      <!-- Name -->
      <div class="form-field">
        <label class="form-field__label" for="area-name">
          {MESSAGES.LABEL_NAME} <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="area-name"
          name="name"
          class="form-field__control"
          required
          bind:value={formName}
          placeholder={MESSAGES.PLACEHOLDER_NAME}
        />
      </div>

      <!-- Description -->
      <div class="form-field">
        <label class="form-field__label" for="area-description">{MESSAGES.LABEL_DESCRIPTION}</label>
        <textarea
          id="area-description"
          name="description"
          class="form-field__control"
          rows="3"
          bind:value={formDescription}
          placeholder={MESSAGES.PLACEHOLDER_DESCRIPTION}
        ></textarea>
      </div>

      <!-- Area Lead Dropdown (Custom) -->
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <div class="form-field">
        <label class="form-field__label">
          <i class="fas fa-user-tie mr-1"></i>
          {MESSAGES.LABEL_AREA_LEAD}
        </label>
        <div class="dropdown" id="area-lead-dropdown">
          <button
            type="button"
            class="dropdown__trigger"
            class:active={areaLeadDropdownOpen}
            onclick={(e) => {
              e.stopPropagation();
              areaLeadDropdownOpen = !areaLeadDropdownOpen;
            }}
          >
            <span>{areaLeadDisplayName}</span>
            <i class="fas fa-chevron-down"></i>
          </button>
          <div class="dropdown__menu" class:active={areaLeadDropdownOpen}>
            <button type="button" class="dropdown__option" onclick={() => selectAreaLead(null)}>
              {MESSAGES.NO_AREA_LEAD}
            </button>
            {#each areaLeads as user (user.id)}
              <button
                type="button"
                class="dropdown__option"
                onclick={() => selectAreaLead(user.id)}
              >
                {user.firstName}
                {user.lastName}
                {user.role === 'root' ? '(Root)' : '(Admin)'}
              </button>
            {/each}
          </div>
        </div>
        <span class="form-field__message text-[var(--color-text-secondary)]">
          <i class="fas fa-info-circle mr-1"></i>
          {MESSAGES.AREA_LEAD_HINT}
        </span>
      </div>

      <!-- Type Dropdown (Custom) -->
      <div class="form-field">
        <label class="form-field__label" for="area-type">
          {MESSAGES.LABEL_TYPE} <span class="text-red-500">*</span>
        </label>
        <div class="dropdown" id="type-dropdown">
          <button
            type="button"
            class="dropdown__trigger"
            class:active={typeDropdownOpen}
            onclick={(e) => {
              e.stopPropagation();
              typeDropdownOpen = !typeDropdownOpen;
            }}
          >
            <span>{getTypeLabel(formType)}</span>
            <i class="fas fa-chevron-down"></i>
          </button>
          <div class="dropdown__menu" class:active={typeDropdownOpen}>
            {#each TYPE_OPTIONS as option (option.value)}
              <button
                type="button"
                class="dropdown__option"
                onclick={() => selectType(option.value)}
              >
                {option.label}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Capacity -->
      <div class="form-field">
        <label class="form-field__label" for="area-capacity">{MESSAGES.LABEL_CAPACITY}</label>
        <input
          type="number"
          id="area-capacity"
          name="capacity"
          class="form-field__control"
          min="0"
          bind:value={formCapacity}
          placeholder={MESSAGES.PLACEHOLDER_CAPACITY}
        />
      </div>

      <!-- Address -->
      <div class="form-field">
        <label class="form-field__label" for="area-address">{MESSAGES.LABEL_ADDRESS}</label>
        <input
          type="text"
          id="area-address"
          name="address"
          class="form-field__control"
          bind:value={formAddress}
          placeholder={MESSAGES.PLACEHOLDER_ADDRESS}
        />
      </div>

      <!-- Department Multi-Select -->
      <div class="form-field">
        <label class="form-field__label" for="area-departments">
          <i class="fas fa-sitemap mr-1"></i>
          {MESSAGES.LABEL_DEPARTMENTS}
        </label>
        <select
          id="area-departments"
          name="departmentIds"
          multiple
          class="form-field__control min-h-[120px]"
          bind:value={formDepartmentIds}
        >
          {#each allDepartments as dept (dept.id)}
            <option value={dept.id}>{dept.name}</option>
          {/each}
        </select>
        <span class="form-field__message text-[var(--color-text-secondary)]">
          <i class="fas fa-info-circle mr-1"></i>
          {MESSAGES.DEPARTMENTS_HINT}
        </span>
      </div>

      <!-- Status Dropdown (only in edit mode) -->
      {#if isEditMode}
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <div class="form-field">
          <label class="form-field__label">
            {MESSAGES.LABEL_STATUS} <span class="text-red-500">*</span>
          </label>
          <div class="dropdown" id="status-dropdown">
            <button
              type="button"
              class="dropdown__trigger"
              class:active={statusDropdownOpen}
              onclick={(e) => {
                e.stopPropagation();
                statusDropdownOpen = !statusDropdownOpen;
              }}
            >
              <span class="badge {getStatusBadgeClass(formIsActive)}"
                >{getStatusLabel(formIsActive)}</span
              >
              <i class="fas fa-chevron-down"></i>
            </button>
            <div class="dropdown__menu" class:active={statusDropdownOpen}>
              <button type="button" class="dropdown__option" onclick={() => selectStatus(1)}>
                <span class="badge badge--success">Aktiv</span>
              </button>
              <button type="button" class="dropdown__option" onclick={() => selectStatus(0)}>
                <span class="badge badge--warning">Inaktiv</span>
              </button>
              <button type="button" class="dropdown__option" onclick={() => selectStatus(3)}>
                <span class="badge badge--secondary">Archiviert</span>
              </button>
            </div>
          </div>
          <span class="form-field__message text-[var(--color-text-secondary)] mt-1 block">
            {MESSAGES.STATUS_HINT}
          </span>
        </div>
      {/if}
    </div>

    <div class="ds-modal__footer">
      <button type="button" class="btn btn-cancel" onclick={closeAreaModal}
        >{MESSAGES.BTN_CANCEL}</button
      >
      <button type="submit" class="btn btn-modal" disabled={submitting}>
        {#if submitting}<span class="spinner-ring spinner-ring--sm mr-2"></span>{/if}
        {MESSAGES.BTN_SAVE}
      </button>
    </div>
  </form>
</div>

<!-- Delete Modal Step 1 -->
<div
  id="delete-area-modal"
  class="modal-overlay"
  class:modal-overlay--active={showDeleteModal}
  role="dialog"
  aria-modal="true"
  aria-labelledby="delete-modal-title"
  tabindex="-1"
  onclick={handleDeleteOverlayClick}
  onkeydown={(e) => e.key === 'Escape' && closeDeleteModal()}
>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="ds-modal ds-modal--sm" onclick={(e) => e.stopPropagation()}>
    <div class="ds-modal__header">
      <h3 class="ds-modal__title" id="delete-modal-title">
        <i class="fas fa-trash-alt text-red-500 mr-2"></i>
        {MESSAGES.DELETE_TITLE}
      </h3>
      <button
        type="button"
        class="ds-modal__close"
        aria-label="Schließen"
        onclick={closeDeleteModal}
      >
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="ds-modal__body">
      <p class="text-[var(--color-text-secondary)]">
        Möchten Sie den Bereich "{areas.find((a) => a.id === deletingAreaId)?.name ?? ''}" wirklich
        löschen?
      </p>
    </div>
    <div class="ds-modal__footer">
      <button type="button" class="btn btn-cancel" onclick={closeDeleteModal}
        >{MESSAGES.BTN_CANCEL}</button
      >
      <button type="button" class="btn btn-danger" onclick={proceedToDeleteConfirm}
        >{MESSAGES.BTN_DELETE}</button
      >
    </div>
  </div>
</div>

<!-- Delete Modal Step 2 -->
<div
  id="delete-area-confirm-modal"
  class="modal-overlay"
  class:modal-overlay--active={showDeleteConfirmModal}
  role="dialog"
  aria-modal="true"
  aria-labelledby="delete-confirm-title"
  tabindex="-1"
  onclick={handleDeleteConfirmOverlayClick}
  onkeydown={(e) => e.key === 'Escape' && closeDeleteConfirmModal()}
>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="confirm-modal confirm-modal--danger" onclick={(e) => e.stopPropagation()}>
    <div class="confirm-modal__icon">
      <i class="fas fa-exclamation-triangle"></i>
    </div>
    <h3 class="confirm-modal__title" id="delete-confirm-title">{MESSAGES.DELETE_CONFIRM_TITLE}</h3>
    <p class="confirm-modal__message">
      <strong>ACHTUNG:</strong>
      {MESSAGES.DELETE_CONFIRM_WARNING}
      <br /><br />
      {MESSAGES.DELETE_CONFIRM_MESSAGE}
    </p>
    <div class="confirm-modal__actions">
      <button
        type="button"
        class="confirm-modal__btn confirm-modal__btn--cancel"
        onclick={closeDeleteConfirmModal}>{MESSAGES.BTN_CANCEL}</button
      >
      <button
        type="button"
        class="confirm-modal__btn confirm-modal__btn--danger"
        onclick={deleteArea}
      >
        {MESSAGES.BTN_DELETE_FINAL}
      </button>
    </div>
  </div>
</div>

<!-- Force Delete Warning Modal -->
<div
  id="force-delete-warning-modal"
  class="modal-overlay"
  class:modal-overlay--active={showForceDeleteModal}
  role="dialog"
  aria-modal="true"
  aria-labelledby="force-delete-title"
  tabindex="-1"
  onclick={handleForceDeleteOverlayClick}
  onkeydown={(e) => e.key === 'Escape' && closeForceDeleteModal()}
>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="confirm-modal confirm-modal--warning" onclick={(e) => e.stopPropagation()}>
    <div class="confirm-modal__icon">
      <i class="fas fa-exclamation-triangle"></i>
    </div>
    <h3 class="confirm-modal__title" id="force-delete-title">{MESSAGES.FORCE_DELETE_TITLE}</h3>
    <p class="confirm-modal__message">
      {forceDeleteMessage || MESSAGES.FORCE_DELETE_DEFAULT_MESSAGE}
    </p>
    <div class="confirm-modal__actions">
      <button
        type="button"
        class="confirm-modal__btn confirm-modal__btn--cancel"
        onclick={closeForceDeleteModal}>{MESSAGES.BTN_CANCEL}</button
      >
      <button
        type="button"
        class="confirm-modal__btn confirm-modal__btn--confirm"
        onclick={forceDeleteArea}
      >
        {MESSAGES.DELETE_TITLE}
      </button>
    </div>
  </div>
</div>
