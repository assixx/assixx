<script lang="ts">
  /**
   * TPM Plan Form Component
   * @module plan/[uuid]/_lib/PlanForm
   *
   * Handles both create and edit mode for maintenance plans.
   * Fields: Machine, Name, Weekday, RepeatEvery, Time, ShiftPlanRequired, Notes.
   */
  import { untrack } from 'svelte';

  import AppTimePicker from '$lib/components/AppTimePicker.svelte';

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
  // DROPDOWN STATE
  // =========================================================================

  let machineDropdownOpen = $state(false);
  let weekdayDropdownOpen = $state(false);

  function closeAllDropdowns(): void {
    machineDropdownOpen = false;
    weekdayDropdownOpen = false;
  }

  $effect(() => {
    const anyOpen = machineDropdownOpen || weekdayDropdownOpen;
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
  // DERIVED DISPLAY TEXT
  // =========================================================================

  const selectedMachineText = $derived.by(() => {
    if (machineUuid === '') return MESSAGES.PH_MACHINE;
    const match = availableMachines.find(
      (m: Machine) => m.uuid === machineUuid,
    );
    if (match === undefined) return MESSAGES.PH_MACHINE;
    return match.machineNumber !== null && match.machineNumber !== '' ?
        `${match.name} (${match.machineNumber})`
      : match.name;
  });

  const selectedWeekdayText = $derived(WEEKDAY_LABELS[baseWeekday] ?? '—');

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
    <div class="form-field">
      <span class="form-field__label">{MESSAGES.LABEL_MACHINE}</span>
      <div class="dropdown">
        <button
          type="button"
          class="dropdown__trigger"
          class:active={machineDropdownOpen}
          disabled={submitting}
          onclick={() => {
            const wasOpen = machineDropdownOpen;
            closeAllDropdowns();
            machineDropdownOpen = !wasOpen;
          }}
        >
          <span>{selectedMachineText}</span>
          <i class="fas fa-chevron-down"></i>
        </button>
        <div
          class="dropdown__menu dropdown__menu--scrollable"
          class:active={machineDropdownOpen}
        >
          {#each availableMachines as machine (machine.uuid)}
            <button
              type="button"
              class="dropdown__option"
              class:dropdown__option--selected={machineUuid === machine.uuid}
              onclick={() => {
                machineUuid = machine.uuid;
                machineDropdownOpen = false;
              }}
            >
              {machine.name}
              {#if machine.machineNumber}
                ({machine.machineNumber})
              {/if}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {:else if plan !== null}
    <div class="form-field">
      <span class="form-field__label">{MESSAGES.LABEL_MACHINE}</span>
      <div class="form-static">
        <i class="fas fa-cog"></i>
        {plan.machineName ?? '—'}
      </div>
    </div>
  {/if}

  <!-- Name -->
  <div class="form-field">
    <label
      class="form-field__label"
      for="name">{MESSAGES.LABEL_PLAN_NAME}</label
    >
    <input
      id="name"
      type="text"
      class="form-field__control"
      placeholder={MESSAGES.PH_PLAN_NAME}
      bind:value={name}
      disabled={submitting}
      required
      maxlength={255}
    />
  </div>

  <!-- Weekday + Repeat (side by side) -->
  <div class="form-row">
    <div class="form-field plan-form__half">
      <span class="form-field__label">{MESSAGES.LABEL_WEEKDAY}</span>
      <div class="dropdown">
        <button
          type="button"
          class="dropdown__trigger"
          class:active={weekdayDropdownOpen}
          disabled={submitting}
          onclick={() => {
            const wasOpen = weekdayDropdownOpen;
            closeAllDropdowns();
            weekdayDropdownOpen = !wasOpen;
          }}
        >
          <span>{selectedWeekdayText}</span>
          <i class="fas fa-chevron-down"></i>
        </button>
        <div
          class="dropdown__menu"
          class:active={weekdayDropdownOpen}
        >
          {#each WEEKDAY_LABELS as day, i (i)}
            <button
              type="button"
              class="dropdown__option"
              class:dropdown__option--selected={baseWeekday === i}
              onclick={() => {
                baseWeekday = i;
                weekdayDropdownOpen = false;
              }}
            >
              {day}
            </button>
          {/each}
        </div>
      </div>
      <span class="form-field__message">{MESSAGES.HELP_WEEKDAY}</span>
    </div>

    <div class="form-field plan-form__half">
      <label
        class="form-field__label"
        for="repeat">{MESSAGES.LABEL_REPEAT_EVERY}</label
      >
      <div class="form-input-group">
        <span class="form-input-group__prefix">{MESSAGES.PH_REPEAT}</span>
        <input
          id="repeat"
          type="number"
          class="form-field__control plan-form__narrow"
          bind:value={baseRepeatEvery}
          disabled={submitting}
          min={1}
          max={52}
        />
        <span class="form-input-group__suffix">Woche(n)</span>
      </div>
      <span class="form-field__message">{MESSAGES.HELP_REPEAT}</span>
    </div>
  </div>

  <!-- Time -->
  <div class="form-field">
    <span class="form-field__label">{MESSAGES.LABEL_TIME}</span>
    <AppTimePicker
      bind:value={baseTime}
      disabled={submitting}
    />
  </div>

  <!-- Shift plan required toggle -->
  <div class="form-field">
    <label class="toggle-switch">
      <input
        type="checkbox"
        class="toggle-switch__input"
        bind:checked={shiftPlanRequired}
        disabled={submitting}
      />
      <span class="toggle-switch__slider"></span>
      <span class="toggle-switch__label">{MESSAGES.LABEL_SHIFT_REQUIRED}</span>
    </label>
    <span class="form-field__message">{MESSAGES.HELP_SHIFT_REQUIRED}</span>
  </div>

  <!-- Notes -->
  <div class="form-field">
    <label
      class="form-field__label"
      for="notes">{MESSAGES.LABEL_NOTES}</label
    >
    <textarea
      id="notes"
      class="form-field__control form-field__control--textarea"
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
      class="btn btn-cancel"
      onclick={oncancel}
      disabled={submitting}
    >
      {MESSAGES.BTN_CANCEL}
    </button>
    <button
      type="submit"
      class="btn btn-primary"
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

  .form-row {
    display: flex;
    gap: 1rem;
  }

  .plan-form__half {
    flex: 1;
    min-width: 0;
  }

  .plan-form__narrow {
    max-width: 160px;
  }

  .form-static {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    background: var(--glass-bg-hover);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .form-input-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .form-input-group__prefix,
  .form-input-group__suffix {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .form-input-group .plan-form__narrow {
    width: 80px;
    text-align: center;
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
