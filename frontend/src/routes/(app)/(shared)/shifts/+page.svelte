<script lang="ts">
  // SHIFTS PAGE - Svelte 5 + SSR
  import { onMount } from 'svelte';

  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import { showWarningAlert } from '$lib/utils/alerts';

  import AdminActions from './_lib/AdminActions.svelte';
  import { fetchAssignmentCounts, fetchDepartments, fetchAssets, fetchTeams } from './_lib/api';
  import CustomRotationModal from './_lib/CustomRotationModal.svelte';
  import { convertSSRTeamMembersToEmployees } from './_lib/data-loader';
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
  import ShiftAssignmentCounts from './_lib/ShiftAssignmentCounts.svelte';
  import ShiftControls from './_lib/ShiftControls.svelte';
  import ShiftScheduleGrid from './_lib/ShiftScheduleGrid.svelte';
  import ShiftScheduleLegend from './_lib/ShiftScheduleLegend.svelte';
  import { shiftsState } from './_lib/state.svelte';
  import SwapConsentBanner from './_lib/SwapConsentBanner.svelte';
  import SwapRequestModal from './_lib/SwapRequestModal.svelte';
  import {
    formatWeekRange,
    getWeekStart,
    getWeekEnd,
    getWeekDates,
    formatDate,
    addWeeks,
    buildShiftTimesMap,
  } from './_lib/utils';
  import WeekNavigation from './_lib/WeekNavigation.svelte';

  import type { PageData } from './$types';
  import type {
    AssignmentCount,
    ShiftDetailData,
    ShiftTimesMap,
    WeeklyShiftsMap,
  } from './_lib/types';

  // --- SSR DATA ---
  const { data }: { data: PageData } = $props();

  const permissionDenied = $derived(data.permissionDenied);

  // Hierarchy labels (propagated from layout)
  const labels = $derived(data.hierarchyLabels);
  const ssrUser = $derived(data.user);
  const ssrAreas = $derived(data.areas);
  const ssrTeams = $derived(data.teams);
  const ssrTeamMembers = $derived(data.teamMembers);
  const ssrFavorites = $derived(data.favorites);
  const ssrEmployeeTeamInfo = $derived(data.employeeTeamInfo);
  const ssrStaffingRules = $derived(data.staffingRules);
  const ssrOrgScope = $derived(data.orgScope);
  const ssrIsManager = $derived(data.orgScope.type !== 'none');
  const swapEnabled = $derived(data.swapRequestsEnabled);

  // Swap State
  let swapBannerRef: { loadData: () => Promise<void> } | undefined = $state();
  let showSwapModal = $state(false);
  let swapTarget = $state<{
    shiftId: number;
    userId: number;
    userName: string;
    date: string;
    shiftType: string;
    requesterShiftId: number;
    requesterDate: string;
    requesterShiftType: string;
  } | null>(null);

  // Build shift times map from SSR API data (tenant-configurable)
  const shiftTimesMap: ShiftTimesMap = $derived(
    data.shiftTimes.length > 0 ? buildShiftTimesMap(data.shiftTimes) : {},
  );
  let ssrInitialized = $state(false);
  let baseAssignmentCounts = $state<AssignmentCount[]>([]);

  /** Reactive: silently fetch base counts when planning UI is active */
  $effect(() => {
    const teamId = shiftsState.selectedContext.teamId;
    const week = shiftsState.currentWeek;
    if (teamId === null || !shiftsState.showPlanningUI || !shiftsState.isManager) return;
    const refDate = formatDate(getWeekStart(week));
    void fetchAssignmentCounts(teamId, refDate).then((result: AssignmentCount[]) => {
      baseAssignmentCounts = result;
    });
  });

  /** Count per-employee assignments from local weeklyShifts state */
  function countLocalWeek(): Record<number, number> {
    const counts: Partial<Record<number, number>> = {};
    const shifts: WeeklyShiftsMap = shiftsState.weeklyShifts;
    for (const [, shiftMap] of shifts) {
      for (const [, empIds] of shiftMap) {
        for (const id of empIds) {
          counts[id] = (counts[id] ?? 0) + 1;
        }
      }
    }
    return counts as Record<number, number>;
  }

  /** Merged counts: DB base adjusted by live local week state.
   *  During transition (weeklyShifts cleared), show base counts as-is. */
  const assignmentCounts = $derived.by((): AssignmentCount[] => {
    if (shiftsState.weeklyShifts.size === 0) return baseAssignmentCounts;
    const localWeek = countLocalWeek();
    return baseAssignmentCounts.map((entry: AssignmentCount) => {
      const localWk = localWeek[entry.employeeId] ?? 0;
      const diff = localWk - entry.weekCount;
      return {
        ...entry,
        weekCount: localWk,
        monthCount: entry.monthCount + diff,
        yearCount: entry.yearCount + diff,
      };
    });
  });

  // --- SSR INIT ---
  $effect(() => {
    if (ssrInitialized) return;
    ssrInitialized = true;

    shiftsState.setUser(ssrUser);
    // Set org scope BEFORE setAreas — derived isManager depends on it
    shiftsState.setOrgScope(ssrOrgScope);
    shiftsState.setAreas(ssrAreas);

    // Auto-select team for non-managers AND single-team managers
    // (employeeTeamInfo is set by server for both cases)
    if (ssrEmployeeTeamInfo) {
      shiftsState.setEmployeeTeamInfo(ssrEmployeeTeamInfo);
      shiftsState.setTeams(ssrTeams);
      shiftsState.setSelectedContext({
        areaId: ssrEmployeeTeamInfo.areaId,
        departmentId: ssrEmployeeTeamInfo.departmentId,
        teamId: ssrEmployeeTeamInfo.teamId,
        assetId: null,
        teamLeaderId: ssrEmployeeTeamInfo.teamLeaderId,
      });
      shiftsState.setEmployees(convertSSRTeamMembersToEmployees(ssrTeamMembers));
      shiftsState.setShowPlanningUI(true);
    }

    // Set favorites for managers
    if (ssrIsManager && ssrFavorites.length > 0) {
      shiftsState.setFavorites(ssrFavorites);
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
    // Reset shift swap badge when visiting shifts page
    notificationStore.resetCount('shiftSwap');
    // Load shift plan when team was auto-selected (employees + single-team managers)
    if (ssrEmployeeTeamInfo !== null && ssrEmployeeTeamInfo.teamId !== 0) {
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
      assetId: null,
      teamId: null,
    });
    shiftsState.clearShiftData();
    shiftsState.setShowPlanningUI(false);

    const depts = await fetchDepartments(areaId);
    shiftsState.setDepartments(depts);
    shiftsState.setAssets([]);
    shiftsState.setTeams([]);
  }

  async function handleDepartmentChange(departmentId: number) {
    shiftsState.setSelectedContext({
      departmentId,
      teamId: null,
      assetId: null,
    });
    shiftsState.clearShiftData();
    shiftsState.setShowPlanningUI(false);
    shiftsState.setAssets([]);

    const tms = await fetchTeams(departmentId);
    shiftsState.setTeams(tms);
  }

  /** Min staff count derived from SSR staffing rules + selected asset */
  const minStaffCount = $derived.by(() => {
    const assetId = shiftsState.selectedContext.assetId;
    if (assetId === null) return null;
    const rule = ssrStaffingRules.find(
      (r: { assetId: number; minStaffCount: number }) => r.assetId === assetId,
    );
    return rule?.minStaffCount ?? null;
  });

  async function handleAssetChange(assetId: number): Promise<void> {
    shiftsState.setSelectedContext({ assetId });
    shiftsState.setShowPlanningUI(true);
    await loadShiftPlan();
  }

  async function handleTeamChange(teamId: number) {
    shiftsState.setSelectedContext({ teamId, assetId: null });
    shiftsState.clearShiftData();
    shiftsState.setShowPlanningUI(false);

    const machs = await fetchAssets(teamId);
    shiftsState.setAssets(machs);

    if (machs.length === 0) {
      // Team ohne Anlagenzuordnung → sofort laden
      shiftsState.setShowPlanningUI(true);
      await loadShiftPlan();
    } else if (machs.length === 1) {
      // Genau eine Anlage → auto-select + sofort laden
      shiftsState.setSelectedContext({ assetId: machs[0].id });
      shiftsState.setShowPlanningUI(true);
      await loadShiftPlan();
    }
    // 2+ Anlagen → warten bis User im Dropdown wählt
  }

  async function navigateWeek(direction: number) {
    const newWeek = addWeeks(shiftsState.currentWeek, direction);
    shiftsState.setCurrentWeek(newWeek);
    await loadShiftPlan();
  }

  // --- DERIVED VALUES ---
  const weekDates = $derived(getWeekDates(shiftsState.currentWeek));
  const weekRangeText = $derived(formatWeekRange(getWeekStart(shiftsState.currentWeek)));
  const currentWeekStart = $derived(formatDate(getWeekStart(shiftsState.currentWeek)));
  const currentWeekEnd = $derived(formatDate(getWeekEnd(shiftsState.currentWeek)));

  /** Shift employees getter for template props */
  function getShiftEmployees(dateKey: string, shiftType: string): number[] {
    return shiftsState.getShiftEmployees(dateKey, shiftType);
  }

  /** Handle employee card click for swap requests */
  function handleEmployeeClick(employeeId: number, dateKey: string, shiftType: string): void {
    if (!swapEnabled || shiftsState.currentUserId === null) return;

    if (employeeId === shiftsState.currentUserId) {
      showWarningAlert('Du kannst nicht mit dir selbst tauschen');
      return;
    }

    const emp = shiftsState.getEmployeeById(employeeId);
    const empName =
      emp !== undefined ? `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim() : `#${employeeId}`;

    // Find requester's shift on the same date (any shift type)
    const allShiftKeys = Object.keys(shiftTimesMap);
    let requesterShiftType: string | null = null;
    for (const st of allShiftKeys) {
      const emps = getShiftEmployees(dateKey, st);
      if (emps.includes(shiftsState.currentUserId)) {
        requesterShiftType = st;
        break;
      }
    }

    if (requesterShiftType === null) {
      showWarningAlert('Du hast keine Schicht an diesem Tag zum Tauschen');
      return;
    }

    // Shift IDs are resolved by the backend via user+date
    swapTarget = {
      shiftId: 0,
      userId: employeeId,
      userName: empName,
      date: dateKey,
      shiftType,
      requesterShiftId: 0,
      requesterDate: dateKey,
      requesterShiftType,
    };
    showSwapModal = true;
  }
</script>

<svelte:head>
  <title>Schichtplanung - Assixx</title>
</svelte:head>

{#if permissionDenied}
  <PermissionDenied addonName="die Schichtplanung" />
{:else}
  <div class="container">
    <div class="card">
      <div class="card__header">
        <h2 class="card__title">
          <i class="fas fa-calendar-alt mr-2"></i>Schichtplanung
        </h2>
        <p class="mt-2 text-(--color-text-secondary)">Schichten planen und verwalten</p>

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
            <span class="font-medium text-(--color-text-secondary)">Dein Team:</span>
            <span class="font-semibold text-blue-400">{shiftsState.employeeTeamInfo.teamName}</span>
            <span class="font-medium text-(--color-text-secondary)">{labels.department}:</span>
            <span class="font-semibold text-blue-400"
              >{shiftsState.employeeTeamInfo.departmentName}</span
            >
            <span class="font-medium text-(--color-text-secondary)">Bereich:</span>
            <span class="font-semibold text-blue-400">{shiftsState.employeeTeamInfo.areaName}</span>
          </div>
        {/if}

        <!-- Filter Controls (for managers without auto-selected team) -->
        {#if shiftsState.isManager && shiftsState.employeeTeamInfo === null}
          <FilterDropdowns
            {labels}
            areas={shiftsState.areas}
            departments={shiftsState.departments}
            assets={shiftsState.assets}
            teams={shiftsState.teams}
            favorites={ssrFavorites}
            selectedContext={shiftsState.selectedContext}
            areaDropdownOpen={shiftsState.areaDropdownOpen}
            departmentDropdownOpen={shiftsState.departmentDropdownOpen}
            assetDropdownOpen={shiftsState.assetDropdownOpen}
            teamDropdownOpen={shiftsState.teamDropdownOpen}
            ontoggleAreaDropdown={() => {
              shiftsState.toggleAreaDropdown();
            }}
            ontoggleDepartmentDropdown={() => {
              shiftsState.toggleDepartmentDropdown();
            }}
            ontoggleAssetDropdown={() => {
              shiftsState.toggleAssetDropdown();
            }}
            ontoggleTeamDropdown={() => {
              shiftsState.toggleTeamDropdown();
            }}
            oncloseAllDropdowns={() => {
              shiftsState.closeAllDropdowns();
            }}
            onareaChange={handleAreaChange}
            ondepartmentChange={handleDepartmentChange}
            onassetChange={handleAssetChange}
            onteamChange={handleTeamChange}
            onfavoriteClick={handleFavoriteClick}
            ondeleteFavorite={handleDeleteFavorite}
            onaddToFavorites={() => handleAddToFavorites(labels)}
          />
        {/if}
      </div>
      <!-- END card__header -->

      <div class="card__body">
        <!-- Swap Consent Banner (pending requests for current user) -->
        {#if swapEnabled}
          <SwapConsentBanner
            bind:this={swapBannerRef}
            currentUserId={shiftsState.currentUserId ?? 0}
            {labels}
          />
        {/if}

        <!-- Non-manager without Team - Error Notice -->
        {#if !shiftsState.isManager && !ssrEmployeeTeamInfo}
          <div class="department-notice">
            <div class="notice-icon">
              <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h3>Kein Team zugewiesen</h3>
            <p>Du bist noch keinem Team zugeordnet. Bitte wende dich an deinen Administrator.</p>
          </div>
        {/if}

        <!-- Manager Notice (show when filters incomplete) -->
        {#if !shiftsState.showPlanningUI && shiftsState.isManager}
          <div class="department-notice">
            <div class="notice-icon"><i class="fas fa-info-circle"></i></div>
            <h3>{labels.asset} auswählen</h3>
            <p>
              Bitte wählen Sie {labels.area}, {labels.department}, {labels.team} und
              {labels.asset} aus, um den Schichtplan anzuzeigen.
            </p>
          </div>
        {/if}

        <!-- Main Planning UI -->
        {#if shiftsState.showPlanningUI}
          <!-- Legend + Navigation (full width, above grid) -->
          <ShiftScheduleLegend {labels} />
          {#if shiftsState.isManager}
            <ShiftAssignmentCounts counts={assignmentCounts} />
          {/if}
          <WeekNavigation
            {weekRangeText}
            onnavigateWeek={navigateWeek}
          />

          <!-- Main Planning Area (enthält NUR week-schedule + employee-sidebar!) -->
          <div class="main-planning-area">
            <!-- Week Schedule (Extracted Component) -->
            <ShiftScheduleGrid
              {labels}
              {weekDates}
              {shiftTimesMap}
              weeklyNotes={shiftsState.weeklyNotes}
              canEditShifts={shiftsState.canEditShifts}
              isEditMode={shiftsState.isEditMode}
              currentPlanId={shiftsState.currentPlanId}
              assetAvailabilityMap={shiftsState.assetAvailabilityMap}
              {getShiftEmployees}
              getEmployeeById={(id: number) => shiftsState.getEmployeeById(id)}
              getShiftDetail={(key: string): ShiftDetailData | undefined =>
                shiftsState.shiftDetails.get(key)}
              hasRotationShift={(key: string) => shiftsState.rotationHistoryMap.has(key)}
              ondragover={handleDragOver}
              ondragenter={handleDragEnter}
              ondragleave={handleDragLeave}
              ondrop={handleDrop}
              onremoveEmployee={removeEmployeeFromShift}
              onnotesChange={(notes: string) => {
                shiftsState.setWeeklyNotes(notes);
              }}
              onemployeeClick={swapEnabled && !shiftsState.isManager ?
                handleEmployeeClick
              : undefined}
            />

            <!-- Right Column: Controls + Sidebar -->
            <div class="sidebar-column">
              {#if shiftsState.isManager}
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
              {#if shiftsState.isManager || shiftsState.employees.length > 0}
                <EmployeeSidebar
                  {labels}
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
          </div>
          <!-- END main-planning-area -->

          <!-- Manager Actions (Extracted Component) -->
          {#if shiftsState.isManager}
            <AdminActions
              currentPatternId={shiftsState.currentPatternId}
              isPlanLocked={shiftsState.isPlanLocked}
              isEditMode={shiftsState.isEditMode}
              onreset={handleResetSchedule}
              onsave={() => handleSaveSchedule(shiftTimesMap)}
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

  <!-- Swap Request Modal -->
  {#if showSwapModal && swapTarget !== null}
    <SwapRequestModal
      targetShiftId={swapTarget.shiftId}
      targetUserId={swapTarget.userId}
      targetUserName={swapTarget.userName}
      targetShiftDate={swapTarget.date}
      targetShiftType={swapTarget.shiftType}
      requesterShiftId={swapTarget.requesterShiftId}
      requesterShiftDate={swapTarget.requesterDate}
      requesterShiftType={swapTarget.requesterShiftType}
      onclose={() => {
        showSwapModal = false;
        swapTarget = null;
      }}
      onsubmitted={() => {
        showSwapModal = false;
        swapTarget = null;
        if (swapBannerRef !== undefined) {
          void swapBannerRef.loadData();
        }
      }}
    />
  {/if}
{/if}

<style>
  /* Parent-owned styles (used directly in this template) */
  .main-planning-area {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: var(--spacing-8);
    align-items: start;
  }

  .sidebar-column {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
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
