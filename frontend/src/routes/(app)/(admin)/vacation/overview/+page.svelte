<script lang="ts">
  /**
   * Vacation Overview — Admin Page
   * Cascade: Machine → Team → Year → Month → Calendar
   * SSR: Machines, blackouts, staffing rules loaded in +page.server.ts.
   * Client-side: Teams fetched on machine selection, calendar on month selection.
   */
  import { onDestroy } from 'svelte';

  import { onClickOutsideDropdown } from '$lib/actions/click-outside';
  import { showErrorAlert } from '$lib/utils';
  import { createLogger } from '$lib/utils/logger';

  import * as api from './_lib/api';
  import CalendarGrid from './_lib/CalendarGrid.svelte';
  import { DROPDOWN_PLACEHOLDERS, MONTH_NAMES } from './_lib/constants';
  import { overviewState } from './_lib/state.svelte';

  import type { PageData } from './$types';
  import type { MachineListItem, TeamListItem } from './_lib/types';

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

  /** Load calendar data + machine availability for selected filters */
  async function loadCalendar(): Promise<void> {
    const teamId = overviewState.selectedTeamId;
    const month = overviewState.selectedMonth;
    const year = overviewState.selectedYear;
    const machineId = overviewState.selectedMachineId;

    if (teamId === null || month === null || year === null) return;

    overviewState.setLoadingCalendar(true);
    try {
      // Build date range for the selected month
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      // Fetch calendar + availability in parallel
      const [calendarData, availEntries] = await Promise.all([
        api.getTeamCalendar(teamId, month, year),
        machineId !== null ?
          api.getMachineAvailability(machineId, startDate, endDate)
        : Promise.resolve([]),
      ]);

      overviewState.setCalendarData(calendarData);
      overviewState.setMachineAvailEntries(availEntries);
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

  /** Display text helpers — same pattern as FilterDropdowns.svelte (shifts) */
  function getMachineDisplayText(): string {
    if (overviewState.selectedMachineId === null)
      return DROPDOWN_PLACEHOLDERS.MACHINE;
    return overviewState.selectedMachineName;
  }

  function getTeamDisplayText(): string {
    if (overviewState.selectedMachineId === null)
      return DROPDOWN_PLACEHOLDERS.AWAIT_MACHINE;
    if (overviewState.selectedTeamId === null)
      return DROPDOWN_PLACEHOLDERS.TEAM;
    return overviewState.selectedTeamName;
  }

  function getYearDisplayText(): string {
    if (overviewState.selectedTeamId === null)
      return DROPDOWN_PLACEHOLDERS.AWAIT_TEAM;
    if (overviewState.selectedYear === null) return DROPDOWN_PLACEHOLDERS.YEAR;
    return String(overviewState.selectedYear);
  }

  function getMonthDisplayText(): string {
    if (overviewState.selectedYear === null)
      return DROPDOWN_PLACEHOLDERS.AWAIT_YEAR;
    if (overviewState.selectedMonth === null)
      return DROPDOWN_PLACEHOLDERS.MONTH;
    return MONTH_NAMES[overviewState.selectedMonth] ?? '';
  }

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
        <div
          class="dropdown__trigger"
          class:active={machineDropdownOpen}
          onclick={() => {
            machineDropdownOpen = !machineDropdownOpen;
          }}
          onkeydown={(e) => {
            if (e.key === 'Enter') machineDropdownOpen = !machineDropdownOpen;
          }}
          role="button"
          tabindex="0"
        >
          <span>{getMachineDisplayText()}</span>
          <i class="fas fa-chevron-down"></i>
        </div>
        <div
          class="dropdown__menu"
          class:active={machineDropdownOpen}
        >
          {#each overviewState.machines as machine (machine.id)}
            <div
              class="dropdown__option"
              class:selected={overviewState.selectedMachineId === machine.id}
              onclick={() => {
                void handleMachineSelect(machine);
              }}
              onkeydown={(e) => {
                if (e.key === 'Enter') void handleMachineSelect(machine);
              }}
              role="option"
              aria-selected={overviewState.selectedMachineId === machine.id}
              tabindex="0"
            >
              {machine.name}
            </div>
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
        <div
          class="dropdown__trigger"
          class:active={teamDropdownOpen}
          onclick={() => {
            if (overviewState.canSelectTeam)
              teamDropdownOpen = !teamDropdownOpen;
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
        <div
          class="dropdown__trigger"
          class:active={yearDropdownOpen}
          onclick={() => {
            if (overviewState.canSelectYear)
              yearDropdownOpen = !yearDropdownOpen;
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
                handleYearSelect(year);
              }}
              onkeydown={(e) => {
                if (e.key === 'Enter') handleYearSelect(year);
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

    <!-- 4. Monat (enabled after year) -->
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
            if (overviewState.canSelectMonth)
              monthDropdownOpen = !monthDropdownOpen;
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
       TEAM CALENDAR
       ================================================================ -->
  <CalendarGrid />
</div>

<style>
  /* ─── Cascade Filter Row (mirrors shift-info-row pattern) ──────── */

  .vacation-filter-row {
    display: inline-grid;
    grid-template-columns: 1fr 1fr;
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

  @media (width >= 1024px) {
    .vacation-filter-row {
      grid-template-columns: repeat(4, 1fr);
    }
  }
</style>
