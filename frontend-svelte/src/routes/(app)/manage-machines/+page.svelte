<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast.js';

  // Page-specific CSS
  import '../../../styles/manage-machines.css';

  // Import from _lib/ modules
  import type { Machine, Department, Area, MachineStatusFilter, MachineStatus } from './_lib/types';
  import { MESSAGES, FORM_DEFAULTS, MACHINE_TYPE_OPTIONS, STATUS_OPTIONS } from './_lib/constants';
  import {
    loadMachines as apiLoadMachines,
    loadDepartments as apiLoadDepartments,
    loadAreas as apiLoadAreas,
    saveMachine as apiSaveMachine,
    deleteMachine as apiDeleteMachine,
    isSessionExpiredError,
  } from './_lib/api';
  import { applyAllFilters } from './_lib/filters';
  import {
    getStatusBadgeClass,
    getStatusLabel,
    getMachineTypeLabel,
    getMaintenanceWarningStatus,
    formatDateDE,
    formatOperatingHours,
    getEmptyStateTitle,
    getEmptyStateDescription,
    highlightMatch,
    buildMachineFormData,
    populateFormFromMachine,
  } from './_lib/utils';

  // =============================================================================
  // SVELTE 5 RUNES - State
  // =============================================================================

  // Machine Data
  let allMachines = $state<Machine[]>([]);
  let filteredMachines = $state<Machine[]>([]);

  // Organization Data (for dropdowns)
  let allDepartments = $state<Department[]>([]);
  let allAreas = $state<Area[]>([]);

  // Loading and Error States
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Filter State
  let currentStatusFilter = $state<MachineStatusFilter>('all');
  let currentSearchQuery = $state('');

  // Search State
  let searchOpen = $state(false);

  // Modal States
  let showMachineModal = $state(false);
  let showDeleteModal = $state(false);
  let showDeleteConfirmModal = $state(false);

  // Edit State
  let currentEditId = $state<number | null>(null);
  let deleteMachineId = $state<number | null>(null);

  // Form Fields
  let formName = $state('');
  let formModel = $state('');
  let formManufacturer = $state('');
  let formSerialNumber = $state('');
  let formDepartmentId = $state<number | null>(null);
  let formAreaId = $state<number | null>(null);
  let formMachineType = $state('');
  let formStatus = $state<MachineStatus>('operational');
  let formOperatingHours = $state<number | null>(null);
  let formNextMaintenance = $state('');

  // Dropdown States
  let departmentDropdownOpen = $state(false);
  let areaDropdownOpen = $state(false);
  let typeDropdownOpen = $state(false);
  let statusDropdownOpen = $state(false);

  // Form Submit Loading
  let submitting = $state(false);

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const isEditMode = $derived(currentEditId !== null);
  const modalTitle = $derived(isEditMode ? MESSAGES.MODAL_EDIT_TITLE : MESSAGES.MODAL_ADD_TITLE);

  // Get selected department name for dropdown display
  const selectedDepartmentName = $derived.by(() => {
    if (formDepartmentId === null) return MESSAGES.PLACEHOLDER_DEPARTMENT;
    const dept = allDepartments.find((d) => d.id === formDepartmentId);
    return dept?.name ?? MESSAGES.PLACEHOLDER_DEPARTMENT;
  });

  // Get selected area name for dropdown display
  const selectedAreaName = $derived.by(() => {
    if (formAreaId === null) return MESSAGES.PLACEHOLDER_AREA;
    const area = allAreas.find((a) => a.id === formAreaId);
    return area?.name ?? MESSAGES.PLACEHOLDER_AREA;
  });

  // Get selected machine type label for dropdown display
  const selectedTypeLabel = $derived.by(() => {
    if (!formMachineType) return MESSAGES.PLACEHOLDER_TYPE;
    return getMachineTypeLabel(formMachineType);
  });

  // Empty state content
  const emptyStateTitle = $derived(getEmptyStateTitle(currentStatusFilter));
  const emptyStateDescription = $derived(getEmptyStateDescription(currentStatusFilter));

  // =============================================================================
  // FILTER APPLICATION
  // =============================================================================

  function applyFilters() {
    filteredMachines = applyAllFilters(allMachines, currentStatusFilter, currentSearchQuery);
  }

  // =============================================================================
  // API FUNCTIONS
  // =============================================================================

  async function loadMachines() {
    loading = true;
    error = null;

    try {
      allMachines = await apiLoadMachines();
      applyFilters();
    } catch (err) {
      console.error('[ManageMachines] Error loading machines:', err);
      if (isSessionExpiredError(err)) {
        goto(`${base}/login?session=expired`);
        return;
      }
      error = err instanceof Error ? err.message : MESSAGES.ERROR_LOAD_FAILED;
    } finally {
      loading = false;
    }
  }

  async function loadDepartments() {
    try {
      allDepartments = await apiLoadDepartments();
    } catch (err) {
      console.error('[ManageMachines] Error loading departments:', err);
    }
  }

  async function loadAreas() {
    try {
      allAreas = await apiLoadAreas();
    } catch (err) {
      console.error('[ManageMachines] Error loading areas:', err);
    }
  }

  async function saveMachine() {
    submitting = true;

    try {
      // Validate required fields
      if (!formName.trim()) {
        showErrorAlert(MESSAGES.ERROR_NAME_REQUIRED);
        submitting = false;
        return;
      }

      // Build form data using utility function
      const formData = buildMachineFormData({
        name: formName,
        model: formModel,
        manufacturer: formManufacturer,
        serialNumber: formSerialNumber,
        departmentId: formDepartmentId,
        areaId: formAreaId,
        machineType: formMachineType,
        status: formStatus,
        operatingHours: formOperatingHours,
        nextMaintenance: formNextMaintenance,
      });

      await apiSaveMachine(formData, currentEditId);

      if (isEditMode) {
        showSuccessAlert(MESSAGES.SUCCESS_UPDATED);
      } else {
        showSuccessAlert(MESSAGES.SUCCESS_CREATED);
      }

      closeMachineModal();
      await loadMachines();
    } catch (err) {
      console.error('[ManageMachines] Error saving machine:', err);
      showErrorAlert(err instanceof Error ? err.message : MESSAGES.ERROR_SAVE_FAILED);
    } finally {
      submitting = false;
    }
  }

  async function deleteMachine() {
    if (deleteMachineId === null) return;

    try {
      await apiDeleteMachine(deleteMachineId);

      showSuccessAlert(MESSAGES.SUCCESS_DELETED);
      showDeleteConfirmModal = false;
      deleteMachineId = null;
      await loadMachines();
    } catch (err) {
      console.error('[ManageMachines] Error deleting machine:', err);
      showErrorAlert(MESSAGES.ERROR_DELETE_FAILED);
    }
  }

  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================

  function openAddModal() {
    currentEditId = null;
    resetForm();
    showMachineModal = true;
  }

  function openEditModal(machineId: number) {
    const machine = allMachines.find((m) => m.id === machineId);
    if (!machine) return;

    currentEditId = machineId;
    const formState = populateFormFromMachine(machine);
    formName = formState.name;
    formModel = formState.model;
    formManufacturer = formState.manufacturer;
    formSerialNumber = formState.serialNumber;
    formDepartmentId = formState.departmentId;
    formAreaId = formState.areaId;
    formMachineType = formState.machineType;
    formStatus = formState.status;
    formOperatingHours = formState.operatingHours;
    formNextMaintenance = formState.nextMaintenance;
    showMachineModal = true;
  }

  function openDeleteModal(machineId: number) {
    deleteMachineId = machineId;
    showDeleteModal = true;
  }

  function proceedToDeleteConfirm() {
    showDeleteModal = false;
    showDeleteConfirmModal = true;
  }

  function closeMachineModal() {
    showMachineModal = false;
    currentEditId = null;
    resetForm();
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    deleteMachineId = null;
  }

  function closeDeleteConfirmModal() {
    showDeleteConfirmModal = false;
    deleteMachineId = null;
  }

  function resetForm() {
    formName = FORM_DEFAULTS.name;
    formModel = FORM_DEFAULTS.model;
    formManufacturer = FORM_DEFAULTS.manufacturer;
    formSerialNumber = FORM_DEFAULTS.serialNumber;
    formDepartmentId = FORM_DEFAULTS.departmentId;
    formAreaId = FORM_DEFAULTS.areaId;
    formMachineType = FORM_DEFAULTS.machineType;
    formStatus = FORM_DEFAULTS.status;
    formOperatingHours = FORM_DEFAULTS.operatingHours;
    formNextMaintenance = FORM_DEFAULTS.nextMaintenance;
    departmentDropdownOpen = false;
    areaDropdownOpen = false;
    typeDropdownOpen = false;
    statusDropdownOpen = false;
  }

  // =============================================================================
  // DROPDOWN HANDLERS
  // =============================================================================

  function closeAllDropdowns() {
    departmentDropdownOpen = false;
    areaDropdownOpen = false;
    typeDropdownOpen = false;
    statusDropdownOpen = false;
  }

  function toggleDepartmentDropdown(e: MouseEvent) {
    e.stopPropagation();
    const wasOpen = departmentDropdownOpen;
    closeAllDropdowns();
    departmentDropdownOpen = !wasOpen;
  }

  function selectDepartment(deptId: number | null) {
    formDepartmentId = deptId;
    departmentDropdownOpen = false;
  }

  function toggleAreaDropdown(e: MouseEvent) {
    e.stopPropagation();
    const wasOpen = areaDropdownOpen;
    closeAllDropdowns();
    areaDropdownOpen = !wasOpen;
  }

  function selectArea(areaId: number | null) {
    formAreaId = areaId;
    areaDropdownOpen = false;
  }

  function toggleTypeDropdown(e: MouseEvent) {
    e.stopPropagation();
    const wasOpen = typeDropdownOpen;
    closeAllDropdowns();
    typeDropdownOpen = !wasOpen;
  }

  function selectType(type: string) {
    formMachineType = type;
    typeDropdownOpen = false;
  }

  function toggleStatusDropdown(e: MouseEvent) {
    e.stopPropagation();
    const wasOpen = statusDropdownOpen;
    closeAllDropdowns();
    statusDropdownOpen = !wasOpen;
  }

  function selectStatus(status: MachineStatus) {
    formStatus = status;
    statusDropdownOpen = false;
  }

  // =============================================================================
  // STATUS TOGGLE HANDLER
  // =============================================================================

  function handleStatusToggle(status: MachineStatusFilter) {
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

  function handleSearchResultClick(machineId: number) {
    openEditModal(machineId);
    searchOpen = false;
    currentSearchQuery = '';
  }

  // =============================================================================
  // FORM SUBMIT HANDLER
  // =============================================================================

  function handleFormSubmit(e: Event) {
    e.preventDefault();
    saveMachine();
  }

  // =============================================================================
  // OVERLAY CLICK HANDLERS
  // =============================================================================

  function handleModalOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) closeMachineModal();
  }

  function handleDeleteOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) closeDeleteModal();
  }

  function handleDeleteConfirmOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) closeDeleteConfirmModal();
  }

  // =============================================================================
  // OUTSIDE CLICK HANDLERS
  // =============================================================================

  $effect(() => {
    if (
      departmentDropdownOpen ||
      areaDropdownOpen ||
      typeDropdownOpen ||
      statusDropdownOpen ||
      searchOpen
    ) {
      const handleOutsideClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;

        if (departmentDropdownOpen) {
          const el = document.getElementById('department-dropdown');
          if (el && !el.contains(target)) departmentDropdownOpen = false;
        }

        if (areaDropdownOpen) {
          const el = document.getElementById('area-dropdown');
          if (el && !el.contains(target)) areaDropdownOpen = false;
        }

        if (typeDropdownOpen) {
          const el = document.getElementById('type-dropdown');
          if (el && !el.contains(target)) typeDropdownOpen = false;
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
      if (showDeleteConfirmModal) closeDeleteConfirmModal();
      else if (showDeleteModal) closeDeleteModal();
      else if (showMachineModal) closeMachineModal();
    }
  }

  // =============================================================================
  // LIFECYCLE
  // =============================================================================

  onMount(() => {
    const token = localStorage.getItem('accessToken');
    const userRole = localStorage.getItem('userRole');

    if (!token || (userRole !== 'admin' && userRole !== 'root')) {
      goto(`${base}/login`);
      return;
    }

    loadMachines();
    loadDepartments();
    loadAreas();
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
        <i class="fas fa-cogs mr-2"></i>
        {MESSAGES.PAGE_HEADING}
      </h2>
      <p class="text-[var(--color-text-secondary)] mt-2">
        {MESSAGES.PAGE_DESCRIPTION}
      </p>

      <div class="flex gap-4 items-center justify-between mt-6">
        <!-- Status Toggle Group -->
        <div class="toggle-group" id="machine-status-toggle">
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'all'}
            data-status="all"
            title="Alle Maschinen"
            onclick={() => handleStatusToggle('all')}
          >
            <i class="fas fa-list"></i>
            {MESSAGES.FILTER_ALL}
          </button>
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'operational'}
            data-status="operational"
            title="Betriebsbereite Maschinen"
            onclick={() => handleStatusToggle('operational')}
          >
            <i class="fas fa-check-circle"></i>
            {MESSAGES.FILTER_OPERATIONAL}
          </button>
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'maintenance'}
            data-status="maintenance"
            title="Maschinen in Wartung"
            onclick={() => handleStatusToggle('maintenance')}
          >
            <i class="fas fa-wrench"></i>
            {MESSAGES.FILTER_MAINTENANCE}
          </button>
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'repair'}
            data-status="repair"
            title="Maschinen in Reparatur"
            onclick={() => handleStatusToggle('repair')}
          >
            <i class="fas fa-tools"></i>
            {MESSAGES.FILTER_REPAIR}
          </button>
        </div>

        <!-- Search Input -->
        <div class="search-input-wrapper max-w-80" class:search-input-wrapper--open={searchOpen}>
          <div class="search-input" id="machine-search-container">
            <i class="search-input__icon fas fa-search"></i>
            <input
              type="search"
              id="machine-search"
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
          <div class="search-input__results" id="machine-search-results">
            {#if currentSearchQuery && filteredMachines.length === 0}
              <div class="search-input__no-results">
                {MESSAGES.SEARCH_NO_RESULTS}
              </div>
            {:else if currentSearchQuery}
              {#each filteredMachines.slice(0, 5) as machine (machine.id)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="search-input__result-item"
                  onclick={() => handleSearchResultClick(machine.id)}
                >
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="font-weight: 500; color: var(--color-text-primary);">
                      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                      {@html highlightMatch(machine.name, currentSearchQuery)}
                    </div>
                    <div style="font-size: 0.813rem; color: var(--color-text-secondary);">
                      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                      {@html highlightMatch(machine.model ?? '', currentSearchQuery)}
                      {#if machine.manufacturer}
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        · {@html highlightMatch(machine.manufacturer, currentSearchQuery)}
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
              {#if filteredMachines.length > 5}
                <div
                  class="search-input__result-item"
                  style="font-size: 0.813rem; color: var(--color-primary); text-align: center; border-top: 1px solid rgb(255 255 255 / 5%);"
                >
                  {filteredMachines.length - 5} weitere Ergebnisse in Tabelle
                </div>
              {/if}
            {/if}
          </div>
        </div>
      </div>
    </div>

    <div class="card__body">
      {#if loading}
        <div id="machines-loading" class="spinner-container">
          <div class="spinner-ring spinner-ring--md"></div>
          <p class="mt-2 text-[var(--color-text-secondary)]">{MESSAGES.LOADING_MACHINES}</p>
        </div>
      {:else if error}
        <div class="text-center p-6">
          <i class="fas fa-exclamation-triangle text-4xl text-[var(--color-danger)] mb-4"></i>
          <p class="text-[var(--color-text-secondary)]">{error}</p>
          <button class="btn btn-primary mt-4" onclick={() => loadMachines()}>
            {MESSAGES.BTN_RETRY}
          </button>
        </div>
      {:else if filteredMachines.length === 0}
        <div id="machines-empty" class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-cogs"></i>
          </div>
          <h3 class="empty-state__title">{emptyStateTitle}</h3>
          <p class="empty-state__description">{emptyStateDescription}</p>
          {#if currentStatusFilter === 'all'}
            <button class="btn btn-primary" onclick={openAddModal}>
              <i class="fas fa-plus"></i>
              {MESSAGES.BTN_ADD_MACHINE}
            </button>
          {/if}
        </div>
      {:else}
        <div id="machines-table-content">
          <div class="table-responsive">
            <table class="data-table data-table--hover data-table--striped" id="machines-table">
              <thead>
                <tr>
                  <th scope="col">{MESSAGES.TH_NAME}</th>
                  <th scope="col">{MESSAGES.TH_MODEL}</th>
                  <th scope="col">{MESSAGES.TH_MANUFACTURER}</th>
                  <th scope="col">{MESSAGES.TH_DEPARTMENT}</th>
                  <th scope="col">{MESSAGES.TH_STATUS}</th>
                  <th scope="col">{MESSAGES.TH_HOURS}</th>
                  <th scope="col">{MESSAGES.TH_MAINTENANCE}</th>
                  <th scope="col">{MESSAGES.TH_ACTIONS}</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredMachines as machine (machine.id)}
                  {@const maintenanceWarning = getMaintenanceWarningStatus(machine.nextMaintenance)}
                  <tr>
                    <td>
                      <strong>{machine.name}</strong>
                    </td>
                    <td>{machine.model ?? '-'}</td>
                    <td>{machine.manufacturer ?? '-'}</td>
                    <td>{machine.departmentName ?? '-'}</td>
                    <td>
                      <span class="badge {getStatusBadgeClass(machine.status)}">
                        {getStatusLabel(machine.status)}
                      </span>
                    </td>
                    <td>{formatOperatingHours(machine.operatingHours)}</td>
                    <td>
                      {formatDateDE(machine.nextMaintenance)}
                      {#if maintenanceWarning === 'overdue'}
                        <i
                          class="fas fa-exclamation-triangle text-red-500 ms-2"
                          title="Wartung überfällig"
                        ></i>
                      {:else if maintenanceWarning === 'soon'}
                        <i
                          class="fas fa-exclamation-circle text-yellow-500 ms-2"
                          title="Wartung bald fällig"
                        ></i>
                      {/if}
                    </td>
                    <td>
                      <div class="flex gap-2">
                        <button
                          class="action-icon action-icon--edit"
                          title="Bearbeiten"
                          aria-label="Maschine bearbeiten"
                          onclick={() => openEditModal(machine.id)}
                        >
                          <i class="fas fa-edit"></i>
                        </button>
                        <button
                          class="action-icon action-icon--delete"
                          title="Löschen"
                          aria-label="Maschine löschen"
                          onclick={() => openDeleteModal(machine.id)}
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
<button class="btn-float add-machine-btn" onclick={openAddModal} aria-label="Maschine hinzufügen">
  <i class="fas fa-plus"></i>
</button>

<!-- Add/Edit Machine Modal -->
<div
  id="machine-modal"
  class="modal-overlay"
  class:modal-overlay--active={showMachineModal}
  role="dialog"
  aria-modal="true"
  aria-labelledby="machine-modal-title"
  tabindex="-1"
  onclick={handleModalOverlayClick}
  onkeydown={(e) => e.key === 'Escape' && closeMachineModal()}
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <form
    id="machine-form"
    class="ds-modal"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    onsubmit={handleFormSubmit}
  >
    <div class="ds-modal__header">
      <h3 class="ds-modal__title" id="machine-modal-title">{modalTitle}</h3>
      <button
        type="button"
        class="ds-modal__close"
        aria-label="Schließen"
        onclick={closeMachineModal}
      >
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="ds-modal__body">
      <div class="form-field">
        <label class="form-field__label" for="machine-name">
          {MESSAGES.LABEL_NAME} <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="machine-name"
          name="name"
          class="form-field__control"
          required
          bind:value={formName}
        />
      </div>

      <div class="form-field">
        <label class="form-field__label" for="machine-model">
          {MESSAGES.LABEL_MODEL}
        </label>
        <input
          type="text"
          id="machine-model"
          name="model"
          class="form-field__control"
          bind:value={formModel}
        />
      </div>

      <div class="form-field">
        <label class="form-field__label" for="machine-manufacturer">
          {MESSAGES.LABEL_MANUFACTURER}
        </label>
        <input
          type="text"
          id="machine-manufacturer"
          name="manufacturer"
          class="form-field__control"
          bind:value={formManufacturer}
        />
      </div>

      <div class="form-field">
        <label class="form-field__label" for="machine-serial">
          {MESSAGES.LABEL_SERIAL}
        </label>
        <input
          type="text"
          id="machine-serial"
          name="serialNumber"
          class="form-field__control"
          bind:value={formSerialNumber}
        />
      </div>

      <div class="form-field">
        <label class="form-field__label" for="machine-department">
          {MESSAGES.LABEL_DEPARTMENT}
        </label>
        <input
          type="hidden"
          id="machine-department"
          name="departmentId"
          value={formDepartmentId ?? ''}
        />
        <div class="dropdown" id="department-dropdown">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="dropdown__trigger"
            id="department-trigger"
            class:active={departmentDropdownOpen}
            onclick={toggleDepartmentDropdown}
          >
            <span>{selectedDepartmentName}</span>
            <i class="fas fa-chevron-down"></i>
          </div>
          <div class="dropdown__menu" id="department-menu" class:active={departmentDropdownOpen}>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="dropdown__option" onclick={() => selectDepartment(null)}>
              {MESSAGES.PLACEHOLDER_DEPARTMENT}
            </div>
            {#each allDepartments as dept (dept.id)}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="dropdown__option" onclick={() => selectDepartment(dept.id)}>
                {dept.name}
              </div>
            {/each}
          </div>
        </div>
      </div>

      <div class="form-field">
        <label class="form-field__label" for="machine-area">
          {MESSAGES.LABEL_AREA}
        </label>
        <input type="hidden" id="machine-area" name="areaId" value={formAreaId ?? ''} />
        <div class="dropdown" id="area-dropdown">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="dropdown__trigger"
            id="area-trigger"
            class:active={areaDropdownOpen}
            onclick={toggleAreaDropdown}
          >
            <span>{selectedAreaName}</span>
            <i class="fas fa-chevron-down"></i>
          </div>
          <div class="dropdown__menu" id="area-menu" class:active={areaDropdownOpen}>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="dropdown__option" onclick={() => selectArea(null)}>
              {MESSAGES.PLACEHOLDER_AREA}
            </div>
            {#each allAreas as area (area.id)}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="dropdown__option" onclick={() => selectArea(area.id)}>
                {area.name}
              </div>
            {/each}
          </div>
        </div>
      </div>

      <div class="form-field">
        <label class="form-field__label" for="machine-type">
          {MESSAGES.LABEL_TYPE}
        </label>
        <input type="hidden" id="machine-type" name="machineType" value={formMachineType} />
        <div class="dropdown" id="type-dropdown">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="dropdown__trigger"
            id="type-trigger"
            class:active={typeDropdownOpen}
            onclick={toggleTypeDropdown}
          >
            <span>{selectedTypeLabel}</span>
            <i class="fas fa-chevron-down"></i>
          </div>
          <div class="dropdown__menu" id="type-menu" class:active={typeDropdownOpen}>
            {#each MACHINE_TYPE_OPTIONS as option (option.value)}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="dropdown__option" onclick={() => selectType(option.value)}>
                {option.label}
              </div>
            {/each}
          </div>
        </div>
      </div>

      <div class="form-field">
        <label class="form-field__label" for="machine-status">
          {MESSAGES.LABEL_STATUS}
        </label>
        <input type="hidden" id="machine-status" name="status" value={formStatus} />
        <div class="dropdown" id="status-dropdown">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="dropdown__trigger"
            id="status-trigger"
            class:active={statusDropdownOpen}
            onclick={toggleStatusDropdown}
          >
            <span class="badge {getStatusBadgeClass(formStatus)}">{getStatusLabel(formStatus)}</span
            >
            <i class="fas fa-chevron-down"></i>
          </div>
          <div class="dropdown__menu" id="status-menu" class:active={statusDropdownOpen}>
            {#each STATUS_OPTIONS as option (option.value)}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="dropdown__option" onclick={() => selectStatus(option.value)}>
                <span class="badge {option.class}">{option.label}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <div class="form-field">
        <label class="form-field__label" for="machine-hours">
          {MESSAGES.LABEL_HOURS}
        </label>
        <input
          type="number"
          id="machine-hours"
          name="operatingHours"
          class="form-field__control"
          min="0"
          step="0.1"
          bind:value={formOperatingHours}
        />
      </div>

      <div class="form-field">
        <label class="form-field__label" for="machine-next-maintenance">
          {MESSAGES.LABEL_NEXT_MAINTENANCE}
        </label>
        <div class="date-picker">
          <i class="date-picker__icon fas fa-calendar"></i>
          <input
            type="date"
            id="machine-next-maintenance"
            name="nextMaintenance"
            class="date-picker__input"
            bind:value={formNextMaintenance}
          />
        </div>
      </div>
    </div>

    <div class="ds-modal__footer">
      <button type="button" class="btn btn-cancel" onclick={closeMachineModal}>
        {MESSAGES.BTN_CANCEL}
      </button>
      <button type="submit" class="btn btn-modal" disabled={submitting}>
        {#if submitting}<span class="spinner-ring spinner-ring--sm mr-2"></span>{/if}
        {MESSAGES.BTN_SAVE}
      </button>
    </div>
  </form>
</div>

<!-- Delete Modal Step 1 -->
<div
  id="delete-machine-modal"
  class="modal-overlay"
  class:modal-overlay--active={showDeleteModal}
  role="dialog"
  aria-modal="true"
  aria-labelledby="delete-modal-title"
  tabindex="-1"
  onclick={handleDeleteOverlayClick}
  onkeydown={(e) => e.key === 'Escape' && closeDeleteModal()}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="ds-modal ds-modal--sm"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <div class="ds-modal__header">
      <h3 class="ds-modal__title" id="delete-modal-title">
        <i class="fas fa-trash-alt text-red-500 mr-2"></i>
        {MESSAGES.MODAL_DELETE_TITLE}
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
      <p class="text-[var(--color-text-secondary)]">{MESSAGES.DELETE_CONFIRM_MESSAGE}</p>
    </div>
    <div class="ds-modal__footer">
      <button type="button" class="btn btn-cancel" onclick={closeDeleteModal}>
        {MESSAGES.BTN_CANCEL}
      </button>
      <button type="button" class="btn btn-danger" onclick={proceedToDeleteConfirm}>
        {MESSAGES.BTN_DELETE}
      </button>
    </div>
  </div>
</div>

<!-- Delete Modal Step 2 -->
<div
  id="delete-machine-confirm-modal"
  class="modal-overlay"
  class:modal-overlay--active={showDeleteConfirmModal}
  role="dialog"
  aria-modal="true"
  aria-labelledby="delete-confirm-title"
  tabindex="-1"
  onclick={handleDeleteConfirmOverlayClick}
  onkeydown={(e) => e.key === 'Escape' && closeDeleteConfirmModal()}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="confirm-modal confirm-modal--danger"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <div class="confirm-modal__icon">
      <i class="fas fa-exclamation-triangle"></i>
    </div>
    <h3 class="confirm-modal__title" id="delete-confirm-title">
      {MESSAGES.MODAL_DELETE_CONFIRM_TITLE}
    </h3>
    <p class="confirm-modal__message">
      <strong>{MESSAGES.DELETE_FINAL_WARNING}</strong>
      <br /><br />
      {MESSAGES.DELETE_FINAL_INFO}
    </p>
    <div class="confirm-modal__actions">
      <button
        type="button"
        class="confirm-modal__btn confirm-modal__btn--cancel"
        onclick={closeDeleteConfirmModal}
      >
        {MESSAGES.BTN_CANCEL}
      </button>
      <button
        type="button"
        class="confirm-modal__btn confirm-modal__btn--danger"
        onclick={deleteMachine}
      >
        {MESSAGES.BTN_DELETE_FINAL}
      </button>
    </div>
  </div>
</div>
