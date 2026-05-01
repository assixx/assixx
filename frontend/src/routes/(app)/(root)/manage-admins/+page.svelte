<script lang="ts">
  /**
   * Manage Admins - Page Component
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   */
  import { goto, invalidateAll } from '$app/navigation';

  import AvailabilityModal from '$lib/availability/AvailabilityModal.svelte';
  import { showSuccessAlert, showWarningAlert, showErrorAlert, showToast } from '$lib/stores/toast';
  import { getApiClient } from '$lib/utils/api-client';
  import { createLogger } from '$lib/utils/logger';

  const apiClient = getApiClient();

  async function loadUserPositions(userId: number): Promise<void> {
    try {
      const positions = await apiClient.request<{ positionId: string }[]>(
        `/users/${String(userId)}/positions`,
      );
      formPositionIds = positions.map((p: { positionId: string }) => p.positionId);
    } catch {
      formPositionIds = [];
    }
  }

  import AdminFormModal from './_lib/AdminFormModal.svelte';
  import AdminTableRow from './_lib/AdminTableRow.svelte';
  import { createMessages, FORM_DEFAULTS } from './_lib/constants';
  import DeleteModals from './_lib/DeleteModals.svelte';
  import { applyAllFilters } from './_lib/filters';
  import {
    executeFullAdminSave,
    executeFullAvailabilitySave,
    executeUpgradeToRoot,
    executeDowngradeToEmployee,
    executeDeleteAdmin,
  } from './_lib/page-actions';
  import RoleChangeModals from './_lib/RoleChangeModals.svelte';
  import SearchResults from './_lib/SearchResults.svelte';
  import { ADMINS_PER_PAGE, getVisiblePages, populateFormFromAdmin } from './_lib/utils';

  import type { PageData } from './$types';
  import type { StatusFilter, FormIsActiveStatus, AvailabilityStatus } from './_lib/types';

  const log = createLogger('ManageAdminsPage');

  // --- SSR DATA ---
  const { data }: { data: PageData } = $props();
  const allAdmins = $derived(data.admins);
  const allAreas = $derived(data.areas);
  const allDepartments = $derived(data.departments);
  const positionOptions = $derived(data.positionOptions);
  const labels = $derived(data.hierarchyLabels);
  const messages = $derived(createMessages(labels));
  const canUpgrade = $derived(data.user !== null && data.user.role === 'root');

  // --- UI STATE ---
  const error = $state<string | null>(null);
  let currentStatusFilter = $state<StatusFilter>('active');
  let currentSearchQuery = $state('');
  let currentPage = $state(1);
  let searchOpen = $state(false);
  let showAdminModal = $state(false);
  let showDeleteModal = $state(false);
  let showUpgradeConfirmModal = $state(false);
  let upgradeAdminId = $state<number | null>(null);
  let upgradeLoading = $state(false);
  let showDowngradeConfirmModal = $state(false);
  let downgradeAdminId = $state<number | null>(null);
  let downgradeLoading = $state(false);
  let showAvailabilityModal = $state(false);
  let availabilityAdminId = $state<number | null>(null);
  let availabilityStatus = $state<AvailabilityStatus>('available');
  let availabilityStart = $state('');
  let availabilityEnd = $state('');
  let availabilityReason = $state('');
  let availabilityNotes = $state('');
  let availabilitySubmitting = $state(false);
  let currentEditId = $state<number | null>(null);
  let deleteAdminId = $state<number | null>(null);
  let formFirstName = $state('');
  let formLastName = $state('');
  let formEmail = $state('');
  let formEmailConfirm = $state('');
  let formPassword = $state('');
  let formPasswordConfirm = $state('');
  let formEmployeeNumber = $state('');
  let formPositionIds = $state<string[]>([]);
  let formNotes = $state('');
  let formIsActive = $state<FormIsActiveStatus>(1);
  let formHasFullAccess = $state(false);
  let formAreaIds = $state<number[]>([]);
  let formDepartmentIds = $state<number[]>([]);
  let submitting = $state(false);

  // --- DERIVED ---
  const isEditMode = $derived(currentEditId !== null);
  const modalTitle = $derived(isEditMode ? messages.MODAL_EDIT_TITLE : messages.MODAL_ADD_TITLE);
  const filteredAdmins = $derived(
    applyAllFilters(allAdmins, currentStatusFilter, currentSearchQuery),
  );

  // Pagination — slice filtered set into the current page (KISS, mirrors
  // manage-employees). SearchResults still receives `filteredAdmins` (full
  // set) so users can jump to a hit on any page.
  const totalPages = $derived(Math.max(1, Math.ceil(filteredAdmins.length / ADMINS_PER_PAGE)));
  const paginatedAdmins = $derived(
    filteredAdmins.slice((currentPage - 1) * ADMINS_PER_PAGE, currentPage * ADMINS_PER_PAGE),
  );
  const visiblePages = $derived(getVisiblePages(currentPage, totalPages));

  // Reset to page 1 when filter set changes — prevents user landing on
  // an empty page after narrowing search/status. Mount-fire is a no-op.
  $effect(() => {
    void currentStatusFilter;
    void currentSearchQuery;
    currentPage = 1;
  });

  // Client-side pagination handlers (no URL update — KISS, see utils.ts)
  function goToPage(p: number): void {
    if (p >= 1 && p <= totalPages) currentPage = p;
  }
  function handlePreviousPage(): void {
    if (currentPage > 1) currentPage -= 1;
  }
  function handleNextPage(): void {
    if (currentPage < totalPages) currentPage += 1;
  }

  const availabilityAdmin = $derived(
    availabilityAdminId !== null ?
      (allAdmins.find((a) => a.id === availabilityAdminId) ?? null)
    : null,
  );

  // --- FORM HELPERS ---
  function applyFormState(s: typeof FORM_DEFAULTS): void {
    formFirstName = s.firstName;
    formLastName = s.lastName;
    formEmail = s.email;
    formEmailConfirm = s.emailConfirm;
    formPassword = s.password;
    formPasswordConfirm = s.passwordConfirm;
    formEmployeeNumber = s.employeeNumber;
    formPositionIds = [];
    formNotes = s.notes;
    formIsActive = s.isActive;
    formHasFullAccess = s.hasFullAccess;
    formAreaIds = [...s.areaIds];
    formDepartmentIds = [...s.departmentIds];
  }

  // --- API HANDLERS ---
  async function saveAdmin(): Promise<void> {
    submitting = true;
    const result = await executeFullAdminSave(
      {
        firstName: formFirstName,
        lastName: formLastName,
        email: formEmail,
        emailConfirm: formEmailConfirm,
        password: formPassword,
        passwordConfirm: formPasswordConfirm,
        employeeNumber: formEmployeeNumber,
        positionIds: formPositionIds,
        notes: formNotes,
        isActive: formIsActive,
        hasFullAccess: formHasFullAccess,
        areaIds: formAreaIds,
        departmentIds: formDepartmentIds,
      },
      currentEditId,
      isEditMode,
      log,
      messages,
    );
    if (result.validationError !== undefined) {
      showWarningAlert(result.validationError);
      submitting = false;
      return;
    }
    if (result.success) {
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
        showSuccessAlert(isEditMode ? messages.SUCCESS_UPDATED : messages.SUCCESS_CREATED);
      }
    } else {
      showErrorAlert(result.errorMessage ?? messages.ERROR_SAVE_FAILED);
    }
    submitting = false;
  }

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
    const result = await executeUpgradeToRoot(adminId, log);
    if (result.success) {
      await invalidateAll();
      showSuccessAlert(messages.UPGRADE_SUCCESS);
    } else {
      showErrorAlert(result.errorMessage ?? messages.UPGRADE_ERROR);
    }
    upgradeLoading = false;
  }

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
    const result = await executeDowngradeToEmployee(adminId, log);
    if (result.success) {
      await invalidateAll();
      showSuccessAlert(messages.DOWNGRADE_SUCCESS);
    } else {
      showErrorAlert(result.errorMessage ?? messages.DOWNGRADE_ERROR);
    }
    downgradeLoading = false;
  }

  async function deleteAdmin(): Promise<void> {
    const adminId = deleteAdminId;
    if (adminId === null) return;
    showDeleteModal = false;
    deleteAdminId = null;
    const result = await executeDeleteAdmin(adminId, log);
    if (result.success) {
      showSuccessAlert(messages.SUCCESS_DELETED);
      await invalidateAll();
    } else {
      showErrorAlert(messages.ERROR_DELETE_FAILED);
    }
  }

  // --- AVAILABILITY ---
  function resetAvailabilityFields(): void {
    availabilityStatus = 'available';
    availabilityStart = '';
    availabilityEnd = '';
    availabilityReason = '';
    availabilityNotes = '';
  }

  function openAvailabilityModal(adminId: number): void {
    if (!allAdmins.some((a) => a.id === adminId)) return;
    availabilityAdminId = adminId;
    resetAvailabilityFields();
    showAvailabilityModal = true;
  }

  function closeAvailabilityModal(): void {
    showAvailabilityModal = false;
    availabilityAdminId = null;
    resetAvailabilityFields();
  }

  async function saveAvailability(): Promise<void> {
    if (availabilityAdminId === null) return;
    availabilitySubmitting = true;
    const result = await executeFullAvailabilitySave(
      availabilityAdminId,
      {
        status: availabilityStatus,
        start: availabilityStart,
        end: availabilityEnd,
        reason: availabilityReason,
        notes: availabilityNotes,
      },
      log,
    );
    if (result.validationError === 'dates_required') {
      showErrorAlert('Von-Datum und Bis-Datum sind erforderlich.');
    } else if (result.validationError === 'end_before_start') {
      showErrorAlert('Bis-Datum muss nach oder gleich Von-Datum sein.');
    } else if (result.success) {
      closeAvailabilityModal();
      await invalidateAll();
      showSuccessAlert('Verfügbarkeit aktualisiert');
    } else {
      showErrorAlert(result.errorMessage ?? 'Fehler beim Speichern der Verfügbarkeit');
    }
    availabilitySubmitting = false;
  }

  // --- MODAL HANDLERS ---
  function openEditModal(adminId: number): void {
    const admin = allAdmins.find((a) => a.id === adminId);
    if (!admin) return;
    currentEditId = adminId;
    const s = populateFormFromAdmin(admin);
    applyFormState({ ...s, emailConfirm: s.email, passwordConfirm: '' });
    void loadUserPositions(adminId);
    showAdminModal = true;
  }

  function closeAdminModal(): void {
    showAdminModal = false;
    currentEditId = null;
    applyFormState(FORM_DEFAULTS);
  }

  // --- SEARCH ---
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
              currentStatusFilter = 'active';
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
              currentStatusFilter = 'inactive';
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
              currentStatusFilter = 'archived';
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
              currentStatusFilter = 'all';
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
              oninput={(e: Event) => {
                currentSearchQuery = (e.target as HTMLInputElement).value;
                searchOpen = currentSearchQuery.trim().length > 0;
              }}
            />
            <button
              class="search-input__clear"
              class:search-input__clear--visible={currentSearchQuery.length > 0}
              type="button"
              aria-label="Suche löschen"
              onclick={() => {
                currentSearchQuery = '';
                searchOpen = false;
              }}
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
              onresultClick={(adminId: number) => {
                openEditModal(adminId);
                searchOpen = false;
                currentSearchQuery = '';
              }}
            />
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
            disabled={!data.tenantVerified}
            title={data.tenantVerified ? undefined : (
              'Verifiziere zuerst Deine Firmen-Domain unter /settings/company-profile/domains.'
            )}
            onclick={() => {
              currentEditId = null;
              applyFormState(FORM_DEFAULTS);
              showAdminModal = true;
            }}
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
                  <th scope="col">{messages.TH_ADDITIONAL_INFO}</th>
                  <th scope="col">{messages.TH_ABSENCE_NOTES}</th>
                  <th scope="col">{messages.TH_ACTIONS}</th>
                </tr>
              </thead>
              <tbody>
                {#each paginatedAdmins as admin (admin.id)}
                  <AdminTableRow
                    {admin}
                    {labels}
                    currentUserId={data.user?.id ?? 0}
                    onedit={openEditModal}
                    onavailability={openAvailabilityModal}
                    onpermission={(uuid: string) => {
                      void goto(`/manage-admins/permission/${uuid}`);
                    }}
                    ondelete={(adminId: number) => {
                      deleteAdminId = adminId;
                      showDeleteModal = true;
                    }}
                  />
                {/each}
              </tbody>
            </table>
          </div>
          {#if totalPages > 1}
            <nav
              class="pagination"
              id="admins-pagination"
            >
              <button
                type="button"
                class="pagination__btn pagination__btn--prev"
                onclick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                <i class="fas fa-chevron-left"></i> Zurück
              </button>
              <div class="pagination__pages">
                {#each visiblePages as page, i (i)}
                  {#if page.type === 'ellipsis'}
                    <span class="pagination__ellipsis">...</span>
                  {:else if page.type === 'page'}
                    <button
                      type="button"
                      class="pagination__page"
                      class:pagination__page--active={page.active}
                      onclick={() => {
                        goToPage(page.value);
                      }}
                    >
                      {page.value}
                    </button>
                  {/if}
                {/each}
              </div>
              <span class="pagination__info">
                Seite {currentPage} von {totalPages} ({filteredAdmins.length} Einträge)
              </span>
              <button
                type="button"
                class="pagination__btn pagination__btn--next"
                onclick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Weiter <i class="fas fa-chevron-right"></i>
              </button>
            </nav>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Floating Action Button -->
<button
  type="button"
  class="btn-float"
  disabled={!data.tenantVerified}
  title={data.tenantVerified ?
    'Administrator hinzufügen'
  : 'Verifiziere zuerst Deine Firmen-Domain unter /settings/company-profile/domains.'}
  onclick={() => {
    currentEditId = null;
    applyFormState(FORM_DEFAULTS);
    showAdminModal = true;
  }}
  aria-label={data.tenantVerified ?
    'Administrator hinzufügen'
  : 'Administrator hinzufügen (deaktiviert: Domain nicht verifiziert)'}
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
  bind:formPositionIds
  bind:formNotes
  bind:formIsActive
  bind:formHasFullAccess
  bind:formAreaIds
  bind:formDepartmentIds
  onclose={closeAdminModal}
  onsubmit={(e: Event) => {
    e.preventDefault();
    void saveAdmin();
  }}
  onupgrade={canUpgrade ? upgradeAdmin : undefined}
  ondowngrade={canUpgrade ? downgradeAdmin : undefined}
  resetLinkTarget={isEditMode && currentEditId !== null ?
    (() => {
      const a = allAdmins.find((x) => x.id === currentEditId);
      return a !== undefined ? { id: a.id, email: a.email } : undefined;
    })()
  : undefined}
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
  onmanage={(uuid: string) => {
    closeAvailabilityModal();
    void goto(`/manage-admins/availability/${uuid}`);
  }}
/>

<!-- Delete Modals Component -->
<DeleteModals
  show={showDeleteModal}
  oncancel={() => {
    showDeleteModal = false;
    deleteAdminId = null;
  }}
  onconfirm={deleteAdmin}
/>

<!-- Role Change Confirm Modals (Upgrade/Downgrade) -->
<RoleChangeModals
  showUpgradeModal={showUpgradeConfirmModal}
  showDowngradeModal={showDowngradeConfirmModal}
  {upgradeLoading}
  {downgradeLoading}
  oncloseUpgrade={() => {
    showUpgradeConfirmModal = false;
    upgradeAdminId = null;
  }}
  oncloseDowngrade={() => {
    showDowngradeConfirmModal = false;
    downgradeAdminId = null;
  }}
  onconfirmUpgrade={() => {
    void confirmUpgradeAdmin();
  }}
  onconfirmDowngrade={() => {
    void confirmDowngradeAdmin();
  }}
/>
