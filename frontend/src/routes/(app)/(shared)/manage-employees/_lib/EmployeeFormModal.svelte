<script lang="ts">
  import { tick } from 'svelte';

  import AppDatePicker from '$lib/components/AppDatePicker.svelte';
  import PasswordStrengthIndicator from '$lib/components/PasswordStrengthIndicator.svelte';
  import UserPositionChips from '$lib/components/UserPositionChips.svelte';
  import { showErrorAlert, showSuccessAlert } from '$lib/stores/toast';
  import {
    DEFAULT_HIERARCHY_LABELS,
    isLeadPosition,
    LEAD_POSITION_KEYS,
    type HierarchyLabels,
    type PositionOption,
  } from '$lib/types/hierarchy-labels';
  import { ApiError } from '$lib/utils/api-client';

  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import { sendPasswordResetLink } from './api';
  import { POSITION_OPTIONS, MESSAGES, type EmployeeMessages } from './constants';
  import { getStatusBadgeClass, getStatusLabel, calculatePasswordStrength } from './utils';

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
    messages?: EmployeeMessages;
    // Form fields (all bindable)
    formFirstName: string;
    formLastName: string;
    formEmail: string;
    formEmailConfirm: string;
    formPassword: string;
    formPasswordConfirm: string;
    formEmployeeNumber: string;
    formPositionIds: string[];
    formPhone: string;
    formDateOfBirth: string;
    formNotes: string;
    formIsActive: FormIsActiveStatus;
    formTeamIds: number[];
    emailError: boolean;
    passwordError: boolean;
    // Callbacks
    onclose: () => void;
    onsubmit: (e: Event) => void;
    onvalidateemails: () => void;
    onvalidatepasswords: () => void;
    positionOptions?: PositionOption[];
    labels?: HierarchyLabels;
    onupgrade?: () => void;
    /**
     * ADR-051 §5.4: target for the Root-initiated password-reset-link button.
     * Non-undefined → button renders. Undefined (create mode OR non-Root
     * viewer) → no button. Parent gates both conditions since `(shared)`
     * layout is admin+root accessible — the backend `@Roles('root')` is the
     * authoritative check; this prop is UX polish that hides the button
     * from admins so they don't click a feature they can't use.
     */
    resetLinkTarget?: { id: number; email: string };
  }

  /* eslint-disable prefer-const, @typescript-eslint/no-useless-default-assignment -- Svelte $bindable() requires let and is not a useless default */
  // prettier-ignore
  let { show, isEditMode, modalTitle, allTeams, submitting, messages: msg = MESSAGES, positionOptions, labels: lbl = DEFAULT_HIERARCHY_LABELS, formFirstName = $bindable(), formLastName = $bindable(), formEmail = $bindable(), formEmailConfirm = $bindable(), formPassword = $bindable(), formPasswordConfirm = $bindable(), formEmployeeNumber = $bindable(), formPositionIds = $bindable(), formPhone = $bindable(), formDateOfBirth = $bindable(), formNotes = $bindable(), formIsActive = $bindable(), formTeamIds = $bindable(), emailError = $bindable(), passwordError = $bindable(), onclose, onsubmit, onvalidateemails, onvalidatepasswords, onupgrade, resetLinkTarget }: Props = $props();
  /* eslint-enable prefer-const, @typescript-eslint/no-useless-default-assignment */

  // =============================================================================
  // LOCAL STATE
  // =============================================================================

  /** Hierarchie-Reihenfolge: area → department → team (jeweils Leiter + Stellvertreter) */
  const LEAD_ORDER: string[] = [
    LEAD_POSITION_KEYS.AREA,
    LEAD_POSITION_KEYS.AREA_DEPUTY,
    LEAD_POSITION_KEYS.DEPARTMENT,
    LEAD_POSITION_KEYS.DEPARTMENT_DEPUTY,
    LEAD_POSITION_KEYS.TEAM,
    LEAD_POSITION_KEYS.TEAM_DEPUTY,
  ];

  /** System positions first (sorted by hierarchy), then custom */
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

  // Dropdown States
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

  // ADR-051 §5.4: loading-state for the "Passwort-Reset-Link senden" button.
  // Disables the button during the in-flight request; the endpoint is
  // DB-rate-limited 1/15 min per (root, target) pair — the spinner prevents
  // double-submit which would 429.
  let sendingResetLink = $state(false);

  // Pre-call confirmation state — drives the design-system `ConfirmModal`
  // (variant="danger"). Replaces the former native `confirm()` to match
  // the destructive-action visual pattern used elsewhere in the app.
  let showResetLinkConfirm = $state(false);

  /**
   * Open the confirm-dialog for the "Passwort-Reset-Link senden" action
   * (ADR-051 §5.4). The actual API call runs in `confirmSendResetLink`
   * once the user accepts the ConfirmModal.
   */
  function requestSendResetLink(): void {
    if (resetLinkTarget === undefined) return;
    showResetLinkConfirm = true;
  }

  /**
   * Cancel the ConfirmModal without calling the API.
   */
  function cancelSendResetLink(): void {
    showResetLinkConfirm = false;
  }

  /**
   * Execute the "Passwort-Reset-Link senden" action after ConfirmModal
   * approval (ADR-051 §5.4). Identical error-mapping semantics to
   * manage-admins §5.3 — the code is duplicated by intent (plan §5.4
   * note: "copy-paste < premature abstraction"). 429 is detected via
   * `err.status` because the api-client pre-empts with its own
   * synthesized `RATE_LIMIT_EXCEEDED` before the body is parsed, so the
   * backend's `code: 'RATE_LIMIT'` never reaches `err.code`.
   */
  async function confirmSendResetLink(): Promise<void> {
    showResetLinkConfirm = false;
    if (resetLinkTarget === undefined) return;

    sendingResetLink = true;
    try {
      await sendPasswordResetLink(resetLinkTarget.id);
      showSuccessAlert(`${MESSAGES.RESET_LINK_SUCCESS}: ${resetLinkTarget.email}`);
    } catch (err: unknown) {
      let message: string = MESSAGES.RESET_LINK_ERROR_GENERIC;
      if (err instanceof ApiError) {
        if (err.status === 429) {
          message = MESSAGES.RESET_LINK_ERROR_RATE_LIMIT;
        } else if (err.code === 'INVALID_TARGET_ROLE') {
          message = MESSAGES.RESET_LINK_ERROR_INVALID_TARGET;
        } else if (err.code === 'INACTIVE_TARGET') {
          message = MESSAGES.RESET_LINK_ERROR_INACTIVE;
        }
      }
      showErrorAlert(message);
    } finally {
      sendingResetLink = false;
    }
  }

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const passwordMatch = $derived(
    formPassword !== '' && formPasswordConfirm !== '' && formPassword === formPasswordConfirm,
  );

  // =============================================================================
  // DROPDOWN HANDLERS
  // =============================================================================

  function toggleStatusDropdown(e: MouseEvent): void {
    e.stopPropagation();
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
    formTeamIds = Array.from(select.selectedOptions).map((opt) => parseInt(opt.value, 10));
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
  // OUTSIDE CLICK HANDLERS
  // =============================================================================

  /**
   * Checks if a click occurred outside a dropdown element
   */
  function isClickOutsideDropdown(target: HTMLElement, elementId: string): boolean {
    const el = document.getElementById(elementId);
    return el !== null && !el.contains(target);
  }

  // Reset local UI state when modal opens
  $effect(() => {
    if (show) {
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
    if (statusDropdownOpen) {
      const handleOutsideClick = (e: MouseEvent): void => {
        const target = e.target as HTMLElement;

        if (statusDropdownOpen && isClickOutsideDropdown(target, 'status-dropdown')) {
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
  <div
    id="employee-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="employee-modal-title"
    tabindex="-1"
  >
    <form
      id="employee-form"
      class="ds-modal"
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
          <span class="form-field__message text-(--color-text-secondary)">{msg.EMAIL_HINT}</span>
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
            <span class="form-field__message form-field__message--error">{msg.EMAIL_MISMATCH}</span>
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
                {msg.PASSWORD_HINT}
              </span>
            </span>
          </label>
          <div class="form-field__password-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              id="employee-password"
              name="password"
              autocomplete="new-password"
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
            Passwort bestätigen {#if !isEditMode}<span class="text-red-500">*</span>{/if}
          </label>
          <div class="form-field__password-wrapper">
            <input
              type={showPasswordConfirm ? 'text' : 'password'}
              id="employee-password-confirm"
              name="passwordConfirm"
              autocomplete="new-password"
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
              >{msg.PASSWORD_MISMATCH}</span
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
          <UserPositionChips
            catalog={effectivePositions}
            bind:selectedIds={formPositionIds}
            hierarchyLabels={lbl}
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
            for="employee-number">Personalnummer <span class="text-red-500">*</span></label
          >
          <input
            type="text"
            id="employee-number"
            name="employeeNumber"
            class="form-field__control"
            placeholder="z.B. EMP001 (max 10 Zeichen)"
            maxlength="10"
            bind:value={formEmployeeNumber}
          />
          <span class="form-field__message text-(--color-text-secondary)"
            >{msg.EMPLOYEE_NUMBER_HINT}</span
          >
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="employee-dateOfBirth">Geburtsdatum</label
          >
          <AppDatePicker bind:value={formDateOfBirth} />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="employee-notes">Zusätzliche Infos</label
          >
          <textarea
            id="employee-notes"
            name="notes"
            class="form-field__control"
            rows="3"
            bind:value={formNotes}
          ></textarea>
        </div>

        <!-- Team Assignment Section -->
        <div class="mt-6 border-t border-(--color-border) pt-6">
          <h4 class="mb-4 font-medium text-(--color-text-primary)">
            <i class="fas fa-users mr-2"></i>
            {msg.TEAM_ASSIGNMENT_TITLE}
          </h4>

          <div class="alert alert--info mb-4">
            <div class="alert__icon">
              <i class="fas fa-info-circle"></i>
            </div>
            <div class="alert__content">
              <div class="alert__message">
                {msg.TEAM_INFO}
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
              {msg.TH_TEAMS}
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
                  {team.name}{team.departmentName !== undefined && team.departmentName !== '' ?
                    ` (${team.departmentName})`
                  : ''}
                </option>
              {/each}
            </select>
            <span class="form-field__message text-(--color-text-secondary)">
              <i class="fas fa-info-circle mr-1"></i>
              {msg.TEAM_MULTISELECT_HINT}
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
            <span class="form-field__message mt-1 block text-(--color-text-secondary)">
              {msg.STATUS_HINT}
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
                {msg.UPGRADE_TITLE}
              </h4>
              <p class="mb-4 text-sm text-(--color-text-secondary)">
                {msg.UPGRADE_DESCRIPTION}
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
                  {msg.UPGRADE_BUTTON}
                </button>
              {:else}
                <div class="alert alert--danger mb-4">
                  <div class="alert__icon">
                    <i class="fas fa-exclamation-triangle"></i>
                  </div>
                  <div class="alert__content">
                    <p class="alert__message">
                      {msg.UPGRADE_CONFIRM_MESSAGE}
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
                    {msg.UPGRADE_CONFIRM_BUTTON}
                  </button>
                </div>
              {/if}
            </div>
          {/if}
        {/if}
      </div>

      {#if resetLinkTarget !== undefined}
        <!--
          ADR-051 §5.4 — Root-initiated Password-Reset-Link.
          Rendered only when parent passed a target (implies: edit mode +
          Root viewer). Backend `@Roles('root')` is the authoritative gate.

          Styling: `btn-danger` signals the destructive/sensitive nature
          (Root kicks off a credential-reset flow for another user). The
          border-top + description paragraph mirror the Upgrade/Downgrade
          "danger-zone" pattern and visually separate the action from the
          form fields. `align-items: center` on the flex-column wrapper
          overrides the default `stretch` so the inline-flex button
          collapses to content-width and centers. Horizontal padding
          tightened to 8px 12px (default: 8px 16px) per UX request.
        -->
        <div class="ds-modal__body">
          <div class="mt-4 border-t border-(--color-border) pt-4">
            <p class="mb-4 text-sm text-(--color-text-secondary)">
              Sendet dem Mitarbeiter eine E-Mail mit einem Passwort-Reset-Link. Der Mitarbeiter kann
              danach selbst ein neues Passwort setzen — Du siehst es nicht. Pro Empfänger 1× alle 15
              Minuten möglich.
            </p>
            <div
              class="form-field"
              style="align-items: center;"
            >
              <button
                type="button"
                class="btn btn-danger"
                style="padding: 8px 12px;"
                onclick={requestSendResetLink}
                disabled={sendingResetLink}
              >
                {#if sendingResetLink}
                  <span class="spinner-ring spinner-ring--sm mr-2"></span>
                {:else}
                  <i class="fas fa-paper-plane mr-2"></i>
                {/if}
                {MESSAGES.BTN_SEND_RESET_LINK}
              </button>
            </div>
          </div>
        </div>
      {/if}

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

<!--
  Confirm-Dialog for ADR-051 §5.4 Password-Reset-Link.
  Rendered outside the parent `{#if show}` block so the ConfirmModal's
  own modal-overlay stacks cleanly on top of EmployeeFormModal. The
  reset flow is sensitive (Root triggers credential-change for another
  user) → variant="danger".
-->
<ConfirmModal
  show={showResetLinkConfirm}
  id="employee-reset-link-confirm-modal"
  title={MESSAGES.BTN_SEND_RESET_LINK}
  variant="danger"
  icon="fa-paper-plane"
  confirmLabel={MESSAGES.BTN_SEND_RESET_LINK}
  cancelLabel="Abbrechen"
  onconfirm={confirmSendResetLink}
  oncancel={cancelSendResetLink}
>
  {MESSAGES.RESET_LINK_CONFIRM}
</ConfirmModal>
