<script lang="ts">
  /**
   * TPM Mängelgrafik — Pure SVG Chart
   *
   * Visualizes cumulative defects detected vs resolved per calendar week.
   * Mirrors the paper-based "Mängelgrafik" from production floors.
   */
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  import PermissionDenied from '$lib/components/PermissionDenied.svelte';

  import { MESSAGES } from '../../../_lib/constants';

  import type { PageData } from './$types';
  import type { DefectWeeklyEntry } from '../../../_lib/types';

  const { data }: { data: PageData } = $props();

  const permissionDenied = $derived(data.permissionDenied);
  const plan = $derived(data.plan);
  const chartData = $derived(data.chartData);
  const currentYear = $derived(data.year);
  const error = $derived(data.error);

  // =========================================================================
  // CHART DIMENSIONS
  // =========================================================================

  const CHART = {
    width: 1100,
    height: 460,
    padding: { top: 30, right: 40, bottom: 60, left: 70 },
  } as const;

  const plotWidth = CHART.width - CHART.padding.left - CHART.padding.right;
  const plotHeight = CHART.height - CHART.padding.top - CHART.padding.bottom;

  // =========================================================================
  // SCALE CALCULATIONS
  // =========================================================================

  /** Weeks with actual data (non-zero cumulative values) */
  const activeWeeks = $derived.by((): DefectWeeklyEntry[] => {
    if (chartData === null) return [];
    return chartData.weeks.filter((w) => w.cumulativeDetected > 0 || w.cumulativeResolved > 0);
  });

  /** Whether chart has any data to show */
  const hasData = $derived(activeWeeks.length > 0);

  /** Y-axis range: auto-scale from data with padding */
  const yRange = $derived.by((): { min: number; max: number; step: number } => {
    if (chartData === null || !hasData) return { min: 0, max: 10, step: 1 };

    let dataMin = Infinity;
    let dataMax = -Infinity;

    for (const w of chartData.weeks) {
      if (w.cumulativeDetected > 0 || w.cumulativeResolved > 0) {
        dataMin = Math.min(dataMin, w.cumulativeDetected, w.cumulativeResolved);
        dataMax = Math.max(dataMax, w.cumulativeDetected, w.cumulativeResolved);
      }
    }

    if (dataMin === Infinity) return { min: 0, max: 10, step: 1 };

    const range = dataMax - dataMin;
    const step = calculateStep(range);
    const min = Math.max(0, Math.floor(dataMin / step) * step - step);
    const max = Math.ceil(dataMax / step) * step + step;

    return { min, max, step };
  });

  /** Y-axis tick labels */
  const yTicks = $derived.by((): number[] => {
    const ticks: number[] = [];
    for (let v = yRange.min; v <= yRange.max; v += yRange.step) {
      ticks.push(v);
    }
    return ticks;
  });

  // =========================================================================
  // COORDINATE HELPERS
  // =========================================================================

  function xForWeek(week: number): number {
    return CHART.padding.left + ((week - 1) / 51) * plotWidth;
  }

  function yForValue(value: number): number {
    const ratio = (value - yRange.min) / (yRange.max - yRange.min);
    return CHART.padding.top + plotHeight - ratio * plotHeight;
  }

  function calculateStep(range: number): number {
    if (range <= 10) return 1;
    if (range <= 25) return 5;
    if (range <= 50) return 5;
    if (range <= 100) return 10;
    if (range <= 250) return 25;
    return 50;
  }

  /** Current calendar week (limits display to past/present, not future) */
  const currentWeek = $derived.by((): number => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - yearStart.getTime()) / 86_400_000);
    return Math.min(52, Math.ceil((days + yearStart.getDay() + 1) / 7));
  });

  /** Weeks up to current KW that have any cumulative data (for polylines) */
  const lineWeeks = $derived.by((): DefectWeeklyEntry[] => {
    if (chartData === null) return [];
    const maxWeek = currentYear < new Date().getFullYear() ? 52 : currentWeek;
    return chartData.weeks.filter(
      (w) => w.week <= maxWeek && (w.cumulativeDetected > 0 || w.cumulativeResolved > 0),
    );
  });

  /** Build SVG polyline points string from filtered weeks */
  function buildLinePoints(
    weeks: DefectWeeklyEntry[],
    key: 'cumulativeDetected' | 'cumulativeResolved',
  ): string {
    return weeks.map((w) => `${xForWeek(w.week)},${yForValue(w[key])}`).join(' ');
  }

  /** Weeks where defects were actually DETECTED (for red dots) */
  const detectedDotWeeks = $derived.by((): DefectWeeklyEntry[] => {
    if (chartData === null) return [];
    return chartData.weeks.filter((w) => w.detected > 0);
  });

  /** Weeks where defects were actually RESOLVED (for green dots) */
  const resolvedDotWeeks = $derived.by((): DefectWeeklyEntry[] => {
    if (chartData === null) return [];
    return chartData.weeks.filter((w) => w.resolved > 0);
  });

  /** Set of weeks where BOTH detected AND resolved happened at same Y (for overlap offset) */
  const overlapWeeks = $derived.by((): ReadonlySet<number> => {
    const detected = new Map(detectedDotWeeks.map((w) => [w.week, w.cumulativeDetected]));
    const result: number[] = [];
    for (const w of resolvedDotWeeks) {
      if (detected.get(w.week) === w.cumulativeResolved) {
        result.push(w.week);
      }
    }
    return new Set(result);
  });

  /** Horizontal offset for dots that overlap (±5px) */
  function dotX(week: number, type: 'detected' | 'resolved'): number {
    const base = xForWeek(week);
    if (!overlapWeeks.has(week)) return base;
    return type === 'detected' ? base - 5 : base + 5;
  }

  const detectedPoints = $derived(buildLinePoints(lineWeeks, 'cumulativeDetected'));
  const resolvedPoints = $derived(buildLinePoints(lineWeeks, 'cumulativeResolved'));

  // =========================================================================
  // TOOLTIP STATE
  // =========================================================================

  let tooltipWeek = $state<DefectWeeklyEntry | null>(null);
  let tooltipX = $state(0);
  let tooltipY = $state(0);

  function handleDotHover(week: DefectWeeklyEntry, event: MouseEvent): void {
    tooltipWeek = week;
    tooltipX = event.clientX;
    tooltipY = event.clientY;
  }

  function handleDotLeave(): void {
    tooltipWeek = null;
  }

  // =========================================================================
  // NAVIGATION
  // =========================================================================

  function goBack(): void {
    if (plan !== null) {
      void goto(resolve(`/lean-management/tpm/board/${plan.uuid}/defects`));
    } else {
      void goto(resolve('/lean-management/tpm'));
    }
  }

  function changeYear(newYear: number): void {
    if (plan !== null) {
      void goto(resolve(`/lean-management/tpm/board/${plan.uuid}/defect-chart?year=${newYear}`));
    }
  }
</script>

<svelte:head>
  <title>
    {plan !== null ?
      `${plan.assetName ?? plan.name} — ${MESSAGES.CHART_PAGE_TITLE}`
    : MESSAGES.CHART_PAGE_TITLE} - Assixx
  </title>
</svelte:head>

{#if permissionDenied}
  <PermissionDenied addonName="das TPM-System" />
{:else}
  <div class="container">
    <!-- Back + Year Selector -->
    <div class="mb-4 flex items-center justify-between">
      <button
        type="button"
        class="btn btn-light"
        onclick={goBack}
      >
        <i class="fas fa-arrow-left mr-2"></i>{MESSAGES.CHART_BACK}
      </button>

      {#if chartData !== null && chartData.availableYears.length > 1}
        <div class="flex items-center gap-2">
          <label
            class="text-sm font-medium text-(--color-text-secondary)"
            for="year-select"
          >
            {MESSAGES.CHART_YEAR_LABEL}:
          </label>
          <select
            id="year-select"
            class="form-field__control year-select"
            value={currentYear}
            onchange={(e: Event) => {
              const target = e.target as HTMLSelectElement;
              changeYear(Number(target.value));
            }}
          >
            {#each chartData.availableYears as y (y)}
              <option value={y}>{y}</option>
            {/each}
          </select>
        </div>
      {/if}
    </div>

    {#if error !== null}
      <div class="card">
        <div class="card__body">
          <div class="empty-state">
            <div class="empty-state__icon">
              <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h3 class="empty-state__title">{MESSAGES.CHART_ERROR}</h3>
            <p class="empty-state__description">{error}</p>
            <button
              type="button"
              class="btn btn-primary mt-4"
              onclick={goBack}
            >
              <i class="fas fa-arrow-left mr-2"></i>{MESSAGES.CHART_BACK}
            </button>
          </div>
        </div>
      </div>
    {:else if chartData === null}
      <div class="card">
        <div class="card__body">
          <div class="empty-state">
            <div class="empty-state__icon">
              <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h3 class="empty-state__title">{MESSAGES.CHART_ERROR}</h3>
            <p class="empty-state__description">Daten konnten nicht geladen werden.</p>
          </div>
        </div>
      </div>
    {:else}
      <!-- Summary Stats -->
      <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div class="card-stat card-stat--danger">
          <div class="card-stat__icon">
            <i class="fas fa-exclamation-circle"></i>
          </div>
          <div class="card-stat__content">
            <div class="card-stat__value">{chartData.totalDetected}</div>
            <div class="card-stat__label">{MESSAGES.CHART_LEGEND_DETECTED}</div>
          </div>
        </div>
        <div class="card-stat card-stat--success">
          <div class="card-stat__icon">
            <i class="fas fa-check-circle"></i>
          </div>
          <div class="card-stat__content">
            <div class="card-stat__value">{chartData.totalResolved}</div>
            <div class="card-stat__label">{MESSAGES.CHART_LEGEND_RESOLVED}</div>
          </div>
        </div>
        <div
          class="card-stat"
          class:card-stat--warning={chartData.totalDetected - chartData.totalResolved > 0}
          class:card-stat--success={chartData.totalDetected - chartData.totalResolved === 0}
        >
          <div class="card-stat__icon">
            <i class="fas fa-clipboard-list"></i>
          </div>
          <div class="card-stat__content">
            <div class="card-stat__value">
              {chartData.totalDetected - chartData.totalResolved}
            </div>
            <div class="card-stat__label">Offen</div>
          </div>
        </div>
      </div>

      <!-- Chart Card -->
      <div class="card chart-card">
        <div class="card__header">
          <div>
            <h2 class="card__title">
              <i class="fas fa-chart-line mr-2"></i>
              {MESSAGES.CHART_HEADING}
              {currentYear}
            </h2>
            <p class="mt-1 text-(--color-text-secondary)">
              <span class="font-semibold">{chartData.assetName}</span>
              — {chartData.planName}
            </p>
          </div>
        </div>

        <div class="card__body p-0">
          {#if hasData}
            <!-- SVG Chart -->
            <svg
              viewBox="0 0 {CHART.width} {CHART.height}"
              class="chart-svg"
              xmlns="http://www.w3.org/2000/svg"
            >
              <!-- Background -->
              <rect
                x={CHART.padding.left}
                y={CHART.padding.top}
                width={plotWidth}
                height={plotHeight}
                fill="var(--chart-plot-bg)"
                stroke="var(--chart-plot-border)"
                stroke-width="1"
              />

              <!-- Grid: Horizontal lines -->
              {#each yTicks as tick (tick)}
                <line
                  x1={CHART.padding.left}
                  y1={yForValue(tick)}
                  x2={CHART.padding.left + plotWidth}
                  y2={yForValue(tick)}
                  stroke="var(--chart-grid)"
                  stroke-width="0.5"
                />
                <text
                  x={CHART.padding.left - 8}
                  y={yForValue(tick) + 4}
                  text-anchor="end"
                  class="chart-axis-label"
                >
                  {tick}
                </text>
              {/each}

              <!-- Grid: Vertical lines (every 2 weeks) -->
              {#each Array.from({ length: 26 }, (_, i) => i * 2 + 1) as week (week)}
                <line
                  x1={xForWeek(week)}
                  y1={CHART.padding.top}
                  x2={xForWeek(week)}
                  y2={CHART.padding.top + plotHeight}
                  stroke="var(--chart-grid)"
                  stroke-width="0.5"
                />
              {/each}

              <!-- X-axis labels (every 2 weeks) -->
              {#each Array.from({ length: 26 }, (_, i) => i * 2 + 1) as week (week)}
                <text
                  x={xForWeek(week)}
                  y={CHART.padding.top + plotHeight + 18}
                  text-anchor="middle"
                  class="chart-axis-label"
                >
                  {week}
                </text>
              {/each}

              <!-- Y-axis label -->
              <text
                x="16"
                y={CHART.padding.top + plotHeight / 2}
                text-anchor="middle"
                transform="rotate(-90, 16, {CHART.padding.top + plotHeight / 2})"
                class="chart-axis-title"
              >
                {MESSAGES.CHART_Y_AXIS}
              </text>

              <!-- X-axis label -->
              <text
                x={CHART.padding.left + plotWidth / 2}
                y={CHART.height - 8}
                text-anchor="middle"
                class="chart-axis-title"
              >
                {MESSAGES.CHART_X_AXIS}
              </text>

              <!-- Line: Mängel erkannt (rot) -->
              {#if detectedPoints.length > 0}
                <polyline
                  points={detectedPoints}
                  fill="none"
                  stroke="var(--chart-detected)"
                  stroke-width="2"
                  stroke-linejoin="round"
                />
              {/if}

              <!-- Line: Mängel behoben (grün) -->
              {#if resolvedPoints.length > 0}
                <polyline
                  points={resolvedPoints}
                  fill="none"
                  stroke="var(--chart-resolved)"
                  stroke-width="2"
                  stroke-linejoin="round"
                />
              {/if}

              <!-- Data points: Detected (rot) — only weeks with new defects -->
              {#each detectedDotWeeks as week (week.week)}
                <circle
                  cx={dotX(week.week, 'detected')}
                  cy={yForValue(week.cumulativeDetected)}
                  r="5"
                  fill="var(--chart-detected)"
                  stroke="var(--chart-dot-stroke)"
                  stroke-width="1.5"
                  class="chart-dot"
                  role="img"
                  aria-label="KW {week.week}: {week.cumulativeDetected} erkannt (+{week.detected})"
                  onmouseenter={(e: MouseEvent) => {
                    handleDotHover(week, e);
                  }}
                  onmouseleave={handleDotLeave}
                />
              {/each}

              <!-- Data points: Resolved (grün) — only weeks with resolved defects -->
              {#each resolvedDotWeeks as week (week.week)}
                <circle
                  cx={dotX(week.week, 'resolved')}
                  cy={yForValue(week.cumulativeResolved)}
                  r="5"
                  fill="var(--chart-resolved)"
                  stroke="var(--chart-dot-stroke)"
                  stroke-width="1.5"
                  class="chart-dot"
                  role="img"
                  aria-label="KW {week.week}: {week.cumulativeResolved} behoben (+{week.resolved})"
                  onmouseenter={(e: MouseEvent) => {
                    handleDotHover(week, e);
                  }}
                  onmouseleave={handleDotLeave}
                />
              {/each}

              <!-- Legend -->
              <g
                transform="translate({CHART.padding.left + plotWidth - 180}, {CHART.padding.top +
                  12})"
              >
                <rect
                  x="-8"
                  y="-10"
                  width="190"
                  height="48"
                  rx="4"
                  fill="var(--chart-legend-bg)"
                  stroke="var(--chart-legend-border)"
                  stroke-width="0.5"
                />
                <!-- Detected -->
                <line
                  x1="0"
                  y1="4"
                  x2="20"
                  y2="4"
                  stroke="var(--chart-detected)"
                  stroke-width="2"
                />
                <circle
                  cx="10"
                  cy="4"
                  r="3.5"
                  fill="var(--chart-detected)"
                />
                <text
                  x="28"
                  y="8"
                  class="chart-legend-label">{MESSAGES.CHART_LEGEND_DETECTED}</text
                >

                <!-- Resolved -->
                <line
                  x1="0"
                  y1="26"
                  x2="20"
                  y2="26"
                  stroke="var(--chart-resolved)"
                  stroke-width="2"
                />
                <circle
                  cx="10"
                  cy="26"
                  r="3.5"
                  fill="var(--chart-resolved)"
                />
                <text
                  x="28"
                  y="30"
                  class="chart-legend-label">{MESSAGES.CHART_LEGEND_RESOLVED}</text
                >
              </g>
            </svg>
          {:else}
            <div class="empty-state">
              <div class="empty-state__icon">
                <i class="fas fa-chart-line"></i>
              </div>
              <h3 class="empty-state__title">{MESSAGES.CHART_EMPTY_TITLE}</h3>
              <p class="empty-state__description">
                Für {currentYear} liegen noch keine Mängeldaten vor.
              </p>
            </div>
          {/if}
        </div>

        {#if hasData}
          <div class="card__footer">
            <span class="text-xs text-(--color-text-muted)">
              {MESSAGES.CHART_FOOTER}
            </span>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Tooltip -->
  {#if tooltipWeek !== null}
    <div
      class="chart-tooltip"
      style="left: {tooltipX + 12}px; top: {tooltipY - 10}px;"
    >
      <div class="chart-tooltip__title">KW {tooltipWeek.week}</div>
      <div class="chart-tooltip__row">
        <span class="chart-tooltip__dot chart-tooltip__dot--detected"></span>
        Erkannt: {tooltipWeek.cumulativeDetected}
        {#if tooltipWeek.detected > 0}
          <span class="chart-tooltip__delta">+{tooltipWeek.detected}</span>
        {/if}
      </div>
      <div class="chart-tooltip__row">
        <span class="chart-tooltip__dot chart-tooltip__dot--resolved"></span>
        Behoben: {tooltipWeek.cumulativeResolved}
        {#if tooltipWeek.resolved > 0}
          <span class="chart-tooltip__delta">+{tooltipWeek.resolved}</span>
        {/if}
      </div>
      <div class="chart-tooltip__row chart-tooltip__row--open">
        Offen: {tooltipWeek.cumulativeDetected - tooltipWeek.cumulativeResolved}
      </div>
    </div>
  {/if}
{/if}

<style>
  /* ================================================================
     CHART THEME TOKENS — Light mode defaults, dark mode overrides
     ================================================================ */
  .chart-card {
    /* Plot area */
    --chart-plot-bg: oklch(100% 0 0);
    --chart-plot-border: var(--color-border);
    --chart-grid: oklch(0% 0 0 / 12%);

    /* Lines + Dots */
    --chart-detected: oklch(59.26% 0.2266 17.58);
    --chart-resolved: oklch(62.8% 0.1803 157.59);
    --chart-dot-stroke: oklch(100% 0 0);

    /* Legend box */
    --chart-legend-bg: oklch(100% 0 0 / 85%);
    --chart-legend-border: var(--color-border);
  }

  :global(html.dark) .chart-card {
    --chart-plot-bg: oklch(14% 0.008 250);
    --chart-plot-border: oklch(100% 0 0 / 12%);
    --chart-grid: oklch(100% 0 0 / 8%);
    --chart-detected: oklch(65% 0.22 17);
    --chart-resolved: oklch(68% 0.17 157);
    --chart-dot-stroke: oklch(0% 0 0 / 60%);
    --chart-legend-bg: oklch(0% 0 0 / 70%);
    --chart-legend-border: oklch(100% 0 0 / 12%);
  }

  .chart-svg {
    width: 100%;
    height: auto;
    display: block;
  }

  .chart-axis-label {
    font-size: 10px;
    fill: var(--color-text-muted);
    font-family: var(--font-mono, monospace);
  }

  .chart-axis-title {
    font-size: 12px;
    font-weight: 600;
    fill: var(--color-text-secondary);
  }

  .chart-legend-label {
    font-size: 11px;
    fill: var(--color-text-primary);
  }

  .chart-dot {
    cursor: pointer;
    transform-box: fill-box;
    transform-origin: center;
    transition: transform 0.15s ease;
  }

  .chart-dot:hover {
    transform: scale(1.4);
  }

  .card__footer {
    padding: 0.5rem 1rem;
    border-top: 1px solid var(--color-glass-border);
  }

  .year-select {
    width: auto;
    min-width: 80px;
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
  }

  /* Tooltip */
  .chart-tooltip {
    position: fixed;
    z-index: 9999;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-md);
    background: color-mix(in oklch, var(--color-black, #000) 85%, transparent);
    color: oklch(100% 0 0);
    font-size: 0.75rem;
    line-height: 1.5;
    pointer-events: none;
    white-space: nowrap;
  }

  .chart-tooltip__title {
    font-weight: 700;
    margin-bottom: 0.25rem;
    font-size: 0.813rem;
  }

  .chart-tooltip__row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .chart-tooltip__row--open {
    margin-top: 0.25rem;
    padding-top: 0.25rem;
    border-top: 1px solid oklch(100% 0 0 / 20%);
    font-weight: 600;
  }

  .chart-tooltip__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .chart-tooltip__dot--detected {
    background: oklch(59.26% 0.2266 17.58);
  }

  .chart-tooltip__dot--resolved {
    background: oklch(62.8% 0.1803 157.59);
  }

  .chart-tooltip__delta {
    font-size: 0.688rem;
    opacity: 70%;
  }
</style>
