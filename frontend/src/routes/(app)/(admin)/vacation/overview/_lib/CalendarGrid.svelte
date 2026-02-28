<script lang="ts">
  /**
   * CalendarGrid — Team vacation calendar with blackout markers
   * Reads all data from overviewState (no props needed).
   */
  import {
    HALF_DAY_LABELS,
    TYPE_COLORS,
    TYPE_LABELS,
    WEEKDAY_SHORT,
  } from './constants';
  import { overviewState } from './state.svelte';

  import type { CalendarDayCell } from './types';

  const dayNumbers = $derived(
    overviewState.daysInMonth > 0 ?
      Array.from({ length: overviewState.daysInMonth }, (_, i) => i + 1)
    : [],
  );

  function getWeekday(day: number): number {
    if (
      overviewState.selectedYear === null ||
      overviewState.selectedMonth === null
    )
      return 0;
    return new Date(
      overviewState.selectedYear,
      overviewState.selectedMonth - 1,
      day,
    ).getDay();
  }

  function isWeekend(day: number): boolean {
    const wd = getWeekday(day);
    return wd === 0 || wd === 6;
  }

  function cellColor(cell: CalendarDayCell): string {
    return TYPE_COLORS[cell.vacationType] ?? 'var(--color-primary-500)';
  }

  function cellTooltip(cell: CalendarDayCell): string {
    const typeLabel = TYPE_LABELS[cell.vacationType] ?? cell.vacationType;
    if (cell.halfDay !== 'none') {
      const halfLabel = HALF_DAY_LABELS[cell.halfDay] ?? '';
      return `${typeLabel} (${halfLabel})`;
    }
    return typeLabel;
  }
</script>

<div class="card">
  <div class="card__header">
    <div class="flex items-center justify-between">
      <h3 class="card__title">
        <i class="fas fa-th mr-2"></i>
        Teamkalender
        {#if overviewState.selectedTeamName !== ''}
          <span class="text-muted ml-2">
            — {overviewState.selectedTeamName}
          </span>
        {/if}
      </h3>
    </div>
  </div>
  <div class="card__body">
    {#if overviewState.selectedMonth === null}
      <div class="empty-state empty-state--in-card">
        <div class="empty-state__icon">
          <i class="fas fa-filter"></i>
        </div>
        <h3 class="empty-state__title">Filter auswählen</h3>
        <p class="empty-state__description">
          Wählen Sie oben Team, Jahr und Monat aus, um den Urlaubskalender
          anzuzeigen.
        </p>
      </div>
    {:else if overviewState.isLoadingCalendar}
      <div
        class="text-center"
        style="padding: var(--spacing-8);"
      >
        <div class="spinner-ring spinner-ring--sm"></div>
        <p class="text-muted mt-3">Kalender wird geladen...</p>
      </div>
    {:else if overviewState.calendarGrid.length === 0}
      <div class="empty-state empty-state--in-card">
        <div class="empty-state__icon">
          <i class="fas fa-calendar-check"></i>
        </div>
        <h3 class="empty-state__title">Keine Abwesenheiten</h3>
        <p class="empty-state__description">
          In diesem Monat sind keine genehmigten Urlaubsanträge vorhanden.
        </p>
      </div>
    {:else}
      <div class="calendar-scroll">
        <table class="calendar-grid">
          <thead>
            <tr>
              <th class="calendar-grid__name-header">Mitarbeiter</th>
              {#each dayNumbers as day (day)}
                {@const blackoutName = overviewState.blackoutDays.get(day)}
                <th
                  class="calendar-grid__day-header"
                  class:weekend={isWeekend(day)}
                  class:blackout={blackoutName !== undefined}
                  title={blackoutName ?? ''}
                >
                  <span class="calendar-grid__weekday">
                    {WEEKDAY_SHORT[getWeekday(day)]}
                  </span>
                  <span class="calendar-grid__day-num">{day}</span>
                  {#if blackoutName !== undefined}
                    <span class="calendar-grid__blackout-dot"></span>
                  {/if}
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each overviewState.calendarGrid as row (row.userId)}
              <tr>
                <td class="calendar-grid__name-cell">{row.userName}</td>
                {#each dayNumbers as day (day)}
                  {@const cell = row.days.get(day)}
                  {@const blackoutName = overviewState.blackoutDays.get(day)}
                  <td
                    class="calendar-grid__cell"
                    class:weekend={isWeekend(day)}
                    class:blackout={blackoutName !== undefined}
                    title={cell === undefined && blackoutName !== undefined ?
                      `Sperre: ${blackoutName}`
                    : ''}
                  >
                    {#if cell !== undefined}
                      <div
                        class="calendar-cell"
                        class:calendar-cell--half={cell.halfDay !== 'none'}
                        style="background: {cellColor(cell)};"
                        title={cellTooltip(cell)}
                      >
                        {#if cell.halfDay !== 'none'}
                          <span class="calendar-cell__half-indicator">½</span>
                        {/if}
                      </div>
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Legend -->
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
        <div class="calendar-legend__item">
          <span class="calendar-legend__dot calendar-legend__dot--half"></span>
          <span class="calendar-legend__label">Halber Tag</span>
        </div>
        {#if overviewState.blackoutDays.size > 0}
          <div class="calendar-legend__item">
            <span class="calendar-legend__dot calendar-legend__dot--blackout"
            ></span>
            <span class="calendar-legend__label">Urlaubssperre</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  /* ─── Calendar Grid ──────── */

  .calendar-scroll {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .calendar-grid {
    width: 100%;
    border-collapse: separate;
    border-spacing: 1px;
    font-size: 0.75rem;
    min-width: 800px;
  }

  .calendar-grid__name-header {
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

  .calendar-grid__day-header {
    text-align: center;
    padding: var(--spacing-1);
    font-weight: 500;
    min-width: 32px;
    border-bottom: 2px solid var(--color-glass-border);
  }

  .calendar-grid__day-header.weekend {
    background: var(--glass-bg-active);
    color: var(--text-muted);
  }

  .calendar-grid__weekday {
    display: block;
    font-size: 0.625rem;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .calendar-grid__day-num {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .calendar-grid__name-cell {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--color-surface);
    padding: var(--spacing-2) var(--spacing-3);
    font-weight: 500;
    white-space: nowrap;
    border-bottom: 1px solid var(--color-glass-border);
  }

  .calendar-grid__cell {
    padding: 2px;
    height: 32px;
    min-width: 32px;
    border-bottom: 1px solid var(--color-glass-border);
    vertical-align: middle;
  }

  .calendar-grid__cell.weekend {
    background: var(--glass-bg);
  }

  /* ─── Calendar Cell (vacation indicator) ──────── */

  .calendar-cell {
    width: 100%;
    height: 100%;
    min-height: 24px;
    border-radius: 3px;
    opacity: 85%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity var(--transition-fast);
  }

  .calendar-cell:hover {
    opacity: 100%;
  }

  .calendar-cell--half {
    opacity: 60%;
  }

  .calendar-cell--half:hover {
    opacity: 85%;
  }

  .calendar-cell__half-indicator {
    font-size: 0.625rem;
    font-weight: 700;
    color: #fff;
    text-shadow: 0 1px 2px rgb(0 0 0 / 30%);
  }

  /* ─── Calendar Legend ──────── */

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

  .calendar-legend__dot--half {
    background: var(--color-primary-500);
    opacity: 50%;
    position: relative;
  }

  .calendar-legend__dot--half::after {
    content: '½';
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.5rem;
    font-weight: 700;
    color: #fff;
  }

  .calendar-legend__label {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  /* ─── Blackout Day Marking ──────── */

  .calendar-grid__day-header.blackout {
    background: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 3px,
      rgb(239 68 68 / 12%) 3px,
      rgb(239 68 68 / 12%) 6px
    );
    color: var(--color-danger-600);
    position: relative;
  }

  .calendar-grid__blackout-dot {
    display: block;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--color-danger-500);
    margin: 1px auto 0;
  }

  .calendar-grid__cell.blackout {
    background: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 3px,
      rgb(239 68 68 / 8%) 3px,
      rgb(239 68 68 / 8%) 6px
    );
  }

  .calendar-grid__cell.blackout.weekend {
    background: repeating-linear-gradient(
      -45deg,
      var(--glass-bg),
      var(--glass-bg) 3px,
      rgb(239 68 68 / 10%) 3px,
      rgb(239 68 68 / 10%) 6px
    );
  }

  .calendar-legend__dot--blackout {
    background: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 2px,
      rgb(239 68 68 / 25%) 2px,
      rgb(239 68 68 / 25%) 4px
    );
    border: 1px solid var(--color-danger-400);
  }
</style>
