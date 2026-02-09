<script lang="ts">
  import { POSITION_OPTIONS, MESSAGES } from './constants';
  import {
    getStatusBadgeClass,
    getStatusLabel,
    calculatePasswordStrength,
  } from './utils';

  import type { FormIsActiveStatus } from './types';

  // Props with bindable for two-way binding
  interface Props {
    show: boolean;
    isEditMode: boolean;
    modalTitle: string;
    firstName: string;
    lastName: string;
    email: string;
    emailConfirm: string;
    password: string;
    passwordConfirm: string;
    employeeNumber: string;
    position: string;
    notes: string;
    isActive: FormIsActiveStatus;
    emailError: boolean;
    passwordError: boolean;
    submitting: boolean;
    onclose: () => void;
    onsubmit: (e: Event) => void;
    onValidateEmails: () => void;
    onValidatePasswords: () => void;
  }

  /* eslint-disable prefer-const, @typescript-eslint/no-useless-default-assignment -- Svelte $bindable() requires let and is not a useless default */
  // prettier-ignore
  let { show, isEditMode, modalTitle, firstName = $bindable(), lastName = $bindable(), email = $bindable(), emailConfirm = $bindable(), password = $bindable(), passwordConfirm = $bindable(), employeeNumber = $bindable(), position = $bindable(), notes = $bindable(), isActive = $bindable(), emailError = $bindable(), passwordError = $bindable(), submitting, onclose, onsubmit, onValidateEmails, onValidatePasswords }: Props = $props();
  /* eslint-enable prefer-const, @typescript-eslint/no-useless-default-assignment */

  // Local dropdown and visibility state
  let positionDropdownOpen = $state(false);
  let statusDropdownOpen = $state(false);
  let showPassword = $state(false);
  let showPasswordConfirm = $state(false);

  // Password strength (derived from password)
  const passwordStrength = $derived(calculatePasswordStrength(password));

  const passwordMatch = $derived(
    password !== '' && passwordConfirm !== '' && password === passwordConfirm,
  );

  function handleOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onclose();
  }

  function selectPosition(pos: string): void {
    position = pos;
    positionDropdownOpen = false;
  }

  function selectStatus(status: FormIsActiveStatus): void {
    isActive = status;
    statusDropdownOpen = false;
  }

  function togglePositionDropdown(e: MouseEvent): void {
    e.stopPropagation();
    statusDropdownOpen = false;
    positionDropdownOpen = !positionDropdownOpen;
  }

  function toggleStatusDropdown(e: MouseEvent): void {
    e.stopPropagation();
    positionDropdownOpen = false;
    statusDropdownOpen = !statusDropdownOpen;
  }

  // Reset local UI state when modal opens
  $effect(() => {
    if (show) {
      positionDropdownOpen = false;
      statusDropdownOpen = false;
      showPassword = false;
      showPasswordConfirm = false;
    }
  });

  // Close dropdowns on outside click
  $effect(() => {
    if (positionDropdownOpen || statusDropdownOpen) {
      const handleClick = (e: MouseEvent): void => {
        const target = e.target as HTMLElement;
        if (positionDropdownOpen) {
          const el = document.getElementById('position-dropdown');
          if (el && !el.contains(target)) positionDropdownOpen = false;
        }
        if (statusDropdownOpen) {
          const el = document.getElementById('status-dropdown');
          if (el && !el.contains(target)) statusDropdownOpen = false;
        }
      };
      document.addEventListener('click', handleClick);
      return () => {
        document.removeEventListener('click', handleClick);
      };
    }
  });
</script>

{#if show}
  <div
    id="root-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="root-modal-title"
    tabindex="-1"
    onclick={handleOverlayClick}
    onkeydown={(e) => {
      if (e.key === 'Escape') onclose();
    }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <form
      id="root-form"
      class="ds-modal"
      onclick={(e) => {
        e.stopPropagation();
      }}
      {onsubmit}
    >
      <div class="ds-modal__header">
        <h3
          class="ds-modal__title"
          id="root-modal-title"
        >
          {modalTitle}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Modal schließen"
          onclick={onclose}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="ds-modal__body">
        <div class="form-field">
          <label
            class="form-field__label"
            for="root-first-name"
            >Vorname <span class="text-red-500">*</span></label
          >
          <input
            type="text"
            id="root-first-name"
            class="form-field__control"
            required
            bind:value={firstName}
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="root-last-name"
            >Nachname <span class="text-red-500">*</span></label
          >
          <input
            type="text"
            id="root-last-name"
            class="form-field__control"
            required
            bind:value={lastName}
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="root-email">E-Mail <span class="text-red-500">*</span></label
          >
          <input
            type="email"
            id="root-email"
            class="form-field__control"
            class:is-error={emailError}
            required
            bind:value={email}
            oninput={onValidateEmails}
          />
          <span class="form-field__message text-[var(--color-text-secondary)]"
            >{MESSAGES.EMAIL_USED_AS_USERNAME}</span
          >
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="root-email-confirm"
            >E-Mail wiederholen <span class="text-red-500">*</span></label
          >
          <input
            type="email"
            id="root-email-confirm"
            class="form-field__control"
            class:is-error={emailError}
            required
            bind:value={emailConfirm}
            oninput={onValidateEmails}
          />
          {#if emailError}
            <span class="form-field__message form-field__message--error"
              >{MESSAGES.EMAILS_NOT_MATCH}</span
            >
          {/if}
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="root-employee-number">Personalnummer</label
          >
          <input
            type="text"
            id="root-employee-number"
            class="form-field__control"
            placeholder="z.B. ABC-123 (optional, max 10 Zeichen)"
            maxlength="10"
            bind:value={employeeNumber}
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="root-password"
          >
            Passwort {#if !isEditMode}<span class="text-red-500">*</span>{/if}
            <span class="tooltip ml-1">
              <i class="fas fa-info-circle"></i>
              <span
                class="tooltip__content tooltip__content--info tooltip__content--right"
                role="tooltip"
              >
                Min. 12 Zeichen, max. 72 Zeichen. 3 von 4: Groß, Klein, Zahlen,
                Sonderzeichen
              </span>
            </span>
          </label>
          <div class="form-field__password-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              id="root-password"
              class="form-field__control"
              class:is-error={passwordError}
              required={!isEditMode}
              bind:value={password}
              oninput={onValidatePasswords}
            />
            <button
              type="button"
              class="form-field__password-toggle"
              aria-label={showPassword ? 'Passwort verbergen' : (
                'Passwort anzeigen'
              )}
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
          class:is-success={passwordConfirm !== '' && passwordMatch}
        >
          <label
            class="form-field__label"
            for="root-password-confirm"
          >
            Passwort wiederholen {#if !isEditMode}<span class="text-red-500"
                >*</span
              >{/if}
          </label>
          <div class="form-field__password-wrapper">
            <input
              type={showPasswordConfirm ? 'text' : 'password'}
              id="root-password-confirm"
              class="form-field__control"
              class:is-error={passwordError}
              class:is-success={passwordConfirm !== '' && passwordMatch}
              required={!isEditMode}
              bind:value={passwordConfirm}
              oninput={onValidatePasswords}
            />
            <button
              type="button"
              class="form-field__password-toggle"
              aria-label={showPasswordConfirm ? 'Passwort verbergen' : (
                'Passwort anzeigen'
              )}
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
          {:else if passwordConfirm !== '' && passwordMatch}
            <span class="form-field__message form-field__message--success">
              <i class="fas fa-check"></i> Passwörter stimmen überein
            </span>
          {/if}
        </div>

        {#if password}
          <div class="password-strength-container">
            <div class="password-strength-meter">
              <div
                class="password-strength-bar"
                data-score={passwordStrength.score}
              ></div>
            </div>
            <div class="password-strength-info">
              <span class="password-strength-label"
                >{passwordStrength.label}</span
              >
              <span class="password-strength-time">{passwordStrength.time}</span
              >
            </div>
          </div>
        {/if}

        <div class="form-field">
          <div class="alert alert--info">
            <div class="alert__icon"><i class="fas fa-building"></i></div>
            <div class="alert__content">
              <div class="alert__title">{MESSAGES.FULL_ACCESS_TITLE}</div>
              <div class="alert__message">{MESSAGES.FULL_ACCESS_MESSAGE}</div>
            </div>
          </div>
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="position-hidden"
            >Position <span class="text-red-500">*</span></label
          >
          <input
            type="hidden"
            id="position-hidden"
            value={position}
          />
          <div
            class="dropdown"
            id="position-dropdown"
          >
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div
              class="dropdown__trigger"
              class:active={positionDropdownOpen}
              onclick={togglePositionDropdown}
            >
              <span
                >{position !== '' ? position : MESSAGES.SELECT_POSITION}</span
              >
              <i class="fas fa-chevron-down"></i>
            </div>
            <div
              class="dropdown__menu"
              class:active={positionDropdownOpen}
            >
              {#each POSITION_OPTIONS as pos (pos)}
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                <div
                  class="dropdown__option"
                  onclick={() => {
                    selectPosition(pos);
                  }}
                >
                  {pos}
                </div>
              {/each}
            </div>
          </div>
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="root-notes">Notizen</label
          >
          <textarea
            id="root-notes"
            class="form-field__control"
            rows="3"
            bind:value={notes}
          ></textarea>
        </div>

        {#if isEditMode}
          <div class="form-field">
            <label
              class="form-field__label"
              for="status-hidden"
              >Status <span class="text-red-500">*</span></label
            >
            <input
              type="hidden"
              id="status-hidden"
              value={isActive}
            />
            <div
              class="dropdown"
              id="status-dropdown"
            >
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <div
                class="dropdown__trigger"
                class:active={statusDropdownOpen}
                onclick={toggleStatusDropdown}
              >
                <span class="badge {getStatusBadgeClass(isActive)}"
                  >{getStatusLabel(isActive)}</span
                >
                <i class="fas fa-chevron-down"></i>
              </div>
              <div
                class="dropdown__menu"
                class:active={statusDropdownOpen}
              >
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                <div
                  class="dropdown__option"
                  onclick={() => {
                    selectStatus(1);
                  }}
                >
                  <span class="badge badge--success">Aktiv</span>
                </div>
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                <div
                  class="dropdown__option"
                  onclick={() => {
                    selectStatus(0);
                  }}
                >
                  <span class="badge badge--warning">Inaktiv</span>
                </div>
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
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
              class="form-field__message mt-1 block text-[var(--color-text-secondary)]"
              >{MESSAGES.INACTIVE_HINT}</span
            >
          </div>
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
          class="btn btn-modal"
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
