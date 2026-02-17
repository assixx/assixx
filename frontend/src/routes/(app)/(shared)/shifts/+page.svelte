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
  /* Parent-owned styles (used directly in this template) */
  .main-planning-area {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: var(--spacing-8);
  }

  .department-notice {
    backdrop-filter: var(--glass-backdrop);
    margin: var(--spacing-8) auto;

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
</style>
