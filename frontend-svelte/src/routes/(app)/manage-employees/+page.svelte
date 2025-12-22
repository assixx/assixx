<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { showErrorAlert } from '$lib/stores/toast.js';

  // Page-specific CSS
  import '../../../styles/manage-employees.css';
  import '../../../styles/password-strength.css';

  // Local modules
  import type {
    Employee,
    Team,
    StatusFilter,
    FormIsActiveStatus,
    AvailabilityStatus,
  } from './_lib/types';
  import { POSITION_OPTIONS, AVAILABILITY_OPTIONS, MESSAGES } from './_lib/constants';
  import {
    loadEmployees as apiLoadEmployees,
    loadTeams as apiLoadTeams,
    saveEmployee as apiSaveEmployee,
    deleteEmployee as apiDeleteEmployee,
    assignTeamMember,
    buildEmployeePayload,
  } from './_lib/api';
  import { applyAllFilters } from './_lib/filters';
  import {
    getStatusBadgeClass,
    getStatusLabel,
    getAvatarColor,
    getTeamsBadge,
    getAvailabilityBadge,
    getAvailabilityLabel,
    highlightMatch,
    calculatePasswordStrength,
    populateFormFromEmployee,
    getDefaultFormValues,
    validateEmailMatch,
    validatePasswordMatch,
  } from './_lib/utils';

  // =============================================================================
  // SVELTE 5 RUNES - State
  // =============================================================================

  // Employee Data
  let allEmployees = $state<Employee[]>([]);
  let filteredEmployees = $state<Employee[]>([]);

  // Organization Data (for multi-selects)
  let allTeams = $state<Team[]>([]);

  // Loading and Error States
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Filter State
  let currentStatusFilter = $state<StatusFilter>('active');
  let currentSearchQuery = $state('');

  // Search State
  let searchOpen = $state(false);

  // Modal States
  let showEmployeeModal = $state(false);
  let showDeleteModal = $state(false);
  let showDeleteConfirmModal = $state(false);

  // Edit State
  let currentEditId = $state<number | null>(null);
  let deleteEmployeeId = $state<number | null>(null);

  // Form Fields
  let formFirstName = $state('');
  let formLastName = $state('');
  let formEmail = $state('');
  let formEmailConfirm = $state('');
  let formPassword = $state('');
  let formPasswordConfirm = $state('');
  let formEmployeeNumber = $state('');
  let formPosition = $state('');
  let formPhone = $state('');
  let formDateOfBirth = $state('');
  let formIsActive = $state<FormIsActiveStatus>(1);

  // Team Assignment (ONLY for Employees - Area/Department inherited)
  let formTeamIds = $state<number[]>([]);

  // Availability Fields
  let formAvailabilityStatus = $state<AvailabilityStatus>('available');
  let formAvailabilityStart = $state('');
  let formAvailabilityEnd = $state('');
  let formAvailabilityNotes = $state('');

  // Dropdown States
  let positionDropdownOpen = $state(false);
  let statusDropdownOpen = $state(false);
  let availabilityDropdownOpen = $state(false);

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
  const modalTitle = $derived(isEditMode ? MESSAGES.MODAL_TITLE_EDIT : MESSAGES.MODAL_TITLE_ADD);

  // =============================================================================
  // DATA LOADING
  // =============================================================================

  async function loadEmployees(): Promise<void> {
    loading = true;
    error = null;

    try {
      allEmployees = await apiLoadEmployees();
      applyFilters();
    } catch (err) {
      console.error('[ManageEmployees] Error loading employees:', err);
      error = err instanceof Error ? err.message : MESSAGES.ERROR_LOADING;
    } finally {
      loading = false;
    }
  }

  async function loadTeams(): Promise<void> {
    allTeams = await apiLoadTeams();
  }

  // =============================================================================
  // FILTER APPLICATION
  // =============================================================================

  function applyFilters(): void {
    filteredEmployees = applyAllFilters(allEmployees, currentStatusFilter, currentSearchQuery);
  }

  // =============================================================================
  // SAVE & DELETE OPERATIONS
  // =============================================================================

  async function saveEmployee(): Promise<void> {
    submitting = true;

    try {
      // Validate
      if (!validateEmailMatch(formEmail, formEmailConfirm)) {
        emailError = true;
        submitting = false;
        return;
      }

      if (!isEditMode && !validatePasswordMatch(formPassword, formPasswordConfirm)) {
        passwordError = true;
        submitting = false;
        return;
      }

      if (isEditMode && formPassword && !validatePasswordMatch(formPassword, formPasswordConfirm)) {
        passwordError = true;
        submitting = false;
        return;
      }

      // Build payload
      const payload = buildEmployeePayload(
        {
          firstName: formFirstName,
          lastName: formLastName,
          email: formEmail,
          password: formPassword,
          position: formPosition,
          phone: formPhone,
          dateOfBirth: formDateOfBirth,
          employeeNumber: formEmployeeNumber,
          isActive: formIsActive,
          availabilityStatus: formAvailabilityStatus,
          availabilityStart: formAvailabilityStart,
          availabilityEnd: formAvailabilityEnd,
          availabilityNotes: formAvailabilityNotes,
        },
        isEditMode,
      );

      const userId = await apiSaveEmployee(payload, currentEditId);

      // Handle team assignment
      if (userId && formTeamIds.length > 0) {
        const teamId = formTeamIds[0];
        if (teamId !== undefined) {
          await assignTeamMember(userId, teamId);
        }
      }

      closeEmployeeModal();
      await loadEmployees();
    } catch (err) {
      console.error('[ManageEmployees] Error saving employee:', err);
      showErrorAlert(err instanceof Error ? err.message : MESSAGES.ERROR_SAVING);
    } finally {
      submitting = false;
    }
  }

  async function deleteEmployee(): Promise<void> {
    if (deleteEmployeeId === null) return;

    try {
      await apiDeleteEmployee(deleteEmployeeId);
      showDeleteConfirmModal = false;
      deleteEmployeeId = null;
      await loadEmployees();
    } catch (err) {
      console.error('[ManageEmployees] Error deleting employee:', err);
      showErrorAlert(MESSAGES.ERROR_DELETING);
    }
  }

  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================

  function openAddModal(): void {
    currentEditId = null;
    resetForm();
    showEmployeeModal = true;
  }

  function openEditModal(employeeId: number): void {
    const employee = allEmployees.find((e) => e.id === employeeId);
    if (!employee) return;

    currentEditId = employeeId;
    const formData = populateFormFromEmployee(employee);

    formFirstName = formData.firstName;
    formLastName = formData.lastName;
    formEmail = formData.email;
    formEmailConfirm = formData.emailConfirm;
    formPassword = formData.password;
    formPasswordConfirm = formData.passwordConfirm;
    formEmployeeNumber = formData.employeeNumber;
    formPosition = formData.position;
    formPhone = formData.phone;
    formDateOfBirth = formData.dateOfBirth;
    formIsActive = formData.isActive;
    formTeamIds = formData.teamIds;
    formAvailabilityStatus = formData.availabilityStatus;
    formAvailabilityStart = formData.availabilityStart;
    formAvailabilityEnd = formData.availabilityEnd;
    formAvailabilityNotes = formData.availabilityNotes;
    emailError = false;
    passwordError = false;
    showEmployeeModal = true;
  }

  function openDeleteModal(employeeId: number): void {
    deleteEmployeeId = employeeId;
    showDeleteModal = true;
  }

  function proceedToDeleteConfirm(): void {
    showDeleteModal = false;
    showDeleteConfirmModal = true;
  }

  function closeEmployeeModal(): void {
    showEmployeeModal = false;
    currentEditId = null;
    resetForm();
  }

  function closeDeleteModal(): void {
    showDeleteModal = false;
    deleteEmployeeId = null;
  }

  function closeDeleteConfirmModal(): void {
    showDeleteConfirmModal = false;
    deleteEmployeeId = null;
  }

  function resetForm(): void {
    const defaults = getDefaultFormValues();
    formFirstName = defaults.firstName;
    formLastName = defaults.lastName;
    formEmail = defaults.email;
    formEmailConfirm = defaults.emailConfirm;
    formPassword = defaults.password;
    formPasswordConfirm = defaults.passwordConfirm;
    formEmployeeNumber = defaults.employeeNumber;
    formPosition = defaults.position;
    formPhone = defaults.phone;
    formDateOfBirth = defaults.dateOfBirth;
    formIsActive = defaults.isActive;
    formTeamIds = defaults.teamIds;
    formAvailabilityStatus = defaults.availabilityStatus;
    formAvailabilityStart = defaults.availabilityStart;
    formAvailabilityEnd = defaults.availabilityEnd;
    formAvailabilityNotes = defaults.availabilityNotes;
    emailError = false;
    passwordError = false;
    passwordScore = -1;
    passwordLabel = '';
    passwordTime = '';
    showPassword = false;
    showPasswordConfirm = false;
    positionDropdownOpen = false;
    statusDropdownOpen = false;
    availabilityDropdownOpen = false;
  }

  // =============================================================================
  // DROPDOWN HANDLERS
  // =============================================================================

  function togglePositionDropdown(e: MouseEvent): void {
    e.stopPropagation();
    statusDropdownOpen = false;
    availabilityDropdownOpen = false;
    positionDropdownOpen = !positionDropdownOpen;
  }

  function selectPosition(position: string): void {
    formPosition = position;
    positionDropdownOpen = false;
  }

  function toggleStatusDropdown(e: MouseEvent): void {
    e.stopPropagation();
    positionDropdownOpen = false;
    availabilityDropdownOpen = false;
    statusDropdownOpen = !statusDropdownOpen;
  }

  function selectStatus(status: FormIsActiveStatus): void {
    formIsActive = status;
    statusDropdownOpen = false;
  }

  function toggleAvailabilityDropdown(e: MouseEvent): void {
    e.stopPropagation();
    positionDropdownOpen = false;
    statusDropdownOpen = false;
    availabilityDropdownOpen = !availabilityDropdownOpen;
  }

  function selectAvailability(status: AvailabilityStatus): void {
    formAvailabilityStatus = status;
    availabilityDropdownOpen = false;
  }

  // =============================================================================
  // TEAM SELECT HANDLER
  // =============================================================================

  function handleTeamChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    formTeamIds = Array.from(select.selectedOptions).map((opt) => parseInt(opt.value, 10));
  }

  // =============================================================================
  // STATUS TOGGLE HANDLER
  // =============================================================================

  function handleStatusToggle(status: StatusFilter): void {
    currentStatusFilter = status;
    applyFilters();
  }

  // =============================================================================
  // SEARCH HANDLERS
  // =============================================================================

  function handleSearchInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    currentSearchQuery = input.value;
    searchOpen = currentSearchQuery.trim().length > 0;
    applyFilters();
  }

  function clearSearch(): void {
    currentSearchQuery = '';
    searchOpen = false;
    applyFilters();
  }

  function handleSearchResultClick(employeeId: number): void {
    openEditModal(employeeId);
    searchOpen = false;
    currentSearchQuery = '';
  }

  // =============================================================================
  // VALIDATION HANDLERS
  // =============================================================================

  function validateEmails(): void {
    emailError = !validateEmailMatch(formEmail, formEmailConfirm);
  }

  function validatePasswords(): void {
    passwordError = !validatePasswordMatch(formPassword, formPasswordConfirm);
  }

  // =============================================================================
  // PASSWORD STRENGTH
  // =============================================================================

  function updatePasswordStrength(): void {
    const result = calculatePasswordStrength(formPassword);
    passwordScore = result.score;
    passwordLabel = result.label;
    passwordTime = result.time;
  }

  // =============================================================================
  // FORM SUBMIT HANDLER
  // =============================================================================

  function handleFormSubmit(e: Event): void {
    e.preventDefault();
    saveEmployee();
  }

  // =============================================================================
  // OVERLAY CLICK HANDLERS
  // =============================================================================

  function handleModalOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) closeEmployeeModal();
  }

  function handleDeleteOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) closeDeleteModal();
  }

  function handleDeleteConfirmOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) closeDeleteConfirmModal();
  }

  // =============================================================================
  // OUTSIDE CLICK HANDLERS
  // =============================================================================

  $effect(() => {
    if (positionDropdownOpen || statusDropdownOpen || availabilityDropdownOpen || searchOpen) {
      const handleOutsideClick = (e: MouseEvent): void => {
        const target = e.target as HTMLElement;

        if (positionDropdownOpen) {
          const el = document.getElementById('position-dropdown');
          if (el && !el.contains(target)) positionDropdownOpen = false;
        }

        if (statusDropdownOpen) {
          const el = document.getElementById('status-dropdown');
          if (el && !el.contains(target)) statusDropdownOpen = false;
        }

        if (availabilityDropdownOpen) {
          const el = document.getElementById('availability-dropdown');
          if (el && !el.contains(target)) availabilityDropdownOpen = false;
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

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (showDeleteConfirmModal) closeDeleteConfirmModal();
      else if (showDeleteModal) closeDeleteModal();
      else if (showEmployeeModal) closeEmployeeModal();
    }
  }

  // =============================================================================
  // LIFECYCLE
  // =============================================================================

  onMount(() => {
    const token = localStorage.getItem('accessToken');
    const activeRole = localStorage.getItem('activeRole');

    // Admin or Root can manage employees
    if (!token || (activeRole !== 'admin' && activeRole !== 'root')) {
      goto(`${base}/login`);
      return;
    }

    loadEmployees();
    loadTeams();
  });
</script>

<svelte:head>
  <title>Mitarbeiterverwaltung - Assixx</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="container">
  <div class="card">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-users mr-2"></i>
        Mitarbeiterverwaltung
      </h2>
      <p class="text-[var(--color-text-secondary)] mt-2">Mitarbeiter erstellen und verwalten</p>

      <div class="flex gap-4 items-center justify-between mt-6">
        <!-- Status Toggle Group -->
        <div class="toggle-group" id="employee-status-toggle">
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'active'}
            title="Aktive Mitarbeiter"
            onclick={() => handleStatusToggle('active')}
          >
            <i class="fas fa-user-check"></i>
            Aktive
          </button>
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'inactive'}
            title="Inaktive Mitarbeiter"
            onclick={() => handleStatusToggle('inactive')}
          >
            <i class="fas fa-user-times"></i>
            Inaktive
          </button>
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'archived'}
            title="Archivierte Mitarbeiter"
            onclick={() => handleStatusToggle('archived')}
          >
            <i class="fas fa-archive"></i>
            Archiviert
          </button>
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'all'}
            title="Alle Mitarbeiter"
            onclick={() => handleStatusToggle('all')}
          >
            <i class="fas fa-users"></i>
            Alle
          </button>
        </div>

        <!-- Search Input -->
        <div class="search-input-wrapper max-w-80" class:search-input-wrapper--open={searchOpen}>
          <div class="search-input" id="employee-search-container">
            <i class="search-input__icon fas fa-search"></i>
            <input
              type="search"
              id="employee-search"
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
          <div class="search-input__results" id="employee-search-results">
            {#if currentSearchQuery && filteredEmployees.length === 0}
              <div class="search-input__no-results">
                {MESSAGES.SEARCH_NO_RESULTS} "{currentSearchQuery}"
              </div>
            {:else if currentSearchQuery}
              {#each filteredEmployees.slice(0, 5) as employee (employee.id)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="search-input__result-item"
                  onclick={() => handleSearchResultClick(employee.id)}
                >
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="font-weight: 500; color: var(--color-text-primary);">
                      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                      {@html highlightMatch(
                        `${employee.firstName} ${employee.lastName}`,
                        currentSearchQuery,
                      )}
                    </div>
                    <div style="font-size: 0.813rem; color: var(--color-text-secondary);">
                      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                      {@html highlightMatch(employee.email, currentSearchQuery)}
                    </div>
                    <div
                      style="font-size: 0.75rem; color: var(--color-text-muted); display: flex; gap: 8px;"
                    >
                      <span>
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html highlightMatch(employee.position ?? '', currentSearchQuery)}
                      </span>
                      {#if employee.employeeNumber}
                        <span>
                          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                          • {@html highlightMatch(employee.employeeNumber, currentSearchQuery)}
                        </span>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
              {#if filteredEmployees.length > 5}
                <div
                  class="search-input__result-item"
                  style="font-size: 0.813rem; color: var(--color-primary); text-align: center; border-top: 1px solid rgb(255 255 255 / 5%);"
                >
                  {filteredEmployees.length - 5}
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
        <div id="employees-loading" class="spinner-container">
          <div class="spinner-ring spinner-ring--md"></div>
          <p class="mt-2 text-[var(--color-text-secondary)]">{MESSAGES.LOADING_EMPLOYEES}</p>
        </div>
      {:else if error}
        <div class="text-center p-6">
          <i class="fas fa-exclamation-triangle text-4xl text-[var(--color-danger)] mb-4"></i>
          <p class="text-[var(--color-text-secondary)]">{error}</p>
          <button class="btn btn-primary mt-4" onclick={() => loadEmployees()}
            >Erneut versuchen</button
          >
        </div>
      {:else if filteredEmployees.length === 0}
        <div id="employees-empty" class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-users"></i>
          </div>
          <h3 class="empty-state__title">{MESSAGES.NO_EMPLOYEES_FOUND}</h3>
          <p class="empty-state__description">{MESSAGES.CREATE_FIRST_EMPLOYEE}</p>
          <button class="btn btn-primary" onclick={openAddModal}>
            <i class="fas fa-plus"></i>
            Mitarbeiter hinzufügen
          </button>
        </div>
      {:else}
        <div id="employees-table-content">
          <div class="table-responsive">
            <table class="data-table data-table--hover data-table--striped" id="employees-table">
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Name</th>
                  <th scope="col">E-Mail</th>
                  <th scope="col">Personalnummer</th>
                  <th scope="col">Position</th>
                  <th scope="col">Status</th>
                  <th scope="col">Team</th>
                  <th scope="col">Verfügbarkeit</th>
                  <th scope="col">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredEmployees as employee (employee.id)}
                  {@const teamsBadge = getTeamsBadge(employee)}
                  {@const availabilityBadge = getAvailabilityBadge(employee)}
                  <tr>
                    <td>{employee.id}</td>
                    <td>
                      <div class="flex items-center gap-2">
                        <div class="avatar avatar--sm avatar--color-{getAvatarColor(employee.id)}">
                          <span>{employee.firstName.charAt(0)}{employee.lastName.charAt(0)}</span>
                        </div>
                        <span>{employee.firstName} {employee.lastName}</span>
                      </div>
                    </td>
                    <td>{employee.email}</td>
                    <td>{employee.employeeNumber ?? '-'}</td>
                    <td>{employee.position ?? '-'}</td>
                    <td>
                      <span class="badge {getStatusBadgeClass(employee.isActive)}"
                        >{getStatusLabel(employee.isActive)}</span
                      >
                    </td>
                    <td>
                      <span class="badge {teamsBadge.class}" title={teamsBadge.title}>
                        {teamsBadge.text}
                      </span>
                    </td>
                    <td>
                      <span class="badge {availabilityBadge.class}">{availabilityBadge.text}</span>
                    </td>
                    <td>
                      <div class="flex gap-2">
                        <button
                          class="action-icon action-icon--edit"
                          title="Bearbeiten"
                          aria-label="Mitarbeiter bearbeiten"
                          onclick={() => openEditModal(employee.id)}
                        >
                          <i class="fas fa-edit"></i>
                        </button>
                        <button
                          class="action-icon action-icon--delete"
                          title="Löschen"
                          aria-label="Mitarbeiter löschen"
                          onclick={() => openDeleteModal(employee.id)}
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
  class="btn-float add-employee-btn"
  onclick={openAddModal}
  aria-label="Mitarbeiter hinzufügen"
>
  <i class="fas fa-user-plus"></i>
</button>

<!-- Add/Edit Employee Modal -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
<div
  id="employee-modal"
  class="modal-overlay"
  class:modal-overlay--active={showEmployeeModal}
  role="dialog"
  aria-modal="true"
  aria-labelledby="employee-modal-title"
  tabindex="-1"
  onclick={handleModalOverlayClick}
  onkeydown={(e) => e.key === 'Escape' && closeEmployeeModal()}
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
  <form
    id="employee-form"
    class="ds-modal"
    onclick={(e) => e.stopPropagation()}
    onsubmit={handleFormSubmit}
  >
    <div class="ds-modal__header">
      <h3 class="ds-modal__title" id="employee-modal-title">{modalTitle}</h3>
      <button
        type="button"
        class="ds-modal__close"
        aria-label="Schließen"
        onclick={closeEmployeeModal}
      >
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="ds-modal__body">
      <!-- Personal Information -->
      <div class="form-field">
        <label class="form-field__label" for="employee-first-name">
          Vorname <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="employee-first-name"
          name="firstName"
          class="form-field__control"
          required
          bind:value={formFirstName}
        />
      </div>

      <div class="form-field">
        <label class="form-field__label" for="employee-last-name">
          Nachname <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="employee-last-name"
          name="lastName"
          class="form-field__control"
          required
          bind:value={formLastName}
        />
      </div>

      <div class="form-field">
        <label class="form-field__label" for="employee-email">
          E-Mail <span class="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="employee-email"
          name="email"
          class="form-field__control"
          class:is-error={emailError}
          required
          bind:value={formEmail}
          oninput={validateEmails}
        />
        <span class="form-field__message text-[var(--color-text-secondary)]"
          >{MESSAGES.EMAIL_HINT}</span
        >
      </div>

      <div class="form-field" id="email-confirm-group">
        <label class="form-field__label" for="employee-email-confirm">
          E-Mail bestätigen <span class="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="employee-email-confirm"
          name="emailConfirm"
          class="form-field__control"
          class:is-error={emailError}
          required
          bind:value={formEmailConfirm}
          oninput={validateEmails}
        />
        {#if emailError}
          <span class="form-field__message form-field__message--error"
            >{MESSAGES.EMAIL_MISMATCH}</span
          >
        {/if}
      </div>

      <div class="form-field" id="password-group">
        <label class="form-field__label" for="employee-password">
          Passwort {#if !isEditMode}<span class="text-red-500">*</span>{/if}
          <span class="tooltip ml-1">
            <i class="fas fa-info-circle text-blue-400 text-sm cursor-help"></i>
            <span
              class="tooltip__content tooltip__content--info tooltip__content--right"
              role="tooltip"
            >
              {MESSAGES.PASSWORD_HINT}
            </span>
          </span>
        </label>
        <div class="form-field__password-wrapper">
          <input
            type={showPassword ? 'text' : 'password'}
            id="employee-password"
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
        <label class="form-field__label" for="employee-password-confirm">
          Passwort bestätigen {#if !isEditMode}<span class="text-red-500">*</span>{/if}
        </label>
        <div class="form-field__password-wrapper">
          <input
            type={showPasswordConfirm ? 'text' : 'password'}
            id="employee-password-confirm"
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
            >{MESSAGES.PASSWORD_MISMATCH}</span
          >
        {/if}
      </div>

      {#if formPassword}
        <div class="password-strength-container" id="employee-password-strength-container">
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
        <label class="form-field__label" for="employee-phone">Telefon</label>
        <input
          type="tel"
          id="employee-phone"
          name="phone"
          class="form-field__control"
          bind:value={formPhone}
        />
      </div>

      <div class="form-field">
        <label class="form-field__label" for="employee-position">Position</label>
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
        <label class="form-field__label" for="employee-number">Personalnummer</label>
        <input
          type="text"
          id="employee-number"
          name="employeeNumber"
          class="form-field__control"
          placeholder="z.B. EMP001 (optional, max 10 Zeichen)"
          maxlength="10"
          bind:value={formEmployeeNumber}
        />
        <span class="form-field__message text-[var(--color-text-secondary)]"
          >{MESSAGES.EMPLOYEE_NUMBER_HINT}</span
        >
      </div>

      <div class="form-field">
        <label class="form-field__label" for="employee-dateOfBirth">Geburtsdatum</label>
        <div class="date-picker">
          <i class="date-picker__icon fas fa-calendar"></i>
          <input
            type="date"
            id="employee-dateOfBirth"
            name="dateOfBirth"
            class="date-picker__input"
            bind:value={formDateOfBirth}
          />
        </div>
      </div>

      <!-- Team Assignment Section -->
      <div class="mt-6 pt-6 border-t border-[var(--color-border)]">
        <h4 class="text-[var(--color-text-primary)] font-medium mb-4">
          <i class="fas fa-users mr-2"></i>
          Team-Zuweisung
        </h4>

        <div class="alert alert--info mb-4">
          <div class="alert__icon">
            <i class="fas fa-info-circle"></i>
          </div>
          <div class="alert__content">
            <div class="alert__message">
              {MESSAGES.TEAM_INFO}
            </div>
          </div>
        </div>

        <div class="form-field" id="team-select-container">
          <label class="form-field__label" for="employee-teams">
            <i class="fas fa-users mr-1"></i>
            Teams
          </label>
          <select
            id="employee-teams"
            name="teamIds"
            multiple
            class="form-field__control min-h-[120px]"
            onchange={handleTeamChange}
          >
            {#each allTeams as team (team.id)}
              <option value={team.id} selected={formTeamIds.includes(team.id)}>
                {team.name}{team.departmentName ? ` (${team.departmentName})` : ''}
              </option>
            {/each}
          </select>
          <span class="form-field__message text-[var(--color-text-secondary)]">
            <i class="fas fa-info-circle mr-1"></i>
            {MESSAGES.TEAM_MULTISELECT_HINT}
          </span>
        </div>
      </div>

      <!-- Availability Section -->
      <div class="mt-6 pt-6 border-t border-[var(--color-border)]">
        <h4 class="text-[var(--color-text-primary)] font-medium mb-4">Verfügbarkeit</h4>

        <div class="form-field">
          <label class="form-field__label" for="availability-status">Verfügbarkeitsstatus</label>
          <div class="dropdown" id="availability-dropdown">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="dropdown__trigger"
              class:active={availabilityDropdownOpen}
              onclick={toggleAvailabilityDropdown}
            >
              <span>{getAvailabilityLabel(formAvailabilityStatus)}</span>
              <i class="fas fa-chevron-down"></i>
            </div>
            <div class="dropdown__menu" class:active={availabilityDropdownOpen}>
              {#each AVAILABILITY_OPTIONS as option (option.value)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="dropdown__option" onclick={() => selectAvailability(option.value)}>
                  {option.label}
                </div>
              {/each}
            </div>
          </div>
        </div>

        <div class="form-field">
          <label class="form-field__label" for="availability-start-date">Von Datum</label>
          <div class="date-picker">
            <i class="date-picker__icon fas fa-calendar"></i>
            <input
              type="date"
              id="availability-start-date"
              name="availabilityStart"
              class="date-picker__input"
              bind:value={formAvailabilityStart}
            />
          </div>
        </div>

        <div class="form-field">
          <label class="form-field__label" for="availability-end-date">Bis Datum</label>
          <div class="date-picker">
            <i class="date-picker__icon fas fa-calendar"></i>
            <input
              type="date"
              id="availability-end-date"
              name="availabilityEnd"
              class="date-picker__input"
              bind:value={formAvailabilityEnd}
            />
          </div>
        </div>

        <div class="form-field">
          <label class="form-field__label" for="availability-notes">Notiz (optional)</label>
          <textarea
            id="availability-notes"
            name="availabilityNotes"
            class="form-field__control"
            rows="3"
            placeholder="z.B. Familienurlaub, Krankmeldung bis..."
            bind:value={formAvailabilityNotes}
          ></textarea>
        </div>
      </div>

      {#if isEditMode}
        <div class="form-field mt-6" id="status-field-group">
          <label class="form-field__label" for="employee-status">
            Account Status <span class="text-red-500">*</span>
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
            {MESSAGES.STATUS_HINT}
          </span>
        </div>
      {/if}
    </div>

    <div class="ds-modal__footer">
      <button type="button" class="btn btn-cancel" onclick={closeEmployeeModal}>Abbrechen</button>
      <button type="submit" class="btn btn-modal" disabled={submitting}>
        {#if submitting}<span class="spinner-ring spinner-ring--sm mr-2"></span>{/if}
        Speichern
      </button>
    </div>
  </form>
</div>

<!-- Delete Modal Step 1 -->
<div
  id="delete-employee-modal"
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
        Möchten Sie diesen Mitarbeiter wirklich löschen?
      </p>
    </div>
    <div class="ds-modal__footer">
      <button type="button" class="btn btn-cancel" onclick={closeDeleteModal}>Abbrechen</button>
      <button type="button" class="btn btn-danger" onclick={proceedToDeleteConfirm}>Löschen</button>
    </div>
  </div>
</div>

<!-- Delete Modal Step 2 -->
<div
  id="delete-employee-confirm-modal"
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
      {MESSAGES.DELETE_CONFIRM_MESSAGE}
    </p>
    <div class="confirm-modal__actions">
      <button
        type="button"
        class="confirm-modal__btn confirm-modal__btn--cancel"
        onclick={closeDeleteConfirmModal}>Abbrechen</button
      >
      <button
        type="button"
        class="confirm-modal__btn confirm-modal__btn--danger"
        onclick={deleteEmployee}
      >
        Endgültig löschen
      </button>
    </div>
  </div>
</div>
