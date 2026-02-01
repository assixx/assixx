<script lang="ts">
  /**
   * Manage Employees - Page Component
   * @module manage-employees/+page
   *
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   */
  import { goto, invalidateAll } from '$app/navigation';

  import {
    showSuccessAlert,
    showErrorAlert,
    showWarningAlert,
  } from '$lib/utils';
  import { ApiError } from '$lib/utils/api-client';
  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('ManageEmployeesPage');

  // Page-specific CSS
  import '../../../../styles/manage-employees.css';
  import '../../../../styles/password-strength.css';

  // Local modules
  import {
    saveEmployee as apiSaveEmployee,
    deleteEmployee as apiDeleteEmployee,
    updateEmployeeAvailability as apiUpdateAvailability,
    upgradeToAdmin as apiUpgradeToAdmin,
    syncTeamMemberships,
    buildEmployeePayload,
  } from './_lib/api';
  import AvailabilityModal from './_lib/AvailabilityModal.svelte';
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
    validateAvailabilityForm,
    buildAvailabilityPayload,
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

  // Permission: Only root or admin with has_full_access may upgrade roles
  const canUpgrade = $derived(
    data.user !== null &&
      (data.user.role === 'root' ||
        (data.user.role === 'admin' && data.user.hasFullAccess)),
  );

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
  let showAvailabilityModal = $state(false);
  let showUpgradeConfirmModal = $state(false);
  let upgradeEmployeeId = $state<number | null>(null);
  let upgradeLoading = $state(false);

  // Availability Modal State
  let availabilityEmployeeId = $state<number | null>(null);
  let availabilityStatus = $state<AvailabilityStatus>('available');
  let availabilityStart = $state('');
  let availabilityEnd = $state('');
  let availabilityReason = $state('');
  let availabilityNotes = $state('');
  let availabilitySubmitting = $state(false);

  // Edit State
  let currentEditId = $state<number | null>(null);
  let deleteEmployeeId = $state<number | null>(null);
  let originalTeamIds = $state<number[]>([]);

  // Form Fields (for EmployeeFormModal)
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

  // Validation State
  let emailError = $state(false);
  let passwordError = $state(false);
  let submitting = $state(false);

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const isEditMode = $derived(currentEditId !== null);
  const modalTitle = $derived(
    isEditMode ? MESSAGES.MODAL_TITLE_EDIT : MESSAGES.MODAL_TITLE_ADD,
  );

  // Derived: Filtered employees based on current filter/search state
  const filteredEmployees = $derived(
    applyAllFilters(allEmployees, currentStatusFilter, currentSearchQuery),
  );

  // Derived: Current employee for availability modal
  const availabilityEmployee = $derived(
    availabilityEmployeeId !== null ?
      (allEmployees.find((e) => e.id === availabilityEmployeeId) ?? null)
    : null,
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
        },
        isEditMode,
      );

      const userId = await apiSaveEmployee(payload, currentEditId);
      await syncTeamMemberships(
        userId,
        formTeamIds,
        originalTeamIds,
        isEditMode,
      );

      closeEmployeeModal();
      // Level 3: Trigger SSR refetch
      await invalidateAll();
      showSuccessAlert(
        isEditMode ? 'Mitarbeiter aktualisiert' : 'Mitarbeiter erstellt',
      );
    } catch (err) {
      log.error({ err }, 'Error saving employee');
      showErrorAlert(
        err instanceof Error ? err.message : MESSAGES.ERROR_SAVING,
      );
    } finally {
      submitting = false;
    }
  }

  /** Step 1: Inline confirm clicked → open warning modal */
  function upgradeEmployee(): void {
    if (currentEditId === null) return;
    if (!canUpgrade) {
      showWarningAlert(MESSAGES.UPGRADE_UNAUTHORIZED);
      return;
    }
    upgradeEmployeeId = currentEditId;
    closeEmployeeModal();
    showUpgradeConfirmModal = true;
  }

  /** Step 2: Warning modal confirmed → PUT role change */
  async function confirmUpgradeEmployee(): Promise<void> {
    if (upgradeEmployeeId === null) return;
    if (!canUpgrade) {
      showWarningAlert(MESSAGES.UPGRADE_UNAUTHORIZED);
      return;
    }
    const userId = upgradeEmployeeId;
    upgradeLoading = true;

    try {
      showUpgradeConfirmModal = false;
      upgradeEmployeeId = null;
      await apiUpgradeToAdmin(userId);
      await invalidateAll();
      showSuccessAlert(MESSAGES.UPGRADE_SUCCESS);
    } catch (err) {
      log.error({ err }, 'Error upgrading employee to admin');
      showErrorAlert(
        err instanceof Error ? err.message : MESSAGES.UPGRADE_ERROR,
      );
    } finally {
      upgradeLoading = false;
    }
  }

  function closeUpgradeConfirmModal(): void {
    showUpgradeConfirmModal = false;
    upgradeEmployeeId = null;
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
      log.error({ err }, 'Error deleting employee');
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

  // Availability Modal Handlers
  // NOTE: Modal is CREATE-only. PUT/UPDATE is on history page.
  function openAvailabilityModal(employeeId: number): void {
    const employee = allEmployees.find((e) => e.id === employeeId);
    if (!employee) return;

    availabilityEmployeeId = employeeId;
    // Reset to defaults - this modal is for CREATE only
    availabilityStatus = 'available';
    availabilityStart = '';
    availabilityEnd = '';
    availabilityReason = '';
    availabilityNotes = '';
    showAvailabilityModal = true;
  }

  function closeAvailabilityModal(): void {
    showAvailabilityModal = false;
    availabilityEmployeeId = null;
    availabilityStatus = 'available';
    availabilityStart = '';
    availabilityEnd = '';
    availabilityReason = '';
    availabilityNotes = '';
  }

  async function saveAvailability(): Promise<void> {
    if (availabilityEmployeeId === null) return;

    const formData = {
      status: availabilityStatus,
      start: availabilityStart,
      end: availabilityEnd,
      reason: availabilityReason,
      notes: availabilityNotes,
    };

    const validationError = validateAvailabilityForm(formData);
    if (validationError === 'dates_required') {
      showErrorAlert('Von-Datum und Bis-Datum sind erforderlich.');
      return;
    }
    if (validationError === 'end_before_start') {
      showErrorAlert('Bis-Datum muss nach oder gleich Von-Datum sein.');
      return;
    }

    availabilitySubmitting = true;
    try {
      const payload = buildAvailabilityPayload(formData);
      await apiUpdateAvailability(availabilityEmployeeId, payload);
      closeAvailabilityModal();
      await invalidateAll();
      showSuccessAlert('Verfügbarkeit aktualisiert');
    } catch (err) {
      log.error({ err }, 'Error updating availability');
      const message =
        err instanceof ApiError ?
          err.message
        : 'Fehler beim Speichern der Verfügbarkeit';
      showErrorAlert(message);
    } finally {
      availabilitySubmitting = false;
    }
  }

  function navigateToAvailabilityPage(uuid: string): void {
    // Navigate to the full availability history page
    closeAvailabilityModal();
    void goto(`/manage-employees/availability/${uuid}`);
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
      if (showUpgradeConfirmModal) closeUpgradeConfirmModal();
      else if (showDeleteConfirmModal) closeDeleteConfirmModal();
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
      <p class="mt-2 text-[var(--color-text-secondary)]">
        Mitarbeiter erstellen und verwalten
      </p>

      <div class="mt-6 flex items-center justify-between gap-4">
        <!-- Status Toggle Group -->
        <div
          class="toggle-group"
          id="employee-status-toggle"
        >
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
        <div
          class="search-input-wrapper max-w-80"
          class:search-input-wrapper--open={searchOpen}
        >
          <div
            class="search-input"
            id="employee-search-container"
          >
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
        <div class="p-6 text-center">
          <i
            class="fas fa-exclamation-triangle mb-4 text-4xl text-[var(--color-danger)]"
          ></i>
          <p class="text-[var(--color-text-secondary)]">{error}</p>
          <button
            type="button"
            class="btn btn-primary mt-4"
            onclick={() => invalidateAll()}
          >
            Erneut versuchen
          </button>
        </div>
      {:else if filteredEmployees.length === 0}
        <div
          id="employees-empty"
          class="empty-state"
        >
          <div class="empty-state__icon">
            <i class="fas fa-users"></i>
          </div>
          <h3 class="empty-state__title">{MESSAGES.NO_EMPLOYEES_FOUND}</h3>
          <p class="empty-state__description">
            {MESSAGES.CREATE_FIRST_EMPLOYEE}
          </p>
          <button
            type="button"
            class="btn btn-primary"
            onclick={openAddModal}
          >
            <i class="fas fa-plus"></i>
            Mitarbeiter hinzufügen
          </button>
        </div>
      {:else}
        <div id="employees-table-content">
          <div class="table-responsive">
            <table
              class="data-table data-table--hover data-table--striped"
              id="employees-table"
            >
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
                  <EmployeeTableRow
                    {employee}
                    onedit={openEditModal}
                    onavailability={openAvailabilityModal}
                    ondelete={openDeleteModal}
                  />
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
  bind:emailError
  bind:passwordError
  onclose={closeEmployeeModal}
  onsubmit={handleFormSubmit}
  onvalidateemails={validateEmails}
  onvalidatepasswords={validatePasswords}
  onupgrade={canUpgrade ? upgradeEmployee : undefined}
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

<!-- Availability Modal Component -->
<AvailabilityModal
  show={showAvailabilityModal}
  employee={availabilityEmployee}
  submitting={availabilitySubmitting}
  bind:availabilityStatus
  bind:availabilityStart
  bind:availabilityEnd
  bind:availabilityReason
  bind:availabilityNotes
  onclose={closeAvailabilityModal}
  onsave={saveAvailability}
  onmanage={navigateToAvailabilityPage}
/>

<!-- Upgrade Confirm Modal (confirm-modal--warning) -->
{#if showUpgradeConfirmModal}
  <div
    id="upgrade-confirm-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="upgrade-confirm-title"
    tabindex="-1"
    onclick={(e) => {
      if (e.target === e.currentTarget) closeUpgradeConfirmModal();
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape') closeUpgradeConfirmModal();
    }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="confirm-modal confirm-modal--warning"
      onclick={(e) => {
        e.stopPropagation();
      }}
    >
      <div class="confirm-modal__icon">
        <i class="fas fa-arrow-up"></i>
      </div>
      <h3
        class="confirm-modal__title"
        id="upgrade-confirm-title"
      >
        {MESSAGES.UPGRADE_TITLE}
      </h3>
      <p class="confirm-modal__message">
        <strong>{MESSAGES.UPGRADE_CONFIRM_MESSAGE}</strong>
      </p>
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel"
          disabled={upgradeLoading}
          onclick={closeUpgradeConfirmModal}>Abbrechen</button
        >
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--warning"
          disabled={upgradeLoading}
          onclick={() => void confirmUpgradeEmployee()}
        >
          {#if upgradeLoading}
            <i class="fas fa-spinner fa-spin mr-2"></i>
          {/if}
          {MESSAGES.UPGRADE_CONFIRM_BUTTON}
        </button>
      </div>
    </div>
  </div>
{/if}
