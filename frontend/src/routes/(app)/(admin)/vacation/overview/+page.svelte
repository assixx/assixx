<script lang="ts">
  /**
   * Vacation Overview — Admin Page
   * Team calendar showing approved vacations per team member per day.
   * SSR: Teams list loaded in +page.server.ts.
   * Client-side: Calendar fetched on team/month selection.
   */
  import { onDestroy } from 'svelte';

  import { onClickOutsideDropdown } from '$lib/actions/click-outside';
  import { showErrorAlert } from '$lib/utils';
  import { createLogger } from '$lib/utils/logger';

  import * as api from './_lib/api';
  import {
    HALF_DAY_LABELS,
    MONTH_NAMES,
    TYPE_COLORS,
    TYPE_LABELS,
    WEEKDAY_SHORT,
  } from './_lib/constants';
  import { overviewState } from './_lib/state.svelte';

  import type { PageData } from './$types';
  import type { CalendarDayCell, TeamListItem } from './_lib/types';

  const log = createLogger('VacationOverview');

  // ==========================================================================
  // SSR DATA
  // ==========================================================================

  const { data }: { data: PageData } = $props();

  const ssrTeams = $derived(data.teams);
  const ssrCurrentYear = $derived(data.currentYear);
  const ssrCurrentMonth = $derived(data.currentMonth);

  $effect(() => {
    overviewState.setTeams(ssrTeams);
    overviewState.setYear(ssrCurrentYear);
    overviewState.setMonth(ssrCurrentMonth);
    overviewState.setLoading(false);
  });

  onDestroy(() => {
    overviewState.reset();
  });

  // ==========================================================================
  // CALENDAR LOADING
  // ==========================================================================

  async function loadCalendar(): Promise<void> {
    if (overviewState.selectedTeamId === null) return;

    overviewState.setLoadingCalendar(true);
    try {
      const data = await api.getTeamCalendar(
        overviewState.selectedTeamId,
        overviewState.selectedMonth,
        overviewState.selectedYear,
      );
      overviewState.setCalendarData(data);
    } catch (err) {
      log.error({ err }, 'Calendar load failed');
      showErrorAlert('Fehler beim Laden des Teamkalenders');
      overviewState.setCalendarData(null);
    } finally {
      overviewState.setLoadingCalendar(false);
    }
  }

  // ==========================================================================
  // TEAM SELECT
  // ==========================================================================

  let teamDropdownOpen = $state(false);
  const teamDisplayText = $derived(
    overviewState.selectedTeamId !== null ?
      overviewState.selectedTeamName
    : 'Team wählen...',
  );

  function handleTeamSelect(team: TeamListItem): void {
    teamDropdownOpen = false;
    overviewState.selectTeam(team.id);
    void loadCalendar();
  }

  // ==========================================================================
  // MONTH / YEAR NAVIGATION
  // ==========================================================================

  let monthDropdownOpen = $state(false);
  const monthDisplayText = $derived(
    MONTH_NAMES[overviewState.selectedMonth] ?? '',
  );

  function handleMonthSelect(month: number): void {
    monthDropdownOpen = false;
    overviewState.setMonth(month);
    if (overviewState.selectedTeamId !== null) {
      void loadCalendar();
    }
  }

  function handlePrevMonth(): void {
    overviewState.navigateMonth(-1);
    if (overviewState.selectedTeamId !== null) {
      void loadCalendar();
    }
  }

  function handleNextMonth(): void {
    overviewState.navigateMonth(1);
    if (overviewState.selectedTeamId !== null) {
      void loadCalendar();
    }
  }

  let yearDropdownOpen = $state(false);
  const yearDisplayText = $derived(String(overviewState.selectedYear));

  function yearOptions(): number[] {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }

  function handleYearSelect(year: number): void {
    yearDropdownOpen = false;
    overviewState.setYear(year);
    if (overviewState.selectedTeamId !== null) {
      void loadCalendar();
    }
  }

  // Close all dropdowns on outside click
  $effect(() => {
    return onClickOutsideDropdown(() => {
      teamDropdownOpen = false;
      monthDropdownOpen = false;
      yearDropdownOpen = false;
    });
  });

  // ==========================================================================
  // CALENDAR GRID HELPERS
  // ==========================================================================

  /** Day numbers array (1-based) */
  const dayNumbers = $derived(
    Array.from({ length: overviewState.daysInMonth }, (_, i) => i + 1),
  );

  /** Get weekday index (0=Sun) for a given day */
  function getWeekday(day: number): number {
    return new Date(
      overviewState.selectedYear,
      overviewState.selectedMonth - 1,
      day,
    ).getDay();
  }

  /** Whether a day is weekend (Sa/So) */
  function isWeekend(day: number): boolean {
    const wd = getWeekday(day);
    return wd === 0 || wd === 6;
  }

  /** Get cell background color for a vacation cell */
  function cellColor(cell: CalendarDayCell): string {
    return TYPE_COLORS[cell.vacationType] ?? 'var(--color-primary-500)';
  }

  /** Build tooltip for a vacation cell */
  function cellTooltip(cell: CalendarDayCell): string {
    const typeLabel = TYPE_LABELS[cell.vacationType] ?? cell.vacationType;
    if (cell.halfDay !== 'none') {
      const halfLabel = HALF_DAY_LABELS[cell.halfDay] ?? '';
      return `${typeLabel} (${halfLabel})`;
    }
    return typeLabel;
  }
</script>

<svelte:head>
  <title>Urlaubsübersicht - Assixx</title>
</svelte:head>

<div class="container">
  <!-- ================================================================
       HEADER
       ================================================================ -->
  <div class="card mb-6">
    <div class="card__header">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="card__title">
          <i class="fas fa-calendar-alt mr-2"></i>
          Urlaubsübersicht
        </h2>
        <div class="flex flex-wrap items-center gap-3">
          <!-- Team Selector -->
          <div
            class="dropdown"
            data-dropdown="ov-team"
          >
            <button
              type="button"
              class="dropdown__trigger"
              class:active={teamDropdownOpen}
              onclick={() => {
                teamDropdownOpen = !teamDropdownOpen;
              }}
            >
              <i class="fas fa-users mr-1"></i>
              <span>{teamDisplayText}</span>
              <i class="fas fa-chevron-down"></i>
            </button>
            <div
              class="dropdown__menu"
              class:active={teamDropdownOpen}
            >
              {#each overviewState.teams as team (team.id)}
                <button
                  type="button"
                  class="dropdown__option"
                  class:selected={overviewState.selectedTeamId === team.id}
                  onclick={() => {
                    handleTeamSelect(team);
                  }}
                >
                  {team.name}
                </button>
              {/each}
              {#if overviewState.teams.length === 0}
                <div class="dropdown__option dropdown__option--disabled">
                  Keine Teams vorhanden
                </div>
              {/if}
            </div>
          </div>

          <!-- Month Navigation -->
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="btn btn-secondary btn-sm btn-icon"
              onclick={handlePrevMonth}
              aria-label="Vorheriger Monat"
            >
              <i class="fas fa-chevron-left"></i>
            </button>
            <div
              class="dropdown"
              data-dropdown="ov-month"
            >
              <button
                type="button"
                class="dropdown__trigger"
                class:active={monthDropdownOpen}
                onclick={() => {
                  monthDropdownOpen = !monthDropdownOpen;
                }}
              >
                <span>{monthDisplayText}</span>
                <i class="fas fa-chevron-down"></i>
              </button>
              <div
                class="dropdown__menu"
                class:active={monthDropdownOpen}
              >
                {#each Array.from({ length: 12 }, (_, i) => i + 1) as m (m)}
                  <button
                    type="button"
                    class="dropdown__option"
                    class:selected={overviewState.selectedMonth === m}
                    onclick={() => {
                      handleMonthSelect(m);
                    }}
                  >
                    {MONTH_NAMES[m]}
                  </button>
                {/each}
              </div>
            </div>
            <button
              type="button"
              class="btn btn-secondary btn-sm btn-icon"
              onclick={handleNextMonth}
              aria-label="Nächster Monat"
            >
              <i class="fas fa-chevron-right"></i>
            </button>
          </div>

          <!-- Year Selector -->
          <div
            class="dropdown"
            data-dropdown="ov-year"
          >
            <button
              type="button"
              class="dropdown__trigger"
              class:active={yearDropdownOpen}
              onclick={() => {
                yearDropdownOpen = !yearDropdownOpen;
              }}
            >
              <span>{yearDisplayText}</span>
              <i class="fas fa-chevron-down"></i>
            </button>
            <div
              class="dropdown__menu"
              class:active={yearDropdownOpen}
            >
              {#each yearOptions() as year (year)}
                <button
                  type="button"
                  class="dropdown__option"
                  class:selected={overviewState.selectedYear === year}
                  onclick={() => {
                    handleYearSelect(year);
                  }}
                >
                  {year}
                </button>
              {/each}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ================================================================
       TEAM CALENDAR
       ================================================================ -->
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
      {#if overviewState.selectedTeamId === null}
        <div class="empty-state empty-state--in-card">
          <div class="empty-state__icon">
            <i class="fas fa-users"></i>
          </div>
          <h3 class="empty-state__title">Team auswählen</h3>
          <p class="empty-state__description">
            Wählen Sie oben ein Team aus, um den Urlaubskalender anzuzeigen.
          </p>
        </div>
      {:else if overviewState.isLoadingCalendar}
        <div
          class="text-center"
          style="padding: var(--spacing-8);"
        >
          <i class="fas fa-spinner fa-spin fa-2x text-muted"></i>
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
                  <th
                    class="calendar-grid__day-header"
                    class:weekend={isWeekend(day)}
                  >
                    <span class="calendar-grid__weekday">
                      {WEEKDAY_SHORT[getWeekday(day)]}
                    </span>
                    <span class="calendar-grid__day-num">{day}</span>
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
                    <td
                      class="calendar-grid__cell"
                      class:weekend={isWeekend(day)}
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
            <span class="calendar-legend__dot calendar-legend__dot--half"
            ></span>
            <span class="calendar-legend__label">Halber Tag</span>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  /* ─── Calendar Grid ────────────────────────────────────────────── */

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
    padding: var(--spacing-1) var(--spacing-1);
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

  /* ─── Calendar Cell (vacation indicator) ───────────────────────── */

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

  /* ─── Legend ────────────────────────────────────────────────────── */

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

  /* ─── Button icon variant ──────────────────────────────────────── */

  :global(.btn-icon) {
    padding: var(--spacing-1) var(--spacing-2) !important;
    min-width: auto;
  }
</style>
