<script lang="ts">
  // SHIFTS PAGE - Svelte 5 + SSR
  import { onMount } from 'svelte';

  import AdminActions from './_lib/AdminActions.svelte';
  import {
    fetchDepartments,
    fetchMachines,
    fetchTeams,
    fetchTeamMembers,
  } from './_lib/api';
  import CustomRotationModal from './_lib/CustomRotationModal.svelte';
  import {
    convertTeamMembersToEmployees,
    convertSSRTeamMembersToEmployees,
    getWeekDateBounds,
  } from './_lib/data-loader';
  import {
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    removeEmployeeFromShift,
  } from './_lib/dnd-orchestration';
  import EmployeeSidebar from './_lib/EmployeeSidebar.svelte';
  import FilterDropdowns from './_lib/FilterDropdowns.svelte';
  import {
    handleSaveSchedule,
    handleResetSchedule,
    handleDiscardWeek,
    handleDiscardTeamPlan,
    handleDiscardYearPlan,
    handleDeleteFavorite,
    handleAddToFavorites,
    handleFavoriteClick,
    handleCustomRotationGenerate,
  } from './_lib/page-actions';
  import {
    loadShiftPlan,
    navigateToWeekContainingDate,
    syncRotationToggles,
  } from './_lib/plan-loader';
  import RotationSetupModal from './_lib/RotationSetupModal.svelte';
  import ShiftControls from './_lib/ShiftControls.svelte';
  import ShiftScheduleGrid from './_lib/ShiftScheduleGrid.svelte';
  import { shiftsState } from './_lib/state.svelte';
  import {
    formatWeekRange,
    getWeekStart,
    getWeekEnd,
    getWeekDates,
    formatDate,
    addWeeks,
  } from './_lib/utils';
  import WeekNavigation from './_lib/WeekNavigation.svelte';

  import type { PageData } from './$types';

  // --- SSR DATA ---
  const { data }: { data: PageData } = $props();
  const ssrUser = $derived(data.user);
  const ssrAreas = $derived(data.areas);
  const ssrTeams = $derived(data.teams);
  const ssrTeamMembers = $derived(data.teamMembers);
  const ssrFavorites = $derived(data.favorites);
  const ssrEmployeeTeamInfo = $derived(data.employeeTeamInfo);
  const ssrStaffingRules = $derived(data.staffingRules);
  const ssrIsEmployee = $derived(data.isEmployee);
  let ssrInitialized = $state(false);

  // --- SSR INIT ---
  $effect(() => {
    if (ssrInitialized) return;
    ssrInitialized = true;

    shiftsState.setUser(ssrUser);
    shiftsState.setAreas(ssrAreas);

    if (ssrIsEmployee && ssrEmployeeTeamInfo) {
      shiftsState.setEmployeeTeamInfo(ssrEmployeeTeamInfo);
      shiftsState.setTeams(ssrTeams);
      shiftsState.setSelectedContext({
        areaId: ssrEmployeeTeamInfo.areaId,
        departmentId: ssrEmployeeTeamInfo.departmentId,
        teamId: ssrEmployeeTeamInfo.teamId,
        machineId: null,
        teamLeaderId: ssrEmployeeTeamInfo.teamLeaderId,
      });
      shiftsState.setEmployees(
        convertSSRTeamMembersToEmployees(ssrTeamMembers),
      );
      shiftsState.setShowPlanningUI(true);
    }

    shiftsState.setIsLoading(false);
  });

  // --- CLICK OUTSIDE ---
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown')) {
      shiftsState.closeAllDropdowns();
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside, true);
    if (
      ssrIsEmployee &&
      ssrEmployeeTeamInfo !== null &&
      ssrEmployeeTeamInfo.teamId !== 0
    ) {
      void loadShiftPlan();
    }
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  });

  // --- DROPDOWN HANDLERS ---
  async function handleAreaChange(areaId: number) {
    shiftsState.setSelectedContext({
      areaId,
      departmentId: null,
      machineId: null,
      teamId: null,
    });
    shiftsState.clearShiftData();
    shiftsState.setShowPlanningUI(false);

    const depts = await fetchDepartments(areaId);
    shiftsState.setDepartments(depts);
    shiftsState.setMachines([]);
    shiftsState.setTeams([]);
  }

  async function handleDepartmentChange(departmentId: number) {
    shiftsState.setSelectedContext({
      departmentId,
      machineId: null,
      teamId: null,
    });
    shiftsState.clearShiftData();
    shiftsState.setShowPlanningUI(false);

    const [machs, tms] = await Promise.all([
      fetchMachines(departmentId, shiftsState.selectedContext.areaId),
      fetchTeams(departmentId),
    ]);
    shiftsState.setMachines(machs);
    shiftsState.setTeams(tms);
  }

  /** Min staff count derived from SSR staffing rules + selected machine */
  const minStaffCount = $derived.by(() => {
    const machineId = shiftsState.selectedContext.machineId;
    if (machineId === null) return null;
    const rule = ssrStaffingRules.find(
      (r: { machineId: number; minStaffCount: number }) =>
        r.machineId === machineId,
    );
    return rule?.minStaffCount ?? null;
  });

  function handleMachineChange(machineId: number): void {
    shiftsState.setSelectedContext({ machineId });
  }

  async function handleTeamChange(teamId: number) {
    shiftsState.setSelectedContext({ teamId });
    const { startDate, endDate } = getWeekDateBounds(shiftsState.currentWeek);
    const members = await fetchTeamMembers(teamId, startDate, endDate);
    shiftsState.setEmployees(convertTeamMembersToEmployees(members));
    shiftsState.setShowPlanningUI(true);
    await loadShiftPlan();
  }

  async function navigateWeek(direction: number) {
    const newWeek = addWeeks(shiftsState.currentWeek, direction);
    shiftsState.setCurrentWeek(newWeek);
    await loadShiftPlan();
  }

  // --- DERIVED VALUES ---
  const weekDates = $derived(getWeekDates(shiftsState.currentWeek));
  const weekRangeText = $derived(
    formatWeekRange(getWeekStart(shiftsState.currentWeek)),
  );
  const currentWeekStart = $derived(
    formatDate(getWeekStart(shiftsState.currentWeek)),
  );
  const currentWeekEnd = $derived(
    formatDate(getWeekEnd(shiftsState.currentWeek)),
  );

  /** Shift employees getter for template props */
  function getShiftEmployees(dateKey: string, shiftType: string): number[] {
    return shiftsState.getShiftEmployees(dateKey, shiftType);
  }
</script>

<svelte:head>
  <title>Schichtplanung - Assixx</title>
</svelte:head>

<div class="container">
  <div class="card">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-calendar-alt mr-2"></i>Schichtplanung
      </h2>
      <p class="mt-2 text-(--color-text-secondary)">
        Schichten planen und verwalten
      </p>

      <!-- Loading Overlay (Design System) - ONLY during initial load, NOT during week changes -->
      {#if shiftsState.isLoading && !shiftsState.showPlanningUI}
        <div class="flex items-center justify-center gap-3 py-12">
          <div class="spinner-ring spinner-ring--lg"></div>
          <span class="text-(--color-text-secondary)">Laden...</span>
        </div>
      {/if}

      <!-- Employee Team Info Bar -->
      {#if shiftsState.employeeTeamInfo !== null}
        <div
          class="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-(--color-glass-border)
            bg-(--glass-bg) p-4"
          role="status"
        >
          <i class="fas fa-users text-(--color-text-secondary)"></i>
          <span class="font-medium text-(--color-text-secondary)"
            >Dein Team:</span
          >
          <span class="font-semibold text-blue-400"
            >{shiftsState.employeeTeamInfo.teamName}</span
          >
          <span class="font-medium text-(--color-text-secondary)"
            >Abteilung:</span
          >
          <span class="font-semibold text-blue-400"
            >{shiftsState.employeeTeamInfo.departmentName}</span
          >
          <span class="font-medium text-(--color-text-secondary)">Bereich:</span
          >
          <span class="font-semibold text-blue-400"
            >{shiftsState.employeeTeamInfo.areaName}</span
          >
        </div>
      {/if}

      <!-- Admin Filter Controls (Extracted Component) -->
      {#if shiftsState.isAdmin && shiftsState.employeeTeamInfo === null}
        <FilterDropdowns
          areas={shiftsState.areas}
          departments={shiftsState.departments}
          machines={shiftsState.machines}
          teams={shiftsState.teams}
          favorites={ssrFavorites}
          selectedContext={shiftsState.selectedContext}
          areaDropdownOpen={shiftsState.areaDropdownOpen}
          departmentDropdownOpen={shiftsState.departmentDropdownOpen}
          machineDropdownOpen={shiftsState.machineDropdownOpen}
          teamDropdownOpen={shiftsState.teamDropdownOpen}
          ontoggleAreaDropdown={() => {
            shiftsState.toggleAreaDropdown();
          }}
          ontoggleDepartmentDropdown={() => {
            shiftsState.toggleDepartmentDropdown();
          }}
          ontoggleMachineDropdown={() => {
            shiftsState.toggleMachineDropdown();
          }}
          ontoggleTeamDropdown={() => {
            shiftsState.toggleTeamDropdown();
          }}
          oncloseAllDropdowns={() => {
            shiftsState.closeAllDropdowns();
          }}
          onareaChange={handleAreaChange}
          ondepartmentChange={handleDepartmentChange}
          onmachineChange={handleMachineChange}
          onteamChange={handleTeamChange}
          onfavoriteClick={handleFavoriteClick}
          ondeleteFavorite={handleDeleteFavorite}
          onaddToFavorites={handleAddToFavorites}
        />
      {/if}
    </div>
    <!-- END card__header -->

    <div class="card__body">
      <!-- Employee without Team - Error Notice -->
      {#if ssrIsEmployee && !ssrEmployeeTeamInfo}
        <div class="department-notice">
          <div class="notice-icon">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <h3>Kein Team zugewiesen</h3>
          <p>
            Du bist noch keinem Team zugeordnet. Bitte wende dich an deinen
            Administrator.
          </p>
        </div>
      {/if}

      <!-- Admin Notice (show when no team selected) -->
      {#if !shiftsState.showPlanningUI && shiftsState.isAdmin}
        <div class="department-notice">
          <div class="notice-icon"><i class="fas fa-info-circle"></i></div>
          <h3>Team auswählen</h3>
          <p>
            Bitte wählen Sie einen Bereich, eine Abteilung und ein Team aus, um
            den Schichtplan anzuzeigen.
          </p>
        </div>
      {/if}

      <!-- Main Planning UI -->
      {#if shiftsState.showPlanningUI}
        <!-- Week Navigation -->
        <WeekNavigation
          {weekRangeText}
          onnavigateWeek={navigateWeek}
        />

        <!-- Shift Control Toggles (Admin Only) -->
        {#if shiftsState.isAdmin}
          <ShiftControls
            autofillConfig={shiftsState.autofillConfig}
            standardRotationEnabled={shiftsState.standardRotationEnabled}
            customRotationEnabled={shiftsState.customRotationEnabled}
            isPlanLocked={shiftsState.isPlanLocked}
            onautofillChange={(enabled: boolean) => {
              shiftsState.setAutofillConfig({ enabled });
            }}
            onstandardRotationChange={(enabled: boolean) => {
              shiftsState.setStandardRotationEnabled(enabled);
            }}
            oncustomRotationChange={(enabled: boolean) => {
              shiftsState.setCustomRotationEnabled(enabled);
            }}
          />
        {/if}

        <!-- Main Planning Area (enthält NUR week-schedule + employee-sidebar!) -->
        <div class="main-planning-area">
          <!-- Week Schedule (Extracted Component) -->
          <ShiftScheduleGrid
            {weekDates}
            weeklyNotes={shiftsState.weeklyNotes}
            canEditShifts={shiftsState.canEditShifts}
            isEditMode={shiftsState.isEditMode}
            currentPlanId={shiftsState.currentPlanId}
            machineAvailabilityMap={shiftsState.machineAvailabilityMap}
            {getShiftEmployees}
            getEmployeeById={(id: number) => shiftsState.getEmployeeById(id)}
            getShiftDetail={(key: string) => shiftsState.shiftDetails.get(key)}
            hasRotationShift={(key: string) =>
              shiftsState.rotationHistoryMap.has(key)}
            ondragover={handleDragOver}
            ondragenter={handleDragEnter}
            ondragleave={handleDragLeave}
            ondrop={handleDrop}
            onremoveEmployee={removeEmployeeFromShift}
            onnotesChange={(notes: string) => {
              shiftsState.setWeeklyNotes(notes);
            }}
          />

          <!-- Employee Sidebar (Extracted Component) -->
          {#if shiftsState.isAdmin || shiftsState.employees.length > 0}
            <EmployeeSidebar
              employees={shiftsState.employees}
              {weekDates}
              canEditShifts={shiftsState.canEditShifts}
              isEditMode={shiftsState.isEditMode}
              currentPlanId={shiftsState.currentPlanId}
              hasRotationHistory={shiftsState.rotationHistoryMap.size > 0}
              {minStaffCount}
              ondragstart={handleDragStart}
              ondragend={handleDragEnd}
            />
          {/if}
        </div>
        <!-- END main-planning-area -->

        <!-- Admin Actions (Extracted Component) -->
        {#if shiftsState.isAdmin}
          <AdminActions
            currentPatternId={shiftsState.currentPatternId}
            isPlanLocked={shiftsState.isPlanLocked}
            isEditMode={shiftsState.isEditMode}
            onreset={handleResetSchedule}
            onsave={handleSaveSchedule}
            ondiscardWeek={handleDiscardWeek}
            ondiscardTeamPlan={handleDiscardTeamPlan}
            ondiscardYearPlan={handleDiscardYearPlan}
            onenterEditMode={() => {
              shiftsState.setIsEditMode(true);
            }}
          />
        {/if}
      {/if}
    </div>
    <!-- END card__body -->
  </div>
  <!-- END card -->
</div>
<!-- END container -->

<!-- MODALS -->
{#if shiftsState.showRotationSetupModal}
  <RotationSetupModal
    employees={shiftsState.employees}
    selectedContext={shiftsState.selectedContext}
    initialStartDate={currentWeekStart}
    initialEndDate={currentWeekEnd}
    onclose={() => {
      shiftsState.setShowRotationSetupModal(false);
      // Reset toggle to match actual pattern state (Legacy behavior)
      syncRotationToggles();
    }}
    oncomplete={(startDate: string) => {
      shiftsState.setShowRotationSetupModal(false);
      navigateToWeekContainingDate(startDate);
      void loadShiftPlan();
    }}
  />
{/if}

<!-- Custom Rotation Pattern Modal -->
{#if shiftsState.showCustomRotationModal}
  <CustomRotationModal
    employees={shiftsState.employees}
    initialStartDate={currentWeekStart}
    initialEndDate={currentWeekEnd}
    onclose={() => {
      shiftsState.setShowCustomRotationModal(false);
      // Reset toggle to match actual pattern state (Legacy behavior)
      syncRotationToggles();
    }}
    ongenerate={handleCustomRotationGenerate}
  />
{/if}

<style>
  :global {
    /* Shift Info Row */
    .shift-info-row {
      display: grid;
      position: relative;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--spacing-6);
      z-index: 1;
    }

    .info-item {
      display: flex;
      position: relative;
      flex-direction: column;
      align-items: center;

      text-align: center;
    }

    .info-label {
      margin-bottom: var(--spacing-1);
      color: var(--text-secondary);
      font-weight: 500;

      font-size: 16px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    /* Week Navigation */
    .week-navigation {
      flex-direction: row;
      justify-content: center;
      align-items: center;
      gap: var(--spacing-6);
    }

    .week-info {
      color: var(--primary-color);
      font-weight: 600;
      font-size: 18px;
    }

    /* Main Planning Area */
    .main-planning-area {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: var(--spacing-8);
    }

    /* Week Schedule */
    .week-schedule {
      box-shadow: var(--shadow-sm);
      border: var(--glass-border);
      border-radius: var(--radius-xl);

      padding: 10px;
      overflow: hidden;
    }

    .schedule-header {
      display: grid;
      grid-template-columns: 120px repeat(7, 1fr);
      gap: 2px;

      padding-top: 10px;
      padding-bottom: 10px;
      color: var(--text-primary);

      font-weight: 600;
    }

    .day-header {
      backdrop-filter: blur(5px);
      border: var(--glass-border);
      border-radius: var(--radius-xl);

      background: var(--glass-bg-hover);
      padding: var(--spacing-4) var(--spacing-1);

      color: var(--primary-color);
      text-align: center;
    }

    .shift-row {
      display: grid;
      grid-template-columns: 120px repeat(7, 1fr);
      gap: 2px;

      background: transparent;

      padding-top: 2px;
      padding-bottom: 2px;
    }

    .shift-label {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      backdrop-filter: blur(5px);
      border: var(--glass-border);
      border-radius: var(--radius-xl);

      background: var(--glass-bg-hover);
      padding: var(--spacing-3);

      min-height: 85px;
      color: var(--text-primary);
      font-weight: 600;

      font-size: 13px;
      text-align: center;
    }

    /* Shift type colors */
    .shift-type-early {
      background: linear-gradient(
        135deg,
        rgb(255 193 7 / 15%) 0%,
        rgb(255 152 0 / 10%) 100%
      );
    }

    .shift-type-late {
      background: linear-gradient(
        135deg,
        rgb(33 150 243 / 15%) 0%,
        rgb(3 169 244 / 10%) 100%
      );
    }

    .shift-type-night {
      background: linear-gradient(
        135deg,
        rgb(156 39 176 / 15%) 0%,
        rgb(103 58 183 / 10%) 100%
      );
    }

    .shift-label-night {
      background: #b3b8bc4a;
    }

    /* Shift cells */
    .shift-cell {
      position: relative;
      backdrop-filter: blur(5px);
      cursor: pointer;
      border: 1px solid var(--color-glass-border);
      border-radius: var(--radius-xl);

      background: var(--glass-bg);

      min-height: 85px;
    }

    .shift-cell:hover {
      box-shadow: var(--shadow-sm);
      border-color: var(--primary-color);
      background: rgb(33 150 243 / 10%);
    }

    .shift-cell.assigned {
      border-color: var(--success-color);
      background: rgb(76 175 80 / 15%);
    }

    .shift-cell.drag-over {
      box-shadow: 0 0 0 2px rgb(76 175 80 / 30%);
      border-color: var(--success-color);
      background: rgb(76 175 80 / 20%);
    }

    /* Locked shift cell */
    .shift-cell.locked {
      cursor: not-allowed;
      border-color: var(--color-glass-border);
      background:
        repeating-linear-gradient(
          45deg,
          transparent,
          transparent 10px,
          var(--glass-bg-hover) 10px,
          var(--glass-bg-hover) 20px
        ),
        var(--glass-bg);
    }

    .shift-cell.locked:hover {
      cursor: not-allowed;
      box-shadow: none;
      border-color: var(--color-glass-border);
      background:
        repeating-linear-gradient(
          45deg,
          transparent,
          transparent 10px,
          var(--glass-bg-hover) 10px,
          var(--glass-bg-hover) 20px
        ),
        var(--glass-bg);
    }

    .shift-cell.locked .remove-btn {
      display: none !important;
    }

    .shift-cell.locked .employee-card {
      pointer-events: none;
    }

    /* Machine Availability Status */
    .shift-cell.machine-avail-maintenance {
      border-top: 3px solid #ffc107;
      background:
        linear-gradient(180deg, rgb(255 193 7 / 12%) 0%, transparent 40%),
        var(--glass-bg);
    }

    .shift-cell.machine-avail-repair {
      border-top: 3px solid #dc3545;
      background:
        linear-gradient(180deg, rgb(220 53 69 / 12%) 0%, transparent 40%),
        var(--glass-bg);
    }

    .shift-cell.machine-avail-standby {
      border-top: 3px solid #3498db;
      background:
        linear-gradient(180deg, rgb(52 152 219 / 12%) 0%, transparent 40%),
        var(--glass-bg);
    }

    .shift-cell.machine-avail-cleaning {
      border-top: 3px solid #20c997;
      background:
        linear-gradient(180deg, rgb(32 201 151 / 12%) 0%, transparent 40%),
        var(--glass-bg);
    }

    .shift-cell.machine-avail-other {
      border-top: 3px solid #6f42c1;
      background:
        linear-gradient(180deg, rgb(111 66 193 / 12%) 0%, transparent 40%),
        var(--glass-bg);
    }

    /* Machine availability dot */
    .machine-avail-dot {
      position: absolute;
      top: 3px;
      right: 3px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .machine-avail-dot.avail-maintenance {
      background: #ffc107;
    }

    .machine-avail-dot.avail-repair {
      background: #dc3545;
    }

    .machine-avail-dot.avail-standby {
      background: #3498db;
    }

    .machine-avail-dot.avail-cleaning {
      background: #20c997;
    }

    .machine-avail-dot.avail-other {
      background: #6f42c1;
    }
  }

  :global {
    /* Machine Availability Legend */
    .machine-avail-legend {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-2);
      backdrop-filter: blur(10px);

      margin-bottom: var(--spacing-4);
      border: var(--glass-border);
      border-radius: var(--radius-xl);

      background: var(--glass-bg);
      padding: var(--spacing-3) var(--spacing-4);
    }

    .machine-avail-legend-title {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);

      color: var(--text-secondary);
      font-weight: 600;
      font-size: 13px;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }

    .machine-avail-legend-title i {
      color: var(--text-tertiary);
      font-size: 16px;
    }

    .machine-avail-legend-items {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--spacing-4);
    }

    .machine-avail-legend-item {
      display: flex;
      align-items: center;
      gap: 8px;

      font-size: 14px;
    }

    .machine-avail-legend-swatch {
      border-radius: 50%;
      width: 14px;
      height: 14px;

      box-shadow: 0 0 4px rgb(0 0 0 / 20%);
    }

    .machine-avail-legend-swatch.legend-maintenance {
      background: #ffc107;
    }

    .machine-avail-legend-swatch.legend-repair {
      background: #dc3545;
    }

    .machine-avail-legend-swatch.legend-standby {
      background: #3498db;
    }

    .machine-avail-legend-swatch.legend-cleaning {
      background: #20c997;
    }

    .machine-avail-legend-swatch.legend-other {
      background: #6f42c1;
    }

    .machine-avail-legend-label {
      color: var(--text-secondary);
      font-weight: 500;
    }

    /* Week 2 cells for Kontischicht mode */
    .shift-cell.week-2-cell {
      backdrop-filter: blur(5px);
      border: 1px solid var(--color-glass-border);
      border-radius: var(--radius-xl);

      background: var(--glass-bg);
      min-height: 85px;
    }

    /* Employee Assignment */
    .employee-assignment {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: var(--spacing-1);

      height: 100%;

      text-align: center;
    }

    .employee-name {
      padding: 5px;
      color: var(--text-primary);
      font-weight: 600;
      font-size: 14px;
    }

    .empty-slot {
      color: var(--text-secondary);
      font-style: italic;
      font-size: 12px;
    }

    /* Shift Info Area */
    .shift-info-area {
      display: flex;
      flex-direction: column;
      backdrop-filter: blur(10px);
      margin-top: 2px;
      box-shadow: inset 0 1px 0 var(--color-glass-border);
      border: var(--glass-border);
      border-radius: var(--radius-xl);

      background: var(--glass-bg);
      padding: var(--spacing-3);

      min-height: 120px;
    }

    .shift-info-area-full {
      grid-column: 2 / -1;
    }

    .shift-info-title {
      display: flex;
      align-items: center;
      gap: var(--spacing-1);

      margin-bottom: var(--spacing-2);
      color: var(--primary-color);
      font-weight: 600;

      font-size: 14px;
    }

    .shift-info-textarea {
      flex: 1;
      backdrop-filter: blur(5px);
      border: 1px solid var(--color-glass-border);
      border-radius: var(--radius-xl);

      background: var(--glass-bg-hover);
      padding: var(--spacing-3);

      min-height: 300px;
      resize: vertical;
      color: var(--text-primary);
      font-size: 13px;

      font-family: inherit;
    }

    .shift-info-textarea:focus {
      outline: none;
      box-shadow: 0 0 0 3px rgb(33 150 243 / 10%);
      border-color: var(--primary-color);
    }

    .shift-info-textarea::placeholder {
      color: var(--color-text-placeholder);
    }

    /* Department Notice */
    .department-notice {
      backdrop-filter: var(--glass-backdrop);
      margin: var(--spacing-8) auto;
      box-shadow: var(--shadow-sm);
      border: var(--glass-border);
      border-radius: var(--radius-xl);

      background: var(--glass-bg);
      padding: var(--spacing-8) var(--spacing-6);
      max-width: 600px;

      text-align: center;
    }

    .department-notice .notice-icon {
      opacity: 80%;
      margin-bottom: var(--spacing-6);
      color: var(--primary-color);
      font-size: 48px;
    }

    .department-notice h3 {
      margin-bottom: var(--spacing-4);
      color: var(--text-primary);
      font-size: 24px;
    }

    .department-notice p {
      color: var(--text-secondary);
      font-size: 16px;
      line-height: 1.5;
    }

    /* Employee Sidebar */
    .employee-sidebar {
      backdrop-filter: var(--glass-backdrop);
      box-shadow: var(--shadow-sm);
      border: var(--glass-border);
      border-radius: var(--radius-xl);

      background: var(--glass-bg);
      padding: var(--spacing-6);
    }

    .shift-sidebar-title {
      margin-bottom: var(--spacing-6);
      color: var(--color-text-primary);
      font-weight: 500;

      font-size: 17px;
      text-align: center;
    }

    /* Employee Card Styles */
    .employee-card {
      display: flex;
      position: relative;
      flex-direction: column;
      gap: 2px;

      margin: 2px 0;
      border: 1px solid rgb(33 150 243 / 30%);
      border-radius: var(--radius-xl);

      background: rgb(33 150 243 / 15%);
      padding: 6px 8px;
    }

    .employee-card:hover {
      border-color: rgb(33 150 243 / 50%);
      background: rgb(33 150 243 / 25%);
    }

    .employee-card .employee-name {
      padding: 5px;
      color: var(--text-primary);
      font-weight: 600;
      font-size: 14px;
    }

    .employee-card .employee-position {
      color: var(--text-secondary);
      font-size: 11px;
      line-height: 1.2;
    }

    .employee-card .remove-btn {
      display: flex;

      position: absolute;
      top: -10px;
      right: -3px;
      z-index: 10;
      justify-content: center;
      align-items: center;

      opacity: 0%;
      cursor: pointer;
      border: 2px solid rgb(244 67 54);
      border-radius: 50px;
      background: rgb(244 67 54 / 10%);
      padding: 0;
      pointer-events: auto;

      width: 20px;
      height: 20px;

      color: rgb(244 67 54);
    }

    .employee-card:hover .remove-btn {
      opacity: 100%;
    }

    .employee-card .remove-btn:hover {
      transform: scale(1.2);
      border-color: rgb(244 67 54);
      background: rgb(244 67 54 / 37%);
    }

    .employee-card .remove-btn i {
      font-size: 10px;
    }

    /* Employee Availability Status Styles */
    .employee-item.unavailable {
      opacity: 70%;
      cursor: not-allowed;
    }

    .employee-item.status-vacation {
      border-left: 3px solid #ffc107;
      background: rgb(255 193 7 / 10%);
    }

    .employee-item.status-sick {
      border-left: 3px solid #dc3545;
      background: rgb(220 53 69 / 10%);
    }

    .employee-item.status-unavailable {
      border-left: 3px solid #6c757d;
      background: rgb(108 117 125 / 10%);
    }

    /* Employee info container */
    .employee-info {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 6px;
    }

    .employee-info .employee-name {
      color: var(--text-primary);
      font-weight: 600;
      font-size: 14px;
    }

    /* Status badge styles within employee items */
    .employee-info .badge {
      display: inline-flex;
      align-items: center;
      margin-top: 2px;
      border-radius: 4px;
      padding: 2px 6px;

      width: fit-content;
      font-weight: 600;

      font-size: 10px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .employee-info .badge-success {
      border: 1px solid rgb(76 175 80 / 30%);
      background: rgb(76 175 80 / 15%);
      color: rgb(76 175 80 / 95%);
    }

    .employee-info .badge-warning {
      border: 1px solid rgb(255 193 7 / 30%);
      background: rgb(255 193 7 / 15%);
      color: rgb(255 193 7 / 95%);
    }

    .employee-info .badge-danger {
      border: 1px solid rgb(220 53 69 / 30%);
      background: rgb(220 53 69 / 15%);
      color: rgb(220 53 69 / 95%);
    }

    .employee-info .badge-secondary {
      border: 1px solid rgb(108 117 125 / 30%);
      background: rgb(108 117 125 / 15%);
      color: rgb(108 117 125 / 95%);
    }

    /* Status icon positioning */
    .status-icon {
      margin-left: 8px;
      font-size: 14px;
    }

    .employee-info .status-icon {
      margin-left: 8px;
      font-size: 12px;
    }

    .status-icon.vacation {
      color: #ffc107;
    }

    .status-icon.sick {
      color: #dc3545;
    }

    .status-icon.unavailable {
      color: #6c757d;
    }

    /* Prevent dragging unavailable employees */
    .employee-item[draggable='false'] {
      user-select: none;

      -webkit-user-drag: none;
    }

    .employee-item[draggable='false']:hover {
      cursor: not-allowed;
    }

    /* Locked employee items */
    .employee-item.locked {
      opacity: 75%;
      cursor: not-allowed;

      -webkit-user-drag: none;
    }

    .employee-item.locked:hover {
      transform: none;
      cursor: not-allowed;
      box-shadow: none;
      background: inherit;
    }

    /* Rotation assignment */
    .rotation-assignment-container {
      margin-top: 20px;
    }

    .employee-item {
      cursor: grab;

      margin: 5px 0;
      border: 1px solid var(--color-glass-border);
      border-radius: var(--radius-xl);

      background: var(--glass-bg-active);
      padding: 8px 12px;
      user-select: none;
    }

    .employee-item:hover {
      transform: translateX(2px);
      background: var(--glass-bg-active);
    }

    .employee-item.dragging {
      opacity: 50%;
      cursor: grabbing;
    }

    .shift-assignment-table {
      display: flex;
      justify-content: space-between;
      gap: 15px;
    }

    .shift-column {
      flex: 1;
      min-width: 150px;
    }

    .column-header {
      border-radius: 4px 4px 0 0;

      background: var(--primary);
      padding: 10px;
      color: #fff;

      font-weight: 500;
      text-align: center;
    }

    .drop-zone {
      border: 2px dashed var(--color-glass-border-hover);
      border-top: none;
      border-radius: 0 0 4px 4px;

      background: rgb(0 0 0 / 30%);
      padding: 10px;

      min-height: 150px;
      max-height: 250px;
      overflow-y: auto;
    }

    .drop-zone.drag-over {
      border-color: var(--primary);
      background: rgb(76 175 80 / 10%);
    }

    .drop-zone .employee-item {
      position: relative;
      margin: 5px 0;
    }

    .drop-zone .employee-item::after {
      display: none;
    }

    /* Remove button for employees in drop zones */
    .btn-remove-rotation {
      display: flex;

      position: absolute;
      top: 50%;
      right: 8px;
      justify-content: center;
      align-items: center;
      transform: translateY(-50%);

      transition: all 0.2s;
      cursor: pointer;
      border: none;
      border-radius: 50%;

      background: rgb(255 0 0 / 30%);
      padding: 0;

      width: 20px;
      height: 20px;
      color: rgb(255 255 255 / 70%);

      font-size: 12px;
    }

    .btn-remove-rotation:hover {
      background: rgb(255 0 0 / 60%);
      color: #fff;
    }

    .drop-zone .employee-item.in-drop-zone {
      display: flex;
      position: relative;
      justify-content: space-between;
      align-items: center;

      padding-right: 35px;
    }

    /* Hidden elements */
    .shifts-hidden {
      display: none !important;
    }

    /* Shift Controls Container */
    .shift-controls {
      display: flex;
      justify-content: center;
      margin: var(--spacing-4) auto var(--spacing-6);
    }

    .controls-group {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--spacing-4);
      backdrop-filter: blur(10px);
      border: 1px solid var(--color-glass-border);
      border-radius: var(--radius-xl);

      background: var(--glass-bg);

      padding: var(--spacing-4);
    }

    .divider {
      margin: 0 var(--spacing-2);
      background: var(--accent-color);
      width: 1px;
      height: 40px;
    }

    .rotation-edit-btn {
      margin-left: auto;
      padding: 6px 12px;
      font-size: 0.875rem;
      white-space: nowrap;
    }

    /* Utility Classes */
    .u-fs-11 {
      font-size: 11px !important;
    }

    .u-fs-12 {
      font-size: 12px !important;
    }

    .u-fw-400 {
      font-weight: 400 !important;
    }

    /* Toggle hint for Design System toggle-switch */
    .toggle-hint {
      display: block;
      color: var(--color-text-muted, rgb(255 255 255 / 50%));
      font-weight: 400;
      font-size: 11px;
    }

    /* Favorites */
    .favorites-container {
      backdrop-filter: var(--glass-backdrop);
      margin-bottom: var(--spacing-6);
      box-shadow: var(--shadow-sm);
      border: var(--glass-border);
      border-radius: var(--radius-xl);

      background: var(--glass-bg);
      padding: var(--spacing-4);
    }

    .favorites-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--spacing-4);
    }

    .favorites-label {
      color: var(--text-primary);
      font-weight: 600;
      font-size: 14px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .favorites-header h3 {
      margin: 0;
      color: var(--text-primary);
      font-weight: 600;
      font-size: 18px;
    }

    .favorites-list {
      display: flex;
      flex: 1;
      flex-wrap: wrap;
      gap: var(--spacing-2);
    }

    .favorite-btn {
      display: flex;

      position: relative;
      align-items: center;
      gap: 8px;

      transition: all 0.3s ease;
      cursor: pointer;
      border: 1px solid rgb(76 175 80 / 40%);
      border-radius: var(--radius-xl);

      background: linear-gradient(
        135deg,
        rgb(76 175 80 / 20%),
        rgb(76 175 80 / 10%)
      );

      padding: 8px 16px;
      color: #4caf50;
      font-weight: 600;

      font-size: 13px;
    }

    .favorite-btn:hover {
      box-shadow: 0 4px 12px rgb(76 175 80 / 20%);
      border-color: rgb(76 175 80 / 60%);
      background: linear-gradient(
        135deg,
        rgb(76 175 80 / 30%),
        rgb(76 175 80 / 20%)
      );
    }

    .favorite-btn:active {
      transform: translateY(0);
    }

    .favorite-btn-inner {
      display: flex;
      align-items: center;
      gap: 8px;
      background: none;
      border: none;
      padding: 0;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }

    .remove-favorite {
      display: flex;

      position: absolute;
      top: -10px;
      right: -3px;
      justify-content: center;
      align-items: center;

      visibility: hidden;
      opacity: 0%;

      transition: all 0.2s ease;
      cursor: pointer;
      border: 2px solid rgb(244 67 54);
      border-radius: 50%;
      background: rgb(244 67 54 / 10%);

      width: 20px;
      height: 20px;
      color: rgb(244 67 54);

      font-size: 11px;
    }

    .favorite-btn:hover .remove-favorite {
      visibility: visible;
      opacity: 100%;
    }

    .remove-favorite:hover {
      transform: scale(1.2);
      border-color: rgb(244 67 54);
      background: rgb(244 67 54 / 37%);
    }

    .favorites-empty {
      color: var(--text-tertiary);
      font-size: 13px;
      font-style: italic;
    }

    /* Disabled Dropdown State */
    .dropdown--disabled {
      opacity: 50%;
      pointer-events: none;
    }

    .dropdown--disabled .dropdown__trigger {
      cursor: not-allowed;
    }

    /* Filter Dropdowns */
    #admin-filter-controls .dropdown {
      min-width: 200px;
      width: 100%;
    }

    #admin-filter-controls .dropdown__trigger {
      min-width: 200px;
    }

    #admin-filter-controls .dropdown__option {
      white-space: nowrap;
    }

    .add-favorite-btn {
      display: inline-block;

      transition: all 0.3s ease;
      cursor: pointer;

      margin-top: var(--spacing-4);
      margin-bottom: var(--spacing-4);
      box-shadow: var(--shadow-sm);
      border: 1px solid rgb(76 175 80 / 40%);
      border-radius: var(--radius-xl);

      background: linear-gradient(
        135deg,
        rgb(76 175 80 / 20%),
        rgb(76 175 80 / 10%)
      );
      padding: 10px 20px;
      color: #4caf50;
      font-weight: 700;

      font-size: 14px;
    }

    .add-favorite-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgb(76 175 80 / 30%);
      border-color: rgb(76 175 80 / 60%);
      background: linear-gradient(
        135deg,
        rgb(76 175 80 / 30%),
        rgb(76 175 80 / 20%)
      );
    }

    .add-favorite-btn:active {
      transform: translateY(0);
    }

    /* Admin Actions */
    .admin-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--spacing-4);
      margin-top: var(--spacing-6);
    }

    .shift-time {
      color: var(--text-secondary);
      font-size: 11px;
    }

    .shift-name {
      color: var(--color-text-primary);
      font-weight: 600;
      font-size: 0.75rem;
    }

    /* Employee List */
    .employee-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    /* Availability Badges */
    .availability-badge {
      font-size: 0.7rem;
      padding: 0.125rem 0.5rem;
      border-radius: 10px;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      width: fit-content;
    }

    .availability-badge.badge--warning {
      background: rgb(255 193 7 / 20%);
      color: #ffc107;
    }

    .availability-badge.badge--danger {
      background: rgb(231 76 60 / 20%);
      color: #e74c3c;
    }

    .availability-badge.badge--error {
      background: rgb(192 57 43 / 20%);
      color: #c0392b;
    }

    .availability-badge.badge--info {
      background: rgb(52 152 219 / 20%);
      color: #3498db;
    }

    .availability-badge.badge--dark {
      background: rgb(149 165 166 / 20%);
      color: #95a5a6;
    }

    .availability-period {
      font-size: 0.65rem;
      color: var(--color-text-secondary);
      white-space: nowrap;
      margin-left: 0.25rem;
    }
  }

  /* Light mode: darker availability badge text */
  :global(html:not(.dark)) :global(.availability-badge.badge--warning) {
    color: #ab8000;
  }

  :global(html:not(.dark)) :global(.availability-badge.badge--danger) {
    color: #c62828;
  }

  :global(html:not(.dark)) :global(.availability-badge.badge--error) {
    color: #962018;
  }

  :global(html:not(.dark)) :global(.availability-badge.badge--info) {
    color: #1565c0;
  }

  :global(html:not(.dark)) :global(.availability-badge.badge--dark) {
    color: #546e7a;
  }

  /* Responsive: shift-info-row */
  @media (width < 1024px) {
    :global {
      .shift-info-row {
        grid-template-columns: repeat(2, 1fr);
      }

      .employee-sidebar {
        max-height: 200px;
      }

      .employee-list {
        flex-flow: row wrap;
      }

      .employee-item {
        flex: 0 0 auto;
      }
    }
  }

  @media (width < 768px) {
    :global {
      .shift-info-row {
        grid-template-columns: 1fr;
      }

      .shift-assignment-table {
        flex-direction: column;
      }

      .shift-column {
        width: 100%;
      }

      .controls-group {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--spacing-2);
      }

      .divider {
        margin: var(--spacing-2) 0;
        width: 100%;
        height: 1px;
      }

      .dropdown {
        min-width: 100%;
      }

      .shift-grid {
        overflow-x: auto;
      }

      .grid-header,
      .shift-row {
        min-width: 800px;
      }
    }
  }
</style>
