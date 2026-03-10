<script lang="ts">
  import PasswordStrengthIndicator from '$lib/components/PasswordStrengthIndicator.svelte';
  import { analyzePassword } from '$lib/utils/password-strength';

  import {
    FORM_DEFAULTS,
    IS_ACTIVE_LABELS,
    MESSAGES,
    MIN_PASSWORD_LENGTH,
  } from './constants';

  import type { PasswordStrengthResult } from '$lib/utils/password-strength';
  import type {
    DummyFormData,
    DummyUser,
    Team,
    ValidationErrors,
  } from './types';

  interface Props {
    show: boolean;
    mode: 'create' | 'edit';
    dummy: DummyUser | null;
    teams: Team[];
    submitting: boolean;
    onclose: () => void;
    onsave: (data: DummyFormData) => void;
  }

  const { show, mode, dummy, teams, submitting, onclose, onsave }: Props =
    $props();

  let formData = $state<DummyFormData>({ ...FORM_DEFAULTS });
  let errors = $state<ValidationErrors>({});
  let showPassword = $state(false);
  let strengthResult = $state<PasswordStrengthResult | null>(null);
  let strengthLoading = $state(false);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const passwordMatch = $derived(
    formData.password !== '' &&
      formData.passwordConfirm !== '' &&
      formData.password === formData.passwordConfirm,
  );

  $effect(() => {
    if (show) {
      resetForm();
    }
  });

  function resetForm(): void {
    if (mode === 'edit' && dummy !== null) {
      formData = {
        displayName: dummy.displayName,
        password: '',
        passwordConfirm: '',
        teamIds: [...dummy.teamIds],
        isActive: dummy.isActive,
      };
    } else {
      formData = { ...FORM_DEFAULTS };
    }
    errors = {};
    showPassword = false;
    strengthResult = null;
  }

  function validate(): boolean {
    const newErrors: ValidationErrors = {};

    if (formData.displayName.trim() === '') {
      newErrors.displayName = MESSAGES.VALIDATION_DISPLAY_NAME_REQUIRED;
    } else if (formData.displayName.length > 100) {
      newErrors.displayName = MESSAGES.VALIDATION_DISPLAY_NAME_TOO_LONG;
    }

    const passwordRequired = mode === 'create' || formData.password !== '';
    if (mode === 'create' && formData.password === '') {
      newErrors.password = MESSAGES.VALIDATION_PASSWORD_REQUIRED;
    } else if (
      passwordRequired &&
      formData.password.length < MIN_PASSWORD_LENGTH
    ) {
      newErrors.password = MESSAGES.VALIDATION_PASSWORD_TOO_SHORT;
    }

    if (passwordRequired && formData.password !== formData.passwordConfirm) {
      newErrors.passwordConfirm = MESSAGES.VALIDATION_PASSWORD_MISMATCH;
    }

    errors = newErrors;
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: Event): void {
    e.preventDefault();
    if (!validate()) return;
    onsave(formData);
  }

  function handlePasswordInput(): void {
    if (debounceTimer !== null) clearTimeout(debounceTimer);

    if (formData.password === '') {
      strengthResult = null;
      return;
    }

    strengthLoading = true;
    debounceTimer = setTimeout(() => {
      void analyzePassword(formData.password).then(
        (result: PasswordStrengthResult | null) => {
          strengthResult = result;
          strengthLoading = false;
        },
      );
    }, 300);
  }

  function handleOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onclose();
  }

  function handleTeamChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    formData.teamIds = Array.from(select.selectedOptions).map(
      (opt: HTMLOptionElement) => parseInt(opt.value, 10),
    );
  }
</script>

{#if show}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
  <div
    id="dummy-form-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="dummy-modal-title"
    tabindex="-1"
    onclick={handleOverlayClick}
    onkeydown={(e: KeyboardEvent) => {
      if (e.key === 'Escape') onclose();
    }}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
    <form
      class="ds-modal"
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
      }}
      onsubmit={handleSubmit}
    >
      <div class="ds-modal__header">
        <h3
          class="ds-modal__title"
          id="dummy-modal-title"
        >
          <i class="fas fa-desktop mr-2"></i>
          {mode === 'create' ? MESSAGES.MODAL_CREATE : MESSAGES.MODAL_EDIT}
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
        <!-- Designation -->
        <div
          class="form-field"
          class:is-error={errors.displayName !== undefined}
        >
          <label
            class="form-field__label"
            for="displayName"
          >
            {MESSAGES.FORM_DISPLAY_NAME} <span class="text-red-500">*</span>
          </label>
          <input
            id="displayName"
            type="text"
            class="form-field__control"
            class:is-error={errors.displayName !== undefined}
            placeholder={MESSAGES.FORM_DISPLAY_NAME_PH}
            maxlength="100"
            required
            bind:value={formData.displayName}
          />
          {#if errors.displayName !== undefined}
            <span class="form-field__message form-field__message--error">
              {errors.displayName}
            </span>
          {/if}
        </div>

        <!-- Readonly fields (edit mode) -->
        {#if mode === 'edit' && dummy !== null}
          <div class="form-field">
            <label
              class="form-field__label"
              for="email"
            >
              {MESSAGES.FORM_EMAIL}
            </label>
            <input
              id="email"
              type="text"
              class="form-field__control"
              value={dummy.email}
              readonly
              disabled
            />
            <span class="form-field__message text-(--color-text-secondary)">
              Auto-generiert
            </span>
          </div>
          <div class="form-field">
            <label
              class="form-field__label"
              for="employeeNr"
            >
              {MESSAGES.FORM_EMPLOYEE_NR}
            </label>
            <input
              id="employeeNr"
              type="text"
              class="form-field__control"
              value={dummy.employeeNumber}
              readonly
              disabled
            />
            <span class="form-field__message text-(--color-text-secondary)">
              Auto-generiert
            </span>
          </div>
        {/if}

        <!-- Password -->
        <div
          class="form-field"
          class:is-error={errors.password !== undefined}
        >
          <label
            class="form-field__label"
            for="password"
          >
            {MESSAGES.FORM_PASSWORD}
            {#if mode === 'create'}
              <span class="text-red-500">*</span>
            {/if}
            {#if mode === 'edit'}
              <span class="text-muted text-sm">(leer = unverändert)</span>
            {/if}
          </label>
          <div class="form-field__password-wrapper">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autocomplete="new-password"
              class="form-field__control"
              class:is-error={errors.password !== undefined}
              placeholder={MESSAGES.FORM_PASSWORD_PH}
              required={mode === 'create'}
              bind:value={formData.password}
              oninput={handlePasswordInput}
            />
            <button
              type="button"
              class="form-field__password-toggle"
              aria-label={showPassword ? 'Passwort verbergen' : (
                'Passwort anzeigen'
              )}
              onclick={() => {
                showPassword = !showPassword;
              }}
            >
              <i
                class="fas"
                class:fa-eye={!showPassword}
                class:fa-eye-slash={showPassword}
              ></i>
            </button>
          </div>
          {#if errors.password !== undefined}
            <span class="form-field__message form-field__message--error">
              {errors.password}
            </span>
          {/if}
        </div>

        <div
          class="form-field"
          class:is-error={errors.passwordConfirm !== undefined}
          class:is-success={formData.passwordConfirm !== '' && passwordMatch}
        >
          <label
            class="form-field__label"
            for="passwordConfirm"
          >
            {MESSAGES.FORM_PASSWORD_CONFIRM}
            {#if mode === 'create'}
              <span class="text-red-500">*</span>
            {/if}
          </label>
          <div class="form-field__password-wrapper">
            <input
              id="passwordConfirm"
              type={showPassword ? 'text' : 'password'}
              autocomplete="new-password"
              class="form-field__control"
              class:is-error={errors.passwordConfirm !== undefined}
              class:is-success={formData.passwordConfirm !== '' &&
                passwordMatch}
              placeholder={MESSAGES.FORM_PASSWORD_CONFIRM_PH}
              required={mode === 'create'}
              bind:value={formData.passwordConfirm}
            />
            <button
              type="button"
              class="form-field__password-toggle"
              aria-label={showPassword ? 'Passwort verbergen' : (
                'Passwort anzeigen'
              )}
              onclick={() => {
                showPassword = !showPassword;
              }}
            >
              <i
                class="fas"
                class:fa-eye={!showPassword}
                class:fa-eye-slash={showPassword}
              ></i>
            </button>
          </div>
          {#if errors.passwordConfirm !== undefined}
            <span class="form-field__message form-field__message--error">
              {errors.passwordConfirm}
            </span>
          {:else if formData.passwordConfirm !== '' && passwordMatch}
            <span class="form-field__message form-field__message--success">
              <i class="fas fa-check"></i> Passwörter stimmen überein
            </span>
          {/if}
        </div>

        <!-- Password Strength -->
        {#if formData.password !== ''}
          <PasswordStrengthIndicator
            score={strengthResult?.score ?? -1}
            label={strengthResult?.label}
            crackTime={strengthResult?.crackTime}
            loading={strengthLoading}
            feedback={strengthResult?.feedback}
          />
        {/if}

        <!-- Team Assignment -->
        <div class="mt-6 border-t border-(--color-border) pt-6">
          <h4 class="mb-4 font-medium text-(--color-text-primary)">
            <i class="fas fa-users mr-2"></i>
            Team-Zuweisung
          </h4>

          <div class="alert alert--info mb-4">
            <div class="alert__icon">
              <i class="fas fa-info-circle"></i>
            </div>
            <div class="alert__content">
              <div class="alert__message">
                Teams bestimmen, auf welchen TPM-Boards dieser Dummy-Benutzer
                Inhalte sehen kann.
              </div>
            </div>
          </div>

          <div class="form-field">
            <label
              class="form-field__label"
              for="dummy-teams"
            >
              <i class="fas fa-users mr-1"></i>
              Teams
            </label>
            <select
              id="dummy-teams"
              name="teamIds"
              multiple
              class="multi-select"
              onchange={handleTeamChange}
            >
              {#each teams as team (team.id)}
                <option
                  value={team.id}
                  selected={formData.teamIds.includes(team.id)}
                >
                  {team.name}{team.departmentName !== null ?
                    ` (${team.departmentName})`
                  : ''}
                </option>
              {/each}
            </select>
            <span class="form-field__message text-(--color-text-secondary)">
              <i class="fas fa-info-circle mr-1"></i>
              Strg/Cmd + Klick für Mehrfachauswahl
            </span>
          </div>
        </div>

        <!-- Status (edit mode only) -->
        {#if mode === 'edit'}
          <div class="form-field mt-6">
            <label
              class="form-field__label"
              for="status"
            >
              {MESSAGES.FORM_STATUS}
            </label>
            <select
              id="status"
              class="form-field__control form-field__control--select"
              bind:value={formData.isActive}
            >
              {#each [1, 0, 3] as value (value)}
                <option {value}>{IS_ACTIVE_LABELS[value]}</option>
              {/each}
            </select>
            <span class="form-field__message text-(--color-text-secondary)">
              Inaktive/Archivierte Dummy-Benutzer können sich nicht anmelden
            </span>
          </div>
        {/if}
      </div>

      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={onclose}
        >
          {MESSAGES.BTN_CANCEL}
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={submitting}
        >
          {#if submitting}
            <span class="spinner-ring spinner-ring--sm mr-2"></span>
          {/if}
          {MESSAGES.BTN_SAVE}
        </button>
      </div>
    </form>
  </div>
{/if}
