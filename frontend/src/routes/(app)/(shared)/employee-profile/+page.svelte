<script lang="ts">
  /**
   * Employee Profile - Page Component
   * @module employee-profile/+page
   *
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   * Note: Personal info is readonly for employees (only password can be changed).
   */
  import { goto, invalidateAll } from '$app/navigation';

  import ImageCropModal from '$lib/components/ImageCropModal.svelte';
  import PasswordStrengthIndicator from '$lib/components/PasswordStrengthIndicator.svelte';
  import { e2e } from '$lib/crypto/e2e-state.svelte';
  import { resolvePositionDisplay } from '$lib/types/hierarchy-labels';
  import { getAvatarColorClass, getInitials } from '$lib/utils/avatar-helpers';
  import { analyzePassword } from '$lib/utils/password-strength';

  // Local modules
  import {
    loadProfilePicture as apiLoadProfilePicture,
    uploadProfilePicture,
    removeProfilePicture,
    changePassword as apiChangePassword,
    logoutAllSessions,
  } from './_lib/api';
  import {
    MESSAGES,
    PASSWORD_TOOLTIP,
    PASSWORD_RULES,
    READONLY_INFO_TEXT,
    PICTURE_UPLOAD_ERROR_MAP,
  } from './_lib/constants';
  import {
    showToast,
    triggerFileInput,
    isCurrentPasswordError,
    isPasswordLengthValid,
    doPasswordsMatch,
  } from './_lib/utils';

  import type { PageData } from './$types';
  import type { PasswordStrengthResult } from './_lib/types';

  // =============================================================================
  // SSR DATA - Level 3: $derived from props (single source of truth)
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // SSR data via $derived - updates when invalidateAll() is called
  const user = $derived(data.profile ?? null);
  const hierarchyLabels = $derived(data.hierarchyLabels);

  // Initialize form values from SSR data
  $effect(() => {
    if (user !== null) {
      formEmail = user.email;
      formFirstName = user.firstName ?? '';
      formLastName = user.lastName ?? '';
      formPosition =
        user.position !== undefined && user.position !== '' ?
          resolvePositionDisplay(user.position, hierarchyLabels)
        : '-';
      profilePicture = apiLoadProfilePicture(user.profilePicture);
    }
  });

  // =============================================================================
  // UI STATE - Client-side only
  // =============================================================================

  // Profile Form (readonly for display)
  let formEmail = $state('');
  let formFirstName = $state('');
  let formLastName = $state('');
  let formPosition = $state('');

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

  const avatarColorClass = $derived(getAvatarColorClass(user?.id));
  const initials = $derived(getInitials(user?.firstName, user?.lastName));
  const hasProfilePicture = $derived(profilePicture !== null && profilePicture !== '');
  const passwordsMatch = $derived(doPasswordsMatch(newPassword, confirmPassword));
  const isPasswordValid = $derived(isPasswordLengthValid(newPassword));

  // Tenant-wide gate from layout SSR (ADR-045): Root disables
  // `security.allow_user_password_change` → employees cannot rotate their
  // password. Backend UserProfileService is authoritative; this `{#if}`
  // wrap prevents employees from seeing a form that would 403 on submit.
  const canChangePassword = $derived(data.allowUserPasswordChange);

  // =============================================================================
  // PROFILE PICTURE ACTIONS
  // =============================================================================

  function getUploadErrorMessage(err: unknown): string {
    const code = err instanceof Error ? err.message : '';
    return PICTURE_UPLOAD_ERROR_MAP[code] ?? MESSAGES.pictureUploadError;
  }

  /**
   * Handle file selection - opens crop modal instead of direct upload
   */
  function handlePictureSelect(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const file = target.files?.[0];
    if (file === undefined) return;

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
      showToast(getUploadErrorMessage(err), 'error');
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
    // Simple confirmation dialog
    if (!window.confirm(MESSAGES.confirmRemovePicture)) return;

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

  /** Validate password form, returns true if valid */
  function validatePasswordForm(): boolean {
    currentPasswordError = false;
    newPasswordError = false;
    passwordMismatchError = false;

    if (!isPasswordValid) {
      newPasswordError = true;
      return false;
    }
    if (!passwordsMatch) {
      passwordMismatchError = true;
      return false;
    }
    return true;
  }

  /** Handle password change error */
  function handlePasswordChangeError(err: unknown): void {
    const msg = err instanceof Error ? err.message : '';
    if (isCurrentPasswordError(msg)) {
      currentPasswordError = true;
    } else {
      showToast(msg !== '' ? msg : MESSAGES.passwordChangeError, 'error');
    }
  }

  /** Reset form and schedule logout after successful password change */
  function onPasswordChangeSuccess(): void {
    showToast(MESSAGES.passwordChanged, 'success');

    currentPassword = '';
    newPassword = '';
    confirmPassword = '';
    passwordStrength = null;

    // SECURITY: Logout after 3s to force re-login with new password
    setTimeout(() => void performSecurityLogout(), 1500);
  }

  async function handleChangePassword(event: Event): Promise<void> {
    event.preventDefault();

    if (!validatePasswordForm()) return;

    // Capture values before async operations to avoid race conditions
    const currentPwd = currentPassword;
    const newPwd = newPassword;

    passwordSaving = true;

    try {
      await apiChangePassword({
        currentPassword: currentPwd,
        newPassword: newPwd,
        confirmPassword: newPwd,
      });
      // Re-encrypt escrow blob with new password before logout (ADR-022)
      void e2e.reEncryptEscrow(newPwd);
      onPasswordChangeSuccess();
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

<svelte:head>
  <title>Mein Profil - Assixx</title>
</svelte:head>

<div class="container">
  <div class="profile-container">
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

    <!-- Personal Information Card (readonly) -->
    <div class="profile-card">
      <h2 class="card-title">Persönliche Informationen</h2>

      <div class="alert alert--info alert--sm mb-6">
        <div class="alert__icon"><i class="fas fa-info-circle"></i></div>
        <div class="alert__content">
          <div class="alert__message">{READONLY_INFO_TEXT}</div>
        </div>
      </div>

      <form id="profile-form">
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
              class="form-field__control non-editable"
              value={formEmail}
              readonly
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
              name="first_name"
              class="form-field__control non-editable"
              value={formFirstName}
              readonly
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
              name="last_name"
              class="form-field__control non-editable"
              value={formLastName}
              readonly
            />
          </div>
          <div class="form-field">
            <label
              class="form-field__label"
              for="position">Position</label
            >
            <input
              type="text"
              id="position"
              name="position"
              class="form-field__control non-editable"
              value={formPosition}
              readonly
            />
          </div>
        </div>
      </form>
    </div>

    <!-- Password Change Card — gated by tenant policy (ADR-045). -->
    {#if canChangePassword}
      <div class="profile-card">
        <h2 class="card-title">Passwort ändern</h2>
        <form
          id="password-form"
          autocomplete="off"
          onsubmit={handleChangePassword}
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
                autocomplete="new-password"
                data-lpignore="true"
                data-1p-ignore
                data-form-type="other"
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
              <span class="form-field__message form-field__message--error">
                {MESSAGES.currentPasswordWrong}
              </span>
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
              <span class="form-field__message form-field__message--error">
                {MESSAGES.passwordRequirements}
              </span>
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
              <span class="form-field__message form-field__message--error">
                {MESSAGES.passwordMismatch}
              </span>
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
    {/if}
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
  /* ===== PROFILE PICTURE LAYOUT ===== */
  .profile-picture-section {
    display: flex;
    align-items: center;
    gap: var(--spacing-8);
    margin-bottom: var(--spacing-8);
  }

  /* Blue border ring around avatar (page-specific decoration) */
  .profile-picture-container {
    border: 3px solid oklch(64.49% 0.1953 252.39 / 30%);
    border-radius: 50%;
    background: transparent;
    padding: 3px;
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

  /* Non-editable fields styling */
  .non-editable {
    cursor: default;
    background: color-mix(in oklch, var(--color-white) 1%, transparent);
  }

  .non-editable:focus {
    box-shadow: none;
    border-color: color-mix(in oklch, var(--color-white) 10%, transparent);
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
