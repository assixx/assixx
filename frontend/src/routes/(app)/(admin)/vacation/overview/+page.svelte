<script lang="ts">
  /**
   * Vacation Overview — Admin Page
   * Cascade: Team → Year → Month → Calendar
   * SSR: Teams and blackouts loaded in +page.server.ts.
   * Client-side: Calendar data fetched on month/year selection.
   */
  import { onDestroy } from 'svelte';

  import { onClickOutsideDropdown } from '$lib/actions/click-outside';
  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
  import { showErrorAlert } from '$lib/utils';
  import { createLogger } from '$lib/utils/logger';

  import * as api from './_lib/api';
  import CalendarGrid from './_lib/CalendarGrid.svelte';
  import { DROPDOWN_PLACEHOLDERS, MONTH_NAMES } from './_lib/constants';
  import { overviewState } from './_lib/state.svelte';
  import YearOverviewGrid from './_lib/YearOverviewGrid.svelte';

  import type { PageData } from './$types';
  import type { TeamListItem } from './_lib/types';

  const log = createLogger('VacationOverview');

  // ==========================================================================
  // SSR DATA
  // ==========================================================================

  const { data }: { data: PageData } = $props();
  const permissionDenied = $derived(data.permissionDenied);

  $effect(() => {
    overviewState.setTeams(data.teams);
    overviewState.setBlackouts(data.blackouts);
    overviewState.setLoading(false);
  });

  onDestroy(() => {
    overviewState.reset();
  });

  // ==========================================================================
  // CASCADE HANDLERS
  // ==========================================================================

  /** Team selected */
  function handleTeamSelect(team: TeamListItem): void {
    teamDropdownOpen = false;
    overviewState.selectTeam(team.id);
  }

  /** Year selected → load year overview */
  async function handleYearSelect(year: number): Promise<void> {
    yearDropdownOpen = false;
    overviewState.setYear(year);
    await loadYearOverview();
  }

  /** Month selected → load monthly calendar */
  async function handleMonthSelect(month: number): Promise<void> {
    monthDropdownOpen = false;
    overviewState.setMonth(month);
    await loadCalendar();
  }

  /** Clear month → back to year overview */
  function handleClearMonth(): void {
    monthDropdownOpen = false;
    overviewState.clearMonth();
  }

  /** Load year overview data (all 12 months in parallel) */
  async function loadYearOverview(): Promise<void> {
    const teamId = overviewState.selectedTeamId;
    const year = overviewState.selectedYear;
    if (teamId === null || year === null) return;

    overviewState.setLoadingYearCalendar(true);
    try {
      const data = await api.getTeamCalendarYear(teamId, year);
      overviewState.setYearCalendarData(data);
    } catch (err: unknown) {
      log.error({ err }, 'Year calendar load failed');
      showErrorAlert('Fehler beim Laden der Jahresübersicht');
      overviewState.setYearCalendarData(null);
    } finally {
      overviewState.setLoadingYearCalendar(false);
    }
  }

  /** Drill into a month from the year overview grid */
  async function handleMonthFromYearGrid(month: number): Promise<void> {
    overviewState.setMonth(month);
    await loadCalendar();
  }

  /** Load calendar data for selected filters */
  async function loadCalendar(): Promise<void> {
    const teamId = overviewState.selectedTeamId;
    const month = overviewState.selectedMonth;
    const year = overviewState.selectedYear;

    if (teamId === null || month === null || year === null) return;

    overviewState.setLoadingCalendar(true);
    try {
      const calendarData = await api.getTeamCalendar(teamId, month, year);
      overviewState.setCalendarData(calendarData);
    } catch (err: unknown) {
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

  let teamDropdownOpen = $state(false);
  let yearDropdownOpen = $state(false);
  let monthDropdownOpen = $state(false);

  function getTeamDisplayText(): string {
    if (overviewState.selectedTeamId === null) return DROPDOWN_PLACEHOLDERS.TEAM;
    return overviewState.selectedTeamName;
  }

  function getYearDisplayText(): string {
    if (overviewState.selectedTeamId === null) return DROPDOWN_PLACEHOLDERS.AWAIT_TEAM;
    if (overviewState.selectedYear === null) return DROPDOWN_PLACEHOLDERS.YEAR;
    return String(overviewState.selectedYear);
  }

  function getMonthDisplayText(): string {
    if (overviewState.selectedYear === null) return DROPDOWN_PLACEHOLDERS.AWAIT_YEAR;
    if (overviewState.selectedMonth === null) return 'Jahresübersicht';
    return MONTH_NAMES[overviewState.selectedMonth] ?? '';
  }

  function yearOptions(): number[] {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }

  // Close all dropdowns on outside click
  $effect(() => {
    return onClickOutsideDropdown(() => {
      teamDropdownOpen = false;
      yearDropdownOpen = false;
      monthDropdownOpen = false;
    });
  });
</script>

<svelte:head>
  <title>Urlaubsübersicht - Assixx</title>
</svelte:head>

{#if permissionDenied}
  <PermissionDenied addonName="die Urlaubsverwaltung" />
{:else}
  <div class="container">
    <!-- ================================================================
       HEADER
       ================================================================ -->
    <div class="card mb-6">
      <div class="card__header">
        <h2 class="card__title">
          <i class="fas fa-calendar-alt mr-2"></i>
          Urlaubsübersicht
        </h2>
      </div>
    </div>

    <!-- ================================================================
       CASCADE FILTER ROW: Team → Year → Month
       ================================================================ -->
    <div class="card vacation-filter-row">
      <!-- 1. Team -->
      <div class="info-item">
        <div class="info-label">Team</div>
        <div
          class="dropdown"
          class:dropdown--disabled={!overviewState.canSelectTeam}
          data-dropdown="ov-team"
        >
          <div
            class="dropdown__trigger"
            class:active={teamDropdownOpen}
            onclick={() => {
              if (overviewState.canSelectTeam) teamDropdownOpen = !teamDropdownOpen;
            }}
            onkeydown={(e) => {
              if (e.key === 'Enter' && overviewState.canSelectTeam)
                teamDropdownOpen = !teamDropdownOpen;
            }}
            role="button"
            tabindex={overviewState.canSelectTeam ? 0 : -1}
          >
            <span>{getTeamDisplayText()}</span>
            <i class="fas fa-chevron-down"></i>
          </div>
          <div
            class="dropdown__menu"
            class:active={teamDropdownOpen}
          >
            {#each overviewState.teams as team (team.id)}
              <div
                class="dropdown__option"
                class:selected={overviewState.selectedTeamId === team.id}
                onclick={() => {
                  handleTeamSelect(team);
                }}
                onkeydown={(e) => {
                  if (e.key === 'Enter') handleTeamSelect(team);
                }}
                role="option"
                aria-selected={overviewState.selectedTeamId === team.id}
                tabindex="0"
              >
                {team.name}
              </div>
            {/each}
            {#if overviewState.canSelectTeam && overviewState.teams.length === 0}
              <div class="dropdown__option dropdown__option--disabled">Keine Teams vorhanden</div>
            {/if}
          </div>
        </div>
      </div>

      <!-- 2. Jahr (enabled after team) -->
      <div class="info-item">
        <div class="info-label">Jahr</div>
        <div
          class="dropdown"
          class:dropdown--disabled={!overviewState.canSelectYear}
          data-dropdown="ov-year"
        >
          <div
            class="dropdown__trigger"
            class:active={yearDropdownOpen}
            onclick={() => {
              if (overviewState.canSelectYear) yearDropdownOpen = !yearDropdownOpen;
            }}
            onkeydown={(e) => {
              if (e.key === 'Enter' && overviewState.canSelectYear)
                yearDropdownOpen = !yearDropdownOpen;
            }}
            role="button"
            tabindex={overviewState.canSelectYear ? 0 : -1}
          >
            <span>{getYearDisplayText()}</span>
            <i class="fas fa-chevron-down"></i>
          </div>
          <div
            class="dropdown__menu"
            class:active={yearDropdownOpen}
          >
            {#each yearOptions() as year (year)}
              <div
                class="dropdown__option"
                class:selected={overviewState.selectedYear === year}
                onclick={() => {
                  void handleYearSelect(year);
                }}
                onkeydown={(e) => {
                  if (e.key === 'Enter') void handleYearSelect(year);
                }}
                role="option"
                aria-selected={overviewState.selectedYear === year}
                tabindex="0"
              >
                {year}
              </div>
            {/each}
          </div>
        </div>
      </div>

      <!-- 3. Monat (enabled after year) -->
      <div class="info-item">
        <div class="info-label">Monat</div>
        <div
          class="dropdown"
          class:dropdown--disabled={!overviewState.canSelectMonth}
          data-dropdown="ov-month"
        >
          <div
            class="dropdown__trigger"
            class:active={monthDropdownOpen}
            onclick={() => {
              if (overviewState.canSelectMonth) monthDropdownOpen = !monthDropdownOpen;
            }}
            onkeydown={(e) => {
              if (e.key === 'Enter' && overviewState.canSelectMonth)
                monthDropdownOpen = !monthDropdownOpen;
            }}
            role="button"
            tabindex={overviewState.canSelectMonth ? 0 : -1}
          >
            <span>{getMonthDisplayText()}</span>
            <i class="fas fa-chevron-down"></i>
          </div>
          <div
            class="dropdown__menu"
            class:active={monthDropdownOpen}
          >
            <div
              class="dropdown__option"
              class:selected={overviewState.selectedMonth === null}
              onclick={() => {
                handleClearMonth();
              }}
              onkeydown={(e) => {
                if (e.key === 'Enter') handleClearMonth();
              }}
              role="option"
              aria-selected={overviewState.selectedMonth === null}
              tabindex="0"
            >
              <i class="fas fa-calendar mr-1"></i> Jahresübersicht
            </div>
            {#each Array.from({ length: 12 }, (_, i) => i + 1) as m (m)}
              <div
                class="dropdown__option"
                class:selected={overviewState.selectedMonth === m}
                onclick={() => {
                  void handleMonthSelect(m);
                }}
                onkeydown={(e) => {
                  if (e.key === 'Enter') void handleMonthSelect(m);
                }}
                role="option"
                aria-selected={overviewState.selectedMonth === m}
                tabindex="0"
              >
                {MONTH_NAMES[m]}
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <!-- ================================================================
       TEAM CALENDAR (year overview OR monthly detail)
       ================================================================ -->
    {#if overviewState.showYearOverview}
      <YearOverviewGrid onSelectMonth={handleMonthFromYearGrid} />
    {:else}
      <CalendarGrid />
    {/if}
  </div>
{/if}

<style>
  /* ─── Cascade Filter Row ──────── */

  .vacation-filter-row {
    display: inline-grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: var(--spacing-6);
    position: relative;
    z-index: 1;
  }

  .vacation-filter-row .info-item {
    display: flex;
    position: relative;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .vacation-filter-row .info-label {
    margin-bottom: var(--spacing-1);
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 16px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  /* ─── Cascade Disabled → Enabled Transition ──────── */

  .dropdown--disabled {
    opacity: 50%;
    pointer-events: none;
    transition: opacity 300ms ease;
  }

  .dropdown--disabled .dropdown__trigger {
    cursor: not-allowed;
  }

  .vacation-filter-row .dropdown {
    transition: opacity 300ms ease;
  }

  /* ─── Overview Dropdown Sizing ──────── */

  [data-dropdown^='ov-'] .dropdown__trigger {
    width: auto;
    min-width: 200px;
  }

  [data-dropdown^='ov-'] .dropdown__menu {
    min-width: 150px;
    left: auto;
    right: auto;
  }
</style>
