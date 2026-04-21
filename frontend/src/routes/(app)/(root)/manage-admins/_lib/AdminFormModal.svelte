<script lang="ts">
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

  import AdminOrganizationSection from './AdminOrganizationSection.svelte';
  import { sendPasswordResetLink } from './api';
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
    formPositionIds: string[];
    formNotes: string;
    formIsActive: FormIsActiveStatus;
    formHasFullAccess: boolean;
    formAreaIds: number[];
    formDepartmentIds: number[];
    // Callbacks
    onclose: () => void;
    onsubmit: (e: Event) => void;
    onupgrade?: () => void;
    positionOptions?: PositionOption[];
    ondowngrade?: () => void;
    labels?: HierarchyLabels;
    /**
     * ADR-051 §5.3: target for the "Passwort-Reset-Link senden" button.
     * Non-undefined → button renders. Undefined (create mode) → no button.
     * The parent page derives this from `currentEditId + admin.email` so
     * the target user-id + email are available for the confirm-dialog and
     * the API call.
     */
    resetLinkTarget?: { id: number; email: string };
  }

  /* eslint-disable prefer-const, @typescript-eslint/no-useless-default-assignment -- Svelte $bindable() requires let and is not a useless default */
  // prettier-ignore
  let { show, isEditMode, modalTitle, allAreas, allDepartments, submitting, messages: msg = MESSAGES, positionOptions, labels: lbl = DEFAULT_HIERARCHY_LABELS, formFirstName = $bindable(), formLastName = $bindable(), formEmail = $bindable(), formEmailConfirm = $bindable(), formPassword = $bindable(), formPasswordConfirm = $bindable(), formEmployeeNumber = $bindable(), formPositionIds = $bindable(), formNotes = $bindable(), formIsActive = $bindable(), formHasFullAccess = $bindable(), formAreaIds = $bindable(), formDepartmentIds = $bindable(), onclose, onsubmit, onupgrade, ondowngrade, resetLinkTarget }: Props = $props();
  /* eslint-enable prefer-const, @typescript-eslint/no-useless-default-assignment */

  // =============================================================================
  // LOCAL STATE
  // =============================================================================

  const LEAD_ORDER: string[] = [
    LEAD_POSITION_KEYS.AREA,
    LEAD_POSITION_KEYS.AREA_DEPUTY,
    LEAD_POSITION_KEYS.DEPARTMENT,
    LEAD_POSITION_KEYS.DEPARTMENT_DEPUTY,
    LEAD_POSITION_KEYS.TEAM,
    LEAD_POSITION_KEYS.TEAM_DEPUTY,
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

  let showPassword = $state(false);
  let showPasswordConfirm = $state(false);
  let emailError = $state(false);
  let passwordError = $state(false);
  let passwordScore = $state(-1);
  let passwordLabel = $state('');
  let passwordTime = $state('');

  // ADR-051 §5.3: loading-state for the "Passwort-Reset-Link senden" button.
  // Disables the button + swaps the icon for a spinner during the in-flight
  // request (the Root-initiated-reset endpoint is DB-rate-limited 1/15 min
  // per (root, target) pair — visible UX feedback prevents double-submit).
  let sendingResetLink = $state(false);

  // Pre-call confirmation state — drives the design-system `ConfirmModal`
  // (variant="danger"). Replaces the former native `confirm()` to match
  // the destructive-action visual pattern used elsewhere in the app and
  // avoid the browser-chrome dialog that ignores theming/i18n.
  let showResetLinkConfirm = $state(false);

  /**
   * Open the confirm-dialog for the "Passwort-Reset-Link senden" action
   * (ADR-051 §5.3). The actual API call runs in `confirmSendResetLink`
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
   * approval (ADR-051 §5.3). Error mapping matches the three backend
   * code markers (§2.7); unknown errors fall back to the generic string.
   * 429 is detected via `err.status` because the api-client pre-empts 429
   * with its own `ApiError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED')`
   * BEFORE parsing the body, so the backend's `code: 'RATE_LIMIT'` never
   * reaches the caller as `err.code`.
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
  // HANDLERS
  // =============================================================================

  function validateEmails() {
    emailError = formEmailConfirm !== '' ? formEmail !== formEmailConfirm : false;
  }

  function validatePasswords() {
    passwordError = formPasswordConfirm !== '' ? formPassword !== formPasswordConfirm : false;
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
      showPassword = false;
      showPasswordConfirm = false;
      emailError = false;
      passwordError = false;
      passwordScore = -1;
      passwordLabel = '';
      passwordTime = '';
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
  >
    <form
      id="admin-form"
      class="ds-modal"
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
            bind:value={formEmployeeNumber}
          />
          <span class="form-field__message text-(--color-text-secondary)"
            >{MESSAGES.HINT_EMPLOYEE_NUMBER}</span
          >
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

        {#if resetLinkTarget !== undefined}
          <!--
            ADR-051 §5.3 — Root-initiated Password-Reset-Link.
            Only rendered in edit mode when the parent passed a target.
            Root triggers an email containing a /reset-password link;
            the target sets their own password — Root never sees it.
            Backend enforces @Roles('root') + per-pair DB-rate-limit 1/15 min.

            Styling: `btn-danger` signals the destructive/sensitive nature
            (Root kicks off a credential-reset flow for another user).
            The border-top + description paragraph mirror the Upgrade/
            Downgrade "danger-zone" pattern and visually separate the
            action from the form fields. `align-items: center` on the
            flex-column wrapper overrides the default `stretch` so the
            inline-flex button collapses to content-width and centers.
            Horizontal padding tightened to 8px 12px (default: 8px 16px)
            per UX request — keeps the button compact without using
            `btn-sm` (which would also shrink font-size + border-radius).
          -->
          <div class="mt-4 border-t border-(--color-border) pt-4">
            <p class="mb-4 text-sm text-(--color-text-secondary)">
              Sendet dem Benutzer eine E-Mail mit einem Passwort-Reset-Link. Der Benutzer kann
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
        {/if}
      </div>

      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={onclose}>{MESSAGES.BTN_CANCEL}</button
        >
        <button
          type="submit"
          class="btn btn-secondary"
          disabled={submitting}
        >
          {#if submitting}<span class="spinner-ring spinner-ring--sm mr-2"></span>{/if}
          {MESSAGES.BTN_SAVE}
        </button>
      </div>
    </form>
  </div>
{/if}

<!--
  Confirm-Dialog for ADR-051 §5.3 Password-Reset-Link.
  Rendered outside the parent `{#if show}` block so the ConfirmModal's
  own modal-overlay stacks cleanly on top of AdminFormModal. The reset
  flow is sensitive (Root triggers credential-change for another user)
  → variant="danger" matches the destructive-action pattern used by
  DeleteModals. Resolves on cancel → no-op, on confirm → API call.
-->
<ConfirmModal
  show={showResetLinkConfirm}
  id="reset-link-confirm-modal"
  title={MESSAGES.BTN_SEND_RESET_LINK}
  variant="danger"
  icon="fa-paper-plane"
  confirmLabel={MESSAGES.BTN_SEND_RESET_LINK}
  cancelLabel={MESSAGES.BTN_CANCEL}
  onconfirm={confirmSendResetLink}
  oncancel={cancelSendResetLink}
>
  {MESSAGES.RESET_LINK_CONFIRM}
</ConfirmModal>
