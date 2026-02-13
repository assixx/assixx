<script lang="ts">
  /**
   * Manage Admins - Page Component
   * @module manage-admins/+page
   *
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   */
  import { goto, invalidateAll } from '$app/navigation';

  import {
    showSuccessAlert,
    showWarningAlert,
    showErrorAlert,
  } from '$lib/stores/toast';
  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('ManageAdminsPage');

  import AdminFormModal from './_lib/AdminFormModal.svelte';
  import AdminTableRow from './_lib/AdminTableRow.svelte';
  import {
    saveAdminWithPermissions,
    deleteAdmin as apiDeleteAdmin,
    upgradeToRoot as apiUpgradeToRoot,
    downgradeToEmployee as apiDowngradeToEmployee,
  } from './_lib/api';
  import { MESSAGES, FORM_DEFAULTS } from './_lib/constants';
  import DeleteModals from './_lib/DeleteModals.svelte';
  import { applyAllFilters } from './_lib/filters';
  import SearchResults from './_lib/SearchResults.svelte';
  import { buildAdminFormData, populateFormFromAdmin } from './_lib/utils';

  import type { PageData } from './$types';
  import type {
    Admin,
    Area,
    Department,
    StatusFilter,
    FormIsActiveStatus,
  } from './_lib/types';

  import '../../../../styles/manage-admins.css';
  import '../../../../styles/password-strength.css';

  // =============================================================================
  // SSR DATA - Level 3: $derived from props (single source of truth)
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // SSR data via $derived - updates when invalidateAll() is called
  const allAdmins = $derived<Admin[]>(data.admins);
  const allAreas = $derived<Area[]>(data.areas);
  const allDepartments = $derived<Department[]>(data.departments);

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
  let showDeleteConfirmModal = $state(false);
  let showUpgradeConfirmModal = $state(false);
  let upgradeAdminId = $state<number | null>(null);
  let upgradeLoading = $state(false);
  let showDowngradeConfirmModal = $state(false);
  let downgradeAdminId = $state<number | null>(null);
  let downgradeLoading = $state(false);

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
    isEditMode ? MESSAGES.MODAL_EDIT_TITLE : MESSAGES.MODAL_ADD_TITLE,
  );

  // Derived: Filtered admins based on current filter/search state
  const filteredAdmins = $derived(
    applyAllFilters(allAdmins, currentStatusFilter, currentSearchQuery),
  );

  // =============================================================================
  // VALIDATION HELPERS
  // =============================================================================

  /**
   * Validates admin form fields
   * @returns Error message if invalid, null if valid
   */
  function validateAdminForm(): string | null {
    if (formEmail !== formEmailConfirm) {
      return MESSAGES.ERROR_EMAIL_MISMATCH;
    }

    const passwordMismatch = formPassword !== formPasswordConfirm;
    if (!isEditMode && passwordMismatch) {
      return MESSAGES.ERROR_PASSWORD_MISMATCH;
    }

    if (isEditMode && formPassword && passwordMismatch) {
      return MESSAGES.ERROR_PASSWORD_MISMATCH;
    }

    if (!formPosition) {
      return MESSAGES.ERROR_POSITION_REQUIRED;
    }

    if (!formEmployeeNumber) {
      return MESSAGES.ERROR_EMPLOYEE_NUMBER_REQUIRED;
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

      await saveAdminWithPermissions(formData, currentEditId);

      // Show success message based on mode
      showSuccessAlert(
        isEditMode ? MESSAGES.SUCCESS_UPDATED : MESSAGES.SUCCESS_CREATED,
      );

      closeAdminModal();
      // Level 3: Trigger SSR refetch
      await invalidateAll();
    } catch (err) {
      log.error({ err }, 'Error saving admin');
      showErrorAlert(
        err instanceof Error ? err.message : MESSAGES.ERROR_SAVE_FAILED,
      );
    } finally {
      submitting = false;
    }
  }

  /** Step 1: Inline confirm clicked → open warning modal */
  function upgradeAdmin(): void {
    if (currentEditId === null) return;
    if (!canUpgrade) {
      showWarningAlert(MESSAGES.UPGRADE_UNAUTHORIZED);
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
      showWarningAlert(MESSAGES.UPGRADE_UNAUTHORIZED);
      return;
    }
    const adminId = upgradeAdminId;
    showUpgradeConfirmModal = false;
    upgradeAdminId = null;
    upgradeLoading = true;

    try {
      await apiUpgradeToRoot(adminId);
      await invalidateAll();
      showSuccessAlert(MESSAGES.UPGRADE_SUCCESS);
    } catch (err) {
      log.error({ err }, 'Error upgrading admin to root');
      showErrorAlert(
        err instanceof Error ? err.message : MESSAGES.UPGRADE_ERROR,
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
      showWarningAlert(MESSAGES.UPGRADE_UNAUTHORIZED);
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
      showWarningAlert(MESSAGES.UPGRADE_UNAUTHORIZED);
      return;
    }
    const adminId = downgradeAdminId;
    showDowngradeConfirmModal = false;
    downgradeAdminId = null;
    downgradeLoading = true;

    try {
      await apiDowngradeToEmployee(adminId);
      await invalidateAll();
      showSuccessAlert(MESSAGES.DOWNGRADE_SUCCESS);
    } catch (err) {
      log.error({ err }, 'Error downgrading admin to employee');
      showErrorAlert(
        err instanceof Error ? err.message : MESSAGES.DOWNGRADE_ERROR,
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
    showDeleteConfirmModal = false;
    deleteAdminId = null;

    try {
      await apiDeleteAdmin(adminId);
      showSuccessAlert(MESSAGES.SUCCESS_DELETED);
      // Level 3: Trigger SSR refetch
      await invalidateAll();
    } catch (err) {
      log.error({ err }, 'Error deleting admin');
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
      if (showDowngradeConfirmModal) closeDowngradeConfirmModal();
      else if (showUpgradeConfirmModal) closeUpgradeConfirmModal();
      else if (showDeleteConfirmModal) closeDeleteConfirmModal();
      else if (showDeleteModal) closeDeleteModal();
      else if (showAdminModal) closeAdminModal();
    }
  }
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
      <p class="mt-2 text-(--color-text-secondary)">
        {MESSAGES.PAGE_DESCRIPTION}
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
            {MESSAGES.FILTER_ACTIVE}
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
            {MESSAGES.FILTER_INACTIVE}
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
            {MESSAGES.FILTER_ARCHIVED}
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
            {MESSAGES.FILTER_ALL}
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
          <div
            class="search-input__results"
            id="admin-search-results"
          >
            <SearchResults
              searchQuery={currentSearchQuery}
              {filteredAdmins}
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
            onclick={() => invalidateAll()}>{MESSAGES.BTN_RETRY}</button
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
          <h3 class="empty-state__title">{MESSAGES.EMPTY_TITLE}</h3>
          <p class="empty-state__description">{MESSAGES.EMPTY_DESCRIPTION}</p>
          <button
            type="button"
            class="btn btn-primary"
            onclick={openAddModal}
          >
            <i class="fas fa-plus"></i>
            {MESSAGES.BTN_ADD_ADMIN}
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
                  <AdminTableRow
                    {admin}
                    onedit={openEditModal}
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

<!-- Delete Modals Component -->
<DeleteModals
  {showDeleteModal}
  {showDeleteConfirmModal}
  oncloseDelete={closeDeleteModal}
  oncloseDeleteConfirm={closeDeleteConfirmModal}
  onproceedToConfirm={proceedToDeleteConfirm}
  onconfirmDelete={deleteAdmin}
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
          onclick={closeUpgradeConfirmModal}>{MESSAGES.BTN_CANCEL}</button
        >
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--warning"
          disabled={upgradeLoading}
          onclick={() => void confirmUpgradeAdmin()}
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

<!-- Downgrade Confirm Modal (confirm-modal--warning) -->
{#if showDowngradeConfirmModal}
  <div
    id="downgrade-confirm-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="downgrade-confirm-title"
    tabindex="-1"
    onclick={(e) => {
      if (e.target === e.currentTarget) closeDowngradeConfirmModal();
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape') closeDowngradeConfirmModal();
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
        <i class="fas fa-arrow-down"></i>
      </div>
      <h3
        class="confirm-modal__title"
        id="downgrade-confirm-title"
      >
        {MESSAGES.UPGRADE_TITLE}
      </h3>
      <p class="confirm-modal__message">
        <strong>{MESSAGES.DOWNGRADE_CONFIRM_MESSAGE}</strong>
      </p>
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel"
          disabled={downgradeLoading}
          onclick={closeDowngradeConfirmModal}>{MESSAGES.BTN_CANCEL}</button
        >
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--warning"
          disabled={downgradeLoading}
          onclick={() => void confirmDowngradeAdmin()}
        >
          {#if downgradeLoading}
            <i class="fas fa-spinner fa-spin mr-2"></i>
          {/if}
          {MESSAGES.DOWNGRADE_CONFIRM_BUTTON}
        </button>
      </div>
    </div>
  </div>
{/if}
