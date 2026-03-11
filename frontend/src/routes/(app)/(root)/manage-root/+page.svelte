<script lang="ts">
  /**
   * Manage Root Users - Page Component
   * @module manage-root/+page
   *
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   */
  import { goto, invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';

  /** Resolve path with base prefix (for dynamic runtime paths) */
  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  import AvailabilityModal from '$lib/availability/AvailabilityModal.svelte';
  import SearchResultUser from '$lib/components/SearchResultUser.svelte';
  import {
    showSuccessAlert,
    showWarningAlert,
    showErrorAlert,
  } from '$lib/stores/toast';
  import { ApiError } from '$lib/utils/api-client';
  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('ManageRootPage');

  import {
    saveRootUser as apiSaveRootUser,
    deleteRootUser as apiDeleteRootUser,
    buildRootUserPayload,
    updateRootAvailability as apiUpdateAvailability,
  } from './_lib/api';
  import { createRootMessages } from './_lib/constants';
  import DeleteModals from './_lib/DeleteModals.svelte';
  import { applyAllFilters } from './_lib/filters';
  import RootUserModal from './_lib/RootUserModal.svelte';
  import {
    getStatusBadgeClass,
    getStatusLabel,
    formatDate,
    getAvatarColor,
    populateFormFromUser,
    getDefaultFormValues,
    validateEmailMatch,
    validatePasswordMatch,
    getAvailabilityBadge,
    getPlannedAvailability,
    getTruncatedNotes,
    validateAvailabilityForm,
    buildAvailabilityPayload,
  } from './_lib/utils';

  import type { PageData } from './$types';
  import type {
    RootUser,
    StatusFilter,
    FormIsActiveStatus,
    AvailabilityStatus,
  } from './_lib/types';

  // =============================================================================
  // SSR DATA - Level 3: $derived from props (single source of truth)
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // Hierarchy labels from layout data inheritance (A6)
  const labels = $derived(data.hierarchyLabels);
  const messages = $derived(createRootMessages(labels));

  // SSR data via $derived - updates when invalidateAll() is called
  const allRootUsers = $derived<RootUser[]>(data.rootUsers);

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
  let showRootModal = $state(false);
  let showDeleteModal = $state(false);
  let showAvailabilityModal = $state(false);

  // Availability Modal State
  let availabilityUserId = $state<number | null>(null);
  let availabilityStatus = $state<AvailabilityStatus>('available');
  let availabilityStart = $state('');
  let availabilityEnd = $state('');
  let availabilityReason = $state('');
  let availabilityNotes = $state('');
  let availabilitySubmitting = $state(false);

  // Edit State
  let currentEditId = $state<number | null>(null);
  let deleteUserId = $state<number | null>(null);

  // Form fields (bindable to modal)
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

  let emailError = $state(false);
  let passwordError = $state(false);
  let submitting = $state(false);

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const isEditMode = $derived(currentEditId !== null);
  const modalTitle = $derived(
    isEditMode ? messages.MODAL_TITLE_EDIT : messages.MODAL_TITLE_ADD,
  );

  // Derived: Filtered users based on current filter/search state
  const filteredUsers = $derived(
    applyAllFilters(allRootUsers, currentStatusFilter, currentSearchQuery),
  );

  // Derived: Current user for availability modal
  const availabilityUser = $derived(
    availabilityUserId !== null ?
      (allRootUsers.find((u) => u.id === availabilityUserId) ?? null)
    : null,
  );

  // =============================================================================
  // HELPERS
  // =============================================================================

  function resetForm(): void {
    const d = getDefaultFormValues();
    formFirstName = d.firstName;
    formLastName = d.lastName;
    formEmail = d.email;
    formEmailConfirm = d.emailConfirm;
    formPassword = d.password;
    formPasswordConfirm = d.passwordConfirm;
    formEmployeeNumber = d.employeeNumber;
    formPosition = d.position;
    formNotes = d.notes;
    formIsActive = d.isActive;
    emailError = false;
    passwordError = false;
  }

  // =============================================================================
  // API FUNCTIONS - Level 3: invalidateAll() after mutations
  // =============================================================================

  /**
   * Validate form before save
   * @returns true if valid, false if validation failed (and state was updated)
   */
  function validateSaveForm(): boolean {
    if (!validateEmailMatch(formEmail, formEmailConfirm)) {
      emailError = true;
      return false;
    }
    // New: both password fields required and must match
    // Edit: if either field is filled, both must be filled and match
    const eitherFilled = formPassword !== '' || formPasswordConfirm !== '';
    const passwordInvalid =
      !isEditMode ?
        formPassword === '' ||
        formPasswordConfirm === '' ||
        formPassword !== formPasswordConfirm
      : eitherFilled && formPassword !== formPasswordConfirm;
    if (passwordInvalid) {
      passwordError = true;
      return false;
    }
    if (formPosition === '') {
      showWarningAlert(messages.SELECT_POSITION_ERROR);
      return false;
    }
    return true;
  }

  async function saveUser(): Promise<void> {
    submitting = true;

    try {
      if (!validateSaveForm()) {
        submitting = false;
        return;
      }

      const payload = buildRootUserPayload(
        {
          firstName: formFirstName,
          lastName: formLastName,
          email: formEmail,
          position: formPosition,
          notes: formNotes,
          employeeNumber: formEmployeeNumber,
          isActive: formIsActive,
          password: formPassword,
        },
        isEditMode,
      );

      const result = await apiSaveRootUser(payload, currentEditId);
      if (result.success) {
        showSuccessAlert(
          isEditMode ? messages.SUCCESS_UPDATED : messages.SUCCESS_CREATED,
        );
        closeRootModal();
        // Level 3: Trigger SSR refetch
        await invalidateAll();
      } else {
        showErrorAlert(result.error ?? messages.ERROR_SAVING);
      }
    } catch (err: unknown) {
      log.error({ err }, 'Error saving user');
      showErrorAlert(messages.ERROR_SAVING);
    } finally {
      submitting = false;
    }
  }

  async function deleteUser(): Promise<void> {
    // Capture ID at start to avoid race condition (require-atomic-updates)
    const userIdToDelete = deleteUserId;
    if (userIdToDelete === null) return;

    try {
      const result = await apiDeleteRootUser(userIdToDelete);
      if (result.success) {
        showSuccessAlert(messages.SUCCESS_DELETED);
        closeDeleteModal();
        // Level 3: Trigger SSR refetch
        await invalidateAll();
      } else {
        showErrorAlert(result.error ?? messages.ERROR_DELETING);
      }
    } catch (err: unknown) {
      log.error({ err }, 'Error deleting user');
      showErrorAlert(messages.ERROR_DELETING);
    }
  }

  // =============================================================================
  // AVAILABILITY MODAL HANDLERS
  // NOTE: Modal is CREATE-only. PUT/UPDATE is on history page.
  // =============================================================================

  function openAvailabilityModal(userId: number): void {
    const user = allRootUsers.find((u) => u.id === userId);
    if (!user) return;

    availabilityUserId = userId;
    availabilityStatus = 'available';
    availabilityStart = '';
    availabilityEnd = '';
    availabilityReason = '';
    availabilityNotes = '';
    showAvailabilityModal = true;
  }

  function closeAvailabilityModal(): void {
    showAvailabilityModal = false;
    availabilityUserId = null;
    availabilityStatus = 'available';
    availabilityStart = '';
    availabilityEnd = '';
    availabilityReason = '';
    availabilityNotes = '';
  }

  async function saveAvailability(): Promise<void> {
    if (availabilityUserId === null) return;

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
      await apiUpdateAvailability(availabilityUserId, payload);
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
    void goto(resolvePath(`/manage-root/availability/${uuid}`));
  }

  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================

  function openAddModal(): void {
    currentEditId = null;
    resetForm();
    showRootModal = true;
  }

  function openEditModal(userId: number): void {
    const user = allRootUsers.find((u) => u.id === userId);
    if (!user) return;
    currentEditId = userId;
    const f = populateFormFromUser(user);
    formFirstName = f.firstName;
    formLastName = f.lastName;
    formEmail = f.email;
    formEmailConfirm = f.emailConfirm;
    formPassword = f.password;
    formPasswordConfirm = f.passwordConfirm;
    formEmployeeNumber = f.employeeNumber;
    formPosition = f.position;
    formNotes = f.notes;
    formIsActive = f.isActive;
    emailError = false;
    passwordError = false;
    showRootModal = true;
  }

  function closeRootModal(): void {
    showRootModal = false;
    currentEditId = null;
    resetForm();
  }

  function openDeleteModal(userId: number): void {
    deleteUserId = userId;
    showDeleteModal = true;
  }

  function closeDeleteModal(): void {
    showDeleteModal = false;
    deleteUserId = null;
  }

  // =============================================================================
  // UI HANDLERS
  // =============================================================================

  function handleStatusToggle(status: StatusFilter): void {
    currentStatusFilter = status;
    // filteredUsers is $derived - automatically updates when filter changes
  }

  function handleSearchInput(e: Event): void {
    currentSearchQuery = (e.target as HTMLInputElement).value;
    searchOpen = currentSearchQuery.trim().length > 0;
    // filteredUsers is $derived - automatically updates when search changes
  }

  function clearSearch(): void {
    currentSearchQuery = '';
    searchOpen = false;
    // filteredUsers is $derived - automatically updates
  }

  function handleSearchResultClick(userId: number): void {
    openEditModal(userId);
    searchOpen = false;
    currentSearchQuery = '';
  }

  function handleFormSubmit(e: Event): void {
    e.preventDefault();
    void saveUser();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (showAvailabilityModal) closeAvailabilityModal();
      else if (showDeleteModal) closeDeleteModal();
      else if (showRootModal) closeRootModal();
    }
  }

  function validateEmails(): void {
    emailError = !validateEmailMatch(formEmail, formEmailConfirm);
  }

  function validatePasswords(): void {
    // Only show error if user has typed in the confirm field
    passwordError =
      formPasswordConfirm !== '' ?
        !validatePasswordMatch(formPassword, formPasswordConfirm)
      : false;
  }

  // Outside click for search
  $effect(() => {
    if (searchOpen) {
      const handler = (e: MouseEvent): void => {
        const el = document.querySelector('.search-input-wrapper');
        if (el && !el.contains(e.target as HTMLElement)) searchOpen = false;
      };
      document.addEventListener('click', handler, true);
      return () => {
        document.removeEventListener('click', handler, true);
      };
    }
  });
</script>

<svelte:head>
  <title>{messages.PAGE_TITLE}</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="container">
  <div class="card">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-shield-alt mr-2"></i>{messages.PAGE_HEADING}
      </h2>
      <p class="mt-2 text-(--color-text-secondary)">
        {messages.PAGE_DESCRIPTION}
      </p>

      <div class="mt-6 flex items-center justify-between gap-4">
        <div
          class="toggle-group"
          id="root-status-toggle"
        >
          <button
            type="button"
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'active'}
            onclick={() => {
              handleStatusToggle('active');
            }}
          >
            <i class="fas fa-user-check"></i> Aktive
          </button>
          <button
            type="button"
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'inactive'}
            onclick={() => {
              handleStatusToggle('inactive');
            }}
          >
            <i class="fas fa-user-times"></i> Inaktive
          </button>
          <button
            type="button"
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'archived'}
            onclick={() => {
              handleStatusToggle('archived');
            }}
          >
            <i class="fas fa-archive"></i> Archiviert
          </button>
          <button
            type="button"
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'all'}
            onclick={() => {
              handleStatusToggle('all');
            }}
          >
            <i class="fas fa-users"></i> Alle
          </button>
        </div>

        <div
          class="search-input-wrapper max-w-80"
          class:search-input-wrapper--open={searchOpen}
        >
          <div
            class="search-input"
            id="root-search-container"
          >
            <i class="search-input__icon fas fa-search"></i>
            <input
              type="search"
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
              onclick={clearSearch}><i class="fas fa-times"></i></button
            >
          </div>
          <div class="search-input__results">
            {#if currentSearchQuery && filteredUsers.length === 0}
              <div class="search-input__no-results">
                {messages.SEARCH_NO_RESULTS} "{currentSearchQuery}"
              </div>
            {:else if currentSearchQuery}
              {#each filteredUsers.slice(0, 5) as user (user.id)}
                <SearchResultUser
                  id={user.id}
                  firstName={user.firstName}
                  lastName={user.lastName}
                  email={user.email}
                  employeeNumber={user.employeeNumber}
                  role="root"
                  position={user.position ?? messages.NO_POSITION}
                  query={currentSearchQuery}
                  onclick={() => {
                    handleSearchResultClick(user.id);
                  }}
                />
              {/each}
              {#if filteredUsers.length > 5}
                <div
                  class="search-input__result-item search-input__result-more"
                >
                  {messages.moreResults(filteredUsers.length - 5)}
                </div>
              {/if}
            {/if}
          </div>
        </div>
      </div>
    </div>

    <div class="card__body">
      <div class="alert alert--warning mb-4">
        <div class="alert__icon"><i class="fas fa-shield-alt"></i></div>
        <div class="alert__content">
          <div class="alert__title">{messages.SECURITY_TITLE}</div>
          <div class="alert__message">{messages.SECURITY_MESSAGE}</div>
        </div>
      </div>

      {#if error}
        <div class="p-6 text-center">
          <i
            class="fas fa-exclamation-triangle mb-4 text-4xl text-(--color-danger)"
          ></i>
          <p class="text-(--color-text-secondary)">{error}</p>
          <button
            type="button"
            class="btn btn-primary mt-4"
            onclick={() => invalidateAll()}>Erneut versuchen</button
          >
        </div>
      {:else if filteredUsers.length === 0}
        <div class="empty-state">
          <div class="empty-state__icon"><i class="fas fa-shield-alt"></i></div>
          <h3 class="empty-state__title">{messages.NO_USERS_FOUND}</h3>
          <p class="empty-state__description">{messages.CREATE_FIRST_USER}</p>
          <button
            type="button"
            class="btn btn-primary"
            onclick={openAddModal}
            ><i class="fas fa-plus"></i> Root-Benutzer hinzufügen</button
          >
        </div>
      {:else}
        <div class="table-responsive">
          <table class="data-table data-table--hover data-table--striped">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>E-Mail</th>
                <th>Personalnummer</th>
                <th>Position</th>
                <th>Status</th>
                <th>{messages.TH_AVAILABILITY}</th>
                <th>{messages.TH_PLANNED}</th>
                <th>{messages.TH_NOTES}</th>
                <th>Erstellt am</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredUsers as user (user.id)}
                {@const avBadge = getAvailabilityBadge(user)}
                {@const planned = getPlannedAvailability(user)}
                {@const userNotes = getTruncatedNotes(user.availabilityNotes)}
                <tr>
                  <td>{user.id}</td>
                  <td>
                    <div class="flex items-center gap-2">
                      <div
                        class="avatar avatar--sm avatar--color-{getAvatarColor(
                          user.id,
                        )}"
                      >
                        <span
                          >{user.firstName.charAt(0)}{user.lastName.charAt(
                            0,
                          )}</span
                        >
                      </div>
                      <span>{user.firstName} {user.lastName}</span>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>{user.employeeNumber ?? '-'}</td>
                  <td>{user.position ?? '-'}</td>
                  <td>
                    <span class="badge {getStatusBadgeClass(user.isActive)}">
                      {getStatusLabel(user.isActive)}
                    </span>
                  </td>
                  <td>
                    <span class="badge {avBadge.class}">
                      {#if avBadge.icon}<i class="fas {avBadge.icon} mr-1"
                        ></i>{/if}
                      {avBadge.text}
                    </span>
                  </td>
                  <td>{planned}</td>
                  <td title={userNotes.title}>{userNotes.text}</td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <div class="flex gap-2">
                      <button
                        type="button"
                        class="action-icon action-icon--edit"
                        title="Bearbeiten"
                        onclick={() => {
                          openEditModal(user.id);
                        }}><i class="fas fa-edit"></i></button
                      >
                      <button
                        type="button"
                        class="action-icon action-icon--info"
                        title="Verfügbarkeit bearbeiten"
                        aria-label="Verfügbarkeit bearbeiten"
                        onclick={() => {
                          openAvailabilityModal(user.id);
                        }}><i class="fas fa-calendar-alt"></i></button
                      >
                      <button
                        type="button"
                        class="action-icon action-icon--delete"
                        title="Löschen"
                        onclick={() => {
                          openDeleteModal(user.id);
                        }}><i class="fas fa-trash"></i></button
                      >
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="alert alert--info mt-6">
          <div class="alert__icon"><i class="fas fa-info-circle"></i></div>
          <div class="alert__content">
            <div class="alert__message">
              {messages.PROFILE_INFO}
              <a
                href={resolvePath('/root-profile')}
                class="text-blue-500 hover:underline"
                >{messages.PROFILE_LINK_TEXT}</a
              >.
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<button
  type="button"
  class="btn-float"
  onclick={openAddModal}
  aria-label="Root-Benutzer hinzufügen"
  ><i class="fas fa-user-shield"></i></button
>

<RootUserModal
  {messages}
  show={showRootModal}
  {isEditMode}
  {modalTitle}
  bind:firstName={formFirstName}
  bind:lastName={formLastName}
  bind:email={formEmail}
  bind:emailConfirm={formEmailConfirm}
  bind:password={formPassword}
  bind:passwordConfirm={formPasswordConfirm}
  bind:employeeNumber={formEmployeeNumber}
  bind:position={formPosition}
  bind:notes={formNotes}
  bind:isActive={formIsActive}
  {emailError}
  {passwordError}
  {submitting}
  onclose={closeRootModal}
  onsubmit={handleFormSubmit}
  onValidateEmails={validateEmails}
  onValidatePasswords={validatePasswords}
/>

<DeleteModals
  show={showDeleteModal}
  oncancel={closeDeleteModal}
  onconfirm={deleteUser}
/>

<!-- Availability Modal Component -->
<AvailabilityModal
  show={showAvailabilityModal}
  person={availabilityUser}
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
