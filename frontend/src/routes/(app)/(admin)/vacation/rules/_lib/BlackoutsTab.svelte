<script lang="ts">
  /**
   * BlackoutsTab — Blackout list, create/edit form modal, delete confirm modal.
   * All state read from rulesState singleton.
   */
  import { invalidateAll } from '$app/navigation';

  import { showSuccessAlert, showErrorAlert } from '$lib/utils';
  import { createLogger } from '$lib/utils/logger';

  import * as api from './api';
  import { SCOPE_TYPE_LABELS } from './constants';
  import { rulesState } from './state.svelte';

  import type { BlackoutScopeType, CreateBlackoutPayload } from './types';

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
  let blackoutScopeType = $state<BlackoutScopeType>('global');
  let blackoutScopeId = $state('');
  let isSaving = $state(false);

  /** Populate form when editing */
  $effect(() => {
    const editing = rulesState.editingBlackout;
    if (editing !== null) {
      blackoutName = editing.name;
      blackoutReason = editing.reason ?? '';
      blackoutStartDate = editing.startDate;
      blackoutEndDate = editing.endDate;
      blackoutScopeType = editing.scopeType;
      blackoutScopeId = editing.scopeId !== null ? String(editing.scopeId) : '';
    } else if (rulesState.showBlackoutForm) {
      blackoutName = '';
      blackoutReason = '';
      blackoutStartDate = '';
      blackoutEndDate = '';
      blackoutScopeType = 'global';
      blackoutScopeId = '';
    }
  });

  const canSubmit = $derived(
    blackoutName.trim() !== '' &&
      blackoutStartDate !== '' &&
      blackoutEndDate !== '' &&
      blackoutEndDate >= blackoutStartDate &&
      (blackoutScopeType === 'global' || blackoutScopeId.trim() !== ''),
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
      scopeType: blackoutScopeType,
      scopeId:
        blackoutScopeType !== 'global' ? Number(blackoutScopeId) : undefined,
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
          <div class="rules-list__item">
            <div class="rules-list__info">
              <span class="rules-list__name">{blackout.name}</span>
              <div class="rules-list__meta">
                <span>
                  <i class="fas fa-calendar-alt mr-1"></i>
                  {formatDate(blackout.startDate)} — {formatDate(
                    blackout.endDate,
                  )}
                </span>
                <span class="badge badge--info">
                  {SCOPE_TYPE_LABELS[blackout.scopeType]}
                  {#if blackout.scopeName}
                    : {blackout.scopeName}
                  {/if}
                </span>
                {#if blackout.reason !== null}
                  <span>
                    <i class="fas fa-info-circle mr-1"></i>
                    {blackout.reason}
                  </span>
                {/if}
              </div>
            </div>
            <div class="rules-list__actions">
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                onclick={() => {
                  rulesState.openEditBlackout(blackout);
                }}
                aria-label="Bearbeiten"
              >
                <i class="fas fa-edit"></i>
              </button>
              <button
                type="button"
                class="btn btn-danger btn-sm"
                onclick={() => {
                  rulesState.openDeleteBlackout(blackout);
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
            class="form-field__input"
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
            class="form-field__input"
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
            <input
              id="bo-start"
              type="date"
              class="form-field__input"
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
            <input
              id="bo-end"
              type="date"
              class="form-field__input"
              min={blackoutStartDate}
              bind:value={blackoutEndDate}
              required
            />
          </div>
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="bo-scope"
          >
            Geltungsbereich
          </label>
          <select
            id="bo-scope"
            class="form-field__select"
            bind:value={blackoutScopeType}
          >
            <option value="global">Global (gesamtes Unternehmen)</option>
            <option value="team">Team</option>
            <option value="department">Abteilung</option>
          </select>
        </div>

        {#if blackoutScopeType !== 'global'}
          <div class="form-field">
            <label
              class="form-field__label"
              for="bo-scope-id"
            >
              {blackoutScopeType === 'team' ? 'Team-ID' : 'Abteilungs-ID'}
            </label>
            <input
              id="bo-scope-id"
              type="number"
              class="form-field__input"
              min="1"
              placeholder={blackoutScopeType === 'team' ? 'Team-ID eingeben' : (
                'Abteilungs-ID eingeben'
              )}
              bind:value={blackoutScopeId}
              required
            />
          </div>
        {/if}
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
          class="btn btn-modal"
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
