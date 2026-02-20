<script lang="ts">
  /**
   * TPM Slot Assistant Component
   * @module plan/[uuid]/_lib/SlotAssistant
   *
   * 7-column calendar grid showing available/busy days for a machine.
   * Uses GET /tpm/plans/:uuid/available-slots endpoint.
   * Only rendered in edit mode (requires existing plan UUID).
   */
  import AppDatePicker from '$lib/components/AppDatePicker.svelte';

  import { fetchAvailableSlots, logApiError } from '../../../_lib/api';
  import { MESSAGES } from '../../../_lib/constants';
  import {
    timestampToISO,
    FOUR_WEEKS_MS,
    MAX_RANGE_MS,
  } from '../../../_lib/date-helpers';

  import type {
    SlotAvailabilityResult,
    DayAvailability,
  } from '../../../_lib/types';

  interface Props {
    planUuid: string;
    cardsHref?: string;
  }

  const { planUuid, cardsHref }: Props = $props();

  // =========================================================================
  // CONSTANTS
  // =========================================================================

  const WEEKDAY_HEADERS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  // =========================================================================
  // STATE
  // =========================================================================

  let loading = $state(false);
  let slotData = $state<SlotAvailabilityResult | null>(null);

  // Date range: default next 4 weeks (pure timestamp math, no mutable Date)
  const nowMs = Date.now();
  let startDate = $state(timestampToISO(nowMs));
  let endDate = $state(timestampToISO(nowMs + FOUR_WEEKS_MS));

  // Max endDate = startDate + 90 days (backend limit)
  const maxEndDate = $derived(
    timestampToISO(new Date(startDate).getTime() + MAX_RANGE_MS),
  );

  // Number of empty cells before first day (Mon=0, Sun=6)
  const leadingPadding = $derived.by(() => {
    if (slotData === null || slotData.days.length === 0) return 0;
    return isoWeekday(slotData.days[0].date);
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
    return type;
  }

  function getConflictIcon(type: string): string {
    if (type === 'no_shift_plan') return 'fa-calendar-xmark';
    if (type === 'machine_downtime') return 'fa-wrench';
    if (type === 'existing_tpm') return 'fa-clipboard-check';
    return 'fa-exclamation';
  }

  function buildDayTooltip(day: DayAvailability): string {
    if (day.isAvailable) return 'Verfügbar';
    return day.conflicts.map((c) => c.description).join(', ');
  }

  // =========================================================================
  // LOAD SLOTS
  // =========================================================================

  async function loadSlots(): Promise<void> {
    if (startDate.length === 0 || endDate.length === 0) return;
    loading = true;
    try {
      slotData = await fetchAvailableSlots(planUuid, startDate, endDate);
    } catch (err: unknown) {
      logApiError('loadSlots', err);
      slotData = null;
    } finally {
      loading = false;
    }
  }

  // Load on mount
  $effect(() => {
    void loadSlots();
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
        {#if slotData !== null}
          <div class="flex items-baseline gap-2">
            <span class="text-2xl font-bold text-(--color-success)">
              {slotData.availableDays}
            </span>
            <span class="text-sm text-(--color-text-muted)">
              {MESSAGES.SLOT_STATS} {slotData.totalDays}
            </span>
          </div>
        {/if}
        {#if cardsHref !== undefined}
          <a href={cardsHref} class="btn btn-primary">
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
      <div class="flex gap-4">
        <div class="min-w-0" style="width: 160px">
          <AppDatePicker
            bind:value={startDate}
            label="Von"
            size="sm"
            onchange={(newStart: string) => {
              const newStartMs = new Date(newStart).getTime();
              const newEnd = newStartMs + FOUR_WEEKS_MS;
              const maxEnd = newStartMs + MAX_RANGE_MS;
              endDate = timestampToISO(Math.min(newEnd, maxEnd));
              void loadSlots();
            }}
          />
        </div>
        <div class="min-w-0" style="width: 160px">
          <AppDatePicker
            bind:value={endDate}
            label="Bis"
            min={startDate}
            max={maxEndDate}
            size="sm"
            onchange={(_v: string) => {
              void loadSlots();
            }}
          />
        </div>
        <span class="self-center text-xs text-(--color-text-muted)">
          Max. 90 Tage
        </span>
      </div>
      <div class="flex gap-4">
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
    {:else if slotData !== null}
      <!-- Calendar grid -->
      <div class="slot-calendar">
        <!-- Weekday headers -->
        {#each WEEKDAY_HEADERS as header, i (i)}
          <div class="slot-header" class:slot-header--weekend={i >= 5}>
            {header}
          </div>
        {/each}

        <!-- Leading empty cells -->
        {#each Array(leadingPadding) as _, i (i)}
          <div class="slot-empty"></div>
        {/each}

        <!-- Day cells -->
        {#each slotData.days as day (day.date)}
          {@const available = day.isAvailable}
          {@const isWeekend = isoWeekday(day.date) >= 5}
          <div
            class="slot-day"
            class:slot-day--available={available}
            class:slot-day--unavailable={!available}
            class:slot-day--weekend={isWeekend}
            title={buildDayTooltip(day)}
          >
            <span class="slot-day__date">{formatDayMonth(day.date)}</span>
            {#if available}
              <i class="fas fa-check slot-day__icon slot-day__icon--ok"></i>
            {:else if day.conflicts.length > 0}
              <i
                class="fas {getConflictIcon(day.conflicts[0]?.type ?? '')} slot-day__icon slot-day__icon--conflict"
              ></i>
              <span class="slot-day__conflict">
                {getConflictLabel(day.conflicts[0]?.type ?? '')}
              </span>
            {/if}
          </div>
        {/each}
      </div>
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

  /* ---- Calendar Grid ---- */

  .slot-calendar {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
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
    cursor: default;
    transition: opacity 0.15s;
    min-height: 60px;
  }

  .slot-day:hover {
    opacity: 85%;
  }

  .slot-day--available {
    background: color-mix(in srgb, var(--color-success) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-success) 25%, transparent);
  }

  .slot-day--unavailable {
    background: color-mix(in srgb, var(--color-danger) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-danger) 25%, transparent);
  }

  .slot-day--weekend.slot-day--available {
    background: color-mix(in srgb, var(--color-success) 5%, transparent);
    border-color: color-mix(
      in srgb,
      var(--color-success) 15%,
      transparent
    );
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

  .slot-day__conflict {
    font-size: 0.825rem;
    color: var(--color-danger);
    text-align: center;
    line-height: 1.2;
  }
</style>
