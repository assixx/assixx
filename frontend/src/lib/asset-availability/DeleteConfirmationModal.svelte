<!--
  DeleteConfirmationModal.svelte (Shared - Asset Availability)
  Modal for confirming deletion of asset availability entries.
  Self-contained with internal state and API calls.
-->
<script lang="ts">
  import { createLogger } from '$lib/utils/logger';

  import { formatDate, getStatusClass, getStatusIcon, getStatusText } from './helpers';

  const log = createLogger('AssetDeleteConfirmationModal');

  // =============================================================================
  // TYPES
  // =============================================================================

  interface AssetAvailabilityEntry {
    id: number;
    assetId: number;
    status: string;
    startDate: string;
    endDate: string;
    reason: string | null;
    notes: string | null;
    createdBy: number | null;
    createdByName: string | null;
    createdAt: string;
    updatedAt: string;
  }

  interface Props {
    entry: AssetAvailabilityEntry | null;
    show: boolean;
    onClose: () => void;
    onSuccess: () => Promise<void>;
  }

  // =============================================================================
  // PROPS
  // =============================================================================

  const { entry, show, onClose, onSuccess }: Props = $props();

  // =============================================================================
  // STATE
  // =============================================================================

  let submitting = $state(false);

  // =============================================================================
  // HANDLERS
  // =============================================================================

  function handleClose(): void {
    onClose();
  }

  async function handleDelete(): Promise<void> {
    if (entry === null) return;

    submitting = true;
    try {
      const token =
        document.cookie
          .split('; ')
          .find((row) => row.startsWith('accessToken='))
          ?.split('=')[1] ?? '';

      const response = await fetch(`/api/v2/assets/availability/${entry.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete entry');
      }

      handleClose();
      await onSuccess();
    } catch (err: unknown) {
      log.error({ err }, 'Error deleting asset availability entry');
    } finally {
      submitting = false;
    }
  }
</script>

{#if show && entry !== null}
  <div
    id="delete-asset-availability-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-asset-avail-modal-title"
  >
    <div
      class="ds-modal"
      role="presentation"
    >
      <div class="ds-modal__header">
        <h3
          class="ds-modal__title"
          id="delete-asset-avail-modal-title"
        >
          <i class="fas fa-trash mr-2 text-(--color-danger)"></i>
          Eintrag löschen
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schließen"
          onclick={handleClose}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="ds-modal__body">
        <p class="text-(--color-text-secondary)">
          Möchten Sie diesen Anlagenverfügbarkeitseintrag wirklich löschen?
        </p>
        <div class="mt-4 rounded-lg bg-(--color-bg-secondary) p-4">
          <div class="mb-2 flex items-center gap-2">
            <span class="badge {getStatusClass(entry.status)}">
              <i class="fas {getStatusIcon(entry.status)} mr-1"></i>
              {getStatusText(entry.status)}
            </span>
          </div>
          <p class="text-sm">
            <strong>Zeitraum:</strong>
            {formatDate(entry.startDate)} - {formatDate(entry.endDate)}
          </p>
          {#if entry.reason}
            <p class="mt-1 text-sm">
              <strong>Grund:</strong>
              {entry.reason}
            </p>
          {/if}
        </div>
        <p class="mt-4 text-sm text-(--color-warning)">
          <i class="fas fa-exclamation-triangle mr-1"></i>
          Diese Aktion kann nicht rückgängig gemacht werden.
        </p>
      </div>

      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={handleClose}>Abbrechen</button
        >
        <button
          type="button"
          class="btn btn-danger"
          disabled={submitting}
          onclick={() => {
            void handleDelete();
          }}
        >
          {#if submitting}<span class="spinner-ring spinner-ring--sm mr-2"></span>{/if}
          Löschen
        </button>
      </div>
    </div>
  </div>
{/if}
