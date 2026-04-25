<script lang="ts">
  /**
   * Gesamtansicht Table Component
   * @module gesamtansicht/_lib/GesamtansichtTable
   *
   * Single table: colored interval headers → schedule rows → estimate rows.
   * Estimate sub-columns span to fit under the same interval groups.
   */
  import { showErrorAlert } from '$lib/stores/toast';
  import { logger } from '$lib/utils/logger';

  import {
    fetchPlans,
    fetchScheduleProjection,
    fetchTimeEstimates,
    fetchIntervalColors,
    fetchShiftAssignments,
    logApiError,
  } from '../../_lib/api';
  import {
    INTERVAL_LABELS,
    INTERVAL_COLORS,
    ZOOM_CONFIG,
    type TpmMessages,
  } from '../../_lib/constants';

  import {
    INTERVAL_COLUMNS,
    buildMatrix,
    buildDateIndex,
    buildAssignmentCounts,
  } from './overall-view-utils';
  import OverallViewAssignments from './OverallViewAssignments.svelte';
  import OverallViewCounts from './OverallViewCounts.svelte';
  import OverallViewGrouped from './OverallViewGrouped.svelte';
  import OverallViewRow from './OverallViewRow.svelte';

  import type { MatrixRow } from './overall-view-utils';
  import type {
    IntervalType,
    TpmPlan,
    TpmTimeEstimate,
    TpmShiftAssignment,
    ProjectedSlot,
    IntervalColorConfigEntry,
  } from '../../_lib/types';

  interface Props {
    messages: TpmMessages;
  }

  const { messages }: Props = $props();

  // =========================================================================
  // STATE
  // =========================================================================

  let groupedView = $state(false);
  let maxDates = $state(4);
  let loading = $state(true);
  let plans = $state<TpmPlan[]>([]);
  let slots = $state<ProjectedSlot[]>([]);
  let estimatesByPlan = $state(new Map<string, TpmTimeEstimate[]>());
  let intervalColorEntries = $state<IntervalColorConfigEntry[]>([]);
  let assignments = $state<TpmShiftAssignment[]>([]);
  let zoomLevel: number = $state(ZOOM_CONFIG.DEFAULT);

  // =========================================================================
  // DERIVED
  // =========================================================================

  const colorMap = $derived.by((): Record<IntervalType, string> => {
    const base = { ...INTERVAL_COLORS };
    for (const entry of intervalColorEntries) {
      base[entry.statusKey] = entry.colorHex;
    }
    return base;
  });

  const matrixRows: MatrixRow[] = $derived(buildMatrix(plans, slots, maxDates));

  const hasAnyEstimates = $derived(
    [...estimatesByPlan.values()].some((list: TpmTimeEstimate[]) => list.length > 0),
  );

  const hasAnyAssignments = $derived(assignments.length > 0);

  const dateIndex = $derived(buildDateIndex(matrixRows));
  const assignmentCounts = $derived(buildAssignmentCounts(assignments, dateIndex));

  /** Colspan distribution: 4 sub-columns across maxDates cells */
  const estColSpans = $derived.by((): number[] => {
    const base = Math.floor(maxDates / 4);
    const extra = maxDates % 4;
    return [0, 1, 2, 3].map((i: number) => base + (i < extra ? 1 : 0));
  });

  // =========================================================================
  // DATA LOADING
  // =========================================================================

  /** Debounce timer for slider-triggered reloads */
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  const DEBOUNCE_MS = 300;

  /**
   * Date range scales with maxDates:
   * annual interval × maxDates = years needed.
   * maxDates=4 → 1460 days, maxDates=10 → 3650 days.
   */
  function getDateRange(dates: number): { start: string; end: string } {
    const now = new Date();
    const start = now.toISOString().split('T')[0];
    const end = new Date(now.getTime() + dates * 365 * 86_400_000).toISOString().split('T')[0];
    return { start, end };
  }

  async function loadData(dates: number): Promise<void> {
    loading = true;
    try {
      const { start, end } = getDateRange(dates);
      const [plansRes, projRes, colorsRes, assignRes] = await Promise.all([
        fetchPlans(1, 100),
        fetchScheduleProjection(start, end),
        fetchIntervalColors(),
        fetchShiftAssignments(start, end),
      ]);

      const activePlans = plansRes.items.filter((p: TpmPlan) => p.isActive === 1);
      plans = activePlans;
      slots = projRes?.slots ?? [];
      intervalColorEntries = colorsRes;
      assignments = assignRes;

      await loadEstimates(activePlans);
    } catch (err: unknown) {
      logApiError('GesamtansichtTable.loadData', err);
      showErrorAlert(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      loading = false;
    }
  }

  async function loadEstimates(planList: TpmPlan[]): Promise<void> {
    const entries = await Promise.all(
      planList.map(async (p: TpmPlan): Promise<[string, TpmTimeEstimate[]]> => {
        try {
          return [p.uuid, await fetchTimeEstimates(p.uuid)];
        } catch {
          return [p.uuid, []];
        }
      }),
    );
    estimatesByPlan = new Map(entries);
  }

  function getEstimate(planUuid: string, intv: IntervalType): TpmTimeEstimate | undefined {
    const list = estimatesByPlan.get(planUuid);
    return list?.find((e: TpmTimeEstimate) => e.intervalType === intv);
  }

  // =========================================================================
  // ZOOM + FULLSCREEN
  // =========================================================================

  function zoomIn(): void {
    if (zoomLevel < ZOOM_CONFIG.MAX) zoomLevel += ZOOM_CONFIG.STEP;
  }

  function zoomOut(): void {
    if (zoomLevel > ZOOM_CONFIG.MIN) zoomLevel -= ZOOM_CONFIG.STEP;
  }

  function zoomReset(): void {
    zoomLevel = ZOOM_CONFIG.DEFAULT;
  }

  async function toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement !== null) {
        await document.exitFullscreen();
      } else {
        document.body.classList.add('tpm-gv-fullscreen');
        await document.documentElement.requestFullscreen();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown fullscreen error';
      logger.error(message);
      document.body.classList.remove('tpm-gv-fullscreen');
    }
  }

  function handleFullscreenChange(): void {
    if (document.fullscreenElement === null) {
      document.body.classList.remove('tpm-gv-fullscreen');
    }
  }

  $effect(() => {
    const dates = maxDates;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void loadData(dates);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceTimer);
    };
  });
</script>

<svelte:document onfullscreenchange={handleFullscreenChange} />

<div class="gv-container">
  <!-- Controls: Slider + Zoom -->
  <div class="gv-controls">
    <label
      class="gv-slider"
      for="gv-max-dates"
    >
      <span class="gv-slider__label">{messages.GESAMTANSICHT_SLIDER_LABEL}</span>
      <input
        id="gv-max-dates"
        type="range"
        class="gv-slider__input"
        min={4}
        max={10}
        step={1}
        bind:value={maxDates}
      />
      <span class="gv-slider__value">{maxDates}</span>
    </label>

    <label class="choice-card">
      <input
        type="checkbox"
        class="choice-card__input"
        bind:checked={groupedView}
      />
      <span class="choice-card__text">{messages.GESAMTANSICHT_TOGGLE_GROUPED}</span>
    </label>

    <div class="zoom-controls">
      <button
        type="button"
        class="btn btn-icon btn-secondary"
        title={messages.ZOOM_IN}
        disabled={zoomLevel >= ZOOM_CONFIG.MAX}
        onclick={zoomIn}><i class="fas fa-plus"></i></button
      >
      <span class="zoom-level">{zoomLevel}%</span>
      <button
        type="button"
        class="btn btn-icon btn-secondary"
        title={messages.ZOOM_OUT}
        disabled={zoomLevel <= ZOOM_CONFIG.MIN}
        onclick={zoomOut}><i class="fas fa-minus"></i></button
      >
      <button
        type="button"
        class="btn btn-icon btn-secondary"
        title={messages.ZOOM_RESET}
        onclick={zoomReset}><i class="fas fa-compress-arrows-alt"></i></button
      >
      <button
        type="button"
        class="btn btn-icon btn-secondary ml-2"
        title={messages.ZOOM_FULLSCREEN}
        onclick={() => {
          void toggleFullscreen();
        }}><i class="fas fa-expand"></i></button
      >
    </div>
  </div>

  {#if loading}
    <div class="gv-loading">
      <i class="fas fa-spinner fa-spin"></i>
      {messages.GESAMTANSICHT_LOADING}
    </div>
  {:else if matrixRows.length === 0}
    <div class="empty-state">
      <div class="empty-state__icon">
        <i class="fas fa-clipboard-list"></i>
      </div>
      <h3 class="empty-state__title">{messages.GESAMTANSICHT_EMPTY}</h3>
    </div>
  {:else}
    <div class="table-responsive">
      <table
        class="gv-table"
        style="zoom: {zoomLevel / 100};"
      >
        <!-- ===== HEADER ===== -->
        <thead>
          <tr>
            <th class="gv-th gv-th--sticky">
              {messages.GESAMTANSICHT_TH_MACHINE}
            </th>
            <th class="gv-th gv-th--sticky gv-th--col2">{messages.GESAMTANSICHT_TH_TIME}</th>
            {#each INTERVAL_COLUMNS as col (col)}
              <th
                colspan={maxDates}
                class="gv-th gv-th--interval"
                style="background: {colorMap[col]}; color: #fff"
              >
                {INTERVAL_LABELS[col]}
              </th>
            {/each}
          </tr>
        </thead>

        {#if groupedView}
          <!-- ===== GROUPED VIEW ===== -->
          <OverallViewGrouped
            {matrixRows}
            {maxDates}
            {estColSpans}
            {estimatesByPlan}
            {assignments}
          />
        {:else}
          <!-- ===== FLAT VIEW (Default) ===== -->
          <tbody>
            {#each matrixRows as row (row.plan.uuid)}
              <OverallViewRow
                {row}
                {maxDates}
              />
            {/each}
          </tbody>

          {#if hasAnyEstimates}
            <tbody class="gv-est-body">
              <tr class="gv-est-header">
                <th
                  class="gv-th gv-th--sticky"
                  colspan={2}
                >
                  {messages.GESAMTANSICHT_TH_MACHINE}
                </th>
                {#each INTERVAL_COLUMNS as _ (_)}
                  <th
                    class="gv-th gv-th--sub"
                    colspan={estColSpans[0]}
                  >
                    {messages.GESAMTANSICHT_TH_STAFF}
                  </th>
                  <th
                    class="gv-th gv-th--sub"
                    colspan={estColSpans[1]}
                  >
                    {messages.GESAMTANSICHT_TH_PREP}
                  </th>
                  <th
                    class="gv-th gv-th--sub"
                    colspan={estColSpans[2]}
                  >
                    {messages.GESAMTANSICHT_TH_EXEC}
                  </th>
                  <th
                    class="gv-th gv-th--sub"
                    colspan={estColSpans[3]}
                  >
                    {messages.GESAMTANSICHT_TH_FOLLOW}
                  </th>
                {/each}
              </tr>
              {#each matrixRows as row (row.plan.uuid)}
                <tr>
                  <td
                    class="gv-est-cell gv-est-cell--asset"
                    colspan={2}
                  >
                    {row.plan.assetName ?? '\u2014'}
                  </td>
                  {#each INTERVAL_COLUMNS as col (col)}
                    {@const est = getEstimate(row.plan.uuid, col)}
                    {#if est !== undefined && est.totalMinutes > 0}
                      <td
                        class="gv-est-cell gv-est-cell--num"
                        colspan={estColSpans[0]}>{est.staffCount}</td
                      >
                      <td
                        class="gv-est-cell gv-est-cell--num"
                        colspan={estColSpans[1]}>{est.preparationMinutes}</td
                      >
                      <td
                        class="gv-est-cell gv-est-cell--num"
                        colspan={estColSpans[2]}>{est.executionMinutes}</td
                      >
                      <td
                        class="gv-est-cell gv-est-cell--num"
                        colspan={estColSpans[3]}>{est.followupMinutes}</td
                      >
                    {:else}
                      <td
                        class="gv-est-cell"
                        colspan={estColSpans[0]}
                      ></td>
                      <td
                        class="gv-est-cell"
                        colspan={estColSpans[1]}
                      ></td>
                      <td
                        class="gv-est-cell"
                        colspan={estColSpans[2]}
                      ></td>
                      <td
                        class="gv-est-cell"
                        colspan={estColSpans[3]}
                      ></td>
                    {/if}
                  {/each}
                </tr>
              {/each}
            </tbody>
          {/if}

          {#if hasAnyAssignments}
            <OverallViewAssignments
              {matrixRows}
              {assignments}
              {maxDates}
            />
          {/if}
        {/if}
      </table>
    </div>

    {#if assignmentCounts.length > 0}
      <OverallViewCounts counts={assignmentCounts} />
    {/if}
  {/if}
</div>

<style>
  .gv-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .gv-slider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
  }

  .gv-slider__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .gv-slider__input {
    width: 160px;
    accent-color: var(--color-primary);
  }

  .gv-slider__value {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--color-primary);
    min-width: 1.5rem;
    text-align: center;
  }

  .gv-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 3rem;
    color: var(--color-text-muted);
  }

  /* ---- Table ---- */
  .gv-table {
    border-collapse: separate;
    border-spacing: 0;
    width: max-content;
    font-size: 0.8rem;
  }

  /* ---- Header ---- */
  .gv-th {
    padding: 0.5rem;
    text-align: center;
    white-space: nowrap;
    border-bottom: 1px solid var(--color-glass-border);
    border-right: 1px solid var(--color-glass-border);
  }

  .gv-th--sticky {
    position: sticky;
    left: 0;
    background: var(--color-surface);
    color: var(--color-text-primary);
    z-index: 2;
    text-align: left;
  }

  .gv-th--col2 {
    left: 8rem;
  }

  .gv-th--interval {
    font-weight: 700;
    font-size: 0.85rem;
    letter-spacing: 0.025em;
    border: 1px solid color-mix(in oklch, var(--color-white) 30%, transparent);
  }

  .gv-th--sub {
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--color-text-muted);
    padding: 0.25rem;
    background: var(--glass-bg-hover);
  }

  /* ---- Estimate section ---- */
  .gv-est-body {
    border-top: 3px solid var(--color-glass-border);
  }

  .gv-est-body tr:last-child td {
    padding-bottom: 1rem;
  }

  .gv-est-header {
    background: var(--glass-bg-hover);
  }

  .gv-est-cell {
    padding: 0.25rem 0.375rem;
    border-bottom: 1px solid var(--color-glass-border);
    border-right: 1px solid var(--color-glass-border);
  }

  .gv-est-cell--asset {
    font-weight: 600;
    font-size: 0.85rem;
    position: sticky;
    left: 0;
    background: var(--color-surface);
    color: var(--color-text-primary);
    z-index: 1;
  }

  .gv-est-cell--num {
    text-align: center;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  /* ---- Zoom Controls ---- */
  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    border-radius: var(--radius-xl);
  }

  .zoom-level {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    min-width: 3rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  /* ---- Fullscreen ---- */
  :global(body.tpm-gv-fullscreen .gv-container) {
    position: fixed !important;
    z-index: 9999 !important;
    inset: 0 !important;
    margin: 0 !important;
    padding: 1.5rem !important;
    width: 100% !important;
    min-height: 100vh !important;
    overflow: auto;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }

  :global(body.tpm-gv-fullscreen .sidebar),
  :global(body.tpm-gv-fullscreen .header),
  :global(body.tpm-gv-fullscreen #breadcrumb-container),
  :global(body.tpm-gv-fullscreen .gv-header),
  :global(body.tpm-gv-fullscreen .tpm-counts) {
    display: none !important;
  }

  :global(body.tpm-gv-fullscreen .card) {
    margin: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
    padding: 0 !important;
    box-shadow: none !important;
  }
</style>
