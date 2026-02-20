<script lang="ts">
  /**
   * TPM Card Form Component
   * @module cards/[uuid]/_lib/CardForm
   *
   * Handles both create and edit mode for maintenance cards.
   * Fields: CardRole, IntervalType, Title, Description, Location, RequiresApproval, CustomIntervalDays.
   */
  import { untrack } from 'svelte';

  import {
    INTERVAL_LABELS,
    CARD_ROLE_LABELS,
    MESSAGES,
  } from '../../../_lib/constants';

  import type {
    TpmCard,
    CardRole,
    IntervalType,
    CreateCardPayload,
    UpdateCardPayload,
  } from '../../../_lib/types';

  interface Props {
    card: TpmCard | null;
    planUuid: string;
    isCreateMode: boolean;
    submitting: boolean;
    oncreate: (payload: CreateCardPayload) => void;
    onupdate: (payload: UpdateCardPayload) => void;
    oncancel: () => void;
  }

  const {
    card,
    planUuid,
    isCreateMode,
    submitting,
    oncreate,
    onupdate,
    oncancel,
  }: Props = $props();

  // =========================================================================
  // FORM STATE
  // =========================================================================

  let cardRole = $state<CardRole>(untrack(() => card?.cardRole ?? 'operator'));
  let intervalType = $state<IntervalType>(
    untrack(() => card?.intervalType ?? 'daily'),
  );
  let title = $state(untrack(() => card?.title ?? ''));
  let description = $state(untrack(() => card?.description ?? ''));
  let locationDescription = $state(
    untrack(() => card?.locationDescription ?? ''),
  );
  let requiresApproval = $state(untrack(() => card?.requiresApproval ?? false));
  let customIntervalDays = $state(
    untrack(() => card?.customIntervalDays ?? 30),
  );

  // =========================================================================
  // VALIDATION
  // =========================================================================

  const isCustomInterval = $derived(intervalType === 'custom');
  const canSubmit = $derived(!submitting && title.trim().length > 0);

  // =========================================================================
  // DROPDOWN STATE
  // =========================================================================

  let roleDropdownOpen = $state(false);
  let intervalDropdownOpen = $state(false);

  function closeAllDropdowns(): void {
    roleDropdownOpen = false;
    intervalDropdownOpen = false;
  }

  $effect(() => {
    const anyOpen = roleDropdownOpen || intervalDropdownOpen;
    if (!anyOpen) return;

    function handleClickOutside(event: MouseEvent): void {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown')) {
        closeAllDropdowns();
      }
    }

    document.addEventListener('click', handleClickOutside, true);
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  });

  // =========================================================================
  // DERIVED DISPLAY TEXT
  // =========================================================================

  const selectedRoleText = $derived(CARD_ROLE_LABELS[cardRole]);
  const selectedIntervalText = $derived(INTERVAL_LABELS[intervalType]);

  // =========================================================================
  // CONSTANTS
  // =========================================================================

  const INTERVAL_OPTIONS: IntervalType[] = [
    'daily',
    'weekly',
    'monthly',
    'quarterly',
    'semi_annual',
    'annual',
    'long_runner',
    'custom',
  ];

  const ROLE_OPTIONS: CardRole[] = ['operator', 'maintenance'];

  // =========================================================================
  // HANDLERS
  // =========================================================================

  function handleSubmit(e: SubmitEvent): void {
    e.preventDefault();
    if (!canSubmit) return;

    const descValue = description.trim().length > 0 ? description.trim() : null;
    const locValue =
      locationDescription.trim().length > 0 ? locationDescription.trim() : null;
    const customDays = isCustomInterval ? customIntervalDays : null;

    if (isCreateMode) {
      oncreate({
        planUuid,
        cardRole,
        intervalType,
        title: title.trim(),
        description: descValue,
        locationDescription: locValue,
        requiresApproval,
        customIntervalDays: customDays,
      });
    } else {
      onupdate({
        cardRole,
        intervalType,
        title: title.trim(),
        description: descValue,
        locationDescription: locValue,
        requiresApproval,
        customIntervalDays: customDays,
      });
    }
  }
</script>

<form
  class="card-form"
  onsubmit={handleSubmit}
>
  <!-- Card Role + Interval Type (side by side) -->
  <div class="form-row">
    <div class="form-field card-form__half">
      <span class="form-field__label">{MESSAGES.LABEL_CARD_ROLE}</span>
      <div class="dropdown">
        <button
          type="button"
          class="dropdown__trigger"
          class:active={roleDropdownOpen}
          disabled={submitting}
          onclick={() => {
            const wasOpen = roleDropdownOpen;
            closeAllDropdowns();
            roleDropdownOpen = !wasOpen;
          }}
        >
          <span>{selectedRoleText}</span>
          <i class="fas fa-chevron-down"></i>
        </button>
        <div
          class="dropdown__menu"
          class:active={roleDropdownOpen}
        >
          {#each ROLE_OPTIONS as role (role)}
            <button
              type="button"
              class="dropdown__option"
              class:dropdown__option--selected={cardRole === role}
              onclick={() => {
                cardRole = role;
                roleDropdownOpen = false;
              }}
            >
              {CARD_ROLE_LABELS[role]}
            </button>
          {/each}
        </div>
      </div>
      <span class="form-field__message">{MESSAGES.HELP_CARD_ROLE}</span>
    </div>

    <div class="form-field card-form__half">
      <span class="form-field__label">{MESSAGES.LABEL_INTERVAL_TYPE}</span>
      <div class="dropdown">
        <button
          type="button"
          class="dropdown__trigger"
          class:active={intervalDropdownOpen}
          disabled={submitting}
          onclick={() => {
            const wasOpen = intervalDropdownOpen;
            closeAllDropdowns();
            intervalDropdownOpen = !wasOpen;
          }}
        >
          <span>{selectedIntervalText}</span>
          <i class="fas fa-chevron-down"></i>
        </button>
        <div
          class="dropdown__menu dropdown__menu--scrollable"
          class:active={intervalDropdownOpen}
        >
          {#each INTERVAL_OPTIONS as intv (intv)}
            <button
              type="button"
              class="dropdown__option"
              class:dropdown__option--selected={intervalType === intv}
              onclick={() => {
                intervalType = intv;
                intervalDropdownOpen = false;
              }}
            >
              {INTERVAL_LABELS[intv]}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <!-- Custom interval days (only for custom) -->
  {#if isCustomInterval}
    <div class="form-field">
      <label
        class="form-field__label"
        for="customDays">{MESSAGES.LABEL_CUSTOM_INTERVAL_DAYS}</label
      >
      <div class="form-input-group">
        <input
          id="customDays"
          type="number"
          class="form-field__control card-form__narrow"
          bind:value={customIntervalDays}
          disabled={submitting}
          min={1}
          max={3650}
          required
        />
        <span class="form-input-group__suffix">{MESSAGES.PH_CUSTOM_DAYS}</span>
      </div>
      <span class="form-field__message">{MESSAGES.HELP_CUSTOM_INTERVAL}</span>
    </div>
  {/if}

  <!-- Title -->
  <div class="form-field">
    <label
      class="form-field__label"
      for="title">{MESSAGES.LABEL_TITLE}</label
    >
    <input
      id="title"
      type="text"
      class="form-field__control"
      placeholder={MESSAGES.PH_TITLE}
      bind:value={title}
      disabled={submitting}
      required
      maxlength={255}
    />
  </div>

  <!-- Description -->
  <div class="form-field">
    <label
      class="form-field__label"
      for="description">{MESSAGES.LABEL_DESCRIPTION}</label
    >
    <textarea
      id="description"
      class="form-field__control form-field__control--textarea"
      placeholder={MESSAGES.PH_DESCRIPTION}
      bind:value={description}
      disabled={submitting}
      rows={4}
      maxlength={5000}
    ></textarea>
  </div>

  <!-- Location -->
  <div class="form-field">
    <label
      class="form-field__label"
      for="location">{MESSAGES.LABEL_LOCATION}</label
    >
    <input
      id="location"
      type="text"
      class="form-field__control"
      placeholder={MESSAGES.PH_LOCATION}
      bind:value={locationDescription}
      disabled={submitting}
      maxlength={1000}
    />
  </div>

  <!-- Requires Approval toggle -->
  <div class="form-field">
    <label class="toggle-switch">
      <input
        type="checkbox"
        class="toggle-switch__input"
        bind:checked={requiresApproval}
        disabled={submitting}
      />
      <span class="toggle-switch__slider"></span>
      <span class="toggle-switch__label"
        >{MESSAGES.LABEL_REQUIRES_APPROVAL}</span
      >
    </label>
    <span class="form-field__message">{MESSAGES.HELP_REQUIRES_APPROVAL}</span>
  </div>

  <!-- Actions -->
  <div class="form-actions">
    <button
      type="button"
      class="btn btn-cancel"
      onclick={oncancel}
      disabled={submitting}
    >
      {MESSAGES.BTN_CANCEL_FORM}
    </button>
    <button
      type="submit"
      class="btn btn-primary"
      disabled={!canSubmit}
    >
      {#if submitting}
        <i class="fas fa-spinner fa-spin"></i>
      {/if}
      {isCreateMode ? MESSAGES.BTN_CREATE_CARD : MESSAGES.BTN_SAVE}
    </button>
  </div>
</form>

<style>
  .card-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-row {
    display: flex;
    gap: 1rem;
  }

  .card-form__half {
    flex: 1;
    min-width: 0;
  }

  .card-form__narrow {
    max-width: 120px;
  }

  .form-input-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .form-input-group__suffix {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-glass-border);
  }

  @media (width <= 640px) {
    .form-row {
      flex-direction: column;
    }
  }
</style>
