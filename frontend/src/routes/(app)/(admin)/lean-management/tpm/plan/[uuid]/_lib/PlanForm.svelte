<script lang="ts">
  /**
   * TPM Plan Form Component
   * @module plan/[uuid]/_lib/PlanForm
   *
   * Handles both create and edit mode for maintenance plans.
   * Fields: Machine, Name, Weekday, RepeatEvery, Time, TimeEstimates,
   * ShiftPlanRequired, Notes.
   */
  import { untrack } from 'svelte';

  import AppTimePicker from '$lib/components/AppTimePicker.svelte';

  import {
    ESTIMATE_INTERVALS,
    WEEKDAY_LABELS,
    MESSAGES,
  } from '../../../_lib/constants';

  import TimeEstimateEditor from './TimeEstimateEditor.svelte';

  import type {
    TpmPlan,
    TpmTimeEstimate,
    Machine,
    TpmArea,
    TpmDepartment,
    CreatePlanPayload,
    UpdatePlanPayload,
    CreateTimeEstimatePayload,
  } from '../../../_lib/types';

  interface Props {
    plan: TpmPlan | null;
    machines: Machine[];
    areas: TpmArea[];
    departments: TpmDepartment[];
    machineUuidsWithPlans?: string[];
    timeEstimates?: TpmTimeEstimate[];
    isCreateMode: boolean;
    submitting: boolean;
    oncreate: (payload: CreatePlanPayload) => void;
    onupdate: (
      payload: UpdatePlanPayload,
      estimates: CreateTimeEstimatePayload[],
    ) => void;
    oncancel: () => void;
    onmachinechange?: (machineUuid: string) => void;
    onshiftplanchange?: (shiftPlanRequired: boolean) => void;
  }

  const {
    plan,
    machines,
    areas,
    departments,
    machineUuidsWithPlans = [],
    timeEstimates = [],
    isCreateMode,
    submitting,
    oncreate,
    onupdate,
    oncancel,
    onmachinechange,
    onshiftplanchange,
  }: Props = $props();

  // Machines that already have an active TPM plan (disabled in dropdown)
  const machineUuidsWithPlanSet = $derived(new Set(machineUuidsWithPlans));
  function machineHasPlan(uuid: string): boolean {
    return machineUuidsWithPlanSet.has(uuid);
  }

  // =========================================================================
  // FORM STATE
  // =========================================================================

  // Cascade state (Area → Department → Machine)
  let formAreaId = $state<number | null>(null);
  let formDepartmentId = $state<number | null>(null);
  let machineUuid = $state(
    untrack(() => (plan?.machineName !== undefined ? findMachineUuid() : '')),
  );

  let name = $state(untrack(() => plan?.name ?? ''));
  let baseWeekday = $state(untrack(() => plan?.baseWeekday ?? 0));
  let baseRepeatEvery = $state(untrack(() => plan?.baseRepeatEvery ?? 1));
  let baseTime = $state(untrack(() => plan?.baseTime ?? ''));
  let isAllDay = $state(
    untrack(() => (plan?.baseTime ?? '').trim().length === 0),
  );
  let bufferHours = $state(untrack(() => plan?.bufferHours ?? 4));
  let shiftPlanRequired = $state(
    untrack(() => plan?.shiftPlanRequired ?? false),
  );
  let notes = $state(untrack(() => plan?.notes ?? ''));

  // =========================================================================
  // TIME ESTIMATE STATE
  // =========================================================================
  interface EstimateFields {
    staffCount: number;
    preparationMinutes: number;
    executionMinutes: number;
    followupMinutes: number;
  }

  let showTimeEstimates = $state(untrack(() => timeEstimates.length > 0));
  const estimateMap = $state<Record<string, EstimateFields>>(
    untrack(() => {
      const map: Record<string, EstimateFields> = {};
      for (const intv of ESTIMATE_INTERVALS) {
        const existing = timeEstimates.find(
          (e: TpmTimeEstimate) => e.intervalType === intv,
        );
        map[intv] =
          existing !== undefined ?
            {
              staffCount: existing.staffCount,
              preparationMinutes: existing.preparationMinutes,
              executionMinutes: existing.executionMinutes,
              followupMinutes: existing.followupMinutes,
            }
          : {
              staffCount: 1,
              preparationMinutes: 0,
              executionMinutes: 0,
              followupMinutes: 0,
            };
      }
      return map;
    }),
  );

  /** Build array of changed estimates for API submission */
  function buildEstimatePayloads(
    planUuid: string,
  ): CreateTimeEstimatePayload[] {
    const payloads: CreateTimeEstimatePayload[] = [];
    for (const intv of ESTIMATE_INTERVALS) {
      const fields = estimateMap[intv];
      const hasValues =
        fields.preparationMinutes > 0 ||
        fields.executionMinutes > 0 ||
        fields.followupMinutes > 0;
      if (!hasValues) continue;
      payloads.push({
        planUuid,
        intervalType: intv,
        staffCount: fields.staffCount,
        preparationMinutes: fields.preparationMinutes,
        executionMinutes: fields.executionMinutes,
        followupMinutes: fields.followupMinutes,
      });
    }
    return payloads;
  }

  function findMachineUuid(): string {
    if (plan === null) return '';
    const match = machines.find((m: Machine) => m.name === plan.machineName);
    return match?.uuid ?? '';
  }

  // Cascade: reset children when parent changes
  function selectArea(areaId: number): void {
    formAreaId = areaId;
    formDepartmentId = null;
    machineUuid = '';
    areaDropdownOpen = false;
    onmachinechange?.('');
  }

  function selectDepartment(deptId: number): void {
    formDepartmentId = deptId;
    machineUuid = '';
    departmentDropdownOpen = false;
    onmachinechange?.('');
  }

  /** Toggle all-day mode: checked → reset time, unchecked → set default */
  function toggleAllDay(): void {
    isAllDay = !isAllDay;
    if (isAllDay) {
      baseTime = '';
    } else {
      baseTime = '09:00';
    }
  }

  // Notify parent when shiftPlanRequired changes
  $effect(() => {
    onshiftplanchange?.(shiftPlanRequired);
  });

  // =========================================================================
  // DROPDOWN STATE
  // =========================================================================

  let areaDropdownOpen = $state(false);
  let departmentDropdownOpen = $state(false);
  let machineDropdownOpen = $state(false);
  let weekdayDropdownOpen = $state(false);

  function closeAllDropdowns(): void {
    areaDropdownOpen = false;
    departmentDropdownOpen = false;
    machineDropdownOpen = false;
    weekdayDropdownOpen = false;
  }

  $effect(() => {
    const anyOpen =
      areaDropdownOpen ||
      departmentDropdownOpen ||
      machineDropdownOpen ||
      weekdayDropdownOpen;
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
      (isCreateMode ? machineUuid.length > 0 : true) &&
      (isAllDay || baseTime.trim().length > 0),
  );

  // =========================================================================
  // CASCADE DERIVED STATE (Area → Department → Machine)
  // =========================================================================

  const filteredDepartments = $derived.by(() => {
    if (formAreaId === null) return [];
    return departments.filter((d: TpmDepartment) => d.areaId === formAreaId);
  });

  const filteredMachines = $derived.by(() => {
    if (formDepartmentId === null) return [];
    return machines.filter(
      (m: Machine) =>
        m.status !== 'decommissioned' && m.departmentId === formDepartmentId,
    );
  });

  const isDepartmentDisabled = $derived(formAreaId === null);
  const isMachineDisabled = $derived(formDepartmentId === null);

  // =========================================================================
  // DERIVED DISPLAY TEXT
  // =========================================================================

  const selectedAreaText = $derived.by(() => {
    if (formAreaId === null) return MESSAGES.PH_AREA;
    const match = areas.find((a: TpmArea) => a.id === formAreaId);
    return match?.name ?? MESSAGES.PH_AREA;
  });

  const selectedDepartmentText = $derived.by(() => {
    if (isDepartmentDisabled) return MESSAGES.PH_SELECT_AREA_FIRST;
    if (formDepartmentId === null) return MESSAGES.PH_DEPARTMENT;
    const match = filteredDepartments.find(
      (d: TpmDepartment) => d.id === formDepartmentId,
    );
    return match?.name ?? MESSAGES.PH_DEPARTMENT;
  });

  const selectedMachineText = $derived.by(() => {
    if (isMachineDisabled) return MESSAGES.PH_SELECT_DEPT_FIRST;
    if (machineUuid === '') return MESSAGES.PH_MACHINE;
    const match = filteredMachines.find((m: Machine) => m.uuid === machineUuid);
    if (match === undefined) return MESSAGES.PH_MACHINE;
    const num = match.machineNumber?.trim() ?? '';
    return num.length > 0 ? `${match.name} (${num})` : match.name;
  });

  const selectedWeekdayText = $derived(WEEKDAY_LABELS[baseWeekday] ?? '—');

  /** Live preview: base_time + buffer_hours = end time */
  const timeWindowPreview = $derived.by(() => {
    const trimmed = baseTime.trim();
    if (trimmed.length === 0) return MESSAGES.HELP_BUFFER_FULL_DAY;
    const parts = trimmed.split(':');
    if (parts.length < 2) return MESSAGES.HELP_BUFFER_FULL_DAY;
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    if (Number.isNaN(h) || Number.isNaN(m))
      return MESSAGES.HELP_BUFFER_FULL_DAY;
    const totalMinutes = h * 60 + m + bufferHours * 60;
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = Math.round(totalMinutes % 60);
    const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    return `${trimmed} – ${endStr}`;
  });

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
        bufferHours,
        shiftPlanRequired,
        notes: notesValue,
      });
    } else {
      const estimates =
        showTimeEstimates && plan !== null ?
          buildEstimatePayloads(plan.uuid)
        : [];
      onupdate(
        {
          name: name.trim(),
          baseWeekday,
          baseRepeatEvery,
          baseTime: timeValue,
          bufferHours,
          shiftPlanRequired,
          notes: notesValue,
        },
        estimates,
      );
    }
  }
</script>

<form
  class="plan-form"
  onsubmit={handleSubmit}
>
  <!-- Cascade: Area → Department → Machine (create only) -->
  {#if isCreateMode}
    <!-- Area -->
    <div class="form-field">
      <span class="form-field__label">{MESSAGES.LABEL_AREA}</span>
      <div class="dropdown">
        <button
          type="button"
          class="dropdown__trigger"
          class:active={areaDropdownOpen}
          disabled={submitting}
          onclick={() => {
            const wasOpen = areaDropdownOpen;
            closeAllDropdowns();
            areaDropdownOpen = !wasOpen;
          }}
        >
          <span>{selectedAreaText}</span>
          <i class="fas fa-chevron-down"></i>
        </button>
        <div
          class="dropdown__menu dropdown__menu--scrollable"
          class:active={areaDropdownOpen}
        >
          {#each areas as area (area.id)}
            <button
              type="button"
              class="dropdown__option"
              class:dropdown__option--selected={formAreaId === area.id}
              onclick={() => {
                selectArea(area.id);
              }}
            >
              {area.name}
            </button>
          {/each}
        </div>
      </div>
    </div>

    <!-- Department (disabled until area selected) -->
    <div class="form-field">
      <span class="form-field__label">{MESSAGES.LABEL_DEPARTMENT}</span>
      <div
        class="dropdown"
        class:disabled={isDepartmentDisabled}
      >
        <button
          type="button"
          class="dropdown__trigger"
          class:active={departmentDropdownOpen}
          disabled={submitting || isDepartmentDisabled}
          onclick={() => {
            if (isDepartmentDisabled) return;
            const wasOpen = departmentDropdownOpen;
            closeAllDropdowns();
            departmentDropdownOpen = !wasOpen;
          }}
        >
          <span>{selectedDepartmentText}</span>
          <i class="fas fa-chevron-down"></i>
        </button>
        {#if !isDepartmentDisabled}
          <div
            class="dropdown__menu dropdown__menu--scrollable"
            class:active={departmentDropdownOpen}
          >
            {#each filteredDepartments as dept (dept.id)}
              <button
                type="button"
                class="dropdown__option"
                class:dropdown__option--selected={formDepartmentId === dept.id}
                onclick={() => {
                  selectDepartment(dept.id);
                }}
              >
                {dept.name}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Machine (disabled until department selected) -->
    <div class="form-field">
      <span class="form-field__label">{MESSAGES.LABEL_MACHINE}</span>
      <div
        class="dropdown"
        class:disabled={isMachineDisabled}
      >
        <button
          type="button"
          class="dropdown__trigger"
          class:active={machineDropdownOpen}
          disabled={submitting || isMachineDisabled}
          onclick={() => {
            if (isMachineDisabled) return;
            const wasOpen = machineDropdownOpen;
            closeAllDropdowns();
            machineDropdownOpen = !wasOpen;
          }}
        >
          <span>{selectedMachineText}</span>
          <i class="fas fa-chevron-down"></i>
        </button>
        {#if !isMachineDisabled}
          <div
            class="dropdown__menu dropdown__menu--scrollable"
            class:active={machineDropdownOpen}
          >
            {#each filteredMachines as machine (machine.uuid)}
              {@const hasPlan = machineHasPlan(machine.uuid)}
              <button
                type="button"
                class="dropdown__option"
                class:dropdown__option--selected={machineUuid === machine.uuid}
                class:dropdown__option--disabled={hasPlan}
                disabled={hasPlan}
                onclick={() => {
                  machineUuid = machine.uuid;
                  machineDropdownOpen = false;
                  onmachinechange?.(machine.uuid);
                }}
              >
                {machine.name}
                {#if machine.machineNumber}
                  ({machine.machineNumber})
                {/if}
                {#if hasPlan}
                  <span class="dropdown__option-hint">
                    ({MESSAGES.MACHINE_HAS_PLAN})
                  </span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
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
          max={4}
        />
        <span class="form-input-group__suffix"
          >. {WEEKDAY_LABELS[baseWeekday] ?? '—'} im Monat</span
        >
      </div>
      <span class="form-field__message">{MESSAGES.HELP_REPEAT}</span>
    </div>
  </div>

  <!-- All-day toggle -->
  <label class="choice-card plan-form__all-day-card">
    <input
      type="checkbox"
      class="choice-card__input"
      checked={isAllDay}
      onchange={toggleAllDay}
      disabled={submitting}
    />
    <span class="choice-card__text">{MESSAGES.LABEL_ALL_DAY}</span>
  </label>

  <!-- Time + Buffer Hours (side by side) -->
  <div class="form-row">
    <div class="form-field plan-form__half">
      <span class="form-field__label">{MESSAGES.LABEL_TIME}</span>
      {#if isAllDay}
        <div class="form-static">
          <i class="fas fa-clock"></i>
          {MESSAGES.HELP_BUFFER_FULL_DAY}
        </div>
      {:else}
        <AppTimePicker
          bind:value={baseTime}
          disabled={submitting}
        />
      {/if}
    </div>

    <div class="form-field plan-form__half">
      <label
        class="form-field__label"
        for="bufferHours">{MESSAGES.LABEL_BUFFER_HOURS}</label
      >
      <div class="form-input-group">
        <input
          id="bufferHours"
          type="number"
          class="form-field__control plan-form__narrow"
          bind:value={bufferHours}
          disabled={submitting}
          min={0.5}
          max={24}
          step={0.5}
        />
        <span class="form-input-group__suffix">Stunden</span>
      </div>
      <span class="form-field__message">{MESSAGES.HELP_BUFFER_HOURS}</span>
    </div>
  </div>

  <!-- Time window preview -->
  <div class="form-field">
    <span class="form-field__label">{MESSAGES.LABEL_TIME_WINDOW}</span>
    <div class="form-static">
      <i class="fas fa-clock"></i>
      {timeWindowPreview}
    </div>
  </div>

  <!-- Time Estimates (per interval type) -->
  <TimeEstimateEditor
    {estimateMap} {submitting} {isCreateMode}
    showEstimates={showTimeEstimates}
    ontoggle={(val: boolean) => { showTimeEstimates = val; }}
  />

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

  .plan-form__all-day-card {
    padding: 0.5rem 0.75rem;
    width: fit-content;
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

  /* Cascade dropdown — disabled state */
  .dropdown.disabled :global(.dropdown__trigger) {
    opacity: 50%;
    cursor: not-allowed;
    pointer-events: none;
    background-color: var(--color-glass-light);
  }

  /* Machine dropdown — option with existing TPM plan */
  .dropdown__option--disabled {
    opacity: 50%;
    cursor: not-allowed;
    color: var(--color-text-muted);
  }

  .dropdown__option-hint {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-style: italic;
  }

  @media (width <= 640px) {
    .form-row {
      flex-direction: column;
    }
  }
</style>