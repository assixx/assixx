<script lang="ts">
  /**
   * Manage Admins - Page Component
   * @module manage-admins/+page
   *
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   */
  import { goto, invalidateAll } from '$app/navigation';

  import AvailabilityModal from '$lib/availability/AvailabilityModal.svelte';
  import {
    showSuccessAlert,
    showWarningAlert,
    showErrorAlert,
    showToast,
  } from '$lib/stores/toast';
  import { ApiError } from '$lib/utils/api-client';
  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('ManageAdminsPage');

  import AdminFormModal from './_lib/AdminFormModal.svelte';
  import AdminTableRow from './_lib/AdminTableRow.svelte';
  import {
    saveAdminWithPermissions,
    deleteAdmin as apiDeleteAdmin,
    upgradeToRoot as apiUpgradeToRoot,
    downgradeToEmployee as apiDowngradeToEmployee,
    updateAdminAvailability as apiUpdateAvailability,
  } from './_lib/api';
  import { createMessages, FORM_DEFAULTS } from './_lib/constants';
  import DeleteModals from './_lib/DeleteModals.svelte';
  import { applyAllFilters } from './_lib/filters';
  import RoleChangeModals from './_lib/RoleChangeModals.svelte';
  import SearchResults from './_lib/SearchResults.svelte';
  import {
    buildAdminFormData,
    populateFormFromAdmin,
    validateAvailabilityForm,
    buildAvailabilityPayload,
  } from './_lib/utils';

  import type { PageData } from './$types';
  import type {
    Admin,
    Area,
    Department,
    StatusFilter,
    FormIsActiveStatus,
    AvailabilityStatus,
  } from './_lib/types';

  // =============================================================================
  // SSR DATA - Level 3: $derived from props (single source of truth)
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // SSR data via $derived - updates when invalidateAll() is called
  const allAdmins = $derived<Admin[]>(data.admins);
  const allAreas = $derived<Area[]>(data.areas);
  const allDepartments = $derived<Department[]>(data.departments);
  const positionOptions = $derived<string[]>(data.positionOptions);

  // Hierarchy labels from layout data inheritance (A6)
  const labels = $derived(data.hierarchyLabels);
  const messages = $derived(createMessages(labels));

  // Permission: Only root may upgrade admin → root
  const canUpgrade = $derived(data.user !== null && data.user.role === 'root');

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
  let showAdminModal = $state(false);
  let showDeleteModal = $state(false);
  let showUpgradeConfirmModal = $state(false);
  let upgradeAdminId = $state<number | null>(null);
  let upgradeLoading = $state(false);
  let showDowngradeConfirmModal = $state(false);
  let downgradeAdminId = $state<number | null>(null);
  let downgradeLoading = $state(false);
  let showAvailabilityModal = $state(false);

  // Availability Modal State
  let availabilityAdminId = $state<number | null>(null);
  let availabilityStatus = $state<AvailabilityStatus>('available');
  let availabilityStart = $state('');
  let availabilityEnd = $state('');
  let availabilityReason = $state('');
  let availabilityNotes = $state('');
  let availabilitySubmitting = $state(false);

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

  // Form Submit Loading
  let submitting = $state(false);

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const isEditMode = $derived(currentEditId !== null);
  const modalTitle = $derived(
    isEditMode ? messages.MODAL_EDIT_TITLE : messages.MODAL_ADD_TITLE,
  );

  // Derived: Filtered admins based on current filter/search state
  const filteredAdmins = $derived(
    applyAllFilters(allAdmins, currentStatusFilter, currentSearchQuery),
  );

  // Derived: Current admin for availability modal
  const availabilityAdmin = $derived(
    availabilityAdminId !== null ?
      (allAdmins.find((a) => a.id === availabilityAdminId) ?? null)
    : null,
  );

  // =============================================================================
  // VALIDATION HELPERS
  // =============================================================================

  /** Check password fields: required for new, optional for edit (both-or-none + must match) */
  function hasPasswordError(): boolean {
    if (!isEditMode) {
      return (
        formPassword === '' ||
        formPasswordConfirm === '' ||
        formPassword !== formPasswordConfirm
      );
    }
    // Edit mode: if either field is filled, both must be filled and match
    const eitherFilled = formPassword !== '' || formPasswordConfirm !== '';
    return eitherFilled && formPassword !== formPasswordConfirm;
  }

  /** Validates admin form fields */
  function validateAdminForm(): string | null {
    if (formEmail !== formEmailConfirm) {
      return messages.ERROR_EMAIL_MISMATCH;
    }

    if (hasPasswordError()) {
      return messages.ERROR_PASSWORD_MISMATCH;
    }

    if (!formPosition) {
      return messages.ERROR_POSITION_REQUIRED;
    }

    if (!formEmployeeNumber) {
      return messages.ERROR_EMPLOYEE_NUMBER_REQUIRED;
    }

    return null;
  }

  // =============================================================================
  // API FUNCTIONS - Level 3: invalidateAll() after mutations
  // =============================================================================

  async function saveAdmin() {
    submitting = true;

    try {
      const validationError = validateAdminForm();
      if (validationError !== null) {
        showWarningAlert(validationError);
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

      const result = await saveAdminWithPermissions(formData, currentEditId);

      closeAdminModal();
      await invalidateAll();

      if (!isEditMode && result.uuid !== null) {
        showToast({
          type: 'success',
          title: 'Admin erstellt',
          message: 'Berechtigungen jetzt zuweisen?',
          duration: 8000,
          action: {
            label: 'Berechtigungen',
            href: `/manage-admins/permission/${result.uuid}`,
          },
        });
      } else {
        showSuccessAlert(
          isEditMode ? messages.SUCCESS_UPDATED : messages.SUCCESS_CREATED,
        );
      }
    } catch (err: unknown) {
      log.error({ err }, 'Error saving admin');
      showErrorAlert(
        err instanceof Error ? err.message : messages.ERROR_SAVE_FAILED,
      );
    } finally {
      submitting = false;
    }
  }

  /** Step 1: Inline confirm clicked → open warning modal */
  function upgradeAdmin(): void {
    if (currentEditId === null) return;
    if (!canUpgrade) {
      showWarningAlert(messages.UPGRADE_UNAUTHORIZED);
      return;
    }
    upgradeAdminId = currentEditId;
    closeAdminModal();
    showUpgradeConfirmModal = true;
  }

  /** Step 2: Warning modal confirmed → PUT role change */
  async function confirmUpgradeAdmin(): Promise<void> {
    if (upgradeAdminId === null) return;
    if (!canUpgrade) {
      showWarningAlert(messages.UPGRADE_UNAUTHORIZED);
      return;
    }
    const adminId = upgradeAdminId;
    showUpgradeConfirmModal = false;
    upgradeAdminId = null;
    upgradeLoading = true;

    try {
      await apiUpgradeToRoot(adminId);
      await invalidateAll();
      showSuccessAlert(messages.UPGRADE_SUCCESS);
    } catch (err: unknown) {
      log.error({ err }, 'Error upgrading admin to root');
      showErrorAlert(
        err instanceof Error ? err.message : messages.UPGRADE_ERROR,
      );
    } finally {
      upgradeLoading = false;
    }
  }

  function closeUpgradeConfirmModal(): void {
    showUpgradeConfirmModal = false;
    upgradeAdminId = null;
  }

  /** Step 1: Inline downgrade confirm clicked → open warning modal */
  function downgradeAdmin(): void {
    if (currentEditId === null) return;
    if (!canUpgrade) {
      showWarningAlert(messages.UPGRADE_UNAUTHORIZED);
      return;
    }
    downgradeAdminId = currentEditId;
    closeAdminModal();
    showDowngradeConfirmModal = true;
  }

  /** Step 2: Warning modal confirmed → PUT role change to employee */
  async function confirmDowngradeAdmin(): Promise<void> {
    if (downgradeAdminId === null) return;
    if (!canUpgrade) {
      showWarningAlert(messages.UPGRADE_UNAUTHORIZED);
      return;
    }
    const adminId = downgradeAdminId;
    showDowngradeConfirmModal = false;
    downgradeAdminId = null;
    downgradeLoading = true;

    try {
      await apiDowngradeToEmployee(adminId);
      await invalidateAll();
      showSuccessAlert(messages.DOWNGRADE_SUCCESS);
    } catch (err: unknown) {
      log.error({ err }, 'Error downgrading admin to employee');
      showErrorAlert(
        err instanceof Error ? err.message : messages.DOWNGRADE_ERROR,
      );
    } finally {
      downgradeLoading = false;
    }
  }

  function closeDowngradeConfirmModal(): void {
    showDowngradeConfirmModal = false;
    downgradeAdminId = null;
  }

  async function deleteAdmin() {
    const adminId = deleteAdminId;
    if (adminId === null) return;

    // Reset state before async operations to avoid race conditions
    showDeleteModal = false;
    deleteAdminId = null;

    try {
      await apiDeleteAdmin(adminId);
      showSuccessAlert(messages.SUCCESS_DELETED);
      // Level 3: Trigger SSR refetch
      await invalidateAll();
    } catch (err: unknown) {
      log.error({ err }, 'Error deleting admin');
      showErrorAlert(messages.ERROR_DELETE_FAILED);
    }
  }

  // =============================================================================
  // AVAILABILITY MODAL HANDLERS
  // NOTE: Modal is CREATE-only. PUT/UPDATE is on history page.
  // =============================================================================

  function openAvailabilityModal(adminId: number): void {
    const admin = allAdmins.find((a) => a.id === adminId);
    if (!admin) return;

    availabilityAdminId = adminId;
    availabilityStatus = 'available';
    availabilityStart = '';
    availabilityEnd = '';
    availabilityReason = '';
    availabilityNotes = '';
    showAvailabilityModal = true;
  }

  function closeAvailabilityModal(): void {
    showAvailabilityModal = false;
    availabilityAdminId = null;
    availabilityStatus = 'available';
    availabilityStart = '';
    availabilityEnd = '';
    availabilityReason = '';
    availabilityNotes = '';
  }

  async function saveAvailability(): Promise<void> {
    if (availabilityAdminId === null) return;

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
      await apiUpdateAvailability(availabilityAdminId, payload);
      closeAvailabilityModal();
      await invalidateAll();
      showSuccessAlert('Verfügbarkeit aktualisiert');
    } catch (err: unknown) {
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
    closeAvailabilityModal();
    void goto(`/manage-admins/availability/${uuid}`);
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
    showAdminModal = true;
  }

  function openDeleteModal(adminId: number) {
    deleteAdminId = adminId;
    showDeleteModal = true;
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
  }

  // =============================================================================
  // STATUS TOGGLE HANDLER
  // =============================================================================

  function navigateToPermissionPage(uuid: string): void {
    void goto(`/manage-admins/permission/${uuid}`);
  }

  function handleStatusToggle(status: StatusFilter) {
    currentStatusFilter = status;
    // filteredAdmins is $derived - automatically updates when filter changes
  }

  // =============================================================================
  // SEARCH HANDLERS
  // =============================================================================

  function handleSearchInput(e: Event) {
    const input = e.target as HTMLInputElement;
    currentSearchQuery = input.value;
    searchOpen = currentSearchQuery.trim().length > 0;
    // filteredAdmins is $derived - automatically updates when search changes
  }

  function clearSearch() {
    currentSearchQuery = '';
    searchOpen = false;
    // filteredAdmins is $derived - automatically updates
  }

  function handleSearchResultClick(adminId: number) {
    openEditModal(adminId);
    searchOpen = false;
    currentSearchQuery = '';
  }

  // =============================================================================
  // FORM SUBMIT HANDLER
  // =============================================================================

  function handleFormSubmit(e: Event) {
    e.preventDefault();
    void saveAdmin();
  }

  // =============================================================================
  // OUTSIDE CLICK FOR SEARCH
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

  // =============================================================================
  // ESCAPE KEY HANDLER
  // =============================================================================

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (showAvailabilityModal) closeAvailabilityModal();
      else if (showDowngradeConfirmModal) closeDowngradeConfirmModal();
      else if (showUpgradeConfirmModal) closeUpgradeConfirmModal();
      else if (showDeleteModal) closeDeleteModal();
      else if (showAdminModal) closeAdminModal();
    }
  }
</script>

<svelte:head>
  <title>{messages.PAGE_TITLE}</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="container">
  <div class="card">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-users mr-2"></i>
        {messages.PAGE_HEADING}
      </h2>
      <p class="mt-2 text-(--color-text-secondary)">
        {messages.PAGE_DESCRIPTION}
      </p>

      <div class="mt-6 flex items-center justify-between gap-4">
        <!-- Status Toggle Group -->
        <div
          class="toggle-group"
          id="admin-status-toggle"
        >
          <button
            type="button"
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'active'}
            title="Aktive Administratoren"
            onclick={() => {
              handleStatusToggle('active');
            }}
          >
            <i class="fas fa-user-check"></i>
            {messages.FILTER_ACTIVE}
          </button>
          <button
            type="button"
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'inactive'}
            title="Inaktive Administratoren"
            onclick={() => {
              handleStatusToggle('inactive');
            }}
          >
            <i class="fas fa-user-times"></i>
            {messages.FILTER_INACTIVE}
          </button>
          <button
            type="button"
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'archived'}
            title="Archivierte Administratoren"
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
            title="Alle Administratoren"
            onclick={() => {
              handleStatusToggle('all');
            }}
          >
            <i class="fas fa-users"></i>
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
            id="admin-search-container"
          >
            <i class="search-input__icon fas fa-search"></i>
            <input
              type="search"
              id="admin-search"
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
            id="admin-search-results"
          >
            <SearchResults
              searchQuery={currentSearchQuery}
              {filteredAdmins}
              {labels}
              onresultClick={handleSearchResultClick}
            />
          </div>
        </div>
      </div>
    </div>

    <div class="card__body">
      {#if error}
        <div class="p-6 text-center">
          <i
            class="fas fa-exclamation-triangle mb-4 text-4xl text-(--color-danger)"
          ></i>
          <p class="text-(--color-text-secondary)">{error}</p>
          <button
            type="button"
            class="btn btn-primary mt-4"
            onclick={() => invalidateAll()}>{messages.BTN_RETRY}</button
          >
        </div>
      {:else if filteredAdmins.length === 0}
        <div
          id="admins-empty"
          class="empty-state"
        >
          <div class="empty-state__icon">
            <i class="fas fa-users"></i>
          </div>
          <h3 class="empty-state__title">{messages.EMPTY_TITLE}</h3>
          <p class="empty-state__description">{messages.EMPTY_DESCRIPTION}</p>
          <button
            type="button"
            class="btn btn-primary"
            onclick={openAddModal}
          >
            <i class="fas fa-plus"></i>
            {messages.BTN_ADD_ADMIN}
          </button>
        </div>
      {:else}
        <div id="admins-table-content">
          <div class="table-responsive">
            <table
              class="data-table data-table--hover data-table--striped"
              id="admins-table"
            >
              <thead>
                <tr>
                  <th scope="col">{messages.TH_ID}</th>
                  <th scope="col">{messages.TH_NAME}</th>
                  <th scope="col">{messages.TH_EMAIL}</th>
                  <th scope="col">{messages.TH_EMPLOYEE_NUMBER}</th>
                  <th scope="col">{messages.TH_POSITION}</th>
                  <th scope="col">{messages.TH_STATUS}</th>
                  <th scope="col">{messages.TH_AREAS}</th>
                  <th scope="col">{messages.TH_DEPARTMENTS}</th>
                  <th scope="col">{messages.TH_TEAMS}</th>
                  <th scope="col">{messages.TH_AVAILABILITY}</th>
                  <th scope="col">{messages.TH_PLANNED}</th>
                  <th scope="col">{messages.TH_NOTES}</th>
                  <th scope="col">{messages.TH_ACTIONS}</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredAdmins as admin (admin.id)}
                  <AdminTableRow
                    {admin}
                    {labels}
                    onedit={openEditModal}
                    onavailability={openAvailabilityModal}
                    onpermission={navigateToPermissionPage}
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
  class="btn-float"
  onclick={openAddModal}
  aria-label="Administrator hinzufügen"
>
  <i class="fas fa-user-plus"></i>
</button>

<!-- Add/Edit Admin Modal Component -->
<AdminFormModal
  show={showAdminModal}
  {isEditMode}
  {modalTitle}
  {allAreas}
  {allDepartments}
  {submitting}
  {messages}
  {positionOptions}
  {labels}
  bind:formFirstName
  bind:formLastName
  bind:formEmail
  bind:formEmailConfirm
  bind:formPassword
  bind:formPasswordConfirm
  bind:formEmployeeNumber
  bind:formPosition
  bind:formNotes
  bind:formIsActive
  bind:formHasFullAccess
  bind:formAreaIds
  bind:formDepartmentIds
  onclose={closeAdminModal}
  onsubmit={handleFormSubmit}
  onupgrade={canUpgrade ? upgradeAdmin : undefined}
  ondowngrade={canUpgrade ? downgradeAdmin : undefined}
/>

<!-- Availability Modal Component -->
<AvailabilityModal
  show={showAvailabilityModal}
  person={availabilityAdmin}
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

<!-- Delete Modals Component -->
<DeleteModals
  show={showDeleteModal}
  oncancel={closeDeleteModal}
  onconfirm={deleteAdmin}
/>

<!-- Role Change Confirm Modals (Upgrade/Downgrade) -->
<RoleChangeModals
  showUpgradeModal={showUpgradeConfirmModal}
  showDowngradeModal={showDowngradeConfirmModal}
  {upgradeLoading}
  {downgradeLoading}
  oncloseUpgrade={closeUpgradeConfirmModal}
  oncloseDowngrade={closeDowngradeConfirmModal}
  onconfirmUpgrade={() => void confirmUpgradeAdmin()}
  onconfirmDowngrade={() => void confirmDowngradeAdmin()}
/>
