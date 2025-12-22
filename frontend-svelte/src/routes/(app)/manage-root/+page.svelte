<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { showWarningAlert, showErrorAlert } from '$lib/stores/toast.js';

  // Types
  import type { RootUser, StatusFilter, FormIsActiveStatus } from './_lib/types';

  // Constants
  import { POSITION_OPTIONS, MESSAGES } from './_lib/constants';

  // API
  import {
    loadRootUsers as apiLoadRootUsers,
    saveRootUser as apiSaveRootUser,
    deleteRootUser as apiDeleteRootUser,
    buildRootUserPayload,
    checkSession,
  } from './_lib/api';

  // Filters
  import { applyAllFilters } from './_lib/filters';

  // Utils
  import {
    getStatusBadgeClass,
    getStatusLabel,
    formatDate,
    getAvatarColor,
    highlightMatch,
    calculatePasswordStrength,
    populateFormFromUser,
    getDefaultFormValues,
    validateEmailMatch,
    validatePasswordMatch,
  } from './_lib/utils';

  // Page-specific CSS
  import '../../../styles/manage-root.css';
  import '../../../styles/password-strength.css';

  // =============================================================================
  // SVELTE 5 RUNES - State
  // =============================================================================

  // Root Users Data
  let allRootUsers = $state<RootUser[]>([]);
  let filteredUsers = $state<RootUser[]>([]);

  // Loading and Error States
  let loading = $state(true);
  let error = $state<string | null>(null);

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
  const modalTitle = $derived(isEditMode ? MESSAGES.MODAL_TITLE_EDIT : MESSAGES.MODAL_TITLE_ADD);

  // =============================================================================
  // FILTER HELPERS
  // =============================================================================

  function applyFilters(): void {
    filteredUsers = applyAllFilters(allRootUsers, currentStatusFilter, currentSearchQuery);
  }

  // =============================================================================
  // API HANDLERS
  // =============================================================================

  async function loadUsers(): Promise<void> {
    loading = true;
    error = null;

    const result = await apiLoadRootUsers();
    allRootUsers = result.users;
    error = result.error;
    applyFilters();
    loading = false;
  }

  async function saveUser(): Promise<void> {
    submitting = true;

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

    if (!formPosition) {
      showWarningAlert(MESSAGES.SELECT_POSITION_ERROR);
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
      await loadUsers();
    } else {
      showErrorAlert(result.error ?? MESSAGES.ERROR_SAVING);
    }

    submitting = false;
  }

  async function deleteUser(): Promise<void> {
    if (deleteUserId === null) return;

    const result = await apiDeleteRootUser(deleteUserId);

    if (result.success) {
      showDeleteConfirmModal = false;
      deleteUserId = null;
      await loadUsers();
    } else {
      showErrorAlert(result.error ?? MESSAGES.ERROR_DELETING);
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
    const formData = populateFormFromUser(user);
    formFirstName = formData.firstName;
    formLastName = formData.lastName;
    formEmail = formData.email;
    formEmailConfirm = formData.emailConfirm;
    formPassword = formData.password;
    formPasswordConfirm = formData.passwordConfirm;
    formEmployeeNumber = formData.employeeNumber;
    formPosition = formData.position;
    formNotes = formData.notes;
    formIsActive = formData.isActive;
    emailError = false;
    passwordError = false;
    showRootModal = true;
  }

  function openDeleteModal(userId: number): void {
    deleteUserId = userId;
    showDeleteModal = true;
  }

  function proceedToDeleteConfirm(): void {
    showDeleteModal = false;
    showDeleteConfirmModal = true;
  }

  function closeRootModal(): void {
    showRootModal = false;
    currentEditId = null;
    resetForm();
  }

  function closeDeleteModal(): void {
    showDeleteModal = false;
    deleteUserId = null;
  }

  function closeDeleteConfirmModal(): void {
    showDeleteConfirmModal = false;
    deleteUserId = null;
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
    formNotes = defaults.notes;
    formIsActive = defaults.isActive;
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

  function togglePositionDropdown(e: MouseEvent): void {
    e.stopPropagation();
    statusDropdownOpen = false;
    positionDropdownOpen = !positionDropdownOpen;
  }

  function selectPosition(position: string): void {
    formPosition = position;
    positionDropdownOpen = false;
  }

  function toggleStatusDropdown(e: MouseEvent): void {
    e.stopPropagation();
    positionDropdownOpen = false;
    statusDropdownOpen = !statusDropdownOpen;
  }

  function selectStatus(status: FormIsActiveStatus): void {
    formIsActive = status;
    statusDropdownOpen = false;
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

  function handleSearchResultClick(userId: number): void {
    openEditModal(userId);
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
    saveUser();
  }

  // =============================================================================
  // OVERLAY CLICK HANDLERS
  // =============================================================================

  function handleModalOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      closeRootModal();
    }
  }

  function handleDeleteOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      closeDeleteModal();
    }
  }

  function handleDeleteConfirmOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      closeDeleteConfirmModal();
    }
  }

  // =============================================================================
  // OUTSIDE CLICK HANDLERS
  // =============================================================================

  $effect(() => {
    if (positionDropdownOpen || statusDropdownOpen || searchOpen) {
      const handleOutsideClick = (e: MouseEvent): void => {
        const target = e.target as HTMLElement;

        if (positionDropdownOpen) {
          const positionDropdown = document.getElementById('position-dropdown');
          if (positionDropdown && !positionDropdown.contains(target)) {
            positionDropdownOpen = false;
          }
        }

        if (statusDropdownOpen) {
          const statusDropdown = document.getElementById('status-dropdown');
          if (statusDropdown && !statusDropdown.contains(target)) {
            statusDropdownOpen = false;
          }
        }

        if (searchOpen) {
          const searchWrapper = document.querySelector('.search-input-wrapper');
          if (searchWrapper && !searchWrapper.contains(target)) {
            searchOpen = false;
          }
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
      if (showDeleteConfirmModal) {
        closeDeleteConfirmModal();
      } else if (showDeleteModal) {
        closeDeleteModal();
      } else if (showRootModal) {
        closeRootModal();
      }
    }
  }

  // =============================================================================
  // LIFECYCLE
  // =============================================================================

  onMount(() => {
    if (!checkSession()) return;
    loadUsers();
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
        <i class="fas fa-shield-alt mr-2"></i>
        {MESSAGES.PAGE_HEADING}
      </h2>
      <p class="text-[var(--color-text-secondary)] mt-2">
        {MESSAGES.PAGE_DESCRIPTION}
      </p>

      <!-- Filter & Search Controls -->
      <div class="flex items-center justify-between gap-4 mt-6">
        <!-- Status Toggle Group -->
        <div class="toggle-group" id="root-status-toggle">
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'active'}
            title="Aktive Root-Benutzer"
            onclick={() => handleStatusToggle('active')}
          >
            <i class="fas fa-user-check"></i>
            Aktive
          </button>
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'inactive'}
            title="Inaktive Root-Benutzer"
            onclick={() => handleStatusToggle('inactive')}
          >
            <i class="fas fa-user-times"></i>
            Inaktive
          </button>
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'archived'}
            title="Archivierte Root-Benutzer"
            onclick={() => handleStatusToggle('archived')}
          >
            <i class="fas fa-archive"></i>
            Archiviert
          </button>
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'all'}
            title="Alle Root-Benutzer"
            onclick={() => handleStatusToggle('all')}
          >
            <i class="fas fa-users"></i>
            Alle
          </button>
        </div>

        <!-- Search Input -->
        <div class="search-input-wrapper max-w-80" class:search-input-wrapper--open={searchOpen}>
          <div class="search-input" id="root-search-container">
            <i class="search-input__icon fas fa-search"></i>
            <input
              type="search"
              id="root-search"
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
            <div class="search-input__spinner"></div>
          </div>
          <!-- Results Dropdown -->
          <div class="search-input__results" id="root-search-results">
            {#if currentSearchQuery && filteredUsers.length === 0}
              <div class="search-input__no-results">
                {MESSAGES.SEARCH_NO_RESULTS} "{currentSearchQuery}"
              </div>
            {:else if currentSearchQuery}
              {#each filteredUsers.slice(0, 5) as user (user.id)}
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                <div
                  class="search-input__result-item"
                  onclick={() => handleSearchResultClick(user.id)}
                >
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="font-weight: 500; color: var(--color-text-primary);">
                      <!-- eslint-disable-next-line svelte/no-at-html-tags -- Safe: highlightMatch escapes regex special chars -->
                      {@html highlightMatch(
                        `${user.firstName} ${user.lastName}`,
                        currentSearchQuery,
                      )}
                    </div>
                    <div style="font-size: 0.813rem; color: var(--color-text-secondary);">
                      <!-- eslint-disable-next-line svelte/no-at-html-tags -- Safe: highlightMatch escapes regex special chars -->
                      {@html highlightMatch(user.email, currentSearchQuery)}
                    </div>
                    <div
                      style="font-size: 0.75rem; color: var(--color-text-muted); display: flex; gap: 8px;"
                    >
                      <span>
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -- Safe: highlightMatch escapes regex special chars -->
                        {@html highlightMatch(
                          user.position ?? MESSAGES.NO_POSITION,
                          currentSearchQuery,
                        )}
                      </span>
                      {#if user.employeeNumber}
                        <span>
                          <!-- eslint-disable-next-line svelte/no-at-html-tags -- Safe: highlightMatch escapes regex special chars -->
                          • {@html highlightMatch(user.employeeNumber, currentSearchQuery)}
                        </span>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
              {#if filteredUsers.length > 5}
                <div
                  class="search-input__result-item"
                  style="font-size: 0.813rem; color: var(--color-primary); text-align: center; border-top: 1px solid rgb(255 255 255 / 5%);"
                >
                  {MESSAGES.MORE_RESULTS(filteredUsers.length - 5)}
                </div>
              {/if}
            {/if}
          </div>
        </div>
      </div>
    </div>

    <div class="card__body">
      <!-- Security Warning -->
      <div class="alert alert--warning mb-4">
        <div class="alert__icon">
          <i class="fas fa-shield-alt"></i>
        </div>
        <div class="alert__content">
          <div class="alert__title">{MESSAGES.SECURITY_TITLE}</div>
          <div class="alert__message">{MESSAGES.SECURITY_MESSAGE}</div>
        </div>
      </div>

      <!-- Loading State -->
      {#if loading}
        <div id="root-users-loading" class="spinner-container">
          <div class="spinner-ring spinner-ring--md"></div>
          <p class="mt-2 text-[var(--color-text-secondary)]">{MESSAGES.LOADING}</p>
        </div>
      {:else if error}
        <div class="text-center p-6">
          <i class="fas fa-exclamation-triangle text-4xl text-[var(--color-danger)] mb-4"></i>
          <p class="text-[var(--color-text-secondary)]">{error}</p>
          <button class="btn btn-primary mt-4" onclick={() => loadUsers()}>Erneut versuchen</button>
        </div>
      {:else if filteredUsers.length === 0}
        <!-- Empty State -->
        <div id="root-users-empty" class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-shield-alt"></i>
          </div>
          <h3 class="empty-state__title">{MESSAGES.NO_USERS_FOUND}</h3>
          <p class="empty-state__description">{MESSAGES.CREATE_FIRST_USER}</p>
          <button class="btn btn-primary" onclick={openAddModal}>
            <i class="fas fa-plus"></i>
            Root-Benutzer hinzufügen
          </button>
        </div>
      {:else}
        <!-- Root User Table -->
        <div id="rootTableContent">
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
                  <th>Erstellt am</th>
                  <th>Aktionen</th>
                </tr>
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
                    <td>
                      <span class="badge {getStatusBadgeClass(user.isActive)}"
                        >{getStatusLabel(user.isActive)}</span
                      >
                    </td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>
                      <div class="flex gap-2">
                        <button
                          class="action-icon action-icon--edit"
                          title="Bearbeiten"
                          aria-label="Root-User bearbeiten"
                          onclick={() => openEditModal(user.id)}
                        >
                          <i class="fas fa-edit"></i>
                        </button>
                        <button
                          class="action-icon action-icon--delete"
                          title="Löschen"
                          aria-label="Root-User löschen"
                          onclick={() => openDeleteModal(user.id)}
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
          <div class="alert alert--info mt-6">
            <div class="alert__icon">
              <i class="fas fa-info-circle"></i>
            </div>
            <div class="alert__content">
              <div class="alert__message">
                {MESSAGES.PROFILE_INFO}
                <a href="{base}/root-profile" class="text-blue-500 hover:underline"
                  >{MESSAGES.PROFILE_LINK_TEXT}</a
                >.
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Floating Action Button -->
<button class="btn-float" onclick={openAddModal} aria-label="Root-Benutzer hinzufügen">
  <i class="fas fa-user-shield"></i>
</button>

<!-- Add/Edit Root User Modal -->
<div
  id="root-modal"
  class="modal-overlay"
  class:modal-overlay--active={showRootModal}
  role="dialog"
  aria-modal="true"
  aria-labelledby="root-modal-title"
  tabindex="-1"
  onclick={handleModalOverlayClick}
  onkeydown={(e) => e.key === 'Escape' && closeRootModal()}
>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <form
    id="root-form"
    class="ds-modal"
    onclick={(e) => e.stopPropagation()}
    onsubmit={handleFormSubmit}
  >
    <div class="ds-modal__header">
      <h3 class="ds-modal__title" id="root-modal-title">{modalTitle}</h3>
      <button
        type="button"
        class="ds-modal__close"
        aria-label="Modal schließen"
        onclick={closeRootModal}
      >
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="ds-modal__body">
      <div class="form-field">
        <label class="form-field__label" for="root-first-name">
          Vorname <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="root-first-name"
          name="firstName"
          class="form-field__control"
          required
          bind:value={formFirstName}
        />
      </div>

      <div class="form-field">
        <label class="form-field__label" for="root-last-name">
          Nachname <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="root-last-name"
          name="lastName"
          class="form-field__control"
          required
          bind:value={formLastName}
        />
      </div>

      <div class="form-field">
        <label class="form-field__label" for="root-email">
          E-Mail <span class="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="root-email"
          name="email"
          class="form-field__control"
          class:is-error={emailError}
          required
          bind:value={formEmail}
          oninput={validateEmails}
        />
        <span class="form-field__message text-[var(--color-text-secondary)]"
          >{MESSAGES.EMAIL_USED_AS_USERNAME}</span
        >
      </div>

      <div class="form-field" id="email-confirm-group">
        <label class="form-field__label" for="root-email-confirm">
          E-Mail wiederholen <span class="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="root-email-confirm"
          name="emailConfirm"
          class="form-field__control"
          class:is-error={emailError}
          required
          bind:value={formEmailConfirm}
          oninput={validateEmails}
        />
        {#if emailError}
          <span class="form-field__message form-field__message--error"
            >{MESSAGES.EMAILS_NOT_MATCH}</span
          >
        {/if}
      </div>

      <div class="form-field">
        <label class="form-field__label" for="root-employee-number">Personalnummer</label>
        <input
          type="text"
          id="root-employee-number"
          name="employeeNumber"
          class="form-field__control"
          placeholder="z.B. ABC-123 oder 2025-001 (optional, max 10 Zeichen)"
          maxlength="10"
          pattern="[A-Za-z0-9\-]{'{'}1,10}"
          title="Max 10 Zeichen: Buchstaben, Zahlen, Bindestrich"
          bind:value={formEmployeeNumber}
        />
      </div>

      <div class="form-field" id="password-group">
        <label class="form-field__label" for="root-password">
          Passwort
          {#if !isEditMode}<span class="text-red-500">*</span>{/if}
          <span class="tooltip ml-1">
            <i class="fas fa-info-circle text-blue-400 text-sm cursor-help"></i>
            <span
              class="tooltip__content tooltip__content--info tooltip__content--right"
              role="tooltip"
            >
              Min. 12 Zeichen, max. 72 Zeichen. Enthält 3 von 4: Großbuchstaben, Kleinbuchstaben,
              Zahlen, Sonderzeichen (!@#$%^&*)
            </span>
          </span>
        </label>
        <div class="form-field__password-wrapper">
          <input
            type={showPassword ? 'text' : 'password'}
            id="root-password"
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
        <label class="form-field__label" for="root-password-confirm">
          Passwort wiederholen
          {#if !isEditMode}<span class="text-red-500">*</span>{/if}
        </label>
        <div class="form-field__password-wrapper">
          <input
            type={showPasswordConfirm ? 'text' : 'password'}
            id="root-password-confirm"
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
            >{MESSAGES.PASSWORDS_NOT_MATCH}</span
          >
        {/if}
      </div>

      <!-- Password Strength Indicator -->
      {#if formPassword}
        <div class="password-strength-container" id="root-password-strength-container">
          <div class="password-strength-meter">
            <div class="password-strength-bar" data-score={passwordScore}></div>
          </div>
          <div class="password-strength-info">
            <span class="password-strength-label">{passwordLabel}</span>
            <span class="password-strength-time">{passwordTime}</span>
          </div>
        </div>
      {/if}

      <!-- Full Access Info -->
      <div class="form-field">
        <div class="alert alert--info">
          <div class="alert__icon">
            <i class="fas fa-building"></i>
          </div>
          <div class="alert__content">
            <div class="alert__title">{MESSAGES.FULL_ACCESS_TITLE}</div>
            <div class="alert__message">{MESSAGES.FULL_ACCESS_MESSAGE}</div>
          </div>
        </div>
      </div>

      <div class="form-field">
        <label class="form-field__label" for="root-position">
          Position <span class="text-red-500">*</span>
        </label>
        <!-- Custom Dropdown -->
        <div class="dropdown" id="position-dropdown">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div
            class="dropdown__trigger"
            class:active={positionDropdownOpen}
            onclick={togglePositionDropdown}
          >
            <span>{formPosition || MESSAGES.SELECT_POSITION}</span>
            <i class="fas fa-chevron-down"></i>
          </div>
          <div class="dropdown__menu" class:active={positionDropdownOpen}>
            {#each POSITION_OPTIONS as position (position)}
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <div class="dropdown__option" onclick={() => selectPosition(position)}>
                {position}
              </div>
            {/each}
          </div>
        </div>
      </div>

      <div class="form-field">
        <label class="form-field__label" for="root-notes">Notizen</label>
        <textarea
          id="root-notes"
          name="notes"
          class="form-field__control"
          rows="3"
          bind:value={formNotes}
        ></textarea>
      </div>

      {#if isEditMode}
        <div class="form-field" id="active-status-group">
          <label class="form-field__label" for="root-status">
            Status <span class="text-red-500">*</span>
          </label>
          <!-- Custom Dropdown -->
          <div class="dropdown" id="status-dropdown">
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
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
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <div class="dropdown__option" onclick={() => selectStatus(1)}>
                <span class="badge badge--success">Aktiv</span>
              </div>
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <div class="dropdown__option" onclick={() => selectStatus(0)}>
                <span class="badge badge--warning">Inaktiv</span>
              </div>
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <div class="dropdown__option" onclick={() => selectStatus(3)}>
                <span class="badge badge--error">Archiviert</span>
              </div>
            </div>
          </div>
          <span class="form-field__message text-[var(--color-text-secondary)] mt-1 block"
            >{MESSAGES.INACTIVE_HINT}</span
          >
        </div>
      {/if}
    </div>

    <div class="ds-modal__footer">
      <button type="button" class="btn btn-cancel" onclick={closeRootModal}>Abbrechen</button>
      <button type="submit" class="btn btn-modal" disabled={submitting}>
        {#if submitting}
          <span class="spinner-ring spinner-ring--sm mr-2"></span>
        {/if}
        Speichern
      </button>
    </div>
  </form>
</div>

<!-- Delete Modal Step 1: Initial Confirmation -->
<div
  id="delete-root-modal"
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
        aria-label="Modal schließen"
        onclick={closeDeleteModal}
      >
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="ds-modal__body">
      <p class="text-[var(--color-text-secondary)]">{MESSAGES.DELETE_CONFIRM}</p>
    </div>
    <div class="ds-modal__footer">
      <button type="button" class="btn btn-cancel" onclick={closeDeleteModal}>Abbrechen</button>
      <button type="button" class="btn btn-danger" onclick={proceedToDeleteConfirm}>Löschen</button>
    </div>
  </div>
</div>

<!-- Delete Modal Step 2: Final Dangerous Confirmation -->
<div
  id="delete-root-confirm-modal"
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
    <h3 class="confirm-modal__title" id="delete-confirm-title">{MESSAGES.DELETE_FINAL_TITLE}</h3>
    <p class="confirm-modal__message">
      <strong>ACHTUNG:</strong>
      {MESSAGES.DELETE_FINAL_WARNING}
      <br /><br />
      {MESSAGES.DELETE_FINAL_MESSAGE}
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
        onclick={deleteUser}
      >
        Endgültig löschen
      </button>
    </div>
  </div>
</div>
