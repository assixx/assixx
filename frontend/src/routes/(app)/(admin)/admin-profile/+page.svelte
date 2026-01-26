<script lang="ts">
  /**
   * Admin Profile - Page Component
   * @module admin-profile/+page
   *
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   * Note: Personal info is readonly for admins (only password can be changed).
   */
  import { goto, invalidateAll } from '$app/navigation';

  import ImageCropModal from '$lib/components/ImageCropModal.svelte';
  import { getAvatarColorClass, getInitials } from '$lib/utils/avatar-helpers';
  import { analyzePassword } from '$lib/utils/password-strength';

  // Page-specific CSS
  import '../../../../styles/admin-profile.css';
  import '../../../../styles/password-strength.css';

  // Local modules
  import {
    loadProfilePicture as apiLoadProfilePicture,
    uploadProfilePicture,
    removeProfilePicture,
    changePassword as apiChangePassword,
  } from './_lib/api';
  import { MESSAGES, PASSWORD_TOOLTIP, PASSWORD_RULES, READONLY_INFO_TEXT } from './_lib/constants';
  import {
    showToast,
    triggerFileInput,
    isCurrentPasswordError,
    isPasswordLengthValid,
    doPasswordsMatch,
    getDisplayPosition,
    getDisplayCompany,
  } from './_lib/utils';

  import type { PageData } from './$types';
  import type { AdminProfile, PasswordStrengthResult } from './_lib/types';

  // =============================================================================
  // SSR DATA - Level 3: $derived from props (single source of truth)
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // SSR data via $derived - updates when invalidateAll() is called
  const user = $derived<AdminProfile | null>(data.profile ?? null);

  // Tenant company name from SSR (from tenant_id, not user profile)
  const tenantCompanyName = $derived<string | null>(data.tenantCompanyName ?? null);

  // Initialize form values from SSR data
  $effect(() => {
    if (user !== null) {
      formEmail = user.email;
      formFirstName = user.firstName ?? '';
      formLastName = user.lastName ?? '';
      formPosition = getDisplayPosition(user.position);
      // Company name comes from TENANT, not user profile
      formCompany = getDisplayCompany(tenantCompanyName ?? undefined);
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
  let formCompany = $state('');

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

  // =============================================================================
  // PROFILE PICTURE ACTIONS
  // =============================================================================

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
      const file = new File([blob], 'profile-picture.jpg', { type: 'image/jpeg' });
      const newUrl = await uploadProfilePicture(file);
      if (newUrl !== null) {
        profilePicture = newUrl;
        showToast(MESSAGES.pictureUpdated, 'success');
        // Trigger SSR refetch to update sidebar/header avatars
        await invalidateAll();
      }
    } catch (err) {
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

  async function handleChangePassword(event: Event): Promise<void> {
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
      showToast(MESSAGES.passwordChanged, 'success');

      // Reset form - using direct assignment (not based on previous values)
      /* eslint-disable require-atomic-updates */
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
      /* eslint-enable require-atomic-updates */
      passwordStrength = null;

      // Logout after 2 seconds (password changed = security logout)
      setTimeout(() => {
        localStorage.removeItem('accessToken');
        void goto('/login', { replaceState: true });
      }, 2000);
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
            onchange={handlePictureSelect}
          />
          <button
            type="button"
            class="btn btn-modal"
            onclick={() => {
              triggerFileInput('profile-picture-input');
            }}
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

      <div class="info-box">
        <i class="fas fa-info-circle"></i>
        {READONLY_INFO_TEXT}
      </div>

      <form id="profile-form">
        <div class="form-grid">
          <div class="form-field">
            <label class="form-field__label" for="email">E-Mail</label>
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
            <label class="form-field__label" for="first_name">Vorname</label>
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
            <label class="form-field__label" for="last_name">Nachname</label>
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
            <label class="form-field__label" for="position">Position</label>
            <input
              type="text"
              id="position"
              name="position"
              class="form-field__control non-editable"
              value={formPosition}
              readonly
            />
          </div>
          <div class="form-field">
            <label class="form-field__label" for="company">Firma</label>
            <input
              type="text"
              id="company"
              name="company"
              class="form-field__control non-editable"
              value={formCompany}
              readonly
            />
          </div>
        </div>
      </form>
    </div>

    <!-- Password Change Card -->
    <div class="profile-card">
      <h2 class="card-title">Passwort ändern</h2>
      <form id="password-form" autocomplete="off" onsubmit={handleChangePassword}>
        <!-- Current Password -->
        <div class="form-field">
          <label class="form-field__label" for="current_password">Aktuelles Passwort</label>
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
            <span class="form-field__message form-field__message--error">
              {MESSAGES.currentPasswordWrong}
            </span>
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
            <div class="password-strength-container" class:is-loading={strengthLoading}>
              <div class="password-strength-meter">
                <div class="password-strength-bar" data-score={passwordStrength?.score ?? -1}></div>
              </div>
              {#if passwordStrength !== null}
                <div class="password-strength-info">
                  <span class="password-strength-label">{passwordStrength.label}</span>
                  <span class="password-strength-time">{passwordStrength.crackTime}</span>
                </div>
              {/if}
            </div>
          {/if}

          {#if newPasswordError}
            <span class="form-field__message form-field__message--error">
              {MESSAGES.passwordRequirements}
            </span>
          {/if}

          {#if passwordStrength !== null}
            {@const warningText = passwordStrength.feedback.warning}
            {@const suggestions = passwordStrength.feedback.suggestions}
            {#if warningText !== '' || suggestions.length > 0}
              <div class="password-feedback">
                {#if warningText !== ''}
                  <span class="password-feedback-warning">{warningText}</span>
                {/if}
                {#if suggestions.length > 0}
                  <ul class="password-feedback-suggestions">
                    {#each suggestions as suggestion, i (i)}
                      <li>{suggestion}</li>
                    {/each}
                  </ul>
                {/if}
              </div>
            {/if}
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
              class:is-error={passwordMismatchError}
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

<!-- Image Crop Modal -->
<ImageCropModal
  show={showCropModal}
  imageSrc={cropImageSrc}
  onclose={handleCropClose}
  onsave={handleCropSave}
/>
