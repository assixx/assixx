<script lang="ts">
  /**
   * Vacation Overview — Admin Page
   * Cascade: Machine → Team → Year → Month → Calendar
   * SSR: Machines, blackouts, staffing rules loaded in +page.server.ts.
   * Client-side: Teams fetched on machine selection, calendar on month selection.
   */
  import { onDestroy } from 'svelte';

  import '../../../../../styles/vacation.css';
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
  import type {
    CalendarDayCell,
    MachineListItem,
    TeamListItem,
  } from './_lib/types';

  const log = createLogger('VacationOverview');

  // ==========================================================================
  // SSR DATA
  // ==========================================================================

  const { data }: { data: PageData } = $props();

  const ssrMachines = $derived(data.machines);
  const ssrBlackouts = $derived(data.blackouts);
  const ssrStaffingRules = $derived(data.staffingRules);

  $effect(() => {
    overviewState.setMachines(ssrMachines);
    overviewState.setBlackouts(ssrBlackouts);
    overviewState.setStaffingRules(ssrStaffingRules);
    overviewState.setLoading(false);
  });

  onDestroy(() => {
    overviewState.reset();
  });

  // ==========================================================================
  // CASCADE HANDLERS
  // ==========================================================================

  /** Machine selected → load teams for that machine */
  async function handleMachineSelect(machine: MachineListItem): Promise<void> {
    machineDropdownOpen = false;
    overviewState.selectMachine(machine.id);

    overviewState.setLoadingTeams(true);
    try {
      const teams = await api.getTeamsForMachine(machine.id);
      overviewState.setTeams(teams);
    } catch (err) {
      log.error({ err }, 'Teams load failed');
      showErrorAlert('Fehler beim Laden der Teams');
      overviewState.setTeams([]);
    } finally {
      overviewState.setLoadingTeams(false);
    }
  }

  /** Team selected */
  function handleTeamSelect(team: TeamListItem): void {
    teamDropdownOpen = false;
    overviewState.selectTeam(team.id);
  }

  /** Year selected */
  function handleYearSelect(year: number): void {
    yearDropdownOpen = false;
    overviewState.setYear(year);
  }

  /** Month selected → load calendar */
  async function handleMonthSelect(month: number): Promise<void> {
    monthDropdownOpen = false;
    overviewState.setMonth(month);
    await loadCalendar();
  }

  /** Load calendar data for selected team/month/year */
  async function loadCalendar(): Promise<void> {
    if (
      overviewState.selectedTeamId === null ||
      overviewState.selectedMonth === null ||
      overviewState.selectedYear === null
    )
      return;

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
  // DROPDOWN STATE
  // ==========================================================================

  let machineDropdownOpen = $state(false);
  let teamDropdownOpen = $state(false);
  let yearDropdownOpen = $state(false);
  let monthDropdownOpen = $state(false);

  const machineDisplayText = $derived(
    overviewState.selectedMachineId !== null ?
      overviewState.selectedMachineName
    : 'Maschine wählen...',
  );

  const teamDisplayText = $derived(
    overviewState.isLoadingTeams ? 'Laden...'
    : overviewState.selectedTeamId !== null ? overviewState.selectedTeamName
    : 'Erst Maschine wählen...',
  );

  const yearDisplayText = $derived(
    overviewState.selectedYear !== null ?
      String(overviewState.selectedYear)
    : 'Erst Team wählen...',
  );

  const monthDisplayText = $derived(
    overviewState.selectedMonth !== null ?
      (MONTH_NAMES[overviewState.selectedMonth] ?? '')
    : 'Erst Jahr wählen...',
  );

  function yearOptions(): number[] {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }

  // Close all dropdowns on outside click
  $effect(() => {
    return onClickOutsideDropdown(() => {
      machineDropdownOpen = false;
      teamDropdownOpen = false;
      yearDropdownOpen = false;
      monthDropdownOpen = false;
    });
  });

  // ==========================================================================
  // CALENDAR GRID HELPERS
  // ==========================================================================

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

  /** Staffing rule for selected machine */
  const machineStaffingRule = $derived.by(() => {
    if (overviewState.selectedMachineId === null) return null;
    return (
      overviewState.staffingRules.find(
        (r) => r.machineId === overviewState.selectedMachineId,
      ) ?? null
    );
  });
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
      <div class="flex items-center justify-between">
        <h2 class="card__title">
          <i class="fas fa-calendar-alt mr-2"></i>
          Urlaubsübersicht
        </h2>
        {#if machineStaffingRule !== null}
          <span
            class="badge badge--warning badge"
            title="Mindestbesetzung: {machineStaffingRule.machineName}"
          >
            <i class="fas fa-hard-hat"></i>
            Mindestbesetzung: {machineStaffingRule.minStaffCount}
          </span>
        {/if}
      </div>
    </div>
  </div>

  <!-- ================================================================
       CASCADE FILTER ROW (like shifts page)
       ================================================================ -->
  <div class="card vacation-filter-row">
    <!-- 1. Maschine -->
    <div class="info-item">
      <div class="info-label">Maschine</div>
      <div
        class="dropdown"
        data-dropdown="ov-machine"
      >
        <button
          type="button"
          class="dropdown__trigger"
          class:active={machineDropdownOpen}
          onclick={() => {
            machineDropdownOpen = !machineDropdownOpen;
          }}
        >
          <span>{machineDisplayText}</span>
          <i class="fas fa-chevron-down"></i>
        </button>
        <div
          class="dropdown__menu"
          class:active={machineDropdownOpen}
        >
          {#each overviewState.machines as machine (machine.id)}
            <button
              type="button"
              class="dropdown__option"
              class:selected={overviewState.selectedMachineId === machine.id}
              onclick={() => {
                void handleMachineSelect(machine);
              }}
            >
              {machine.name}
            </button>
          {/each}
          {#if overviewState.machines.length === 0}
            <div class="dropdown__option dropdown__option--disabled">
              Keine Maschinen vorhanden
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- 2. Team (enabled after machine) -->
    <div class="info-item">
      <div class="info-label">Team</div>
      <div
        class="dropdown"
        class:dropdown--disabled={!overviewState.canSelectTeam}
        data-dropdown="ov-team"
      >
        <button
          type="button"
          class="dropdown__trigger"
          class:active={teamDropdownOpen}
          disabled={!overviewState.canSelectTeam}
          style={!overviewState.canSelectTeam ?
            'pointer-events: none; opacity: 0.5;'
          : ''}
          onclick={() => {
            if (overviewState.canSelectTeam) {
              teamDropdownOpen = !teamDropdownOpen;
            }
          }}
        >
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
          {#if overviewState.canSelectTeam && overviewState.teams.length === 0 && !overviewState.isLoadingTeams}
            <div class="dropdown__option dropdown__option--disabled">
              Keine Teams zugewiesen
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- 3. Jahr (enabled after team) -->
    <div class="info-item">
      <div class="info-label">Jahr</div>
      <div
        class="dropdown"
        class:dropdown--disabled={!overviewState.canSelectYear}
        data-dropdown="ov-year"
      >
        <button
          type="button"
          class="dropdown__trigger"
          class:active={yearDropdownOpen}
          disabled={!overviewState.canSelectYear}
          style={!overviewState.canSelectYear ?
            'pointer-events: none; opacity: 0.5;'
          : ''}
          onclick={() => {
            if (overviewState.canSelectYear) {
              yearDropdownOpen = !yearDropdownOpen;
            }
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

    <!-- 4. Monat (enabled after year) -->
    <div class="info-item">
      <div class="info-label">Monat</div>
      <div
        class="dropdown"
        class:dropdown--disabled={!overviewState.canSelectMonth}
        data-dropdown="ov-month"
      >
        <button
          type="button"
          class="dropdown__trigger"
          class:active={monthDropdownOpen}
          disabled={!overviewState.canSelectMonth}
          style={!overviewState.canSelectMonth ?
            'pointer-events: none; opacity: 0.5;'
          : ''}
          onclick={() => {
            if (overviewState.canSelectMonth) {
              monthDropdownOpen = !monthDropdownOpen;
            }
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
                void handleMonthSelect(m);
              }}
            >
              {MONTH_NAMES[m]}
            </button>
          {/each}
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
      {#if overviewState.selectedMonth === null}
        <div class="empty-state empty-state--in-card">
          <div class="empty-state__icon">
            <i class="fas fa-filter"></i>
          </div>
          <h3 class="empty-state__title">Filter auswählen</h3>
          <p class="empty-state__description">
            Wählen Sie oben Maschine, Team, Jahr und Monat aus, um den
            Urlaubskalender anzuzeigen.
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
            <span class="calendar-legend__dot calendar-legend__dot--half"
            ></span>
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
</div>

<style>
  /* ─── Cascade Filter Row (mirrors shift-info-row pattern) ──────── */

  .vacation-filter-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-6);
    position: relative;
    z-index: 1;
  }

  .vacation-filter-row :global(.info-item) {
    display: flex;
    position: relative;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .vacation-filter-row :global(.info-label) {
    margin-bottom: var(--spacing-1);
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 16px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

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

  /* ─── Blackout day marking ─────────────────────────────────────── */

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

  @media (width >= 1024px) {
    .vacation-filter-row {
      grid-template-columns: repeat(4, 1fr);
    }
  }
</style>
