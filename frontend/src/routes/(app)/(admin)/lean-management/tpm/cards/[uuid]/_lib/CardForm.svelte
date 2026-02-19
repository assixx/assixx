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
    <div class="form-group form-group--half">
      <label
        class="form-label"
        for="cardRole">{MESSAGES.LABEL_CARD_ROLE}</label
      >
      <select
        id="cardRole"
        class="form-select"
        bind:value={cardRole}
        disabled={submitting}
      >
        {#each ROLE_OPTIONS as role (role)}
          <option value={role}>{CARD_ROLE_LABELS[role]}</option>
        {/each}
      </select>
      <span class="form-help">{MESSAGES.HELP_CARD_ROLE}</span>
    </div>

    <div class="form-group form-group--half">
      <label
        class="form-label"
        for="intervalType">{MESSAGES.LABEL_INTERVAL_TYPE}</label
      >
      <select
        id="intervalType"
        class="form-select"
        bind:value={intervalType}
        disabled={submitting}
      >
        {#each INTERVAL_OPTIONS as intv (intv)}
          <option value={intv}>{INTERVAL_LABELS[intv]}</option>
        {/each}
      </select>
    </div>
  </div>

  <!-- Custom interval days (only for custom) -->
  {#if isCustomInterval}
    <div class="form-group">
      <label
        class="form-label"
        for="customDays">{MESSAGES.LABEL_CUSTOM_INTERVAL_DAYS}</label
      >
      <div class="form-input-group">
        <input
          id="customDays"
          type="number"
          class="form-input form-input--narrow"
          bind:value={customIntervalDays}
          disabled={submitting}
          min={1}
          max={3650}
          required
        />
        <span class="form-input-group__suffix">{MESSAGES.PH_CUSTOM_DAYS}</span>
      </div>
      <span class="form-help">{MESSAGES.HELP_CUSTOM_INTERVAL}</span>
    </div>
  {/if}

  <!-- Title -->
  <div class="form-group">
    <label
      class="form-label"
      for="title">{MESSAGES.LABEL_TITLE}</label
    >
    <input
      id="title"
      type="text"
      class="form-input"
      placeholder={MESSAGES.PH_TITLE}
      bind:value={title}
      disabled={submitting}
      required
      maxlength={255}
    />
  </div>

  <!-- Description -->
  <div class="form-group">
    <label
      class="form-label"
      for="description">{MESSAGES.LABEL_DESCRIPTION}</label
    >
    <textarea
      id="description"
      class="form-textarea"
      placeholder={MESSAGES.PH_DESCRIPTION}
      bind:value={description}
      disabled={submitting}
      rows={4}
      maxlength={5000}
    ></textarea>
  </div>

  <!-- Location -->
  <div class="form-group">
    <label
      class="form-label"
      for="location">{MESSAGES.LABEL_LOCATION}</label
    >
    <input
      id="location"
      type="text"
      class="form-input"
      placeholder={MESSAGES.PH_LOCATION}
      bind:value={locationDescription}
      disabled={submitting}
      maxlength={1000}
    />
  </div>

  <!-- Requires Approval toggle -->
  <div class="form-group">
    <label class="form-toggle">
      <input
        type="checkbox"
        class="form-toggle__input"
        bind:checked={requiresApproval}
        disabled={submitting}
      />
      <span class="form-toggle__slider"></span>
      <span class="form-toggle__label">{MESSAGES.LABEL_REQUIRES_APPROVAL}</span>
    </label>
    <span class="form-help">{MESSAGES.HELP_REQUIRES_APPROVAL}</span>
  </div>

  <!-- Actions -->
  <div class="form-actions">
    <button
      type="button"
      class="btn btn--ghost"
      onclick={oncancel}
      disabled={submitting}
    >
      {MESSAGES.BTN_CANCEL_FORM}
    </button>
    <button
      type="submit"
      class="btn btn--primary"
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

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .form-group--half {
    flex: 1;
    min-width: 0;
  }

  .form-row {
    display: flex;
    gap: 1rem;
  }

  .form-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-gray-700);
  }

  .form-input,
  .form-select,
  .form-textarea {
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--color-gray-300);
    border-radius: var(--radius-md, 8px);
    font-size: 0.875rem;
    color: var(--color-gray-900);
    background: var(--color-white, #fff);
    transition: border-color 0.15s;
  }

  .form-input:focus,
  .form-select:focus,
  .form-textarea:focus {
    outline: none;
    border-color: var(--color-blue-500);
    box-shadow: 0 0 0 3px rgb(59 130 246 / 10%);
  }

  .form-input:disabled,
  .form-select:disabled,
  .form-textarea:disabled {
    background: var(--color-gray-50);
    cursor: not-allowed;
  }

  .form-input--narrow {
    max-width: 120px;
  }

  .form-help {
    font-size: 0.75rem;
    color: var(--color-gray-500);
  }

  .form-textarea {
    resize: vertical;
    min-height: 80px;
  }

  /* Input group (input + suffix) */
  .form-input-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .form-input-group__suffix {
    font-size: 0.875rem;
    color: var(--color-gray-500);
    white-space: nowrap;
  }

  /* Toggle */
  .form-toggle {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
  }

  .form-toggle__input {
    position: absolute;
    opacity: 0%;
    width: 0;
    height: 0;
  }

  .form-toggle__slider {
    position: relative;
    width: 44px;
    height: 24px;
    background: var(--color-gray-300);
    border-radius: 12px;
    transition: background 0.2s;
    flex-shrink: 0;
  }

  .form-toggle__slider::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
  }

  .form-toggle__input:checked + .form-toggle__slider {
    background: var(--color-blue-500);
  }

  .form-toggle__input:checked + .form-toggle__slider::after {
    transform: translateX(20px);
  }

  .form-toggle__input:disabled + .form-toggle__slider {
    opacity: 50%;
    cursor: not-allowed;
  }

  .form-toggle__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-gray-700);
  }

  /* Actions */
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-gray-200);
  }

  /* Responsive */
  @media (width <= 640px) {
    .form-row {
      flex-direction: column;
    }
  }
</style>
