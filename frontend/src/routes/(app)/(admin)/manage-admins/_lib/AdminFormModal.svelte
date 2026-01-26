<script lang="ts">
  import { POSITION_OPTIONS, MESSAGES, STATUS_OPTIONS } from './constants';
  import { filterAvailableDepartments, filterDepartmentIdsByAreas } from './filters';
  import { getStatusBadgeClass, getStatusLabel, calculatePasswordStrength } from './utils';

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
  }

  /* eslint-disable */
  // prettier-ignore
  let { show, isEditMode, modalTitle, allAreas, allDepartments, submitting, formFirstName = $bindable(), formLastName = $bindable(), formEmail = $bindable(), formEmailConfirm = $bindable(), formPassword = $bindable(), formPasswordConfirm = $bindable(), formEmployeeNumber = $bindable(), formPosition = $bindable(), formNotes = $bindable(), formIsActive = $bindable(), formHasFullAccess = $bindable(), formAreaIds = $bindable(), formDepartmentIds = $bindable(), onclose, onsubmit }: Props = $props();
  /* eslint-enable */

  // =============================================================================
  // LOCAL STATE
  // =============================================================================

  let positionDropdownOpen = $state(false);
  let statusDropdownOpen = $state(false);
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

  const availableDepartments = $derived.by(() => {
    return filterAvailableDepartments(allDepartments, formAreaIds, formHasFullAccess);
  });

  // =============================================================================
  // HANDLERS
  // =============================================================================

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }

  function togglePositionDropdown(e: MouseEvent) {
    e.stopPropagation();
    statusDropdownOpen = false;
    positionDropdownOpen = !positionDropdownOpen;
  }

  function selectPosition(position: string) {
    formPosition = position;
    positionDropdownOpen = false;
  }

  function toggleStatusDropdown(e: MouseEvent) {
    e.stopPropagation();
    positionDropdownOpen = false;
    statusDropdownOpen = !statusDropdownOpen;
  }

  function selectStatus(status: FormIsActiveStatus) {
    formIsActive = status;
    statusDropdownOpen = false;
  }

  function handleAreaChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    formAreaIds = Array.from(select.selectedOptions).map((opt) => parseInt(opt.value, 10));
    formDepartmentIds = filterDepartmentIdsByAreas(formDepartmentIds, allDepartments, formAreaIds);
  }

  function handleDepartmentChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    formDepartmentIds = Array.from(select.selectedOptions).map((opt) => parseInt(opt.value, 10));
  }

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
  // OUTSIDE CLICK EFFECT
  // =============================================================================

  $effect(() => {
    if (positionDropdownOpen || statusDropdownOpen) {
      const handleOutsideClick = (e: MouseEvent) => {
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
      document.addEventListener('click', handleOutsideClick);
      return () => {
        document.removeEventListener('click', handleOutsideClick);
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
        <h3 class="ds-modal__title" id="admin-modal-title">{modalTitle}</h3>
        <button type="button" class="ds-modal__close" aria-label="Schließen" onclick={onclose}>
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body">
        <div class="form-field">
          <label class="form-field__label" for="admin-first-name">
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
          <label class="form-field__label" for="admin-last-name">
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
          <label class="form-field__label" for="admin-email">
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

        <div class="form-field" id="email-confirm-group">
          <label class="form-field__label" for="admin-email-confirm">
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

        <div class="form-field" id="password-group">
          <label class="form-field__label" for="admin-password">
            {MESSAGES.LABEL_PASSWORD}
            {#if !isEditMode}<span class="text-red-500">*</span>{/if}
            <span class="tooltip ml-1">
              <i class="fas fa-info-circle text-blue-400 text-sm cursor-help"></i>
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
              <i class="fas" class:fa-eye={!showPassword} class:fa-eye-slash={showPassword}></i>
            </button>
          </div>
        </div>

        <div class="form-field" id="password-confirm-group">
          <label class="form-field__label" for="admin-password-confirm">
            {MESSAGES.LABEL_PASSWORD_CONFIRM}
            {#if !isEditMode}<span class="text-red-500">*</span>{/if}
          </label>
          <div class="form-field__password-wrapper">
            <input
              type={showPasswordConfirm ? 'text' : 'password'}
              id="admin-password-confirm"
              name="passwordConfirm"
              class="form-field__control"
              class:is-error={passwordError}
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
          {/if}
        </div>

        {#if formPassword}
          <div class="password-strength-container" id="admin-password-strength-container">
            <div class="password-strength-meter">
              <div class="password-strength-bar" data-score={passwordScore}></div>
            </div>
            <div class="password-strength-info">
              <span class="password-strength-label">{passwordLabel}</span>
              <span class="password-strength-time">{passwordTime}</span>
            </div>
          </div>
        {/if}

        <div class="form-field">
          <label class="form-field__label" for="admin-employee-number">
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
          <span class="form-field__message text-[var(--color-text-secondary)]"
            >{MESSAGES.HINT_EMPLOYEE_NUMBER}</span
          >
        </div>

        <div class="form-field">
          <label class="form-field__label" for="admin-position">
            {MESSAGES.LABEL_POSITION} <span class="text-red-500">*</span>
          </label>
          <div class="dropdown" id="position-dropdown">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="dropdown__trigger"
              class:active={positionDropdownOpen}
              onclick={togglePositionDropdown}
            >
              <span>{formPosition !== '' ? formPosition : 'Bitte wählen...'}</span>
              <i class="fas fa-chevron-down"></i>
            </div>
            <div class="dropdown__menu" class:active={positionDropdownOpen}>
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
          <label class="form-field__label" for="admin-notes">{MESSAGES.LABEL_NOTES}</label>
          <textarea
            id="admin-notes"
            name="notes"
            class="form-field__control"
            rows="3"
            bind:value={formNotes}
          ></textarea>
        </div>

        <!-- N:M Organization Assignment Section -->
        <div class="mt-6 pt-6 border-t border-[var(--color-border)]">
          <h4 class="text-[var(--color-text-primary)] font-medium mb-4">
            <i class="fas fa-sitemap mr-2"></i>
            Organisationszuweisung
          </h4>

          <div class="form-field mb-4">
            <label class="toggle-switch toggle-switch--danger">
              <input
                type="checkbox"
                class="toggle-switch__input"
                id="admin-full-access"
                bind:checked={formHasFullAccess}
              />
              <span class="toggle-switch__slider"></span>
              <span class="toggle-switch__label">
                <i class="fas fa-building mr-2"></i>
                {MESSAGES.FULL_ACCESS_LABEL}
              </span>
            </label>
            <span class="form-field__message text-[var(--color-danger)] mt-2 block">
              <i class="fas fa-exclamation-triangle mr-1"></i>
              {MESSAGES.FULL_ACCESS_WARNING}
            </span>
          </div>

          <div
            class="form-field mb-4"
            id="admin-area-select-container"
            class:opacity-50={formHasFullAccess}
          >
            <label class="form-field__label" for="admin-areas">
              <i class="fas fa-layer-group mr-1"></i>
              {MESSAGES.LABEL_AREAS}
            </label>
            <select
              id="admin-areas"
              name="areaIds"
              multiple
              class="form-field__control min-h-[100px]"
              disabled={formHasFullAccess}
              onchange={handleAreaChange}
            >
              {#each allAreas as area (area.id)}
                <option value={area.id} selected={formAreaIds.includes(area.id)}>
                  {area.name}{area.departmentCount !== undefined && area.departmentCount > 0
                    ? ` (${area.departmentCount} Abt.)`
                    : ''}
                </option>
              {/each}
            </select>
            <span class="form-field__message text-[var(--color-text-secondary)]">
              <i class="fas fa-info-circle mr-1"></i>
              {MESSAGES.HINT_MULTISELECT}
              {MESSAGES.HINT_AREAS}
            </span>
          </div>

          <div
            class="form-field mb-4"
            id="admin-department-select-container"
            class:opacity-50={formHasFullAccess}
          >
            <label class="form-field__label" for="admin-departments">
              <i class="fas fa-sitemap mr-1"></i>
              {MESSAGES.LABEL_DEPARTMENTS}
            </label>
            <select
              id="admin-departments"
              name="departmentIds"
              multiple
              class="form-field__control min-h-[120px]"
              disabled={formHasFullAccess}
              onchange={handleDepartmentChange}
            >
              {#each availableDepartments as dept (dept.id)}
                <option value={dept.id} selected={formDepartmentIds.includes(dept.id)}>
                  {dept.name}{dept.areaName !== undefined && dept.areaName !== ''
                    ? ` (${dept.areaName})`
                    : ''}
                </option>
              {/each}
            </select>
            <span class="form-field__message text-[var(--color-text-secondary)]">
              <i class="fas fa-info-circle mr-1"></i>
              {MESSAGES.HINT_MULTISELECT}
              {MESSAGES.HINT_DEPARTMENTS}
            </span>
          </div>

          <!-- svelte-ignore a11y_label_has_associated_control -->
          <div class="form-field" id="admin-team-info-container">
            <label class="form-field__label">
              <i class="fas fa-users mr-1"></i>
              {MESSAGES.LABEL_TEAMS}
            </label>
            <div class="alert alert--info">
              <div class="alert__icon">
                <i class="fas fa-info-circle"></i>
              </div>
              <div class="alert__content">
                <div class="alert__message">{MESSAGES.HINT_TEAMS}</div>
              </div>
            </div>
          </div>
        </div>

        {#if isEditMode}
          <div class="form-field" id="active-status-group">
            <label class="form-field__label" for="admin-status">
              {MESSAGES.LABEL_STATUS} <span class="text-red-500">*</span>
            </label>
            <div class="dropdown" id="status-dropdown">
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
              <div class="dropdown__menu" class:active={statusDropdownOpen}>
                {#each STATUS_OPTIONS as opt (opt.value)}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="dropdown__option"
                    onclick={() => {
                      selectStatus(opt.value);
                    }}
                  >
                    <span class="badge {opt.class}">{opt.label}</span>
                  </div>
                {/each}
              </div>
            </div>
            <span class="form-field__message text-[var(--color-text-secondary)] mt-1 block">
              {MESSAGES.HINT_STATUS}
            </span>
          </div>
        {/if}
      </div>

      <div class="ds-modal__footer">
        <button type="button" class="btn btn-cancel" onclick={onclose}>{MESSAGES.BTN_CANCEL}</button
        >
        <button type="submit" class="btn btn-modal" disabled={submitting}>
          {#if submitting}<span class="spinner-ring spinner-ring--sm mr-2"></span>{/if}
          {MESSAGES.BTN_SAVE}
        </button>
      </div>
    </form>
  </div>
{/if}
