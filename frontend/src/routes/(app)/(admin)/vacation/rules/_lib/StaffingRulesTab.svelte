<script lang="ts">
  /**
   * StaffingRulesTab — Staffing rules list, create/edit form modal, delete confirm.
   * Create mode: Cascade dropdown (Area -> Department -> Machine) for machine selection.
   * Edit mode: Machine locked, only minStaffCount editable.
   */
  import { invalidateAll } from '$app/navigation';

  import { showSuccessAlert, showErrorAlert } from '$lib/utils';
  import { createLogger } from '$lib/utils/logger';

  import * as api from './api';
  import { rulesState } from './state.svelte';

  import type { CreateStaffingRulePayload, OrgMachine } from './types';

  const log = createLogger('StaffingRulesTab');

  // ==========================================================================
  // FORM STATE
  // ==========================================================================

  let ruleMinStaff = $state('1');
  let isSaving = $state(false);

  // Cascade state (create mode)
  let selectedAreaId = $state<number | null>(null);
  let selectedDepartmentId = $state<number | null>(null);
  let selectedMachineId = $state<number | null>(null);
  let cascadeMachines = $state<OrgMachine[]>([]);
  let isLoadingMachines = $state(false);

  // Dropdown open states
  let areaDropdownOpen = $state(false);
  let departmentDropdownOpen = $state(false);
  let machineDropdownOpen = $state(false);

  /** Departments filtered by selected area (client-side from SSR data) */
  const filteredDepartments = $derived(
    selectedAreaId !== null ?
      rulesState.departments.filter((d) => d.areaId === selectedAreaId)
    : [],
  );

  /** Populate form when editing, reset when creating */
  $effect(() => {
    const editing = rulesState.editingStaffingRule;
    if (editing !== null) {
      selectedMachineId = editing.machineId;
      ruleMinStaff = String(editing.minStaffCount);
    } else if (rulesState.showStaffingRuleForm) {
      selectedAreaId = null;
      selectedDepartmentId = null;
      selectedMachineId = null;
      cascadeMachines = [];
      ruleMinStaff = '1';
      closeAllDropdowns();
    }
  });

  const canSubmit = $derived(
    selectedMachineId !== null && Number(ruleMinStaff) >= 1,
  );

  // ==========================================================================
  // DROPDOWN HELPERS
  // ==========================================================================

  function closeAllDropdowns(): void {
    areaDropdownOpen = false;
    departmentDropdownOpen = false;
    machineDropdownOpen = false;
  }

  function getSelectedAreaName(): string {
    if (selectedAreaId === null) return 'Bereich wählen...';
    return (
      rulesState.areas.find((a) => a.id === selectedAreaId)?.name ??
      'Bereich wählen...'
    );
  }

  function getSelectedDepartmentName(): string {
    if (selectedAreaId === null) return 'Erst Bereich wählen...';
    if (selectedDepartmentId === null) return 'Abteilung wählen...';
    return (
      filteredDepartments.find((d) => d.id === selectedDepartmentId)?.name ??
      'Abteilung wählen...'
    );
  }

  function getSelectedMachineName(): string {
    if (selectedDepartmentId === null) return 'Erst Abteilung wählen...';
    if (isLoadingMachines) return 'Laden...';
    if (selectedMachineId === null) return 'Maschine wählen...';
    return (
      cascadeMachines.find((m) => m.id === selectedMachineId)?.name ??
      'Maschine wählen...'
    );
  }

  // ==========================================================================
  // CASCADE HANDLERS
  // ==========================================================================

  function handleAreaSelect(areaId: number): void {
    selectedAreaId = areaId;
    selectedDepartmentId = null;
    selectedMachineId = null;
    cascadeMachines = [];
    closeAllDropdowns();
  }

  function handleDepartmentSelect(departmentId: number): void {
    selectedDepartmentId = departmentId;
    selectedMachineId = null;
    closeAllDropdowns();

    isLoadingMachines = true;
    api
      .fetchMachinesByDepartment(departmentId)
      .then((machines) => {
        cascadeMachines = machines;
      })
      .catch((err: unknown) => {
        log.error({ err }, 'Failed to load machines');
        cascadeMachines = [];
      })
      .finally(() => {
        isLoadingMachines = false;
      });
  }

  function handleMachineSelect(machineId: number): void {
    selectedMachineId = machineId;
    closeAllDropdowns();
  }

  // ==========================================================================
  // SAVE / DELETE HANDLERS
  // ==========================================================================

  async function performSave(): Promise<void> {
    if (rulesState.editingStaffingRule !== null) {
      await api.updateStaffingRule(rulesState.editingStaffingRule.id, {
        minStaffCount: Number(ruleMinStaff),
      });
      showSuccessAlert('Besetzungsregel aktualisiert');
    } else {
      if (selectedMachineId === null) return;
      const payload: CreateStaffingRulePayload = {
        machineId: selectedMachineId,
        minStaffCount: Number(ruleMinStaff),
      };
      await api.createStaffingRule(payload);
      showSuccessAlert('Besetzungsregel erstellt');
    }

    rulesState.closeStaffingRuleForm();
    await invalidateAll();
  }

  function handleSubmit() {
    if (!canSubmit || isSaving) return;

    isSaving = true;
    performSave()
      .catch((err: unknown) => {
        log.error({ err }, 'Staffing rule save failed');
        showErrorAlert('Fehler beim Speichern der Besetzungsregel');
      })
      .finally(() => {
        isSaving = false;
      });
  }

  async function handleDelete() {
    const rule = rulesState.deletingStaffingRule;
    if (rule === null) return;

    try {
      await api.deleteStaffingRule(rule.id);
      rulesState.closeDeleteStaffingRule();
      showSuccessAlert('Besetzungsregel geloescht');
      await invalidateAll();
    } catch (err) {
      log.error({ err }, 'Staffing rule delete failed');
      showErrorAlert('Fehler beim Loeschen der Besetzungsregel');
    }
  }
</script>

<!-- ================================================================
     STAFFING RULES LIST
     ================================================================ -->

<div class="card mb-6">
  <div class="card__header">
    <div class="flex items-center justify-between">
      <h3 class="card__title">
        <i class="fas fa-users-cog mr-2"></i>
        Besetzungsregeln
        <span class="text-muted ml-2">({rulesState.staffingRules.length})</span>
      </h3>
      <button
        type="button"
        class="btn btn-primary"
        onclick={() => {
          rulesState.openCreateStaffingRule();
        }}
      >
        <i class="fas fa-plus mr-1"></i>
        Neue Regel
      </button>
    </div>
  </div>
  <div class="card__body">
    {#if rulesState.staffingRules.length === 0}
      <div class="empty-state empty-state--in-card">
        <div class="empty-state__icon">
          <i class="fas fa-users-cog"></i>
        </div>
        <h3 class="empty-state__title">Keine Besetzungsregeln definiert</h3>
        <p class="empty-state__description">
          Besetzungsregeln legen fest, wie viele Mitarbeiter pro Maschine
          mindestens anwesend sein muessen.
        </p>
      </div>
    {:else}
      <div class="rules-list">
        {#each rulesState.staffingRules as rule (rule.id)}
          <div class="rules-list__item">
            <div class="rules-list__info">
              <span class="rules-list__name">
                {rule.machineName ?? `Maschine #${rule.machineId}`}
              </span>
              <div class="rules-list__meta">
                <span>
                  <i class="fas fa-users mr-1"></i>
                  Min. {rule.minStaffCount} Mitarbeiter
                </span>
              </div>
            </div>
            <div class="rules-list__actions">
              <button
                type="button"
                class="action-icon action-icon--edit"
                title="Bearbeiten"
                aria-label="Personalregel bearbeiten"
                onclick={() => {
                  rulesState.openEditStaffingRule(rule);
                }}
              >
                <i class="fas fa-edit"></i>
              </button>
              <button
                type="button"
                class="action-icon action-icon--delete"
                title="Löschen"
                aria-label="Personalregel löschen"
                onclick={() => {
                  rulesState.openDeleteStaffingRule(rule);
                }}
              >
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- ================================================================
     FORM MODAL (Create / Edit)
     ================================================================ -->

{#if rulesState.showStaffingRuleForm}
  <div
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={() => {
      rulesState.closeStaffingRuleForm();
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape') rulesState.closeStaffingRuleForm();
    }}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <form
      class="ds-modal"
      onclick={(e) => {
        e.stopPropagation();
        if (e.target instanceof HTMLElement && !e.target.closest('.dropdown')) {
          closeAllDropdowns();
        }
      }}
      onkeydown={(e) => {
        e.stopPropagation();
      }}
      onsubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          <i class="fas fa-users-cog mr-2"></i>
          {rulesState.editingStaffingRule !== null ?
            'Besetzungsregel bearbeiten'
          : 'Neue Besetzungsregel'}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schliessen"
          onclick={() => {
            rulesState.closeStaffingRuleForm();
          }}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="ds-modal__body">
        {#if rulesState.editingStaffingRule !== null}
          <!-- Edit mode: machine is locked, show name only -->
          <div class="form-field">
            <span class="form-field__label">Maschine</span>
            <p style="padding: 0.5rem 0; opacity: 70%;">
              <i class="fas fa-cog mr-1"></i>
              {rulesState.editingStaffingRule.machineName ??
                `Maschine #${rulesState.editingStaffingRule.machineId}`}
            </p>
            <span class="form-field__hint">
              Maschine kann nicht geaendert werden
            </span>
          </div>
        {:else}
          <!-- Create mode: Cascade Area -> Department -> Machine -->

          <!-- Area Dropdown -->
          <div class="form-field">
            <span class="form-field__label">Bereich</span>
            <div class="dropdown">
              <div
                class="dropdown__trigger"
                class:active={areaDropdownOpen}
                onclick={() => {
                  const wasOpen = areaDropdownOpen;
                  closeAllDropdowns();
                  if (!wasOpen) areaDropdownOpen = true;
                }}
                onkeydown={(e) => {
                  if (e.key === 'Enter') {
                    const wasOpen = areaDropdownOpen;
                    closeAllDropdowns();
                    if (!wasOpen) areaDropdownOpen = true;
                  }
                }}
                role="button"
                tabindex="0"
              >
                <span>{getSelectedAreaName()}</span>
                <i class="fas fa-chevron-down"></i>
              </div>
              <div
                class="dropdown__menu"
                class:active={areaDropdownOpen}
              >
                {#each rulesState.areas as area (area.id)}
                  <div
                    class="dropdown__option"
                    onclick={() => {
                      handleAreaSelect(area.id);
                    }}
                    onkeydown={(e) => {
                      if (e.key === 'Enter') {
                        handleAreaSelect(area.id);
                      }
                    }}
                    role="option"
                    aria-selected={selectedAreaId === area.id}
                    tabindex="0"
                  >
                    {area.name}
                  </div>
                {/each}
              </div>
            </div>
          </div>

          <!-- Department Dropdown -->
          <div class="form-field">
            <span class="form-field__label">Abteilung</span>
            <div
              class="dropdown"
              class:dropdown--disabled={selectedAreaId === null}
            >
              <div
                class="dropdown__trigger"
                class:active={departmentDropdownOpen}
                tabindex={selectedAreaId === null ? -1 : 0}
                style={selectedAreaId === null ?
                  'pointer-events: none; opacity: 0.5;'
                : ''}
                onclick={() => {
                  if (selectedAreaId !== null) {
                    const wasOpen = departmentDropdownOpen;
                    closeAllDropdowns();
                    if (!wasOpen) departmentDropdownOpen = true;
                  }
                }}
                onkeydown={(e) => {
                  if (e.key === 'Enter' && selectedAreaId !== null) {
                    const wasOpen = departmentDropdownOpen;
                    closeAllDropdowns();
                    if (!wasOpen) departmentDropdownOpen = true;
                  }
                }}
                role="button"
              >
                <span>{getSelectedDepartmentName()}</span>
                <i class="fas fa-chevron-down"></i>
              </div>
              <div
                class="dropdown__menu"
                class:active={departmentDropdownOpen}
              >
                {#each filteredDepartments as dept (dept.id)}
                  <div
                    class="dropdown__option"
                    onclick={() => {
                      handleDepartmentSelect(dept.id);
                    }}
                    onkeydown={(e) => {
                      if (e.key === 'Enter') {
                        handleDepartmentSelect(dept.id);
                      }
                    }}
                    role="option"
                    aria-selected={selectedDepartmentId === dept.id}
                    tabindex="0"
                  >
                    {dept.name}
                  </div>
                {/each}
              </div>
            </div>
          </div>

          <!-- Machine Dropdown -->
          <div class="form-field">
            <span class="form-field__label">Maschine</span>
            <div
              class="dropdown"
              class:dropdown--disabled={selectedDepartmentId === null ||
                isLoadingMachines}
            >
              <div
                class="dropdown__trigger"
                class:active={machineDropdownOpen}
                tabindex={selectedDepartmentId === null ? -1 : 0}
                style={selectedDepartmentId === null || isLoadingMachines ?
                  'pointer-events: none; opacity: 0.5;'
                : ''}
                onclick={() => {
                  if (selectedDepartmentId !== null && !isLoadingMachines) {
                    const wasOpen = machineDropdownOpen;
                    closeAllDropdowns();
                    if (!wasOpen) machineDropdownOpen = true;
                  }
                }}
                onkeydown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    selectedDepartmentId !== null &&
                    !isLoadingMachines
                  ) {
                    const wasOpen = machineDropdownOpen;
                    closeAllDropdowns();
                    if (!wasOpen) machineDropdownOpen = true;
                  }
                }}
                role="button"
              >
                <span>{getSelectedMachineName()}</span>
                <i class="fas fa-chevron-down"></i>
              </div>
              <div
                class="dropdown__menu"
                class:active={machineDropdownOpen}
              >
                {#if cascadeMachines.length === 0 && !isLoadingMachines}
                  <div
                    class="dropdown__option"
                    style="opacity: 50%; cursor: default;"
                  >
                    Keine Maschinen in dieser Abteilung
                  </div>
                {:else}
                  {#each cascadeMachines as machine (machine.id)}
                    <div
                      class="dropdown__option"
                      onclick={() => {
                        handleMachineSelect(machine.id);
                      }}
                      onkeydown={(e) => {
                        if (e.key === 'Enter') {
                          handleMachineSelect(machine.id);
                        }
                      }}
                      role="option"
                      aria-selected={selectedMachineId === machine.id}
                      tabindex="0"
                    >
                      {machine.name}
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          </div>
        {/if}

        <!-- Min staff count (always shown) -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="sr-min-staff"
          >
            Mindestbesetzung
          </label>
          <input
            id="sr-min-staff"
            type="number"
            class="form-field__control"
            min="1"
            bind:value={ruleMinStaff}
            required
          />
        </div>
      </div>

      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={() => {
            rulesState.closeStaffingRuleForm();
          }}
        >
          Abbrechen
        </button>
        <button
          type="submit"
          class="btn btn-modal"
          disabled={!canSubmit || isSaving}
        >
          <i class="fas fa-save mr-1"></i>
          {rulesState.editingStaffingRule !== null ?
            'Aktualisieren'
          : 'Erstellen'}
        </button>
      </div>
    </form>
  </div>
{/if}

<!-- ================================================================
     DELETE CONFIRM MODAL
     ================================================================ -->

{#if rulesState.showDeleteStaffingRuleConfirm && rulesState.deletingStaffingRule !== null}
  {@const rule = rulesState.deletingStaffingRule}
  <div
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={() => {
      rulesState.closeDeleteStaffingRule();
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape') rulesState.closeDeleteStaffingRule();
    }}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="ds-modal"
      role="document"
      onclick={(e) => {
        e.stopPropagation();
      }}
      onkeydown={(e) => {
        e.stopPropagation();
      }}
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          <i class="fas fa-exclamation-triangle text-danger mr-2"></i>
          Besetzungsregel loeschen
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schliessen"
          onclick={() => {
            rulesState.closeDeleteStaffingRule();
          }}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body">
        <p>
          Moechten Sie die Besetzungsregel fuer
          <strong>"{rule.machineName ?? `Maschine #${rule.machineId}`}"</strong>
          wirklich loeschen?
        </p>
      </div>
      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={() => {
            rulesState.closeDeleteStaffingRule();
          }}
        >
          Abbrechen
        </button>
        <button
          type="button"
          class="btn btn-danger"
          onclick={() => {
            void handleDelete();
          }}
        >
          <i class="fas fa-trash mr-1"></i>
          Loeschen
        </button>
      </div>
    </div>
  </div>
{/if}
