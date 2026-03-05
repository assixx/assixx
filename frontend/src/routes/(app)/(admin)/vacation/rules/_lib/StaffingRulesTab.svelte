<script lang="ts">
  /**
   * StaffingRulesTab — Staffing rules list, create/edit form modal, delete confirm.
   * Create mode: Cascade dropdown (Area -> Department -> Asset) for asset selection.
   * Edit mode: Asset locked, only minStaffCount editable.
   */
  import { invalidateAll } from '$app/navigation';

  import { showSuccessAlert, showErrorAlert } from '$lib/utils';
  import { createLogger } from '$lib/utils/logger';

  import * as api from './api';
  import { rulesState } from './state.svelte';

  import type { CreateStaffingRulePayload, OrgAsset } from './types';

  const log = createLogger('StaffingRulesTab');

  // ==========================================================================
  // FORM STATE
  // ==========================================================================

  let ruleMinStaff = $state('1');
  let isSaving = $state(false);

  // Cascade state (create mode)
  let selectedAreaId = $state<number | null>(null);
  let selectedDepartmentId = $state<number | null>(null);
  let selectedAssetId = $state<number | null>(null);
  let cascadeAssets = $state<OrgAsset[]>([]);
  let isLoadingAssets = $state(false);

  // Dropdown open states
  let areaDropdownOpen = $state(false);
  let departmentDropdownOpen = $state(false);
  let assetDropdownOpen = $state(false);

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
      selectedAssetId = editing.assetId;
      ruleMinStaff = String(editing.minStaffCount);
    } else if (rulesState.showStaffingRuleForm) {
      selectedAreaId = null;
      selectedDepartmentId = null;
      selectedAssetId = null;
      cascadeAssets = [];
      ruleMinStaff = '1';
      closeAllDropdowns();
    }
  });

  const canSubmit = $derived(
    selectedAssetId !== null && Number(ruleMinStaff) >= 1,
  );

  // ==========================================================================
  // SEARCH / FILTER
  // ==========================================================================

  let searchQuery = $state('');

  /** Staffing rules filtered by asset name */
  const filteredRules = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q === '') return rulesState.staffingRules;
    return rulesState.staffingRules.filter((rule) => {
      const name = (rule.assetName ?? '').toLowerCase();
      return name.includes(q);
    });
  });

  function handleSearchInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    searchQuery = input.value;
  }

  function clearSearch(): void {
    searchQuery = '';
  }

  // ==========================================================================
  // DROPDOWN HELPERS
  // ==========================================================================

  function closeAllDropdowns(): void {
    areaDropdownOpen = false;
    departmentDropdownOpen = false;
    assetDropdownOpen = false;
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

  function getSelectedAssetName(): string {
    if (selectedDepartmentId === null) return 'Erst Abteilung wählen...';
    if (isLoadingAssets) return 'Laden...';
    if (selectedAssetId === null) return 'Anlage wählen...';
    return (
      cascadeAssets.find((m) => m.id === selectedAssetId)?.name ??
      'Anlage wählen...'
    );
  }

  // ==========================================================================
  // CASCADE HANDLERS
  // ==========================================================================

  function handleAreaSelect(areaId: number): void {
    selectedAreaId = areaId;
    selectedDepartmentId = null;
    selectedAssetId = null;
    cascadeAssets = [];
    closeAllDropdowns();
  }

  function handleDepartmentSelect(departmentId: number): void {
    selectedDepartmentId = departmentId;
    selectedAssetId = null;
    closeAllDropdowns();

    isLoadingAssets = true;
    api
      .fetchAssetsByDepartment(departmentId)
      .then((assets) => {
        cascadeAssets = assets;
      })
      .catch((err: unknown) => {
        log.error({ err }, 'Failed to load assets');
        cascadeAssets = [];
      })
      .finally(() => {
        isLoadingAssets = false;
      });
  }

  function handleAssetSelect(assetId: number): void {
    selectedAssetId = assetId;
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
      if (selectedAssetId === null) return;
      const payload: CreateStaffingRulePayload = {
        assetId: selectedAssetId,
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
    {#if rulesState.staffingRules.length > 0}
      <div class="search-input-wrapper mt-3 mb-0">
        <div
          class="search-input"
          id="staffing-search-container"
        >
          <i class="search-input__icon fas fa-search"></i>
          <input
            type="search"
            id="staffing-search"
            class="search-input__field"
            placeholder="Anlage suchen..."
            autocomplete="off"
            value={searchQuery}
            oninput={handleSearchInput}
          />
          <button
            class="search-input__clear"
            class:search-input__clear--visible={searchQuery.length > 0}
            type="button"
            aria-label="Suche löschen"
            onclick={clearSearch}
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    {/if}
  </div>
  <div class="card__body">
    {#if rulesState.staffingRules.length === 0}
      <div class="empty-state empty-state--in-card">
        <div class="empty-state__icon">
          <i class="fas fa-users-cog"></i>
        </div>
        <h3 class="empty-state__title">Keine Besetzungsregeln definiert</h3>
        <p class="empty-state__description">
          Besetzungsregeln legen fest, wie viele Mitarbeiter pro Anlage
          mindestens anwesend sein muessen.
        </p>
      </div>
    {:else if filteredRules.length === 0}
      <div class="empty-state empty-state--in-card">
        <p class="empty-state__description">
          Keine Ergebnisse für „{searchQuery}"
        </p>
      </div>
    {:else}
      <div class="rules-list">
        {#each filteredRules as rule (rule.id)}
          <div class="rules-list__item">
            <div class="rules-list__info">
              <span class="rules-list__name">
                {rule.assetName ?? `Anlage #${rule.assetId}`}
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
    id="staffing-rule-form-modal"
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
          <!-- Edit mode: asset is locked, show name only -->
          <div class="form-field">
            <span class="form-field__label">Anlage</span>
            <p style="padding: 0.5rem 0; opacity: 70%;">
              <i class="fas fa-cog mr-1"></i>
              {rulesState.editingStaffingRule.assetName ??
                `Anlage #${rulesState.editingStaffingRule.assetId}`}
            </p>
            <span class="form-field__hint">
              Anlage kann nicht geaendert werden
            </span>
          </div>
        {:else}
          <!-- Create mode: Cascade Area -> Department -> Asset -->

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

          <!-- Asset Dropdown -->
          <div class="form-field">
            <span class="form-field__label">Anlage</span>
            <div
              class="dropdown"
              class:dropdown--disabled={selectedDepartmentId === null ||
                isLoadingAssets}
            >
              <div
                class="dropdown__trigger"
                class:active={assetDropdownOpen}
                tabindex={selectedDepartmentId === null ? -1 : 0}
                onclick={() => {
                  if (selectedDepartmentId !== null && !isLoadingAssets) {
                    const wasOpen = assetDropdownOpen;
                    closeAllDropdowns();
                    if (!wasOpen) assetDropdownOpen = true;
                  }
                }}
                onkeydown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    selectedDepartmentId !== null &&
                    !isLoadingAssets
                  ) {
                    const wasOpen = assetDropdownOpen;
                    closeAllDropdowns();
                    if (!wasOpen) assetDropdownOpen = true;
                  }
                }}
                role="button"
              >
                <span>{getSelectedAssetName()}</span>
                <i class="fas fa-chevron-down"></i>
              </div>
              <div
                class="dropdown__menu"
                class:active={assetDropdownOpen}
              >
                {#if cascadeAssets.length === 0 && !isLoadingAssets}
                  <div
                    class="dropdown__option"
                    style="opacity: 50%; cursor: default;"
                  >
                    Keine Anlagen in dieser Abteilung
                  </div>
                {:else}
                  {#each cascadeAssets as asset (asset.id)}
                    <div
                      class="dropdown__option"
                      onclick={() => {
                        handleAssetSelect(asset.id);
                      }}
                      onkeydown={(e) => {
                        if (e.key === 'Enter') {
                          handleAssetSelect(asset.id);
                        }
                      }}
                      role="option"
                      aria-selected={selectedAssetId === asset.id}
                      tabindex="0"
                    >
                      {asset.name}
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
          class="btn btn-primary"
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
    id="staffing-rule-delete-modal"
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
          <strong>"{rule.assetName ?? `Anlage #${rule.assetId}`}"</strong>
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

<style>
  .dropdown--disabled {
    opacity: 50%;
    pointer-events: none;
    transition: opacity 300ms ease;
  }

  .dropdown--disabled .dropdown__trigger {
    cursor: not-allowed;
  }
</style>
