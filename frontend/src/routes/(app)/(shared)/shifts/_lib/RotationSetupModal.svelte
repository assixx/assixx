<script lang="ts">
  /**
   * Rotation Setup Modal Component
   * Extracted from +page.svelte for ESLint max-lines compliance
   * Based on: frontend/src/scripts/shifts/rotation.ts
   */
  import { onClickOutsideDropdown } from '$lib/actions/click-outside';
  import AppDatePicker from '$lib/components/AppDatePicker.svelte';
  import { showSuccessAlert, showErrorAlert } from '$lib/utils/alerts';
  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('RotationSetupModal');

  import {
    createRotationPattern,
    assignRotation,
    generateRotationShifts,
  } from './api';
  import {
    validateRotationForm,
    buildRotationPatternData,
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

  /** Get error message from unknown error */
  function getErrorMessage(error: unknown, defaultMsg: string): string {
    return error instanceof Error ? error.message : defaultMsg;
  }

  async function handleSave(): Promise<void> {
    if (saving) return;
    saving = true;

    try {
      // 1. Collect form values
      const formValues: RotationFormValues = {
        pattern: selectedPattern as 'weekly' | 'biweekly' | 'monthly' | '',
        startDate,
        endDate,
        skipSaturday,
        skipSunday,
        nightShiftStatic: nightStatic,
      };

      // 2. Validate form
      const validation = validateRotationForm(formValues);
      if (!validation.valid) {
        showErrorAlert(validation.error ?? 'Validierungsfehler');
        return;
      }

      // 3. Check team selection
      const teamId = selectedContext.teamId;
      if (teamId === null || teamId === 0) {
        showErrorAlert('Bitte wählen Sie zuerst ein Team aus');
        return;
      }

      // 4. Collect employees from assignments
      const { list: employeeAssignments, groups: shiftGroups } =
        collectEmployeeAssignments(assignments);

      if (employeeAssignments.length === 0) {
        showErrorAlert(
          'Bitte ziehen Sie mindestens einen Mitarbeiter in eine Schicht-Spalte',
        );
        return;
      }

      // 5. Build pattern data
      const patternData = buildRotationPatternData(
        teamId,
        formValues,
        shiftGroups,
      );

      // 6. Create pattern
      const patternResult = await createRotationPattern(patternData);

      // 7. Assign employees to pattern
      const assignData = {
        patternId: patternResult.id,
        assignments: employeeAssignments,
        startsAt: formValues.startDate,
        endsAt: formValues.endDate !== '' ? formValues.endDate : undefined,
        teamId,
      };
      await assignRotation(assignData);

      // 8. Generate rotation shifts
      const generateEndDate =
        formValues.endDate !== '' ?
          formValues.endDate
        : calculateDefaultEndDate(formValues.startDate, 4);

      const generateResult = await generateRotationShifts({
        patternId: patternResult.id,
        startDate: formValues.startDate,
        endDate: generateEndDate,
      });

      // 9. Success
      showSuccessAlert(
        `Rotation erfolgreich erstellt! ${generateResult.shiftsGenerated} Schichten generiert.`,
      );
      oncomplete(formValues.startDate);
    } catch (error) {
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
          <div class="glass-card mb-4 p-4">
            <h4 class="mb-2 font-medium text-(--color-text-secondary)">
              Verfügbare Mitarbeiter
            </h4>
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
          <div class="glass-card p-4">
            <h4 class="mb-2 font-medium text-(--color-text-secondary)">
              Schichtzuweisung (Startschicht)
            </h4>
            <div class="shift-assignment-table grid grid-cols-3 gap-4">
              <!-- F-Shift Column -->
              <div class="shift-column">
                <div
                  class="column-header mb-2 text-center font-medium text-blue-700 dark:text-blue-400"
                >
                  F (Früh)
                </div>
                <div
                  class="drop-zone min-h-25 rounded border border-dashed border-black/20 p-2 dark:border-white/20"
                  data-shift="F"
                  ondragover={handleDragOver}
                  ondragleave={handleDragLeave}
                  ondrop={(e) => {
                    handleDrop(e, 'F');
                  }}
                  role="listbox"
                  tabindex="0"
                >
                  {#each assignments.F as empId (empId)}
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
                            removeFromAssignment(empId, 'F');
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

              <!-- S-Shift Column -->
              <div class="shift-column">
                <div
                  class="column-header mb-2 text-center font-medium text-yellow-700 dark:text-yellow-400"
                >
                  S (Spät)
                </div>
                <div
                  class="drop-zone min-h-25 rounded border border-dashed border-black/20 p-2 dark:border-white/20"
                  data-shift="S"
                  ondragover={handleDragOver}
                  ondragleave={handleDragLeave}
                  ondrop={(e) => {
                    handleDrop(e, 'S');
                  }}
                  role="listbox"
                  tabindex="0"
                >
                  {#each assignments.S as empId (empId)}
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
                            removeFromAssignment(empId, 'S');
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

              <!-- N-Shift Column -->
              <div class="shift-column">
                <div
                  class="column-header mb-2 text-center font-medium text-purple-700 dark:text-purple-400"
                >
                  N (Nacht)
                </div>
                <div
                  class="drop-zone min-h-25 rounded border border-dashed border-black/20 p-2 dark:border-white/20"
                  data-shift="N"
                  ondragover={handleDragOver}
                  ondragleave={handleDragLeave}
                  ondrop={(e) => {
                    handleDrop(e, 'N');
                  }}
                  role="listbox"
                  tabindex="0"
                >
                  {#each assignments.N as empId (empId)}
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
                            removeFromAssignment(empId, 'N');
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
            </div>
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
        class="btn btn-modal"
        onclick={() => void handleSave()}
        disabled={saving}
      >
        {#if saving}
          <i class="fas fa-spinner fa-spin mr-2"></i>
          Speichern...
        {:else}
          Rotation speichern
        {/if}
      </button>
    </div>
  </div>
</div>
