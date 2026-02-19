<script lang="ts">
  /**
   * TPM Slot Assistant Component
   * @module plan/[uuid]/_lib/SlotAssistant
   *
   * Calendar visualization showing available/busy days for a machine.
   * Uses GET /tpm/plans/:uuid/available-slots endpoint.
   * Only rendered in edit mode (requires existing plan UUID).
   */
  import { fetchAvailableSlots, logApiError } from '../../../_lib/api';
  import { MESSAGES } from '../../../_lib/constants';
  import { timestampToISO, FOUR_WEEKS_MS } from '../../../_lib/date-helpers';

  import type {
    SlotAvailabilityResult,
    DayAvailability,
  } from '../../../_lib/types';

  interface Props {
    planUuid: string;
  }

  const { planUuid }: Props = $props();

  // =========================================================================
  // STATE
  // =========================================================================

  let loading = $state(false);
  let slotData = $state<SlotAvailabilityResult | null>(null);

  // Date range: default next 4 weeks (pure timestamp math, no mutable Date)
  const nowMs = Date.now();
  let startDate = $state(timestampToISO(nowMs));
  let endDate = $state(timestampToISO(nowMs + FOUR_WEEKS_MS));

  // =========================================================================
  // HELPERS
  // =========================================================================

  function formatDateShort(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      weekday: 'short',
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

  function handleDateChange(): void {
    void loadSlots();
  }

  function buildDayTooltip(day: DayAvailability): string {
    if (day.isAvailable) return 'Verfügbar';
    return day.conflicts.map((c) => c.description).join(', ');
  }
</script>

<div class="card">
  <div class="card__header">
    <h3 class="card__title">
      <i class="fas fa-calendar-check mr-2"></i>
      {MESSAGES.SLOT_TITLE}
    </h3>
    <p class="mt-1 text-xs text-(--color-text-muted)">
      {MESSAGES.SLOT_DESCRIPTION}
    </p>
  </div>
  <div class="card__body">
    <!-- Date range controls -->
    <div class="mb-4 flex gap-3">
      <div class="flex flex-1 flex-col gap-1">
        <label
          class="form-label"
          for="slot-start">Von</label
        >
        <input
          id="slot-start"
          type="date"
          class="form-input"
          bind:value={startDate}
          onchange={handleDateChange}
        />
      </div>
      <div class="flex flex-1 flex-col gap-1">
        <label
          class="form-label"
          for="slot-end">Bis</label
        >
        <input
          id="slot-end"
          type="date"
          class="form-input"
          bind:value={endDate}
          onchange={handleDateChange}
        />
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
      <!-- Stats -->
      <div class="mb-3 flex items-baseline gap-2">
        <span class="text-2xl font-bold text-(--color-success)">
          {slotData.availableDays}
        </span>
        <span class="text-sm text-(--color-text-muted)">
          {MESSAGES.SLOT_STATS}
          {slotData.totalDays}
        </span>
      </div>

      <!-- Legend -->
      <div class="mb-3 flex gap-4">
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

      <!-- Day grid -->
      <div class="slot-grid">
        {#each slotData.days as day (day.date)}
          {@const available = day.isAvailable}
          <div
            class="slot-day"
            class:slot-day--available={available}
            class:slot-day--unavailable={!available}
            title={buildDayTooltip(day)}
          >
            <span class="slot-day__date">{formatDateShort(day.date)}</span>
            {#if !available && day.conflicts.length > 0}
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

  .slot-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .slot-day {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.375rem 0.25rem;
    border-radius: var(--radius-sm);
    min-width: 64px;
    flex: 1 0 64px;
    cursor: default;
    transition: opacity 0.15s;
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

  .slot-day__date {
    font-size: 0.688rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .slot-day__conflict {
    font-size: 0.563rem;
    color: var(--color-danger);
    text-align: center;
    margin-top: 2px;
  }
</style>
