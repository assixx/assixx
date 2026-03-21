<script lang="ts">
  /**
   * Manage Departments - Page Component
   * @module manage-departments/+page
   *
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   */
  import { invalidateAll } from '$app/navigation';

  import HighlightText from '$lib/components/HighlightText.svelte';
  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
  import { showWarningAlert, showErrorAlert, showSuccessAlert } from '$lib/stores/toast';

  import {
    buildDepartmentPayload,
    saveDepartment as apiSaveDepartment,
    assignHallsToDepartment as apiAssignHalls,
    deleteDepartment as apiDeleteDepartment,
    forceDeleteDepartment as apiForceDeleteDepartment,
    buildDependencyMessage,
  } from './_lib/api';
  import { createMessages, createDependencyLabels } from './_lib/constants';
  import DeleteModals from './_lib/DeleteModals.svelte';
  import DepartmentModal from './_lib/DepartmentModal.svelte';
  import { applyAllFilters } from './_lib/filters';
  import {
    getStatusBadgeClass,
    getStatusLabel,
    getAreaDisplay,
    getLeadDisplay,
    getTeamCountText,
    getHallCountText,
    populateFormFromDepartment,
    getDefaultFormValues,
  } from './_lib/utils';

  import type { PageData } from './$types';
  import type {
    Department,
    Area,
    AdminUser,
    Hall,
    StatusFilter,
    FormIsActiveStatus,
    DependencyDetails,
  } from './_lib/types';

  // =============================================================================
  // SSR DATA - Level 3: $derived from props (single source of truth)
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // SSR data via $derived - updates when invalidateAll() is called
  const allDepartments = $derived<Department[]>(data.departments);
  const allAreas = $derived<Area[]>(data.areas);
  const allHalls = $derived<Hall[]>(data.halls);
  const allDepartmentLeads = $derived<AdminUser[]>(data.departmentLeads);

  // Hierarchy labels from layout data inheritance (A6)
  const labels = $derived(data.hierarchyLabels);
  const messages = $derived(createMessages(labels));
  const dependencyLabels = $derived(createDependencyLabels(labels));

  // =============================================================================
  // UI STATE - Filtering and form state (client-side only)
  // =============================================================================

  // Error state
  const error = $state<string | null>(null);

  // Filter State
  let currentStatusFilter: StatusFilter = $state('active');
  let currentSearchQuery = $state('');

  // Search State
  let searchOpen = $state(false);

  // Modal States
  let showDepartmentModal = $state(false);
  let showDeleteModal = $state(false);
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
  let formDepartmentDeputyLeadId: number | null = $state(null);
  let formHallIds: number[] = $state([]);
  let formIsActive: FormIsActiveStatus = $state(1);

  // Form Submit Loading
  let submitting = $state(false);

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const isEditMode = $derived(currentEditId !== null);
  const modalTitle = $derived(isEditMode ? messages.MODAL_TITLE_EDIT : messages.MODAL_TITLE_ADD);

  // Derived: Filtered departments based on current filter/search state
  const filteredDepartments = $derived(
    applyAllFilters(allDepartments, currentStatusFilter, currentSearchQuery),
  );

  // =============================================================================
  // API FUNCTIONS - Level 3: invalidateAll() after mutations
  // =============================================================================

  async function saveDepartment(): Promise<void> {
    submitting = true;
    if (!formName.trim()) {
      showWarningAlert(messages.VALIDATION_NAME_REQUIRED);
      submitting = false;
      return;
    }
    const payload = buildDepartmentPayload({
      name: formName,
      description: formDescription,
      areaId: formAreaId,
      departmentLeadId: formDepartmentLeadId,
      departmentDeputyLeadId: formDepartmentDeputyLeadId,
      isActive: formIsActive,
    });
    const result = await apiSaveDepartment(payload, currentEditId);
    if (result.success && result.departmentId !== null) {
      await apiAssignHalls(result.departmentId, formHallIds);
      closeDepartmentModal();
      await invalidateAll();
      showSuccessAlert(isEditMode ? 'Erfolgreich aktualisiert' : 'Erfolgreich erstellt');
    } else if (result.success) {
      closeDepartmentModal();
      await invalidateAll();
      showSuccessAlert(isEditMode ? 'Erfolgreich aktualisiert' : 'Erfolgreich erstellt');
    } else if (result.error !== null) {
      showErrorAlert(result.error);
    }
    submitting = false;
  }

  async function deleteDepartment(): Promise<void> {
    const idToDelete = deleteDepartmentId;
    if (idToDelete === null) return;
    // Clear immediately after capture to prevent race conditions
    deleteDepartmentId = null;
    showDeleteModal = false;

    const result = await apiDeleteDepartment(idToDelete);
    if (result.success) {
      // Level 3: Trigger SSR refetch
      await invalidateAll();
      showSuccessAlert('Erfolgreich gelöscht');
    } else if (result.hasDependencies === true && result.dependencyDetails !== undefined) {
      showForceDeleteWarning(result.dependencyDetails);
    } else if (result.error !== null) {
      showErrorAlert(result.error);
    }
  }

  async function forceDeleteDepartment(): Promise<void> {
    const idToDelete = deleteDepartmentId;
    if (idToDelete === null) return;
    // Clear immediately after capture to prevent race conditions
    deleteDepartmentId = null;
    showForceDeleteModal = false;

    const result = await apiForceDeleteDepartment(idToDelete);
    if (result.success) {
      // Level 3: Trigger SSR refetch
      await invalidateAll();
      showSuccessAlert('Erfolgreich gelöscht');
    } else if (result.error !== null) {
      showErrorAlert(result.error);
    }
  }

  function showForceDeleteWarning(details: DependencyDetails) {
    showDeleteModal = false;
    const totalDeps = details.totalDependencies ?? 0;
    const depList = buildDependencyMessage(details, dependencyLabels);
    forceDeleteMessage = messages.forceDeleteMessage(totalDeps, depList);
    showForceDeleteModal = true;
  }

  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================

  function openAddModal() {
    currentEditId = null;
    resetForm();
    showDepartmentModal = true;
    // Areas and department leads already loaded via SSR
  }

  function openEditModal(departmentId: number): void {
    const department = allDepartments.find((d) => d.id === departmentId);
    if (!department) return;
    currentEditId = departmentId;
    const formData = populateFormFromDepartment(department, department.hallIds ?? []);
    formName = formData.name;
    formDescription = formData.description;
    formAreaId = formData.areaId;
    formDepartmentLeadId = formData.departmentLeadId;
    formDepartmentDeputyLeadId = formData.departmentDeputyLeadId;
    formHallIds = formData.hallIds;
    formIsActive = formData.isActive;
    showDepartmentModal = true;
  }

  function openDeleteModal(departmentId: number) {
    deleteDepartmentId = departmentId;
    showDeleteModal = true;
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
    formDepartmentDeputyLeadId = defaults.departmentDeputyLeadId;
    formHallIds = defaults.hallIds;
    formIsActive = defaults.isActive;
  }

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  function handleStatusToggle(status: StatusFilter): void {
    currentStatusFilter = status;
    // filteredDepartments is $derived - automatically updates when filter changes
  }

  function handleSearchInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    currentSearchQuery = input.value;
    searchOpen = currentSearchQuery.trim().length > 0;
    // filteredDepartments is $derived - automatically updates when search changes
  }

  function clearSearch(): void {
    currentSearchQuery = '';
    searchOpen = false;
    // filteredDepartments is $derived - automatically updates
  }

  function handleSearchResultClick(departmentId: number) {
    openEditModal(departmentId);
    searchOpen = false;
    currentSearchQuery = '';
  }

  // =============================================================================
  // FORM SUBMIT HANDLER
  // =============================================================================

  async function handleFormSubmit(e: Event): Promise<void> {
    e.preventDefault();
    await saveDepartment();
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

{#if data.permissionDenied}
  <PermissionDenied addonName="die Abteilungsverwaltung" />
{:else}
  <div class="container">
    <div class="card">
      <div class="card__header">
        <h2 class="card__title">
          <i class="fas fa-building mr-2"></i>
          {messages.PAGE_HEADING}
        </h2>
        <p class="mt-2 text-(--color-text-secondary)">
          {messages.PAGE_DESCRIPTION}
        </p>

        <div class="mt-6 flex items-center justify-between gap-4">
          <!-- Status Toggle Group -->
          <div
            class="toggle-group"
            id="department-status-toggle"
          >
            <button
              type="button"
              class="toggle-group__btn"
              class:active={currentStatusFilter === 'active'}
              title={messages.FILTER_ACTIVE_TITLE}
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
              title={messages.FILTER_INACTIVE_TITLE}
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
              title={messages.FILTER_ARCHIVED_TITLE}
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
              title={messages.FILTER_ALL_TITLE}
              onclick={() => {
                handleStatusToggle('all');
              }}
            >
              <i class="fas fa-building"></i>
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
              id="department-search-container"
            >
              <i class="search-input__icon fas fa-search"></i>
              <input
                type="search"
                id="department-search"
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
              id="department-search-results"
            >
              {#if currentSearchQuery && filteredDepartments.length === 0}
                <div class="search-input__no-results">
                  {messages.SEARCH_NO_RESULTS} "{currentSearchQuery}"
                </div>
              {:else if currentSearchQuery}
                {#each filteredDepartments.slice(0, 5) as dept (dept.id)}
                  <button
                    type="button"
                    class="search-input__result-item"
                    onclick={() => {
                      handleSearchResultClick(dept.id);
                    }}
                  >
                    <div class="search-result-item">
                      <div class="search-result-item__name">
                        <HighlightText
                          text={dept.name}
                          query={currentSearchQuery}
                        />
                      </div>
                      <div class="search-result-item__email">
                        {getAreaDisplay(dept.areaName)}
                      </div>
                      <div class="search-result-item__meta">
                        {dept.employeeCount ?? 0} Mitarbeiter
                      </div>
                    </div>
                  </button>
                {/each}
                {#if filteredDepartments.length > 5}
                  <div class="search-result-item__more py-2">
                    {messages.moreResults(filteredDepartments.length - 5)}
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
        {:else if filteredDepartments.length === 0}
          <div
            id="departments-empty"
            class="empty-state"
          >
            <div class="empty-state__icon"><i class="fas fa-building"></i></div>
            <h3 class="empty-state__title">{messages.NO_DEPARTMENTS_FOUND}</h3>
            <p class="empty-state__description">
              {messages.CREATE_FIRST_DEPARTMENT}
            </p>
            <button
              type="button"
              class="btn btn-primary"
              onclick={openAddModal}
            >
              <i class="fas fa-plus"></i>
              {messages.BTN_ADD_DEPARTMENT}
            </button>
          </div>
        {:else}
          <div id="departments-table-content">
            <div class="table-responsive">
              <table
                class="data-table data-table--hover data-table--striped"
                id="departments-table"
              >
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">{messages.TH_NAME}</th>
                    <th scope="col">{messages.TH_DESCRIPTION}</th>
                    <th scope="col">{messages.TH_STATUS}</th>
                    <th scope="col">{messages.TH_AREA}</th>
                    <th scope="col">{messages.TH_DEPARTMENT_LEAD}</th>
                    <th scope="col">{messages.TH_HALLS}</th>
                    <th scope="col">{messages.TH_TEAMS}</th>
                    <th scope="col">{messages.TH_ACTIONS}</th>
                  </tr>
                </thead>
                <tbody>
                  {#each filteredDepartments as dept (dept.id)}
                    <tr>
                      <td><code class="text-muted">{dept.id}</code></td>
                      <td>
                        <div class="font-medium text-(--color-text-primary)">
                          {dept.name}
                        </div>
                      </td>
                      <td>
                        <div class="text-sm text-(--color-text-secondary)">
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
                          class="badge {(
                            dept.areaName !== null &&
                            dept.areaName !== undefined &&
                            dept.areaName !== ''
                          ) ?
                            'badge--info'
                          : 'badge--secondary'}"
                          title={dept.areaName ?? 'Keine Zuordnung'}
                        >
                          {getAreaDisplay(dept.areaName)}
                        </span>
                      </td>
                      <td>
                        <span class="text-(--color-text-primary)"
                          >{getLeadDisplay(dept.departmentLeadName)}</span
                        >
                      </td>
                      <td>
                        <span
                          class="badge {(dept.hallCount ?? 0) > 0 ?
                            'badge--info'
                          : 'badge--secondary'}"
                          title={dept.hallNames ?? 'Keine zugeordnet'}
                        >
                          {getHallCountText(dept.hallCount ?? 0, labels.hall)}
                        </span>
                      </td>
                      <td>
                        <span
                          class="badge {(dept.teamCount ?? 0) > 0 ?
                            'badge--info'
                          : 'badge--secondary'}"
                          title={dept.teamNames ?? 'Keine zugeordnet'}
                        >
                          {getTeamCountText(dept.teamCount ?? 0, labels.team)}
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
                              openEditModal(dept.id);
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
                              openDeleteModal(dept.id);
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
    aria-label="Hinzufügen"
  >
    <i class="fas fa-plus"></i>
  </button>

  <!-- Add/Edit Department Modal -->
  <DepartmentModal
    show={showDepartmentModal}
    {isEditMode}
    {modalTitle}
    {messages}
    bind:formName
    bind:formDescription
    bind:formAreaId
    bind:formDepartmentLeadId
    bind:formDepartmentDeputyLeadId
    bind:formHallIds
    bind:formIsActive
    {allAreas}
    {allHalls}
    {allDepartmentLeads}
    {submitting}
    onclose={closeDepartmentModal}
    onsubmit={handleFormSubmit}
  />

  <!-- Delete Modals -->
  <DeleteModals
    show={showDeleteModal}
    {showForceDeleteModal}
    {forceDeleteMessage}
    {messages}
    oncancel={closeDeleteModalFn}
    onconfirm={deleteDepartment}
    onCloseForceDelete={closeForceDeleteModalFn}
    onForceDelete={forceDeleteDepartment}
  />
{/if}
