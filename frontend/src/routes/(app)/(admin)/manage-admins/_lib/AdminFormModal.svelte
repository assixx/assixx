<script lang="ts">
  import PasswordStrengthIndicator from '$lib/components/PasswordStrengthIndicator.svelte';

  import AdminOrganizationSection from './AdminOrganizationSection.svelte';
  import { POSITION_OPTIONS, MESSAGES, type AdminMessages } from './constants';
  import { calculatePasswordStrength } from './utils';

  import type { Area, Department, FormIsActiveStatus } from './types';

  // =============================================================================
  // PROPS
  // =============================================================================

  interface Props {
    show: boolean;
    isEditMode: boolean;
    modalTitle: string;
    allAreas: Area[];
    allDepartments: Department[];
    submitting: boolean;
    messages?: AdminMessages;
    // Form fields (bindable)
    formFirstName: string;
    formLastName: string;
    formEmail: string;
    formEmailConfirm: string;
    formPassword: string;
    formPasswordConfirm: string;
    formEmployeeNumber: string;
    formPosition: string;
    formNotes: string;
    formIsActive: FormIsActiveStatus;
    formHasFullAccess: boolean;
    formAreaIds: number[];
    formDepartmentIds: number[];
    // Callbacks
    onclose: () => void;
    onsubmit: (e: Event) => void;
    onupgrade?: () => void;
    ondowngrade?: () => void;
  }

  /* eslint-disable prefer-const, @typescript-eslint/no-useless-default-assignment -- Svelte $bindable() requires let and is not a useless default */
  // prettier-ignore
  let { show, isEditMode, modalTitle, allAreas, allDepartments, submitting, messages: msg = MESSAGES, formFirstName = $bindable(), formLastName = $bindable(), formEmail = $bindable(), formEmailConfirm = $bindable(), formPassword = $bindable(), formPasswordConfirm = $bindable(), formEmployeeNumber = $bindable(), formPosition = $bindable(), formNotes = $bindable(), formIsActive = $bindable(), formHasFullAccess = $bindable(), formAreaIds = $bindable(), formDepartmentIds = $bindable(), onclose, onsubmit, onupgrade, ondowngrade }: Props = $props();
  /* eslint-enable prefer-const, @typescript-eslint/no-useless-default-assignment */

  // =============================================================================
  // LOCAL STATE
  // =============================================================================

  let positionDropdownOpen = $state(false);
  let showPassword = $state(false);
  let showPasswordConfirm = $state(false);
  let emailError = $state(false);
  let passwordError = $state(false);
  let passwordScore = $state(-1);
  let passwordLabel = $state('');
  let passwordTime = $state('');

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const passwordMatch = $derived(
    formPassword !== '' &&
      formPasswordConfirm !== '' &&
      formPassword === formPasswordConfirm,
  );

  // =============================================================================
  // HANDLERS
  // =============================================================================

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }

  function togglePositionDropdown(e: MouseEvent) {
    e.stopPropagation();
    positionDropdownOpen = !positionDropdownOpen;
  }

  function selectPosition(position: string) {
    formPosition = position;
    positionDropdownOpen = false;
  }

  function validateEmails() {
    emailError =
      formEmailConfirm !== '' ? formEmail !== formEmailConfirm : false;
  }

  function validatePasswords() {
    passwordError =
      formPasswordConfirm !== '' ? formPassword !== formPasswordConfirm : false;
  }

  function updatePasswordStrength() {
    const result = calculatePasswordStrength(formPassword);
    passwordScore = result.score;
    passwordLabel = result.label;
    passwordTime = result.crackTime;
  }

  // =============================================================================
  // EFFECTS
  // =============================================================================

  // Reset local UI state when modal opens
  $effect(() => {
    if (show) {
      positionDropdownOpen = false;
      showPassword = false;
      showPasswordConfirm = false;
      emailError = false;
      passwordError = false;
      passwordScore = -1;
      passwordLabel = '';
      passwordTime = '';
    }
  });

  // Outside click handler for position dropdown
  $effect(() => {
    if (positionDropdownOpen) {
      const handleOutsideClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const el = document.getElementById('position-dropdown');
        if (el && !el.contains(target)) positionDropdownOpen = false;
      };
      document.addEventListener('click', handleOutsideClick, true);
      return () => {
        document.removeEventListener('click', handleOutsideClick, true);
      };
    }
  });
</script>

{#if show}
  <div
    id="admin-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="admin-modal-title"
    tabindex="-1"
    onclick={handleOverlayClick}
    onkeydown={(e) => {
      if (e.key === 'Escape') onclose();
    }}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <form
      id="admin-form"
      class="ds-modal"
      onclick={(e) => {
        e.stopPropagation();
      }}
      onkeydown={(e) => {
        e.stopPropagation();
      }}
      {onsubmit}
    >
      <div class="ds-modal__header">
        <h3
          class="ds-modal__title"
          id="admin-modal-title"
        >
          {modalTitle}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schließen"
          onclick={onclose}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body">
        <div class="form-field">
          <label
            class="form-field__label"
            for="admin-first-name"
          >
            {MESSAGES.LABEL_FIRST_NAME} <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="admin-first-name"
            name="firstName"
            class="form-field__control"
            required
            bind:value={formFirstName}
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="admin-last-name"
          >
            {MESSAGES.LABEL_LAST_NAME} <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="admin-last-name"
            name="lastName"
            class="form-field__control"
            required
            bind:value={formLastName}
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="admin-email"
          >
            {MESSAGES.LABEL_EMAIL} <span class="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="admin-email"
            name="email"
            class="form-field__control"
            class:is-error={emailError}
            required
            bind:value={formEmail}
            oninput={validateEmails}
          />
        </div>

        <div
          class="form-field"
          id="email-confirm-group"
        >
          <label
            class="form-field__label"
            for="admin-email-confirm"
          >
            {MESSAGES.LABEL_EMAIL_CONFIRM} <span class="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="admin-email-confirm"
            name="emailConfirm"
            class="form-field__control"
            class:is-error={emailError}
            required
            bind:value={formEmailConfirm}
            oninput={validateEmails}
          />
          {#if emailError}
            <span class="form-field__message form-field__message--error"
              >{MESSAGES.ERROR_EMAIL_MISMATCH}</span
            >
          {/if}
        </div>

        <div
          class="form-field"
          id="password-group"
        >
          <label
            class="form-field__label"
            for="admin-password"
          >
            {MESSAGES.LABEL_PASSWORD}
            {#if !isEditMode}<span class="text-red-500">*</span>{/if}
            <span class="tooltip ml-1">
              <i class="fas fa-info-circle"></i>
              <span
                class="tooltip__content tooltip__content--info tooltip__content--right"
                role="tooltip"
              >
                {MESSAGES.HINT_PASSWORD}
              </span>
            </span>
          </label>
          <div class="form-field__password-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              id="admin-password"
              name="password"
              autocomplete="new-password"
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
              <i
                class="fas"
                class:fa-eye={!showPassword}
                class:fa-eye-slash={showPassword}
              ></i>
            </button>
          </div>
        </div>

        <div
          class="form-field"
          id="password-confirm-group"
          class:is-success={formPasswordConfirm !== '' && passwordMatch}
        >
          <label
            class="form-field__label"
            for="admin-password-confirm"
          >
            {MESSAGES.LABEL_PASSWORD_CONFIRM}
            {#if !isEditMode}<span class="text-red-500">*</span>{/if}
          </label>
          <div class="form-field__password-wrapper">
            <input
              type={showPasswordConfirm ? 'text' : 'password'}
              id="admin-password-confirm"
              name="passwordConfirm"
              autocomplete="new-password"
              class="form-field__control"
              class:is-error={passwordError}
              class:is-success={formPasswordConfirm !== '' && passwordMatch}
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
              >{MESSAGES.ERROR_PASSWORD_MISMATCH}</span
            >
          {:else if formPasswordConfirm !== '' && passwordMatch}
            <span class="form-field__message form-field__message--success">
              <i class="fas fa-check"></i> Passwörter stimmen überein
            </span>
          {/if}
        </div>

        {#if formPassword}
          <PasswordStrengthIndicator
            score={passwordScore}
            label={passwordLabel}
            crackTime={passwordTime}
          />
        {/if}

        <div class="form-field">
          <label
            class="form-field__label"
            for="admin-employee-number"
          >
            {MESSAGES.LABEL_EMPLOYEE_NUMBER} <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="admin-employee-number"
            name="employeeNumber"
            class="form-field__control"
            placeholder="z.B. ABC-123 oder 2025-001"
            maxlength="10"
            pattern="[A-Za-z0-9\-]{'{'}1,10}"
            required
            bind:value={formEmployeeNumber}
          />
          <span class="form-field__message text-(--color-text-secondary)"
            >{MESSAGES.HINT_EMPLOYEE_NUMBER}</span
          >
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="admin-position"
          >
            {MESSAGES.LABEL_POSITION} <span class="text-red-500">*</span>
          </label>
          <div
            class="dropdown"
            id="position-dropdown"
          >
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="dropdown__trigger"
              class:active={positionDropdownOpen}
              onclick={togglePositionDropdown}
            >
              <span
                >{formPosition !== '' ? formPosition : 'Bitte wählen...'}</span
              >
              <i class="fas fa-chevron-down"></i>
            </div>
            <div
              class="dropdown__menu"
              class:active={positionDropdownOpen}
            >
              {#each POSITION_OPTIONS as position (position)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="dropdown__option"
                  onclick={() => {
                    selectPosition(position);
                  }}
                >
                  {position}
                </div>
              {/each}
            </div>
          </div>
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="admin-notes">{MESSAGES.LABEL_NOTES}</label
          >
          <textarea
            id="admin-notes"
            name="notes"
            class="form-field__control"
            rows="3"
            bind:value={formNotes}
          ></textarea>
        </div>

        <AdminOrganizationSection
          {isEditMode}
          {show}
          {allAreas}
          {allDepartments}
          messages={msg}
          bind:formHasFullAccess
          bind:formAreaIds
          bind:formDepartmentIds
          bind:formIsActive
          {onupgrade}
          {ondowngrade}
        />
      </div>

      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={onclose}>{MESSAGES.BTN_CANCEL}</button
        >
        <button
          type="submit"
          class="btn btn-primary"
          disabled={submitting}
        >
          {#if submitting}<span class="spinner-ring spinner-ring--sm mr-2"
            ></span>{/if}
          {MESSAGES.BTN_SAVE}
        </button>
      </div>
    </form>
  </div>
{/if}
