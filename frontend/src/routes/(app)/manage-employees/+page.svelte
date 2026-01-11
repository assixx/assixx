<script lang="ts">
  /**
   * Manage Employees - Page Component
   * @module manage-employees/+page
   *
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   */
  import { invalidateAll } from '$app/navigation';

  import { showSuccessAlert, showErrorAlert } from '$lib/utils';

  // Page-specific CSS
  import '../../../styles/manage-employees.css';
  import '../../../styles/password-strength.css';

  // Local modules
  import {
    saveEmployee as apiSaveEmployee,
    deleteEmployee as apiDeleteEmployee,
    syncTeamMemberships,
    buildEmployeePayload,
  } from './_lib/api';
  import { MESSAGES } from './_lib/constants';
  import DeleteModals from './_lib/DeleteModals.svelte';
  import EmployeeFormModal from './_lib/EmployeeFormModal.svelte';
  import EmployeeTableRow from './_lib/EmployeeTableRow.svelte';
  import { applyAllFilters } from './_lib/filters';
  import SearchResults from './_lib/SearchResults.svelte';
  import {
    populateFormFromEmployee,
    getDefaultFormValues,
    validateEmailMatch,
    validatePasswordMatch,
    validateSaveEmployeeForm,
  } from './_lib/utils';

  // Extracted Components

  import type { PageData } from './$types';
  import type {
    Employee,
    Team,
    StatusFilter,
    FormIsActiveStatus,
    AvailabilityStatus,
  } from './_lib/types';

  // =============================================================================
  // SSR DATA - Level 3: $derived from props (single source of truth)
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // SSR data via $derived - updates when invalidateAll() is called
  const allEmployees = $derived<Employee[]>(data.employees);
  const allTeams = $derived<Team[]>(data.teams);

  // =============================================================================
  // UI STATE - Filtering and form state (client-side only)
  // =============================================================================

  // Error state
  const error = $state<string | null>(null);

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
  let originalTeamIds = $state<number[]>([]);

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
  let formTeamIds = $state<number[]>([]);
  let formAvailabilityStatus = $state<AvailabilityStatus>('available');
  let formAvailabilityStart = $state('');
  let formAvailabilityEnd = $state('');
  let formAvailabilityNotes = $state('');

  // Validation State
  let emailError = $state(false);
  let passwordError = $state(false);
  let submitting = $state(false);

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const isEditMode = $derived(currentEditId !== null);
  const modalTitle = $derived(isEditMode ? MESSAGES.MODAL_TITLE_EDIT : MESSAGES.MODAL_TITLE_ADD);

  // Derived: Filtered employees based on current filter/search state
  const filteredEmployees = $derived(
    applyAllFilters(allEmployees, currentStatusFilter, currentSearchQuery),
  );

  // =============================================================================
  // API FUNCTIONS - Level 3: invalidateAll() after mutations
  // =============================================================================

  async function saveEmployee(): Promise<void> {
    submitting = true;

    // Validate form fields
    const validationError = validateSaveEmployeeForm(
      formEmail,
      formEmailConfirm,
      formPassword,
      formPasswordConfirm,
      isEditMode,
    );

    if (validationError !== null) {
      emailError = validationError === 'email';
      passwordError = validationError === 'password';
      submitting = false;
      return;
    }

    try {
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
      await syncTeamMemberships(userId, formTeamIds, originalTeamIds, isEditMode);

      closeEmployeeModal();
      // Level 3: Trigger SSR refetch
      await invalidateAll();
      showSuccessAlert(isEditMode ? 'Mitarbeiter aktualisiert' : 'Mitarbeiter erstellt');
    } catch (err) {
      console.error('[ManageEmployees] Error saving employee:', err);
      showErrorAlert(err instanceof Error ? err.message : MESSAGES.ERROR_SAVING);
    } finally {
      submitting = false;
    }
  }

  async function deleteEmployee(): Promise<void> {
    const idToDelete = deleteEmployeeId;
    if (idToDelete === null) return;

    // Reset state immediately to prevent double-clicks
    deleteEmployeeId = null;
    showDeleteConfirmModal = false;

    try {
      await apiDeleteEmployee(idToDelete);
      // Level 3: Trigger SSR refetch
      await invalidateAll();
      showSuccessAlert('Mitarbeiter wurde gelöscht');
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
    // Store original team IDs for diff calculation on save
    originalTeamIds = [...formData.teamIds];
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
    originalTeamIds = []; // Reset original teams for diff calculation
    formAvailabilityStatus = defaults.availabilityStatus;
    formAvailabilityStart = defaults.availabilityStart;
    formAvailabilityEnd = defaults.availabilityEnd;
    formAvailabilityNotes = defaults.availabilityNotes;
    emailError = false;
    passwordError = false;
  }

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  function handleStatusToggle(status: StatusFilter): void {
    currentStatusFilter = status;
    // filteredEmployees is $derived - automatically updates when filter changes
  }

  function handleSearchInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    currentSearchQuery = input.value;
    searchOpen = currentSearchQuery.trim().length > 0;
    // filteredEmployees is $derived - automatically updates when search changes
  }

  function clearSearch(): void {
    currentSearchQuery = '';
    searchOpen = false;
    // filteredEmployees is $derived - automatically updates
  }

  function handleSearchResultClick(employeeId: number): void {
    openEditModal(employeeId);
    searchOpen = false;
    currentSearchQuery = '';
  }

  function validateEmails(): void {
    emailError = !validateEmailMatch(formEmail, formEmailConfirm);
  }

  function validatePasswords(): void {
    passwordError = !validatePasswordMatch(formPassword, formPasswordConfirm);
  }

  function handleFormSubmit(e: Event): void {
    e.preventDefault();
    void saveEmployee();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (showDeleteConfirmModal) closeDeleteConfirmModal();
      else if (showDeleteModal) closeDeleteModal();
      else if (showEmployeeModal) closeEmployeeModal();
    }
  }

  // =============================================================================
  // OUTSIDE CLICK HANDLER
  // =============================================================================

  $effect(() => {
    if (searchOpen) {
      const handleOutsideClick = (e: MouseEvent): void => {
        const target = e.target as HTMLElement;
        const el = document.querySelector('.search-input-wrapper');
        if (el && !el.contains(target)) searchOpen = false;
      };
      document.addEventListener('click', handleOutsideClick);
      return () => {
        document.removeEventListener('click', handleOutsideClick);
      };
    }
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
            type="button"
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'active'}
            title="Aktive Mitarbeiter"
            onclick={() => {
              handleStatusToggle('active');
            }}
          >
            <i class="fas fa-user-check"></i>
            Aktive
          </button>
          <button
            type="button"
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'inactive'}
            title="Inaktive Mitarbeiter"
            onclick={() => {
              handleStatusToggle('inactive');
            }}
          >
            <i class="fas fa-user-times"></i>
            Inaktive
          </button>
          <button
            type="button"
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'archived'}
            title="Archivierte Mitarbeiter"
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
            title="Alle Mitarbeiter"
            onclick={() => {
              handleStatusToggle('all');
            }}
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
          <SearchResults
            searchQuery={currentSearchQuery}
            employees={filteredEmployees}
            onresultclick={handleSearchResultClick}
          />
        </div>
      </div>
    </div>

    <div class="card__body">
      {#if error}
        <div class="text-center p-6">
          <i class="fas fa-exclamation-triangle text-4xl text-[var(--color-danger)] mb-4"></i>
          <p class="text-[var(--color-text-secondary)]">{error}</p>
          <button type="button" class="btn btn-primary mt-4" onclick={() => invalidateAll()}>
            Erneut versuchen
          </button>
        </div>
      {:else if filteredEmployees.length === 0}
        <div id="employees-empty" class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-users"></i>
          </div>
          <h3 class="empty-state__title">{MESSAGES.NO_EMPLOYEES_FOUND}</h3>
          <p class="empty-state__description">{MESSAGES.CREATE_FIRST_EMPLOYEE}</p>
          <button type="button" class="btn btn-primary" onclick={openAddModal}>
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
                  <th scope="col">Position</th>
                  <th scope="col">Personalnummer</th>
                  <th scope="col">Status</th>
                  <th scope="col">Bereiche</th>
                  <th scope="col">Abteilungen</th>
                  <th scope="col">Teams</th>
                  <th scope="col">Verfügbarkeit</th>
                  <th scope="col">Geplant</th>
                  <th scope="col">Notizen</th>
                  <th scope="col">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredEmployees as employee (employee.id)}
                  <EmployeeTableRow {employee} onedit={openEditModal} ondelete={openDeleteModal} />
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
  class="btn-float add-employee-btn"
  onclick={openAddModal}
  aria-label="Mitarbeiter hinzufügen"
>
  <i class="fas fa-user-plus"></i>
</button>

<!-- Employee Form Modal Component -->
<EmployeeFormModal
  show={showEmployeeModal}
  {isEditMode}
  {modalTitle}
  {allTeams}
  {submitting}
  bind:formFirstName
  bind:formLastName
  bind:formEmail
  bind:formEmailConfirm
  bind:formPassword
  bind:formPasswordConfirm
  bind:formEmployeeNumber
  bind:formPosition
  bind:formPhone
  bind:formDateOfBirth
  bind:formIsActive
  bind:formTeamIds
  bind:formAvailabilityStatus
  bind:formAvailabilityStart
  bind:formAvailabilityEnd
  bind:formAvailabilityNotes
  bind:emailError
  bind:passwordError
  onclose={closeEmployeeModal}
  onsubmit={handleFormSubmit}
  onvalidateemails={validateEmails}
  onvalidatepasswords={validatePasswords}
/>

<!-- Delete Modals Component -->
<DeleteModals
  {showDeleteModal}
  {showDeleteConfirmModal}
  oncloseDelete={closeDeleteModal}
  oncloseDeleteConfirm={closeDeleteConfirmModal}
  onproceedToConfirm={proceedToDeleteConfirm}
  ondeleteConfirm={deleteEmployee}
/>
