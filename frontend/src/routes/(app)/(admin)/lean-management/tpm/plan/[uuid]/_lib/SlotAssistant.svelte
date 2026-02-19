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

  import type { SlotAvailabilityResult, DayAvailability } from '../../../_lib/types';

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
    return day.conflicts
      .map((c) => c.description)
      .join(', ');
  }
</script>

<div class="slot-assistant">
  <div class="slot-assistant__header">
    <h3 class="slot-assistant__title">
      <i class="fas fa-calendar-check"></i>
      {MESSAGES.SLOT_TITLE}
    </h3>
    <p class="slot-assistant__desc">{MESSAGES.SLOT_DESCRIPTION}</p>
  </div>

  <!-- Date range controls -->
  <div class="slot-assistant__controls">
    <div class="slot-assistant__date-group">
      <label class="slot-assistant__label" for="slot-start">Von</label>
      <input
        id="slot-start"
        type="date"
        class="slot-assistant__date"
        bind:value={startDate}
        onchange={handleDateChange}
      />
    </div>
    <div class="slot-assistant__date-group">
      <label class="slot-assistant__label" for="slot-end">Bis</label>
      <input
        id="slot-end"
        type="date"
        class="slot-assistant__date"
        bind:value={endDate}
        onchange={handleDateChange}
      />
    </div>
  </div>

  <!-- Content -->
  {#if loading}
    <div class="slot-assistant__loading">
      <i class="fas fa-spinner fa-spin"></i>
      {MESSAGES.SLOT_LOADING}
    </div>
  {:else if slotData !== null}
    <!-- Stats -->
    <div class="slot-assistant__stats">
      <span class="slot-assistant__stat slot-assistant__stat--available">
        {slotData.availableDays}
      </span>
      <span class="slot-assistant__stat-label">
        {MESSAGES.SLOT_STATS} {slotData.totalDays}
      </span>
    </div>

    <!-- Legend -->
    <div class="slot-assistant__legend">
      <span class="slot-assistant__legend-item">
        <span class="slot-dot slot-dot--available"></span>
        {MESSAGES.SLOT_AVAILABLE}
      </span>
      <span class="slot-assistant__legend-item">
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

<style>
  .slot-assistant {
    background: var(--color-white, #fff);
    border-radius: var(--radius-lg, 12px);
    box-shadow: var(--shadow-sm);
    padding: 1.25rem;
  }

  .slot-assistant__header {
    margin-bottom: 1rem;
  }

  .slot-assistant__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-gray-800);
  }

  .slot-assistant__desc {
    font-size: 0.75rem;
    color: var(--color-gray-500);
    margin-top: 0.25rem;
  }

  /* Date controls */
  .slot-assistant__controls {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .slot-assistant__date-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
  }

  .slot-assistant__label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-gray-600);
  }

  .slot-assistant__date {
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--color-gray-300);
    border-radius: var(--radius-md, 8px);
    font-size: 0.8125rem;
    color: var(--color-gray-700);
  }

  .slot-assistant__date:focus {
    outline: none;
    border-color: var(--color-blue-500);
  }

  /* Loading */
  .slot-assistant__loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1.5rem;
    justify-content: center;
    color: var(--color-gray-500);
    font-size: 0.8125rem;
  }

  /* Stats */
  .slot-assistant__stats {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .slot-assistant__stat {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1;
  }

  .slot-assistant__stat--available {
    color: var(--color-green-600, #059669);
  }

  .slot-assistant__stat-label {
    font-size: 0.8125rem;
    color: var(--color-gray-500);
  }

  /* Legend */
  .slot-assistant__legend {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .slot-assistant__legend-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--color-gray-600);
  }

  .slot-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .slot-dot--available {
    background: var(--color-green-500, #10b981);
  }

  .slot-dot--unavailable {
    background: var(--color-red-400, #f87171);
  }

  /* Day grid */
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
    border-radius: var(--radius-sm, 4px);
    min-width: 64px;
    flex: 1 0 64px;
    cursor: default;
    transition: opacity 0.15s;
  }

  .slot-day:hover {
    opacity: 0.85;
  }

  .slot-day--available {
    background: var(--color-green-50, #ecfdf5);
    border: 1px solid var(--color-green-200, #a7f3d0);
  }

  .slot-day--unavailable {
    background: var(--color-red-50, #fef2f2);
    border: 1px solid var(--color-red-200, #fecaca);
  }

  .slot-day__date {
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--color-gray-700);
  }

  .slot-day__conflict {
    font-size: 0.5625rem;
    color: var(--color-red-500, #ef4444);
    text-align: center;
    margin-top: 2px;
  }
</style>
