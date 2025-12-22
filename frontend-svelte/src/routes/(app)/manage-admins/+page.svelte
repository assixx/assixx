<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { showWarningAlert, showErrorAlert } from '$lib/stores/toast.js';

  // Page-specific CSS
  import '../../../styles/manage-admins.css';
  import '../../../styles/password-strength.css';

  // Import from _lib/ modules
  import type { Admin, Area, Department, StatusFilter, FormIsActiveStatus } from './_lib/types';
  import { POSITION_OPTIONS, MESSAGES, FORM_DEFAULTS } from './_lib/constants';
  import {
    loadAdmins as apiLoadAdmins,
    loadAreas as apiLoadAreas,
    loadDepartments as apiLoadDepartments,
    saveAdminWithPermissions,
    deleteAdmin as apiDeleteAdmin,
    isSessionExpiredError,
  } from './_lib/api';
  import {
    applyAllFilters,
    filterAvailableDepartments,
    filterDepartmentIdsByAreas,
  } from './_lib/filters';
  import {
    getStatusBadgeClass,
    getStatusLabel,
    getPositionDisplay,
    getAvatarColor,
    getAreasBadge,
    getDepartmentsBadge,
    getTeamsBadge,
    highlightMatch,
    calculatePasswordStrength,
    buildAdminFormData,
    populateFormFromAdmin,
  } from './_lib/utils';

  // =============================================================================
  // SVELTE 5 RUNES - State
  // =============================================================================

  // Admin Data
  let allAdmins = $state<Admin[]>([]);
  let filteredAdmins = $state<Admin[]>([]);

  // Organization Data (for multi-selects)
  let allAreas = $state<Area[]>([]);
  let allDepartments = $state<Department[]>([]);

  // Loading and Error States
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Filter State
  let currentStatusFilter = $state<StatusFilter>('active');
  let currentSearchQuery = $state('');

  // Search State
  let searchOpen = $state(false);

  // Modal States
  let showAdminModal = $state(false);
  let showDeleteModal = $state(false);
  let showDeleteConfirmModal = $state(false);

  // Edit State
  let currentEditId = $state<number | null>(null);
  let deleteAdminId = $state<number | null>(null);

  // Form Fields
  let formFirstName = $state('');
  let formLastName = $state('');
  let formEmail = $state('');
  let formEmailConfirm = $state('');
  let formPassword = $state('');
  let formPasswordConfirm = $state('');
  let formEmployeeNumber = $state('');
  let formPosition = $state('');
  let formNotes = $state('');
  let formIsActive = $state<FormIsActiveStatus>(1);

  // N:M Organization Assignment
  let formHasFullAccess = $state(false);
  let formAreaIds = $state<number[]>([]);
  let formDepartmentIds = $state<number[]>([]);

  // Dropdown States
  let positionDropdownOpen = $state(false);
  let statusDropdownOpen = $state(false);

  // Password Visibility
  let showPassword = $state(false);
  let showPasswordConfirm = $state(false);

  // Password Strength
  let passwordScore = $state(-1);
  let passwordLabel = $state('');
  let passwordTime = $state('');

  // Validation State
  let emailError = $state(false);
  let passwordError = $state(false);

  // Form Submit Loading
  let submitting = $state(false);

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const isEditMode = $derived(currentEditId !== null);
  const modalTitle = $derived(isEditMode ? MESSAGES.MODAL_EDIT_TITLE : MESSAGES.MODAL_ADD_TITLE);

  // Filtered departments (hide those covered by selected areas)
  const availableDepartments = $derived.by(() => {
    return filterAvailableDepartments(allDepartments, formAreaIds, formHasFullAccess);
  });

  // =============================================================================
  // FILTER APPLICATION
  // =============================================================================

  function applyFilters() {
    filteredAdmins = applyAllFilters(allAdmins, currentStatusFilter, currentSearchQuery);
  }

  // =============================================================================
  // API FUNCTIONS
  // =============================================================================

  async function loadAdmins() {
    loading = true;
    error = null;

    try {
      allAdmins = await apiLoadAdmins();
      applyFilters();
    } catch (err) {
      console.error('[ManageAdmins] Error loading admins:', err);
      if (isSessionExpiredError(err)) {
        goto(`${base}/login?session=expired`);
        return;
      }
      error = err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten';
    } finally {
      loading = false;
    }
  }

  async function loadAreas() {
    try {
      allAreas = await apiLoadAreas();
    } catch (err) {
      console.error('[ManageAdmins] Error loading areas:', err);
    }
  }

  async function loadDepartments() {
    try {
      allDepartments = await apiLoadDepartments();
    } catch (err) {
      console.error('[ManageAdmins] Error loading departments:', err);
    }
  }

  async function saveAdmin() {
    submitting = true;

    try {
      // Validate
      if (formEmail !== formEmailConfirm) {
        emailError = true;
        submitting = false;
        return;
      }

      if (!isEditMode && formPassword !== formPasswordConfirm) {
        passwordError = true;
        submitting = false;
        return;
      }

      if (isEditMode && formPassword && formPassword !== formPasswordConfirm) {
        passwordError = true;
        submitting = false;
        return;
      }

      if (!formPosition) {
        showWarningAlert(MESSAGES.ERROR_POSITION_REQUIRED);
        submitting = false;
        return;
      }

      if (!formEmployeeNumber) {
        showWarningAlert(MESSAGES.ERROR_EMPLOYEE_NUMBER_REQUIRED);
        submitting = false;
        return;
      }

      // Build form data using utility function
      const formData = buildAdminFormData(
        {
          firstName: formFirstName,
          lastName: formLastName,
          email: formEmail,
          password: formPassword,
          position: formPosition,
          notes: formNotes,
          isActive: formIsActive,
          employeeNumber: formEmployeeNumber,
          hasFullAccess: formHasFullAccess,
          areaIds: formAreaIds,
          departmentIds: formDepartmentIds,
        },
        isEditMode,
      );

      await saveAdminWithPermissions(formData, currentEditId);

      closeAdminModal();
      await loadAdmins();
    } catch (err) {
      console.error('[ManageAdmins] Error saving admin:', err);
      showErrorAlert(err instanceof Error ? err.message : MESSAGES.ERROR_SAVE_FAILED);
    } finally {
      submitting = false;
    }
  }

  async function deleteAdmin() {
    if (deleteAdminId === null) return;

    try {
      await apiDeleteAdmin(deleteAdminId);

      showDeleteConfirmModal = false;
      deleteAdminId = null;
      await loadAdmins();
    } catch (err) {
      console.error('[ManageAdmins] Error deleting admin:', err);
      showErrorAlert(MESSAGES.ERROR_DELETE_FAILED);
    }
  }

  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================

  function openAddModal() {
    currentEditId = null;
    resetForm();
    showAdminModal = true;
  }

  function openEditModal(adminId: number) {
    const admin = allAdmins.find((a) => a.id === adminId);
    if (!admin) return;

    currentEditId = adminId;
    const formState = populateFormFromAdmin(admin);
    formFirstName = formState.firstName;
    formLastName = formState.lastName;
    formEmail = formState.email;
    formEmailConfirm = formState.email;
    formPassword = '';
    formPasswordConfirm = '';
    formEmployeeNumber = formState.employeeNumber;
    formPosition = formState.position;
    formNotes = formState.notes;
    formIsActive = formState.isActive;
    formHasFullAccess = formState.hasFullAccess;
    formAreaIds = formState.areaIds;
    formDepartmentIds = formState.departmentIds;
    emailError = false;
    passwordError = false;
    showAdminModal = true;
  }

  function openDeleteModal(adminId: number) {
    deleteAdminId = adminId;
    showDeleteModal = true;
  }

  function proceedToDeleteConfirm() {
    showDeleteModal = false;
    showDeleteConfirmModal = true;
  }

  function closeAdminModal() {
    showAdminModal = false;
    currentEditId = null;
    resetForm();
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    deleteAdminId = null;
  }

  function closeDeleteConfirmModal() {
    showDeleteConfirmModal = false;
    deleteAdminId = null;
  }

  function resetForm() {
    formFirstName = FORM_DEFAULTS.firstName;
    formLastName = FORM_DEFAULTS.lastName;
    formEmail = FORM_DEFAULTS.email;
    formEmailConfirm = FORM_DEFAULTS.emailConfirm;
    formPassword = FORM_DEFAULTS.password;
    formPasswordConfirm = FORM_DEFAULTS.passwordConfirm;
    formEmployeeNumber = FORM_DEFAULTS.employeeNumber;
    formPosition = FORM_DEFAULTS.position;
    formNotes = FORM_DEFAULTS.notes;
    formIsActive = FORM_DEFAULTS.isActive;
    formHasFullAccess = FORM_DEFAULTS.hasFullAccess;
    formAreaIds = [...FORM_DEFAULTS.areaIds];
    formDepartmentIds = [...FORM_DEFAULTS.departmentIds];
    emailError = false;
    passwordError = false;
    passwordScore = -1;
    passwordLabel = '';
    passwordTime = '';
    showPassword = false;
    showPasswordConfirm = false;
    positionDropdownOpen = false;
    statusDropdownOpen = false;
  }

  // =============================================================================
  // DROPDOWN HANDLERS
  // =============================================================================

  function togglePositionDropdown(e: MouseEvent) {
    e.stopPropagation();
    statusDropdownOpen = false;
    positionDropdownOpen = !positionDropdownOpen;
  }

  function selectPosition(position: string) {
    formPosition = position;
    positionDropdownOpen = false;
  }

  function toggleStatusDropdown(e: MouseEvent) {
    e.stopPropagation();
    positionDropdownOpen = false;
    statusDropdownOpen = !statusDropdownOpen;
  }

  function selectStatus(status: FormIsActiveStatus) {
    formIsActive = status;
    statusDropdownOpen = false;
  }

  // =============================================================================
  // MULTI-SELECT HANDLERS
  // =============================================================================

  function handleAreaChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    formAreaIds = Array.from(select.selectedOptions).map((opt) => parseInt(opt.value, 10));
    // Clear department selections that are now covered by areas
    formDepartmentIds = filterDepartmentIdsByAreas(formDepartmentIds, allDepartments, formAreaIds);
  }

  function handleDepartmentChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    formDepartmentIds = Array.from(select.selectedOptions).map((opt) => parseInt(opt.value, 10));
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

  function handleSearchResultClick(adminId: number) {
    openEditModal(adminId);
    searchOpen = false;
    currentSearchQuery = '';
  }

  // =============================================================================
  // VALIDATION HANDLERS
  // =============================================================================

  function validateEmails() {
    if (formEmailConfirm) {
      emailError = formEmail !== formEmailConfirm;
    } else {
      emailError = false;
    }
  }

  function validatePasswords() {
    if (formPasswordConfirm) {
      passwordError = formPassword !== formPasswordConfirm;
    } else {
      passwordError = false;
    }
  }

  // =============================================================================
  // PASSWORD STRENGTH
  // =============================================================================

  function updatePasswordStrength() {
    const result = calculatePasswordStrength(formPassword);
    passwordScore = result.score;
    passwordLabel = result.label;
    passwordTime = result.crackTime;
  }

  // =============================================================================
  // FORM SUBMIT HANDLER
  // =============================================================================

  function handleFormSubmit(e: Event) {
    e.preventDefault();
    saveAdmin();
  }

  // =============================================================================
  // OVERLAY CLICK HANDLERS
  // =============================================================================

  function handleModalOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) closeAdminModal();
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
    if (positionDropdownOpen || statusDropdownOpen || searchOpen) {
      const handleOutsideClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;

        if (positionDropdownOpen) {
          const el = document.getElementById('position-dropdown');
          if (el && !el.contains(target)) positionDropdownOpen = false;
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
      else if (showAdminModal) closeAdminModal();
    }
  }

  // =============================================================================
  // LIFECYCLE
  // =============================================================================

  onMount(() => {
    const token = localStorage.getItem('accessToken');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'root') {
      goto(`${base}/login`);
      return;
    }

    loadAdmins();
    loadAreas();
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
        <i class="fas fa-users mr-2"></i>
        {MESSAGES.PAGE_HEADING}
      </h2>
      <p class="text-[var(--color-text-secondary)] mt-2">
        {MESSAGES.PAGE_DESCRIPTION}
      </p>

      <div class="flex gap-4 items-center justify-between mt-6">
        <!-- Status Toggle Group -->
        <div class="toggle-group" id="admin-status-toggle">
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'active'}
            title="Aktive Administratoren"
            onclick={() => handleStatusToggle('active')}
          >
            <i class="fas fa-user-check"></i>
            {MESSAGES.FILTER_ACTIVE}
          </button>
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'inactive'}
            title="Inaktive Administratoren"
            onclick={() => handleStatusToggle('inactive')}
          >
            <i class="fas fa-user-times"></i>
            {MESSAGES.FILTER_INACTIVE}
          </button>
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'archived'}
            title="Archivierte Administratoren"
            onclick={() => handleStatusToggle('archived')}
          >
            <i class="fas fa-archive"></i>
            {MESSAGES.FILTER_ARCHIVED}
          </button>
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'all'}
            title="Alle Administratoren"
            onclick={() => handleStatusToggle('all')}
          >
            <i class="fas fa-users"></i>
            {MESSAGES.FILTER_ALL}
          </button>
        </div>

        <!-- Search Input -->
        <div class="search-input-wrapper max-w-80" class:search-input-wrapper--open={searchOpen}>
          <div class="search-input" id="admin-search-container">
            <i class="search-input__icon fas fa-search"></i>
            <input
              type="search"
              id="admin-search"
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
          <div class="search-input__results" id="admin-search-results">
            {#if currentSearchQuery && filteredAdmins.length === 0}
              <div class="search-input__no-results">
                {MESSAGES.SEARCH_NO_RESULTS} "{currentSearchQuery}"
              </div>
            {:else if currentSearchQuery}
              {#each filteredAdmins.slice(0, 5) as admin (admin.id)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="search-input__result-item"
                  onclick={() => handleSearchResultClick(admin.id)}
                >
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="font-weight: 500; color: var(--color-text-primary);">
                      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                      {@html highlightMatch(
                        `${admin.firstName} ${admin.lastName}`,
                        currentSearchQuery,
                      )}
                    </div>
                    <div style="font-size: 0.813rem; color: var(--color-text-secondary);">
                      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                      {@html highlightMatch(admin.email, currentSearchQuery)}
                    </div>
                    <div
                      style="font-size: 0.75rem; color: var(--color-text-muted); display: flex; gap: 8px;"
                    >
                      <span>
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html highlightMatch(
                          getPositionDisplay(admin.position ?? ''),
                          currentSearchQuery,
                        )}
                      </span>
                      {#if admin.employeeNumber}
                        <span>
                          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                          • {@html highlightMatch(admin.employeeNumber, currentSearchQuery)}
                        </span>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
              {#if filteredAdmins.length > 5}
                <div
                  class="search-input__result-item"
                  style="font-size: 0.813rem; color: var(--color-primary); text-align: center; border-top: 1px solid rgb(255 255 255 / 5%);"
                >
                  {filteredAdmins.length - 5}
                  {MESSAGES.SEARCH_MORE_RESULTS}
                </div>
              {/if}
            {/if}
          </div>
        </div>
      </div>
    </div>

    <div class="card__body">
      {#if loading}
        <div id="admins-loading" class="spinner-container">
          <div class="spinner-ring spinner-ring--md"></div>
          <p class="mt-2 text-[var(--color-text-secondary)]">{MESSAGES.LOADING_ADMINS}</p>
        </div>
      {:else if error}
        <div class="text-center p-6">
          <i class="fas fa-exclamation-triangle text-4xl text-[var(--color-danger)] mb-4"></i>
          <p class="text-[var(--color-text-secondary)]">{error}</p>
          <button class="btn btn-primary mt-4" onclick={() => loadAdmins()}
            >{MESSAGES.BTN_RETRY}</button
          >
        </div>
      {:else if filteredAdmins.length === 0}
        <div id="admins-empty" class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-users"></i>
          </div>
          <h3 class="empty-state__title">{MESSAGES.EMPTY_TITLE}</h3>
          <p class="empty-state__description">{MESSAGES.EMPTY_DESCRIPTION}</p>
          <button class="btn btn-primary" onclick={openAddModal}>
            <i class="fas fa-plus"></i>
            {MESSAGES.BTN_ADD_ADMIN}
          </button>
        </div>
      {:else}
        <div id="admins-table-content">
          <div class="table-responsive">
            <table class="data-table data-table--hover data-table--striped" id="admins-table">
              <thead>
                <tr>
                  <th scope="col">{MESSAGES.TH_ID}</th>
                  <th scope="col">{MESSAGES.TH_NAME}</th>
                  <th scope="col">{MESSAGES.TH_EMAIL}</th>
                  <th scope="col">{MESSAGES.TH_EMPLOYEE_NUMBER}</th>
                  <th scope="col">{MESSAGES.TH_POSITION}</th>
                  <th scope="col">{MESSAGES.TH_STATUS}</th>
                  <th scope="col">{MESSAGES.TH_AREAS}</th>
                  <th scope="col">{MESSAGES.TH_DEPARTMENTS}</th>
                  <th scope="col">{MESSAGES.TH_TEAMS}</th>
                  <th scope="col">{MESSAGES.TH_ACTIONS}</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredAdmins as admin (admin.id)}
                  {@const areasBadge = getAreasBadge(admin)}
                  {@const deptsBadge = getDepartmentsBadge(admin)}
                  {@const teamsBadge = getTeamsBadge(admin)}
                  <tr>
                    <td>{admin.id}</td>
                    <td>
                      <div class="flex items-center gap-2">
                        <div class="avatar avatar--sm avatar--color-{getAvatarColor(admin.id)}">
                          <span>{admin.firstName.charAt(0)}{admin.lastName.charAt(0)}</span>
                        </div>
                        <span>{admin.firstName} {admin.lastName}</span>
                      </div>
                    </td>
                    <td>{admin.email}</td>
                    <td>{admin.employeeNumber ?? '-'}</td>
                    <td>{getPositionDisplay(admin.position ?? '')}</td>
                    <td>
                      <span class="badge {getStatusBadgeClass(admin.isActive)}"
                        >{getStatusLabel(admin.isActive)}</span
                      >
                    </td>
                    <td>
                      <span class="badge {areasBadge.class}" title={areasBadge.title}>
                        {#if areasBadge.icon}<i class="fas {areasBadge.icon} mr-1"></i>{/if}
                        {areasBadge.text}
                      </span>
                    </td>
                    <td>
                      <span class="badge {deptsBadge.class}" title={deptsBadge.title}>
                        {#if deptsBadge.icon}<i class="fas {deptsBadge.icon} mr-1"></i>{/if}
                        {deptsBadge.text}
                      </span>
                    </td>
                    <td>
                      <span class="badge {teamsBadge.class}" title={teamsBadge.title}>
                        {#if teamsBadge.icon}<i class="fas {teamsBadge.icon} mr-1"></i>{/if}
                        {teamsBadge.text}
                      </span>
                    </td>
                    <td>
                      <div class="flex gap-2">
                        <button
                          class="action-icon action-icon--edit"
                          title="Bearbeiten"
                          aria-label="Admin bearbeiten"
                          onclick={() => openEditModal(admin.id)}
                        >
                          <i class="fas fa-edit"></i>
                        </button>
                        <button
                          class="action-icon action-icon--delete"
                          title="Löschen"
                          aria-label="Admin löschen"
                          onclick={() => openDeleteModal(admin.id)}
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
<button class="btn-float" onclick={openAddModal} aria-label="Administrator hinzufügen">
  <i class="fas fa-user-plus"></i>
</button>

<!-- Add/Edit Admin Modal -->
<div
  id="admin-modal"
  class="modal-overlay"
  class:modal-overlay--active={showAdminModal}
  role="dialog"
  aria-modal="true"
  aria-labelledby="admin-modal-title"
  tabindex="-1"
  onclick={handleModalOverlayClick}
  onkeydown={(e) => e.key === 'Escape' && closeAdminModal()}
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <form
    id="admin-form"
    class="ds-modal"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    onsubmit={handleFormSubmit}
  >
    <div class="ds-modal__header">
      <h3 class="ds-modal__title" id="admin-modal-title">{modalTitle}</h3>
      <button
        type="button"
        class="ds-modal__close"
        aria-label="Schließen"
        onclick={closeAdminModal}
      >
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="ds-modal__body">
      <div class="form-field">
        <label class="form-field__label" for="admin-first-name">
          {MESSAGES.LABEL_FIRST_NAME} <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="admin-first-name"
          name="firstName"
          class="form-field__control"
          required
          bind:value={formFirstName}
        />
      </div>

      <div class="form-field">
        <label class="form-field__label" for="admin-last-name">
          {MESSAGES.LABEL_LAST_NAME} <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="admin-last-name"
          name="lastName"
          class="form-field__control"
          required
          bind:value={formLastName}
        />
      </div>

      <div class="form-field">
        <label class="form-field__label" for="admin-email">
          {MESSAGES.LABEL_EMAIL} <span class="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="admin-email"
          name="email"
          class="form-field__control"
          class:is-error={emailError}
          required
          bind:value={formEmail}
          oninput={validateEmails}
        />
      </div>

      <div class="form-field" id="email-confirm-group">
        <label class="form-field__label" for="admin-email-confirm">
          {MESSAGES.LABEL_EMAIL_CONFIRM} <span class="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="admin-email-confirm"
          name="emailConfirm"
          class="form-field__control"
          class:is-error={emailError}
          required
          bind:value={formEmailConfirm}
          oninput={validateEmails}
        />
        {#if emailError}
          <span class="form-field__message form-field__message--error"
            >{MESSAGES.ERROR_EMAIL_MISMATCH}</span
          >
        {/if}
      </div>

      <div class="form-field" id="password-group">
        <label class="form-field__label" for="admin-password">
          {MESSAGES.LABEL_PASSWORD}
          {#if !isEditMode}<span class="text-red-500">*</span>{/if}
          <span class="tooltip ml-1">
            <i class="fas fa-info-circle text-blue-400 text-sm cursor-help"></i>
            <span
              class="tooltip__content tooltip__content--info tooltip__content--right"
              role="tooltip"
            >
              {MESSAGES.HINT_PASSWORD}
            </span>
          </span>
        </label>
        <div class="form-field__password-wrapper">
          <input
            type={showPassword ? 'text' : 'password'}
            id="admin-password"
            name="password"
            class="form-field__control"
            class:is-error={passwordError}
            required={!isEditMode}
            bind:value={formPassword}
            oninput={() => {
              validatePasswords();
              updatePasswordStrength();
            }}
          />
          <button
            type="button"
            class="form-field__password-toggle"
            aria-label="Passwort anzeigen"
            onclick={() => (showPassword = !showPassword)}
          >
            <i class="fas" class:fa-eye={!showPassword} class:fa-eye-slash={showPassword}></i>
          </button>
        </div>
      </div>

      <div class="form-field" id="password-confirm-group">
        <label class="form-field__label" for="admin-password-confirm">
          {MESSAGES.LABEL_PASSWORD_CONFIRM}
          {#if !isEditMode}<span class="text-red-500">*</span>{/if}
        </label>
        <div class="form-field__password-wrapper">
          <input
            type={showPasswordConfirm ? 'text' : 'password'}
            id="admin-password-confirm"
            name="passwordConfirm"
            class="form-field__control"
            class:is-error={passwordError}
            required={!isEditMode}
            bind:value={formPasswordConfirm}
            oninput={validatePasswords}
          />
          <button
            type="button"
            class="form-field__password-toggle"
            aria-label="Passwort anzeigen"
            onclick={() => (showPasswordConfirm = !showPasswordConfirm)}
          >
            <i
              class="fas"
              class:fa-eye={!showPasswordConfirm}
              class:fa-eye-slash={showPasswordConfirm}
            ></i>
          </button>
        </div>
        {#if passwordError}
          <span class="form-field__message form-field__message--error"
            >{MESSAGES.ERROR_PASSWORD_MISMATCH}</span
          >
        {/if}
      </div>

      {#if formPassword}
        <div class="password-strength-container" id="admin-password-strength-container">
          <div class="password-strength-meter">
            <div class="password-strength-bar" data-score={passwordScore}></div>
          </div>
          <div class="password-strength-info">
            <span class="password-strength-label">{passwordLabel}</span>
            <span class="password-strength-time">{passwordTime}</span>
          </div>
        </div>
      {/if}

      <div class="form-field">
        <label class="form-field__label" for="admin-employee-number">
          {MESSAGES.LABEL_EMPLOYEE_NUMBER} <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="admin-employee-number"
          name="employeeNumber"
          class="form-field__control"
          placeholder="z.B. ABC-123 oder 2025-001"
          maxlength="10"
          pattern="[A-Za-z0-9\-]{'{'}1,10}"
          required
          bind:value={formEmployeeNumber}
        />
        <span class="form-field__message text-[var(--color-text-secondary)]"
          >{MESSAGES.HINT_EMPLOYEE_NUMBER}</span
        >
      </div>

      <div class="form-field">
        <label class="form-field__label" for="admin-position">
          {MESSAGES.LABEL_POSITION} <span class="text-red-500">*</span>
        </label>
        <div class="dropdown" id="position-dropdown">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="dropdown__trigger"
            class:active={positionDropdownOpen}
            onclick={togglePositionDropdown}
          >
            <span>{formPosition || 'Bitte wählen...'}</span>
            <i class="fas fa-chevron-down"></i>
          </div>
          <div class="dropdown__menu" class:active={positionDropdownOpen}>
            {#each POSITION_OPTIONS as position (position)}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="dropdown__option" onclick={() => selectPosition(position)}>
                {position}
              </div>
            {/each}
          </div>
        </div>
      </div>

      <div class="form-field">
        <label class="form-field__label" for="admin-notes">{MESSAGES.LABEL_NOTES}</label>
        <textarea
          id="admin-notes"
          name="notes"
          class="form-field__control"
          rows="3"
          bind:value={formNotes}
        ></textarea>
      </div>

      <!-- N:M Organization Assignment Section -->
      <div class="mt-6 pt-6 border-t border-[var(--color-border)]">
        <h4 class="text-[var(--color-text-primary)] font-medium mb-4">
          <i class="fas fa-sitemap mr-2"></i>
          Organisationszuweisung
        </h4>

        <div class="form-field mb-4">
          <label class="toggle-switch toggle-switch--danger">
            <input
              type="checkbox"
              class="toggle-switch__input"
              id="admin-full-access"
              bind:checked={formHasFullAccess}
            />
            <span class="toggle-switch__slider"></span>
            <span class="toggle-switch__label">
              <i class="fas fa-building mr-2"></i>
              {MESSAGES.FULL_ACCESS_LABEL}
            </span>
          </label>
          <span class="form-field__message text-[var(--color-danger)] mt-2 block">
            <i class="fas fa-exclamation-triangle mr-1"></i>
            {MESSAGES.FULL_ACCESS_WARNING}
          </span>
        </div>

        <div
          class="form-field mb-4"
          id="admin-area-select-container"
          class:opacity-50={formHasFullAccess}
        >
          <label class="form-field__label" for="admin-areas">
            <i class="fas fa-layer-group mr-1"></i>
            {MESSAGES.LABEL_AREAS}
          </label>
          <select
            id="admin-areas"
            name="areaIds"
            multiple
            class="form-field__control min-h-[100px]"
            disabled={formHasFullAccess}
            onchange={handleAreaChange}
          >
            {#each allAreas as area (area.id)}
              <option value={area.id} selected={formAreaIds.includes(area.id)}>
                {area.name}{area.departmentCount ? ` (${area.departmentCount} Abt.)` : ''}
              </option>
            {/each}
          </select>
          <span class="form-field__message text-[var(--color-text-secondary)]">
            <i class="fas fa-info-circle mr-1"></i>
            {MESSAGES.HINT_MULTISELECT}
            {MESSAGES.HINT_AREAS}
          </span>
        </div>

        <div
          class="form-field mb-4"
          id="admin-department-select-container"
          class:opacity-50={formHasFullAccess}
        >
          <label class="form-field__label" for="admin-departments">
            <i class="fas fa-sitemap mr-1"></i>
            {MESSAGES.LABEL_DEPARTMENTS}
          </label>
          <select
            id="admin-departments"
            name="departmentIds"
            multiple
            class="form-field__control min-h-[120px]"
            disabled={formHasFullAccess}
            onchange={handleDepartmentChange}
          >
            {#each availableDepartments as dept (dept.id)}
              <option value={dept.id} selected={formDepartmentIds.includes(dept.id)}>
                {dept.name}{dept.areaName ? ` (${dept.areaName})` : ''}
              </option>
            {/each}
          </select>
          <span class="form-field__message text-[var(--color-text-secondary)]">
            <i class="fas fa-info-circle mr-1"></i>
            {MESSAGES.HINT_MULTISELECT}
            {MESSAGES.HINT_DEPARTMENTS}
          </span>
        </div>

        <!-- svelte-ignore a11y_label_has_associated_control -->
        <div class="form-field" id="admin-team-info-container">
          <label class="form-field__label">
            <i class="fas fa-users mr-1"></i>
            {MESSAGES.LABEL_TEAMS}
          </label>
          <div class="alert alert--info">
            <div class="alert__icon">
              <i class="fas fa-info-circle"></i>
            </div>
            <div class="alert__content">
              <div class="alert__message">{MESSAGES.HINT_TEAMS}</div>
            </div>
          </div>
        </div>
      </div>

      {#if isEditMode}
        <div class="form-field" id="active-status-group">
          <label class="form-field__label" for="admin-status">
            {MESSAGES.LABEL_STATUS} <span class="text-red-500">*</span>
          </label>
          <div class="dropdown" id="status-dropdown">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="dropdown__trigger"
              class:active={statusDropdownOpen}
              onclick={toggleStatusDropdown}
            >
              <span class="badge {getStatusBadgeClass(formIsActive)}"
                >{getStatusLabel(formIsActive)}</span
              >
              <i class="fas fa-chevron-down"></i>
            </div>
            <div class="dropdown__menu" class:active={statusDropdownOpen}>
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="dropdown__option" onclick={() => selectStatus(1)}>
                <span class="badge badge--success">Aktiv</span>
              </div>
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="dropdown__option" onclick={() => selectStatus(0)}>
                <span class="badge badge--warning">Inaktiv</span>
              </div>
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="dropdown__option" onclick={() => selectStatus(3)}>
                <span class="badge badge--secondary">Archiviert</span>
              </div>
            </div>
          </div>
          <span class="form-field__message text-[var(--color-text-secondary)] mt-1 block">
            {MESSAGES.HINT_STATUS}
          </span>
        </div>
      {/if}
    </div>

    <div class="ds-modal__footer">
      <button type="button" class="btn btn-cancel" onclick={closeAdminModal}
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
  id="delete-admin-modal"
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
  id="delete-admin-confirm-modal"
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
        onclick={closeDeleteConfirmModal}>{MESSAGES.BTN_CANCEL}</button
      >
      <button
        type="button"
        class="confirm-modal__btn confirm-modal__btn--danger"
        onclick={deleteAdmin}
      >
        {MESSAGES.BTN_DELETE_FINAL}
      </button>
    </div>
  </div>
</div>
