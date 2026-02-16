<!--
  CustomRotationModal.svelte
  Modal for configuring custom shift rotation patterns
  Extracted from +page.svelte for maintainability
-->
<script lang="ts">
  import AppDatePicker from '$lib/components/AppDatePicker.svelte';

  import { getEmployeeDisplayName } from './utils';

  import type { Employee, CustomRotationConfig } from './types';

  /**
   * Props interface for CustomRotationModal
   */
  interface Props {
    employees: Employee[];
    initialStartDate?: string;
    initialEndDate?: string;
    onclose: () => void;
    ongenerate: (config: CustomRotationConfig) => void;
  }

  const {
    employees,
    initialStartDate = '',
    initialEndDate = '',
    onclose,
    ongenerate,
  }: Props = $props();

  // Form state - intentionally captures initial prop values (modal is fresh on each open)
  // svelte-ignore state_referenced_locally
  let startDate = $state(initialStartDate);
  // svelte-ignore state_referenced_locally
  let endDate = $state(initialEndDate);
  let shiftBlockLength = $state(10);
  let freeDays = $state(2);
  let startShift = $state<'early' | 'late' | 'night'>('early');
  let shiftSequence = $state<'early-late-night' | 'night-late-early'>(
    'early-late-night',
  );
  let nthWeekdayFree = $state(false);
  let nthValue = $state(4);
  let weekdayValue = $state(0);

  // Dropdown open states
  let startShiftOpen = $state(false);
  let shiftSequenceOpen = $state(false);
  let nthValueOpen = $state(false);
  let weekdayValueOpen = $state(false);

  // Employee assignments (shift type -> employee IDs)
  let assignedEarly = $state<number[]>([]);
  let assignedLate = $state<number[]>([]);
  let assignedNight = $state<number[]>([]);

  // Available employees (not yet assigned)
  const availableEmployees = $derived(
    employees.filter(
      (emp) =>
        !assignedEarly.includes(emp.id) &&
        !assignedLate.includes(emp.id) &&
        !assignedNight.includes(emp.id),
    ),
  );

  // Display labels
  const startShiftLabels: Record<string, string> = {
    early: 'Frühschicht',
    late: 'Spätschicht',
    night: 'Nachtschicht',
  };

  const shiftSequenceLabels: Record<string, string> = {
    'early-late-night': 'Früh → Spät → Nacht',
    'night-late-early': 'Nacht → Spät → Früh (rückwärts)',
  };

  const weekdayLabels: Record<number, string> = {
    0: 'Sonntag',
    1: 'Montag',
    2: 'Dienstag',
    3: 'Mittwoch',
    4: 'Donnerstag',
    5: 'Freitag',
    6: 'Samstag',
  };

  // Drag and drop handling
  let draggedEmployeeId = $state<number | null>(null);

  function handleDragStart(employeeId: number) {
    draggedEmployeeId = employeeId;
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }

  function handleDrop(shift: 'F' | 'S' | 'N') {
    if (draggedEmployeeId === null) return;

    // Remove from any existing assignment
    assignedEarly = assignedEarly.filter((id) => id !== draggedEmployeeId);
    assignedLate = assignedLate.filter((id) => id !== draggedEmployeeId);
    assignedNight = assignedNight.filter((id) => id !== draggedEmployeeId);

    // Add to new shift
    if (shift === 'F') {
      assignedEarly = [...assignedEarly, draggedEmployeeId];
    } else if (shift === 'S') {
      assignedLate = [...assignedLate, draggedEmployeeId];
    } else {
      assignedNight = [...assignedNight, draggedEmployeeId];
    }

    draggedEmployeeId = null;
  }

  function removeFromShift(employeeId: number, shift: 'F' | 'S' | 'N') {
    if (shift === 'F') {
      assignedEarly = assignedEarly.filter((id) => id !== employeeId);
    } else if (shift === 'S') {
      assignedLate = assignedLate.filter((id) => id !== employeeId);
    } else {
      assignedNight = assignedNight.filter((id) => id !== employeeId);
    }
  }

  function getEmployeeById(id: number): Employee | undefined {
    return employees.find((emp) => emp.id === id);
  }

  function handleGenerate() {
    const config: CustomRotationConfig = {
      startDate,
      endDate,
      shiftBlockLength,
      freeDays,
      startShift,
      shiftSequence,
      nthWeekdayFree,
      nthValue,
      weekdayValue,
      employeeAssignments: new Map([
        ['F', assignedEarly],
        ['S', assignedLate],
        ['N', assignedNight],
      ]),
    };
    ongenerate(config);
  }

  // Close dropdowns on outside click
  function closeAllDropdowns() {
    startShiftOpen = false;
    shiftSequenceOpen = false;
    nthValueOpen = false;
    weekdayValueOpen = false;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  id="custom-rotation-modal"
  class="modal-overlay modal-overlay--active"
  onclick={closeAllDropdowns}
>
  <div
    class="ds-modal ds-modal--lg"
    onclick={(e) => {
      e.stopPropagation();
    }}
  >
    <div class="ds-modal__header">
      <h3 class="ds-modal__title">Schichtmuster konfigurieren</h3>
      <button
        type="button"
        class="ds-modal__close"
        onclick={onclose}
        aria-label="Schließen"
      >
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="ds-modal__body">
      <p class="mb-4 text-(--color-text-secondary)">
        Wählen Sie ein vordefiniertes Muster oder erstellen Sie ein eigenes. Das
        gewählte Muster wird automatisch für den gewählten Zeitraum wiederholt.
      </p>

      <!-- Section 1: Zeitraum festlegen -->
      <div class="glass-card mb-4 border border-blue-500/30 bg-blue-500/5 p-4">
        <h4 class="mb-4 font-medium text-blue-400">
          <i class="fas fa-calendar-alt mr-2"></i>
          Zeitraum festlegen
        </h4>
        <div class="grid grid-cols-2 gap-4">
          <div class="form-field">
            <label
              class="form-field__label"
              for="custom-rotation-start-date"
            >
              <i class="fas fa-calendar mr-1"></i>
              Startdatum
            </label>
            <AppDatePicker
              required
              bind:value={startDate}
            />
          </div>
          <div class="form-field">
            <label
              class="form-field__label"
              for="custom-rotation-end-date"
            >
              <i class="fas fa-calendar-check mr-1"></i>
              Enddatum (max. 1.5 Jahre)
            </label>
            <AppDatePicker
              required
              bind:value={endDate}
              placeholder={startDate}
            />
          </div>
        </div>
        <p class="mt-2 text-xs text-(--color-text-tertiary)">
          <i class="fas fa-info-circle mr-1"></i>
          Tipp: Wählen Sie Enddatum bis zum Ende der ersten KW des Folgejahres für
          nahtlosen Übergang.
        </p>
      </div>

      <!-- Section 2: Schichtblock-Konfiguration -->
      <div
        class="glass-card mb-4 border border-emerald-500/30 bg-emerald-500/5 p-4"
      >
        <h4 class="mb-4 font-medium text-emerald-400">
          <i class="fas fa-cogs mr-2"></i>
          Schichtblock-Konfiguration
        </h4>

        <div class="mb-4 grid grid-cols-2 gap-4">
          <!-- Schichtblock-Länge -->
          <div class="form-field">
            <label
              class="form-field__label"
              for="shift-block-length"
            >
              Schichtblock-Länge (Tage)
              <span class="tooltip ml-1">
                <i class="fa-info-circle fas cursor-help text-sm text-blue-400"
                ></i>
                <span
                  class="tooltip__content tooltip__content--info tooltip__content--right"
                  role="tooltip"
                >
                  Legt fest, wie viele Tage durchgehend in einer Schicht
                  gearbeitet wird. Beispiel: 10 Tage Frühschicht, dann Freitage.
                </span>
              </span>
            </label>
            <input
              type="number"
              id="shift-block-length"
              min="1"
              max="14"
              bind:value={shiftBlockLength}
              class="form-field__control"
              required
            />
            <span class="form-field__hint">Tage in derselben Schicht</span>
          </div>

          <!-- Freie Tage -->
          <div class="form-field">
            <label
              class="form-field__label"
              for="free-days-count">Freie Tage zwischen Wechseln</label
            >
            <input
              type="number"
              id="free-days-count"
              min="0"
              max="14"
              bind:value={freeDays}
              class="form-field__control"
              required
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <!-- Startschicht Dropdown -->
          <div class="form-field">
            <label
              class="form-field__label"
              for="start-shift-select">Startschicht am ersten Tag</label
            >
            <div class="dropdown">
              <button
                type="button"
                class="dropdown__trigger"
                class:active={startShiftOpen}
                onclick={() => {
                  closeAllDropdowns();
                  startShiftOpen = !startShiftOpen;
                }}
              >
                <span>{startShiftLabels[startShift]}</span>
                <i class="fas fa-chevron-down"></i>
              </button>
              {#if startShiftOpen}
                <div class="dropdown__menu active">
                  <button
                    type="button"
                    class="dropdown__option"
                    class:dropdown__option--selected={startShift === 'early'}
                    onclick={() => {
                      startShift = 'early';
                      startShiftOpen = false;
                    }}
                  >
                    Frühschicht
                  </button>
                  <button
                    type="button"
                    class="dropdown__option"
                    class:dropdown__option--selected={startShift === 'late'}
                    onclick={() => {
                      startShift = 'late';
                      startShiftOpen = false;
                    }}
                  >
                    Spätschicht
                  </button>
                  <button
                    type="button"
                    class="dropdown__option"
                    class:dropdown__option--selected={startShift === 'night'}
                    onclick={() => {
                      startShift = 'night';
                      startShiftOpen = false;
                    }}
                  >
                    Nachtschicht
                  </button>
                </div>
              {/if}
            </div>
          </div>

          <!-- Schicht-Reihenfolge Dropdown -->
          <div class="form-field">
            <label
              class="form-field__label"
              for="shift-sequence-select">Rotations-Reihenfolge</label
            >
            <div class="dropdown">
              <button
                type="button"
                class="dropdown__trigger"
                class:active={shiftSequenceOpen}
                onclick={() => {
                  closeAllDropdowns();
                  shiftSequenceOpen = !shiftSequenceOpen;
                }}
              >
                <span>{shiftSequenceLabels[shiftSequence]}</span>
                <i class="fas fa-chevron-down"></i>
              </button>
              {#if shiftSequenceOpen}
                <div class="dropdown__menu active">
                  <button
                    type="button"
                    class="dropdown__option"
                    class:dropdown__option--selected={shiftSequence ===
                      'early-late-night'}
                    onclick={() => {
                      shiftSequence = 'early-late-night';
                      shiftSequenceOpen = false;
                    }}
                  >
                    Früh → Spät → Nacht
                  </button>
                  <button
                    type="button"
                    class="dropdown__option"
                    class:dropdown__option--selected={shiftSequence ===
                      'night-late-early'}
                    onclick={() => {
                      shiftSequence = 'night-late-early';
                      shiftSequenceOpen = false;
                    }}
                  >
                    Nacht → Spät → Früh (rückwärts)
                  </button>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>

      <!-- Section 3: Sonderregeln -->
      <div
        class="glass-card mb-4 border border-amber-500/30 bg-amber-500/5 p-4"
      >
        <h4 class="mb-4 font-medium text-amber-400">
          <i class="fas fa-star mr-2"></i>
          Sonderregeln (optional)
        </h4>

        <div class="flex flex-wrap items-center gap-3">
          <label class="choice-card">
            <input
              type="checkbox"
              class="choice-card__input"
              bind:checked={nthWeekdayFree}
            />
            <span class="choice-card__text">Jeden</span>
          </label>

          <!-- N-ter Wochentag Dropdown -->
          <div class="dropdown dropdown--sm">
            <button
              type="button"
              class="dropdown__trigger"
              class:active={nthValueOpen}
              onclick={() => {
                closeAllDropdowns();
                nthValueOpen = !nthValueOpen;
              }}
            >
              <span>{nthValue}.</span>
              <i class="fas fa-chevron-down"></i>
            </button>
            {#if nthValueOpen}
              <div class="dropdown__menu active">
                {#each [1, 2, 3, 4, 5] as n (n)}
                  <button
                    type="button"
                    class="dropdown__option"
                    class:dropdown__option--selected={nthValue === n}
                    onclick={() => {
                      nthValue = n;
                      nthValueOpen = false;
                    }}
                  >
                    {n}.
                  </button>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Wochentag Dropdown -->
          <div class="dropdown dropdown--md">
            <button
              type="button"
              class="dropdown__trigger"
              class:active={weekdayValueOpen}
              onclick={() => {
                closeAllDropdowns();
                weekdayValueOpen = !weekdayValueOpen;
              }}
            >
              <span>{weekdayLabels[weekdayValue]}</span>
              <i class="fas fa-chevron-down"></i>
            </button>
            {#if weekdayValueOpen}
              <div class="dropdown__menu active">
                {#each [0, 1, 2, 3, 4, 5, 6] as day (day)}
                  <button
                    type="button"
                    class="dropdown__option"
                    class:dropdown__option--selected={weekdayValue === day}
                    onclick={() => {
                      weekdayValue = day;
                      weekdayValueOpen = false;
                    }}
                  >
                    {weekdayLabels[day]}
                  </button>
                {/each}
              </div>
            {/if}
          </div>

          <span class="text-(--color-text-primary)">im Monat frei</span>
        </div>
      </div>

      <!-- Section 4: Mitarbeiter Schichtzuweisung -->
      <div class="custom-rotation-assignment-container mt-6">
        <h4 class="form-field__label mb-4">Mitarbeiter Schichtzuweisung</h4>

        <!-- Available Employees -->
        <div class="glass-card mb-4 p-4">
          <h4 class="mb-2 font-medium text-(--color-text-secondary)">
            Verfügbare Mitarbeiter
          </h4>
          <div class="employee-list min-h-15">
            {#if employees.length === 0}
              <div class="py-2 text-sm text-(--color-text-tertiary) italic">
                <i class="fas fa-info-circle mr-1"></i>
                Bitte wählen Sie zuerst ein Team aus, um die Mitarbeiter zu laden.
              </div>
            {:else if availableEmployees.length === 0}
              <div class="py-2 text-sm text-(--color-text-tertiary) italic">
                <i class="fas fa-check-circle mr-1 text-green-400"></i>
                Alle Mitarbeiter wurden zugewiesen.
              </div>
            {:else}
              {#each availableEmployees as employee (employee.id)}
                <div
                  class="employee-item"
                  draggable="true"
                  ondragstart={() => {
                    handleDragStart(employee.id);
                  }}
                  role="listitem"
                >
                  <span class="employee-name"
                    >{getEmployeeDisplayName(employee)}</span
                  >
                </div>
              {/each}
            {/if}
          </div>
        </div>

        <!-- Drop Zones for Shift Assignment -->
        <div class="glass-card p-4">
          <h4 class="mb-2 font-medium text-(--color-text-secondary)">
            Schichtzuweisung (Startschicht)
          </h4>
          {#snippet shiftDropColumn(
            label: string,
            shiftType: 'F' | 'S' | 'N',
            assignedIds: number[],
            colorClass: string,
          )}
            <div class="shift-column">
              <div
                class="column-header mb-2 text-center font-medium {colorClass}"
              >
                {label}
              </div>
              <div
                class="drop-zone min-h-25 rounded border border-dashed border-black/20 p-2 dark:border-white/20"
                ondragover={handleDragOver}
                ondrop={() => {
                  handleDrop(shiftType);
                }}
                role="listbox"
                tabindex="0"
              >
                {#each assignedIds as empId (empId)}
                  {@const emp = getEmployeeById(empId)}
                  {#if emp}
                    <div class="employee-item in-drop-zone">
                      <span class="employee-name"
                        >{getEmployeeDisplayName(emp)}</span
                      >
                      <button
                        type="button"
                        class="btn-remove-rotation"
                        onclick={() => {
                          removeFromShift(empId, shiftType);
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
            {@render shiftDropColumn(
              'F (Früh)',
              'F',
              assignedEarly,
              'text-blue-700 dark:text-blue-400',
            )}
            {@render shiftDropColumn(
              'S (Spät)',
              'S',
              assignedLate,
              'text-yellow-700 dark:text-yellow-400',
            )}
            {@render shiftDropColumn(
              'N (Nacht)',
              'N',
              assignedNight,
              'text-purple-700 dark:text-purple-400',
            )}
          </div>
          <!-- eslint-enable @typescript-eslint/no-confusing-void-expression, sonarjs/no-use-of-empty-return-value -->
          <small class="form-field__hint mt-2 block">
            Ziehen Sie Mitarbeiter in die entsprechende Spalte, um ihre
            Startschicht festzulegen
          </small>
        </div>
      </div>
    </div>
    <div class="ds-modal__footer">
      <button
        type="button"
        class="btn btn-cancel"
        onclick={onclose}
      >
        Abbrechen
      </button>
      <button
        type="button"
        class="btn btn-primary"
        onclick={handleGenerate}
      >
        <i class="fas fa-cogs mr-2"></i>
        Rotation generieren
      </button>
    </div>
  </div>
</div>

<style>
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

  @media (width < 768px) {
    .shift-assignment-table {
      flex-direction: column;
    }

    .shift-column {
      width: 100%;
    }
  }
</style>
