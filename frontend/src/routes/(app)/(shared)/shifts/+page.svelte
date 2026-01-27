<script lang="ts">
  // SHIFTS PAGE - Svelte 5 + SSR
  import '../../../../styles/shifts.css';

  import { onMount, tick } from 'svelte';

  import { invalidateAll } from '$app/navigation';

  import {
    showSuccessAlert,
    showErrorAlert,
    showWarningAlert,
    showConfirm,
    showConfirmDanger,
  } from '$lib/utils/alerts';
  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('ShiftsPage');

  import {
    saveSchedule,
    discardWeek,
    discardTeamPlan,
    discardYearPlan,
    deleteFavoriteById,
    addToFavorites,
  } from './_lib/admin-actions';
  import AdminActions from './_lib/AdminActions.svelte';
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
  import { performAutofill } from './_lib/autofill';
  import CustomRotationModal from './_lib/CustomRotationModal.svelte';
  import {
    processShiftPlanResponse,
    processRotationHistory,
    convertTeamMembersToEmployees,
    convertSSRTeamMembersToEmployees,
    getWeekDateBounds,
    loadPatternFromHistory,
  } from './_lib/data-loader';
  import { getEmployeeIdFromDrag } from './_lib/drag-drop';
  import EmployeeSidebar from './_lib/EmployeeSidebar.svelte';
  import FilterDropdowns from './_lib/FilterDropdowns.svelte';
  import {
    handleDragOverEvent,
    handleDragEnterEvent,
    handleDragLeaveEvent,
    handleDragStartEvent,
    handleDragEndEvent,
    validateDropOperation,
    addEmployeeToShiftMap,
    buildShiftDetail,
    type DropValidationResult,
  } from './_lib/handlers';
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
    getEmployeeDisplayName,
    getShiftLabel,
  } from './_lib/utils';
  import WeekNavigation from './_lib/WeekNavigation.svelte';

  import type { PageData } from './$types';
  import type {
    ShiftFavorite,
    ShiftType,
    Employee,
    CustomRotationConfig,
  } from './_lib/types';

  // --- SSR DATA ---
  const { data }: { data: PageData } = $props();
  const ssrUser = $derived(data.user);
  const ssrAreas = $derived(data.areas);
  const ssrTeams = $derived(data.teams);
  const ssrTeamMembers = $derived(data.teamMembers);
  const ssrFavorites = $derived(data.favorites);
  const ssrEmployeeTeamInfo = $derived(data.employeeTeamInfo);
  const ssrIsEmployee = $derived(data.isEmployee);
  let ssrInitialized = $state(false);

  // --- SSR INIT ---
  $effect(() => {
    if (ssrInitialized) return;
    ssrInitialized = true;

    // Initialize state from SSR data
    shiftsState.setUser(ssrUser);
    shiftsState.setAreas(ssrAreas);

    if (ssrIsEmployee && ssrEmployeeTeamInfo) {
      // Employee view - set team info and context
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
    if (
      ssrIsEmployee &&
      ssrEmployeeTeamInfo !== null &&
      ssrEmployeeTeamInfo.teamId !== 0
    ) {
      void loadShiftPlan();
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
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

  function handleMachineChange(machineId: number): void {
    shiftsState.setSelectedContext({ machineId });
  }

  async function handleTeamChange(teamId: number) {
    shiftsState.setSelectedContext({ teamId });
    // Pass date range to get availability for the current week view
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

  async function loadShiftPlan(): Promise<void> {
    if (shiftsState.selectedContext.teamId === null) return;

    shiftsState.setIsLoading(true);
    await tick(); // Force DOM update BEFORE API calls

    const { startDate, endDate } = getWeekDateBounds(shiftsState.currentWeek);

    try {
      // Reload team members with new date range to update availability status
      const teamId = shiftsState.selectedContext.teamId;
      const [
        members,
        { planResponse, rotationHistory, planData, rotationData },
      ] = await Promise.all([
        fetchTeamMembers(teamId, startDate, endDate),
        fetchAndProcessShiftData(startDate, endDate),
      ]);

      // Update employees with fresh availability data for this week
      shiftsState.setEmployees(convertTeamMembersToEmployees(members));

      // Load pattern type from rotation history
      const { patternId, patternType } = await loadPatternFromHistory(
        rotationHistory,
        fetchRotationPatternById,
      );

      // Apply all state updates
      applyShiftPlanState(planData, rotationData, patternId, patternType);

      // Clear if nothing loaded
      if (planResponse === null && rotationHistory.length === 0) {
        shiftsState.clearShiftData();
      }
    } finally {
      shiftsState.setIsLoading(false);
    }
  }

  /** Fetch shift plan and rotation history, then process both */
  async function fetchAndProcessShiftData(startDate: string, endDate: string) {
    const [planResponse, rotationHistory] = await Promise.all([
      fetchShiftPlan(startDate, endDate, {
        teamId: shiftsState.selectedContext.teamId,
        departmentId: shiftsState.selectedContext.departmentId,
        areaId: shiftsState.selectedContext.areaId,
        machineId: shiftsState.selectedContext.machineId,
      }),
      fetchRotationHistory(
        startDate,
        endDate,
        shiftsState.selectedContext.teamId,
      ),
    ]);

    const planData = processShiftPlanResponse(planResponse);
    const rotationData = processRotationHistory(
      rotationHistory,
      planData.weeklyShifts,
      planData.shiftDetails,
      shiftsState.employees,
    );

    return { planResponse, rotationHistory, planData, rotationData };
  }

  /** Apply processed shift data to state (batched updates) */
  function applyShiftPlanState(
    planData: ReturnType<typeof processShiftPlanResponse>,
    rotationData: ReturnType<typeof processRotationHistory>,
    patternId: number | null,
    patternType: typeof shiftsState.currentPatternType,
  ): void {
    const hasAnyShiftData = rotationData.weeklyShifts.size > 0;
    const shouldLock = hasAnyShiftData && !shiftsState.isEditMode;

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

    syncRotationToggles();
  }

  /**
   * Sync rotation toggles based on current pattern type and shift data
   * Legacy: lock-mode.ts syncRotationToggles()
   */
  function syncRotationToggles(): void {
    const patternType = shiftsState.currentPatternType;
    const hasShiftData = shiftsState.weeklyShifts.size > 0;

    // Standard toggle ON wenn: hasShiftData UND (patternType === 'alternate_fs' || patternType === 'fixed_n')
    const isStandard =
      hasShiftData &&
      (patternType === 'alternate_fs' || patternType === 'fixed_n');
    // Custom toggle ON wenn: hasShiftData UND patternType === 'custom'
    const isCustom = hasShiftData && patternType === 'custom';

    // Directly set the toggle states (bypassing modal open logic)
    shiftsState.setStandardRotationEnabledDirect(isStandard);
    shiftsState.setCustomRotationEnabledDirect(isCustom);
  }

  async function handleFavoriteClick(favorite: ShiftFavorite) {
    // Get date range for availability filtering
    const { startDate, endDate } = getWeekDateBounds(shiftsState.currentWeek);

    const [depts, machs, tms, members] = await Promise.all([
      fetchDepartments(favorite.areaId),
      fetchMachines(favorite.departmentId, favorite.areaId),
      fetchTeams(favorite.departmentId),
      fetchTeamMembers(favorite.teamId, startDate, endDate),
    ]);

    shiftsState.setDepartments(depts);
    shiftsState.setMachines(machs);
    shiftsState.setTeams(tms);

    const teamLeaderId =
      tms.find((t) => t.id === favorite.teamId)?.leaderId ?? null;
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
  const handleDragStart = (event: DragEvent, employeeId: number) => {
    handleDragStartEvent(
      event,
      employeeId,
      !shiftsState.canEditShifts ||
        (shiftsState.currentPlanId !== null && !shiftsState.isEditMode),
      () => {
        shiftsState.setIsDragging(true);
      },
    );
  };

  const handleDragEnd = () => {
    handleDragEndEvent(() => {
      shiftsState.setIsDragging(false);
    });
  };
  const handleDragOver = (event: DragEvent) => {
    handleDragOverEvent(event, shiftsState.canEditShifts);
  };

  const handleDragEnter = (event: DragEvent) => {
    handleDragEnterEvent(event, shiftsState.canEditShifts);
  };

  const handleDragLeave = (event: DragEvent) => {
    handleDragLeaveEvent(event);
  };

  /** Display validation feedback to user - reduces handleDrop complexity */
  function showValidationFeedback(validation: DropValidationResult): void {
    if (validation.warning !== undefined) {
      showWarningAlert(validation.warning);
    } else if (validation.error !== undefined) {
      showErrorAlert(validation.error);
    }
  }

  /** Perform shift assignment and update state */
  function assignEmployeeToShift(
    employeeId: number,
    employee: Employee,
    dateKey: string,
    shiftType: string,
  ): void {
    const updatedShifts = addEmployeeToShiftMap(
      dateKey,
      shiftType,
      employeeId,
      shiftsState.weeklyShifts,
    );
    shiftsState.setWeeklyShifts(updatedShifts);

    const detailKey = `${dateKey}_${shiftType}_${employeeId}`;
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- Immutable copy for state update
    const newDetails = new Map(shiftsState.shiftDetails);
    newDetails.set(detailKey, buildShiftDetail(employee, dateKey, shiftType));
    shiftsState.setShiftDetails(newDetails);
  }

  function handleDrop(
    event: DragEvent,
    dateKey: string,
    shiftType: string,
  ): void {
    event.preventDefault();
    shiftsState.setIsDragging(false);

    const target = event.target as HTMLElement;
    const shiftCell = target.closest<HTMLElement>('.shift-cell');
    shiftCell?.classList.remove('drag-over');

    if (!shiftsState.canEditShifts) return;

    const employeeId = getEmployeeIdFromDrag(event.dataTransfer);
    if (employeeId === null) return;

    const validation = validateDropOperation(
      employeeId,
      dateKey,
      shiftType,
      shiftsState.employees,
      getShiftEmployees,
    );

    if (!validation.valid) {
      showValidationFeedback(validation);
      return;
    }

    const employee = shiftsState.getEmployeeById(employeeId);
    if (employee === undefined) {
      log.error({ employeeId }, 'Employee not found on drop');
      return;
    }

    assignEmployeeToShift(employeeId, employee, dateKey, shiftType);

    const employeeName = getEmployeeDisplayName(employee);
    const shiftLabel = getShiftLabel(shiftType as ShiftType);
    showSuccessAlert(`${employeeName} zur ${shiftLabel} hinzugefügt`);

    const dayName = shiftCell?.dataset.day;
    if (dayName !== undefined && shiftsState.autofillConfig.enabled) {
      executeAutofill(
        employeeId,
        employee,
        dayName,
        shiftType as ShiftType,
        shiftLabel,
      );
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
      let dayShifts = shifts.get(date);
      if (dayShifts === undefined) {
        // eslint-disable-next-line svelte/prefer-svelte-reactivity -- Nested data structure, parent state handles reactivity
        dayShifts = new Map();
        shifts.set(date, dayShifts);
      }
      let empsInShift = dayShifts.get(shift);
      if (empsInShift === undefined) {
        empsInShift = [];
        dayShifts.set(shift, empsInShift);
      }
      if (!empsInShift.includes(empId)) empsInShift.push(empId);

      const emp = shiftsState.getEmployeeById(empId);
      if (emp !== undefined) {
        // eslint-disable-next-line svelte/prefer-svelte-reactivity -- Immutable copy for state update
        const details = new Map(shiftsState.shiftDetails);
        details.set(
          `${date}_${shift}_${empId}`,
          buildShiftDetail(emp, date, shift),
        );
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

  function removeEmployeeFromShift(
    dateKey: string,
    shiftType: string,
    employeeId: number,
  ) {
    shiftsState.removeShiftAssignment(dateKey, shiftType, employeeId);
    showSuccessAlert('Schicht-Zuweisung entfernt');
  }

  const weekDates = $derived(getWeekDates(shiftsState.currentWeek));
  const weekRangeText = $derived(
    formatWeekRange(getWeekStart(shiftsState.currentWeek)),
  );

  // Pre-computed week dates for modals (formatted as YYYY-MM-DD)
  const currentWeekStart = $derived(
    formatDate(getWeekStart(shiftsState.currentWeek)),
  );
  const currentWeekEnd = $derived(
    formatDate(getWeekEnd(shiftsState.currentWeek)),
  );

  function getShiftEmployees(dateKey: string, shiftType: string): number[] {
    const dayShifts = shiftsState.weeklyShifts.get(dateKey);
    if (dayShifts === undefined) return [];
    return dayShifts.get(shiftType) ?? [];
  }

  async function handleResetSchedule(): Promise<void> {
    if (shiftsState.isEditMode) {
      shiftsState.setIsEditMode(false);
      await loadShiftPlan();
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
      shiftsState.setIsPlanLocked(true);
      shiftsState.setIsEditMode(false);
      showSuccessAlert('Schichtplan erfolgreich gespeichert!');
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        'code' in error &&
        'details' in error &&
        (error as unknown as { code: string }).code === 'VALIDATION_ERROR' &&
        Array.isArray((error as unknown as { details: unknown }).details)
      ) {
        const details = (error as unknown as { details: { message: string }[] })
          .details;
        const messages = details.map((d) => d.message).join(', ');
        showErrorAlert(messages);
      } else {
        const message =
          error instanceof Error ?
            error.message
          : 'Fehler beim Speichern des Schichtplans.';
        showErrorAlert(message);
      }
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
    if (!(await showConfirm('Möchten Sie diesen Favoriten wirklich löschen?')))
      return;
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
      showWarningAlert(
        'Bitte wählen Sie zuerst einen Bereich, eine Abteilung und ein Team aus.',
      );
      return;
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

  /** Weekday names for custom rotation special rules */
  const WEEKDAY_NAMES = [
    'Sonntag',
    'Montag',
    'Dienstag',
    'Mittwoch',
    'Donnerstag',
    'Freitag',
    'Samstag',
  ] as const;

  /** Build algorithm config from custom rotation config */
  function buildAlgorithmConfig(config: CustomRotationConfig) {
    const sequenceArray = config.shiftSequence.split('-') as (
      | 'early'
      | 'late'
      | 'night'
    )[];
    const specialRules =
      config.nthWeekdayFree ?
        [
          {
            type: 'nth_weekday_free' as const,
            name: `Jeder ${String(config.nthValue)}. ${WEEKDAY_NAMES[config.weekdayValue] ?? 'Tag'} frei`,
            weekday: config.weekdayValue,
            n: config.nthValue,
          },
        ]
      : undefined;

    return {
      shiftBlockLength: config.shiftBlockLength,
      freeDays: config.freeDays,
      startShift: config.startShift,
      shiftSequence: sequenceArray,
      specialRules,
    };
  }

  /** Build employee assignments from config map */
  function buildRotationAssignments(
    employeeAssignments: Map<string, number[]>,
  ): CustomRotationAssignment[] {
    const assignments: CustomRotationAssignment[] = [];
    for (const [shiftGroup, userIds] of employeeAssignments) {
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
    return assignments;
  }

  /** Handle custom rotation generation */
  async function handleCustomRotationGenerate(config: CustomRotationConfig) {
    const teamId = shiftsState.selectedContext.teamId;
    const departmentId = shiftsState.selectedContext.departmentId;
    if (teamId === null) {
      showErrorAlert('Kein Team ausgewählt');
      return;
    }

    try {
      const algorithmConfig = buildAlgorithmConfig(config);
      const assignments = buildRotationAssignments(config.employeeAssignments);

      if (assignments.length === 0) {
        showErrorAlert(
          'Bitte weisen Sie mindestens einem Mitarbeiter eine Schichtgruppe zu.',
        );
        return;
      }

      const result = await generateRotationFromConfig({
        config: algorithmConfig,
        assignments,
        startDate: config.startDate,
        endDate: config.endDate,
        teamId,
        departmentId: departmentId ?? undefined,
      });

      shiftsState.setShowCustomRotationModal(false);
      showSuccessAlert(
        `Custom Rotation erstellt! ${result.shiftsCreated} Schichten generiert.`,
      );
      navigateToWeekContainingDate(config.startDate);
      void loadShiftPlan();
    } catch (error) {
      log.error({ err: error }, 'Custom rotation error');
      showErrorAlert(
        error instanceof Error ?
          error.message
        : 'Fehler bei der Custom Rotation',
      );
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
      <p class="mt-2 text-[var(--color-text-secondary)]">
        Schichten planen und verwalten
      </p>

      <!-- Loading Overlay (Design System) - ONLY during initial load, NOT during week changes -->
      {#if shiftsState.isLoading && !shiftsState.showPlanningUI}
        <div class="flex items-center justify-center py-12 gap-3">
          <div class="spinner-ring spinner-ring--lg"></div>
          <span class="text-[var(--color-text-secondary)]">Laden...</span>
        </div>
      {/if}

      <!-- Employee Team Info Bar -->
      {#if shiftsState.employeeTeamInfo !== null}
        <div
          class="flex flex-wrap items-center gap-3 mt-4 p-4 rounded-xl border
            border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)]"
          role="status"
        >
          <i class="fas fa-users text-[var(--color-text-secondary)]"></i>
          <span class="font-medium text-[var(--color-text-secondary)]"
            >Dein Team:</span
          >
          <span class="font-semibold text-blue-400"
            >{shiftsState.employeeTeamInfo.teamName}</span
          >
          <span class="font-medium text-[var(--color-text-secondary)]"
            >Abteilung:</span
          >
          <span class="font-semibold text-blue-400"
            >{shiftsState.employeeTeamInfo.departmentName}</span
          >
          <span class="font-medium text-[var(--color-text-secondary)]"
            >Bereich:</span
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
