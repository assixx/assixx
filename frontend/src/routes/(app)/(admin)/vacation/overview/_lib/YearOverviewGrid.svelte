<script lang="ts">
  /**
   * YearOverviewGrid — 12-month year overview with per-employee vacation summary.
   * Rows = employees, columns = months (Jan–Dez) + total.
   * Click on a month column to drill into the monthly detail view.
   */
  import { MONTH_SHORT, TYPE_COLORS, TYPE_LABELS } from './constants';
  import { overviewState } from './state.svelte';

  import type { YearMonthCell } from './types';

  interface Props {
    onSelectMonth: (month: number) => void;
  }

  const { onSelectMonth }: Props = $props();

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  /** Build tooltip text for a month cell */
  function cellTooltip(cell: YearMonthCell): string {
    return cell.entries
      .map((e) => `${e.days}T ${TYPE_LABELS[e.vacationType] ?? e.vacationType}`)
      .join(', ');
  }

  /** Get the dominant (most days) color for the day count overlay */
  function dominantColor(cell: YearMonthCell): string {
    if (cell.entries.length === 0) return 'var(--color-primary)';
    const sorted = [...cell.entries].sort((a, b) => b.days - a.days);
    return TYPE_COLORS[sorted[0].vacationType] ?? 'var(--color-primary)';
  }
</script>

<div class="card">
  <div class="card__header">
    <div class="flex items-center justify-between">
      <h3 class="card__title">
        <i class="fas fa-calendar mr-2"></i>
        Jahresübersicht {overviewState.selectedYear}
        {#if overviewState.selectedTeamName !== ''}
          <span class="text-muted ml-2">
            — {overviewState.selectedTeamName}
          </span>
        {/if}
      </h3>
    </div>
  </div>
  <div class="card__body">
    {#if overviewState.isLoadingYearCalendar}
      <div
        class="text-center"
        style="padding: var(--spacing-8);"
      >
        <div class="spinner-ring spinner-ring--sm"></div>
        <p class="text-muted mt-3">Jahresübersicht wird geladen...</p>
      </div>
    {:else if overviewState.yearGrid.length === 0}
      <div class="empty-state empty-state--in-card">
        <div class="empty-state__icon">
          <i class="fas fa-calendar-check"></i>
        </div>
        <h3 class="empty-state__title">Keine Abwesenheiten</h3>
        <p class="empty-state__description">
          In diesem Jahr sind keine genehmigten Urlaubsanträge vorhanden.
        </p>
      </div>
    {:else}
      <div class="calendar-scroll">
        <table class="year-grid">
          <thead>
            <tr>
              <th class="year-grid__name-header">Mitarbeiter</th>
              {#each months as m (m)}
                {@const hasBlackout = overviewState.yearBlackoutMonths.has(m)}
                <th
                  class="year-grid__month-header"
                  class:blackout={hasBlackout}
                  title={hasBlackout ?
                    `Urlaubssperre: ${overviewState.yearBlackoutMonths.get(m) ?? ''}`
                  : `${MONTH_SHORT[m]} — Klick für Monatsdetail`}
                  onclick={() => {
                    onSelectMonth(m);
                  }}
                  onkeydown={(e) => {
                    if (e.key === 'Enter') onSelectMonth(m);
                  }}
                  role="button"
                  tabindex="0"
                >
                  <span class="year-grid__month-label">{MONTH_SHORT[m]}</span>
                  {#if hasBlackout}
                    <span class="year-grid__blackout-dot"></span>
                  {/if}
                </th>
              {/each}
              <th class="year-grid__total-header">Ges.</th>
            </tr>
          </thead>
          <tbody>
            {#each overviewState.yearGrid as row (row.userId)}
              <tr>
                <td class="year-grid__name-cell">{row.userName}</td>
                {#each months as m (m)}
                  {@const cell = row.months.get(m)}
                  <td
                    class="year-grid__cell"
                    class:blackout={overviewState.yearBlackoutMonths.has(m)}
                    onclick={() => {
                      onSelectMonth(m);
                    }}
                    onkeydown={(e) => {
                      if (e.key === 'Enter') onSelectMonth(m);
                    }}
                    role="button"
                    tabindex="0"
                    title={cell !== undefined ? cellTooltip(cell) : ''}
                  >
                    {#if cell !== undefined}
                      <div class="year-cell">
                        <div class="year-cell__bar">
                          {#each cell.entries as entry (entry.vacationType)}
                            <span
                              class="year-cell__segment"
                              style="flex: {entry.days}; background: {TYPE_COLORS[
                                entry.vacationType
                              ] ?? 'var(--color-primary)'};"
                            ></span>
                          {/each}
                        </div>
                        <span
                          class="year-cell__count"
                          style="text-shadow: 0 1px 3px {dominantColor(cell)};"
                        >
                          {cell.totalDays}
                        </span>
                      </div>
                    {/if}
                  </td>
                {/each}
                <td class="year-grid__total-cell">
                  {#if row.totalDays > 0}
                    <span class="year-total">{row.totalDays}</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Legend (reuses same tokens as CalendarGrid) -->
      <div class="calendar-legend">
        {#each Object.entries(TYPE_LABELS) as [key, label] (key)}
          <div class="calendar-legend__item">
            <span
              class="calendar-legend__dot"
              style="background: {TYPE_COLORS[key]};"
            ></span>
            <span class="calendar-legend__label">{label}</span>
          </div>
        {/each}
        {#if overviewState.yearBlackoutMonths.size > 0}
          <div class="calendar-legend__item">
            <span class="calendar-legend__dot calendar-legend__dot--blackout"></span>
            <span class="calendar-legend__label">Urlaubssperre</span>
          </div>
        {/if}
      </div>

      <p class="year-grid__hint">
        <i class="fas fa-mouse-pointer"></i>
        Klicken Sie auf einen Monat für die Detailansicht
      </p>
    {/if}
  </div>
</div>

<style>
  /* ─── Year Grid Table ──────── */

  .calendar-scroll {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .year-grid {
    width: 100%;
    border-collapse: separate;
    border-spacing: 1px;
    font-size: 0.8rem;
  }

  .year-grid__name-header {
    position: sticky;
    left: 0;
    z-index: 2;
    background: var(--color-surface);
    text-align: left;
    padding: var(--spacing-2) var(--spacing-3);
    font-weight: 600;
    white-space: nowrap;
    min-width: 160px;
    border-bottom: 2px solid var(--color-glass-border);
  }

  .year-grid__month-header {
    text-align: center;
    padding: var(--spacing-2) var(--spacing-1);
    font-weight: 600;
    min-width: 56px;
    border-bottom: 2px solid var(--color-glass-border);
    cursor: pointer;
    transition: background var(--transition-fast);
    user-select: none;
  }

  .year-grid__month-header:hover {
    background: var(--glass-bg-active);
  }

  .year-grid__month-label {
    display: block;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .year-grid__total-header {
    text-align: center;
    padding: var(--spacing-2) var(--spacing-1);
    font-weight: 700;
    min-width: 48px;
    border-bottom: 2px solid var(--color-glass-border);
    border-left: 2px solid var(--color-glass-border);
  }

  .year-grid__name-cell {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--color-surface);
    padding: var(--spacing-2) var(--spacing-3);
    font-weight: 500;
    white-space: nowrap;
    border-bottom: 1px solid var(--color-glass-border);
  }

  .year-grid__cell {
    padding: 3px;
    height: 36px;
    min-width: 56px;
    border-bottom: 1px solid var(--color-glass-border);
    vertical-align: middle;
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .year-grid__cell:hover {
    background: var(--glass-bg-active);
  }

  .year-grid__total-cell {
    text-align: center;
    padding: var(--spacing-2) var(--spacing-1);
    font-weight: 600;
    border-bottom: 1px solid var(--color-glass-border);
    border-left: 2px solid var(--color-glass-border);
  }

  /* ─── Year Cell (vacation summary bar) ──────── */

  .year-cell {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .year-cell__bar {
    position: absolute;
    inset: 0;
    display: flex;
    gap: 1px;
    border-radius: 4px;
    overflow: hidden;
    opacity: 80%;
    transition: opacity var(--transition-fast);
  }

  .year-grid__cell:hover .year-cell__bar {
    opacity: 100%;
  }

  .year-cell__segment {
    height: 100%;
    min-width: 4px;
  }

  .year-cell__count {
    position: relative;
    z-index: 1;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-white);
    text-shadow: 0 1px 3px color-mix(in oklch, var(--color-black) 50%, transparent);
  }

  .year-total {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 28px;
    border-radius: 6px;
    background: var(--glass-bg-active);
    font-weight: 700;
    font-size: 0.8rem;
    color: var(--text-primary);
  }

  /* ─── Blackout Marking ──────── */

  .year-grid__month-header.blackout {
    background: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 3px,
      color-mix(in oklch, var(--color-coral) 12%, transparent) 3px,
      color-mix(in oklch, var(--color-coral) 12%, transparent) 6px
    );
    color: var(--color-danger-600);
  }

  .year-grid__blackout-dot {
    display: block;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--color-danger-500);
    margin: 2px auto 0;
  }

  .year-grid__cell.blackout {
    background: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 3px,
      color-mix(in oklch, var(--color-coral) 6%, transparent) 3px,
      color-mix(in oklch, var(--color-coral) 6%, transparent) 6px
    );
  }

  /* ─── Legend (shared with CalendarGrid) ──────── */

  .calendar-legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-3);
    margin-top: var(--spacing-4);
    padding-top: var(--spacing-4);
    border-top: 1px solid var(--color-glass-border);
  }

  .calendar-legend__item {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
  }

  .calendar-legend__dot {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .calendar-legend__dot--blackout {
    background: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 2px,
      color-mix(in oklch, var(--color-coral) 25%, transparent) 2px,
      color-mix(in oklch, var(--color-coral) 25%, transparent) 4px
    );
    border: 1px solid var(--color-danger-400);
  }

  .calendar-legend__label {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  /* ─── Hint ──────── */

  .year-grid__hint {
    margin-top: var(--spacing-3);
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: center;
  }
</style>
