<script lang="ts">
  /**
   * Root Profile - Page Component
   * @module root-profile/+page
   *
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   */
  import { goto, invalidateAll } from '$app/navigation';

  import ImageCropModal from '$lib/components/ImageCropModal.svelte';
  import PasswordStrengthIndicator from '$lib/components/PasswordStrengthIndicator.svelte';
  import { e2e } from '$lib/crypto/e2e-state.svelte';
  import { getAvatarColorClass, getInitials } from '$lib/utils/avatar-helpers';
  import { analyzePassword } from '$lib/utils/password-strength';

  // Local modules
  import {
    loadProfilePicture as apiLoadProfilePicture,
    saveProfile as apiSaveProfile,
    uploadProfilePicture,
    removeProfilePicture,
    changePassword as apiChangePassword,
    logoutAllSessions,
  } from './_lib/api';
  import ApprovalSection from './_lib/ApprovalSection.svelte';
  import { MESSAGES, PASSWORD_TOOLTIP, PASSWORD_RULES } from './_lib/constants';
  import {
    showToast,
    triggerFileInput,
    isCurrentPasswordError,
    isPasswordLengthValid,
    doPasswordsMatch,
  } from './_lib/utils';

  import type { PageData } from './$types';
  import type { ApprovalItem, PasswordStrengthResult, UserProfile } from './_lib/types';

  // =============================================================================
  // SSR DATA - Level 3: $derived from props (single source of truth)
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // SSR data via $derived - updates when invalidateAll() is called
  // profile is guaranteed by server (redirect if missing)
  const user = $derived<UserProfile>(data.profile);
  const pendingApprovals = $derived<ApprovalItem[]>(data.pendingApprovals);

  // Initialize form values from SSR data (user guaranteed by server)
  $effect(() => {
    formEmail = user.email;
    formFirstName = user.firstName ?? '';
    formLastName = user.lastName ?? '';
    profilePicture = apiLoadProfilePicture(user.profilePicture);
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

  // Crop Modal State
  let showCropModal = $state(false);
  let cropImageSrc = $state<string | null>(null);

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

  const avatarColorClass = $derived(getAvatarColorClass(user.id));
  const initials = $derived(getInitials(user.firstName, user.lastName));
  const hasProfilePicture = $derived(profilePicture !== null && profilePicture !== '');
  const hasPendingApprovals = $derived(pendingApprovals.length > 0);
  const passwordsMatch = $derived(doPasswordsMatch(newPassword, confirmPassword));
  const isPasswordValid = $derived(isPasswordLengthValid(newPassword));

  // =============================================================================
  // FORM RESET HELPERS
  // =============================================================================

  /** Reset password form fields (extracted to avoid race condition warnings) */
  function resetPasswordForm(): void {
    currentPassword = '';
    newPassword = '';
    confirmPassword = '';
    passwordStrength = null;
  }

  // =============================================================================
  // PROFILE ACTIONS
  // =============================================================================

  async function saveProfile(event: Event): Promise<void> {
    event.preventDefault();
    profileSaving = true;

    try {
      await apiSaveProfile({
        email: formEmail,
        firstName: formFirstName,
        lastName: formLastName,
      });
      showToast(MESSAGES.profileSaved, 'success');
      // Level 3: Trigger SSR refetch - $derived(user) updates automatically
      await invalidateAll();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : MESSAGES.profileSaveError, 'error');
    } finally {
      profileSaving = false;
    }
  }

  /**
   * Handle file selection - opens crop modal instead of direct upload
   */
  function handlePictureSelect(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const file = target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast(MESSAGES.invalidImageType, 'error');
      target.value = '';
      return;
    }

    // Create object URL for cropping
    cropImageSrc = URL.createObjectURL(file);
    showCropModal = true;

    // Reset file input for next selection
    target.value = '';
  }

  /**
   * Handle cropped image save - uploads the cropped blob
   */
  async function handleCropSave(blob: Blob): Promise<void> {
    // Close modal immediately for better UX
    showCropModal = false;

    // Clean up object URL if it exists
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- explicit null check required for strict-boolean-expressions
    if (cropImageSrc !== null && cropImageSrc.startsWith('blob:')) {
      URL.revokeObjectURL(cropImageSrc);
    }
    cropImageSrc = null;

    pictureUploading = true;

    try {
      // Convert blob to File for upload
      const file = new File([blob], 'profile-picture.jpg', {
        type: 'image/jpeg',
      });
      const newUrl = await uploadProfilePicture(file);
      if (newUrl !== null) {
        profilePicture = newUrl;
        showToast(MESSAGES.pictureUpdated, 'success');
        // Trigger SSR refetch to update sidebar/header avatars
        await invalidateAll();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'INVALID_TYPE') showToast(MESSAGES.invalidImageType, 'error');
      else if (msg === 'FILE_TOO_LARGE') showToast(MESSAGES.fileTooLarge, 'error');
      else showToast(MESSAGES.pictureUploadError, 'error');
    } finally {
      pictureUploading = false;
    }
  }

  /**
   * Close crop modal and cleanup
   */
  function handleCropClose(): void {
    showCropModal = false;
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- explicit null check required for strict-boolean-expressions
    if (cropImageSrc !== null && cropImageSrc.startsWith('blob:')) {
      URL.revokeObjectURL(cropImageSrc);
    }
    cropImageSrc = null;
  }

  /**
   * Open crop modal with existing profile picture for re-cropping
   */
  function openCropModalForEdit(): void {
    if (profilePicture !== null) {
      cropImageSrc = profilePicture;
      showCropModal = true;
    }
  }

  async function removePicture(): Promise<void> {
    pictureUploading = true;
    try {
      await removeProfilePicture();
      profilePicture = null;
      showToast(MESSAGES.pictureRemoved, 'success');
      // Trigger SSR refetch to update sidebar/header avatars
      await invalidateAll();
    } catch {
      showToast(MESSAGES.pictureRemoveError, 'error');
    } finally {
      pictureUploading = false;
    }
  }

  // =============================================================================
  // PASSWORD ACTIONS
  // =============================================================================

  /** SECURITY: Force logout after password change to require re-login */
  async function performSecurityLogout(): Promise<void> {
    try {
      await logoutAllSessions();
    } catch {
      // Token revocation already happened server-side during password change
    }
    await e2e.lock();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('tokenReceivedAt');
    await goto('/login', { replaceState: true });
  }

  /** Handle password change API errors */
  function handlePasswordChangeError(err: unknown): void {
    const msg = err instanceof Error ? err.message : '';
    if (isCurrentPasswordError(msg)) {
      currentPasswordError = true;
    } else {
      showToast(msg !== '' ? msg : MESSAGES.passwordChangeError, 'error');
    }
  }

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

    // Capture values before async call to avoid race condition warnings
    const currentPwd = currentPassword;
    const newPwd = newPassword;

    try {
      await apiChangePassword({
        currentPassword: currentPwd,
        newPassword: newPwd,
        confirmPassword: newPwd,
      });
      // Re-encrypt escrow blob with new password before logout (ADR-022)
      void e2e.reEncryptEscrow(newPwd);
      resetPasswordForm();
      showToast(MESSAGES.passwordChanged, 'success');

      // SECURITY: Logout after 3s to force re-login with new password
      setTimeout(() => void performSecurityLogout(), 1500);
    } catch (err: unknown) {
      handlePasswordChangeError(err);
    } finally {
      passwordSaving = false;
    }
  }

  async function checkPassword(): Promise<void> {
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

  function validateConfirmPassword(): void {
    if (confirmPassword === '') {
      passwordMismatchError = false;
      return;
    }
    passwordMismatchError = !passwordsMatch;
  }

  async function handleNewPasswordInput(): Promise<void> {
    await checkPassword();
    validateConfirmPassword();
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
      <ApprovalSection approvals={pendingApprovals} />
    {/if}

    <!-- Profile Picture Card -->
    <div class="profile-card">
      <h2 class="card-title">Profilbild</h2>
      <div class="profile-picture-section">
        {#if hasProfilePicture}
          <div class="avatar avatar--xxl">
            <img
              src={profilePicture}
              alt="Profilbild"
              class="avatar__image"
            />
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
            onchange={handlePictureSelect}
          />
          <button
            type="button"
            class="btn btn-primary"
            onclick={() => {
              triggerFileInput('profile-picture-input');
            }}
            disabled={pictureUploading}
          >
            {#if pictureUploading}<span class="spinner-ring spinner-ring--sm"></span>{:else}<i
                class="fas fa-camera"
              ></i>{/if}
            Bild ändern
          </button>
          {#if hasProfilePicture}
            <button
              type="button"
              class="btn btn-edit"
              onclick={openCropModalForEdit}
              disabled={pictureUploading}
            >
              <i class="fas fa-crop-alt"></i> Bearbeiten
            </button>
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
      <form
        id="profile-form"
        onsubmit={saveProfile}
      >
        <div class="form-grid">
          <div class="form-field">
            <label
              class="form-field__label"
              for="email">E-Mail</label
            >
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
            <label
              class="form-field__label"
              for="first_name">Vorname</label
            >
            <input
              type="text"
              id="first_name"
              name="firstName"
              class="form-field__control"
              bind:value={formFirstName}
            />
          </div>
          <div class="form-field">
            <label
              class="form-field__label"
              for="last_name">Nachname</label
            >
            <input
              type="text"
              id="last_name"
              name="lastName"
              class="form-field__control"
              bind:value={formLastName}
            />
          </div>
        </div>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={profileSaving}
        >
          {#if profileSaving}<span class="spinner-ring spinner-ring--sm"></span>{:else}<i
              class="fas fa-save"
            ></i>{/if}
          Änderungen speichern
        </button>
      </form>
    </div>

    <!-- Password Change Card -->
    <div class="profile-card">
      <h2 class="card-title">Passwort ändern</h2>
      <form
        id="password-form"
        autocomplete="off"
        onsubmit={changePassword}
      >
        <!-- Current Password -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="current_password">Aktuelles Passwort</label
          >
          <div class="form-field__password-wrapper">
            <input
              type={showCurrentPassword ? 'text' : 'password'}
              id="current_password"
              name="current_password"
              class="form-field__control"
              class:is-error={currentPasswordError}
              autocomplete="current-password"
              bind:value={currentPassword}
              required
            />
            <button
              type="button"
              class="form-field__password-toggle"
              aria-label="Passwort anzeigen"
              onclick={() => {
                togglePasswordVisibility('current');
              }}
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
          <label
            class="form-field__label"
            for="new_password"
          >
            Neues Passwort
            <span class="tooltip ml-1">
              <i class="fas fa-info-circle"></i>
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
              class:is-error={newPasswordError}
              autocomplete="new-password"
              minlength="12"
              maxlength="72"
              bind:value={newPassword}
              oninput={handleNewPasswordInput}
              required
            />
            <button
              type="button"
              class="form-field__password-toggle"
              aria-label="Passwort anzeigen"
              onclick={() => {
                togglePasswordVisibility('new');
              }}
            >
              <i class="fas {showNewPassword ? 'fa-eye-slash' : 'fa-eye'}"></i>
            </button>
          </div>

          {#if passwordStrength !== null || strengthLoading}
            <PasswordStrengthIndicator
              score={passwordStrength?.score ?? -1}
              label={passwordStrength?.label ?? ''}
              crackTime={passwordStrength?.crackTime ?? ''}
              loading={strengthLoading}
              feedback={passwordStrength?.feedback ?? null}
            />
          {/if}

          {#if newPasswordError}
            <span class="form-field__message form-field__message--error"
              >{MESSAGES.passwordRequirements}</span
            >
          {/if}
        </div>

        <!-- Confirm Password -->
        <div
          class="form-field"
          class:is-success={confirmPassword !== '' && passwordsMatch}
        >
          <label
            class="form-field__label"
            for="confirm_password">Neues Passwort bestätigen</label
          >
          <div class="form-field__password-wrapper">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              id="confirm_password"
              name="confirm_password"
              class="form-field__control"
              class:is-error={passwordMismatchError}
              class:is-success={confirmPassword !== '' && passwordsMatch}
              autocomplete="new-password"
              minlength="12"
              maxlength="72"
              bind:value={confirmPassword}
              oninput={validateConfirmPassword}
              required
            />
            <button
              type="button"
              class="form-field__password-toggle"
              aria-label="Passwort anzeigen"
              onclick={() => {
                togglePasswordVisibility('confirm');
              }}
            >
              <i class="fas {showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}"></i>
            </button>
          </div>
          {#if passwordMismatchError}
            <span class="form-field__message form-field__message--error"
              >{MESSAGES.passwordMismatch}</span
            >
          {:else if confirmPassword !== '' && passwordsMatch}
            <span class="form-field__message form-field__message--success">
              <i class="fas fa-check"></i> Passwörter stimmen überein
            </span>
          {/if}
        </div>

        <button
          type="submit"
          class="btn btn-primary"
          disabled={passwordSaving}
        >
          {#if passwordSaving}<span class="spinner-ring spinner-ring--sm"></span>{:else}<i
              class="fas fa-key"
            ></i>{/if}
          Passwort ändern
        </button>
      </form>
    </div>
  </div>
</div>

<!-- Image Crop Modal -->
<ImageCropModal
  show={showCropModal}
  imageSrc={cropImageSrc}
  onclose={handleCropClose}
  onsave={handleCropSave}
/>

<style>
  /* Root Profile - Page-Specific Styles */
  /* Design System provides: Cards, Avatar, Forms, Buttons */
  /* This file only contains page-specific layout */

  /* ===== CONTAINER WIDTH ===== */
  .profile-card {
    margin-right: auto;
    margin-left: auto;
    max-width: 800px;
  }

  /* ===== PROFILE PICTURE LAYOUT ===== */
  .profile-picture-section {
    display: flex;
    align-items: center;
    gap: var(--spacing-8);
    margin-bottom: var(--spacing-8);
  }

  /* Button stack (vertical layout) */
  .profile-picture-actions {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  /* ===== FORM LAYOUT ===== */
  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--spacing-6);
    margin-bottom: var(--spacing-6);
  }

  /* ===== RESPONSIVE ===== */
  @media (width < 768px) {
    .profile-picture-section {
      flex-direction: column;
      text-align: center;
    }

    .form-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
