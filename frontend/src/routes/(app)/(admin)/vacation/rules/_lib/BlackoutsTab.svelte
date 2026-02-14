<script lang="ts">
  /**
   * BlackoutsTab — Blackout list, create/edit form modal, delete confirm modal.
   * Multi-scope: toggle-switch for global, multi-select for areas/departments/teams.
   * Pattern mirrors BlackboardEntryModal scope section.
   */
  import { invalidateAll } from '$app/navigation';

  import AppDatePicker from '$lib/components/AppDatePicker.svelte';
  import { showSuccessAlert, showErrorAlert } from '$lib/utils';
  import { createLogger } from '$lib/utils/logger';

  import * as api from './api';
  import { rulesState } from './state.svelte';

  import type { CreateBlackoutPayload } from './types';

  const log = createLogger('BlackoutsTab');

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  // ==========================================================================
  // FORM STATE
  // ==========================================================================

  let blackoutName = $state('');
  let blackoutReason = $state('');
  let blackoutStartDate = $state('');
  let blackoutEndDate = $state('');
  let isSaving = $state(false);

  // Scope state: toggle for global, multi-select arrays
  let isGlobal = $state(true);
  let areaIds = $state<number[]>([]);
  let departmentIds = $state<number[]>([]);
  let teamIds = $state<number[]>([]);

  /**
   * Departments NOT already covered by selected areas.
   * If areas are selected, filter out departments that belong to those areas.
   */
  const availableDepartments = $derived.by(() => {
    if (isGlobal) return rulesState.departments;
    if (areaIds.length === 0) return rulesState.departments;
    return rulesState.departments.filter(
      (d) => d.areaId === undefined || !areaIds.includes(d.areaId),
    );
  });

  /**
   * Teams NOT already covered by selected areas/departments.
   * Filters out teams whose department is selected OR whose department's area is selected.
   */
  const availableTeams = $derived.by(() => {
    if (isGlobal) return rulesState.teams;

    return rulesState.teams.filter((t) => {
      if (
        t.departmentId !== undefined &&
        departmentIds.includes(t.departmentId)
      ) {
        return false;
      }
      if (t.departmentId !== undefined) {
        const dept = rulesState.departments.find(
          (d) => d.id === t.departmentId,
        );
        if (dept?.areaId !== undefined && areaIds.includes(dept.areaId)) {
          return false;
        }
      }
      return true;
    });
  });

  /** Handle area multi-select change. */
  function handleAreaChange(selectedIds: number[]): void {
    areaIds = selectedIds;
    // Remove departments that are now covered by selected areas
    departmentIds = departmentIds.filter((deptId) => {
      const dept = rulesState.departments.find((d) => d.id === deptId);
      return dept?.areaId === undefined || !selectedIds.includes(dept.areaId);
    });
    // Remove teams that are now covered by selected areas
    teamIds = teamIds.filter((tId) => {
      const team = rulesState.teams.find((t) => t.id === tId);
      if (team?.departmentId === undefined) return true;
      const dept = rulesState.departments.find(
        (d) => d.id === team.departmentId,
      );
      return dept?.areaId === undefined || !selectedIds.includes(dept.areaId);
    });
  }

  /** Handle department multi-select change. */
  function handleDepartmentChange(selectedIds: number[]): void {
    departmentIds = selectedIds;
    // Remove teams that are now covered by selected departments
    teamIds = teamIds.filter((tId) => {
      const team = rulesState.teams.find((t) => t.id === tId);
      return (
        team?.departmentId === undefined ||
        !selectedIds.includes(team.departmentId)
      );
    });
  }

  /** Populate form when editing */
  $effect(() => {
    const editing = rulesState.editingBlackout;
    if (editing !== null) {
      blackoutName = editing.name;
      blackoutReason = editing.reason ?? '';
      blackoutStartDate = editing.startDate;
      blackoutEndDate = editing.endDate;
      isGlobal = editing.isGlobal;
      areaIds = [...editing.areaIds];
      departmentIds = [...editing.departmentIds];
      teamIds = [...editing.teamIds];
    } else if (rulesState.showBlackoutForm) {
      blackoutName = '';
      blackoutReason = '';
      blackoutStartDate = '';
      blackoutEndDate = '';
      isGlobal = true;
      areaIds = [];
      departmentIds = [];
      teamIds = [];
    }
  });

  const canSubmit = $derived(
    blackoutName.trim() !== '' &&
      blackoutStartDate !== '' &&
      blackoutEndDate !== '' &&
      blackoutEndDate >= blackoutStartDate &&
      (isGlobal ||
        areaIds.length > 0 ||
        departmentIds.length > 0 ||
        teamIds.length > 0),
  );

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  async function performSave(): Promise<void> {
    const payload: CreateBlackoutPayload = {
      name: blackoutName.trim(),
      reason: blackoutReason.trim() !== '' ? blackoutReason.trim() : undefined,
      startDate: blackoutStartDate,
      endDate: blackoutEndDate,
      isGlobal,
      departmentIds: isGlobal ? [] : departmentIds,
      teamIds: isGlobal ? [] : teamIds,
      areaIds: isGlobal ? [] : areaIds,
    };

    if (rulesState.editingBlackout !== null) {
      await api.updateBlackout(rulesState.editingBlackout.id, payload);
      showSuccessAlert('Sperrzeit aktualisiert');
    } else {
      await api.createBlackout(payload);
      showSuccessAlert('Sperrzeit erstellt');
    }

    rulesState.closeBlackoutForm();
    await invalidateAll();
  }

  function handleSubmit() {
    if (!canSubmit || isSaving) return;

    isSaving = true;
    performSave()
      .catch((err: unknown) => {
        log.error({ err }, 'Blackout save failed');
        showErrorAlert('Fehler beim Speichern der Sperrzeit');
      })
      .finally(() => {
        isSaving = false;
      });
  }

  async function handleDelete() {
    const blackout = rulesState.deletingBlackout;
    if (blackout === null) return;

    try {
      await api.deleteBlackout(blackout.id);
      rulesState.closeDeleteBlackout();
      showSuccessAlert('Sperrzeit geloescht');
      await invalidateAll();
    } catch (err) {
      log.error({ err }, 'Blackout delete failed');
      showErrorAlert('Fehler beim Loeschen der Sperrzeit');
    }
  }
</script>

<!-- ================================================================
     BLACKOUT LIST
     ================================================================ -->

<div class="card mb-6">
  <div class="card__header">
    <div class="flex items-center justify-between">
      <h3 class="card__title">
        <i class="fas fa-ban mr-2"></i>
        Sperrzeiten
        <span class="text-muted ml-2">({rulesState.blackouts.length})</span>
      </h3>
      <button
        type="button"
        class="btn btn-primary"
        onclick={() => {
          rulesState.openCreateBlackout();
        }}
      >
        <i class="fas fa-plus mr-1"></i>
        Neue Sperrzeit
      </button>
    </div>
  </div>
  <div class="card__body">
    {#if rulesState.blackouts.length === 0}
      <div class="empty-state empty-state--in-card">
        <div class="empty-state__icon">
          <i class="fas fa-ban"></i>
        </div>
        <h3 class="empty-state__title">Keine Sperrzeiten definiert</h3>
        <p class="empty-state__description">
          Sperrzeiten verhindern Urlaubsantraege in bestimmten Zeitraeumen.
        </p>
      </div>
    {:else}
      <div class="rules-list">
        {#each rulesState.blackouts as blackout (blackout.id)}
          <div class="blackout-card">
            <div class="blackout-card__header">
              <div class="blackout-card__title-row">
                <i class="fas fa-ban blackout-card__icon"></i>
                <span class="blackout-card__name">{blackout.name}</span>
                {#if blackout.isGlobal}
                  <span class="badge badge--danger badge--sm">
                    <i class="fas fa-globe mr-1"></i>Unternehmensweit
                  </span>
                {/if}
              </div>
              <div class="blackout-card__actions">
                <button
                  type="button"
                  class="action-icon action-icon--edit"
                  title="Bearbeiten"
                  aria-label="Sperrzeit bearbeiten"
                  onclick={() => {
                    rulesState.openEditBlackout(blackout);
                  }}
                >
                  <i class="fas fa-edit"></i>
                </button>
                <button
                  type="button"
                  class="action-icon action-icon--delete"
                  title="Löschen"
                  aria-label="Sperrzeit löschen"
                  onclick={() => {
                    rulesState.openDeleteBlackout(blackout);
                  }}
                >
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>

            <div class="blackout-card__body">
              <div class="blackout-card__date">
                <i class="fas fa-calendar-alt"></i>
                <span>
                  {formatDate(blackout.startDate)} — {formatDate(
                    blackout.endDate,
                  )}
                </span>
              </div>

              {#if !blackout.isGlobal}
                <div class="blackout-card__scopes">
                  {#each blackout.areaIds as areaId (areaId)}
                    {@const area = rulesState.areas.find(
                      (a) => a.id === areaId,
                    )}
                    <span class="badge badge--info badge--sm">
                      <i class="fas fa-layer-group mr-1"></i>{area?.name ??
                        `#${areaId}`}
                    </span>
                  {/each}
                  {#each blackout.departmentIds as deptId (deptId)}
                    {@const dept = rulesState.departments.find(
                      (d) => d.id === deptId,
                    )}
                    <span class="badge badge--info badge--sm">
                      <i class="fas fa-sitemap mr-1"></i>{dept?.name ??
                        `#${deptId}`}
                    </span>
                  {/each}
                  {#each blackout.teamIds as teamId (teamId)}
                    {@const team = rulesState.teams.find(
                      (t) => t.id === teamId,
                    )}
                    <span class="badge badge--info badge--sm">
                      <i class="fas fa-users mr-1"></i>{team?.name ??
                        `#${teamId}`}
                    </span>
                  {/each}
                </div>
              {/if}

              {#if blackout.reason !== null}
                <div class="blackout-card__reason">
                  <i class="fas fa-info-circle"></i>
                  <span>{blackout.reason}</span>
                </div>
              {/if}
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

{#if rulesState.showBlackoutForm}
  <div
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={() => {
      rulesState.closeBlackoutForm();
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape') rulesState.closeBlackoutForm();
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
          <i class="fas fa-ban mr-2"></i>
          {rulesState.editingBlackout !== null ?
            'Sperrzeit bearbeiten'
          : 'Neue Sperrzeit'}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schliessen"
          onclick={() => {
            rulesState.closeBlackoutForm();
          }}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="ds-modal__body">
        <div class="form-field">
          <label
            class="form-field__label"
            for="bo-name">Name</label
          >
          <input
            id="bo-name"
            type="text"
            class="form-field__control"
            placeholder="z.B. Weihnachtssperre"
            maxlength="100"
            bind:value={blackoutName}
            required
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="bo-reason"
          >
            Grund (optional)
          </label>
          <input
            id="bo-reason"
            type="text"
            class="form-field__control"
            placeholder="z.B. Jahresabschluss"
            maxlength="255"
            bind:value={blackoutReason}
          />
        </div>

        <div class="flex gap-3">
          <div
            class="form-field"
            style="flex: 1;"
          >
            <label
              class="form-field__label"
              for="bo-start">Startdatum</label
            >
            <AppDatePicker
              bind:value={blackoutStartDate}
              required
            />
          </div>
          <div
            class="form-field"
            style="flex: 1;"
          >
            <label
              class="form-field__label"
              for="bo-end">Enddatum</label
            >
            <AppDatePicker
              bind:value={blackoutEndDate}
              min={blackoutStartDate}
              placeholder={blackoutStartDate}
              required
            />
          </div>
        </div>

        <!-- Geltungsbereich -->
        <div class="form-field">
          <span class="form-field__label">
            <i class="fas fa-globe mr-2"></i>
            Geltungsbereich
          </span>
        </div>

        <div class="form-field">
          <label class="toggle-switch toggle-switch--danger">
            <input
              type="checkbox"
              class="toggle-switch__input"
              checked={isGlobal}
              onchange={(e) => {
                isGlobal = (e.target as HTMLInputElement).checked;
                if (isGlobal) {
                  areaIds = [];
                  departmentIds = [];
                  teamIds = [];
                }
              }}
            />
            <span class="toggle-switch__slider"></span>
            <span class="toggle-switch__label">
              <i class="fas fa-building mr-2"></i>
              Gesamtes Unternehmen
            </span>
          </label>
          <span class="form-field__message form-field__message--warning">
            <i class="fas fa-exclamation-triangle mr-1"></i>
            Wenn aktiviert, gilt die Sperrzeit fuer ALLE Mitarbeiter
          </span>
        </div>

        <div
          class="form-field"
          class:opacity-50={isGlobal}
        >
          <label
            for="bo-area-select"
            class="form-field__label"
          >
            <i class="fas fa-layer-group mr-1"></i>Bereiche (Areas)
          </label>
          <select
            id="bo-area-select"
            multiple
            class="form-field__control form-field__control--multiselect"
            value={areaIds}
            disabled={isGlobal}
            onchange={(e) => {
              const select = e.target as HTMLSelectElement;
              handleAreaChange(
                Array.from(select.selectedOptions).map((o) => Number(o.value)),
              );
            }}
          >
            {#each rulesState.areas as area (area.id)}
              <option value={area.id}>
                {area.name}{(
                  area.departmentCount !== undefined && area.departmentCount > 0
                ) ?
                  ` (${area.departmentCount} Abt.)`
                : ''}
              </option>
            {/each}
          </select>
          <span class="form-field__message text-(--color-text-secondary)">
            <i class="fas fa-info-circle mr-1"></i>
            Strg/Cmd + Klick fuer Mehrfachauswahl. Bereiche vererben Zugriff auf zugehoerige
            Abteilungen.
          </span>
        </div>

        <div
          class="form-field"
          class:opacity-50={isGlobal}
        >
          <label
            for="bo-department-select"
            class="form-field__label"
          >
            <i class="fas fa-sitemap mr-1"></i>Zusätzliche Abteilungen
          </label>
          <select
            id="bo-department-select"
            multiple
            class="form-field__control form-field__control--multiselect"
            value={departmentIds}
            disabled={isGlobal}
            onchange={(e) => {
              const select = e.target as HTMLSelectElement;
              handleDepartmentChange(
                Array.from(select.selectedOptions).map((o) => Number(o.value)),
              );
            }}
          >
            {#each availableDepartments as dept (dept.id)}
              <option value={dept.id}>
                {dept.name}{(
                  dept.areaName !== undefined && dept.areaName !== ''
                ) ?
                  ` (${dept.areaName})`
                : ''}
              </option>
            {/each}
          </select>
          <span class="form-field__message text-(--color-text-secondary)">
            <i class="fas fa-info-circle mr-1"></i>
            Strg/Cmd + Klick fuer Mehrfachauswahl. Nur Abteilungen die nicht bereits
            durch Bereiche abgedeckt sind.
          </span>
        </div>

        <div
          class="form-field"
          class:opacity-50={isGlobal}
        >
          <label
            for="bo-team-select"
            class="form-field__label"
          >
            <i class="fas fa-users mr-1"></i>Teams
          </label>
          <select
            id="bo-team-select"
            multiple
            class="form-field__control form-field__control--multiselect"
            value={teamIds}
            disabled={isGlobal}
            onchange={(e) => {
              const select = e.target as HTMLSelectElement;
              teamIds = Array.from(select.selectedOptions).map((o) =>
                Number(o.value),
              );
            }}
          >
            {#each availableTeams as team (team.id)}
              <option value={team.id}>{team.name}</option>
            {/each}
          </select>
          <span class="form-field__message text-(--color-text-secondary)">
            <i class="fas fa-info-circle mr-1"></i>
            Teams werden automatisch vererbt: Bereich-/Abteilungs-Auswahl blendet
            zugehoerige Teams aus.
          </span>
        </div>
      </div>

      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={() => {
            rulesState.closeBlackoutForm();
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
          {rulesState.editingBlackout !== null ? 'Aktualisieren' : 'Erstellen'}
        </button>
      </div>
    </form>
  </div>
{/if}

<!-- ================================================================
     DELETE CONFIRM MODAL
     ================================================================ -->

{#if rulesState.showDeleteBlackoutConfirm && rulesState.deletingBlackout !== null}
  <div
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={() => {
      rulesState.closeDeleteBlackout();
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape') rulesState.closeDeleteBlackout();
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
          Sperrzeit loeschen
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schliessen"
          onclick={() => {
            rulesState.closeDeleteBlackout();
          }}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body">
        <p>
          Moechten Sie die Sperrzeit
          <strong>"{rulesState.deletingBlackout.name}"</strong>
          wirklich loeschen?
        </p>
      </div>
      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={() => {
            rulesState.closeDeleteBlackout();
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
  .form-field__message--warning {
    color: var(--color-danger);
  }

  .form-field__control--multiselect {
    min-height: 120px;
  }
</style>
