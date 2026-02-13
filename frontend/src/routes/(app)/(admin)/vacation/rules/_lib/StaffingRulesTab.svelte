<script lang="ts">
  /**
   * StaffingRulesTab — Staffing rules list, create/edit form modal, delete confirm modal.
   * All state read from rulesState singleton.
   */
  import { invalidateAll } from '$app/navigation';

  import { showSuccessAlert, showErrorAlert } from '$lib/utils';
  import { createLogger } from '$lib/utils/logger';

  import * as api from './api';
  import { rulesState } from './state.svelte';

  import type { CreateStaffingRulePayload } from './types';

  const log = createLogger('StaffingRulesTab');

  // ==========================================================================
  // FORM STATE
  // ==========================================================================

  let ruleMachineId = $state('');
  let ruleMinStaff = $state('1');
  let isSaving = $state(false);

  /** Populate form when editing */
  $effect(() => {
    const editing = rulesState.editingStaffingRule;
    if (editing !== null) {
      ruleMachineId = String(editing.machineId);
      ruleMinStaff = String(editing.minStaffCount);
    } else if (rulesState.showStaffingRuleForm) {
      ruleMachineId = '';
      ruleMinStaff = '1';
    }
  });

  const canSubmit = $derived(
    ruleMachineId.trim() !== '' && Number(ruleMinStaff) >= 1,
  );

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  async function performSave(): Promise<void> {
    if (rulesState.editingStaffingRule !== null) {
      await api.updateStaffingRule(rulesState.editingStaffingRule.id, {
        minStaffCount: Number(ruleMinStaff),
      });
      showSuccessAlert('Besetzungsregel aktualisiert');
    } else {
      const payload: CreateStaffingRulePayload = {
        machineId: Number(ruleMachineId),
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
                class="btn btn-secondary btn-sm"
                onclick={() => {
                  rulesState.openEditStaffingRule(rule);
                }}
                aria-label="Bearbeiten"
              >
                <i class="fas fa-edit"></i>
              </button>
              <button
                type="button"
                class="btn btn-danger btn-sm"
                onclick={() => {
                  rulesState.openDeleteStaffingRule(rule);
                }}
                aria-label="Loeschen"
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
        <div class="form-field">
          <label
            class="form-field__label"
            for="sr-machine"
          >
            Maschinen-ID
          </label>
          <input
            id="sr-machine"
            type="number"
            class="form-field__input"
            min="1"
            placeholder="Maschinen-ID eingeben"
            bind:value={ruleMachineId}
            disabled={rulesState.editingStaffingRule !== null}
            required
          />
          {#if rulesState.editingStaffingRule !== null}
            <span class="form-field__hint">
              Maschine kann nicht geaendert werden
            </span>
          {/if}
        </div>

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
            class="form-field__input"
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
