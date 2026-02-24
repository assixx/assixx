<script lang="ts">
  import { tick } from 'svelte';

  import AppDatePicker from '$lib/components/AppDatePicker.svelte';
  import PasswordStrengthIndicator from '$lib/components/PasswordStrengthIndicator.svelte';

  import { POSITION_OPTIONS, MESSAGES } from './constants';
  import {
    getStatusBadgeClass,
    getStatusLabel,
    calculatePasswordStrength,
  } from './utils';

  import type { Team, FormIsActiveStatus } from './types';

  // =============================================================================
  // PROPS
  // =============================================================================

  interface Props {
    show: boolean;
    isEditMode: boolean;
    modalTitle: string;
    allTeams: Team[];
    submitting: boolean;
    // Form fields (all bindable)
    formFirstName: string;
    formLastName: string;
    formEmail: string;
    formEmailConfirm: string;
    formPassword: string;
    formPasswordConfirm: string;
    formEmployeeNumber: string;
    formPosition: string;
    formPhone: string;
    formDateOfBirth: string;
    formIsActive: FormIsActiveStatus;
    formTeamIds: number[];
    emailError: boolean;
    passwordError: boolean;
    // Callbacks
    onclose: () => void;
    onsubmit: (e: Event) => void;
    onvalidateemails: () => void;
    onvalidatepasswords: () => void;
    onupgrade?: () => void;
  }

  /* eslint-disable prefer-const, @typescript-eslint/no-useless-default-assignment -- Svelte $bindable() requires let and is not a useless default */
  // prettier-ignore
  let { show, isEditMode, modalTitle, allTeams, submitting, formFirstName = $bindable(), formLastName = $bindable(), formEmail = $bindable(), formEmailConfirm = $bindable(), formPassword = $bindable(), formPasswordConfirm = $bindable(), formEmployeeNumber = $bindable(), formPosition = $bindable(), formPhone = $bindable(), formDateOfBirth = $bindable(), formIsActive = $bindable(), formTeamIds = $bindable(), emailError = $bindable(), passwordError = $bindable(), onclose, onsubmit, onvalidateemails, onvalidatepasswords, onupgrade }: Props = $props();
  /* eslint-enable prefer-const, @typescript-eslint/no-useless-default-assignment */

  // =============================================================================
  // LOCAL STATE
  // =============================================================================

  // Dropdown States
  let positionDropdownOpen = $state(false);
  let statusDropdownOpen = $state(false);

  // Upgrade confirmation state
  let upgradeConfirmActive = $state(false);
  let dangerZoneEl: HTMLDivElement | undefined = $state();

  // Password Visibility
  let showPassword = $state(false);
  let showPasswordConfirm = $state(false);

  // Password Strength
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
  // TEAM SELECT HANDLER
  // =============================================================================

  function handleTeamChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    formTeamIds = Array.from(select.selectedOptions).map((opt) =>
      parseInt(opt.value, 10),
    );
  }

  // =============================================================================
  // PASSWORD STRENGTH
  // =============================================================================

  function updatePasswordStrength(): void {
    const result = calculatePasswordStrength(formPassword);
    passwordScore = result.score;
    passwordLabel = result.label;
    passwordTime = result.time;
  }

  // =============================================================================
  // OVERLAY CLICK HANDLER
  // =============================================================================

  function handleOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onclose();
  }

  // =============================================================================
  // OUTSIDE CLICK HANDLERS
  // =============================================================================

  /**
   * Checks if a click occurred outside a dropdown element
   */
  function isClickOutsideDropdown(
    target: HTMLElement,
    elementId: string,
  ): boolean {
    const el = document.getElementById(elementId);
    return el !== null && !el.contains(target);
  }

  // Reset local UI state when modal opens
  $effect(() => {
    if (show) {
      positionDropdownOpen = false;
      statusDropdownOpen = false;
      upgradeConfirmActive = false;
      showPassword = false;
      showPasswordConfirm = false;
      passwordScore = -1;
      passwordLabel = '';
      passwordTime = '';
    }
  });

  $effect(() => {
    if (positionDropdownOpen || statusDropdownOpen) {
      const handleOutsideClick = (e: MouseEvent): void => {
        const target = e.target as HTMLElement;

        if (
          positionDropdownOpen &&
          isClickOutsideDropdown(target, 'position-dropdown')
        ) {
          positionDropdownOpen = false;
        }
        if (
          statusDropdownOpen &&
          isClickOutsideDropdown(target, 'status-dropdown')
        ) {
          statusDropdownOpen = false;
        }
      };

      document.addEventListener('click', handleOutsideClick, true);
      return () => {
        document.removeEventListener('click', handleOutsideClick, true);
      };
    }
  });
</script>

{#if show}
  <!-- Add/Edit Employee Modal -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
  <div
    id="employee-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="employee-modal-title"
    tabindex="-1"
    onclick={handleOverlayClick}
    onkeydown={(e) => {
      if (e.key === 'Escape') onclose();
    }}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
    <form
      id="employee-form"
      class="ds-modal"
      onclick={(e) => {
        e.stopPropagation();
      }}
      {onsubmit}
    >
      <div class="ds-modal__header">
        <h3
          class="ds-modal__title"
          id="employee-modal-title"
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
        <!-- Personal Information -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="employee-first-name"
          >
            Vorname <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="employee-first-name"
            name="firstName"
            class="form-field__control"
            required
            bind:value={formFirstName}
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="employee-last-name"
          >
            Nachname <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="employee-last-name"
            name="lastName"
            class="form-field__control"
            required
            bind:value={formLastName}
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="employee-email"
          >
            E-Mail <span class="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="employee-email"
            name="email"
            class="form-field__control"
            class:is-error={emailError}
            required
            bind:value={formEmail}
            oninput={onvalidateemails}
          />
          <span class="form-field__message text-(--color-text-secondary)"
            >{MESSAGES.EMAIL_HINT}</span
          >
        </div>

        <div
          class="form-field"
          id="email-confirm-group"
        >
          <label
            class="form-field__label"
            for="employee-email-confirm"
          >
            E-Mail bestätigen <span class="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="employee-email-confirm"
            name="emailConfirm"
            class="form-field__control"
            class:is-error={emailError}
            required
            bind:value={formEmailConfirm}
            oninput={onvalidateemails}
          />
          {#if emailError}
            <span class="form-field__message form-field__message--error"
              >{MESSAGES.EMAIL_MISMATCH}</span
            >
          {/if}
        </div>

        <div
          class="form-field"
          id="password-group"
        >
          <label
            class="form-field__label"
            for="employee-password"
          >
            Passwort {#if !isEditMode}<span class="text-red-500">*</span>{/if}
            <span class="tooltip ml-1">
              <i class="fas fa-info-circle"></i>
              <span
                class="tooltip__content tooltip__content--info tooltip__content--right"
                role="tooltip"
              >
                {MESSAGES.PASSWORD_HINT}
              </span>
            </span>
          </label>
          <div class="form-field__password-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              id="employee-password"
              name="password"
              class="form-field__control"
              class:is-error={passwordError}
              required={!isEditMode}
              bind:value={formPassword}
              oninput={() => {
                onvalidatepasswords();
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
            for="employee-password-confirm"
          >
            Passwort bestätigen {#if !isEditMode}<span class="text-red-500"
                >*</span
              >{/if}
          </label>
          <div class="form-field__password-wrapper">
            <input
              type={showPasswordConfirm ? 'text' : 'password'}
              id="employee-password-confirm"
              name="passwordConfirm"
              class="form-field__control"
              class:is-error={passwordError}
              class:is-success={formPasswordConfirm !== '' && passwordMatch}
              required={!isEditMode}
              bind:value={formPasswordConfirm}
              oninput={onvalidatepasswords}
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
              >{MESSAGES.PASSWORD_MISMATCH}</span
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
            for="employee-phone">Telefon</label
          >
          <input
            type="tel"
            id="employee-phone"
            name="phone"
            class="form-field__control"
            bind:value={formPhone}
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="employee-position">Position</label
          >
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
            for="employee-number">Personalnummer</label
          >
          <input
            type="text"
            id="employee-number"
            name="employeeNumber"
            class="form-field__control"
            placeholder="z.B. EMP001 (optional, max 10 Zeichen)"
            maxlength="10"
            bind:value={formEmployeeNumber}
          />
          <span class="form-field__message text-(--color-text-secondary)"
            >{MESSAGES.EMPLOYEE_NUMBER_HINT}</span
          >
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="employee-dateOfBirth">Geburtsdatum</label
          >
          <AppDatePicker bind:value={formDateOfBirth} />
        </div>

        <!-- Team Assignment Section -->
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
                {MESSAGES.TEAM_INFO}
              </div>
            </div>
          </div>

          <div
            class="form-field"
            id="team-select-container"
          >
            <label
              class="form-field__label"
              for="employee-teams"
            >
              <i class="fas fa-users mr-1"></i>
              Teams
            </label>
            <select
              id="employee-teams"
              name="teamIds"
              multiple
              class="multi-select"
              onchange={handleTeamChange}
            >
              {#each allTeams as team (team.id)}
                <option
                  value={team.id}
                  selected={formTeamIds.includes(team.id)}
                >
                  {team.name}{(
                    team.departmentName !== undefined &&
                    team.departmentName !== ''
                  ) ?
                    ` (${team.departmentName})`
                  : ''}
                </option>
              {/each}
            </select>
            <span class="form-field__message text-(--color-text-secondary)">
              <i class="fas fa-info-circle mr-1"></i>
              {MESSAGES.TEAM_MULTISELECT_HINT}
            </span>
          </div>
        </div>

        {#if isEditMode}
          <div
            class="form-field mt-6"
            id="status-field-group"
          >
            <label
              class="form-field__label"
              for="employee-status"
            >
              Account Status <span class="text-red-500">*</span>
            </label>
            <div
              class="dropdown"
              id="status-dropdown"
            >
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
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
              <div
                class="dropdown__menu"
                class:active={statusDropdownOpen}
              >
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="dropdown__option"
                  onclick={() => {
                    selectStatus(1);
                  }}
                >
                  <span class="badge badge--success">Aktiv</span>
                </div>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="dropdown__option"
                  onclick={() => {
                    selectStatus(0);
                  }}
                >
                  <span class="badge badge--warning">Inaktiv</span>
                </div>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="dropdown__option"
                  onclick={() => {
                    selectStatus(3);
                  }}
                >
                  <span class="badge badge--secondary">Archiviert</span>
                </div>
              </div>
            </div>
            <span
              class="form-field__message mt-1 block text-(--color-text-secondary)"
            >
              {MESSAGES.STATUS_HINT}
            </span>
          </div>

          <!-- Danger Zone: Role Upgrade -->
          {#if onupgrade}
            <div
              bind:this={dangerZoneEl}
              class="mt-6 border-t-2 border-(--color-danger) pt-6"
            >
              <h4 class="mb-2 font-medium text-(--color-danger)">
                <i class="fas fa-exclamation-triangle mr-2"></i>
                {MESSAGES.UPGRADE_TITLE}
              </h4>
              <p class="mb-4 text-sm text-(--color-text-secondary)">
                {MESSAGES.UPGRADE_DESCRIPTION}
              </p>
              {#if !upgradeConfirmActive}
                <button
                  type="button"
                  class="btn btn-status-active"
                  onclick={async () => {
                    upgradeConfirmActive = true;
                    await tick();
                    dangerZoneEl?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'end',
                    });
                  }}
                >
                  <i class="fas fa-arrow-up mr-1"></i>
                  {MESSAGES.UPGRADE_BUTTON}
                </button>
              {:else}
                <div class="alert alert--danger mb-4">
                  <div class="alert__icon">
                    <i class="fas fa-exclamation-triangle"></i>
                  </div>
                  <div class="alert__content">
                    <p class="alert__message">
                      {MESSAGES.UPGRADE_CONFIRM_MESSAGE}
                    </p>
                  </div>
                </div>
                <div class="flex gap-3">
                  <button
                    type="button"
                    class="btn btn-cancel"
                    onclick={() => {
                      upgradeConfirmActive = false;
                    }}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    class="btn btn-danger"
                    onclick={onupgrade}
                  >
                    <i class="fas fa-check mr-1"></i>
                    {MESSAGES.UPGRADE_CONFIRM_BUTTON}
                  </button>
                </div>
              {/if}
            </div>
          {/if}
        {/if}
      </div>

      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={onclose}>Abbrechen</button
        >
        <button
          type="submit"
          class="btn btn-primary"
          disabled={submitting}
        >
          {#if submitting}<span class="spinner-ring spinner-ring--sm mr-2"
            ></span>{/if}
          Speichern
        </button>
      </div>
    </form>
  </div>
{/if}
