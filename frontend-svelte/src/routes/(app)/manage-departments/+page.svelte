<script lang="ts">
  import { onMount } from 'svelte';
  import { showWarningAlert, showErrorAlert } from '$lib/stores/toast.js';

  // =============================================================================
  // IMPORTS FROM _LIB
  // =============================================================================

  import type {
    Department,
    Area,
    AdminUser,
    StatusFilter,
    FormIsActiveStatus,
    DependencyDetails,
  } from './_lib/types';
  import { MESSAGES } from './_lib/constants';
  import {
    loadDepartments as apiLoadDepartments,
    loadAreas as apiLoadAreas,
    loadDepartmentLeads as apiLoadDepartmentLeads,
    buildDepartmentPayload,
    saveDepartment as apiSaveDepartment,
    deleteDepartment as apiDeleteDepartment,
    forceDeleteDepartment as apiForceDeleteDepartment,
    buildDependencyMessage,
    checkSession,
  } from './_lib/api';
  import { applyAllFilters } from './_lib/filters';
  import {
    getStatusBadgeClass,
    getStatusLabel,
    getAreaDisplay,
    getLeadDisplay,
    getTeamCountText,
    highlightMatch,
    getSelectedAreaName,
    getSelectedLeadName,
    populateFormFromDepartment,
    getDefaultFormValues,
  } from './_lib/utils';

  // =============================================================================
  // STATE
  // =============================================================================

  // Department Data
  let allDepartments: Department[] = $state([]);
  let filteredDepartments: Department[] = $state([]);

  // Dropdown Data
  let allAreas: Area[] = $state([]);
  let allDepartmentLeads: AdminUser[] = $state([]);

  // Loading and Error States
  let loading = $state(true);
  let error: string | null = $state(null);

  // Filter State
  let currentStatusFilter: StatusFilter = $state('active');
  let currentSearchQuery = $state('');

  // Search State
  let searchOpen = $state(false);

  // Modal States
  let showDepartmentModal = $state(false);
  let showDeleteModal = $state(false);
  let showDeleteConfirmModal = $state(false);
  let showForceDeleteModal = $state(false);

  // Edit State
  let currentEditId: number | null = $state(null);
  let deleteDepartmentId: number | null = $state(null);

  // Force Delete State
  let forceDeleteMessage = $state('');

  // Form Fields
  let formName = $state('');
  let formDescription = $state('');
  let formAreaId: number | null = $state(null);
  let formDepartmentLeadId: number | null = $state(null);
  let formIsActive: FormIsActiveStatus = $state(1);

  // Dropdown States
  let areaDropdownOpen = $state(false);
  let leadDropdownOpen = $state(false);
  let statusDropdownOpen = $state(false);

  // Form Submit Loading
  let submitting = $state(false);

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const isEditMode = $derived(currentEditId !== null);
  const modalTitle = $derived(isEditMode ? MESSAGES.MODAL_TITLE_EDIT : MESSAGES.MODAL_TITLE_ADD);

  // Dropdown display names
  const selectedAreaName = $derived(getSelectedAreaName(formAreaId, allAreas));
  const selectedLeadName = $derived(getSelectedLeadName(formDepartmentLeadId, allDepartmentLeads));

  // =============================================================================
  // FILTER FUNCTIONS
  // =============================================================================

  function applyFilters() {
    filteredDepartments = applyAllFilters(allDepartments, currentStatusFilter, currentSearchQuery);
  }

  // =============================================================================
  // API FUNCTIONS
  // =============================================================================

  async function loadDepartments() {
    loading = true;
    error = null;

    const result = await apiLoadDepartments();
    allDepartments = result.departments;

    if (result.error) {
      error = result.error;
    }

    applyFilters();
    loading = false;
  }

  async function loadAreas() {
    const result = await apiLoadAreas();
    allAreas = result.areas;
  }

  async function loadDepartmentLeads() {
    const result = await apiLoadDepartmentLeads();
    allDepartmentLeads = result.users;
  }

  async function saveDepartment() {
    submitting = true;

    // Validate required fields
    if (!formName.trim()) {
      showWarningAlert(MESSAGES.VALIDATION_NAME_REQUIRED);
      submitting = false;
      return;
    }

    const payload = buildDepartmentPayload({
      name: formName,
      description: formDescription,
      areaId: formAreaId,
      departmentLeadId: formDepartmentLeadId,
      isActive: formIsActive,
    });

    const result = await apiSaveDepartment(payload, currentEditId);

    if (result.success) {
      closeDepartmentModal();
      await loadDepartments();
    } else if (result.error) {
      showErrorAlert(result.error);
    }

    submitting = false;
  }

  async function deleteDepartment() {
    if (deleteDepartmentId === null) return;

    const result = await apiDeleteDepartment(deleteDepartmentId);

    if (result.success) {
      showDeleteConfirmModal = false;
      deleteDepartmentId = null;
      await loadDepartments();
    } else if (result.hasDependencies && result.dependencyDetails) {
      showForceDeleteWarning(result.dependencyDetails);
    } else if (result.error) {
      showErrorAlert(result.error);
    }
  }

  async function forceDeleteDepartment() {
    if (deleteDepartmentId === null) return;

    const result = await apiForceDeleteDepartment(deleteDepartmentId);

    if (result.success) {
      showForceDeleteModal = false;
      deleteDepartmentId = null;
      await loadDepartments();
    } else if (result.error) {
      showErrorAlert(result.error);
    }
  }

  function showForceDeleteWarning(details: DependencyDetails) {
    showDeleteConfirmModal = false;
    const totalDeps = details.totalDependencies ?? 0;
    const depList = buildDependencyMessage(details);
    forceDeleteMessage = MESSAGES.FORCE_DELETE_MESSAGE(totalDeps, depList);
    showForceDeleteModal = true;
  }

  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================

  function openAddModal() {
    currentEditId = null;
    resetForm();
    showDepartmentModal = true;
    loadAreas();
    loadDepartmentLeads();
  }

  async function openEditModal(departmentId: number) {
    const department = allDepartments.find((d) => d.id === departmentId);
    if (!department) return;

    currentEditId = departmentId;
    const formData = populateFormFromDepartment(department);
    formName = formData.name;
    formDescription = formData.description;
    formAreaId = formData.areaId;
    formDepartmentLeadId = formData.departmentLeadId;
    formIsActive = formData.isActive;

    await Promise.all([loadAreas(), loadDepartmentLeads()]);
    showDepartmentModal = true;
  }

  function openDeleteModal(departmentId: number) {
    deleteDepartmentId = departmentId;
    showDeleteModal = true;
  }

  function proceedToDeleteConfirm() {
    showDeleteModal = false;
    showDeleteConfirmModal = true;
  }

  function closeDepartmentModal() {
    showDepartmentModal = false;
    currentEditId = null;
    resetForm();
  }

  function closeDeleteModalFn() {
    showDeleteModal = false;
    deleteDepartmentId = null;
  }

  function closeDeleteConfirmModal() {
    showDeleteConfirmModal = false;
    deleteDepartmentId = null;
  }

  function closeForceDeleteModalFn() {
    showForceDeleteModal = false;
    deleteDepartmentId = null;
    forceDeleteMessage = '';
  }

  function resetForm() {
    const defaults = getDefaultFormValues();
    formName = defaults.name;
    formDescription = defaults.description;
    formAreaId = defaults.areaId;
    formDepartmentLeadId = defaults.departmentLeadId;
    formIsActive = defaults.isActive;
    areaDropdownOpen = false;
    leadDropdownOpen = false;
    statusDropdownOpen = false;
  }

  // =============================================================================
  // DROPDOWN HANDLERS
  // =============================================================================

  function toggleAreaDropdown(e: MouseEvent) {
    e.stopPropagation();
    leadDropdownOpen = false;
    statusDropdownOpen = false;
    areaDropdownOpen = !areaDropdownOpen;
  }

  function selectArea(areaId: number | null) {
    formAreaId = areaId;
    areaDropdownOpen = false;
  }

  function toggleLeadDropdown(e: MouseEvent) {
    e.stopPropagation();
    areaDropdownOpen = false;
    statusDropdownOpen = false;
    leadDropdownOpen = !leadDropdownOpen;
  }

  function selectLead(leadId: number | null) {
    formDepartmentLeadId = leadId;
    leadDropdownOpen = false;
  }

  function toggleStatusDropdown(e: MouseEvent) {
    e.stopPropagation();
    areaDropdownOpen = false;
    leadDropdownOpen = false;
    statusDropdownOpen = !statusDropdownOpen;
  }

  function selectStatus(status: FormIsActiveStatus) {
    formIsActive = status;
    statusDropdownOpen = false;
  }

  // =============================================================================
  // STATUS TOGGLE HANDLER
  // =============================================================================

  function handleStatusToggle(status: StatusFilter) {
    currentStatusFilter = status;
    applyFilters();
  }

  // =============================================================================
  // SEARCH HANDLERS
  // =============================================================================

  function handleSearchInput(e: Event) {
    const input = e.target as HTMLInputElement;
    currentSearchQuery = input.value;
    searchOpen = currentSearchQuery.trim().length > 0;
    applyFilters();
  }

  function clearSearch() {
    currentSearchQuery = '';
    searchOpen = false;
    applyFilters();
  }

  function handleSearchResultClick(departmentId: number) {
    openEditModal(departmentId);
    searchOpen = false;
    currentSearchQuery = '';
  }

  // =============================================================================
  // FORM SUBMIT HANDLER
  // =============================================================================

  function handleFormSubmit(e: Event) {
    e.preventDefault();
    saveDepartment();
  }

  // =============================================================================
  // OVERLAY CLICK HANDLERS
  // =============================================================================

  function handleModalOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) closeDepartmentModal();
  }

  function handleDeleteOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) closeDeleteModalFn();
  }

  function handleDeleteConfirmOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) closeDeleteConfirmModal();
  }

  function handleForceDeleteOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) closeForceDeleteModalFn();
  }

  // =============================================================================
  // OUTSIDE CLICK HANDLERS
  // =============================================================================

  $effect(() => {
    if (areaDropdownOpen || leadDropdownOpen || statusDropdownOpen || searchOpen) {
      const handleOutsideClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;

        if (areaDropdownOpen) {
          const el = document.getElementById('area-dropdown');
          if (el && !el.contains(target)) areaDropdownOpen = false;
        }

        if (leadDropdownOpen) {
          const el = document.getElementById('lead-dropdown');
          if (el && !el.contains(target)) leadDropdownOpen = false;
        }

        if (statusDropdownOpen) {
          const el = document.getElementById('status-dropdown');
          if (el && !el.contains(target)) statusDropdownOpen = false;
        }

        if (searchOpen) {
          const el = document.querySelector('.search-input-wrapper');
          if (el && !el.contains(target)) searchOpen = false;
        }
      };

      document.addEventListener('click', handleOutsideClick);
      return () => document.removeEventListener('click', handleOutsideClick);
    }
  });

  // =============================================================================
  // ESCAPE KEY HANDLER
  // =============================================================================

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (showForceDeleteModal) closeForceDeleteModalFn();
      else if (showDeleteConfirmModal) closeDeleteConfirmModal();
      else if (showDeleteModal) closeDeleteModalFn();
      else if (showDepartmentModal) closeDepartmentModal();
    }
  }

  // =============================================================================
  // LIFECYCLE
  // =============================================================================

  onMount(() => {
    if (!checkSession()) return;
    loadDepartments();
  });
</script>

<svelte:head>
  <title>{MESSAGES.PAGE_TITLE}</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="container">
  <div class="card">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-building mr-2"></i>
        {MESSAGES.PAGE_HEADING}
      </h2>
      <p class="text-[var(--color-text-secondary)] mt-2">{MESSAGES.PAGE_DESCRIPTION}</p>

      <div class="flex gap-4 items-center justify-between mt-6">
        <!-- Status Toggle Group -->
        <div class="toggle-group" id="department-status-toggle">
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'active'}
            title="Aktive Abteilungen"
            onclick={() => handleStatusToggle('active')}
          >
            <i class="fas fa-check"></i>
            {MESSAGES.FILTER_ACTIVE}
          </button>
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'inactive'}
            title="Inaktive Abteilungen"
            onclick={() => handleStatusToggle('inactive')}
          >
            <i class="fas fa-times"></i>
            {MESSAGES.FILTER_INACTIVE}
          </button>
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'archived'}
            title="Archivierte Abteilungen"
            onclick={() => handleStatusToggle('archived')}
          >
            <i class="fas fa-archive"></i>
            {MESSAGES.FILTER_ARCHIVED}
          </button>
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'all'}
            title="Alle Abteilungen"
            onclick={() => handleStatusToggle('all')}
          >
            <i class="fas fa-building"></i>
            {MESSAGES.FILTER_ALL}
          </button>
        </div>

        <!-- Search Input -->
        <div class="search-input-wrapper max-w-80" class:search-input-wrapper--open={searchOpen}>
          <div class="search-input" id="department-search-container">
            <i class="search-input__icon fas fa-search"></i>
            <input
              type="search"
              id="department-search"
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
          <div class="search-input__results" id="department-search-results">
            {#if currentSearchQuery && filteredDepartments.length === 0}
              <div class="search-input__no-results">
                {MESSAGES.SEARCH_NO_RESULTS} "{currentSearchQuery}"
              </div>
            {:else if currentSearchQuery}
              {#each filteredDepartments.slice(0, 5) as dept (dept.id)}
                <button
                  type="button"
                  class="search-input__result-item"
                  onclick={() => handleSearchResultClick(dept.id)}
                >
                  <div class="flex flex-col gap-1">
                    <div class="font-medium text-[var(--color-text-primary)]">
                      <!-- eslint-disable-next-line svelte/no-at-html-tags -- Safe: highlightMatch escapes input -->
                      {@html highlightMatch(dept.name, currentSearchQuery)}
                    </div>
                    <div class="text-[0.813rem] text-[var(--color-text-secondary)]">
                      {getAreaDisplay(dept.areaName)}
                    </div>
                    <div class="text-xs text-[var(--color-text-muted)]">
                      {dept.employeeCount ?? 0} Mitarbeiter
                    </div>
                  </div>
                </button>
              {/each}
              {#if filteredDepartments.length > 5}
                <div
                  class="text-[0.813rem] text-[var(--color-primary)] text-center py-2 border-t border-[rgb(255_255_255/5%)]"
                >
                  {MESSAGES.MORE_RESULTS(filteredDepartments.length - 5)}
                </div>
              {/if}
            {/if}
          </div>
        </div>
      </div>
    </div>

    <div class="card__body">
      {#if loading}
        <div id="departments-loading" class="spinner-container">
          <div class="spinner-ring spinner-ring--md"></div>
          <p class="mt-2 text-[var(--color-text-secondary)]">{MESSAGES.LOADING}</p>
        </div>
      {:else if error}
        <div class="text-center p-6">
          <i class="fas fa-exclamation-triangle text-4xl text-[var(--color-danger)] mb-4"></i>
          <p class="text-[var(--color-text-secondary)]">{error}</p>
          <button class="btn btn-primary mt-4" onclick={() => loadDepartments()}
            >{MESSAGES.BTN_RETRY}</button
          >
        </div>
      {:else if filteredDepartments.length === 0}
        <div id="departments-empty" class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-building"></i>
          </div>
          <h3 class="empty-state__title">{MESSAGES.NO_DEPARTMENTS_FOUND}</h3>
          <p class="empty-state__description">{MESSAGES.CREATE_FIRST_DEPARTMENT}</p>
          <button class="btn btn-primary" onclick={openAddModal}>
            <i class="fas fa-plus"></i>
            {MESSAGES.BTN_ADD_DEPARTMENT}
          </button>
        </div>
      {:else}
        <div id="departments-table-content">
          <div class="table-responsive">
            <table class="data-table data-table--hover data-table--striped" id="departments-table">
              <thead>
                <tr>
                  <th scope="col">{MESSAGES.TH_NAME}</th>
                  <th scope="col">{MESSAGES.TH_DESCRIPTION}</th>
                  <th scope="col">{MESSAGES.TH_STATUS}</th>
                  <th scope="col">{MESSAGES.TH_AREA}</th>
                  <th scope="col">{MESSAGES.TH_DEPARTMENT_LEAD}</th>
                  <th scope="col">{MESSAGES.TH_TEAMS}</th>
                  <th scope="col">{MESSAGES.TH_ACTIONS}</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredDepartments as dept (dept.id)}
                  <tr>
                    <td>
                      <div class="font-medium text-[var(--color-text-primary)]">
                        {dept.name}
                      </div>
                    </td>
                    <td>
                      <div class="text-[var(--color-text-secondary)] text-sm">
                        {dept.description ?? '-'}
                      </div>
                    </td>
                    <td>
                      <span class="badge {getStatusBadgeClass(dept.isActive)}"
                        >{getStatusLabel(dept.isActive)}</span
                      >
                    </td>
                    <td>
                      <span
                        class="badge {dept.areaName ? 'badge--info' : 'badge--secondary'}"
                        title={dept.areaName ?? 'Kein Bereich zugewiesen'}
                      >
                        {getAreaDisplay(dept.areaName)}
                      </span>
                    </td>
                    <td>
                      <span class="text-[var(--color-text-primary)]">
                        {getLeadDisplay(dept.departmentLeadName)}
                      </span>
                    </td>
                    <td>
                      <div class="text-center">
                        <span
                          class="badge {(dept.teamCount ?? 0) > 0
                            ? 'badge--info'
                            : 'badge--secondary'}"
                          title={dept.teamNames ?? 'Keine Teams zugewiesen'}
                        >
                          {getTeamCountText(dept.teamCount ?? 0)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div class="flex gap-2">
                        <button
                          class="action-icon action-icon--edit"
                          title="Bearbeiten"
                          aria-label="Abteilung bearbeiten"
                          onclick={() => openEditModal(dept.id)}
                        >
                          <i class="fas fa-edit"></i>
                        </button>
                        <button
                          class="action-icon action-icon--delete"
                          title="Löschen"
                          aria-label="Abteilung löschen"
                          onclick={() => openDeleteModal(dept.id)}
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
<button class="btn-float" onclick={openAddModal} aria-label="Abteilung hinzufügen">
  <i class="fas fa-plus"></i>
</button>

<!-- Add/Edit Department Modal -->
<div
  id="department-modal"
  class="modal-overlay"
  class:modal-overlay--active={showDepartmentModal}
  role="dialog"
  aria-modal="true"
  aria-labelledby="department-modal-title"
  tabindex="-1"
  onclick={handleModalOverlayClick}
  onkeydown={(e) => e.key === 'Escape' && closeDepartmentModal()}
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
  <form
    id="department-form"
    class="ds-modal"
    onclick={(e) => e.stopPropagation()}
    onsubmit={handleFormSubmit}
  >
    <div class="ds-modal__header">
      <h3 class="ds-modal__title" id="department-modal-title">{modalTitle}</h3>
      <button
        type="button"
        class="ds-modal__close"
        aria-label="Schließen"
        onclick={closeDepartmentModal}
      >
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="ds-modal__body">
      <div class="form-field">
        <label class="form-field__label" for="department-name">
          {MESSAGES.LABEL_NAME} <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="department-name"
          name="name"
          class="form-field__control"
          required
          bind:value={formName}
        />
      </div>

      <div class="form-field">
        <label class="form-field__label" for="department-description"
          >{MESSAGES.LABEL_DESCRIPTION}</label
        >
        <textarea
          id="department-description"
          name="description"
          class="form-field__control"
          rows="3"
          bind:value={formDescription}
        ></textarea>
      </div>

      <div class="form-field">
        <label class="form-field__label" for="department-area">{MESSAGES.LABEL_AREA}</label>
        <div class="dropdown" id="area-dropdown">
          <button
            type="button"
            class="dropdown__trigger"
            class:active={areaDropdownOpen}
            onclick={toggleAreaDropdown}
          >
            <span>{selectedAreaName}</span>
            <i class="fas fa-chevron-down"></i>
          </button>
          <div class="dropdown__menu" class:active={areaDropdownOpen}>
            <button type="button" class="dropdown__option" onclick={() => selectArea(null)}>
              {MESSAGES.NO_AREA}
            </button>
            {#each allAreas as area (area.id)}
              <button type="button" class="dropdown__option" onclick={() => selectArea(area.id)}>
                {area.name}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- svelte-ignore a11y_label_has_associated_control -->
      <div class="form-field">
        <label class="form-field__label">
          <i class="fas fa-user-tie mr-1"></i>
          {MESSAGES.LABEL_DEPARTMENT_LEAD}
        </label>
        <div class="dropdown" id="lead-dropdown">
          <button
            type="button"
            class="dropdown__trigger"
            class:active={leadDropdownOpen}
            onclick={toggleLeadDropdown}
          >
            <span>{selectedLeadName}</span>
            <i class="fas fa-chevron-down"></i>
          </button>
          <div class="dropdown__menu" class:active={leadDropdownOpen}>
            <button type="button" class="dropdown__option" onclick={() => selectLead(null)}>
              {MESSAGES.NO_DEPARTMENT_LEAD}
            </button>
            {#each allDepartmentLeads as lead (lead.id)}
              <button type="button" class="dropdown__option" onclick={() => selectLead(lead.id)}>
                {lead.firstName}
                {lead.lastName} ({lead.role === 'root' ? 'Root' : 'Admin'})
              </button>
            {/each}
          </div>
        </div>
        <span class="form-field__message text-[var(--color-text-secondary)]">
          <i class="fas fa-info-circle mr-1"></i>
          {MESSAGES.DEPARTMENT_LEAD_HINT}
        </span>
      </div>

      {#if isEditMode}
        <div class="form-field" id="status-field-group">
          <label class="form-field__label" for="department-status">
            {MESSAGES.LABEL_STATUS} <span class="text-red-500">*</span>
          </label>
          <div class="dropdown" id="status-dropdown">
            <button
              type="button"
              class="dropdown__trigger"
              class:active={statusDropdownOpen}
              onclick={toggleStatusDropdown}
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
      <button type="button" class="btn btn-cancel" onclick={closeDepartmentModal}
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
  id="delete-department-modal"
  class="modal-overlay"
  class:modal-overlay--active={showDeleteModal}
  role="dialog"
  aria-modal="true"
  aria-labelledby="delete-modal-title"
  tabindex="-1"
  onclick={handleDeleteOverlayClick}
  onkeydown={(e) => e.key === 'Escape' && closeDeleteModalFn()}
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
        onclick={closeDeleteModalFn}
      >
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="ds-modal__body">
      <p class="text-[var(--color-text-secondary)]">
        {MESSAGES.DELETE_QUESTION}
      </p>
    </div>
    <div class="ds-modal__footer">
      <button type="button" class="btn btn-cancel" onclick={closeDeleteModalFn}
        >{MESSAGES.BTN_CANCEL}</button
      >
      <button type="button" class="btn btn-danger" onclick={proceedToDeleteConfirm}
        >{MESSAGES.BTN_DELETE}</button
      >
    </div>
  </div>
</div>

<!-- Delete Modal Step 2: Final Confirmation -->
<div
  id="delete-department-confirm-modal"
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
        onclick={deleteDepartment}
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
  onkeydown={(e) => e.key === 'Escape' && closeForceDeleteModalFn()}
>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="confirm-modal confirm-modal--warning" onclick={(e) => e.stopPropagation()}>
    <div class="confirm-modal__icon">
      <i class="fas fa-exclamation-triangle"></i>
    </div>
    <h3 class="confirm-modal__title" id="force-delete-title">{MESSAGES.FORCE_DELETE_TITLE}</h3>
    <p class="confirm-modal__message">
      {forceDeleteMessage}
    </p>
    <div class="confirm-modal__actions">
      <button
        type="button"
        class="confirm-modal__btn confirm-modal__btn--cancel"
        onclick={closeForceDeleteModalFn}>{MESSAGES.BTN_CANCEL}</button
      >
      <button
        type="button"
        class="confirm-modal__btn confirm-modal__btn--confirm"
        onclick={forceDeleteDepartment}
      >
        {MESSAGES.DELETE_TITLE}
      </button>
    </div>
  </div>
</div>
