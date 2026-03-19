<script lang="ts">
  /**
   * Account Settings - Page Component
   * @module account-settings/+page
   *
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   * Sections: Shift Times Configuration + Danger Zone (Tenant Deletion)
   */
  import { invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';

  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('AccountSettingsPage');

  // Module imports
  import {
    getRootUserCount,
    deleteTenant,
    saveShiftTimes,
    resetShiftTimes,
  } from './_lib/api';
  import {
    DELETE_CONFIRMATION_TEXT,
    MIN_REASON_LENGTH,
    MIN_ROOT_USERS,
    MESSAGES,
    SHIFT_MESSAGES,
    SHIFT_KEY_INFO,
  } from './_lib/constants';
  import { formatDate, getStatusLabel, showToast } from './_lib/utils';

  import type { PageData } from './$types';
  import type { DeletionStatusData, ShiftTimeData } from './_lib/types';

  // =============================================================================
  // SSR DATA - Level 3: $derived from props (single source of truth)
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // SSR data via $derived - updates when invalidateAll() is called
  const pendingDeletion = $derived<DeletionStatusData | null>(
    data.pendingDeletion ?? null,
  );
  const hasPendingDeletion = $derived(pendingDeletion !== null);
  const shiftPlanningEnabled = $derived<boolean>(data.shiftPlanningEnabled);
  const ssrShiftTimes = $derived<ShiftTimeData[]>(data.shiftTimes);

  // =============================================================================
  // UI STATE - Client-side only
  // =============================================================================

  // Delete Modal State
  let showDeleteModal = $state(false);
  let deleteConfirmation = $state('');
  let deleteReason = $state('');
  let deleteLoading = $state(false);

  // Shift Times State
  let shiftTimesEdits = $state<
    {
      shiftKey: string;
      label: string;
      startTime: string;
      endTime: string;
    }[]
  >([]);
  let shiftSaving = $state(false);
  let shiftResetting = $state(false);

  // Initialize edits from SSR data
  $effect(() => {
    if (ssrShiftTimes.length > 0 && shiftTimesEdits.length === 0) {
      shiftTimesEdits = ssrShiftTimes.map((st: ShiftTimeData) => ({
        shiftKey: st.shiftKey,
        label: st.label,
        startTime: st.startTime,
        endTime: st.endTime,
      }));
    }
  });

  // =============================================================================
  // DERIVED STATE
  // =============================================================================

  const isDeleteConfirmationValid = $derived(
    deleteConfirmation === DELETE_CONFIRMATION_TEXT,
  );
  const isReasonValid = $derived(deleteReason.length >= MIN_REASON_LENGTH);
  const canDelete = $derived(isDeleteConfirmationValid && isReasonValid);

  /** Check if shift times have been modified from SSR state */
  const shiftTimesChanged = $derived(() => {
    if (shiftTimesEdits.length !== ssrShiftTimes.length) return true;
    for (let i = 0; i < shiftTimesEdits.length; i++) {
      const edit = shiftTimesEdits[i];
      const ssr = ssrShiftTimes[i];
      if (
        edit.label !== ssr.label ||
        edit.startTime !== ssr.startTime ||
        edit.endTime !== ssr.endTime
      ) {
        return true;
      }
    }
    return false;
  });

  /** Validate all shift time inputs */
  const shiftTimesValid = $derived(() => {
    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    return shiftTimesEdits.every(
      (st) =>
        st.label.length > 0 &&
        st.label.length <= 100 &&
        timePattern.test(st.startTime) &&
        timePattern.test(st.endTime),
    );
  });

  // =============================================================================
  // SHIFT TIMES HANDLERS
  // =============================================================================

  async function handleSaveShiftTimes(): Promise<void> {
    if (shiftSaving || !shiftTimesValid()) return;

    shiftSaving = true;
    try {
      const editsToSave = shiftTimesEdits;
      shiftTimesEdits = [];
      await saveShiftTimes(editsToSave);
      showToast(SHIFT_MESSAGES.saved, 'success');
      await invalidateAll();
    } catch (err: unknown) {
      log.error({ err }, 'Error saving shift times');
      showToast(SHIFT_MESSAGES.saveError, 'error');
    }
    // eslint-disable-next-line require-atomic-updates -- Unconditional reset after sync guard
    shiftSaving = false;
  }

  async function handleResetShiftTimes(): Promise<void> {
    if (shiftResetting) return;

    shiftResetting = true;
    try {
      await resetShiftTimes();
      showToast(SHIFT_MESSAGES.reset, 'success');
      await invalidateAll();
      shiftTimesEdits = [];
    } catch (err: unknown) {
      log.error({ err }, 'Error resetting shift times');
      showToast(SHIFT_MESSAGES.resetError, 'error');
    }
    // eslint-disable-next-line require-atomic-updates -- Unconditional reset after sync guard
    shiftResetting = false;
  }

  // =============================================================================
  // DELETE HANDLERS
  // =============================================================================

  async function handleShowDeleteModal() {
    try {
      const rootUserCount = await getRootUserCount();
      log.warn({ rootUserCount }, 'Found root users in tenant');

      if (rootUserCount < MIN_ROOT_USERS) {
        showToast(MESSAGES.notEnoughRootUsers(rootUserCount), 'error');
        return;
      }

      deleteConfirmation = '';
      deleteReason = '';
      showDeleteModal = true;
    } catch (err: unknown) {
      log.error({ err }, 'Error checking root users');
      deleteConfirmation = '';
      deleteReason = '';
      showDeleteModal = true;
    }
  }

  async function handleDeleteTenant(): Promise<void> {
    if (!canDelete || deleteLoading) return;

    deleteLoading = true;

    try {
      await deleteTenant(deleteReason);
      showToast(MESSAGES.deletionRequested, 'success');

      showDeleteModal = false;
      await invalidateAll();
    } catch (err: unknown) {
      log.error({ err }, 'Error deleting tenant');
      const message =
        err instanceof Error ? err.message : MESSAGES.deletionError;
      showToast(message, 'error');
    }

    // eslint-disable-next-line require-atomic-updates -- Unconditional reset after sync guard; no value dependency
    deleteLoading = false;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    deleteConfirmation = '';
    deleteReason = '';
  }

  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && showDeleteModal) {
      closeDeleteModal();
    }
  }
</script>

<div class="container">
  <!-- ================================================================= -->
  <!-- SECTION 1: Shift Times Configuration (nur mit shift_planning)     -->
  <!-- ================================================================= -->
  {#if shiftPlanningEnabled}
    <div class="card mb-8">
      <div class="card__header">
        <h2 class="card__title">
          <i class="fas fa-clock mr-2"></i>
          Schichtzeiten
        </h2>
        <p class="mt-2 text-(--color-text-secondary)">
          Schichtzeiten für die Schichtplanung.
        </p>
      </div>

      <div class="card__body">
        {#if shiftTimesEdits.length > 0}
          <!-- Column headers -->
          <div
            class="st-header"
            aria-hidden="true"
          >
            <span></span>
            <span>Bezeichnung</span>
            <span>Beginn</span>
            <span>Ende</span>
          </div>

          <!-- Shift rows -->
          <div class="st-grid">
            {#each shiftTimesEdits as shiftTime, index (shiftTime.shiftKey)}
              {@const info = SHIFT_KEY_INFO[shiftTime.shiftKey]}
              <div class="st-row {info.colorClass}">
                <i class="fas {info.icon} st-icon"></i>
                <input
                  type="text"
                  id="shift-label-{shiftTime.shiftKey}"
                  class="form-field__control"
                  aria-label="Bezeichnung {shiftTime.shiftKey}"
                  maxlength={100}
                  bind:value={shiftTimesEdits[index].label}
                />
                <input
                  type="time"
                  id="shift-start-{shiftTime.shiftKey}"
                  class="form-field__control"
                  aria-label="Beginn {shiftTime.shiftKey}"
                  bind:value={shiftTimesEdits[index].startTime}
                />
                <input
                  type="time"
                  id="shift-end-{shiftTime.shiftKey}"
                  class="form-field__control"
                  aria-label="Ende {shiftTime.shiftKey}"
                  bind:value={shiftTimesEdits[index].endTime}
                />
              </div>
            {/each}
          </div>

          <!-- Action Buttons -->
          <div class="mt-4 flex gap-3">
            <button
              type="button"
              class="btn btn-primary"
              onclick={handleSaveShiftTimes}
              disabled={shiftSaving ||
                !shiftTimesChanged() ||
                !shiftTimesValid()}
            >
              {#if shiftSaving}
                <span class="spinner-ring spinner-ring--sm"></span>
                Speichere...
              {:else}
                <i class="fas fa-save"></i>
                Speichern
              {/if}
            </button>
            <button
              type="button"
              class="btn btn-cancel"
              onclick={handleResetShiftTimes}
              disabled={shiftResetting}
            >
              {#if shiftResetting}
                <span class="spinner-ring spinner-ring--sm"></span>
                Zurücksetzen...
              {:else}
                <i class="fas fa-undo"></i>
                Standardwerte
              {/if}
            </button>
          </div>
        {:else}
          <div class="flex items-center gap-3 text-(--color-text-secondary)">
            <span class="spinner-ring spinner-ring--sm"></span>
            Schichtzeiten werden geladen...
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- ================================================================= -->
  <!-- SECTION 2: Storage Usage                                          -->
  <!-- ================================================================= -->
  <div class="card mb-8">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-database mr-2"></i>
        Speicherplatz
      </h2>
      <p class="mt-2 text-(--color-text-secondary)">
        Speicherverbrauch des Tenants.
      </p>
    </div>
    <div class="card__body">
      <div class="storage-bar">
        <div class="storage-bar__labels">
          <span class="storage-bar__used">-- GB belegt</span>
          <span class="storage-bar__total">von -- GB</span>
        </div>
        <div class="storage-bar__track">
          <div
            class="storage-bar__fill"
            style="width: 0%"
          ></div>
        </div>
        <div class="storage-bar__percent">0% belegt</div>
      </div>
    </div>
  </div>

  <!-- ================================================================= -->
  <!-- SECTION 3: Danger Zone (Tenant Deletion)                          -->
  <!-- ================================================================= -->
  <div class="card card--danger-border">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-exclamation-triangle mr-2"></i>
        Gefahrenzone
      </h2>
      <p class="mt-2 text-(--color-text-secondary)">
        Tenant-Verwaltung und Löschoptionen (Zwei-Personen-Prinzip)
      </p>
    </div>

    <div class="card__body">
      {#if hasPendingDeletion && pendingDeletion}
        <div class="alert alert--warning mb-6">
          <div class="alert__icon">
            <i class="fas fa-hourglass-half"></i>
          </div>
          <div class="alert__content flex-1">
            <p class="alert__title">Löschanfrage aktiv</p>
            <p class="alert__message">
              <strong>{getStatusLabel(pendingDeletion.status)}</strong> · Queue
              #{pendingDeletion.queueId}
              · Tenant #{pendingDeletion.tenantId} · Angefordert von {pendingDeletion.requestedByName ??
                'Unbekannt'} am {formatDate(pendingDeletion.requestedAt)}
            </p>
            <a
              href={resolve('/tenant-deletion-status', {})}
              class="btn btn-warning mt-4"
            >
              <i class="fas fa-external-link-alt mr-2"></i>
              Details anzeigen
            </a>
          </div>
        </div>
      {/if}

      <div class="alert alert--danger mb-6">
        <div class="alert__icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <div class="alert__content">
          <p class="alert__title">
            Achtung: Diese Aktion kann nicht rückgängig gemacht werden!
          </p>
          <p class="alert__message">
            Durch das Löschen Ihres Tenants werden <strong>ALLE</strong> Daten unwiderruflich
            gelöscht:
          </p>
          <ul class="mt-4 space-y-1 pl-5 text-sm">
            <li>Alle Administratoren und Mitarbeiter</li>
            <li>Alle Dokumente und Dateien</li>
            <li>Alle Nachrichten und Chats</li>
            <li>Alle Einstellungen und Konfigurationen</li>
            <li>Die gesamte Firmenstruktur</li>
          </ul>
        </div>
      </div>

      {#if !hasPendingDeletion}
        <div class="flex gap-3">
          <button
            type="button"
            class="btn btn-danger"
            onclick={handleShowDeleteModal}
          >
            <i class="fas fa-trash-alt"></i>
            Tenant komplett löschen
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteModal}
  <div
    id="account-delete-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={handleBackdropClick}
    onkeydown={(e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDeleteModal();
    }}
  >
    <div class="ds-modal ds-modal--md">
      <div class="ds-modal__header ds-modal__header--danger">
        <h2 class="ds-modal__title">
          <i class="fas fa-exclamation-triangle mr-3"></i>
          Tenant unwiderruflich löschen
        </h2>
        <button
          type="button"
          class="ds-modal__close"
          onclick={closeDeleteModal}
          aria-label="Schließen"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="ds-modal__body">
        <div class="alert alert--danger mb-6">
          <div class="alert__icon">
            <i class="fas fa-skull-crossbones"></i>
          </div>
          <div class="alert__content">
            <p class="alert__title">LETZTE WARNUNG!</p>
            <p class="alert__message">
              Sie sind dabei, Ihren gesamten Tenant zu löschen. Diese Aktion:
            </p>
            <ul class="mt-2 space-y-1 pl-5 text-sm">
              <li>Löscht ALLE Benutzer (Admins und Mitarbeiter)</li>
              <li>Löscht ALLE Daten und Dokumente</li>
              <li>Löscht ALLE Einstellungen</li>
              <li>Kann NICHT rückgängig gemacht werden</li>
            </ul>
          </div>
        </div>

        <div class="alert alert--info mb-6">
          <div class="alert__icon"><i class="fas fa-shield-alt"></i></div>
          <div class="alert__content">
            <div class="alert__title">
              Zwei-Personen-Prinzip (4-Augen-Prinzip)
            </div>
            <div class="alert__message">
              <p class="mb-2">
                Die Löschung wird <strong>nicht sofort</strong> durchgeführt,
                sondern muss zuerst von einem zweiten Root-Benutzer genehmigt
                werden. Nach der Genehmigung beginnt eine
                <strong>30-tägige Nachfrist</strong>, in der die Löschung noch
                widerrufen werden kann.
              </p>
              <p class="text-sm">
                <i class="fas fa-info-circle mr-1"></i>
                Die tatsächliche Löschung erfolgt erst 30 Tage nach der Genehmigung
                durch den zweiten Root-Benutzer.
              </p>
            </div>
          </div>
        </div>

        <div class="form-field mb-6">
          <label
            class="form-field__label"
            for="deleteConfirmation"
          >
            Geben Sie zur Bestätigung <strong class="text-red-500"
              >{DELETE_CONFIRMATION_TEXT}</strong
            > ein:
          </label>
          <input
            type="text"
            id="deleteConfirmation"
            class="form-field__control"
            placeholder="Geben Sie {DELETE_CONFIRMATION_TEXT} ein"
            bind:value={deleteConfirmation}
          />
        </div>

        <div class="form-field">
          <label
            for="deleteReason"
            class="form-field__label"
          >
            Grund für die Löschung (min. {MIN_REASON_LENGTH} Zeichen):
          </label>
          <textarea
            id="deleteReason"
            class="form-field__control"
            class:form-field__control--error={deleteReason.length > 0 &&
              !isReasonValid}
            rows="3"
            placeholder="Bitte geben Sie einen Grund an (min. {MIN_REASON_LENGTH} Zeichen)..."
            minlength={MIN_REASON_LENGTH}
            bind:value={deleteReason}
          ></textarea>
          {#if deleteReason.length > 0 && !isReasonValid}
            <span class="form-field__message form-field__message--error">
              {MESSAGES.reasonTooShort(deleteReason.length)}
            </span>
          {:else if deleteReason.length > 0}
            <span class="form-field__message form-field__message--success">
              {MESSAGES.characterCount(deleteReason.length)}
            </span>
          {/if}
        </div>
      </div>

      <div class="ds-modal__footer ds-modal__footer--end">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={closeDeleteModal}
        >
          <i class="fas fa-times"></i>
          Abbrechen
        </button>
        <button
          type="button"
          class="btn btn-danger"
          onclick={handleDeleteTenant}
          disabled={!canDelete || deleteLoading}
        >
          {#if deleteLoading}
            <span class="spinner-ring spinner-ring--sm"></span>
            Lösche...
          {:else}
            <i class="fas fa-trash-alt"></i>
            Endgültig löschen
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Danger Border Variant */
  .card--danger-border {
    border-color: color-mix(in oklch, var(--color-danger) 30%, transparent);
  }

  .card--danger-border:hover {
    border-color: color-mix(in oklch, var(--color-danger) 50%, transparent);
  }

  /* Shift Times — Compact Grid */
  .st-header {
    display: grid;
    grid-template-columns: 2rem 1fr 7.5rem 7.5rem;
    gap: 0.5rem;
    padding: 0 0.75rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .st-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .st-row {
    display: grid;
    grid-template-columns: 2rem 1fr 7.5rem 7.5rem;
    gap: 0.5rem;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-md, 0.5rem);
    border-left: 3px solid transparent;
    transition: background-color 0.15s ease;
  }

  .st-row:hover {
    background: color-mix(in oklch, var(--color-white) 3%, transparent);
  }

  .st-icon {
    font-size: 0.95rem;
    text-align: center;
  }

  /* Color accents */
  .st-row.shift-early {
    border-left-color: oklch(84.42% 0.1721 84.94 / 70%);
  }

  .st-row.shift-early .st-icon {
    color: oklch(84.42% 0.1721 84.94);
  }

  .st-row.shift-late {
    border-left-color: color-mix(
      in oklch,
      var(--color-primary) 70%,
      transparent
    );
  }

  .st-row.shift-late .st-icon {
    color: var(--color-primary);
  }

  .st-row.shift-night {
    border-left-color: oklch(51.68% 0.2151 321.23 / 70%);
  }

  .st-row.shift-night .st-icon {
    color: oklch(51.68% 0.2151 321.23);
  }

  /* Storage Bar */
  .storage-bar__labels {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }

  .storage-bar__used {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .storage-bar__total {
    color: var(--color-text-secondary);
  }

  .storage-bar__track {
    border-radius: 4px;
    background: color-mix(in oklch, var(--color-white) 8%, transparent);
    box-shadow: inset 0 1px 3px
      color-mix(in oklch, var(--color-black) 30%, transparent);
    height: 10px;
    overflow: hidden;
  }

  .storage-bar__fill {
    position: relative;
    border-radius: 4px;
    background: var(--color-success, #22c55e);
    height: 100%;
    overflow: hidden;
  }

  .storage-bar__fill::after {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      45deg,
      transparent 25%,
      color-mix(in oklch, var(--color-white) 20%, transparent) 25%,
      color-mix(in oklch, var(--color-white) 20%, transparent) 50%,
      transparent 50%,
      transparent 75%,
      color-mix(in oklch, var(--color-white) 20%, transparent) 75%,
      color-mix(in oklch, var(--color-white) 20%, transparent)
    );
    background-size: 20px 20px;
    content: '';
  }

  .storage-bar__percent {
    margin-top: 0.375rem;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    text-align: right;
  }

  @media (width <= 640px) {
    .st-header {
      display: none;
    }

    .st-row {
      grid-template-columns: 2rem 1fr;
      grid-template-rows: auto auto;
      gap: 0.375rem;
    }

    .st-icon {
      grid-row: 1 / -1;
      align-self: start;
      padding-top: 0.5rem;
    }

    .st-row input[type='time'] {
      grid-column: 2;
    }
  }
</style>
