<script lang="ts">
  /**
   * Manage Root Users - Page Component
   * @module manage-root/+page
   *
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   */
  import { invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';

  /** Resolve path with base prefix (for dynamic runtime paths) */
  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  import { showWarningAlert, showErrorAlert } from '$lib/stores/toast';

  import {
    saveRootUser as apiSaveRootUser,
    deleteRootUser as apiDeleteRootUser,
    buildRootUserPayload,
  } from './_lib/api';
  import { MESSAGES } from './_lib/constants';
  import DeleteModals from './_lib/DeleteModals.svelte';
  import { applyAllFilters } from './_lib/filters';
  import RootUserModal from './_lib/RootUserModal.svelte';
  import {
    getStatusBadgeClass,
    getStatusLabel,
    formatDate,
    getAvatarColor,
    highlightMatch,
    populateFormFromUser,
    getDefaultFormValues,
    validateEmailMatch,
    validatePasswordMatch,
  } from './_lib/utils';

  import type { PageData } from './$types';
  import type { RootUser, StatusFilter, FormIsActiveStatus } from './_lib/types';

  import '../../../styles/manage-root.css';
  import '../../../styles/password-strength.css';

  // =============================================================================
  // SSR DATA - Level 3: $derived from props (single source of truth)
  // =============================================================================

  const { data }: { data: PageData } = $props();

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
  let showDeleteConfirmModal = $state(false);

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
  const modalTitle = $derived(isEditMode ? MESSAGES.MODAL_TITLE_EDIT : MESSAGES.MODAL_TITLE_ADD);

  // Derived: Filtered users based on current filter/search state
  const filteredUsers = $derived(
    applyAllFilters(allRootUsers, currentStatusFilter, currentSearchQuery),
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
    const needsPasswordValidation = !isEditMode || formPassword !== '';
    if (needsPasswordValidation && !validatePasswordMatch(formPassword, formPasswordConfirm)) {
      passwordError = true;
      return false;
    }
    if (formPosition === '') {
      showWarningAlert(MESSAGES.SELECT_POSITION_ERROR);
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
        closeRootModal();
        // Level 3: Trigger SSR refetch
        await invalidateAll();
      } else {
        showErrorAlert(result.error ?? MESSAGES.ERROR_SAVING);
      }
    } catch (err) {
      console.error('[ManageRoot] Error saving user:', err);
      showErrorAlert(MESSAGES.ERROR_SAVING);
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
        closeDeleteConfirmModal();
        // Level 3: Trigger SSR refetch
        await invalidateAll();
      } else {
        showErrorAlert(result.error ?? MESSAGES.ERROR_DELETING);
      }
    } catch (err) {
      console.error('[ManageRoot] Error deleting user:', err);
      showErrorAlert(MESSAGES.ERROR_DELETING);
    }
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

  function proceedToDeleteConfirm(): void {
    showDeleteModal = false;
    showDeleteConfirmModal = true;
  }

  function closeDeleteConfirmModal(): void {
    showDeleteConfirmModal = false;
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
      if (showDeleteConfirmModal) closeDeleteConfirmModal();
      else if (showDeleteModal) closeDeleteModal();
      else if (showRootModal) closeRootModal();
    }
  }

  function validateEmails(): void {
    emailError = !validateEmailMatch(formEmail, formEmailConfirm);
  }

  function validatePasswords(): void {
    passwordError = !validatePasswordMatch(formPassword, formPasswordConfirm);
  }

  // Outside click for search
  $effect(() => {
    if (searchOpen) {
      const handler = (e: MouseEvent): void => {
        const el = document.querySelector('.search-input-wrapper');
        if (el && !el.contains(e.target as HTMLElement)) searchOpen = false;
      };
      document.addEventListener('click', handler);
      return () => {
        document.removeEventListener('click', handler);
      };
    }
  });
</script>

<svelte:head>
  <title>{MESSAGES.PAGE_TITLE}</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="container">
  <div class="card">
    <div class="card__header">
      <h2 class="card__title"><i class="fas fa-shield-alt mr-2"></i>{MESSAGES.PAGE_HEADING}</h2>
      <p class="text-[var(--color-text-secondary)] mt-2">{MESSAGES.PAGE_DESCRIPTION}</p>

      <div class="flex items-center justify-between gap-4 mt-6">
        <div class="toggle-group" id="root-status-toggle">
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

        <div class="search-input-wrapper max-w-80" class:search-input-wrapper--open={searchOpen}>
          <div class="search-input" id="root-search-container">
            <i class="search-input__icon fas fa-search"></i>
            <input
              type="search"
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
              onclick={clearSearch}><i class="fas fa-times"></i></button
            >
          </div>
          <div class="search-input__results">
            {#if currentSearchQuery && filteredUsers.length === 0}
              <div class="search-input__no-results">
                {MESSAGES.SEARCH_NO_RESULTS} "{currentSearchQuery}"
              </div>
            {:else if currentSearchQuery}
              {#each filteredUsers.slice(0, 5) as user (user.id)}
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                <div
                  class="search-input__result-item"
                  onclick={() => {
                    handleSearchResultClick(user.id);
                  }}
                >
                  <div class="search-result-item">
                    <div class="search-result-item__name">
                      <!-- eslint-disable-next-line svelte/no-at-html-tags -- Safe: highlightMatch escapes regex -->
                      {@html highlightMatch(
                        `${user.firstName} ${user.lastName}`,
                        currentSearchQuery,
                      )}
                    </div>
                    <div class="search-result-item__email">
                      <!-- eslint-disable-next-line svelte/no-at-html-tags -- Safe -->
                      {@html highlightMatch(user.email, currentSearchQuery)}
                    </div>
                    <div class="search-result-item__meta">
                      <span>
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -- Safe: highlightMatch escapes -->
                        {@html highlightMatch(
                          user.position ?? MESSAGES.NO_POSITION,
                          currentSearchQuery,
                        )}
                      </span>
                      {#if user.employeeNumber}
                        <span>
                          <!-- eslint-disable-next-line svelte/no-at-html-tags -- Safe: highlightMatch escapes -->
                          • {@html highlightMatch(user.employeeNumber, currentSearchQuery)}
                        </span>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
              {#if filteredUsers.length > 5}
                <div class="search-input__result-item search-result-item__more">
                  {MESSAGES.moreResults(filteredUsers.length - 5)}
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
          <div class="alert__title">{MESSAGES.SECURITY_TITLE}</div>
          <div class="alert__message">{MESSAGES.SECURITY_MESSAGE}</div>
        </div>
      </div>

      {#if error}
        <div class="text-center p-6">
          <i class="fas fa-exclamation-triangle text-4xl text-[var(--color-danger)] mb-4"></i>
          <p class="text-[var(--color-text-secondary)]">{error}</p>
          <button type="button" class="btn btn-primary mt-4" onclick={() => invalidateAll()}
            >Erneut versuchen</button
          >
        </div>
      {:else if filteredUsers.length === 0}
        <div class="empty-state">
          <div class="empty-state__icon"><i class="fas fa-shield-alt"></i></div>
          <h3 class="empty-state__title">{MESSAGES.NO_USERS_FOUND}</h3>
          <p class="empty-state__description">{MESSAGES.CREATE_FIRST_USER}</p>
          <button type="button" class="btn btn-primary" onclick={openAddModal}
            ><i class="fas fa-plus"></i> Root-Benutzer hinzufügen</button
          >
        </div>
      {:else}
        <div class="table-responsive">
          <table class="data-table data-table--hover data-table--striped">
            <thead>
              <tr
                ><th>ID</th><th>Name</th><th>E-Mail</th><th>Personalnummer</th><th>Position</th><th
                  >Status</th
                ><th>Erstellt am</th><th>Aktionen</th></tr
              >
            </thead>
            <tbody>
              {#each filteredUsers as user (user.id)}
                <tr>
                  <td>{user.id}</td>
                  <td>
                    <div class="flex items-center gap-2">
                      <div class="avatar avatar--sm avatar--color-{getAvatarColor(user.id)}">
                        <span>{user.firstName.charAt(0)}{user.lastName.charAt(0)}</span>
                      </div>
                      <span>{user.firstName} {user.lastName}</span>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>{user.employeeNumber ?? '-'}</td>
                  <td>{user.position ?? '-'}</td>
                  <td
                    ><span class="badge {getStatusBadgeClass(user.isActive)}"
                      >{getStatusLabel(user.isActive)}</span
                    ></td
                  >
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
              {MESSAGES.PROFILE_INFO}
              <a href={resolvePath('/root-profile')} class="text-blue-500 hover:underline"
                >{MESSAGES.PROFILE_LINK_TEXT}</a
              >.
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<button type="button" class="btn-float" onclick={openAddModal} aria-label="Root-Benutzer hinzufügen"
  ><i class="fas fa-user-shield"></i></button
>

<RootUserModal
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
  {showDeleteModal}
  {showDeleteConfirmModal}
  onCloseDelete={closeDeleteModal}
  onCloseDeleteConfirm={closeDeleteConfirmModal}
  onProceedToConfirm={proceedToDeleteConfirm}
  onConfirmDelete={deleteUser}
/>
