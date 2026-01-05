<script lang="ts">
  /**
   * Root Profile - Page Component
   * @module root-profile/+page
   *
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   */
  import { invalidateAll } from '$app/navigation';
  import { analyzePassword } from '$lib/utils/password-strength';
  import { getAvatarColorClass, getInitials } from '$lib/utils/avatar-helpers';
  import type { PageData } from './$types';

  // Page-specific CSS
  import '../../../styles/root-profile.css';
  import '../../../styles/password-strength.css';

  // Local modules
  import { MESSAGES, PASSWORD_TOOLTIP, PASSWORD_RULES } from './_lib/constants';
  import {
    loadProfilePicture as apiLoadProfilePicture,
    saveProfile as apiSaveProfile,
    uploadProfilePicture,
    removeProfilePicture,
    changePassword as apiChangePassword,
    approveRequest as apiApproveRequest,
    rejectRequest as apiRejectRequest,
  } from './_lib/api';
  import {
    formatDate,
    showToast,
    triggerFileInput,
    isCurrentPasswordError,
    isPasswordLengthValid,
    doPasswordsMatch,
  } from './_lib/utils';
  import type { UserProfile, ApprovalItem, PasswordStrengthResult } from './_lib/types';

  // =============================================================================
  // SSR DATA - Level 3: $derived from props (single source of truth)
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // SSR data via $derived - updates when invalidateAll() is called
  const user = $derived<UserProfile | null>(data?.profile ?? null);
  const pendingApprovals = $derived<ApprovalItem[]>(data?.pendingApprovals ?? []);

  // Initialize form values from SSR data
  $effect(() => {
    if (user) {
      formEmail = user.email ?? '';
      formFirstName = user.firstName ?? '';
      formLastName = user.lastName ?? '';
      profilePicture = apiLoadProfilePicture(user.profilePicture);
    }
  });

  // =============================================================================
  // UI STATE - Client-side only
  // =============================================================================

  // Profile Form
  let formEmail = $state('');
  let formFirstName = $state('');
  let formLastName = $state('');
  let profileSaving = $state(false);

  // Profile Picture
  let profilePicture = $state<string | null>(null);
  let pictureUploading = $state(false);

  // Password Form
  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let passwordSaving = $state(false);
  let showCurrentPassword = $state(false);
  let showNewPassword = $state(false);
  let showConfirmPassword = $state(false);

  // Password Strength
  let passwordStrength = $state<PasswordStrengthResult | null>(null);
  let strengthLoading = $state(false);

  // Password Errors
  let currentPasswordError = $state(false);
  let newPasswordError = $state(false);
  let passwordMismatchError = $state(false);

  // =============================================================================
  // DERIVED STATE
  // =============================================================================

  const avatarColorClass = $derived(getAvatarColorClass(user?.id));
  const initials = $derived(getInitials(user?.firstName, user?.lastName));
  const hasProfilePicture = $derived(profilePicture !== null && profilePicture !== '');
  const hasPendingApprovals = $derived(pendingApprovals.length > 0);
  const passwordsMatch = $derived(doPasswordsMatch(newPassword, confirmPassword));
  const isPasswordValid = $derived(isPasswordLengthValid(newPassword));

  // =============================================================================
  // PROFILE ACTIONS
  // =============================================================================

  async function saveProfile(event: Event): Promise<void> {
    event.preventDefault();
    profileSaving = true;

    try {
      await apiSaveProfile({ email: formEmail, firstName: formFirstName, lastName: formLastName });
      showToast(MESSAGES.profileSaved, 'success');
      // Level 3: Trigger SSR refetch - $derived(user) updates automatically
      await invalidateAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : MESSAGES.profileSaveError, 'error');
    } finally {
      profileSaving = false;
    }
  }

  async function handlePictureUpload(event: Event): Promise<void> {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const file = target.files?.[0];
    if (!file) return;

    pictureUploading = true;

    try {
      const newUrl = await uploadProfilePicture(file);
      if (newUrl) {
        profilePicture = newUrl;
        showToast(MESSAGES.pictureUpdated, 'success');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'INVALID_TYPE') showToast(MESSAGES.invalidImageType, 'error');
      else if (msg === 'FILE_TOO_LARGE') showToast(MESSAGES.fileTooLarge, 'error');
      else showToast(MESSAGES.pictureUploadError, 'error');
    } finally {
      pictureUploading = false;
      target.value = '';
    }
  }

  async function removePicture() {
    pictureUploading = true;
    try {
      await removeProfilePicture();
      profilePicture = null;
      showToast(MESSAGES.pictureRemoved, 'success');
    } catch {
      showToast(MESSAGES.pictureRemoveError, 'error');
    } finally {
      pictureUploading = false;
    }
  }

  // =============================================================================
  // PASSWORD ACTIONS
  // =============================================================================

  async function changePassword(event: Event): Promise<void> {
    event.preventDefault();
    currentPasswordError = false;
    newPasswordError = false;
    passwordMismatchError = false;

    if (!isPasswordValid) {
      newPasswordError = true;
      return;
    }
    if (!passwordsMatch) {
      passwordMismatchError = true;
      return;
    }

    passwordSaving = true;

    try {
      await apiChangePassword({ currentPassword, newPassword });
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
      passwordStrength = null;
      showToast(MESSAGES.passwordChanged, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (isCurrentPasswordError(msg)) {
        currentPasswordError = true;
      } else {
        showToast(msg || MESSAGES.passwordChangeError, 'error');
      }
    } finally {
      passwordSaving = false;
    }
  }

  async function checkPassword() {
    if (newPassword.length < PASSWORD_RULES.minStrengthCheck) {
      passwordStrength = null;
      return;
    }

    strengthLoading = true;
    try {
      const userInputs = [formEmail, formFirstName, formLastName].filter(Boolean);
      passwordStrength = await analyzePassword(newPassword, userInputs);
    } catch {
      // Ignore strength check errors
    } finally {
      strengthLoading = false;
    }
  }

  // =============================================================================
  // APPROVAL ACTIONS - Level 3: invalidateAll() after mutations
  // =============================================================================

  async function approveRequest(id: number): Promise<void> {
    try {
      await apiApproveRequest(id);
      showToast(MESSAGES.approvalApproved, 'success');
      await invalidateAll();
    } catch {
      showToast(MESSAGES.approvalError, 'error');
    }
  }

  async function rejectRequest(id: number): Promise<void> {
    try {
      await apiRejectRequest(id);
      showToast(MESSAGES.approvalRejected, 'info');
      await invalidateAll();
    } catch {
      showToast(MESSAGES.rejectError, 'error');
    }
  }

  // =============================================================================
  // UI HELPERS
  // =============================================================================

  function togglePasswordVisibility(field: 'current' | 'new' | 'confirm'): void {
    if (field === 'current') showCurrentPassword = !showCurrentPassword;
    if (field === 'new') showNewPassword = !showNewPassword;
    if (field === 'confirm') showConfirmPassword = !showConfirmPassword;
  }
</script>

<div class="container">
  <div class="profile-container">
    <!-- Pending Approvals Section -->
    {#if hasPendingApprovals}
      <div class="approval-section">
        <div class="approval-header">
          <i class="fas fa-hourglass-half"></i>
          <div>
            <h3>Ausstehende Löschgenehmigungen</h3>
            <p>Diese Löschanfragen warten auf Ihre Genehmigung</p>
          </div>
        </div>
        <div class="approval-list">
          {#each pendingApprovals as approval (approval.id)}
            <div class="approval-item">
              <div class="approval-item-header">
                <div class="approval-item-info">
                  <strong>{approval.tenantName}</strong>
                  <span class="approval-status pending">{MESSAGES.pendingStatus}</span>
                  <p>Angefragt von: {approval.requestedBy}</p>
                  <p>Datum: {formatDate(approval.requestedAt)}</p>
                </div>
                <div class="approval-item-actions">
                  {#if approval.coolingOffComplete}
                    <button
                      type="button"
                      class="btn btn-success btn-sm"
                      onclick={() => approveRequest(approval.id)}
                    >
                      <i class="fas fa-check"></i> Genehmigen
                    </button>
                  {/if}
                  <button
                    type="button"
                    class="btn btn-danger btn-sm"
                    onclick={() => rejectRequest(approval.id)}
                  >
                    <i class="fas fa-times"></i> Ablehnen
                  </button>
                </div>
              </div>
              {#if !approval.coolingOffComplete && approval.coolingOffEndsAt}
                <div class="cooling-off-warning">
                  <i class="fas fa-clock"></i>
                  <span>Wartezeit endet am: {formatDate(approval.coolingOffEndsAt)}</span>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Profile Picture Card -->
    <div class="profile-card">
      <h2 class="card-title">Profilbild</h2>
      <div class="profile-picture-section">
        {#if hasProfilePicture}
          <div class="avatar avatar--xxl">
            <img src={profilePicture} alt="Profilbild" class="avatar__image" />
          </div>
        {:else}
          <div class="avatar avatar--xxl {avatarColorClass}">
            <span class="avatar__initials">{initials}</span>
          </div>
        {/if}

        <div class="profile-picture-actions">
          <input
            type="file"
            id="profile-picture-input"
            accept="image/*"
            class="u-hidden"
            onchange={handlePictureUpload}
          />
          <button
            type="button"
            class="btn btn-modal"
            onclick={() => triggerFileInput('profile-picture-input')}
            disabled={pictureUploading}
          >
            {#if pictureUploading}<i class="fas fa-spinner fa-spin"></i>{:else}<i
                class="fas fa-camera"
              ></i>{/if}
            Bild ändern
          </button>
          {#if hasProfilePicture}
            <button
              type="button"
              class="btn btn-cancel"
              onclick={removePicture}
              disabled={pictureUploading}
            >
              <i class="fas fa-trash"></i> Bild entfernen
            </button>
          {/if}
        </div>
      </div>
    </div>

    <!-- Personal Information Card -->
    <div class="profile-card">
      <h2 class="card-title">Persönliche Informationen</h2>
      <form id="profile-form" onsubmit={saveProfile}>
        <div class="form-grid">
          <div class="form-field">
            <label class="form-field__label" for="email">E-Mail</label>
            <input
              type="email"
              id="email"
              name="email"
              class="form-field__control"
              bind:value={formEmail}
              required
            />
          </div>
          <div class="form-field">
            <label class="form-field__label" for="first_name">Vorname</label>
            <input
              type="text"
              id="first_name"
              name="firstName"
              class="form-field__control"
              bind:value={formFirstName}
            />
          </div>
          <div class="form-field">
            <label class="form-field__label" for="last_name">Nachname</label>
            <input
              type="text"
              id="last_name"
              name="lastName"
              class="form-field__control"
              bind:value={formLastName}
            />
          </div>
        </div>
        <button type="submit" class="btn btn-modal" disabled={profileSaving}>
          {#if profileSaving}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas fa-save"
            ></i>{/if}
          Änderungen speichern
        </button>
      </form>
    </div>

    <!-- Password Change Card -->
    <div class="profile-card">
      <h2 class="card-title">Passwort ändern</h2>
      <form id="password-form" autocomplete="off" onsubmit={changePassword}>
        <!-- Current Password -->
        <div class="form-field">
          <label class="form-field__label" for="current_password">Aktuelles Passwort</label>
          <div class="form-field__password-wrapper">
            <input
              type={showCurrentPassword ? 'text' : 'password'}
              id="current_password"
              name="current_password"
              class="form-field__control"
              class:form-field__control--error={currentPasswordError}
              autocomplete="current-password"
              bind:value={currentPassword}
              required
            />
            <button
              type="button"
              class="form-field__password-toggle"
              aria-label="Passwort anzeigen"
              onclick={() => togglePasswordVisibility('current')}
            >
              <i class="fas {showCurrentPassword ? 'fa-eye-slash' : 'fa-eye'}"></i>
            </button>
          </div>
          {#if currentPasswordError}
            <span class="form-field__message form-field__message--error"
              >{MESSAGES.currentPasswordWrong}</span
            >
          {/if}
        </div>

        <!-- New Password -->
        <div class="form-field">
          <label class="form-field__label" for="new_password">
            Neues Passwort
            <span class="tooltip ml-1">
              <i class="fas fa-info-circle text-blue-400 text-sm cursor-help"></i>
              <span
                class="tooltip__content tooltip__content--info tooltip__content--right"
                role="tooltip">{PASSWORD_TOOLTIP}</span
              >
            </span>
          </label>
          <div class="form-field__password-wrapper">
            <input
              type={showNewPassword ? 'text' : 'password'}
              id="new_password"
              name="new_password"
              class="form-field__control"
              class:form-field__control--error={newPasswordError}
              autocomplete="new-password"
              minlength="12"
              maxlength="72"
              bind:value={newPassword}
              oninput={checkPassword}
              required
            />
            <button
              type="button"
              class="form-field__password-toggle"
              aria-label="Passwort anzeigen"
              onclick={() => togglePasswordVisibility('new')}
            >
              <i class="fas {showNewPassword ? 'fa-eye-slash' : 'fa-eye'}"></i>
            </button>
          </div>

          {#if passwordStrength || strengthLoading}
            <div class="password-strength-container" class:is-loading={strengthLoading}>
              <div class="password-strength-meter">
                <div class="password-strength-bar" data-score={passwordStrength?.score ?? -1}></div>
              </div>
              {#if passwordStrength}
                <div class="password-strength-info">
                  <span class="password-strength-label">{passwordStrength.label}</span>
                  <span class="password-strength-time">{passwordStrength.crackTime}</span>
                </div>
              {/if}
            </div>
          {/if}

          {#if newPasswordError}
            <span class="form-field__message form-field__message--error"
              >{MESSAGES.passwordRequirements}</span
            >
          {/if}

          {#if passwordStrength?.feedback.warning || (passwordStrength?.feedback.suggestions && passwordStrength.feedback.suggestions.length > 0)}
            <div class="password-feedback">
              {#if passwordStrength.feedback.warning}
                <span class="password-feedback-warning">{passwordStrength.feedback.warning}</span>
              {/if}
              {#if passwordStrength.feedback.suggestions && passwordStrength.feedback.suggestions.length > 0}
                <ul class="password-feedback-suggestions">
                  {#each passwordStrength.feedback.suggestions as suggestion, i (i)}
                    <li>{suggestion}</li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Confirm Password -->
        <div class="form-field">
          <label class="form-field__label" for="confirm_password">Neues Passwort bestätigen</label>
          <div class="form-field__password-wrapper">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              id="confirm_password"
              name="confirm_password"
              class="form-field__control"
              class:form-field__control--error={passwordMismatchError}
              autocomplete="new-password"
              minlength="12"
              maxlength="72"
              bind:value={confirmPassword}
              required
            />
            <button
              type="button"
              class="form-field__password-toggle"
              aria-label="Passwort anzeigen"
              onclick={() => togglePasswordVisibility('confirm')}
            >
              <i class="fas {showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}"></i>
            </button>
          </div>
          {#if passwordMismatchError}
            <span class="form-field__message form-field__message--error"
              >{MESSAGES.passwordMismatch}</span
            >
          {/if}
        </div>

        <button type="submit" class="btn btn-modal" disabled={passwordSaving}>
          {#if passwordSaving}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas fa-key"
            ></i>{/if}
          Passwort ändern
        </button>
      </form>
    </div>
  </div>
</div>
