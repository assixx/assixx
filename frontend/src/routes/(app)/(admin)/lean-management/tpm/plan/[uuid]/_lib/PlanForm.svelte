<script lang="ts">
  /**
   * TPM Plan Form Component
   * @module plan/[uuid]/_lib/PlanForm
   *
   * Handles both create and edit mode for maintenance plans.
   * Fields: Machine, Name, Weekday, RepeatEvery, Time, ShiftPlanRequired, Notes.
   */
  import { untrack } from 'svelte';

  import { WEEKDAY_LABELS, MESSAGES } from '../../../_lib/constants';

  import type {
    TpmPlan,
    Machine,
    CreatePlanPayload,
    UpdatePlanPayload,
  } from '../../../_lib/types';

  interface Props {
    plan: TpmPlan | null;
    machines: Machine[];
    isCreateMode: boolean;
    submitting: boolean;
    oncreate: (payload: CreatePlanPayload) => void;
    onupdate: (payload: UpdatePlanPayload) => void;
    oncancel: () => void;
  }

  const {
    plan,
    machines,
    isCreateMode,
    submitting,
    oncreate,
    onupdate,
    oncancel,
  }: Props = $props();

  // =========================================================================
  // FORM STATE
  // =========================================================================

  let machineUuid = $state(
    untrack(() => (plan?.machineName !== undefined ? findMachineUuid() : '')),
  );
  let name = $state(untrack(() => plan?.name ?? ''));
  let baseWeekday = $state(untrack(() => plan?.baseWeekday ?? 0));
  let baseRepeatEvery = $state(untrack(() => plan?.baseRepeatEvery ?? 1));
  let baseTime = $state(untrack(() => plan?.baseTime ?? ''));
  let shiftPlanRequired = $state(
    untrack(() => plan?.shiftPlanRequired ?? true),
  );
  let notes = $state(untrack(() => plan?.notes ?? ''));

  function findMachineUuid(): string {
    if (plan === null) return '';
    const match = machines.find((m: Machine) => m.name === plan.machineName);
    return match?.uuid ?? '';
  }

  // =========================================================================
  // VALIDATION
  // =========================================================================

  const canSubmit = $derived(
    !submitting &&
      name.trim().length > 0 &&
      (isCreateMode ? machineUuid.length > 0 : true),
  );

  // Machines without existing plan (create mode) — no server-side filter needed,
  // the backend will return 409 if machine already has a plan.
  const availableMachines = $derived(
    machines.filter((m: Machine) => m.status !== 'decommissioned'),
  );

  // =========================================================================
  // HANDLERS
  // =========================================================================

  function handleSubmit(e: SubmitEvent): void {
    e.preventDefault();
    if (!canSubmit) return;

    const timeValue = baseTime.trim().length > 0 ? baseTime.trim() : null;
    const notesValue = notes.trim().length > 0 ? notes.trim() : null;

    if (isCreateMode) {
      oncreate({
        machineUuid,
        name: name.trim(),
        baseWeekday,
        baseRepeatEvery,
        baseTime: timeValue,
        shiftPlanRequired,
        notes: notesValue,
      });
    } else {
      onupdate({
        name: name.trim(),
        baseWeekday,
        baseRepeatEvery,
        baseTime: timeValue,
        shiftPlanRequired,
        notes: notesValue,
      });
    }
  }
</script>

<form
  class="plan-form"
  onsubmit={handleSubmit}
>
  <!-- Machine (create only) -->
  {#if isCreateMode}
    <div class="form-group">
      <label
        class="form-label"
        for="machine">{MESSAGES.LABEL_MACHINE}</label
      >
      <select
        id="machine"
        class="form-select"
        bind:value={machineUuid}
        disabled={submitting}
        required
      >
        <option value="">{MESSAGES.PH_MACHINE}</option>
        {#each availableMachines as machine (machine.uuid)}
          <option value={machine.uuid}>
            {machine.name}
            {#if machine.machineNumber}
              ({machine.machineNumber})
            {/if}
          </option>
        {/each}
      </select>
    </div>
  {:else if plan !== null}
    <div class="form-group">
      <span class="form-label">{MESSAGES.LABEL_MACHINE}</span>
      <div class="form-static">
        <i class="fas fa-cog"></i>
        {plan.machineName ?? '—'}
      </div>
    </div>
  {/if}

  <!-- Name -->
  <div class="form-group">
    <label
      class="form-label"
      for="name">{MESSAGES.LABEL_PLAN_NAME}</label
    >
    <input
      id="name"
      type="text"
      class="form-input"
      placeholder={MESSAGES.PH_PLAN_NAME}
      bind:value={name}
      disabled={submitting}
      required
      maxlength={255}
    />
  </div>

  <!-- Weekday + Repeat (side by side) -->
  <div class="form-row">
    <div class="form-group form-group--half">
      <label
        class="form-label"
        for="weekday">{MESSAGES.LABEL_WEEKDAY}</label
      >
      <select
        id="weekday"
        class="form-select"
        bind:value={baseWeekday}
        disabled={submitting}
      >
        {#each WEEKDAY_LABELS as day, i (i)}
          <option value={i}>{day}</option>
        {/each}
      </select>
      <span class="form-help">{MESSAGES.HELP_WEEKDAY}</span>
    </div>

    <div class="form-group form-group--half">
      <label
        class="form-label"
        for="repeat">{MESSAGES.LABEL_REPEAT_EVERY}</label
      >
      <div class="form-input-group">
        <span class="form-input-group__prefix">{MESSAGES.PH_REPEAT}</span>
        <input
          id="repeat"
          type="number"
          class="form-input form-input--narrow"
          bind:value={baseRepeatEvery}
          disabled={submitting}
          min={1}
          max={52}
        />
        <span class="form-input-group__suffix">Woche(n)</span>
      </div>
      <span class="form-help">{MESSAGES.HELP_REPEAT}</span>
    </div>
  </div>

  <!-- Time -->
  <div class="form-group">
    <label
      class="form-label"
      for="time">{MESSAGES.LABEL_TIME}</label
    >
    <input
      id="time"
      type="time"
      class="form-input form-input--narrow"
      placeholder={MESSAGES.PH_TIME}
      bind:value={baseTime}
      disabled={submitting}
    />
  </div>

  <!-- Shift plan required toggle -->
  <div class="form-group">
    <label class="form-toggle">
      <input
        type="checkbox"
        class="form-toggle__input"
        bind:checked={shiftPlanRequired}
        disabled={submitting}
      />
      <span class="form-toggle__slider"></span>
      <span class="form-toggle__label">{MESSAGES.LABEL_SHIFT_REQUIRED}</span>
    </label>
    <span class="form-help">{MESSAGES.HELP_SHIFT_REQUIRED}</span>
  </div>

  <!-- Notes -->
  <div class="form-group">
    <label
      class="form-label"
      for="notes">{MESSAGES.LABEL_NOTES}</label
    >
    <textarea
      id="notes"
      class="form-textarea"
      placeholder={MESSAGES.PH_NOTES}
      bind:value={notes}
      disabled={submitting}
      rows={3}
      maxlength={5000}
    ></textarea>
  </div>

  <!-- Actions -->
  <div class="form-actions">
    <button
      type="button"
      class="btn btn--ghost"
      onclick={oncancel}
      disabled={submitting}
    >
      {MESSAGES.BTN_CANCEL}
    </button>
    <button
      type="submit"
      class="btn btn--primary"
      disabled={!canSubmit}
    >
      {#if submitting}
        <i class="fas fa-spinner fa-spin"></i>
      {/if}
      {isCreateMode ? MESSAGES.BTN_CREATE_PLAN : MESSAGES.BTN_SAVE}
    </button>
  </div>
</form>

<style>
  .plan-form {
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
    max-width: 160px;
  }

  .form-static {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    background: var(--color-gray-50);
    border-radius: var(--radius-md, 8px);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-gray-700);
  }

  .form-help {
    font-size: 0.75rem;
    color: var(--color-gray-500);
  }

  .form-textarea {
    resize: vertical;
    min-height: 80px;
  }

  /* Input group (prefix + input + suffix) */
  .form-input-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .form-input-group__prefix,
  .form-input-group__suffix {
    font-size: 0.875rem;
    color: var(--color-gray-500);
    white-space: nowrap;
  }

  .form-input-group .form-input {
    width: 80px;
    text-align: center;
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
