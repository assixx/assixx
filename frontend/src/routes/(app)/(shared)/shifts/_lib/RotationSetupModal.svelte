<script lang="ts">
  /**
   * Rotation Setup Modal Component
   * Extracted from +page.svelte for ESLint max-lines compliance
   * Based on: frontend/src/scripts/shifts/rotation.ts
   */
  import { onClickOutsideDropdown } from '$lib/actions/click-outside';
  import AppDatePicker from '$lib/components/AppDatePicker.svelte';
  import {
    showSuccessAlert,
    showErrorAlert,
    showConfirmWarning,
  } from '$lib/utils/alerts';
  import { getErrorMessage } from '$lib/utils/error';
  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('RotationSetupModal');

  import {
    createRotationPattern,
    assignRotation,
    generateRotationShifts,
    deleteRotationHistoryByTeam,
  } from './api';
  import {
    validateRotationForm,
    buildRotationPatternData,
    loadExistingPattern,
    type RotationFormValues,
    type ShiftGroups,
  } from './rotation';
  import { getEmployeeDisplayName } from './utils';

  import type { Employee, SelectedContext } from './types';

  // =============================================================================
  // PROPS
  // =============================================================================

  interface Props {
    employees: Employee[];
    selectedContext: SelectedContext;
    initialStartDate?: string;
    initialEndDate?: string;
    onclose: () => void;
    oncomplete: (startDate: string) => void;
  }

  const {
    employees,
    selectedContext,
    initialStartDate = '',
    initialEndDate = '',
    onclose,
    oncomplete,
  }: Props = $props();

  // =============================================================================
  // LOCAL STATE
  // =============================================================================

  let patternDropdownOpen = $state(false);
  let selectedPattern = $state<string>('');
  let patternLabel = $state('Muster wählen...');

  let assignments = $state<{ F: number[]; S: number[]; N: number[] }>({
    F: [],
    S: [],
    N: [],
  });

  // Intentionally captures initial prop values (modal is fresh on each open)
  // svelte-ignore state_referenced_locally
  let startDate = $state(initialStartDate);
  // svelte-ignore state_referenced_locally
  let endDate = $state(initialEndDate);
  let skipSaturday = $state(false);
  let skipSunday = $state(false);
  let nightStatic = $state(true);
  let saving = $state(false);

  // =============================================================================
  // CONSTANTS
  // =============================================================================

  const ROTATION_PATTERNS = [
    {
      value: 'weekly',
      label: 'Wöchentlich',
      info: 'Schichten wechseln jede Woche',
    },
    {
      value: 'biweekly',
      label: 'Alle 2 Wochen',
      info: 'Schichten wechseln alle 2 Wochen',
    },
    {
      value: 'monthly',
      label: 'Alle 4 Wochen',
      info: 'Schichten wechseln alle 4 Wochen',
    },
  ];

  // =============================================================================
  // DERIVED
  // =============================================================================

  const availableEmployees = $derived(
    employees.filter(
      (emp) =>
        !assignments.F.includes(emp.id) &&
        !assignments.S.includes(emp.id) &&
        !assignments.N.includes(emp.id),
    ),
  );

  // Date initialization now handled via initialStartDate/initialEndDate props
  // (passed from parent based on current week view)

  // =============================================================================
  // HANDLERS
  // =============================================================================

  /** Reset saving state - extracted to avoid ESLint require-atomic-updates false positive */
  function resetSavingState(): void {
    saving = false;
  }

  function togglePatternDropdown(e: MouseEvent) {
    e.stopPropagation();
    patternDropdownOpen = !patternDropdownOpen;
  }

  function selectPattern(value: string, label: string) {
    selectedPattern = value;
    patternLabel = label;
    patternDropdownOpen = false;
  }

  function getPatternInfo(value: string): string {
    return ROTATION_PATTERNS.find((p) => p.value === value)?.info ?? '';
  }

  function handleDragStart(e: DragEvent, employeeId: number) {
    if (e.dataTransfer !== null) {
      e.dataTransfer.setData('text/plain', String(employeeId));
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer !== null) {
      e.dataTransfer.dropEffect = 'move';
    }
    const target = e.currentTarget as HTMLElement;
    target.classList.add('drag-over');
  }

  function handleDragLeave(e: DragEvent) {
    const target = e.currentTarget as HTMLElement;
    target.classList.remove('drag-over');
  }

  function handleDrop(e: DragEvent, shiftType: 'F' | 'S' | 'N') {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.classList.remove('drag-over');

    const employeeId = Number(e.dataTransfer?.getData('text/plain'));
    if (isNaN(employeeId)) return;

    // Remove from other shifts first
    assignments = {
      F: assignments.F.filter((id) => id !== employeeId),
      S: assignments.S.filter((id) => id !== employeeId),
      N: assignments.N.filter((id) => id !== employeeId),
    };

    // Add to new shift
    assignments = {
      ...assignments,
      [shiftType]: [...assignments[shiftType], employeeId],
    };
  }

  function removeFromAssignment(
    employeeId: number,
    shiftType: 'F' | 'S' | 'N',
  ) {
    assignments = {
      ...assignments,
      [shiftType]: assignments[shiftType].filter((id) => id !== employeeId),
    };
  }

  function calculateDefaultEndDate(
    startDateStr: string,
    weeks: number,
  ): string {
    const startMs = new Date(startDateStr).getTime();
    const endMs = startMs + weeks * 7 * 24 * 60 * 60 * 1000;
    return new Date(endMs).toISOString().split('T')[0] ?? startDateStr;
  }

  /** Collect employee assignments from drag-drop state */
  function collectEmployeeAssignments(assignmentsState: {
    F: number[];
    S: number[];
    N: number[];
  }): {
    list: { userId: number; group: 'F' | 'S' | 'N' }[];
    groups: ShiftGroups;
  } {
    const list: { userId: number; group: 'F' | 'S' | 'N' }[] = [];
    const groups: ShiftGroups = { F: [], S: [], N: [] };

    const shiftTypes = ['F', 'S', 'N'] as const;
    for (const shiftType of shiftTypes) {
      for (const empId of assignmentsState[shiftType]) {
        list.push({ userId: empId, group: shiftType });
        groups[shiftType].push(empId);
      }
    }

    return { list, groups };
  }

  /**
   * Check for existing rotation pattern and handle overwrite confirmation.
   * Returns true if we can proceed with creation, false to abort.
   */
  async function handleExistingPatternOverwrite(
    teamId: number,
  ): Promise<boolean> {
    const existing = await loadExistingPattern(teamId);
    if (existing === null) return true;

    const confirmed = await showConfirmWarning(
      `Es existiert bereits ein Rotationsmuster für dieses Team ("${existing.name}"). Möchten Sie es überschreiben?`,
      'Bestehendes Muster überschreiben?',
    );

    if (!confirmed) return false;

    await deleteRotationHistoryByTeam(teamId, existing.id);
    return true;
  }

  /** Create pattern, assign employees, and generate shifts */
  async function executeRotationCreation(
    teamId: number,
    formValues: RotationFormValues,
    shiftGroups: ShiftGroups,
    employeeAssignments: { userId: number; group: 'F' | 'S' | 'N' }[],
  ): Promise<void> {
    const patternData = buildRotationPatternData(
      teamId,
      formValues,
      shiftGroups,
    );
    const patternResult = await createRotationPattern(patternData);

    await assignRotation({
      patternId: patternResult.id,
      assignments: employeeAssignments,
      startsAt: formValues.startDate,
      endsAt: formValues.endDate !== '' ? formValues.endDate : undefined,
      teamId,
    });

    const generateEndDate =
      formValues.endDate !== '' ?
        formValues.endDate
      : calculateDefaultEndDate(formValues.startDate, 4);

    const generateResult = await generateRotationShifts({
      patternId: patternResult.id,
      startDate: formValues.startDate,
      endDate: generateEndDate,
    });

    showSuccessAlert(
      `Rotation erfolgreich erstellt! ${generateResult.shiftsGenerated} Schichten generiert.`,
    );
    oncomplete(formValues.startDate);
  }

  async function handleSave(): Promise<void> {
    if (saving) return;
    saving = true;

    try {
      const formValues: RotationFormValues = {
        pattern: selectedPattern as 'weekly' | 'biweekly' | 'monthly' | '',
        startDate,
        endDate,
        skipSaturday,
        skipSunday,
        nightShiftStatic: nightStatic,
      };

      const validation = validateRotationForm(formValues);
      if (!validation.valid) {
        showErrorAlert(validation.error ?? 'Validierungsfehler');
        return;
      }

      const teamId = selectedContext.teamId;
      if (teamId === null || teamId === 0) {
        showErrorAlert('Bitte wählen Sie zuerst ein Team aus');
        return;
      }

      const { list: employeeAssignments, groups: shiftGroups } =
        collectEmployeeAssignments(assignments);

      if (employeeAssignments.length === 0) {
        showErrorAlert(
          'Bitte ziehen Sie mindestens einen Mitarbeiter in eine Schicht-Spalte',
        );
        return;
      }

      const canProceed = await handleExistingPatternOverwrite(teamId);
      if (!canProceed) return;

      await executeRotationCreation(
        teamId,
        formValues,
        shiftGroups,
        employeeAssignments,
      );
    } catch (error: unknown) {
      log.error({ err: error }, 'Rotation error');
      showErrorAlert(
        getErrorMessage(error, 'Fehler beim Speichern der Rotation'),
      );
    } finally {
      resetSavingState();
    }
  }

  function handleClose() {
    onclose();
  }

  // Capture-phase click-outside: works inside modals (bypasses stopPropagation)
  $effect(() => {
    return onClickOutsideDropdown(() => {
      patternDropdownOpen = false;
    });
  });
</script>

<div
  id="rotation-setup-modal"
  class="modal-overlay modal-overlay--active"
  role="presentation"
  onclick={handleClose}
>
  <div
    class="ds-modal ds-modal--lg"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={(e) => {
      e.stopPropagation();
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape') handleClose();
    }}
  >
    <div class="ds-modal__header">
      <h2 class="ds-modal__title">Schichtrotation einrichten</h2>
      <button
        type="button"
        class="ds-modal__close"
        onclick={handleClose}
        aria-label="Schließen"
      >
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="ds-modal__body">
      <form id="rotation-setup-form">
        <!-- Pattern Selection -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="rotation-pattern"
          >
            Rotationsmuster
            <span class="text-red-500">*</span>
          </label>
          <input
            type="hidden"
            id="rotation-pattern"
            name="pattern"
            required
            bind:value={selectedPattern}
          />

          <div class="dropdown">
            <div
              class="dropdown__trigger"
              class:active={patternDropdownOpen}
              role="button"
              tabindex="0"
              onclick={togglePatternDropdown}
              onkeydown={(e) => {
                if (e.key === 'Enter')
                  togglePatternDropdown(e as unknown as MouseEvent);
              }}
            >
              <span>{patternLabel}</span>
              <i class="fas fa-chevron-down"></i>
            </div>
            {#if patternDropdownOpen}
              <div class="dropdown__menu active">
                {#each ROTATION_PATTERNS as pattern (pattern.value)}
                  <div
                    class="dropdown__option"
                    class:dropdown__option--selected={selectedPattern ===
                      pattern.value}
                    role="option"
                    tabindex="0"
                    aria-selected={selectedPattern === pattern.value}
                    onclick={() => {
                      selectPattern(pattern.value, pattern.label);
                    }}
                    onkeydown={(e) => {
                      if (e.key === 'Enter')
                        selectPattern(pattern.value, pattern.label);
                    }}
                  >
                    {pattern.label}
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          {#if selectedPattern !== ''}
            <div class="alert alert--info mt-4">
              <i class="fas fa-info-circle alert__icon"></i>
              <div class="alert__content">
                <span>{getPatternInfo(selectedPattern)}</span>
              </div>
            </div>
          {/if}

          <!-- Weekend Toggles -->
          <div class="mt-4 flex gap-4">
            <label class="toggle-switch">
              <input
                type="checkbox"
                class="toggle-switch__input"
                bind:checked={skipSaturday}
              />
              <span class="toggle-switch__slider"></span>
              <span class="toggle-switch__label">
                Samstag überspringen
                <small class="toggle-hint">Sa nicht planen</small>
              </span>
            </label>
            <label class="toggle-switch">
              <input
                type="checkbox"
                class="toggle-switch__input"
                bind:checked={skipSunday}
              />
              <span class="toggle-switch__slider"></span>
              <span class="toggle-switch__label">
                Sonntag überspringen
                <small class="toggle-hint">So nicht planen</small>
              </span>
            </label>
          </div>

          <!-- Night Shift Toggle (directly after weekend toggles like Legacy) -->
          <label class="toggle-switch mt-4">
            <input
              type="checkbox"
              class="toggle-switch__input"
              bind:checked={nightStatic}
            />
            <span class="toggle-switch__slider"></span>
            <span class="toggle-switch__label">
              Nachtschicht konstant
              <small class="toggle-hint"
                >N bleibt N (nur F ↔ S alternieren)</small
              >
            </span>
          </label>
        </div>

        <!-- Date Range -->
        <div class="form-grid form-grid--2col mt-6">
          <div class="form-field">
            <label
              class="form-field__label"
              for="rotation-start"
            >
              Startdatum
              <span class="text-red-500">*</span>
            </label>
            <AppDatePicker
              required
              bind:value={startDate}
            />
          </div>
          <div class="form-field">
            <label
              class="form-field__label"
              for="rotation-end"
            >
              Enddatum
              <small class="text-(--color-text-secondary)">(optional)</small>
            </label>
            <AppDatePicker
              bind:value={endDate}
              placeholder={startDate}
            />
          </div>
        </div>

        <!-- Employee Assignment Area (Legacy Structure) -->
        <div class="form-field rotation-assignment-container mt-6">
          <h4 class="form-field__label mb-4">Mitarbeiter Schichtzuweisung</h4>

          <!-- Available Employees -->
          <div class="card card--compact card--no-margin">
            <h4 class="card__title">Verfügbare Mitarbeiter</h4>
            <div class="employee-list">
              {#each availableEmployees as employee (employee.id)}
                <div
                  class="employee-item"
                  data-employee-id={employee.id}
                  draggable="true"
                  role="option"
                  aria-selected="false"
                  tabindex="0"
                  ondragstart={(e) => {
                    handleDragStart(e, employee.id);
                  }}
                >
                  <div class="employee-info">
                    <span class="employee-name"
                      >{getEmployeeDisplayName(employee)}</span
                    >
                  </div>
                </div>
              {/each}
              {#if availableEmployees.length === 0}
                <div class="py-2 text-sm text-(--color-text-tertiary) italic">
                  Alle Mitarbeiter zugewiesen
                </div>
              {/if}
            </div>
          </div>

          <!-- Shift Assignment Drop Zones -->
          <div class="card card--compact card--no-margin">
            <h4 class="card__title">Schichtzuweisung (Startschicht)</h4>
            {#snippet shiftDropColumn(
              label: string,
              shiftType: 'F' | 'S' | 'N',
              assignedIds: number[],
            )}
              <div class="shift-column">
                <div class="column-header column-header-{shiftType}">
                  {label}
                </div>
                <div
                  class="drop-zone"
                  data-shift={shiftType}
                  ondragover={handleDragOver}
                  ondragleave={handleDragLeave}
                  ondrop={(e) => {
                    handleDrop(e, shiftType);
                  }}
                  role="listbox"
                  tabindex="0"
                >
                  {#each assignedIds as empId (empId)}
                    {@const emp = employees.find((e) => e.id === empId)}
                    {#if emp}
                      <div class="employee-item in-drop-zone">
                        <span class="employee-name"
                          >{getEmployeeDisplayName(emp)}</span
                        >
                        <button
                          type="button"
                          class="btn-remove-rotation"
                          onclick={() => {
                            removeFromAssignment(empId, shiftType);
                          }}
                          aria-label="Entfernen"
                        >
                          <i class="fas fa-times"></i>
                        </button>
                      </div>
                    {/if}
                  {/each}
                </div>
              </div>
            {/snippet}

            <!-- eslint-disable @typescript-eslint/no-confusing-void-expression, sonarjs/no-use-of-empty-return-value -- {@render} false positive -->
            <div class="shift-assignment-table grid grid-cols-3 gap-4">
              {@render shiftDropColumn('F (Früh)', 'F', assignments.F)}
              {@render shiftDropColumn('S (Spät)', 'S', assignments.S)}
              {@render shiftDropColumn('N (Nacht)', 'N', assignments.N)}
            </div>
            <!-- eslint-enable @typescript-eslint/no-confusing-void-expression, sonarjs/no-use-of-empty-return-value -->
            <small class="form-field__hint mt-2 block">
              Ziehen Sie Mitarbeiter in die entsprechende Spalte, um ihre
              Startschicht festzulegen
            </small>
          </div>
        </div>
      </form>
    </div>

    <div class="ds-modal__footer">
      <button
        type="button"
        class="btn btn-cancel"
        onclick={handleClose}>Abbrechen</button
      >
      <button
        type="button"
        class="btn btn-primary"
        onclick={() => void handleSave()}
        disabled={saving}
      >
        {#if saving}
          <span class="spinner-ring spinner-ring--sm mr-2"></span>
          Speichern...
        {:else}
          Rotation speichern
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  .rotation-assignment-container {
    margin-top: 20px;
  }

  .employee-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
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

  .employee-name {
    padding: 5px;
    color: var(--text-primary);
    font-weight: 600;
    font-size: 14px;
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

    background: var(--glass-form-bg-focus);
    padding: 10px;

    font-weight: 500;
    text-align: center;
  }

  .column-header-F {
    color: rgb(255 193 7);
  }

  .column-header-S {
    color: rgb(33 150 243);
  }

  .column-header-N {
    color: rgb(156 39 176);
  }

  .drop-zone {
    border: 2px dashed var(--color-glass-border-hover);
    border-top: none;
    border-radius: 0 0 4px 4px;

    background: var(--glass-bg);
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

  .toggle-hint {
    display: block;
    color: var(--color-text-muted, rgb(255 255 255 / 50%));
    font-weight: 400;
    font-size: 11px;
  }

  @media (width < 768px) {
    .shift-assignment-table {
      flex-direction: column;
    }

    .shift-column {
      width: 100%;
    }
  }
</style>
