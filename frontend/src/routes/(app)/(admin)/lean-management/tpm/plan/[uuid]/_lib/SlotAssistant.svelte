<script lang="ts">
  /**
   * TPM Slot Assistant Component
   * @module plan/[uuid]/_lib/SlotAssistant
   *
   * 7-column calendar grid showing available/busy days for a machine.
   * Combines two data sources:
   *   1. Slot Assistant (5-source check, max 90 days)
   *   2. Schedule Projection (cross-plan TPM dates, max 365 days)
   *
   * For the first 90 days: full slot data with projection overlay.
   * Beyond 90 days: only projected TPM schedules shown.
   */
  import { SvelteMap } from 'svelte/reactivity';

  import AppDatePicker from '$lib/components/AppDatePicker.svelte';

  import {
    fetchAvailableSlots,
    fetchAvailableSlotsByMachine,
    fetchScheduleProjection,
    logApiError,
  } from '../../../_lib/api';
  import { INTERVAL_LABELS, MESSAGES } from '../../../_lib/constants';
  import {
    timestampToISO,
    NINETY_DAYS_MS,
    MAX_RANGE_MS,
    MAX_RANGE_365_MS,
  } from '../../../_lib/date-helpers';

  import TimelineDayView from './TimelineDayView.svelte';

  import type {
    SlotAvailabilityResult,
    ScheduleProjectionResult,
    ProjectedSlot,
    DayAvailability,
    IntervalType,
  } from '../../../_lib/types';

  interface Props {
    planUuid?: string;
    machineUuid?: string;
    shiftPlanRequired?: boolean;
    cardsHref?: string;
  }

  const { planUuid, machineUuid, shiftPlanRequired, cardsHref }: Props =
    $props();

  const isEditMode = $derived(planUuid !== undefined && planUuid.length > 0);
  const canFetch = $derived(
    isEditMode || (machineUuid !== undefined && machineUuid.length > 0),
  );

  // =========================================================================
  // CONSTANTS
  // =========================================================================

  const WEEKDAY_HEADERS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  // =========================================================================
  // STATE
  // =========================================================================

  let loading = $state(false);
  let slotData = $state<SlotAvailabilityResult | null>(null);
  let projectionData = $state<ScheduleProjectionResult | null>(null);
  let selectedDay = $state<string | null>(null);
  let showWeekends = $state(false);

  // Date range: default next 90 days (pure timestamp math, no mutable Date)
  const nowMs = Date.now();
  let startDate = $state(timestampToISO(nowMs));
  let endDate = $state(timestampToISO(nowMs + NINETY_DAYS_MS));

  // Max endDate = startDate + 365 days (schedule projection limit)
  const maxEndDate = $derived(
    timestampToISO(new Date(startDate).getTime() + MAX_RANGE_365_MS),
  );

  // Slot assistant is limited to 90 days — clamp end date for that call
  const slotEndDate = $derived.by(() => {
    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    const maxSlotMs = startMs + MAX_RANGE_MS;
    return endMs <= maxSlotMs ? endDate : timestampToISO(maxSlotMs);
  });

  // Whether the selected range exceeds the slot assistant limit
  const rangeExceedsSlotLimit = $derived(endDate !== slotEndDate);

  // Build projection lookup: date → ProjectedSlot[]
  const projectionByDate = $derived.by(() => {
    const map = new SvelteMap<string, ProjectedSlot[]>();
    if (projectionData === null) return map;
    for (const slot of projectionData.slots) {
      const existing = map.get(slot.date);
      if (existing !== undefined) {
        existing.push(slot);
      } else {
        map.set(slot.date, [slot]);
      }
    }
    return map;
  });

  // Merged calendar days: slot data + projection-only days beyond 90d
  const calendarDays = $derived.by((): DayAvailability[] => {
    const slotDays = slotData?.days ?? [];
    if (!rangeExceedsSlotLimit) return slotDays;

    // All dates covered by slot data
    const coveredDates = new Set(slotDays.map((d: DayAvailability) => d.date));

    // Generate days beyond slot range from projection data
    const extraDays: DayAvailability[] = [];
    const endMs = new Date(endDate).getTime();
    let curMs = new Date(slotEndDate).getTime() + 24 * 60 * 60 * 1000;

    while (curMs <= endMs) {
      const dateStr = timestampToISO(curMs);
      if (!coveredDates.has(dateStr)) {
        const projSlots = projectionByDate.get(dateStr);
        const hasSchedule = projSlots !== undefined && projSlots.length > 0;
        extraDays.push({
          date: dateStr,
          isAvailable: !hasSchedule,
          conflicts:
            hasSchedule ?
              projSlots.map((s: ProjectedSlot) => ({
                type: 'tpm_schedule' as const,
                description: formatProjectionDescription(s),
              }))
            : [],
        });
      }
      curMs += 24 * 60 * 60 * 1000;
    }

    return [...slotDays, ...extraDays];
  });

  // Visible headers and days (filtered by weekend toggle)
  const visibleHeaders = $derived(
    showWeekends ? WEEKDAY_HEADERS : WEEKDAY_HEADERS.slice(0, 5),
  );
  const visibleCalendarDays = $derived(
    showWeekends ? calendarDays : (
      calendarDays.filter((d: DayAvailability) => isoWeekday(d.date) < 5)
    ),
  );

  // Stats from visible days only
  const totalDays = $derived(visibleCalendarDays.length);
  const availableDays = $derived(
    visibleCalendarDays.filter((d: DayAvailability) => d.isAvailable).length,
  );

  // Number of empty cells before first day (Mon=0, Fri=4 or Sun=6)
  const leadingPadding = $derived.by(() => {
    if (visibleCalendarDays.length === 0) return 0;
    return isoWeekday(visibleCalendarDays[0].date);
  });

  // =========================================================================
  // HELPERS
  // =========================================================================

  /** Convert JS getDay() (Sun=0) to ISO weekday index (Mon=0, Sun=6) */
  function isoWeekday(dateStr: string): number {
    const jsDay = new Date(dateStr).getDay();
    return jsDay === 0 ? 6 : jsDay - 1;
  }

  function formatDayMonth(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
    });
  }

  function getConflictLabel(type: string): string {
    if (type === 'no_shift_plan') return MESSAGES.SLOT_NO_SHIFT;
    if (type === 'machine_downtime') return MESSAGES.SLOT_DOWNTIME;
    if (type === 'existing_tpm') return MESSAGES.SLOT_TPM_EXISTING;
    if (type === 'tpm_schedule') return MESSAGES.SLOT_TPM_SCHEDULE;
    return type;
  }

  function getConflictIcon(type: string): string {
    if (type === 'no_shift_plan') return 'fa-calendar-xmark';
    if (type === 'machine_downtime') return 'fa-wrench';
    if (type === 'existing_tpm') return 'fa-clipboard-check';
    if (type === 'tpm_schedule') return 'fa-clock';
    return 'fa-exclamation';
  }

  /** Format a projected slot for display */
  function formatProjectionDescription(slot: ProjectedSlot): string {
    const intervals = slot.intervalTypes
      .map((t: IntervalType) => INTERVAL_LABELS[t])
      .join(', ');
    const time =
      slot.isFullDay ? 'Ganztägig' : (
        `${slot.startTime ?? '?'} – ${slot.endTime ?? '?'}`
      );
    return `${slot.planName} (${slot.machineName}) — ${intervals} — ${time}`;
  }

  /** Format projection lines for tooltip display */
  function formatProjectionLines(slots: ProjectedSlot[]): string[] {
    return slots.map((s: ProjectedSlot) => formatProjectionDescription(s));
  }

  /** Collect conflict descriptions for an unavailable day */
  function collectConflictParts(day: DayAvailability): string[] {
    return day.conflicts.map((c) =>
      c.type === 'tpm_schedule' ?
        c.description
      : `${getConflictLabel(c.type)}: ${c.description}`,
    );
  }

  /** Append projection details not already present in conflict descriptions */
  function appendUniqueProjections(
    parts: string[],
    projSlots: ProjectedSlot[],
    conflictDescs: Set<string>,
  ): void {
    for (const s of projSlots) {
      const desc = formatProjectionDescription(s);
      if (!conflictDescs.has(desc)) {
        parts.push(desc);
      }
    }
  }

  /** Build tooltip from slot data + projection enrichment */
  function buildDayTooltip(day: DayAvailability): string {
    const projSlots = projectionByDate.get(day.date) ?? [];

    if (day.isAvailable) {
      if (projSlots.length === 0) return 'Verfügbar';
      const lines = formatProjectionLines(projSlots);
      return `Verfügbar\n\nGeplante Termine:\n${lines.join('\n')}`;
    }

    const parts = collectConflictParts(day);
    const conflictDescs = new Set(day.conflicts.map((c) => c.description));
    appendUniqueProjections(parts, projSlots, conflictDescs);
    return parts.join('\n');
  }

  /** Check if a day has a tpm_schedule conflict */
  function hasTpmScheduleConflict(day: DayAvailability): boolean {
    return day.conflicts.some((c) => c.type === 'tpm_schedule');
  }

  /** Get projection slots for a specific date */
  function getSlotsForDate(dateStr: string): ProjectedSlot[] {
    return projectionByDate.get(dateStr) ?? [];
  }

  /** Toggle timeline view for a day (click same day to close) */
  function handleDayClick(day: DayAvailability): void {
    selectedDay = selectedDay === day.date ? null : day.date;
  }

  // =========================================================================
  // LOAD SLOTS + PROJECTION
  // =========================================================================

  async function loadData(): Promise<void> {
    if (!canFetch || startDate.length === 0 || endDate.length === 0) return;
    selectedDay = null;
    loading = true;
    try {
      // Fetch slot data (max 90d) + projection (up to 365d) in parallel
      const slotPromise = loadSlotData();
      const projPromise = fetchScheduleProjection(startDate, endDate, planUuid);

      const [slotResult, projResult] = await Promise.all([
        slotPromise,
        projPromise,
      ]);

      slotData = slotResult;
      projectionData = projResult;
    } catch (err: unknown) {
      logApiError('loadData', err);
      slotData = null;
      projectionData = null;
    } finally {
      loading = false;
    }
  }

  async function loadSlotData(): Promise<SlotAvailabilityResult | null> {
    if (isEditMode && planUuid !== undefined) {
      return await fetchAvailableSlots(planUuid, startDate, slotEndDate);
    }
    if (machineUuid !== undefined) {
      return await fetchAvailableSlotsByMachine(
        machineUuid,
        startDate,
        slotEndDate,
        shiftPlanRequired ?? false,
      );
    }
    return null;
  }

  // Reactive: refetch when dependencies change
  $effect(() => {
    void planUuid;
    void machineUuid;
    void shiftPlanRequired;
    void loadData();
  });
</script>

<div class="card">
  <div class="card__header">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 class="card__title">
          <i class="fas fa-calendar-check mr-2"></i>
          {MESSAGES.SLOT_TITLE}
        </h2>
        <p class="mt-1 text-xs text-(--color-text-muted)">
          {MESSAGES.SLOT_DESCRIPTION}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-4">
        {#if calendarDays.length > 0}
          <div class="flex items-baseline gap-2">
            <span class="text-2xl font-bold text-(--color-success)">
              {availableDays}
            </span>
            <span class="text-sm text-(--color-text-muted)">
              {MESSAGES.SLOT_STATS}
              {totalDays}
            </span>
          </div>
        {/if}
        {#if cardsHref !== undefined}
          <a
            href={cardsHref}
            class="btn btn-primary"
          >
            <i class="fas fa-th"></i>
            Karten verwalten
          </a>
        {/if}
      </div>
    </div>
  </div>
  <div class="card__body">
    <!-- Date range controls + legend -->
    <div class="mb-4 flex flex-wrap items-end justify-between gap-4">
      <div class="flex flex-wrap items-end gap-4">
        <div
          class="min-w-0"
          style="width: 160px"
        >
          <AppDatePicker
            bind:value={startDate}
            label="Von"
            size="sm"
            onchange={(newStart: string) => {
              const newStartMs = new Date(newStart).getTime();
              const newEnd = newStartMs + NINETY_DAYS_MS;
              const maxEnd = newStartMs + MAX_RANGE_365_MS;
              endDate = timestampToISO(Math.min(newEnd, maxEnd));
              void loadData();
            }}
          />
        </div>
        <div
          class="min-w-0"
          style="width: 160px"
        >
          <AppDatePicker
            bind:value={endDate}
            label="Bis"
            min={startDate}
            max={maxEndDate}
            size="sm"
            onchange={(_v: string) => {
              void loadData();
            }}
          />
        </div>
        <div class="flex flex-col gap-0.5 self-center">
          <span class="text-xs text-(--color-text-muted)">
            {MESSAGES.SLOT_RANGE_FULL}
          </span>
          {#if rangeExceedsSlotLimit}
            <span class="text-[0.625rem] text-(--color-text-muted) italic">
              {MESSAGES.SLOT_RANGE_DETAIL_HINT}
            </span>
          {/if}
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-4">
        <label
          class="flex cursor-pointer items-center gap-1.5 text-xs text-(--color-text-secondary) select-none"
        >
          <input
            type="checkbox"
            bind:checked={showWeekends}
            class="accent-(--color-primary)"
          />
          {MESSAGES.SLOT_SHOW_WEEKENDS}
        </label>
        <span
          class="flex items-center gap-1.5 text-xs text-(--color-text-secondary)"
        >
          <span class="slot-dot slot-dot--available"></span>
          {MESSAGES.SLOT_AVAILABLE}
        </span>
        <span
          class="flex items-center gap-1.5 text-xs text-(--color-text-secondary)"
        >
          <span class="slot-dot slot-dot--unavailable"></span>
          {MESSAGES.SLOT_UNAVAILABLE}
        </span>
        <span
          class="flex items-center gap-1.5 text-xs text-(--color-text-secondary)"
        >
          <span class="slot-dot slot-dot--scheduled"></span>
          {MESSAGES.SLOT_SCHEDULED}
        </span>
      </div>
    </div>

    <!-- Content -->
    {#if loading}
      <div
        class="flex items-center justify-center gap-2 p-6 text-sm text-(--color-text-muted)"
      >
        <i class="fas fa-spinner fa-spin"></i>
        {MESSAGES.SLOT_LOADING}
      </div>
    {:else if visibleCalendarDays.length > 0}
      <!-- Calendar grid -->
      <div
        class="slot-calendar"
        class:slot-calendar--weekdays-only={!showWeekends}
      >
        <!-- Weekday headers -->
        {#each visibleHeaders as header, i (i)}
          <div
            class="slot-header"
            class:slot-header--weekend={showWeekends && i >= 5}
          >
            {header}
          </div>
        {/each}

        <!-- Leading empty cells -->
        {#each Array(leadingPadding) as _, i (i)}
          <div class="slot-empty"></div>
        {/each}

        <!-- Day cells -->
        {#each visibleCalendarDays as day (day.date)}
          {@const available = day.isAvailable}
          {@const isWeekend = isoWeekday(day.date) >= 5}
          {@const isScheduled = hasTpmScheduleConflict(day)}
          <div
            class="slot-day"
            class:slot-day--available={available && !isScheduled}
            class:slot-day--unavailable={!available && !isScheduled}
            class:slot-day--scheduled={isScheduled}
            class:slot-day--weekend={isWeekend}
            class:slot-day--selected={selectedDay === day.date}
            title={buildDayTooltip(day)}
            role="button"
            tabindex="0"
            onclick={() => {
              handleDayClick(day);
            }}
            onkeydown={(e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleDayClick(day);
              }
            }}
          >
            <span class="slot-day__date">{formatDayMonth(day.date)}</span>
            {#if available && !isScheduled}
              <i class="fas fa-check slot-day__icon slot-day__icon--ok"></i>
            {:else if isScheduled}
              <i class="fas fa-clock slot-day__icon slot-day__icon--scheduled"
              ></i>
              <span class="slot-day__conflict slot-day__conflict--scheduled">
                {MESSAGES.SLOT_TPM_SCHEDULE}
              </span>
            {:else if day.conflicts.length > 0}
              <i
                class="fas {getConflictIcon(
                  day.conflicts[0]?.type ?? '',
                )} slot-day__icon slot-day__icon--conflict"
              ></i>
              <span class="slot-day__conflict">
                {getConflictLabel(day.conflicts[0]?.type ?? '')}
              </span>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Timeline Day View (desktop only, opens on day click) -->
      {#if selectedDay !== null}
        <TimelineDayView
          date={selectedDay}
          slots={getSlotsForDate(selectedDay)}
          onclose={() => {
            selectedDay = null;
          }}
        />
      {/if}
    {/if}
  </div>
</div>

<style>
  .slot-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .slot-dot--available {
    background: var(--color-success);
  }

  .slot-dot--unavailable {
    background: var(--color-danger);
  }

  .slot-dot--scheduled {
    background: var(--color-info, #3b82f6);
  }

  /* ---- Calendar Grid ---- */

  .slot-calendar {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }

  .slot-calendar--weekdays-only {
    grid-template-columns: repeat(5, 1fr);
  }

  .slot-header {
    text-align: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-muted);
    padding: 0.25rem 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .slot-header--weekend {
    color: color-mix(in srgb, var(--color-text-muted) 60%, transparent);
  }

  .slot-empty {
    min-height: 1px;
  }

  .slot-day {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 0.5rem 0.25rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition:
      opacity 0.15s,
      box-shadow 0.15s;
    min-height: 60px;
  }

  .slot-day:hover {
    opacity: 85%;
  }

  .slot-day--selected {
    box-shadow: 0 0 0 2px var(--color-info, #3b82f6);
  }

  .slot-day--available {
    background: color-mix(in srgb, var(--color-success) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-success) 25%, transparent);
  }

  .slot-day--unavailable {
    background: color-mix(in srgb, var(--color-danger) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-danger) 25%, transparent);
  }

  .slot-day--scheduled {
    background: color-mix(in srgb, var(--color-info, #3b82f6) 10%, transparent);
    border: 1px solid
      color-mix(in srgb, var(--color-info, #3b82f6) 30%, transparent);
  }

  .slot-day--weekend.slot-day--available {
    background: color-mix(in srgb, var(--color-success) 5%, transparent);
    border-color: color-mix(in srgb, var(--color-success) 15%, transparent);
  }

  .slot-day__date {
    font-size: 0.813rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .slot-day__icon {
    font-size: 0.625rem;
  }

  .slot-day__icon--ok {
    color: var(--color-success);
  }

  .slot-day__icon--conflict {
    color: var(--color-danger);
  }

  .slot-day__icon--scheduled {
    color: var(--color-info, #3b82f6);
  }

  .slot-day__conflict {
    font-size: 0.825rem;
    color: var(--color-danger);
    text-align: center;
    line-height: 1.2;
  }

  .slot-day__conflict--scheduled {
    color: var(--color-info, #3b82f6);
  }
</style>
