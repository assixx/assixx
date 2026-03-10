<script lang="ts">
  /**
   * TPM Slot Assistant Component
   * @module plan/[uuid]/_lib/SlotAssistant
   *
   * 7-column calendar grid showing available/busy days for a asset.
   * Combines two data sources:
   *   1. Slot Assistant (5-source check, max 90 days)
   *   2. Schedule Projection (cross-plan TPM dates, max 365 days)
   *
   * For the first 90 days: full slot data with projection overlay.
   * Beyond 90 days: only projected TPM schedules shown.
   *
   * Pure helpers extracted to ./slot-assistant-helpers.ts
   */
  import AppDatePicker from '$lib/components/AppDatePicker.svelte';
  import { showErrorAlert } from '$lib/stores/toast';

  import {
    fetchAvailableSlots,
    fetchAvailableSlotsByAsset,
    fetchScheduleProjection,
    fetchTeamAvailability,
    fetchPlanAssignments,
    logApiError,
  } from '../../../_lib/api';
  import {
    INTERVAL_LABELS,
    INTERVAL_COLORS,
    MESSAGES,
  } from '../../../_lib/constants';
  import {
    timestampToISO,
    weekOfMonth,
    NINETY_DAYS_MS,
    MAX_RANGE_MS,
    MAX_RANGE_365_MS,
  } from '../../../_lib/date-helpers';

  import AssignmentModal from './AssignmentModal.svelte';
  import {
    WEEKDAY_HEADERS,
    type CalendarRow,
    buildLookupMap,
    isoWeekday,
    formatDayMonth,
    getConflictLabel,
    getConflictIcon,
    hasTpmScheduleConflict,
    buildDayTooltip,
    computeCalendarRows,
    mergeCalendarDays,
    computePreviewData,
  } from './slot-assistant-helpers';
  import SlotDayContent from './SlotDayContent.svelte';
  import SlotPreviewBadge from './SlotPreviewBadge.svelte';
  import TimelineDayView from './TimelineDayView.svelte';

  import type {
    SlotAvailabilityResult,
    ScheduleProjectionResult,
    ProjectedSlot,
    DayAvailability,
    IntervalType,
    IntervalColorConfigEntry,
    AssetTeamAvailabilityResult,
    TeamMemberStatus,
    TpmPlanAssignment,
  } from '../../../_lib/types';

  interface Props {
    planUuid?: string;
    assetUuid?: string;
    shiftPlanRequired?: boolean;
    cardsHref?: string;
    intervalColors?: IntervalColorConfigEntry[];
    previewWeekday?: number;
    previewRepeatEvery?: number;
    ondataload?: (
      slots: ProjectedSlot[],
      planAssignments: TpmPlanAssignment[],
    ) => void;
  }

  const {
    planUuid,
    assetUuid,
    shiftPlanRequired,
    cardsHref,
    intervalColors = [],
    previewWeekday,
    previewRepeatEvery,
    ondataload,
  }: Props = $props();

  // Build color lookup: custom API colors override hardcoded defaults
  const colorMap = $derived.by((): Record<IntervalType, string> => {
    const base = { ...INTERVAL_COLORS };
    for (const entry of intervalColors) {
      base[entry.statusKey] = entry.colorHex;
    }
    return base;
  });

  const isEditMode = $derived(planUuid !== undefined && planUuid.length > 0);
  const canFetch = $derived(
    isEditMode || (assetUuid !== undefined && assetUuid.length > 0),
  );

  // =========================================================================
  // STATE
  // =========================================================================

  let loading = $state(false);
  let slotData = $state<SlotAvailabilityResult | null>(null);
  let projectionData = $state<ScheduleProjectionResult | null>(null);
  let selectedDay = $state<string | null>(null);
  let showWeekends = $state(false);
  let showOnlyScheduled = $state(false);
  /** Saved endDate before switching to scheduled-only mode */
  let savedEndDate = $state('');

  // Assignment state (edit mode only)
  let teamMembers = $state<TeamMemberStatus[]>([]);
  let assignments = $state<TpmPlanAssignment[]>([]);
  let assignmentModalDate = $state<string | null>(null);

  /** Assignments grouped by date for quick lookup */
  const assignmentsByDate = $derived.by(() =>
    buildLookupMap(assignments, (a: TpmPlanAssignment) => a.scheduledDate),
  );

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
  const projectionByDate = $derived.by(() =>
    buildLookupMap(projectionData?.slots ?? [], (s: ProjectedSlot) => s.date),
  );

  // Merged calendar days: slot data + projection-only days beyond 90d
  const calendarDays = $derived.by((): DayAvailability[] =>
    mergeCalendarDays(
      slotData?.days ?? [],
      rangeExceedsSlotLimit,
      endDate,
      slotEndDate,
      projectionByDate,
    ),
  );

  // Visible headers and days (filtered by weekend toggle)
  const visibleHeaders = $derived(
    showWeekends ? WEEKDAY_HEADERS : WEEKDAY_HEADERS.slice(0, 5),
  );
  const visibleCalendarDays = $derived(
    showWeekends ? calendarDays : (
      calendarDays.filter((d: DayAvailability) => isoWeekday(d.date) < 5)
    ),
  );

  /** Preview: matching dates + their interval badges */
  const previewResult = $derived.by(() =>
    computePreviewData(
      previewWeekday,
      previewRepeatEvery,
      visibleCalendarDays,
      projectionData,
      planUuid,
    ),
  );
  const previewDates = $derived(previewResult.dates);
  const previewIntervals = $derived(previewResult.intervals);

  // Compact view: only scheduled days + preview days (no grid gaps)
  const scheduledDays = $derived(
    visibleCalendarDays.filter(
      (d: DayAvailability) =>
        hasTpmScheduleConflict(d) ||
        (projectionByDate.get(d.date)?.length ?? 0) > 0 ||
        previewDates.has(d.date),
    ),
  );

  // Stats from visible days only
  const totalDays = $derived(visibleCalendarDays.length);
  const availableDays = $derived(
    visibleCalendarDays.filter((d: DayAvailability) => d.isAvailable).length,
  );

  const calendarRows = $derived.by((): CalendarRow[] =>
    computeCalendarRows(visibleCalendarDays, visibleHeaders.length),
  );

  // =========================================================================
  // REACTIVE STATE ACCESSORS
  // =========================================================================

  function getSlotsForDate(dateStr: string): ProjectedSlot[] {
    return projectionByDate.get(dateStr) ?? [];
  }

  function isCurrentPlanDate(dateStr: string): boolean {
    if (planUuid === undefined) return false;
    const slots = projectionByDate.get(dateStr) ?? [];
    return slots.some((s: ProjectedSlot) => s.planUuid === planUuid);
  }

  function getAssignmentsForDate(dateStr: string): TpmPlanAssignment[] {
    return assignmentsByDate.get(dateStr) ?? [];
  }

  function handleDayClick(day: DayAvailability): void {
    if (isEditMode && isCurrentPlanDate(day.date)) {
      assignmentModalDate = day.date;
    } else {
      selectedDay = selectedDay === day.date ? null : day.date;
    }
  }

  function handleAssignmentsSaved(saved: TpmPlanAssignment[]): void {
    if (assignmentModalDate === null) return;
    const otherAssignments = assignments.filter(
      (a: TpmPlanAssignment) => a.scheduledDate !== assignmentModalDate,
    );
    assignments = [...otherAssignments, ...saved];
  }

  // =========================================================================
  // LOAD SLOTS + PROJECTION
  // =========================================================================

  function buildEditModePromises(): [
    Promise<AssetTeamAvailabilityResult | null>,
    Promise<TpmPlanAssignment[]>,
  ] {
    if (!isEditMode || planUuid === undefined) {
      return [Promise.resolve(null), Promise.resolve([])];
    }
    return [
      fetchTeamAvailability(planUuid),
      fetchPlanAssignments(planUuid, startDate, endDate),
    ];
  }

  function applyLoadedData(
    slotResult: SlotAvailabilityResult | null,
    projResult: ScheduleProjectionResult | null,
    teamResult: AssetTeamAvailabilityResult | null,
    assignResult: TpmPlanAssignment[],
  ): void {
    slotData = slotResult;
    projectionData = projResult;
    teamMembers = teamResult?.members ?? [];
    assignments = assignResult;
    ondataload?.(projResult?.slots ?? [], assignResult);
  }

  async function loadData(): Promise<void> {
    if (!canFetch || startDate.length === 0 || endDate.length === 0) return;
    selectedDay = null;
    loading = true;
    try {
      const [teamPromise, assignPromise] = buildEditModePromises();
      const [slotResult, projResult, teamResult, assignResult] =
        await Promise.all([
          loadSlotData(),
          fetchScheduleProjection(startDate, endDate),
          teamPromise,
          assignPromise,
        ]);

      applyLoadedData(slotResult, projResult, teamResult, assignResult);
    } catch (err: unknown) {
      logApiError('loadData', err);
      showErrorAlert(err instanceof Error ? err.message : 'Fehler beim Laden');
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
    if (assetUuid !== undefined) {
      return await fetchAvailableSlotsByAsset(
        assetUuid,
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
    void assetUuid;
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
        <label class="choice-card slot-weekend-toggle">
          <input
            type="checkbox"
            class="choice-card__input"
            bind:checked={showWeekends}
          />
          <span class="choice-card__text">{MESSAGES.SLOT_SHOW_WEEKENDS}</span>
        </label>
        <label class="choice-card slot-weekend-toggle">
          <input
            type="checkbox"
            class="choice-card__input"
            checked={showOnlyScheduled}
            onchange={() => {
              showOnlyScheduled = !showOnlyScheduled;
              if (showOnlyScheduled) {
                savedEndDate = endDate;
                endDate = maxEndDate;
                void loadData();
              } else {
                endDate = savedEndDate;
                void loadData();
              }
            }}
          />
          <span class="choice-card__text"
            >{MESSAGES.SLOT_SHOW_ONLY_SCHEDULED}</span
          >
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
        {#each Object.entries(colorMap).filter(([k]) => k !== 'daily' && k !== 'weekly') as [key, color] (key)}
          <span
            class="flex items-center gap-1.5 text-xs text-(--color-text-secondary)"
            title={INTERVAL_LABELS[key as IntervalType]}
          >
            <span
              class="slot-dot"
              style="background: {color}"
            ></span>
            {INTERVAL_LABELS[key as IntervalType]}
          </span>
        {/each}
        {#if isEditMode}
          <span
            class="flex items-center gap-1.5 text-xs text-(--color-text-secondary)"
          >
            <span class="slot-dot slot-dot--other-plan"></span>
            Anderer Plan
          </span>
        {/if}
        {#if previewDates.size > 0}
          <span
            class="flex items-center gap-1.5 text-xs text-(--color-text-secondary)"
          >
            <span
              class="slot-dot"
              style="background: #9333ea"
            ></span>
            Vorschau
          </span>
        {/if}
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
      {#if showOnlyScheduled}
        <!-- Compact: only scheduled days, no grid gaps -->
        <div class="slot-compact">
          {#each scheduledDays as day (day.date)}
            {@const projSlots = getSlotsForDate(day.date)}
            {@const isPreview = previewDates.has(day.date)}
            {@const isScheduled =
              hasTpmScheduleConflict(day) || projSlots.length > 0}
            {@const isCurrentPlan = isCurrentPlanDate(day.date)}
            <div
              class="slot-day"
              class:slot-day--scheduled={isScheduled &&
                !isPreview &&
                isCurrentPlan}
              class:slot-day--other-plan={isScheduled &&
                !isPreview &&
                !isCurrentPlan}
              class:slot-day--preview={isPreview}
              class:slot-day--selected={selectedDay === day.date}
              title={buildDayTooltip(day, projSlots)}
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
              <span class="slot-day__date"
                >{formatDayMonth(day.date, true)}</span
              >
              {#if isScheduled}
                <SlotDayContent
                  slots={projSlots}
                  {colorMap}
                />
                {#if isPreview}
                  <SlotPreviewBadge
                    intervalTypes={previewIntervals.get(day.date) ?? []}
                    {colorMap}
                  />
                {/if}
              {:else if isPreview}
                <SlotPreviewBadge
                  intervalTypes={previewIntervals.get(day.date) ?? []}
                  {colorMap}
                />
              {/if}
              {#if getAssignmentsForDate(day.date).length > 0}
                <div class="slot-day__assignments">
                  {#each getAssignmentsForDate(day.date) as a (a.uuid)}
                    <span class="badge badge--sm badge--info"
                      >{a.lastName}, {a.firstName}</span
                    >
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <!-- Calendar grid with WM/KW labels + month separators -->
        <div
          class="slot-calendar"
          class:slot-calendar--weekdays-only={!showWeekends}
        >
          <!-- Header row: KW label + weekday headers -->
          <div class="slot-row-label slot-header">KW</div>
          {#each visibleHeaders as header, i (i)}
            <div
              class="slot-header"
              class:slot-header--weekend={showWeekends && i >= 5}
            >
              {header}
            </div>
          {/each}

          {#each calendarRows as row, rowIdx (rowIdx)}
            {#if row.monthLabel.length > 0}
              <div class="slot-month-sep">{row.monthLabel}</div>
            {/if}
            <div class="slot-row-label slot-row-label--kw">{row.kw}</div>
            {#each row.cells as cell, ci (ci)}
              {#if cell === null}
                <div class="slot-empty"></div>
              {:else}
                {@const day = cell}
                {@const dayProjSlots = getSlotsForDate(day.date)}
                {@const available = day.isAvailable}
                {@const isWeekend = isoWeekday(day.date) >= 5}
                {@const isScheduled =
                  hasTpmScheduleConflict(day) || dayProjSlots.length > 0}
                {@const isPreview = previewDates.has(day.date)}
                {@const isCurrentPlan = isCurrentPlanDate(day.date)}
                <div
                  class="slot-day"
                  class:slot-day--available={available &&
                    !isScheduled &&
                    !isPreview}
                  class:slot-day--unavailable={!available &&
                    !isScheduled &&
                    !isPreview}
                  class:slot-day--scheduled={isScheduled &&
                    !isPreview &&
                    isCurrentPlan}
                  class:slot-day--other-plan={isScheduled &&
                    !isPreview &&
                    !isCurrentPlan}
                  class:slot-day--preview={isPreview}
                  class:slot-day--hidden={showOnlyScheduled &&
                    !isScheduled &&
                    !isPreview}
                  class:slot-day--weekend={isWeekend}
                  class:slot-day--selected={selectedDay === day.date}
                  title={buildDayTooltip(day, dayProjSlots)}
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
                  <span class="slot-day__date">
                    <sup class="slot-day__occ">{weekOfMonth(day.date)}</sup>
                    {formatDayMonth(day.date, showOnlyScheduled)}
                  </span>
                  {#if isScheduled}
                    <SlotDayContent
                      slots={dayProjSlots}
                      {colorMap}
                    />
                    {#if isPreview}
                      <SlotPreviewBadge
                        intervalTypes={previewIntervals.get(day.date) ?? []}
                        {colorMap}
                      />
                    {/if}
                  {:else if isPreview}
                    <SlotPreviewBadge
                      intervalTypes={previewIntervals.get(day.date) ?? []}
                      {colorMap}
                    />
                  {:else if available}
                    <i class="fas fa-check slot-day__icon slot-day__icon--ok"
                    ></i>
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
                  {#if getAssignmentsForDate(day.date).length > 0}
                    <div class="slot-day__assignments">
                      {#each getAssignmentsForDate(day.date) as a (a.uuid)}
                        <span class="badge badge--sm badge--info"
                          >{a.lastName}, {a.firstName}</span
                        >
                      {/each}
                    </div>
                  {/if}
                </div>
              {/if}
            {/each}
          {/each}
        </div>
      {/if}

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

    <!-- Assignment Modal -->
    {#if assignmentModalDate !== null && planUuid !== undefined}
      <AssignmentModal
        {planUuid}
        scheduledDate={assignmentModalDate}
        members={teamMembers}
        currentAssignments={getAssignmentsForDate(assignmentModalDate)}
        onclose={() => {
          assignmentModalDate = null;
        }}
        onsaved={handleAssignmentsSaved}
      />
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

  .slot-dot--other-plan {
    background: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 2px,
      color-mix(in srgb, var(--color-text-muted) 40%, transparent) 2px,
      color-mix(in srgb, var(--color-text-muted) 40%, transparent) 4px
    );
    border: 1px solid
      color-mix(in srgb, var(--color-text-muted) 30%, transparent);
  }

  /* ---- Calendar Grid ---- */

  /* ---- Compact Layout ---- */

  .slot-compact {
    display: flex;
    flex-wrap: wrap;
    gap: 30px;
  }

  .slot-compact .slot-day {
    min-width: 190px;
  }

  .slot-calendar {
    display: grid;
    grid-template-columns: auto repeat(7, 1fr);
    gap: 4px;
  }

  .slot-calendar--weekdays-only {
    grid-template-columns: auto repeat(5, 1fr);
  }

  .slot-month-sep {
    grid-column: 1 / -1;
    font-size: 0.813rem;
    font-weight: 700;
    color: var(--color-text-primary);
    padding: 0.5rem 0 0.25rem;
    border-bottom: 1px solid
      color-mix(in srgb, var(--color-text-muted) 25%, transparent);
    text-align: center;
  }

  .slot-row-label {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.625rem;
    color: var(--color-text-muted);
    padding: 0 0.125rem;
    min-width: 20px;
  }

  .slot-row-label--kw {
    font-size: 0.563rem;
    white-space: nowrap;
  }

  /* Weekend toggle — compact sizing override for choice-card */
  .slot-weekend-toggle {
    padding: 0.375rem 0.75rem;
    border-radius: var(--radius-md);
    margin: 0;
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
    padding: 0.3rem 0.25rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition:
      opacity 0.15s,
      box-shadow 0.15s;
  }

  .slot-day:hover {
    opacity: 85%;
  }

  .slot-day--selected {
    box-shadow: 0 0 0 2px var(--color-info, #3b82f6);
  }

  .slot-day--hidden {
    visibility: hidden;
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

  .slot-day--other-plan {
    background: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 4px,
      color-mix(in srgb, var(--color-text-muted) 8%, transparent) 4px,
      color-mix(in srgb, var(--color-text-muted) 8%, transparent) 8px
    );
    border: 1px solid
      color-mix(in srgb, var(--color-text-muted) 20%, transparent);
    opacity: 70%;
  }

  .slot-day--preview {
    background: color-mix(in srgb, var(--color-violet-600) 12%, transparent);
    border: 1px solid
      color-mix(in srgb, var(--color-violet-600) 35%, transparent);
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

  .slot-day__occ {
    font-size: 0.563rem;
    font-weight: 700;
    color: var(--color-text-muted);
    margin-right: 1px;
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

  .slot-day__assignments {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
</style>
