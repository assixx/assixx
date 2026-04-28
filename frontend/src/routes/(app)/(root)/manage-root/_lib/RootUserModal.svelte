<script lang="ts">
  import PasswordStrengthIndicator from '$lib/components/PasswordStrengthIndicator.svelte';
  import UserPositionChips from '$lib/components/UserPositionChips.svelte';
  import {
    isLeadPosition,
    LEAD_POSITION_KEYS,
    type HierarchyLabels,
    type PositionOption,
  } from '$lib/types/hierarchy-labels';

  import { POSITION_OPTIONS, type createRootMessages } from './constants';
  import { getStatusBadgeClass, getStatusLabel, calculatePasswordStrength } from './utils';

  import type { FormIsActiveStatus } from './types';

  // Props with bindable for two-way binding
  interface Props {
    messages: ReturnType<typeof createRootMessages>;
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
    positionIds: string[];
    notes: string;
    isActive: FormIsActiveStatus;
    emailError: boolean;
    passwordError: boolean;
    submitting: boolean;
    onclose: () => void;
    onsubmit: (e: Event) => void;
    onValidateEmails: () => void;
    positionOptions?: PositionOption[];
    hierarchyLabels: HierarchyLabels;
    onValidatePasswords: () => void;
    /**
     * When true (and isEditMode), the Status field renders read-only with a
     * lock indicator instead of the destructive dropdown (Inaktiv / Archiviert).
     * Used by /manage-root to enforce the cross-root immutability rule
     * (masterplan §5.2 / ADR-053 — Layer 1 UX hint; backend Layer 2 + Layer 4
     * are the real gates). Default false preserves backward-compatibility for
     * any future caller that allows status changes.
     */
    lockDestructiveStatus?: boolean;
  }

  /* eslint-disable prefer-const, @typescript-eslint/no-useless-default-assignment -- Svelte $bindable() requires let and is not a useless default */
  // prettier-ignore
  let { messages, show, isEditMode, modalTitle, positionOptions, hierarchyLabels, lockDestructiveStatus = false, firstName = $bindable(), lastName = $bindable(), email = $bindable(), emailConfirm = $bindable(), password = $bindable(), passwordConfirm = $bindable(), employeeNumber = $bindable(), positionIds = $bindable(), notes = $bindable(), isActive = $bindable(), emailError = $bindable(), passwordError = $bindable(), submitting, onclose, onsubmit, onValidateEmails, onValidatePasswords }: Props = $props();
  /* eslint-enable prefer-const, @typescript-eslint/no-useless-default-assignment */

  const LEAD_ORDER: string[] = [
    LEAD_POSITION_KEYS.AREA,
    LEAD_POSITION_KEYS.DEPARTMENT,
    LEAD_POSITION_KEYS.TEAM,
  ];

  const effectivePositions = $derived.by((): PositionOption[] => {
    const raw: readonly PositionOption[] =
      positionOptions !== undefined && positionOptions.length > 0 ?
        positionOptions
      : POSITION_OPTIONS;
    const unique = raw.filter(
      (p: PositionOption, i: number, arr: readonly PositionOption[]) =>
        arr.findIndex((x: PositionOption) => x.name === p.name) === i,
    );
    const system = unique
      .filter((p: PositionOption) => isLeadPosition(p.name))
      .sort(
        (a: PositionOption, b: PositionOption) =>
          LEAD_ORDER.indexOf(a.name) - LEAD_ORDER.indexOf(b.name),
      );
    const custom = unique.filter((p: PositionOption) => !isLeadPosition(p.name));
    return [...system, ...custom];
  });

  // Local dropdown and visibility state
  let statusDropdownOpen = $state(false);
  let showPassword = $state(false);
  let showPasswordConfirm = $state(false);

  // Password strength (derived from password)
  const passwordStrength = $derived(calculatePasswordStrength(password));

  const passwordMatch = $derived(
    password !== '' && passwordConfirm !== '' && password === passwordConfirm,
  );

  function selectStatus(status: FormIsActiveStatus): void {
    isActive = status;
    statusDropdownOpen = false;
  }

  function toggleStatusDropdown(e: MouseEvent): void {
    e.stopPropagation();
    statusDropdownOpen = !statusDropdownOpen;
  }

  // Reset local UI state when modal opens
  $effect(() => {
    if (show) {
      statusDropdownOpen = false;
      showPassword = false;
      showPasswordConfirm = false;
    }
  });

  // Close dropdowns on outside click
  $effect(() => {
    if (statusDropdownOpen) {
      const handleClick = (e: MouseEvent): void => {
        const target = e.target as HTMLElement;
        const el = document.getElementById('status-dropdown');
        if (el && !el.contains(target)) statusDropdownOpen = false;
      };
      document.addEventListener('click', handleClick, true);
      return () => {
        document.removeEventListener('click', handleClick, true);
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
  >
    <form
      id="root-form"
      class="ds-modal"
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
            for="root-first-name">Vorname <span class="text-red-500">*</span></label
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
            for="root-last-name">Nachname <span class="text-red-500">*</span></label
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
          <span class="form-field__message text-(--color-text-secondary)"
            >{messages.EMAIL_USED_AS_USERNAME}</span
          >
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="root-email-confirm">E-Mail wiederholen <span class="text-red-500">*</span></label
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
              >{messages.EMAILS_NOT_MATCH}</span
            >
          {/if}
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="root-employee-number">Personalnummer <span class="text-red-500">*</span></label
          >
          <input
            type="text"
            id="root-employee-number"
            class="form-field__control"
            placeholder="z.B. ABC-123 (max 10 Zeichen)"
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
                Min. 12 Zeichen, max. 72 Zeichen. 3 von 4: Groß, Klein, Zahlen, Sonderzeichen
              </span>
            </span>
          </label>
          <div class="form-field__password-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              id="root-password"
              autocomplete="new-password"
              class="form-field__control"
              class:is-error={passwordError}
              required={!isEditMode}
              bind:value={password}
              oninput={onValidatePasswords}
            />
            <button
              type="button"
              class="form-field__password-toggle"
              aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
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
            Passwort wiederholen {#if !isEditMode}<span class="text-red-500">*</span>{/if}
          </label>
          <div class="form-field__password-wrapper">
            <input
              type={showPasswordConfirm ? 'text' : 'password'}
              id="root-password-confirm"
              autocomplete="new-password"
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
              aria-label={showPasswordConfirm ? 'Passwort verbergen' : 'Passwort anzeigen'}
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
              >{messages.PASSWORDS_NOT_MATCH}</span
            >
          {:else if passwordConfirm !== '' && passwordMatch}
            <span class="form-field__message form-field__message--success">
              <i class="fas fa-check"></i> Passwörter stimmen überein
            </span>
          {/if}
        </div>

        {#if password}
          <PasswordStrengthIndicator
            score={passwordStrength.score}
            label={passwordStrength.label}
            crackTime={passwordStrength.time}
          />
        {/if}

        <div class="form-field">
          <div class="alert alert--info">
            <div class="alert__icon"><i class="fas fa-building"></i></div>
            <div class="alert__content">
              <div class="alert__title">{messages.FULL_ACCESS_TITLE}</div>
              <div class="alert__message">{messages.FULL_ACCESS_MESSAGE}</div>
            </div>
          </div>
        </div>

        <div class="form-field">
          <UserPositionChips
            catalog={effectivePositions}
            bind:selectedIds={positionIds}
            {hierarchyLabels}
          />
          <div class="alert alert--info alert--sm mt-2">
            <div class="alert__icon"><i class="fas fa-id-badge"></i></div>
            <div class="alert__content">
              <div class="alert__title">Position nicht dabei?</div>
              <div class="alert__message">
                <a
                  href="/settings/organigram/positions"
                  target="_blank">Neue Position anlegen</a
                >
                — oder bestehende Positionen bearbeiten.
              </div>
            </div>
          </div>
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="root-notes">Zusätzliche Infos</label
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
              for="status-hidden">Status <span class="text-red-500">*</span></label
            >
            <input
              type="hidden"
              id="status-hidden"
              value={isActive}
            />
            {#if lockDestructiveStatus}
              <!--
                Cross-root immutability: status is read-only when the target is
                another root account (masterplan §5.2 / ADR-053). The lock icon
                + hint message tell the user WHY the dropdown is gone, instead
                of silently hiding it. Backend Layer 2 + Layer 4 enforce the
                same rule server-side; this branch is the Layer 1 UX hint only.
              -->
              <div
                class="status-readonly flex items-center gap-2"
                title={messages.CROSS_ROOT_BLOCKED_TOOLTIP}
              >
                <span class="badge {getStatusBadgeClass(isActive)}">{getStatusLabel(isActive)}</span
                >
                <i
                  class="fas fa-lock text-(--color-text-secondary)"
                  aria-label={messages.CROSS_ROOT_BLOCKED_TOOLTIP}
                ></i>
              </div>
              <span class="form-field__message mt-1 block text-(--color-text-secondary)"
                >{messages.CROSS_ROOT_STATUS_LOCKED_HINT}</span
              >
            {:else}
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
              <span class="form-field__message mt-1 block text-(--color-text-secondary)"
                >{messages.INACTIVE_HINT}</span
              >
            {/if}
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
          class="btn btn-secondary"
          disabled={submitting}
        >
          {#if submitting}<span class="spinner-ring spinner-ring--sm mr-2"></span>{/if}
          Speichern
        </button>
      </div>
    </form>
  </div>
{/if}
