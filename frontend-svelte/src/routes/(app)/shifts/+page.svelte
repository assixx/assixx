<script lang="ts">
  /* eslint-disable max-lines */
  // SHIFTS PAGE - Svelte 5 + SSR
  import '../../../styles/shifts.css';

  import { onMount, tick } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import type { PageData } from './$types';
  import { shiftsState } from './_lib/state.svelte';
  import {
    fetchDepartments,
    fetchMachines,
    fetchTeams,
    fetchTeamMembers,
    fetchShiftPlan,
    fetchRotationHistory,
    fetchRotationPatternById,
    generateRotationFromConfig,
    type CustomRotationAssignment,
  } from './_lib/api';
  import {
    formatWeekRange,
    getWeekStart,
    getWeekEnd,
    getWeekDates,
    formatDate,
    addWeeks,
    getEmployeeDisplayName,
    getShiftLabel,
  } from './_lib/utils';
  import type { ShiftFavorite, ShiftType, Employee } from './_lib/types';
  import {
    showSuccessAlert,
    showErrorAlert,
    showWarningAlert,
    showConfirm,
    showConfirmDanger,
  } from '$lib/utils/alerts';
  import { performAutofill } from './_lib/autofill';
  import {
    processShiftPlanResponse,
    processRotationHistory,
    convertTeamMembersToEmployees,
    convertSSRTeamMembersToEmployees,
  } from './_lib/data-loader';
  import {
    saveSchedule,
    discardWeek,
    discardTeamPlan,
    discardYearPlan,
    deleteFavoriteById,
    addToFavorites,
  } from './_lib/admin-actions';
  import {
    handleDragOverEvent,
    handleDragEnterEvent,
    handleDragLeaveEvent,
    handleDragStartEvent,
    handleDragEndEvent,
    validateDropOperation,
    addEmployeeToShiftMap,
    buildShiftDetail,
  } from './_lib/handlers';
  import RotationSetupModal from './_lib/RotationSetupModal.svelte';
  import CustomRotationModal from './_lib/CustomRotationModal.svelte';
  import type { CustomRotationConfig } from './_lib/CustomRotationModal.svelte';
  import FilterDropdowns from './_lib/FilterDropdowns.svelte';
  import ShiftScheduleGrid from './_lib/ShiftScheduleGrid.svelte';
  import EmployeeSidebar from './_lib/EmployeeSidebar.svelte';
  import AdminActions from './_lib/AdminActions.svelte';
  import ShiftControls from './_lib/ShiftControls.svelte';
  import WeekNavigation from './_lib/WeekNavigation.svelte';

  // --- SSR DATA ---
  const { data }: { data: PageData } = $props();
  const ssrUser = $derived(data?.user ?? null);
  const ssrAreas = $derived(data?.areas ?? []);
  const ssrTeams = $derived(data?.teams ?? []);
  const ssrTeamMembers = $derived(data?.teamMembers ?? []);
  const ssrFavorites = $derived(data?.favorites ?? []);
  const ssrEmployeeTeamInfo = $derived(data?.employeeTeamInfo ?? null);
  const ssrIsEmployee = $derived(data?.isEmployee ?? false);
  let ssrInitialized = $state(false);

  // --- SSR INIT ---
  $effect(() => {
    if (ssrInitialized || !ssrUser) return;
    ssrInitialized = true;

    // Initialize state from SSR data
    shiftsState.setUser(ssrUser);
    shiftsState.setAreas(ssrAreas);

    if (ssrIsEmployee && ssrEmployeeTeamInfo) {
      // Employee view - set team info and context
      shiftsState.setEmployeeTeamInfo(ssrEmployeeTeamInfo);
      shiftsState.setTeams(ssrTeams);
      shiftsState.setSelectedContext({
        areaId: ssrEmployeeTeamInfo.areaId ?? null,
        departmentId: ssrEmployeeTeamInfo.departmentId ?? null,
        teamId: ssrEmployeeTeamInfo.teamId,
        machineId: null,
        teamLeaderId: ssrEmployeeTeamInfo.teamLeaderId ?? null,
      });
      shiftsState.setEmployees(convertSSRTeamMembersToEmployees(ssrTeamMembers));
      shiftsState.setShowPlanningUI(true);
    }
    // Note: favorites now use ssrFavorites directly via $derived + invalidateAll()

    shiftsState.setIsLoading(false);
  });

  // --- ROTATION HELPER ---
  function navigateToWeekContainingDate(dateStr: string): void {
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- Date passed directly to setter, not stored reactively
    const monday = new Date(date);
    monday.setDate(date.getDate() + diff);
    shiftsState.setCurrentWeek(monday);
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    // If click is not inside any dropdown, close all
    if (!target.closest('.dropdown')) {
      shiftsState.closeAllDropdowns();
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    if (ssrIsEmployee && ssrEmployeeTeamInfo?.teamId) {
      loadShiftPlan().catch(() => {});
    }
    return () => document.removeEventListener('click', handleClickOutside);
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

    // Load departments for selected area
    const depts = await fetchDepartments(areaId);
    shiftsState.setDepartments(depts);

    // Reset machines and teams
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

    // Load machines and teams for selected department
    const [machs, tms] = await Promise.all([
      fetchMachines(departmentId, shiftsState.selectedContext.areaId),
      fetchTeams(departmentId),
    ]);
    shiftsState.setMachines(machs);
    shiftsState.setTeams(tms);
  }

  async function handleMachineChange(machineId: number) {
    shiftsState.setSelectedContext({ machineId });
  }

  async function handleTeamChange(teamId: number) {
    shiftsState.setSelectedContext({ teamId });
    const members = await fetchTeamMembers(teamId);
    shiftsState.setEmployees(convertTeamMembersToEmployees(members));
    shiftsState.setShowPlanningUI(true);
    await loadShiftPlan();
  }

  async function navigateWeek(direction: number) {
    const newWeek = addWeeks(shiftsState.currentWeek, direction);
    shiftsState.setCurrentWeek(newWeek);
    await loadShiftPlan();
  }

  async function loadShiftPlan() {
    if (shiftsState.selectedContext.teamId === null) return;

    // PERFORMANCE: Set loading state to prevent FOUC/flickering
    console.info('[LOAD] Starting loadShiftPlan - isLoading: true');
    shiftsState.setIsLoading(true);

    // CRITICAL: Force DOM update BEFORE API calls start
    // Without this, Svelte batches updates and loading style is never visible
    await tick();
    console.info('[LOAD] DOM updated with loading state');

    const weekStart = getWeekStart(shiftsState.currentWeek);
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- Local calculation variable
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const startDate = formatDate(weekStart);
    const endDate = formatDate(weekEnd);

    console.info('[LOAD] Fetching data for week:', startDate, '-', endDate);

    try {
      // 1. PARALLEL API Calls (plan + rotation history at the same time)
      const [planResponse, rotationHistory] = await Promise.all([
        fetchShiftPlan(startDate, endDate, {
          teamId: shiftsState.selectedContext.teamId,
          departmentId: shiftsState.selectedContext.departmentId,
          areaId: shiftsState.selectedContext.areaId,
          machineId: shiftsState.selectedContext.machineId,
        }),
        fetchRotationHistory(startDate, endDate, shiftsState.selectedContext.teamId),
      ]);

      console.info(
        '[LOAD] API responses received - plan:',
        !!planResponse,
        'history:',
        rotationHistory.length,
      );

      // 2. Process data (no state updates yet - batch at the end)
      const planData = processShiftPlanResponse(planResponse);
      const rotationData = processRotationHistory(
        rotationHistory,
        planData.weeklyShifts,
        planData.shiftDetails,
        shiftsState.employees,
      );

      // 3. Load pattern type if rotation history exists
      let patternId: number | null = null;
      let patternType: typeof shiftsState.currentPatternType = null;

      if (rotationHistory.length > 0) {
        const firstEntry = rotationHistory[0];
        if (
          firstEntry !== undefined &&
          'patternId' in firstEntry &&
          firstEntry.patternId !== undefined
        ) {
          const pattern = await fetchRotationPatternById(firstEntry.patternId as number);
          if (pattern !== null) {
            patternId = pattern.id;
            patternType = pattern.patternType;
            console.info('[TOGGLE SYNC] Pattern loaded:', pattern.patternType);
          }
        }
      }

      // 4. Calculate lock state BEFORE applying state updates
      const hasAnyShiftData = rotationData.weeklyShifts.size > 0;
      const shouldLock = hasAnyShiftData && !shiftsState.isEditMode;

      console.info(
        '[LOAD] Applying batch state updates - shifts:',
        rotationData.weeklyShifts.size,
        'locked:',
        shouldLock,
      );

      // 5. BATCH ALL STATE UPDATES (single re-render)
      // This prevents flickering by updating everything at once
      shiftsState.setCurrentPlanId(planData.planId);
      shiftsState.setCurrentShiftNotes(planData.shiftNotes);
      shiftsState.setWeeklyNotes(planData.shiftNotes);
      shiftsState.setWeeklyShifts(rotationData.weeklyShifts);
      shiftsState.setShiftDetails(rotationData.shiftDetails);
      shiftsState.setRotationHistoryMap(rotationData.rotationHistoryMap);
      shiftsState.setCurrentPatternId(patternId);
      shiftsState.setCurrentPatternType(patternType);
      shiftsState.setIsPlanLocked(shouldLock);
      if (shouldLock) shiftsState.setIsEditMode(false);

      // 6. Sync rotation toggles (uses already-set state)
      syncRotationToggles();

      // Clear if nothing loaded
      if (planResponse === null && rotationHistory.length === 0) {
        console.info('[LOAD] No data found - clearing shift data');
        shiftsState.clearShiftData();
      }

      console.info('[LOAD] Complete - isLoading: false');
    } finally {
      // ALWAYS turn off loading, even on error
      shiftsState.setIsLoading(false);
    }
  }

  /**
   * Sync rotation toggles based on current pattern type and shift data
   * Legacy: lock-mode.ts syncRotationToggles()
   */
  function syncRotationToggles() {
    const patternType = shiftsState.currentPatternType;
    const hasShiftData = shiftsState.weeklyShifts.size > 0;
    const isLocked = shiftsState.isPlanLocked;

    console.info(
      '[TOGGLE SYNC] patternType:',
      patternType,
      'isLocked:',
      isLocked,
      'hasShiftData:',
      hasShiftData,
    );

    // Standard toggle ON wenn: hasShiftData UND (patternType === 'alternate_fs' || patternType === 'fixed_n')
    const isStandard =
      hasShiftData && (patternType === 'alternate_fs' || patternType === 'fixed_n');
    // Custom toggle ON wenn: hasShiftData UND patternType === 'custom'
    const isCustom = hasShiftData && patternType === 'custom';

    // Directly set the toggle states (bypassing modal open logic)
    shiftsState.setStandardRotationEnabledDirect(isStandard);
    shiftsState.setCustomRotationEnabledDirect(isCustom);

    console.info(
      '[TOGGLE SYNC] Standard toggle:',
      isStandard ? 'ON' : 'OFF',
      'disabled:',
      isLocked,
    );
    console.info('[TOGGLE SYNC] Custom toggle:', isCustom ? 'ON' : 'OFF', 'disabled:', isLocked);
  }

  async function handleFavoriteClick(favorite: ShiftFavorite) {
    const [depts, machs, tms, members] = await Promise.all([
      fetchDepartments(favorite.areaId),
      fetchMachines(favorite.departmentId, favorite.areaId),
      fetchTeams(favorite.departmentId),
      fetchTeamMembers(favorite.teamId),
    ]);

    shiftsState.setDepartments(depts);
    shiftsState.setMachines(machs);
    shiftsState.setTeams(tms);

    const teamLeaderId = tms.find((t) => t.id === favorite.teamId)?.leaderId ?? null;
    shiftsState.setSelectedContext({
      areaId: favorite.areaId,
      departmentId: favorite.departmentId,
      machineId: favorite.machineId,
      teamId: favorite.teamId,
      teamLeaderId,
    });

    shiftsState.setEmployees(convertTeamMembersToEmployees(members));
    shiftsState.setShowPlanningUI(true);
    await loadShiftPlan();
  }

  // --- DRAG AND DROP ---
  const handleDragStart = (event: DragEvent, employeeId: number) =>
    handleDragStartEvent(
      event,
      employeeId,
      !shiftsState.canEditShifts || (shiftsState.currentPlanId !== null && !shiftsState.isEditMode),
      () => shiftsState.setIsDragging(true),
    );

  const handleDragEnd = () => handleDragEndEvent(() => shiftsState.setIsDragging(false));
  const handleDragOver = (event: DragEvent) =>
    handleDragOverEvent(event, shiftsState.canEditShifts);

  const handleDragEnter = (event: DragEvent) =>
    handleDragEnterEvent(event, shiftsState.canEditShifts);

  const handleDragLeave = (event: DragEvent) => handleDragLeaveEvent(event);

  function handleDrop(event: DragEvent, dateKey: string, shiftType: string) {
    event.preventDefault();
    shiftsState.setIsDragging(false);

    const target = event.target as HTMLElement;
    const shiftCell = target.closest('.shift-cell') as HTMLElement | null;
    shiftCell?.classList.remove('drag-over');

    if (!shiftsState.canEditShifts) return;

    const employeeIdStr = event.dataTransfer?.getData('text/plain');
    if (employeeIdStr === undefined || employeeIdStr === '') return;

    const employeeId = parseInt(employeeIdStr, 10);
    if (isNaN(employeeId)) return;

    // Validation using extracted handler
    const validation = validateDropOperation(
      employeeId,
      dateKey,
      shiftType,
      shiftsState.employees,
      getShiftEmployees,
    );

    if (!validation.valid) {
      if (validation.warning !== undefined) {
        showWarningAlert(validation.warning);
      } else if (validation.error !== undefined) {
        showErrorAlert(validation.error);
      }
      return;
    }

    // Assignment using extracted handlers
    const employee = shiftsState.getEmployeeById(employeeId)!;
    const updatedShifts = addEmployeeToShiftMap(
      dateKey,
      shiftType,
      employeeId,
      shiftsState.weeklyShifts,
    );
    shiftsState.setWeeklyShifts(updatedShifts);

    // Add shift details using extracted helper
    const detailKey = `${dateKey}_${shiftType}_${employeeId}`;
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- Immutable copy for state update
    const newDetails = new Map(shiftsState.shiftDetails);
    newDetails.set(detailKey, buildShiftDetail(employee, dateKey, shiftType));
    shiftsState.setShiftDetails(newDetails);

    const employeeName = getEmployeeDisplayName(employee);
    const shiftLabel = getShiftLabel(shiftType as ShiftType);
    showSuccessAlert(`${employeeName} zur ${shiftLabel} hinzugefügt`);
    const dayName = shiftCell?.dataset['day'];
    if (dayName !== undefined && shiftsState.autofillConfig.enabled) {
      executeAutofill(employeeId, employee, dayName, shiftType as ShiftType, shiftLabel);
    }
  }

  /** Helper for autofill execution - reduces handleDrop size */
  function executeAutofill(
    employeeId: number,
    employee: Employee,
    dayName: string,
    shiftType: ShiftType,
    shiftLabel: string,
  ) {
    const addAssignment = (date: string, shift: ShiftType, empId: number) => {
      const shifts = shiftsState.weeklyShifts;
      if (!shifts.has(date)) shifts.set(date, new Map());
      const dayShifts = shifts.get(date)!;
      if (!dayShifts.has(shift)) dayShifts.set(shift, []);
      const empsInShift = dayShifts.get(shift)!;
      if (!empsInShift.includes(empId)) empsInShift.push(empId);

      const emp = shiftsState.getEmployeeById(empId);
      if (emp !== undefined) {
        // eslint-disable-next-line svelte/prefer-svelte-reactivity -- Immutable copy for state update
        const details = new Map(shiftsState.shiftDetails);
        details.set(`${date}_${shift}_${empId}`, buildShiftDetail(emp, date, shift));
        shiftsState.setShiftDetails(details);
      }
    };

    const autofillResult = performAutofill(
      employeeId,
      employee,
      dayName,
      shiftType,
      weekDates,
      shiftsState.autofillConfig,
      getShiftEmployees,
      shiftsState.weeklyShifts,
      addAssignment,
    );

    shiftsState.setWeeklyShifts(new Map(shiftsState.weeklyShifts));

    if (autofillResult.filled > 0) {
      showSuccessAlert(
        `Autofill: ${autofillResult.filled} weitere Tage mit ${shiftLabel} ausgefüllt`,
      );
    }
  }

  function removeEmployeeFromShift(dateKey: string, shiftType: string, employeeId: number) {
    shiftsState.removeShiftAssignment(dateKey, shiftType, employeeId);
    showSuccessAlert('Schicht-Zuweisung entfernt');
  }

  const weekDates = $derived(getWeekDates(shiftsState.currentWeek));
  const weekRangeText = $derived(formatWeekRange(getWeekStart(shiftsState.currentWeek)));

  // Pre-computed week dates for modals (formatted as YYYY-MM-DD)
  const currentWeekStart = $derived(formatDate(getWeekStart(shiftsState.currentWeek)));
  const currentWeekEnd = $derived(formatDate(getWeekEnd(shiftsState.currentWeek)));

  function getShiftEmployees(dateKey: string, shiftType: string): number[] {
    const dayShifts = shiftsState.weeklyShifts.get(dateKey);
    if (dayShifts === undefined) return [];
    return dayShifts.get(shiftType) ?? [];
  }

  function handleResetSchedule() {
    if (shiftsState.isEditMode) {
      shiftsState.setIsEditMode(false);
      loadShiftPlan();
    } else {
      shiftsState.clearShiftData();
    }
  }

  async function handleSaveSchedule() {
    shiftsState.setIsLoading(true);
    try {
      const result = await saveSchedule({
        weeklyShifts: shiftsState.weeklyShifts,
        weeklyNotes: shiftsState.weeklyNotes,
        currentWeek: shiftsState.currentWeek,
        currentPlanId: shiftsState.currentPlanId,
        selectedContext: shiftsState.selectedContext,
        teams: shiftsState.teams,
      });
      if (shiftsState.currentPlanId === null && result.planId !== undefined)
        shiftsState.setCurrentPlanId(result.planId);
      shiftsState.setIsEditMode(false);
      shiftsState.setIsPlanLocked(true);
      showSuccessAlert('Schichtplan erfolgreich gespeichert!');
    } catch {
      showErrorAlert('Fehler beim Speichern des Schichtplans.');
    } finally {
      shiftsState.setIsLoading(false);
    }
  }

  async function handleDiscardWeek() {
    const confirmed = await showConfirmDanger(
      'Möchten Sie wirklich alle Schichten dieser Woche löschen?\n\n⚠️ Die Daten sind unwiderruflich weg!',
      'Woche verwerfen',
    );
    if (!confirmed) return;
    const teamId = shiftsState.selectedContext.teamId;
    if (teamId === null) return;
    shiftsState.setIsLoading(true);
    try {
      await discardWeek({ teamId, currentWeek: shiftsState.currentWeek });
      shiftsState.setIsEditMode(false); // Reset edit mode after discard
      shiftsState.clearShiftData();
      await loadShiftPlan();
    } catch {
      showErrorAlert('Fehler beim Verwerfen der Woche.');
    } finally {
      shiftsState.setIsLoading(false);
    }
  }

  async function handleDiscardTeamPlan() {
    const teamId = shiftsState.selectedContext.teamId;
    const patternId = shiftsState.currentPatternId;

    // Must have a pattern to delete
    if (teamId === null || patternId === null) {
      showWarningAlert('Kein Rotationsmuster zum Löschen vorhanden.');
      return;
    }

    const confirmed = await showConfirmDanger(
      'Möchten Sie dieses Rotationsmuster löschen?\n\n⚠️ Alle zugehörigen Schichten werden unwiderruflich gelöscht!\n\nAndere Rotationsmuster bleiben erhalten.',
      'Rotationsmuster löschen',
    );
    if (!confirmed) return;

    shiftsState.setIsLoading(true);
    try {
      // Backend deletes ONLY this specific pattern (not other patterns!)
      await discardTeamPlan({ teamId, patternId });
      shiftsState.clearShiftData();
      shiftsState.setCurrentPlanId(null);
      shiftsState.setCurrentPatternId(null);
      shiftsState.setCurrentPatternType(null);
      shiftsState.setIsEditMode(false);
      shiftsState.setIsPlanLocked(false);
    } catch {
      showErrorAlert('Fehler beim Verwerfen des Rotationsmusters.');
    } finally {
      shiftsState.setIsLoading(false);
    }
  }

  async function handleDiscardYearPlan() {
    const teamId = shiftsState.selectedContext.teamId;
    if (teamId === null) {
      showWarningAlert('Kein Team ausgewählt.');
      return;
    }

    const currentYear = new Date().getFullYear();
    const confirmed = await showConfirmDanger(
      `⚠️ ACHTUNG: KOMPLETTER RESET!\n\nSie löschen ALLE Rotationspläne für dieses Team.\n\n` +
        `Dies betrifft ALLE Schichten des Teams für ${currentYear}!\n\n` +
        `Andere Teams sind NICHT betroffen.\n\n` +
        `Diese Aktion kann NICHT rückgängig gemacht werden!`,
      `Kompletten Plan löschen (${currentYear})`,
    );
    if (!confirmed) return;

    shiftsState.setIsLoading(true);
    try {
      // Backend deletes EVERYTHING for this team
      await discardYearPlan({ teamId });
      shiftsState.clearShiftData();
      shiftsState.setCurrentPlanId(null);
      shiftsState.setCurrentPatternId(null);
      shiftsState.setCurrentPatternType(null);
      shiftsState.setIsEditMode(false);
      shiftsState.setIsPlanLocked(false);
      showSuccessAlert('Alle Rotationspläne wurden gelöscht.');
    } catch {
      showErrorAlert('Fehler beim Löschen der Rotationspläne.');
    } finally {
      shiftsState.setIsLoading(false);
    }
  }

  async function handleDeleteFavorite(favoriteId: number, event: MouseEvent) {
    event.stopPropagation();
    if (!(await showConfirm('Möchten Sie diesen Favoriten wirklich löschen?'))) return;
    try {
      await deleteFavoriteById(favoriteId);
      await invalidateAll(); // Refresh SSR data
      showSuccessAlert('Favorit wurde gelöscht.');
    } catch {
      showErrorAlert('Fehler beim Löschen des Favoriten.');
    }
  }

  async function handleAddToFavorites() {
    const { areaId, departmentId, teamId } = shiftsState.selectedContext;
    if (areaId === null || departmentId === null || teamId === null) {
      return showWarningAlert(
        'Bitte wählen Sie zuerst einen Bereich, eine Abteilung und ein Team aus.',
      );
    }
    try {
      const newFavorite = await addToFavorites({
        selectedContext: shiftsState.selectedContext,
        areas: shiftsState.areas,
        departments: shiftsState.departments,
        machines: shiftsState.machines,
        teams: shiftsState.teams,
      });
      if (newFavorite !== null) {
        await invalidateAll(); // Refresh SSR data
        showSuccessAlert(`Favorit erfolgreich gespeichert!`);
      } else {
        showErrorAlert('Fehler beim Laden der Daten.');
      }
    } catch {
      showErrorAlert('Fehler beim Speichern des Favoriten.');
    }
  }

  /**
   * Handle custom rotation generation
   * Uses single endpoint with full algorithm (matches legacy custom-rotation.ts)
   */
  async function handleCustomRotationGenerate(config: CustomRotationConfig) {
    const teamId = shiftsState.selectedContext.teamId;
    const departmentId = shiftsState.selectedContext.departmentId;
    if (teamId === null) {
      showErrorAlert('Kein Team ausgewählt');
      return;
    }

    console.info('[CUSTOM ROTATION] Starting generation:', config);

    try {
      // 1. Build algorithm config (matches legacy format)
      const sequenceArray = config.shiftSequence.split('-') as ('early' | 'late' | 'night')[];
      const weekdayNames = [
        'Sonntag',
        'Montag',
        'Dienstag',
        'Mittwoch',
        'Donnerstag',
        'Freitag',
        'Samstag',
      ];

      const algorithmConfig = {
        shiftBlockLength: config.shiftBlockLength,
        freeDays: config.freeDays,
        startShift: config.startShift,
        shiftSequence: sequenceArray,
        specialRules: config.nthWeekdayFree
          ? [
              {
                type: 'nth_weekday_free' as const,
                name: `Jeder ${config.nthValue}. ${weekdayNames[config.weekdayValue]} frei`,
                weekday: config.weekdayValue,
                n: config.nthValue,
              },
            ]
          : undefined,
      };

      // 2. Build employee assignments with userName and startGroup (CRITICAL!)
      // Map: 'F' | 'S' | 'N' → employeeIds[]
      // Output: { userId, userName, startGroup }[]
      const assignments: CustomRotationAssignment[] = [];
      for (const [shiftGroup, userIds] of config.employeeAssignments) {
        // shiftGroup is 'F', 'S', or 'N' - this is the startGroup!
        const startGroup = shiftGroup as 'F' | 'S' | 'N';
        for (const userId of userIds) {
          const employee = shiftsState.getEmployeeById(userId);
          if (employee !== undefined) {
            assignments.push({
              userId,
              userName: getEmployeeDisplayName(employee),
              startGroup,
            });
          }
        }
      }

      if (assignments.length === 0) {
        showErrorAlert('Bitte weisen Sie mindestens einem Mitarbeiter eine Schichtgruppe zu.');
        return;
      }

      console.info('[CUSTOM ROTATION] Algorithm config:', algorithmConfig);
      console.info('[CUSTOM ROTATION] Assignments:', assignments);

      // 3. Call SINGLE endpoint (matches legacy callGenerateRotationAPI)
      const result = await generateRotationFromConfig({
        config: algorithmConfig,
        assignments,
        startDate: config.startDate,
        endDate: config.endDate,
        teamId,
        departmentId: departmentId ?? undefined,
      });

      console.info('[CUSTOM ROTATION] Result:', result);

      // 4. Close modal and reload
      shiftsState.setShowCustomRotationModal(false);
      showSuccessAlert(`Custom Rotation erstellt! ${result.shiftsCreated} Schichten generiert.`);

      // 5. Navigate to start date and reload
      navigateToWeekContainingDate(config.startDate);
      void loadShiftPlan();
    } catch (error) {
      console.error('[CUSTOM ROTATION] Error:', error);
      showErrorAlert(error instanceof Error ? error.message : 'Fehler bei der Custom Rotation');
    }
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
      <p class="mt-2 text-[var(--color-text-secondary)]">Schichten planen und verwalten</p>

      <!-- Loading Overlay (Design System) - ONLY during initial load, NOT during week changes -->
      {#if shiftsState.isLoading && !shiftsState.showPlanningUI}
        <div class="flex items-center justify-center py-12 gap-3">
          <div class="spinner-ring spinner-ring--lg"></div>
          <span class="text-[var(--color-text-secondary)]">Laden...</span>
        </div>
      {/if}

      <!-- Employee Team Info Bar (for employee view) - Design System Badges -->
      {#if shiftsState.employeeTeamInfo !== null}
        <div
          class="flex flex-wrap items-center gap-3 mt-4 p-4 rounded-xl border border-[rgba(255,152,0,0.3)] bg-[rgba(255,152,0,0.1)]"
          role="status"
        >
          <i class="fas fa-users text-[var(--color-warning)]"></i>
          <span class="font-medium text-[var(--color-warning)]">Dein Team:</span>
          <span class="badge badge--primary">{shiftsState.employeeTeamInfo.teamName}</span>
          <span class="text-[var(--color-text-secondary)]">|</span>
          <span class="font-medium text-[var(--color-warning)]">Abteilung:</span>
          <span class="badge badge--info">{shiftsState.employeeTeamInfo.departmentName}</span>
          <span class="text-[var(--color-text-secondary)]">|</span>
          <span class="font-medium text-[var(--color-warning)]">Bereich:</span>
          <span class="badge badge--info">{shiftsState.employeeTeamInfo.areaName}</span>
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
          ontoggleAreaDropdown={() => shiftsState.toggleAreaDropdown()}
          ontoggleDepartmentDropdown={() => shiftsState.toggleDepartmentDropdown()}
          ontoggleMachineDropdown={() => shiftsState.toggleMachineDropdown()}
          ontoggleTeamDropdown={() => shiftsState.toggleTeamDropdown()}
          oncloseAllDropdowns={() => shiftsState.closeAllDropdowns()}
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
          <div class="notice-icon"><i class="fas fa-exclamation-triangle"></i></div>
          <h3>Kein Team zugewiesen</h3>
          <p>Du bist noch keinem Team zugeordnet. Bitte wende dich an deinen Administrator.</p>
        </div>
      {/if}

      <!-- Admin Notice (show when no team selected) -->
      {#if !shiftsState.showPlanningUI && shiftsState.isAdmin}
        <div class="department-notice">
          <div class="notice-icon"><i class="fas fa-info-circle"></i></div>
          <h3>Team auswählen</h3>
          <p>
            Bitte wählen Sie einen Bereich, eine Abteilung und ein Team aus, um den Schichtplan
            anzuzeigen.
          </p>
        </div>
      {/if}

      <!-- Main Planning UI -->
      {#if shiftsState.showPlanningUI}
        <!-- Week Navigation -->
        <WeekNavigation {weekRangeText} onnavigateWeek={navigateWeek} />

        <!-- Shift Control Toggles (Admin Only) -->
        {#if shiftsState.isAdmin}
          <ShiftControls
            autofillConfig={shiftsState.autofillConfig}
            standardRotationEnabled={shiftsState.standardRotationEnabled}
            customRotationEnabled={shiftsState.customRotationEnabled}
            isPlanLocked={shiftsState.isPlanLocked}
            onautofillChange={(enabled) => shiftsState.setAutofillConfig({ enabled })}
            onstandardRotationChange={(enabled) => shiftsState.setStandardRotationEnabled(enabled)}
            oncustomRotationChange={(enabled) => shiftsState.setCustomRotationEnabled(enabled)}
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
            {getShiftEmployees}
            getEmployeeById={(id) => shiftsState.getEmployeeById(id)}
            getShiftDetail={(key) => shiftsState.shiftDetails.get(key)}
            hasRotationShift={(key) => shiftsState.rotationHistoryMap.has(key)}
            ondragover={handleDragOver}
            ondragenter={handleDragEnter}
            ondragleave={handleDragLeave}
            ondrop={handleDrop}
            onremoveEmployee={removeEmployeeFromShift}
            onnotesChange={(notes) => shiftsState.setWeeklyNotes(notes)}
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
            onenterEditMode={() => shiftsState.setIsEditMode(true)}
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
    oncomplete={(startDate) => {
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
